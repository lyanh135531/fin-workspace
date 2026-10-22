import Decimal from "decimal.js";
import { Prisma } from "@/generated/prisma/client";
import {
  allocateGoldSaleCostBasis,
  calculateGoldHoldingValuation,
  findGoldBrandQuoteDefinition,
  formatGoldWeightVi,
  GOLD_BRAND_QUOTES,
  GOLD_PRODUCT_TYPE_LABELS,
} from "@/domain/investment/gold-calculator";
import {
  calculateEarlyWithdrawalInterest,
  calculateSavingsMaturityDate,
  calculateSavingsMetrics,
  SAVINGS_MATURITY_ACTION_LABELS,
  SAVINGS_PAYOUT_MODE_LABELS,
} from "@/domain/investment/savings-calculator";
import {
  addGoldPurchaseLotSchema,
  createGoldHoldingWithInitialLotSchema,
  createSavingsDepositSchema,
  recordGoldSaleSchema,
  settleSavingsDepositSchema,
  updateGoldHoldingPriceSettingsSchema,
  updateGoldPurchaseLotSchema,
} from "@/domain/investment/schemas";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { accessibleWorkspaceMemberWhere } from "@/services/active-workspace";

type TransactionClient = Prisma.TransactionClient;

const ZERO = new Decimal(0);
const TEN = new Decimal(10);
const QUOTE_STALE_MS = 15 * 60 * 1000; // 15 minutes

function parseDateOnly(isoDate: string): Date {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function requireActiveMember(userId: string, workspaceId: string) {
  const member = await prisma.workspaceMember.findFirst({
    where: accessibleWorkspaceMemberWhere(userId, workspaceId),
    include: { workspace: true, role: true },
  });
  if (!member) {
    throw new AppError("FORBIDDEN", "Bạn không có quyền truy cập nhóm tài chính này.");
  }
  return member;
}

async function lockAndVerifyAssetWallet(
  tx: TransactionClient,
  workspaceId: string,
  walletId: string,
) {
  await tx.$queryRaw`SELECT id FROM "WALLETS" WHERE id = ${walletId}::uuid FOR UPDATE`;
  const link = await tx.workspaceWallet.findFirst({
    where: {
      workspaceId,
      walletId,
      wallet: {
        deletedAt: null,
        status: "active",
        kind: "asset",
      },
    },
    include: { wallet: true },
  });
  if (!link) {
    throw new AppError(
      "NOT_FOUND",
      "Không tìm thấy ví tài sản đang hoạt động đã chọn.",
    );
  }
  return link.wallet;
}

type VangTodayApiResponse = {
  success?: boolean;
  prices?: Record<
    string,
    {
      name?: string;
      buy?: number;
      sell?: number;
      change_buy?: number;
      change_sell?: number;
      currency?: string;
    }
  >;
};

/**
 * Tự động đồng bộ bảng giá vàng các thương hiệu lớn tại Việt Nam (SJC, BTMC, DOJI, PNJ, VietinBank)
 * từ nguồn trực tuyến và lưu cache vào bảng `GOLD_PRICE_QUOTE`.
 */
export async function syncVietnameseGoldMarketQuotes(force = false) {
  const existingQuotes = await prisma.goldPriceQuote.findMany();
  const existingMap = new Map(
    existingQuotes.map((item) => [item.providerCode, item]),
  );

  const now = new Date();
  const latestFetchedAt = existingQuotes.reduce<Date | null>((latest, item) => {
    if (!latest || item.fetchedAt > latest) return item.fetchedAt;
    return latest;
  }, null);

  const isFresh =
    !force &&
    existingQuotes.length >= GOLD_BRAND_QUOTES.length &&
    latestFetchedAt !== null &&
    now.getTime() - latestFetchedAt.getTime() < QUOTE_STALE_MS;

  if (!isFresh) {
    let remotePrices: VangTodayApiResponse["prices"] | null = null;
    try {
      const response = await fetch("https://www.vang.today/api/prices", {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(4000),
        cache: "no-store",
      });
      if (response.ok) {
        const payload = (await response.json()) as VangTodayApiResponse;
        if (payload?.prices && typeof payload.prices === "object") {
          remotePrices = payload.prices;
        }
      }
    } catch {
      remotePrices = null;
    }

    for (const def of GOLD_BRAND_QUOTES) {
      const remote = remotePrices?.[def.providerCode];
      const existing = existingMap.get(def.providerCode);

      // vang.today trả giá theo VND/lượng (10 chỉ) -> chia 10 để quy về VND/chỉ
      const buyPerChi =
        remote && typeof remote.buy === "number" && remote.buy > 0
          ? new Decimal(remote.buy).div(TEN).toDecimalPlaces(0)
          : existing
            ? new Decimal(existing.buyPricePerChi.toString())
            : new Decimal(def.defaultBuyPricePerChi);

      const sellPerChi =
        remote && typeof remote.sell === "number" && remote.sell > 0
          ? new Decimal(remote.sell).div(TEN).toDecimalPlaces(0)
          : existing
            ? new Decimal(existing.sellPricePerChi.toString())
            : new Decimal(def.defaultSellPricePerChi);

      const changeBuyPerChi =
        remote && typeof remote.change_buy === "number"
          ? new Decimal(remote.change_buy).div(TEN).toDecimalPlaces(0)
          : existing
            ? new Decimal(existing.changeBuyPerChi.toString())
            : ZERO;

      const changeSellPerChi =
        remote && typeof remote.change_sell === "number"
          ? new Decimal(remote.change_sell).div(TEN).toDecimalPlaces(0)
          : existing
            ? new Decimal(existing.changeSellPerChi.toString())
            : ZERO;

      await prisma.goldPriceQuote.upsert({
        where: { providerCode: def.providerCode },
        create: {
          providerCode: def.providerCode,
          brandName: def.brandName,
          productLabel: def.productLabel,
          productType: def.productType,
          buyPricePerChi: buyPerChi,
          sellPricePerChi: sellPerChi,
          changeBuyPerChi,
          changeSellPerChi,
          currency: "VND",
          fetchedAt: now,
        },
        update: {
          brandName: def.brandName,
          productLabel: def.productLabel,
          productType: def.productType,
          buyPricePerChi: buyPerChi,
          sellPricePerChi: sellPerChi,
          changeBuyPerChi,
          changeSellPerChi,
          ...(remote ? { fetchedAt: now } : {}),
        },
      });
    }
  }

  const finalQuotes = await prisma.goldPriceQuote.findMany();
  const quoteMap = new Map(finalQuotes.map((q) => [q.providerCode, q]));

  return GOLD_BRAND_QUOTES.map((def) => {
    const row = quoteMap.get(def.providerCode);
    const buyPerChi = row
      ? new Decimal(row.buyPricePerChi.toString())
      : new Decimal(def.defaultBuyPricePerChi);
    const sellPerChi = row
      ? new Decimal(row.sellPricePerChi.toString())
      : new Decimal(def.defaultSellPricePerChi);
    const changeBuyPerChi = row
      ? new Decimal(row.changeBuyPerChi.toString())
      : ZERO;
    const changeSellPerChi = row
      ? new Decimal(row.changeSellPerChi.toString())
      : ZERO;

    return {
      providerCode: def.providerCode,
      brandName: def.brandName,
      productLabel: def.productLabel,
      shortLabel: def.shortLabel,
      productType: def.productType,
      buyPricePerChi: buyPerChi.toFixed(0),
      sellPricePerChi: sellPerChi.toFixed(0),
      buyPricePerLuong: buyPerChi.mul(TEN).toFixed(0),
      sellPricePerLuong: sellPerChi.mul(TEN).toFixed(0),
      changeBuyPerChi: changeBuyPerChi.toFixed(0),
      changeSellPerChi: changeSellPerChi.toFixed(0),
      fetchedAt: (row?.fetchedAt ?? now).toISOString(),
    };
  });
}

export async function getWorkspaceInvestmentsOverview(
  userId: string,
  workspaceId: string,
  options?: { syncQuotesOnlyWhenHoldingGold?: boolean },
) {
  const member = await requireActiveMember(userId, workspaceId);
  const businessDate = getBusinessDateInTimeZone(member.workspace.timeZone);

  const [walletLinks, goldHoldings, savingsDeposits] = await Promise.all([
    prisma.workspaceWallet.findMany({
      where: {
        workspaceId,
        wallet: {
          deletedAt: null,
          status: "active",
          kind: "asset",
        },
      },
      include: { wallet: true },
      orderBy: [{ sortOrder: "asc" }, { wallet: { name: "asc" } }],
    }),
    prisma.goldHolding.findMany({
      where: { workspaceId, deletedAt: null },
      include: {
        purchaseLots: {
          where: { deletedAt: null },
          include: { sourceWallet: { select: { id: true, name: true } } },
          orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
        },
        saleRecords: {
          where: { deletedAt: null },
          include: {
            destinationWallet: { select: { id: true, name: true } },
            purchaseLot: {
              select: {
                id: true,
                purchaseDate: true,
                shopName: true,
                invoiceOrSerial: true,
              },
            },
          },
          orderBy: [{ saleDate: "desc" }, { createdAt: "desc" }],
        },
      },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.savingsDeposit.findMany({
      where: { workspaceId, deletedAt: null },
      include: {
        sourceWallet: { select: { id: true, name: true } },
        settlements: {
          include: {
            destinationWallet: { select: { id: true, name: true } },
          },
          orderBy: [{ settlementDate: "desc" }, { createdAt: "desc" }],
        },
      },
      orderBy: [{ status: "asc" }, { maturityDate: "asc" }],
    }),
  ]);

  const quotes =
    options?.syncQuotesOnlyWhenHoldingGold && goldHoldings.length === 0
      ? []
      : await syncVietnameseGoldMarketQuotes(false);

  const quoteByCode = new Map(quotes.map((q) => [q.providerCode, q]));

  let totalGoldMarketValue = ZERO;
  let totalGoldCostBasis = ZERO;
  let totalGoldUnrealizedProfit = ZERO;
  let totalGoldRealizedProfit = ZERO;
  let totalGoldQuantityChi = ZERO;

  const goldItems = goldHoldings.map((holding) => {
    const linkedQuote = holding.quoteProviderCode
      ? quoteByCode.get(holding.quoteProviderCode)
      : null;

    const latestLotPrice = holding.purchaseLots[0]
      ? new Decimal(holding.purchaseLots[0].unitPricePerChi.toString())
      : new Decimal("13860000");

    const buyOffset = new Decimal(holding.peggedBuyOffsetPerChi.toString());
    const sellOffset = new Decimal(holding.peggedSellOffsetPerChi.toString());

    let marketBuybackPricePerChi: Decimal;
    let marketSellPricePerChi: Decimal;

    if (holding.priceSourceMode === "auto_brand" && linkedQuote) {
      marketBuybackPricePerChi = new Decimal(linkedQuote.buyPricePerChi);
      marketSellPricePerChi = new Decimal(linkedQuote.sellPricePerChi);
    } else if (holding.priceSourceMode === "pegged_brand" && linkedQuote) {
      const ratio =
        holding.productType === "jewelry_18k"
          ? new Decimal("0.75")
          : new Decimal(1);
      const effBuy = new Decimal(linkedQuote.buyPricePerChi)
        .mul(ratio)
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
      const effSell = new Decimal(linkedQuote.sellPricePerChi)
        .mul(ratio)
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
      marketBuybackPricePerChi = Decimal.max(effBuy.plus(buyOffset), ZERO);
      marketSellPricePerChi = Decimal.max(effSell.plus(sellOffset), ZERO);
    } else {
      marketBuybackPricePerChi = holding.manualBuybackPricePerChi
        ? new Decimal(holding.manualBuybackPricePerChi.toString())
        : latestLotPrice;
      marketSellPricePerChi = holding.manualSellPricePerChi
        ? new Decimal(holding.manualSellPricePerChi.toString())
        : marketBuybackPricePerChi;
    }

    const valuation = calculateGoldHoldingValuation({
      totalQuantityChi: holding.totalQuantityChi.toString(),
      totalCostBasisAmount: holding.totalCostBasisAmount.toString(),
      realizedProfitAmount: holding.realizedProfitAmount.toString(),
      marketBuybackPricePerChi,
      marketSellPricePerChi,
    });

    const weightFormatted = formatGoldWeightVi(
      holding.totalQuantityChi.toString(),
    );

    totalGoldMarketValue = totalGoldMarketValue.plus(
      valuation.marketLiquidationValue,
    );
    totalGoldCostBasis = totalGoldCostBasis.plus(
      valuation.totalCostBasisAmount,
    );
    totalGoldUnrealizedProfit = totalGoldUnrealizedProfit.plus(
      valuation.unrealizedProfitAmount,
    );
    totalGoldRealizedProfit = totalGoldRealizedProfit.plus(
      valuation.realizedProfitAmount,
    );
    totalGoldQuantityChi = totalGoldQuantityChi.plus(
      holding.totalQuantityChi.toString(),
    );

    return {
      id: holding.id,
      name: holding.name,
      brandName: holding.brandName,
      productType: holding.productType,
      productTypeLabel: GOLD_PRODUCT_TYPE_LABELS[holding.productType],
      priceSourceMode: holding.priceSourceMode,
      quoteProviderCode: holding.quoteProviderCode,
      quoteLabel: linkedQuote?.shortLabel ?? null,
      peggedBuyOffsetPerChi: buyOffset.toFixed(0),
      peggedSellOffsetPerChi: sellOffset.toFixed(0),
      storageLocation: holding.storageLocation,
      note: holding.note,
      weightFormatted,
      valuation,
      lots: holding.purchaseLots.map((lot) => ({
        id: lot.id,
        fundingMode: lot.fundingMode,
        sourceWalletId: lot.sourceWalletId,
        sourceWalletName: lot.sourceWallet?.name ?? null,
        purchaseDate: formatIsoDate(lot.purchaseDate),
        quantityChi: new Decimal(lot.quantityChi.toString()).toFixed(4),
        quantityFormatted: formatGoldWeightVi(lot.quantityChi.toString()),
        remainingQuantityChi: new Decimal(
          lot.remainingQuantityChi.toString(),
        ).toFixed(4),
        remainingFormatted: formatGoldWeightVi(
          lot.remainingQuantityChi.toString(),
        ),
        unitPricePerChi: new Decimal(lot.unitPricePerChi.toString()).toFixed(0),
        craftingFeeAmount: new Decimal(
          lot.craftingFeeAmount.toString(),
        ).toFixed(0),
        totalCostAmount: new Decimal(lot.totalCostAmount.toString()).toFixed(0),
        remainingCostAmount: new Decimal(
          lot.remainingCostAmount.toString(),
        ).toFixed(0),
        shopName: lot.shopName,
        invoiceOrSerial: lot.invoiceOrSerial,
        note: lot.note,
        canDelete: new Decimal(lot.remainingQuantityChi.toString()).eq(
          new Decimal(lot.quantityChi.toString()),
        ),
        canEditFinancials:
          holding.saleRecords.length === 0 &&
          new Decimal(lot.remainingQuantityChi.toString()).eq(
            new Decimal(lot.quantityChi.toString()),
          ),
      })),
      sales: holding.saleRecords.map((sale) => ({
        id: sale.id,
        costMode: sale.costMode,
        purchaseLotId: sale.purchaseLotId,
        purchaseLotDate: sale.purchaseLot
          ? formatIsoDate(sale.purchaseLot.purchaseDate)
          : null,
        destinationWalletId: sale.destinationWalletId,
        destinationWalletName: sale.destinationWallet.name,
        saleDate: formatIsoDate(sale.saleDate),
        quantityChi: new Decimal(sale.quantityChi.toString()).toFixed(4),
        quantityFormatted: formatGoldWeightVi(sale.quantityChi.toString()),
        sellPricePerChi: new Decimal(sale.sellPricePerChi.toString()).toFixed(0),
        feeOrDeductionAmount: new Decimal(
          sale.feeOrDeductionAmount.toString(),
        ).toFixed(0),
        grossProceedsAmount: new Decimal(
          sale.grossProceedsAmount.toString(),
        ).toFixed(0),
        netProceedsAmount: new Decimal(
          sale.netProceedsAmount.toString(),
        ).toFixed(0),
        costBasisAllocatedAmount: new Decimal(
          sale.costBasisAllocatedAmount.toString(),
        ).toFixed(0),
        realizedProfitAmount: new Decimal(
          sale.realizedProfitAmount.toString(),
        ).toFixed(0),
        note: sale.note,
      })),
    };
  });

  let totalSavingsPrincipal = ZERO;
  let totalSavingsAccruedInterest = ZERO;
  let totalSavingsExpectedMaturityInterest = ZERO;
  let totalSavingsInterestReceived = ZERO;

  const savingsItems = savingsDeposits.map((deposit) => {
    const startDate = formatIsoDate(deposit.startDate);
    const maturityDate = formatIsoDate(deposit.maturityDate);
    const currentPrincipal = new Decimal(
      deposit.currentPrincipalAmount.toString(),
    );
    const interestReceived = new Decimal(
      deposit.totalInterestReceived.toString(),
    );

    const metrics = calculateSavingsMetrics({
      currentPrincipalAmount: currentPrincipal,
      annualInterestRate: deposit.annualInterestRate.toString(),
      nonTermInterestRate: deposit.nonTermInterestRate.toString(),
      startDate,
      maturityDate,
      businessDate,
    });

    if (deposit.status === "active") {
      totalSavingsPrincipal = totalSavingsPrincipal.plus(currentPrincipal);
      totalSavingsAccruedInterest = totalSavingsAccruedInterest.plus(
        metrics.accruedTermInterestToDate,
      );
      totalSavingsExpectedMaturityInterest =
        totalSavingsExpectedMaturityInterest.plus(
          metrics.expectedMaturityInterest,
        );
    }
    totalSavingsInterestReceived =
      totalSavingsInterestReceived.plus(interestReceived);

    return {
      id: deposit.id,
      name: deposit.name,
      bankName: deposit.bankName,
      accountOrPassbookNumber: deposit.accountOrPassbookNumber,
      fundingMode: deposit.fundingMode,
      sourceWalletId: deposit.sourceWalletId,
      sourceWalletName: deposit.sourceWallet?.name ?? null,
      principalAmount: new Decimal(deposit.principalAmount.toString()).toFixed(
        0,
      ),
      currentPrincipalAmount: currentPrincipal.toFixed(0),
      annualInterestRate: new Decimal(
        deposit.annualInterestRate.toString(),
      ).toFixed(2),
      nonTermInterestRate: new Decimal(
        deposit.nonTermInterestRate.toString(),
      ).toFixed(2),
      termMonths: deposit.termMonths,
      startDate,
      maturityDate,
      interestPayoutMode: deposit.interestPayoutMode,
      interestPayoutModeLabel:
        SAVINGS_PAYOUT_MODE_LABELS[deposit.interestPayoutMode],
      maturityAction: deposit.maturityAction,
      maturityActionLabel:
        SAVINGS_MATURITY_ACTION_LABELS[deposit.maturityAction],
      totalInterestReceived: interestReceived.toFixed(0),
      status: deposit.status,
      settledAt: deposit.settledAt?.toISOString() ?? null,
      note: deposit.note,
      metrics,
      settlements: deposit.settlements.map((s) => ({
        id: s.id,
        settlementDate: formatIsoDate(s.settlementDate),
        settlementType: s.settlementType,
        destinationWalletName: s.destinationWallet?.name ?? null,
        principalWithdrawnAmount: new Decimal(
          s.principalWithdrawnAmount.toString(),
        ).toFixed(0),
        interestReceivedAmount: new Decimal(
          s.interestReceivedAmount.toString(),
        ).toFixed(0),
        totalReceivedAmount: new Decimal(
          s.totalReceivedAmount.toString(),
        ).toFixed(0),
        note: s.note,
      })),
    };
  });

  const totalPortfolioMarketValue = totalGoldMarketValue
    .plus(totalSavingsPrincipal)
    .plus(totalSavingsAccruedInterest);
  const totalPortfolioCostBasis = totalGoldCostBasis.plus(
    totalSavingsPrincipal,
  );
  const totalPortfolioUnrealizedGain = totalGoldUnrealizedProfit.plus(
    totalSavingsAccruedInterest,
  );
  const totalPortfolioRealizedGain = totalGoldRealizedProfit.plus(
    totalSavingsInterestReceived,
  );

  return {
    workspace: {
      id: workspaceId,
      name: member.workspace.name,
      currency: member.workspace.baseCurrency,
      businessDate,
    },
    wallets: walletLinks.map(({ wallet }) => ({
      id: wallet.id,
      name: wallet.name,
      currentBalance: new Decimal(wallet.currentBalance.toString()).toFixed(0),
    })),
    quotes,
    summary: {
      totalPortfolioMarketValue: totalPortfolioMarketValue.toFixed(0),
      totalPortfolioCostBasis: totalPortfolioCostBasis.toFixed(0),
      totalPortfolioUnrealizedGain: totalPortfolioUnrealizedGain.toFixed(0),
      totalPortfolioRealizedGain: totalPortfolioRealizedGain.toFixed(0),
      gold: {
        totalQuantityChi: totalGoldQuantityChi.toFixed(4),
        totalWeightFormatted: formatGoldWeightVi(totalGoldQuantityChi),
        totalMarketValue: totalGoldMarketValue.toFixed(0),
        totalCostBasis: totalGoldCostBasis.toFixed(0),
        totalUnrealizedProfit: totalGoldUnrealizedProfit.toFixed(0),
        totalRealizedProfit: totalGoldRealizedProfit.toFixed(0),
        holdingCount: goldItems.filter((g) =>
          new Decimal(g.valuation.totalQuantityChi).gt(0),
        ).length,
      },
      savings: {
        totalPrincipal: totalSavingsPrincipal.toFixed(0),
        totalAccruedInterest: totalSavingsAccruedInterest.toFixed(0),
        totalExpectedMaturityInterest:
          totalSavingsExpectedMaturityInterest.toFixed(0),
        totalInterestReceived: totalSavingsInterestReceived.toFixed(0),
        activeCount: savingsItems.filter((s) => s.status === "active").length,
        dueSoonCount: savingsItems.filter(
          (s) =>
            s.status === "active" &&
            (s.metrics.isDueSoon || s.metrics.isMatured),
        ).length,
      },
    },
    goldHoldings: goldItems,
    savingsDeposits: savingsItems,
  };
}

async function createGoldPurchaseLotInTx(
  tx: TransactionClient,
  params: {
    workspaceId: string;
    memberId: string;
    holdingId: string;
    holdingName: string;
    fundingMode: "from_wallet" | "existing_asset";
    sourceWalletId?: string | null;
    purchaseDate: string;
    quantityChi: string;
    unitPricePerChi: string;
    craftingFeeAmount?: string;
    shopName?: string | null;
    invoiceOrSerial?: string | null;
    note?: string | null;
  },
) {
  const quantityChi = new Decimal(params.quantityChi).toDecimalPlaces(4);
  const unitPricePerChi = new Decimal(params.unitPricePerChi).toDecimalPlaces(0);
  const craftingFeeAmount = Decimal.max(
    new Decimal(params.craftingFeeAmount || "0").toDecimalPlaces(0),
    ZERO,
  );
  const totalCostAmount = quantityChi
    .mul(unitPricePerChi)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .plus(craftingFeeAmount);

  let ledgerTransactionId: string | null = null;
  if (params.fundingMode === "from_wallet") {
    if (!params.sourceWalletId) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Vui lòng chọn ví tài sản để trích tiền mua vàng.",
      );
    }
    const wallet = await lockAndVerifyAssetWallet(
      tx,
      params.workspaceId,
      params.sourceWalletId,
    );
    const walletBalance = new Decimal(wallet.currentBalance.toString());
    if (walletBalance.lt(totalCostAmount)) {
      throw new AppError(
        "CONFLICT",
        `Số dư ví "${wallet.name}" không đủ để trích ${totalCostAmount.toNumber().toLocaleString("vi-VN")} ₫ mua vàng.`,
      );
    }

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { currentBalance: walletBalance.minus(totalCostAmount) },
    });

    const weightStr = formatGoldWeightVi(quantityChi).primary;
    const ledgerTx = await tx.transaction.create({
      data: {
        memberId: params.memberId,
        walletId: wallet.id,
        type: "expense",
        purpose: "investment_contribution",
        workflowStatus: "approved",
        amount: totalCostAmount,
        jarCode: "INVESTMENT",
        description: `Mua ${weightStr} — ${params.holdingName}`,
        date: parseDateOnly(params.purchaseDate),
        postedDate: parseDateOnly(params.purchaseDate),
      },
    });
    ledgerTransactionId = ledgerTx.id;
  }

  const lot = await tx.goldPurchaseLot.create({
    data: {
      workspaceId: params.workspaceId,
      holdingId: params.holdingId,
      createdByMemberId: params.memberId,
      fundingMode: params.fundingMode,
      sourceWalletId:
        params.fundingMode === "from_wallet"
          ? (params.sourceWalletId ?? null)
          : null,
      ledgerTransactionId,
      purchaseDate: parseDateOnly(params.purchaseDate),
      quantityChi,
      remainingQuantityChi: quantityChi,
      unitPricePerChi,
      craftingFeeAmount,
      totalCostAmount,
      remainingCostAmount: totalCostAmount,
      shopName: params.shopName?.trim() || null,
      invoiceOrSerial: params.invoiceOrSerial?.trim() || null,
      note: params.note?.trim() || null,
    },
  });

  await tx.goldHolding.update({
    where: { id: params.holdingId },
    data: {
      totalQuantityChi: { increment: quantityChi },
      totalCostBasisAmount: { increment: totalCostAmount },
    },
  });

  return lot;
}

async function resolvePeggedShopOffsets(params: {
  quoteProviderCode: string;
  productType: string;
  shopBuyPerChi: Decimal;
  shopSellPerChi: Decimal;
}) {
  const row = await prisma.goldPriceQuote.findUnique({
    where: { providerCode: params.quoteProviderCode },
  });
  const def = findGoldBrandQuoteDefinition(params.quoteProviderCode);
  const rawBuy = row
    ? new Decimal(row.buyPricePerChi.toString())
    : new Decimal(def?.defaultBuyPricePerChi ?? "16950000");
  const rawSell = row
    ? new Decimal(row.sellPricePerChi.toString())
    : new Decimal(def?.defaultSellPricePerChi ?? "17250000");
  const ratio =
    params.productType === "jewelry_18k"
      ? new Decimal("0.75")
      : new Decimal(1);
  const effBuy = rawBuy.mul(ratio).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const effSell = rawSell.mul(ratio).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  return {
    peggedBuyOffsetPerChi: params.shopBuyPerChi.minus(effBuy),
    peggedSellOffsetPerChi: params.shopSellPerChi.minus(effSell),
  };
}

export async function createGoldHoldingWithInitialLot(
  userId: string,
  workspaceId: string,
  rawInput: unknown,
) {
  const member = await requireActiveMember(userId, workspaceId);
  const input = createGoldHoldingWithInitialLotSchema.parse(rawInput);
  const businessDate = getBusinessDateInTimeZone(member.workspace.timeZone);

  const brandDef =
    input.priceSourceMode === "auto_brand"
      ? findGoldBrandQuoteDefinition(input.quoteProviderCode)
      : null;

  const resolvedProductType = brandDef
    ? brandDef.productType
    : input.productType;
  const resolvedBrandName = (
    brandDef ? brandDef.brandName : input.brandName
  ).trim();
  const resolvedProviderCode =
    input.priceSourceMode === "auto_brand" ||
    input.priceSourceMode === "pegged_brand"
      ? (input.quoteProviderCode ?? "SJ9999")
      : null;

  const initialSellPrice = input.manualSellPricePerChi
    ? new Decimal(input.manualSellPricePerChi)
    : input.initialLot
      ? new Decimal(input.initialLot.unitPricePerChi)
      : new Decimal("17250000");
  const initialBuybackPrice = input.manualBuybackPricePerChi
    ? new Decimal(input.manualBuybackPricePerChi)
    : Decimal.max(initialSellPrice.minus(150000), ZERO);

  const peggedOffsets =
    input.priceSourceMode === "pegged_brand" && resolvedProviderCode
      ? await resolvePeggedShopOffsets({
          quoteProviderCode: resolvedProviderCode,
          productType: resolvedProductType,
          shopBuyPerChi: initialBuybackPrice,
          shopSellPerChi: initialSellPrice,
        })
      : { peggedBuyOffsetPerChi: ZERO, peggedSellOffsetPerChi: ZERO };

  const isHistoricalLot = Boolean(
    input.initialLot && input.initialLot.purchaseDate < businessDate,
  );

  return prisma.$transaction(async (tx) => {
    const existingCandidates =
      input.mergeMode === "create_separate"
        ? []
        : await tx.goldHolding.findMany({
            where: {
              workspaceId,
              deletedAt: null,
              priceSourceMode: input.priceSourceMode,
              productType: resolvedProductType,
            },
            orderBy: [{ createdAt: "asc" }],
          });

    const matchedExisting = existingCandidates.find((candidate) => {
      if (input.priceSourceMode === "auto_brand") {
        return candidate.quoteProviderCode === resolvedProviderCode;
      }
      return (
        candidate.brandName.trim().toLowerCase() ===
        resolvedBrandName.toLowerCase()
      );
    });

    const holding = matchedExisting
      ? await tx.goldHolding.update({
          where: { id: matchedExisting.id },
          data: {
            quoteProviderCode: resolvedProviderCode,
            ...(!isHistoricalLot
              ? {
                  peggedBuyOffsetPerChi: peggedOffsets.peggedBuyOffsetPerChi,
                  peggedSellOffsetPerChi: peggedOffsets.peggedSellOffsetPerChi,
                  manualBuybackPricePerChi:
                    input.priceSourceMode !== "auto_brand"
                      ? initialBuybackPrice
                      : null,
                  manualSellPricePerChi:
                    input.priceSourceMode !== "auto_brand"
                      ? initialSellPrice
                      : null,
                }
              : {}),
            ...(input.storageLocation?.trim()
              ? { storageLocation: input.storageLocation.trim() }
              : {}),
            ...(input.note?.trim() ? { note: input.note.trim() } : {}),
          },
        })
      : await tx.goldHolding.create({
          data: {
            workspaceId,
            createdByMemberId: member.id,
            name: input.name,
            brandName: resolvedBrandName,
            productType: resolvedProductType,
            priceSourceMode: input.priceSourceMode,
            quoteProviderCode: resolvedProviderCode,
            peggedBuyOffsetPerChi: peggedOffsets.peggedBuyOffsetPerChi,
            peggedSellOffsetPerChi: peggedOffsets.peggedSellOffsetPerChi,
            manualBuybackPricePerChi:
              input.priceSourceMode !== "auto_brand"
                ? initialBuybackPrice
                : null,
            manualSellPricePerChi:
              input.priceSourceMode !== "auto_brand" ? initialSellPrice : null,
            storageLocation: input.storageLocation?.trim() || null,
            note: input.note?.trim() || null,
          },
        });

    if (input.initialLot) {
      await createGoldPurchaseLotInTx(tx, {
        workspaceId,
        memberId: member.id,
        holdingId: holding.id,
        holdingName: holding.name,
        fundingMode: input.initialLot.fundingMode,
        sourceWalletId: input.initialLot.sourceWalletId,
        purchaseDate: input.initialLot.purchaseDate,
        quantityChi: input.initialLot.quantityChi,
        unitPricePerChi: input.initialLot.unitPricePerChi,
        craftingFeeAmount: input.initialLot.craftingFeeAmount,
        shopName: input.initialLot.shopName,
        invoiceOrSerial: input.initialLot.invoiceOrSerial,
        note: input.initialLot.note,
      });
    }

    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: matchedExisting
          ? "investment.gold_lot_purchased"
          : "investment.gold_holding_created",
        entityType: "GoldHolding",
        entityId: holding.id,
        metadata: { name: holding.name, brandName: holding.brandName },
      },
    });

    return holding;
  });
}

export async function addGoldPurchaseLot(
  userId: string,
  workspaceId: string,
  rawInput: unknown,
) {
  const member = await requireActiveMember(userId, workspaceId);
  const input = addGoldPurchaseLotSchema.parse(rawInput);

  return prisma.$transaction(async (tx) => {
    const holding = await tx.goldHolding.findFirst({
      where: { id: input.holdingId, workspaceId, deletedAt: null },
    });
    if (!holding) {
      throw new AppError("NOT_FOUND", "Không tìm thấy khoản vàng đã chọn.");
    }

    const lot = await createGoldPurchaseLotInTx(tx, {
      workspaceId,
      memberId: member.id,
      holdingId: holding.id,
      holdingName: holding.name,
      fundingMode: input.fundingMode,
      sourceWalletId: input.sourceWalletId,
      purchaseDate: input.purchaseDate,
      quantityChi: input.quantityChi,
      unitPricePerChi: input.unitPricePerChi,
      craftingFeeAmount: input.craftingFeeAmount,
      shopName: input.shopName,
      invoiceOrSerial: input.invoiceOrSerial,
      note: input.note,
    });

    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "investment.gold_lot_purchased",
        entityType: "GoldPurchaseLot",
        entityId: lot.id,
        metadata: {
          holdingId: holding.id,
          quantityChi: input.quantityChi,
          unitPricePerChi: input.unitPricePerChi,
        },
      },
    });

    return lot;
  });
}

export async function recordGoldSale(
  userId: string,
  workspaceId: string,
  rawInput: unknown,
) {
  const member = await requireActiveMember(userId, workspaceId);
  const input = recordGoldSaleSchema.parse(rawInput);

  return prisma.$transaction(async (tx) => {
    const holding = await tx.goldHolding.findFirst({
      where: { id: input.holdingId, workspaceId, deletedAt: null },
      include: {
        purchaseLots: {
          where: { deletedAt: null, remainingQuantityChi: { gt: 0 } },
          orderBy: [{ purchaseDate: "asc" }, { createdAt: "asc" }],
        },
      },
    });
    if (!holding) {
      throw new AppError("NOT_FOUND", "Không tìm thấy khoản vàng cần bán.");
    }

    const destinationWallet = await lockAndVerifyAssetWallet(
      tx,
      workspaceId,
      input.destinationWalletId,
    );

    let allocation;
    try {
      allocation = allocateGoldSaleCostBasis({
        costMode: input.costMode,
        sellQuantityChi: input.quantityChi,
        sellPricePerChi: input.sellPricePerChi,
        feeOrDeductionAmount: input.feeOrDeductionAmount,
        holdingQuantityChi: holding.totalQuantityChi.toString(),
        holdingCostBasisAmount: holding.totalCostBasisAmount.toString(),
        openLots: holding.purchaseLots.map((lot) => ({
          id: lot.id,
          remainingQuantityChi: lot.remainingQuantityChi.toString(),
          remainingCostAmount: lot.remainingCostAmount.toString(),
        })),
        targetLotId: input.purchaseLotId,
      });
    } catch (error) {
      throw new AppError(
        "VALIDATION_ERROR",
        error instanceof Error ? error.message : "Dữ liệu bán vàng không hợp lệ.",
      );
    }

    for (const update of allocation.lotUpdates) {
      await tx.goldPurchaseLot.update({
        where: { id: update.lotId },
        data: {
          remainingQuantityChi: update.nextRemainingQuantityChi,
          remainingCostAmount: update.nextRemainingCostAmount,
        },
      });
    }

    const currentWalletBalance = new Decimal(
      destinationWallet.currentBalance.toString(),
    );
    await tx.wallet.update({
      where: { id: destinationWallet.id },
      data: {
        currentBalance: currentWalletBalance.plus(allocation.netProceedsAmount),
      },
    });

    const weightStr = formatGoldWeightVi(input.quantityChi).primary;
    const ledgerTx = await tx.transaction.create({
      data: {
        memberId: member.id,
        walletId: destinationWallet.id,
        type: "income",
        purpose: "investment_settlement",
        workflowStatus: "approved",
        amount: allocation.netProceedsAmount,
        jarCode: "INVESTMENT",
        description: `Bán ${weightStr} — ${holding.name}`,
        date: parseDateOnly(input.saleDate),
        postedDate: parseDateOnly(input.saleDate),
      },
    });

    const saleRecord = await tx.goldSaleRecord.create({
      data: {
        workspaceId,
        holdingId: holding.id,
        purchaseLotId:
          input.costMode === "specific_lot" ? (input.purchaseLotId ?? null) : null,
        createdByMemberId: member.id,
        costMode: input.costMode,
        destinationWalletId: destinationWallet.id,
        ledgerTransactionId: ledgerTx.id,
        saleDate: parseDateOnly(input.saleDate),
        quantityChi: new Decimal(input.quantityChi).toDecimalPlaces(4),
        sellPricePerChi: new Decimal(input.sellPricePerChi).toDecimalPlaces(0),
        feeOrDeductionAmount: new Decimal(
          input.feeOrDeductionAmount || "0",
        ).toDecimalPlaces(0),
        grossProceedsAmount: allocation.grossProceedsAmount,
        netProceedsAmount: allocation.netProceedsAmount,
        costBasisAllocatedAmount: allocation.costBasisAllocatedAmount,
        realizedProfitAmount: allocation.realizedProfitAmount,
        note: input.note?.trim() || null,
      },
    });

    await tx.goldHolding.update({
      where: { id: holding.id },
      data: {
        totalQuantityChi: allocation.nextHoldingQuantityChi,
        totalCostBasisAmount: allocation.nextHoldingCostBasisAmount,
        realizedProfitAmount: { increment: allocation.realizedProfitAmount },
      },
    });

    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "investment.gold_sold",
        entityType: "GoldSaleRecord",
        entityId: saleRecord.id,
        metadata: {
          holdingId: holding.id,
          quantityChi: input.quantityChi,
          netProceedsAmount: allocation.netProceedsAmount.toFixed(0),
          realizedProfitAmount: allocation.realizedProfitAmount.toFixed(0),
        },
      },
    });

    return saleRecord;
  });
}

export async function updateGoldHoldingSettings(
  userId: string,
  workspaceId: string,
  rawInput: unknown,
) {
  await requireActiveMember(userId, workspaceId);
  const input = updateGoldHoldingPriceSettingsSchema.parse(rawInput);

  const existing = await prisma.goldHolding.findFirst({
    where: { id: input.holdingId, workspaceId, deletedAt: null },
  });
  if (!existing) {
    throw new AppError("NOT_FOUND", "Không tìm thấy khoản vàng.");
  }

  const brandDef =
    input.priceSourceMode === "auto_brand"
      ? findGoldBrandQuoteDefinition(input.quoteProviderCode)
      : null;

  const resolvedProductType = brandDef
    ? brandDef.productType
    : existing.productType;
  const resolvedProviderCode =
    input.priceSourceMode === "auto_brand" ||
    input.priceSourceMode === "pegged_brand"
      ? (input.quoteProviderCode ?? "SJ9999")
      : null;

  const nextBuybackPrice = input.manualBuybackPricePerChi
    ? new Decimal(input.manualBuybackPricePerChi)
    : existing.manualBuybackPricePerChi
      ? new Decimal(existing.manualBuybackPricePerChi.toString())
      : new Decimal("16950000");
  const nextSellPrice = input.manualSellPricePerChi
    ? new Decimal(input.manualSellPricePerChi)
    : existing.manualSellPricePerChi
      ? new Decimal(existing.manualSellPricePerChi.toString())
      : nextBuybackPrice.plus(150000);

  const peggedOffsets =
    input.priceSourceMode === "pegged_brand" && resolvedProviderCode
      ? await resolvePeggedShopOffsets({
          quoteProviderCode: resolvedProviderCode,
          productType: resolvedProductType,
          shopBuyPerChi: nextBuybackPrice,
          shopSellPerChi: nextSellPrice,
        })
      : {
          peggedBuyOffsetPerChi: new Decimal(
            existing.peggedBuyOffsetPerChi.toString(),
          ),
          peggedSellOffsetPerChi: new Decimal(
            existing.peggedSellOffsetPerChi.toString(),
          ),
        };

  return prisma.goldHolding.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      brandName: brandDef ? brandDef.brandName : input.brandName,
      productType: resolvedProductType,
      priceSourceMode: input.priceSourceMode,
      quoteProviderCode: resolvedProviderCode,
      peggedBuyOffsetPerChi: peggedOffsets.peggedBuyOffsetPerChi,
      peggedSellOffsetPerChi: peggedOffsets.peggedSellOffsetPerChi,
      manualBuybackPricePerChi:
        input.priceSourceMode !== "auto_brand" ? nextBuybackPrice : null,
      manualSellPricePerChi:
        input.priceSourceMode !== "auto_brand" ? nextSellPrice : null,
      storageLocation: input.storageLocation?.trim() || null,
      note: input.note?.trim() || null,
    },
  });
}

export async function deleteGoldPurchaseLot(
  userId: string,
  workspaceId: string,
  lotId: string,
) {
  await requireActiveMember(userId, workspaceId);

  return prisma.$transaction(async (tx) => {
    const lot = await tx.goldPurchaseLot.findFirst({
      where: { id: lotId, workspaceId, deletedAt: null },
      include: { holding: true },
    });
    if (!lot) {
      throw new AppError("NOT_FOUND", "Không tìm thấy đợt mua vàng.");
    }

    const initialQty = new Decimal(lot.quantityChi.toString());
    const remQty = new Decimal(lot.remainingQuantityChi.toString());
    if (!initialQty.eq(remQty)) {
      throw new AppError(
        "CONFLICT",
        "Đợt mua vàng này đã được bán một phần hoặc toàn bộ nên không thể xóa.",
      );
    }

    const totalCost = new Decimal(lot.totalCostAmount.toString());
    const now = new Date();

    if (lot.fundingMode === "from_wallet" && lot.sourceWalletId) {
      const wallet = await tx.wallet.findFirst({
        where: { id: lot.sourceWalletId, deletedAt: null, status: "active" },
      });
      if (!wallet || wallet.status !== "active") {
        throw new AppError(
          "CONFLICT",
          "Ví liên kết đã ngừng hoạt động hoặc bị xóa, không thể tự động hoàn/thu hồi số dư. Vui lòng kích hoạt lại ví trước.",
        );
      }
      await tx.$queryRaw`SELECT id FROM "WALLETS" WHERE id = ${wallet.id}::uuid FOR UPDATE`;
      const freshWallet =
        (await tx.wallet.findUnique?.({ where: { id: wallet.id } })) ?? wallet;
      if (
        !freshWallet ||
        freshWallet.deletedAt ||
        freshWallet.status !== "active"
      ) {
        throw new AppError(
          "CONFLICT",
          "Ví liên kết đã ngừng hoạt động hoặc bị xóa, không thể tự động hoàn/thu hồi số dư. Vui lòng kích hoạt lại ví trước.",
        );
      }
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          currentBalance: new Decimal(
            freshWallet.currentBalance.toString(),
          ).plus(totalCost),
        },
      });
      if (lot.ledgerTransactionId) {
        await tx.transaction.updateMany({
          where: { id: lot.ledgerTransactionId, deletedAt: null },
          data: { deletedAt: now },
        });
      }
    }

    await tx.goldPurchaseLot.update({
      where: { id: lot.id },
      data: { deletedAt: now },
    });

    const nextQty = Decimal.max(
      new Decimal(lot.holding.totalQuantityChi.toString()).minus(initialQty),
      ZERO,
    );
    const nextCost = nextQty.isZero()
      ? ZERO
      : Decimal.max(
          new Decimal(lot.holding.totalCostBasisAmount.toString()).minus(
            totalCost,
          ),
          ZERO,
        );

    await tx.goldHolding.update({
      where: { id: lot.holdingId },
      data: {
        totalQuantityChi: nextQty,
        totalCostBasisAmount: nextCost,
      },
    });
  });
}

export async function updateGoldPurchaseLot(
  userId: string,
  workspaceId: string,
  rawInput: unknown,
) {
  const member = await requireActiveMember(userId, workspaceId);
  const input = updateGoldPurchaseLotSchema.parse(rawInput);

  return prisma.$transaction(async (tx) => {
    const lot = await tx.goldPurchaseLot.findFirst({
      where: { id: input.lotId, workspaceId, deletedAt: null },
      include: {
        holding: {
          include: {
            saleRecords: { where: { deletedAt: null }, select: { id: true } },
          },
        },
      },
    });
    if (!lot || lot.holding.deletedAt) {
      throw new AppError("NOT_FOUND", "Không tìm thấy đợt mua vàng.");
    }

    const oldQty = new Decimal(lot.quantityChi.toString()).toDecimalPlaces(4);
    const oldUnitPrice = new Decimal(
      lot.unitPricePerChi.toString(),
    ).toDecimalPlaces(0);
    const oldCraftingFee = new Decimal(
      lot.craftingFeeAmount.toString(),
    ).toDecimalPlaces(0);
    const oldTotalCost = new Decimal(
      lot.totalCostAmount.toString(),
    ).toDecimalPlaces(0);

    const newQty = new Decimal(input.quantityChi).toDecimalPlaces(4);
    const newUnitPrice = new Decimal(input.unitPricePerChi).toDecimalPlaces(0);
    const newCraftingFee = Decimal.max(
      new Decimal(input.craftingFeeAmount || "0").toDecimalPlaces(0),
      ZERO,
    );
    const newTotalCost = newQty
      .mul(newUnitPrice)
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      .plus(newCraftingFee);

    const resolvedNewSourceWalletId =
      input.fundingMode === "from_wallet"
        ? (input.sourceWalletId ?? null)
        : null;

    const financialsChanged =
      !oldQty.eq(newQty) ||
      !oldUnitPrice.eq(newUnitPrice) ||
      !oldCraftingFee.eq(newCraftingFee) ||
      lot.fundingMode !== input.fundingMode ||
      (lot.sourceWalletId ?? null) !== resolvedNewSourceWalletId;

    const canEditFinancials =
      lot.holding.saleRecords.length === 0 &&
      new Decimal(lot.remainingQuantityChi.toString()).eq(oldQty);

    if (financialsChanged && !canEditFinancials) {
      throw new AppError(
        "CONFLICT",
        "Khoản vàng này đã phát sinh giao dịch bán nên chỉ có thể sửa ngày mua, nơi mua, mã hóa đơn / số seri hoặc ghi chú của đợt mua (hoặc hoàn tác giao dịch bán trước).",
      );
    }

    const now = new Date();
    let nextLedgerTransactionId = lot.ledgerTransactionId;

    if (!financialsChanged) {
      if (lot.ledgerTransactionId) {
        await tx.transaction.updateMany({
          where: { id: lot.ledgerTransactionId, deletedAt: null },
          data: {
            date: parseDateOnly(input.purchaseDate),
            postedDate: parseDateOnly(input.purchaseDate),
          },
        });
      }
    } else {
      // Hoàn lại số dư vào ví cũ nếu trước đó trích từ ví
      if (lot.fundingMode === "from_wallet" && lot.sourceWalletId) {
        const oldWallet = await tx.wallet.findFirst({
          where: { id: lot.sourceWalletId, deletedAt: null, status: "active" },
        });
        if (!oldWallet || oldWallet.status !== "active") {
          throw new AppError(
            "CONFLICT",
            "Ví liên kết đã ngừng hoạt động hoặc bị xóa, không thể tự động hoàn/thu hồi số dư. Vui lòng kích hoạt lại ví trước.",
          );
        }
        await tx.$queryRaw`SELECT id FROM "WALLETS" WHERE id = ${oldWallet.id}::uuid FOR UPDATE`;
        const freshOldWallet =
          (await tx.wallet.findUnique?.({
            where: { id: oldWallet.id },
          })) ?? oldWallet;
        if (
          !freshOldWallet ||
          freshOldWallet.deletedAt ||
          freshOldWallet.status !== "active"
        ) {
          throw new AppError(
            "CONFLICT",
            "Ví liên kết đã ngừng hoạt động hoặc bị xóa, không thể tự động hoàn/thu hồi số dư. Vui lòng kích hoạt lại ví trước.",
          );
        }
        await tx.wallet.update({
          where: { id: oldWallet.id },
          data: {
            currentBalance: new Decimal(
              freshOldWallet.currentBalance.toString(),
            ).plus(oldTotalCost),
          },
        });
      }

      if (input.fundingMode === "from_wallet") {
        if (!resolvedNewSourceWalletId) {
          throw new AppError(
            "VALIDATION_ERROR",
            "Vui lòng chọn ví tài sản để trích tiền mua vàng.",
          );
        }
        const newWallet = await lockAndVerifyAssetWallet(
          tx,
          workspaceId,
          resolvedNewSourceWalletId,
        );
        const walletBalance = new Decimal(newWallet.currentBalance.toString());
        if (walletBalance.lt(newTotalCost)) {
          throw new AppError(
            "CONFLICT",
            `Số dư ví "${newWallet.name}" không đủ để trích ${newTotalCost.toNumber().toLocaleString("vi-VN")} ₫ mua vàng.`,
          );
        }

        await tx.wallet.update({
          where: { id: newWallet.id },
          data: { currentBalance: walletBalance.minus(newTotalCost) },
        });

        const weightStr = formatGoldWeightVi(newQty).primary;
        let shouldCreateLedgerTx = !nextLedgerTransactionId;
        if (nextLedgerTransactionId) {
          const updatedTx = await tx.transaction.updateMany({
            where: { id: nextLedgerTransactionId, deletedAt: null },
            data: {
              walletId: newWallet.id,
              amount: newTotalCost,
              description: `Mua ${weightStr} — ${lot.holding.name}`,
              date: parseDateOnly(input.purchaseDate),
              postedDate: parseDateOnly(input.purchaseDate),
            },
          });
          if (updatedTx.count === 0) {
            shouldCreateLedgerTx = true;
          }
        }
        if (shouldCreateLedgerTx) {
          const createdTx = await tx.transaction.create({
            data: {
              memberId: member.id,
              walletId: newWallet.id,
              type: "expense",
              purpose: "investment_contribution",
              workflowStatus: "approved",
              amount: newTotalCost,
              jarCode: "INVESTMENT",
              description: `Mua ${weightStr} — ${lot.holding.name}`,
              date: parseDateOnly(input.purchaseDate),
              postedDate: parseDateOnly(input.purchaseDate),
            },
          });
          nextLedgerTransactionId = createdTx.id;
        }
      } else {
        if (nextLedgerTransactionId) {
          await tx.transaction.updateMany({
            where: { id: nextLedgerTransactionId, deletedAt: null },
            data: { deletedAt: now },
          });
          nextLedgerTransactionId = null;
        }
      }
    }

    const updatedLot = await tx.goldPurchaseLot.update({
      where: { id: lot.id },
      data: {
        fundingMode: input.fundingMode,
        sourceWalletId: resolvedNewSourceWalletId,
        ledgerTransactionId: nextLedgerTransactionId,
        purchaseDate: parseDateOnly(input.purchaseDate),
        ...(canEditFinancials
          ? {
              quantityChi: newQty,
              remainingQuantityChi: newQty,
              unitPricePerChi: newUnitPrice,
              craftingFeeAmount: newCraftingFee,
              totalCostAmount: newTotalCost,
              remainingCostAmount: newTotalCost,
            }
          : {}),
        shopName: input.shopName?.trim() || null,
        invoiceOrSerial: input.invoiceOrSerial?.trim() || null,
        note: input.note?.trim() || null,
      },
    });

    if (financialsChanged && canEditFinancials) {
      const allActiveLots = await tx.goldPurchaseLot.findMany({
        where: { holdingId: lot.holdingId, deletedAt: null },
      });
      const totalQty = allActiveLots.reduce(
        (sum, item) => sum.plus(item.remainingQuantityChi.toString()),
        ZERO,
      );
      const totalCost = allActiveLots.reduce(
        (sum, item) => sum.plus(item.remainingCostAmount.toString()),
        ZERO,
      );
      await tx.goldHolding.update({
        where: { id: lot.holdingId },
        data: {
          totalQuantityChi: totalQty,
          totalCostBasisAmount: totalCost,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "investment.gold_lot_updated",
        entityType: "GoldPurchaseLot",
        entityId: lot.id,
        metadata: {
          holdingId: lot.holdingId,
          quantityChi: newQty.toFixed(4),
          unitPricePerChi: newUnitPrice.toFixed(0),
        },
      },
    });

    return updatedLot;
  });
}

export async function deleteGoldSaleRecord(
  userId: string,
  workspaceId: string,
  saleId: string,
) {
  await requireActiveMember(userId, workspaceId);

  return prisma.$transaction(async (tx) => {
    const sale = await tx.goldSaleRecord.findFirst({
      where: { id: saleId, workspaceId, deletedAt: null },
      include: { holding: true },
    });
    if (!sale || sale.holding.deletedAt) {
      throw new AppError("NOT_FOUND", "Không tìm thấy giao dịch bán vàng.");
    }

    const now = new Date();
    const netProceeds = new Decimal(sale.netProceedsAmount.toString());

    if (sale.destinationWalletId && netProceeds.gt(0)) {
      const wallet = await tx.wallet.findFirst({
        where: {
          id: sale.destinationWalletId,
          deletedAt: null,
          status: "active",
        },
      });
      if (!wallet || wallet.status !== "active") {
        throw new AppError(
          "CONFLICT",
          "Ví liên kết đã ngừng hoạt động hoặc bị xóa, không thể tự động hoàn/thu hồi số dư. Vui lòng kích hoạt lại ví trước.",
        );
      }
      await tx.$queryRaw`SELECT id FROM "WALLETS" WHERE id = ${wallet.id}::uuid FOR UPDATE`;
      const freshWallet =
        (await tx.wallet.findUnique?.({
          where: { id: wallet.id },
        })) ?? wallet;
      if (
        !freshWallet ||
        freshWallet.deletedAt ||
        freshWallet.status !== "active"
      ) {
        throw new AppError(
          "CONFLICT",
          "Ví liên kết đã ngừng hoạt động hoặc bị xóa, không thể tự động hoàn/thu hồi số dư. Vui lòng kích hoạt lại ví trước.",
        );
      }
      const walletBalance = new Decimal(
        freshWallet.currentBalance.toString(),
      );
      if (walletBalance.lt(netProceeds)) {
        throw new AppError(
          "CONFLICT",
          `Số dư ví "${freshWallet.name}" hiện không đủ (${walletBalance.toNumber().toLocaleString("vi-VN")} ₫) để thu hồi khoản tiền bán vàng ${netProceeds.toNumber().toLocaleString("vi-VN")} ₫ khi hoàn tác.`,
        );
      }
      await tx.wallet.update({
        where: { id: freshWallet.id },
        data: { currentBalance: walletBalance.minus(netProceeds) },
      });
    }

    if (sale.ledgerTransactionId) {
      await tx.transaction.updateMany({
        where: { id: sale.ledgerTransactionId, deletedAt: null },
        data: { deletedAt: now },
      });
    }

    await tx.goldSaleRecord.update({
      where: { id: sale.id },
      data: { deletedAt: now },
    });

    // Tính lại chính xác số lượng còn lại, giá vốn từng lô và lãi đã chốt theo đúng trình tự thời gian (chronological replay)
    const allLots = await tx.goldPurchaseLot.findMany({
      where: { holdingId: sale.holdingId, deletedAt: null },
      orderBy: [{ purchaseDate: "asc" }, { createdAt: "asc" }],
    });
    const remainingSales = await tx.goldSaleRecord.findMany({
      where: { holdingId: sale.holdingId, deletedAt: null },
      orderBy: [{ saleDate: "asc" }, { createdAt: "asc" }],
    });

    type ReplayLotState = {
      id: string;
      purchaseDateIso: string;
      initialQuantityChi: Decimal;
      initialCostAmount: Decimal;
      remainingQuantityChi: string;
      remainingCostAmount: string;
      unitPricePerChi: string;
      included: boolean;
    };

    const lotStates: ReplayLotState[] = allLots.map((lot) => {
      const initQty = new Decimal(lot.quantityChi.toString());
      const initCost = new Decimal(lot.totalCostAmount.toString());
      return {
        id: lot.id,
        purchaseDateIso: formatIsoDate(lot.purchaseDate),
        initialQuantityChi: initQty,
        initialCostAmount: initCost,
        remainingQuantityChi: initQty.toFixed(4),
        remainingCostAmount: initCost.toFixed(0),
        unitPricePerChi: new Decimal(lot.unitPricePerChi.toString()).toFixed(0),
        included: false,
      };
    });
    const lotStateById = new Map(lotStates.map((s) => [s.id, s]));

    let lotIdx = 0;
    let holdingQty = ZERO;
    let holdingCost = ZERO;
    let totalRealizedProfit = ZERO;

    const includeLotState = (state: ReplayLotState) => {
      if (state.included) return;
      state.included = true;
      holdingQty = holdingQty.plus(state.initialQuantityChi);
      holdingCost = holdingCost.plus(state.initialCostAmount);
    };

    for (const remSale of remainingSales) {
      const saleDateIso = formatIsoDate(remSale.saleDate);
      const sellQty = new Decimal(remSale.quantityChi.toString());

      while (lotIdx < lotStates.length) {
        const candidate = lotStates[lotIdx]!;
        if (candidate.purchaseDateIso <= saleDateIso) {
          includeLotState(candidate);
          lotIdx += 1;
        } else {
          break;
        }
      }

      if (remSale.costMode === "specific_lot" && remSale.purchaseLotId) {
        const referencedLot = lotStateById.get(remSale.purchaseLotId);
        if (referencedLot && !referencedLot.included) {
          includeLotState(referencedLot);
        }
      }

      while (holdingQty.lt(sellQty) && lotIdx < lotStates.length) {
        includeLotState(lotStates[lotIdx]!);
        lotIdx += 1;
      }

      const allocation = allocateGoldSaleCostBasis({
        costMode: remSale.costMode,
        sellQuantityChi: remSale.quantityChi.toString(),
        sellPricePerChi: remSale.sellPricePerChi.toString(),
        feeOrDeductionAmount: remSale.feeOrDeductionAmount.toString(),
        holdingQuantityChi: holdingQty.toFixed(4),
        holdingCostBasisAmount: holdingCost.toFixed(0),
        openLots: lotStates.filter(
          (l) => l.included && new Decimal(l.remainingQuantityChi).gt(0),
        ),
        targetLotId: remSale.purchaseLotId,
      });

      for (const update of allocation.lotUpdates) {
        const target = lotStateById.get(update.lotId);
        if (target) {
          target.remainingQuantityChi =
            update.nextRemainingQuantityChi.toFixed(4);
          target.remainingCostAmount =
            update.nextRemainingCostAmount.toFixed(0);
        }
      }

      holdingQty = new Decimal(allocation.nextHoldingQuantityChi);
      holdingCost = new Decimal(allocation.nextHoldingCostBasisAmount);
      totalRealizedProfit = totalRealizedProfit.plus(
        allocation.realizedProfitAmount,
      );

      await tx.goldSaleRecord.update({
        where: { id: remSale.id },
        data: {
          costBasisAllocatedAmount: new Decimal(
            allocation.costBasisAllocatedAmount,
          ),
          realizedProfitAmount: new Decimal(allocation.realizedProfitAmount),
        },
      });
    }

    while (lotIdx < lotStates.length) {
      includeLotState(lotStates[lotIdx]!);
      lotIdx += 1;
    }

    for (const state of lotStates) {
      await tx.goldPurchaseLot.update({
        where: { id: state.id },
        data: {
          remainingQuantityChi: new Decimal(state.remainingQuantityChi),
          remainingCostAmount: new Decimal(state.remainingCostAmount),
        },
      });
    }

    await tx.goldHolding.update({
      where: { id: sale.holdingId },
      data: {
        totalQuantityChi: holdingQty,
        totalCostBasisAmount: holdingCost,
        realizedProfitAmount: totalRealizedProfit,
      },
    });

    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "investment.gold_sale_reverted",
        entityType: "GoldSaleRecord",
        entityId: sale.id,
        metadata: {
          holdingId: sale.holdingId,
          quantityChi: new Decimal(sale.quantityChi.toString()).toFixed(4),
          netProceedsAmount: netProceeds.toFixed(0),
        },
      },
    });
  });
}

export async function deleteGoldHolding(
  userId: string,
  workspaceId: string,
  holdingId: string,
) {
  await requireActiveMember(userId, workspaceId);

  return prisma.$transaction(async (tx) => {
    const holding = await tx.goldHolding.findFirst({
      where: { id: holdingId, workspaceId, deletedAt: null },
      include: {
        purchaseLots: { where: { deletedAt: null } },
        saleRecords: { where: { deletedAt: null } },
      },
    });
    if (!holding) {
      throw new AppError("NOT_FOUND", "Không tìm thấy khoản vàng.");
    }

    const now = new Date();

    if (holding.saleRecords.length > 0) {
      throw new AppError(
        "CONFLICT",
        "Khoản vàng này đã có lịch sử bán thực tế nên không thể xóa để bảo toàn đối soát sổ cái và lợi nhuận đã chốt.",
      );
    }

    // Chưa có giao dịch bán nào, hoàn lại tiền vào ví cho các lô `from_wallet`
    for (const lot of holding.purchaseLots) {
      if (lot.fundingMode === "from_wallet" && lot.sourceWalletId) {
        const wallet = await tx.wallet.findFirst({
          where: { id: lot.sourceWalletId, deletedAt: null, status: "active" },
        });
        if (!wallet || wallet.status !== "active") {
          throw new AppError(
            "CONFLICT",
            "Ví liên kết đã ngừng hoạt động hoặc bị xóa, không thể tự động hoàn/thu hồi số dư. Vui lòng kích hoạt lại ví trước.",
          );
        }
        await tx.$queryRaw`SELECT id FROM "WALLETS" WHERE id = ${wallet.id}::uuid FOR UPDATE`;
        const freshWallet =
          (await tx.wallet.findUnique?.({
            where: { id: wallet.id },
          })) ?? wallet;
        if (
          !freshWallet ||
          freshWallet.deletedAt ||
          freshWallet.status !== "active"
        ) {
          throw new AppError(
            "CONFLICT",
            "Ví liên kết đã ngừng hoạt động hoặc bị xóa, không thể tự động hoàn/thu hồi số dư. Vui lòng kích hoạt lại ví trước.",
          );
        }
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            currentBalance: new Decimal(
              freshWallet.currentBalance.toString(),
            ).plus(lot.totalCostAmount.toString()),
          },
        });
        if (lot.ledgerTransactionId) {
          await tx.transaction.updateMany({
            where: { id: lot.ledgerTransactionId, deletedAt: null },
            data: { deletedAt: now },
          });
        }
      }
      await tx.goldPurchaseLot.update({
        where: { id: lot.id },
        data: { deletedAt: now },
      });
    }

    await tx.goldHolding.update({
      where: { id: holding.id },
      data: { deletedAt: now, status: "deactive" },
    });
  });
}

export async function createSavingsDeposit(
  userId: string,
  workspaceId: string,
  rawInput: unknown,
) {
  const member = await requireActiveMember(userId, workspaceId);
  const input = createSavingsDepositSchema.parse(rawInput);
  const businessDate = getBusinessDateInTimeZone(member.workspace.timeZone);

  const principalAmount = new Decimal(input.principalAmount).toDecimalPlaces(0);
  const annualRate = new Decimal(input.annualInterestRate).toDecimalPlaces(4);
  const nonTermRate = new Decimal(
    input.nonTermInterestRate || "0.1",
  ).toDecimalPlaces(4);
  const maturityDate =
    input.maturityDate?.slice(0, 10) ||
    calculateSavingsMaturityDate(input.startDate, input.termMonths);

  if (maturityDate <= input.startDate) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Ngày đáo hạn phải sau ngày mở sổ tiết kiệm.",
    );
  }

  const metrics = calculateSavingsMetrics({
    currentPrincipalAmount: principalAmount,
    annualInterestRate: annualRate,
    nonTermInterestRate: nonTermRate,
    startDate: input.startDate,
    maturityDate,
    businessDate,
  });

  return prisma.$transaction(async (tx) => {
    let openTransactionId: string | null = null;
    if (input.fundingMode === "from_wallet") {
      if (!input.sourceWalletId) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Vui lòng chọn ví tài sản để trích tiền mở sổ tiết kiệm.",
        );
      }
      const wallet = await lockAndVerifyAssetWallet(
        tx,
        workspaceId,
        input.sourceWalletId,
      );
      const walletBalance = new Decimal(wallet.currentBalance.toString());
      if (walletBalance.lt(principalAmount)) {
        throw new AppError(
          "CONFLICT",
          `Số dư ví "${wallet.name}" không đủ để trích ${principalAmount.toNumber().toLocaleString("vi-VN")} ₫ mở sổ tiết kiệm.`,
        );
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { currentBalance: walletBalance.minus(principalAmount) },
      });

      const openTx = await tx.transaction.create({
        data: {
          memberId: member.id,
          walletId: wallet.id,
          type: "expense",
          purpose: "investment_contribution",
          workflowStatus: "approved",
          amount: principalAmount,
          jarCode: "INVESTMENT",
          description: `Mở sổ tiết kiệm ${input.bankName} (${input.termMonths} tháng): ${input.name}`,
          date: parseDateOnly(input.startDate),
          postedDate: parseDateOnly(input.startDate),
        },
      });
      openTransactionId = openTx.id;
    }

    const deposit = await tx.savingsDeposit.create({
      data: {
        workspaceId,
        createdByMemberId: member.id,
        name: input.name,
        bankName: input.bankName,
        accountOrPassbookNumber: input.accountOrPassbookNumber?.trim() || null,
        fundingMode: input.fundingMode,
        sourceWalletId:
          input.fundingMode === "from_wallet"
            ? (input.sourceWalletId ?? null)
            : null,
        openTransactionId,
        principalAmount,
        currentPrincipalAmount: principalAmount,
        annualInterestRate: annualRate,
        nonTermInterestRate: nonTermRate,
        termMonths: input.termMonths,
        startDate: parseDateOnly(input.startDate),
        maturityDate: parseDateOnly(maturityDate),
        interestPayoutMode: input.interestPayoutMode,
        maturityAction: input.maturityAction,
        expectedMaturityInterest: new Decimal(metrics.expectedMaturityInterest),
        note: input.note?.trim() || null,
      },
    });

    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "investment.savings_created",
        entityType: "SavingsDeposit",
        entityId: deposit.id,
        metadata: {
          name: deposit.name,
          bankName: deposit.bankName,
          principalAmount: principalAmount.toFixed(0),
        },
      },
    });

    return deposit;
  });
}

export async function settleSavingsDeposit(
  userId: string,
  workspaceId: string,
  rawInput: unknown,
) {
  const member = await requireActiveMember(userId, workspaceId);
  const input = settleSavingsDepositSchema.parse(rawInput);
  const businessDate = getBusinessDateInTimeZone(member.workspace.timeZone);

  return prisma.$transaction(async (tx) => {
    const deposit = await tx.savingsDeposit.findFirst({
      where: { id: input.depositId, workspaceId, deletedAt: null },
    });
    if (!deposit) {
      throw new AppError("NOT_FOUND", "Không tìm thấy sổ tiết kiệm.");
    }
    if (deposit.status !== "active") {
      throw new AppError("CONFLICT", "Sổ tiết kiệm này đã được tất toán trước đó.");
    }

    const currentPrincipal = new Decimal(
      deposit.currentPrincipalAmount.toString(),
    );
    const interestReceived = Decimal.max(
      new Decimal(input.interestReceivedAmount || "0").toDecimalPlaces(0),
      ZERO,
    );

    if (input.settlementType === "rollover") {
      const rolloverMode = input.rolloverMode ?? "renew_principal_and_interest";
      const newTermMonths = input.newTermMonths ?? deposit.termMonths;
      const newAnnualRate = input.newAnnualInterestRate
        ? new Decimal(input.newAnnualInterestRate).toDecimalPlaces(4)
        : new Decimal(deposit.annualInterestRate.toString());

      let ledgerTransactionId: string | null = null;
      if (rolloverMode === "renew_principal" && interestReceived.gt(0)) {
        if (!input.destinationWalletId) {
          throw new AppError(
            "VALIDATION_ERROR",
            "Vui lòng chọn ví tài sản để nhận tiền lãi khi tái tục gốc.",
          );
        }
        const wallet = await lockAndVerifyAssetWallet(
          tx,
          workspaceId,
          input.destinationWalletId,
        );
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            currentBalance: new Decimal(wallet.currentBalance.toString()).plus(
              interestReceived,
            ),
          },
        });
        const ledgerTx = await tx.transaction.create({
          data: {
            memberId: member.id,
            walletId: wallet.id,
            type: "income",
            purpose: "investment_settlement",
            workflowStatus: "approved",
            amount: interestReceived,
            jarCode: "INVESTMENT",
            description: `Nhận lãi tái tục sổ tiết kiệm ${deposit.bankName}: ${deposit.name}`,
            date: parseDateOnly(input.settlementDate),
            postedDate: parseDateOnly(input.settlementDate),
          },
        });
        ledgerTransactionId = ledgerTx.id;
      }

      const nextPrincipal =
        rolloverMode === "renew_principal_and_interest"
          ? currentPrincipal.plus(interestReceived)
          : currentPrincipal;
      const nextMaturityDate = calculateSavingsMaturityDate(
        input.settlementDate,
        newTermMonths,
      );
      const nextMetrics = calculateSavingsMetrics({
        currentPrincipalAmount: nextPrincipal,
        annualInterestRate: newAnnualRate,
        nonTermInterestRate: deposit.nonTermInterestRate.toString(),
        startDate: input.settlementDate,
        maturityDate: nextMaturityDate,
        businessDate,
      });

      const createdSettlement = await tx.savingsDepositSettlement.create({
        data: {
          workspaceId,
          depositId: deposit.id,
          createdByMemberId: member.id,
          destinationWalletId:
            rolloverMode === "renew_principal"
              ? (input.destinationWalletId ?? null)
              : null,
          ledgerTransactionId,
          settlementDate: parseDateOnly(input.settlementDate),
          settlementType: "rollover",
          principalWithdrawnAmount: ZERO,
          interestReceivedAmount: interestReceived,
          totalReceivedAmount:
            rolloverMode === "renew_principal" ? interestReceived : ZERO,
          note:
            input.note?.trim() ||
            `Tái tục kỳ hạn ${newTermMonths} tháng (${newAnnualRate.toFixed(2)}%/năm)`,
        },
      });

      const updatedRollover = await tx.savingsDeposit.update({
        where: { id: deposit.id },
        data: {
          currentPrincipalAmount: nextPrincipal,
          annualInterestRate: newAnnualRate,
          termMonths: newTermMonths,
          startDate: parseDateOnly(input.settlementDate),
          maturityDate: parseDateOnly(nextMaturityDate),
          expectedMaturityInterest: new Decimal(
            nextMetrics.expectedMaturityInterest,
          ),
          totalInterestReceived: { increment: interestReceived },
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "investment.savings_settled",
          entityType: "SavingsDeposit",
          entityId: deposit.id,
          metadata: {
            settlementId: createdSettlement.id,
            settlementType: "rollover",
            rolloverMode,
            interestReceived: interestReceived.toFixed(0),
            nextPrincipal: nextPrincipal.toFixed(0),
            previousPrincipal: currentPrincipal.toFixed(0),
            previousAnnualRate: new Decimal(
              deposit.annualInterestRate.toString(),
            ).toFixed(4),
            previousTermMonths: deposit.termMonths,
            previousStartDate: formatIsoDate(deposit.startDate),
            previousMaturityDate: formatIsoDate(deposit.maturityDate),
          },
        },
      });

      return updatedRollover;
    }

    if (!input.destinationWalletId) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Vui lòng chọn ví tài sản nhận tiền tất toán.",
      );
    }
    const destinationWallet = await lockAndVerifyAssetWallet(
      tx,
      workspaceId,
      input.destinationWalletId,
    );

    let principalWithdrawn = currentPrincipal;
    if (input.settlementType === "early_partial") {
      principalWithdrawn = new Decimal(
        input.principalWithdrawnAmount || "0",
      ).toDecimalPlaces(0);
      if (
        principalWithdrawn.lte(0) ||
        principalWithdrawn.gte(currentPrincipal)
      ) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Số tiền gốc rút một phần phải lớn hơn 0 và nhỏ hơn số tiền gốc hiện tại.",
        );
      }
    }

    const totalReceived = principalWithdrawn.plus(interestReceived);
    await tx.wallet.update({
      where: { id: destinationWallet.id },
      data: {
        currentBalance: new Decimal(
          destinationWallet.currentBalance.toString(),
        ).plus(totalReceived),
      },
    });

    const actionTitle =
      input.settlementType === "early_partial"
        ? `Rút gốc một phần sổ tiết kiệm ${deposit.bankName}`
        : input.settlementType === "early_full"
          ? `Tất toán trước hạn sổ tiết kiệm ${deposit.bankName}`
          : `Tất toán sổ tiết kiệm ${deposit.bankName}`;

    const ledgerTx = await tx.transaction.create({
      data: {
        memberId: member.id,
        walletId: destinationWallet.id,
        type: "income",
        purpose: "investment_settlement",
        workflowStatus: "approved",
        amount: totalReceived,
        jarCode: "INVESTMENT",
        description: `${actionTitle}: ${deposit.name}`,
        date: parseDateOnly(input.settlementDate),
        postedDate: parseDateOnly(input.settlementDate),
      },
    });

    const createdSettlement = await tx.savingsDepositSettlement.create({
      data: {
        workspaceId,
        depositId: deposit.id,
        createdByMemberId: member.id,
        destinationWalletId: destinationWallet.id,
        ledgerTransactionId: ledgerTx.id,
        settlementDate: parseDateOnly(input.settlementDate),
        settlementType: input.settlementType,
        principalWithdrawnAmount: principalWithdrawn,
        interestReceivedAmount: interestReceived,
        totalReceivedAmount: totalReceived,
        note: input.note?.trim() || null,
      },
    });

    const nextPrincipal = Decimal.max(
      currentPrincipal.minus(principalWithdrawn),
      ZERO,
    );
    const isFullySettled = nextPrincipal.isZero();

    const nextMetrics = isFullySettled
      ? null
      : calculateSavingsMetrics({
          currentPrincipalAmount: nextPrincipal,
          annualInterestRate: deposit.annualInterestRate.toString(),
          nonTermInterestRate: deposit.nonTermInterestRate.toString(),
          startDate: formatIsoDate(deposit.startDate),
          maturityDate: formatIsoDate(deposit.maturityDate),
          businessDate,
        });

    const updated = await tx.savingsDeposit.update({
      where: { id: deposit.id },
      data: {
        currentPrincipalAmount: nextPrincipal,
        ...(nextMetrics
          ? {
              expectedMaturityInterest: new Decimal(
                nextMetrics.expectedMaturityInterest,
              ),
            }
          : {}),
        totalInterestReceived: { increment: interestReceived },
        status: isFullySettled ? "settled" : "active",
        settledAt: isFullySettled ? new Date() : null,
      },
    });

    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "investment.savings_settled",
        entityType: "SavingsDeposit",
        entityId: deposit.id,
        metadata: {
          settlementId: createdSettlement.id,
          settlementType: input.settlementType,
          principalWithdrawn: principalWithdrawn.toFixed(0),
          interestReceived: interestReceived.toFixed(0),
        },
      },
    });

    return updated;
  });
}

export async function deleteSavingsSettlement(
  userId: string,
  workspaceId: string,
  settlementId: string,
) {
  const member = await requireActiveMember(userId, workspaceId);
  const businessDate = getBusinessDateInTimeZone(member.workspace.timeZone);

  return prisma.$transaction(async (tx) => {
    const settlement = await tx.savingsDepositSettlement.findFirst({
      where: { id: settlementId, workspaceId },
      include: {
        deposit: {
          include: {
            settlements: {
              orderBy: [{ createdAt: "desc" }, { settlementDate: "desc" }],
            },
          },
        },
      },
    });
    if (!settlement || settlement.deposit.deletedAt) {
      throw new AppError(
        "NOT_FOUND",
        "Không tìm thấy giao dịch tất toán / tái tục.",
      );
    }

    const latestSettlement = settlement.deposit.settlements[0];
    if (latestSettlement && latestSettlement.id !== settlement.id) {
      throw new AppError(
        "CONFLICT",
        "Vui lòng hoàn tác từ lần tất toán / tái tục gần nhất trước để bảo toàn tính toàn vẹn của sổ tiết kiệm.",
      );
    }

    const now = new Date();
    const totalReceived = new Decimal(settlement.totalReceivedAmount.toString());

    if (settlement.destinationWalletId && totalReceived.gt(0)) {
      const wallet = await tx.wallet.findFirst({
        where: {
          id: settlement.destinationWalletId,
          deletedAt: null,
          status: "active",
        },
      });
      if (!wallet || wallet.status !== "active") {
        throw new AppError(
          "CONFLICT",
          "Ví liên kết đã ngừng hoạt động hoặc bị xóa, không thể tự động hoàn/thu hồi số dư. Vui lòng kích hoạt lại ví trước.",
        );
      }
      await tx.$queryRaw`SELECT id FROM "WALLETS" WHERE id = ${wallet.id}::uuid FOR UPDATE`;
      const freshWallet =
        (await tx.wallet.findUnique?.({
          where: { id: wallet.id },
        })) ?? wallet;
      if (
        !freshWallet ||
        freshWallet.deletedAt ||
        freshWallet.status !== "active"
      ) {
        throw new AppError(
          "CONFLICT",
          "Ví liên kết đã ngừng hoạt động hoặc bị xóa, không thể tự động hoàn/thu hồi số dư. Vui lòng kích hoạt lại ví trước.",
        );
      }
      const walletBalance = new Decimal(
        freshWallet.currentBalance.toString(),
      );
      if (walletBalance.lt(totalReceived)) {
        throw new AppError(
          "CONFLICT",
          `Số dư ví "${freshWallet.name}" hiện không đủ (${walletBalance.toNumber().toLocaleString("vi-VN")} ₫) để thu hồi khoản tiền tất toán ${totalReceived.toNumber().toLocaleString("vi-VN")} ₫ khi hoàn tác.`,
        );
      }
      await tx.wallet.update({
        where: { id: freshWallet.id },
        data: { currentBalance: walletBalance.minus(totalReceived) },
      });
    }

    if (settlement.ledgerTransactionId) {
      await tx.transaction.updateMany({
        where: { id: settlement.ledgerTransactionId, deletedAt: null },
        data: { deletedAt: now },
      });
    }

    const deposit = settlement.deposit;
    const interestRev = new Decimal(settlement.interestReceivedAmount.toString());
    const principalWithdrawn = new Decimal(
      settlement.principalWithdrawnAmount.toString(),
    );

    let nextPrincipal = new Decimal(
      deposit.currentPrincipalAmount.toString(),
    ).plus(principalWithdrawn);
    let nextStartDate = formatIsoDate(deposit.startDate);
    let nextMaturityDate = formatIsoDate(deposit.maturityDate);
    let nextTermMonths = deposit.termMonths;
    let nextAnnualRate = new Decimal(deposit.annualInterestRate.toString());

    if (settlement.settlementType === "rollover") {
      const auditLogs = await tx.auditLog.findMany({
        where: {
          workspaceId,
          entityType: "SavingsDeposit",
          entityId: deposit.id,
          action: "investment.savings_settled",
        },
        orderBy: [{ createdAt: "desc" }],
        take: 10,
      });

      const matchingAudit =
        auditLogs.find((log) => {
          const meta = log.metadata as Record<string, unknown> | null;
          return meta?.settlementId === settlement.id;
        }) ??
        auditLogs.find((log) => {
          const meta = log.metadata as Record<string, unknown> | null;
          return (
            meta &&
            !meta.settlementId &&
            meta.settlementType === "rollover"
          );
        });
      const meta = (matchingAudit?.metadata ?? null) as Record<
        string,
        unknown
      > | null;

      if (meta && typeof meta.previousPrincipal === "string") {
        nextPrincipal = new Decimal(meta.previousPrincipal);
      } else if (totalReceived.isZero()) {
        // Tái tục cả gốc lẫn lãi -> trừ lại phần lãi đã nhập gốc
        nextPrincipal = Decimal.max(
          new Decimal(deposit.currentPrincipalAmount.toString()).minus(
            interestRev,
          ),
          ZERO,
        );
      }

      if (meta && typeof meta.previousAnnualRate === "string") {
        nextAnnualRate = new Decimal(meta.previousAnnualRate);
      }
      if (meta && typeof meta.previousTermMonths === "number") {
        nextTermMonths = meta.previousTermMonths;
      }
      if (
        meta &&
        typeof meta.previousStartDate === "string" &&
        typeof meta.previousMaturityDate === "string"
      ) {
        nextStartDate = meta.previousStartDate;
        nextMaturityDate = meta.previousMaturityDate;
      } else {
        const settleIso = formatIsoDate(settlement.settlementDate);
        nextMaturityDate = settleIso;
        const d = new Date(`${settleIso}T00:00:00.000Z`);
        d.setUTCMonth(d.getUTCMonth() - nextTermMonths);
        nextStartDate = d.toISOString().slice(0, 10);
      }
    }

    const nextTotalInterest = Decimal.max(
      new Decimal(deposit.totalInterestReceived.toString()).minus(interestRev),
      ZERO,
    );

    const nextMetrics = calculateSavingsMetrics({
      currentPrincipalAmount: nextPrincipal,
      annualInterestRate: nextAnnualRate,
      nonTermInterestRate: deposit.nonTermInterestRate.toString(),
      startDate: nextStartDate,
      maturityDate: nextMaturityDate,
      businessDate,
    });

    await tx.savingsDepositSettlement.delete({
      where: { id: settlement.id },
    });

    const updatedDeposit = await tx.savingsDeposit.update({
      where: { id: deposit.id },
      data: {
        currentPrincipalAmount: nextPrincipal,
        annualInterestRate: nextAnnualRate,
        termMonths: nextTermMonths,
        startDate: parseDateOnly(nextStartDate),
        maturityDate: parseDateOnly(nextMaturityDate),
        expectedMaturityInterest: new Decimal(
          nextMetrics.expectedMaturityInterest,
        ),
        totalInterestReceived: nextTotalInterest,
        status: "active",
        settledAt: null,
      },
    });

    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "investment.savings_settlement_reverted",
        entityType: "SavingsDeposit",
        entityId: deposit.id,
        metadata: {
          settlementId: settlement.id,
          settlementType: settlement.settlementType,
          restoredPrincipal: nextPrincipal.toFixed(0),
        },
      },
    });

    return updatedDeposit;
  });
}

export async function deleteSavingsDeposit(
  userId: string,
  workspaceId: string,
  depositId: string,
) {
  await requireActiveMember(userId, workspaceId);

  return prisma.$transaction(async (tx) => {
    const deposit = await tx.savingsDeposit.findFirst({
      where: { id: depositId, workspaceId, deletedAt: null },
      include: { settlements: true },
    });
    if (!deposit) {
      throw new AppError("NOT_FOUND", "Không tìm thấy sổ tiết kiệm.");
    }

    if (deposit.settlements.length > 0) {
      throw new AppError(
        "CONFLICT",
        "Sổ tiết kiệm này đã có lịch sử tất toán hoặc tái tục nên không thể xóa để bảo toàn đối soát sổ cái và lợi nhuận đã chốt.",
      );
    }

    const now = new Date();
    if (deposit.status === "active") {
      if (deposit.fundingMode === "from_wallet" && deposit.sourceWalletId) {
        const wallet = await tx.wallet.findFirst({
          where: {
            id: deposit.sourceWalletId,
            deletedAt: null,
            status: "active",
          },
        });
        if (!wallet || wallet.status !== "active") {
          throw new AppError(
            "CONFLICT",
            "Ví liên kết đã ngừng hoạt động hoặc bị xóa, không thể tự động hoàn/thu hồi số dư. Vui lòng kích hoạt lại ví trước.",
          );
        }
        await tx.$queryRaw`SELECT id FROM "WALLETS" WHERE id = ${wallet.id}::uuid FOR UPDATE`;
        const freshWallet =
          (await tx.wallet.findUnique?.({
            where: { id: wallet.id },
          })) ?? wallet;
        if (
          !freshWallet ||
          freshWallet.deletedAt ||
          freshWallet.status !== "active"
        ) {
          throw new AppError(
            "CONFLICT",
            "Ví liên kết đã ngừng hoạt động hoặc bị xóa, không thể tự động hoàn/thu hồi số dư. Vui lòng kích hoạt lại ví trước.",
          );
        }
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            currentBalance: new Decimal(
              freshWallet.currentBalance.toString(),
            ).plus(deposit.principalAmount.toString()),
          },
        });
        if (deposit.openTransactionId) {
          await tx.transaction.updateMany({
            where: { id: deposit.openTransactionId, deletedAt: null },
            data: { deletedAt: now },
          });
        }
      }
    }

    await tx.savingsDeposit.update({
      where: { id: deposit.id },
      data: { deletedAt: now, status: "cancelled" },
    });
  });
}

export { calculateEarlyWithdrawalInterest };
