import Decimal from "decimal.js";
import {
  Prisma,
  type InvestmentAssetType,
  type InvestmentTrade,
} from "@/generated/prisma/client";
import type {
  CreateInvestmentTradeInput,
  RecordAssetPriceInput,
} from "@/domain";
import {
  calculateLotMetrics,
  calculatePurchaseAdjustment,
  calculateTradeCashAmount,
} from "@/domain/investment/metrics";
import { isAdminRole } from "@/domain/role-policy";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  ensureInvestmentRootInTransaction,
} from "@/services/investment-category-service";
import { requireWorkspaceMember } from "@/services/workspace-access";
import {
  fetchCurrencyRate,
  fetchWorldGoldBaseQuote,
  type CurrencyRateQuote,
  type WorldGoldBaseQuote,
} from "@/services/world-gold-price-provider";

type TransactionClient = Prisma.TransactionClient;

const ZERO = new Decimal(0);
const FRESH_PRICE_WINDOW_MS = 15 * 60 * 1_000;
const AUTOMATIC_PROVIDER = "vang.today+frankfurter.dev";

type MarketQuote = {
  bidPrice: Decimal;
  askPrice: Decimal;
  quoteCurrency: string;
  provider: string;
  priceAt: Date;
  metadata: Prisma.InputJsonValue;
};

type TradeAsset = {
  id: string;
  workspaceId: string;
  categoryId: string;
  code: string;
  name: string;
  type: InvestmentAssetType;
  unit: string;
  quoteCurrency: string;
  autoPriceEnabled: boolean;
};

function asDatabaseDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function goldQuoteForAsset(
  asset: TradeAsset,
  quote: WorldGoldBaseQuote,
): MarketQuote {
  if (asset.quoteCurrency !== "VND") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Nguồn giá tự động hiện chỉ hỗ trợ tài sản định giá bằng VND.",
    );
  }

  if (asset.type !== "gold") {
    throw new AppError(
      "VALIDATION_ERROR",
      `Tài sản “${asset.name}” không phải hạng mục Gold.`,
    );
  }
  return {
    bidPrice: quote.baseSellVndPerChi,
    askPrice: quote.baseSellVndPerChi,
    quoteCurrency: "VND",
    provider: AUTOMATIC_PROVIDER,
    priceAt: quote.priceAt,
    metadata: {
      conversion: "XAUUSD_USD_OZ_TO_VND_CHI",
      usdVndRate: quote.usdVndRate.toString(),
      exchangeRateDate: quote.exchangeRateDate,
      xauApiBuyUsdPerOunce: quote.xauApiBuyUsdPerOunce.toString(),
      gramsPerTroyOunce: "31.1034768",
      gramsPerChi: "3.75",
      pricingRule: "MARKET_SELL_EQUALS_API_BUY",
    },
  };
}

function currencyQuoteForAsset(
  asset: TradeAsset,
  quote: CurrencyRateQuote,
): MarketQuote {
  if (asset.type !== "currency" || asset.quoteCurrency !== "VND") {
    throw new AppError(
      "VALIDATION_ERROR",
      `Tài sản “${asset.name}” không phải ngoại tệ định giá bằng VND.`,
    );
  }
  return {
    bidPrice: quote.rate,
    askPrice: quote.rate,
    quoteCurrency: "VND",
    provider: "frankfurter.dev",
    priceAt: quote.priceAt,
    metadata: {
      conversion: `${quote.base}_TO_${quote.quote}`,
      exchangeRateDate: quote.rateDate,
    },
  };
}

async function fetchAutomaticQuoteForAsset(asset: TradeAsset) {
  if (asset.type === "gold") {
    return goldQuoteForAsset(asset, await fetchWorldGoldBaseQuote());
  }
  if (asset.type === "currency") {
    return currencyQuoteForAsset(
      asset,
      await fetchCurrencyRate(asset.unit, asset.quoteCurrency),
    );
  }
  throw new AppError(
    "VALIDATION_ERROR",
    `Tài sản “${asset.name}” không hỗ trợ cập nhật giá tự động.`,
  );
}

async function acquireAdvisoryTransactionLock(
  tx: TransactionClient,
  lockKey: string,
) {
  await tx.$queryRaw<Array<{ lock: string }>>(
    Prisma.sql`
      SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS "lock"
    `,
  );
}

async function lockInvestmentScope(
  tx: TransactionClient,
  workspaceId: string,
  assetId: string,
  walletId: string,
) {
  await acquireAdvisoryTransactionLock(tx, `${workspaceId}:${assetId}`);
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "WALLETS" WHERE "id" = CAST(${walletId} AS uuid) FOR UPDATE`,
  );
}

async function requireInvestmentResources(
  tx: TransactionClient,
  workspaceId: string,
  input: {
    assetId: string;
    walletId: string;
    targetLotId?: string;
  },
) {
  const [asset, walletLink] = await Promise.all([
    tx.investmentAsset.findFirst({
      where: {
        id: input.assetId,
        workspaceId,
        status: "active",
        deletedAt: null,
        category: { status: "active", deletedAt: null, type: "investment" },
      },
    }),
    tx.workspaceWallet.findFirst({
      where: {
        workspaceId,
        walletId: input.walletId,
        wallet: { status: "active", deletedAt: null },
      },
      select: { walletId: true },
    }),
  ]);
  if (!asset) {
    throw new AppError(
      "NOT_FOUND",
      "Tài sản đầu tư không thuộc workspace hoặc đã ngừng hoạt động.",
    );
  }
  if (!walletLink) {
    throw new AppError(
      "WORKSPACE_ISOLATION_VIOLATION",
      "Ví không thuộc workspace hoặc đã ngừng hoạt động.",
    );
  }

  const lot = input.targetLotId
    ? await tx.investmentLot.findFirst({
      where: {
        id: input.targetLotId,
        workspaceId,
        assetId: input.assetId,
        status: { in: ["open", "partial"] },
      },
    })
    : null;
  if (input.targetLotId && !lot) {
    throw new AppError("NOT_FOUND", "Lô đầu tư không còn khả dụng để bán.");
  }

  return { asset, lot };
}

async function latestFreshSnapshot(assetId: string) {
  const cutoff = new Date(Date.now() - FRESH_PRICE_WINDOW_MS);
  return prisma.assetPriceSnapshot.findFirst({
    where: { assetId, fetchedAt: { gte: cutoff } },
    orderBy: [{ priceAt: "desc" }, { fetchedAt: "desc" }],
  });
}

async function resolveBuyMarketPrice(
  asset: TradeAsset,
  manualMarketPrice: Decimal | undefined,
  canRecordManualPrice: boolean,
) {
  if (asset.autoPriceEnabled) {
    if (manualMarketPrice) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Tài sản này sử dụng giá API nên không nhận giá thị trường nhập tay.",
      );
    }
    try {
      return {
        quote: await fetchAutomaticQuoteForAsset(asset),
        fallbackSnapshotId: null,
      };
    } catch (error) {
      const fallback = await latestFreshSnapshot(asset.id);
      if (fallback?.askPrice) {
        return { quote: null, fallbackSnapshotId: fallback.id };
      }
      throw error;
    }
  }

  if (manualMarketPrice) {
    if (!canRecordManualPrice) {
      throw new AppError(
        "FORBIDDEN",
        "Chỉ Admin được nhập giá thị trường thủ công.",
      );
    }
    return {
      quote: {
        bidPrice: manualMarketPrice,
        askPrice: manualMarketPrice,
        quoteCurrency: asset.quoteCurrency,
        provider: "manual-purchase",
        priceAt: new Date(),
        metadata: {
          manual: true,
          source: "investment_purchase",
        },
      } satisfies MarketQuote,
      fallbackSnapshotId: null,
    };
  }

  const manual = await latestFreshSnapshot(asset.id);
  if (!manual?.askPrice) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Tài sản chưa có giá thị trường hợp lệ trong 15 phút gần nhất. Admin cần cập nhật giá trước khi ghi nhận mua.",
    );
  }
  return { quote: null, fallbackSnapshotId: manual.id };
}

async function resolveConfiguredBuyAsset(
  workspaceId: string,
  input: CreateInvestmentTradeInput,
) {
  if (input.side !== "buy" || !input.categoryId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Giao dịch mua thiếu hạng mục đầu tư.",
    );
  }
  const asset = await prisma.investmentAsset.findFirst({
    where: {
      workspaceId,
      categoryId: input.categoryId,
      status: "active",
      deletedAt: null,
      category: {
        type: "investment",
        isProtected: false,
        status: "active",
        deletedAt: null,
        children: { none: { deletedAt: null } },
      },
    },
  });
  if (!asset) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Hạng mục chưa được cấu hình. Admin cần cài đặt nhánh lá và đơn vị trước khi mua.",
    );
  }
  return asset;
}

export async function refreshInvestmentMarketPrices(
  userId: string,
  workspaceId: string,
) {
  await requireWorkspaceMember(userId, workspaceId);
  const [baseQuote, assets] = await Promise.all([
    fetchWorldGoldBaseQuote(),
    prisma.investmentAsset.findMany({
      where: {
        workspaceId,
        autoPriceEnabled: true,
        status: "active",
        deletedAt: null,
      },
      orderBy: { code: "asc" },
    }),
  ]);
  const quotes = await Promise.all(assets.map(async (asset) => {
    if (asset.type === "gold") {
      return { asset, quote: goldQuoteForAsset(asset, baseQuote) };
    }
    if (asset.type === "currency") {
      try {
        const rate = asset.unit.toUpperCase() === "USD"
          ? {
            base: "USD",
            quote: "VND",
            rate: baseQuote.usdVndRate,
            rateDate: baseQuote.exchangeRateDate,
            priceAt: baseQuote.priceAt,
          } satisfies CurrencyRateQuote
          : await fetchCurrencyRate(asset.unit, asset.quoteCurrency);
        return { asset, quote: currencyQuoteForAsset(asset, rate) };
      } catch {
        return null;
      }
    }
    return null;
  }));

  return prisma.$transaction(async (tx) => {
    const results = [];
    for (const entry of quotes) {
      if (!entry) continue;
      const { asset, quote } = entry;
      const snapshot = await tx.assetPriceSnapshot.create({
        data: {
          assetId: asset.id,
          bidPrice: quote.bidPrice,
          askPrice: quote.askPrice,
          quoteCurrency: quote.quoteCurrency,
          provider: quote.provider,
          priceAt: quote.priceAt,
          metadata: quote.metadata,
        },
      });
      results.push({
        assetId: asset.id,
        snapshotId: snapshot.id,
        bidPrice: snapshot.bidPrice.toString(),
        askPrice: snapshot.askPrice?.toString() ?? null,
      });
    }

    return {
      results,
      priceAt: baseQuote.priceAt,
      usdVndRate: baseQuote.usdVndRate.toString(),
      goldSellVndPerChi: baseQuote.baseSellVndPerChi.toString(),
    };
  });
}

async function createPortfolioSnapshot(
  tx: TransactionClient,
  workspaceId: string,
  trade: InvestmentTrade,
) {
  const lots = await tx.investmentLot.findMany({
    where: {
      workspaceId,
      status: { in: ["open", "partial"] },
      remainingQuantity: { gt: 0 },
    },
    include: {
      asset: {
        include: {
          prices: {
            orderBy: [{ priceAt: "desc" }, { fetchedAt: "desc" }],
            take: 1,
          },
        },
      },
    },
  });

  const byAsset = new Map<string, {
    assetId: string;
    quantity: Decimal;
    cost: Decimal;
    marketValue: Decimal;
  }>();
  for (const lot of lots) {
    const latestPrice = lot.asset.prices[0];
    const currentMarketPrice = lot.asset.type === "gold"
      ? latestPrice?.askPrice ?? latestPrice?.bidPrice
      : latestPrice?.bidPrice;
    const metrics = calculateLotMetrics({
      remainingQuantity: lot.remainingQuantity.toString(),
      remainingCost: lot.remainingCost.toString(),
      currentMarketUnitPrice: currentMarketPrice?.toString() ?? null,
      purchaseAdjustmentRatio: lot.purchaseAdjustmentRatio.toString(),
      pricingMode: lot.asset.type === "gold"
        ? "gold_dynamic_spread"
        : lot.asset.autoPriceEnabled
          ? "proportional"
          : "manual",
    });
    const current = byAsset.get(lot.assetId) ?? {
      assetId: lot.assetId,
      quantity: ZERO,
      cost: ZERO,
      marketValue: ZERO,
    };
    current.quantity = current.quantity.plus(lot.remainingQuantity.toString());
    current.cost = current.cost.plus(lot.remainingCost.toString());
    current.marketValue = current.marketValue.plus(metrics.marketValue ?? ZERO);
    byAsset.set(lot.assetId, current);
  }

  const realized = await tx.investmentLotAllocation.aggregate({
    where: { lot: { workspaceId } },
    _sum: { realizedProfit: true },
  });
  const items = [...byAsset.values()];
  const totalCost = items.reduce(
    (sum, item) => sum.plus(item.cost),
    ZERO,
  );
  const marketValue = items.reduce(
    (sum, item) => sum.plus(item.marketValue),
    ZERO,
  );

  await tx.investmentPortfolioSnapshot.create({
    data: {
      workspaceId,
      eventTradeId: trade.id,
      date: trade.date,
      totalCost,
      marketValue,
      realizedProfit: realized._sum.realizedProfit ?? ZERO,
      items: {
        create: items.map((item) => ({
          assetId: item.assetId,
          quantity: item.quantity,
          cost: item.cost,
          marketUnitPrice: item.quantity.gt(0)
            ? item.marketValue
              .div(item.quantity)
              .toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
            : ZERO,
          marketValue: item.marketValue,
        })),
      },
    },
  });
}

async function postApprovedTrade(
  tx: TransactionClient,
  trade: InvestmentTrade,
  marketSnapshot: {
    id: string;
    askPrice: Prisma.Decimal | null;
  } | null,
) {
  await lockInvestmentScope(tx, trade.workspaceId, trade.assetId, trade.walletId);
  const root = await ensureInvestmentRootInTransaction(tx, trade.workspaceId);
  const asset = await tx.investmentAsset.findUniqueOrThrow({
    where: { id: trade.assetId },
    select: { name: true, code: true },
  });
  const transaction = await tx.transaction.create({
    data: {
      memberId: trade.memberId,
      walletId: trade.walletId,
      categoryId: root.id,
      type: trade.side === "buy" ? "investment_buy" : "investment_sell",
      workflowStatus: "approved",
      amount: trade.cashAmount,
      description: trade.description
        ?? `${trade.side === "buy" ? "Mua" : "Bán"} ${asset.code} · ${asset.name}`,
      date: trade.date,
    },
  });

  if (trade.side === "buy") {
    if (!marketSnapshot?.askPrice) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Không có giá thị trường bán ra để tính chênh lệch của lô.",
      );
    }
    const askPrice = new Decimal(marketSnapshot.askPrice.toString());
    const adjustment = calculatePurchaseAdjustment({
      actualPurchaseUnitPrice: trade.executedUnitPrice.toString(),
      marketSellUnitPrice: askPrice,
    });

    await tx.wallet.update({
      where: { id: trade.walletId },
      data: { currentBalance: { decrement: trade.cashAmount } },
    });
    await tx.investmentLot.create({
      data: {
        workspaceId: trade.workspaceId,
        assetId: trade.assetId,
        purchaseTradeId: trade.id,
        originalQuantity: trade.quantity,
        remainingQuantity: trade.quantity,
        originalCost: trade.cashAmount,
        remainingCost: trade.cashAmount,
        purchaseMarketAskPrice: askPrice,
        purchaseAdjustmentRatio: adjustment.ratio,
        purchaseAdjustmentPercent: adjustment.percent,
        openedAt: trade.date,
      },
    });
  } else {
    if (!trade.targetLotId) {
      throw new AppError("VALIDATION_ERROR", "Giao dịch bán chưa chọn lô.");
    }
    const lot = await tx.investmentLot.findFirst({
      where: {
        id: trade.targetLotId,
        workspaceId: trade.workspaceId,
        assetId: trade.assetId,
        status: { in: ["open", "partial"] },
      },
    });
    if (!lot) throw new AppError("NOT_FOUND", "Lô đầu tư không còn để bán.");
    if (!new Decimal(trade.quantity.toString()).eq(lot.remainingQuantity.toString())) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Mỗi giao dịch bán phải chốt toàn bộ số lượng còn lại của một lô.",
      );
    }

    const gross = new Decimal(trade.quantity.toString())
      .times(trade.executedUnitPrice.toString())
      .toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    const net = new Decimal(trade.cashAmount.toString());
    const cost = new Decimal(lot.remainingCost.toString());
    await tx.investmentLotAllocation.create({
      data: {
        sellTradeId: trade.id,
        lotId: lot.id,
        quantity: trade.quantity,
        allocatedCost: cost,
        grossProceeds: gross,
        netProceeds: net,
        realizedProfit: net.minus(cost).toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
      },
    });
    await tx.investmentLot.update({
      where: { id: lot.id },
      data: {
        remainingQuantity: ZERO,
        remainingCost: ZERO,
        status: "closed",
        closedAt: trade.date,
      },
    });
    await tx.wallet.update({
      where: { id: trade.walletId },
      data: { currentBalance: { increment: trade.cashAmount } },
    });
  }

  const postedTrade = await tx.investmentTrade.update({
    where: { id: trade.id },
    data: {
      workflowStatus: "approved",
      transactionId: transaction.id,
    },
  });
  await createPortfolioSnapshot(tx, trade.workspaceId, postedTrade);
  return postedTrade;
}

export async function createInvestmentTrade(
  userId: string,
  workspaceId: string,
  input: CreateInvestmentTradeInput,
) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  const canRecordManualPrice = isAdminRole(member.role.code);
  const asset = input.side === "buy"
    ? await resolveConfiguredBuyAsset(workspaceId, input)
    : await prisma.investmentAsset.findFirst({
      where: {
        id: input.assetId,
        workspaceId,
        status: "active",
        deletedAt: null,
      },
    });
  if (!asset) throw new AppError("NOT_FOUND", "Không tìm thấy tài sản đầu tư.");
  const resolvedInput = { ...input, assetId: asset.id };

  const resolvedMarket = input.side === "buy"
    ? await resolveBuyMarketPrice(
      asset,
      input.marketUnitPrice,
      canRecordManualPrice,
    )
    : null;
  const { cashAmount } = calculateTradeCashAmount(resolvedInput);
  if (!cashAmount.gt(0)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Giá trị giao dịch phải lớn hơn 0.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const resources = await requireInvestmentResources(
      tx,
      workspaceId,
      resolvedInput,
    );
    let marketSnapshot = null;
    if (resolvedMarket?.quote) {
      marketSnapshot = await tx.assetPriceSnapshot.create({
        data: {
          assetId: asset.id,
          bidPrice: resolvedMarket.quote.bidPrice,
          askPrice: resolvedMarket.quote.askPrice,
          quoteCurrency: resolvedMarket.quote.quoteCurrency,
          provider: resolvedMarket.quote.provider,
          priceAt: resolvedMarket.quote.priceAt,
          metadata: resolvedMarket.quote.metadata,
        },
      });
    } else if (resolvedMarket?.fallbackSnapshotId) {
      marketSnapshot = await tx.assetPriceSnapshot.findFirst({
        where: {
          id: resolvedMarket.fallbackSnapshotId,
          assetId: asset.id,
          fetchedAt: {
            gte: new Date(Date.now() - FRESH_PRICE_WINDOW_MS),
          },
        },
      });
    }

    if (resolvedInput.side === "sell" && resources.lot) {
      if (!resolvedInput.quantity.eq(resources.lot.remainingQuantity.toString())) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Số lượng bán phải bằng toàn bộ số lượng còn lại của lô.",
        );
      }
    }

    const trade = await tx.investmentTrade.create({
      data: {
        workspaceId,
        memberId: member.id,
        walletId: resolvedInput.walletId,
        assetId: resolvedInput.assetId,
        targetLotId: resolvedInput.targetLotId ?? null,
        marketPriceSnapshotId: marketSnapshot?.id ?? null,
        side: resolvedInput.side,
        workflowStatus: "approved",
        quantity: resolvedInput.quantity,
        executedUnitPrice: resolvedInput.executedUnitPrice,
        cashAmount,
        description: resolvedInput.description ?? null,
        date: asDatabaseDate(resolvedInput.date),
      },
    });
    const result = await postApprovedTrade(tx, trade, marketSnapshot);
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: `investment.${trade.side}_recorded`,
        entityType: "investment_trade",
        entityId: trade.id,
        metadata: {
          cashAmount: cashAmount.toString(),
          walletId: resolvedInput.walletId,
          lotId: resolvedInput.targetLotId ?? null,
          categoryId: asset.categoryId,
        },
      },
    });
    return result;
  });
}

export async function recordAssetPrice(
  userId: string,
  workspaceId: string,
  input: RecordAssetPriceInput,
) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    const asset = await tx.investmentAsset.findFirst({
      where: {
        id: input.assetId,
        workspaceId,
        status: "active",
        deletedAt: null,
      },
    });
    if (!asset) {
      throw new AppError("NOT_FOUND", "Không tìm thấy tài sản trong workspace.");
    }
    const snapshot = await tx.assetPriceSnapshot.create({
      data: {
        assetId: asset.id,
        bidPrice: input.bidPrice,
        askPrice: input.askPrice ?? input.bidPrice,
        quoteCurrency: asset.quoteCurrency,
        provider: input.provider,
        priceAt: input.priceAt,
        metadata: { manual: true },
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "investment.price_recorded",
        entityType: "investment_asset",
        entityId: asset.id,
        metadata: {
          snapshotId: snapshot.id,
          bidPrice: input.bidPrice.toString(),
          askPrice: (input.askPrice ?? input.bidPrice).toString(),
        },
      },
    });
    return snapshot;
  });
}
