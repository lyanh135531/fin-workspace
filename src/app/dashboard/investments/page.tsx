import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { InvestmentManagement } from "@/app/dashboard/investments/investment-management";
import { calculateLotMetrics } from "@/domain/investment/metrics";
import { isAdminRole } from "@/domain/role-policy";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { ensureInvestmentRoot } from "@/services/investment-category-service";
import {
  refreshInvestmentMarketPrices,
} from "@/services/investment-service";

export default async function InvestmentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) redirect("/overview");

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: session.user.id,
      workspaceId,
      status: "active",
      deletedAt: null,
      workspace: { status: "active", deletedAt: null },
    },
    include: { workspace: true, role: true },
  });
  if (!membership) redirect("/overview");

  await ensureInvestmentRoot(workspaceId);
  let marketRefresh: {
    priceAt: Date;
    usdVndRate: string;
    goldSellVndPerChi: string;
  } | null = null;
  let marketRefreshError: string | null = null;
  try {
    marketRefresh = await refreshInvestmentMarketPrices(
      session.user.id,
      workspaceId,
    );
  } catch (error) {
    marketRefreshError = error instanceof Error
      ? error.message
      : "Không thể lấy giá thị trường mới nhất.";
  }

  const [categories, assets, walletLinks, lots, snapshots, buyTrades] =
    await Promise.all([
      prisma.category.findMany({
        where: {
          workspaceId,
          type: "investment",
          deletedAt: null,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          code: true,
          parentId: true,
          systemKey: true,
          isProtected: true,
          status: true,
        },
      }),
      prisma.investmentAsset.findMany({
        where: { workspaceId, deletedAt: null },
        include: {
          prices: {
            orderBy: [{ priceAt: "desc" }, { fetchedAt: "desc" }],
            take: 1,
          },
        },
        orderBy: [{ status: "asc" }, { name: "asc" }],
      }),
      prisma.workspaceWallet.findMany({
        where: {
          workspaceId,
          wallet: { status: "active", deletedAt: null },
        },
        include: { wallet: true },
        orderBy: { wallet: { name: "asc" } },
      }),
      prisma.investmentLot.findMany({
        where: { workspaceId },
        include: {
          asset: true,
          purchaseTrade: true,
          allocation: {
            include: {
              sellTrade: {
                include: { wallet: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: [{ openedAt: "desc" }, { createdAt: "desc" }],
      }),
      prisma.investmentPortfolioSnapshot.findMany({
        where: { workspaceId },
        include: {
          items: true,
          eventTrade: {
            select: {
              id: true,
              assetId: true,
              side: true,
              executedUnitPrice: true,
            },
          },
        },
        orderBy: [{ date: "asc" }, { capturedAt: "asc" }],
      }),
      prisma.investmentTrade.findMany({
        where: {
          workspaceId,
          side: "buy",
          workflowStatus: "approved",
          deletedAt: null,
        },
        select: {
          id: true,
          assetId: true,
          date: true,
          executedUnitPrice: true,
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
    ]);

  const latestPriceByAsset = new Map(
    assets.map((asset) => [asset.id, asset.prices[0] ?? null]),
  );
  const lotRows = lots.map((lot) => {
    const latest = latestPriceByAsset.get(lot.assetId);
    const currentMarketPrice = lot.asset.type === "gold"
      ? latest?.askPrice ?? latest?.bidPrice
      : latest?.bidPrice;
    const metrics = calculateLotMetrics({
      remainingQuantity: lot.remainingQuantity.toString(),
      remainingCost: lot.remainingCost.toString(),
      currentMarketUnitPrice: currentMarketPrice?.toString(),
      purchaseAdjustmentRatio: lot.purchaseAdjustmentRatio.toString(),
      pricingMode: lot.asset.type === "gold"
        ? "gold_dynamic_spread"
        : lot.asset.autoPriceEnabled
          ? "proportional"
          : "manual",
    });
    const allocation = lot.allocation;

    return {
      id: lot.id,
      assetId: lot.assetId,
      categoryId: lot.asset.categoryId,
      assetCode: lot.asset.code,
      assetName: lot.asset.name,
      unit: lot.asset.unit,
      currency: lot.asset.quoteCurrency,
      status: lot.status,
      openedAt: lot.openedAt.toISOString(),
      closedAt: lot.closedAt?.toISOString() ?? null,
      originalQuantity: lot.originalQuantity.toString(),
      remainingQuantity: lot.remainingQuantity.toString(),
      purchaseUnitPrice: lot.purchaseTrade.executedUnitPrice.toString(),
      purchaseAdjustmentPercent: lot.purchaseAdjustmentPercent.toString(),
      appliesPurchaseAdjustment: lot.asset.autoPriceEnabled,
      originalCost: lot.originalCost.toString(),
      remainingCost: lot.remainingCost.toString(),
      adjustedUnitPrice: metrics.adjustedUnitPrice?.toString() ?? null,
      marketValue: metrics.marketValue?.toString() ?? null,
      unrealizedProfit: metrics.unrealizedProfit?.toString() ?? null,
      unrealizedReturnPercent:
        metrics.unrealizedReturnPercent?.toString() ?? null,
      soldQuantity: allocation?.quantity.toString() ?? "0",
      sellUnitPrice:
        allocation?.sellTrade.executedUnitPrice.toString() ?? null,
      soldAt: allocation?.sellTrade.date.toISOString() ?? null,
      grossProceeds: allocation?.grossProceeds.toString() ?? null,
      netProceeds: allocation?.netProceeds.toString() ?? null,
      realizedProfit: allocation?.realizedProfit.toString() ?? "0",
      destinationWallet: allocation?.sellTrade.wallet.name ?? null,
    };
  });
  return (
    <InvestmentManagement
      workspace={{
        name: membership.workspace.name,
        currency: membership.workspace.baseCurrency,
      }}
      businessDate={getBusinessDateInTimeZone(
        membership.workspace.timeZone,
      )}
      isAdmin={isAdminRole(membership.role.code)}
      market={{
        refreshedAt: marketRefresh?.priceAt.toISOString() ?? null,
        usdVndRate: marketRefresh?.usdVndRate ?? null,
        goldSellVndPerChi: marketRefresh?.goldSellVndPerChi ?? null,
        error: marketRefreshError,
      }}
      categories={categories}
      assets={assets.map((asset) => ({
        id: asset.id,
        categoryId: asset.categoryId,
        code: asset.code,
        name: asset.name,
        type: asset.type,
        unit: asset.unit,
        currency: asset.quoteCurrency,
        status: asset.status,
        autoPriceEnabled: asset.autoPriceEnabled,
        latestBidPrice: asset.prices[0]?.bidPrice.toString() ?? null,
        latestAskPrice: asset.prices[0]?.askPrice?.toString() ?? null,
        provider: asset.prices[0]?.provider ?? null,
        priceAt: asset.prices[0]?.priceAt.toISOString() ?? null,
        fetchedAt: asset.prices[0]?.fetchedAt.toISOString() ?? null,
      }))}
      wallets={walletLinks.map(({ wallet }) => ({
        id: wallet.id,
        name: wallet.name,
        balance: wallet.currentBalance.toString(),
      }))}
      lots={lotRows}
      chart={{
        snapshots: snapshots.map((snapshot) => ({
          id: snapshot.id,
          date: snapshot.date.toISOString(),
          tradeId: snapshot.eventTradeId,
          tradeAssetId: snapshot.eventTrade.assetId,
          tradeSide: snapshot.eventTrade.side,
          tradeUnitPrice: snapshot.eventTrade.executedUnitPrice.toString(),
          totalCost: snapshot.totalCost.toString(),
          marketValue: snapshot.marketValue.toString(),
          realizedProfit: snapshot.realizedProfit.toString(),
          items: snapshot.items.map((item) => ({
            assetId: item.assetId,
            quantity: item.quantity.toString(),
            cost: item.cost.toString(),
            marketUnitPrice: item.marketUnitPrice.toString(),
            marketValue: item.marketValue.toString(),
          })),
        })),
        buys: buyTrades.map((trade) => ({
          id: trade.id,
          assetId: trade.assetId,
          date: trade.date.toISOString(),
          unitPrice: trade.executedUnitPrice.toString(),
        })),
      }}
    />
  );
}
