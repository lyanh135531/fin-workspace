"use client";

import Decimal from "decimal.js";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChartNoAxesCombined,
  CircleDollarSign,
  Coins,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import {
  createInvestmentTradeAction,
  recordAssetPriceAction,
  refreshInvestmentMarketPricesAction,
  saveInvestmentLeafAction,
} from "@/app/dashboard/investments/actions";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DatePicker,
  Empty,
  Input,
  Label,
  MoneyInput,
  Select,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsCount,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/base";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatAmount } from "@/lib/format";

type Category = {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  systemKey: string | null;
  isProtected: boolean;
  status: "active" | "deactive";
};

type Asset = {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  type: "gold" | "currency" | "stock" | "crypto" | "fund" | "other";
  unit: string;
  currency: string;
  status: "active" | "deactive";
  autoPriceEnabled: boolean;
  latestBidPrice: string | null;
  latestAskPrice: string | null;
  provider: string | null;
  priceAt: string | null;
  fetchedAt: string | null;
};

type Wallet = { id: string; name: string; balance: string };

type Lot = {
  id: string;
  assetId: string;
  categoryId: string;
  assetCode: string;
  assetName: string;
  unit: string;
  currency: string;
  status: "open" | "partial" | "closed";
  openedAt: string;
  closedAt: string | null;
  originalQuantity: string;
  remainingQuantity: string;
  purchaseUnitPrice: string;
  purchaseAdjustmentPercent: string;
  appliesPurchaseAdjustment: boolean;
  originalCost: string;
  remainingCost: string;
  adjustedUnitPrice: string | null;
  marketValue: string | null;
  unrealizedProfit: string | null;
  unrealizedReturnPercent: string | null;
  soldQuantity: string;
  sellUnitPrice: string | null;
  soldAt: string | null;
  grossProceeds: string | null;
  netProceeds: string | null;
  realizedProfit: string;
  destinationWallet: string | null;
};

type ChartSnapshot = {
  id: string;
  date: string;
  tradeId: string;
  tradeAssetId: string;
  tradeSide: "buy" | "sell";
  tradeUnitPrice: string;
  totalCost: string;
  marketValue: string;
  realizedProfit: string;
  items: Array<{
    assetId: string;
    quantity: string;
    cost: string;
    marketUnitPrice: string;
    marketValue: string;
  }>;
};

const INVESTMENT_ROOT_SYSTEM_KEY = "INVESTMENT_ROOT";

const chartConfig = {
  cost: { label: "Giá vốn", color: "var(--primary)" },
  marketValue: { label: "Giá trị thị trường", color: "var(--success)" },
  purchasePrice: { label: "Giá giao dịch", color: "var(--warning)" },
} satisfies ChartConfig;

function money(value: Decimal.Value, currency = "VND") {
  return `${formatAmount(value, { maximumFractionDigits: 0 })} ${currency}`;
}

function dateLabel(value: string | null, includeTime = false) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function percent(value: string | null) {
  if (value == null) return "—";
  const amount = new Decimal(value);
  return `${amount.isPositive() ? "+" : ""}${formatAmount(amount, {
    maximumFractionDigits: 2,
  })}%`;
}

function ProfitValue({
  value,
  currency,
}: {
  value: string | null;
  currency: string;
}) {
  if (value == null) {
    return <span className="text-muted-foreground">Chưa có giá</span>;
  }
  const amount = new Decimal(value);
  return (
    <span
      className={
        amount.isNegative()
          ? "text-destructive"
          : amount.isPositive()
            ? "text-[var(--success)]"
            : ""
      }
    >
      {amount.isPositive() ? "+" : ""}
      {money(amount, currency)}
    </span>
  );
}

function categoryPath(categoryId: string, categories: Category[]) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const names: string[] = [];
  const visited = new Set<string>();
  let current = byId.get(categoryId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.systemKey !== INVESTMENT_ROOT_SYSTEM_KEY) {
      names.unshift(current.name);
    }
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return names.join(" / ");
}

function categoryDescendants(categoryId: string, categories: Category[]) {
  const result = new Set([categoryId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) {
      if (
        category.parentId
        && result.has(category.parentId)
        && !result.has(category.id)
      ) {
        result.add(category.id);
        changed = true;
      }
    }
  }
  return result;
}

export function InvestmentManagement({
  workspace,
  businessDate,
  isAdmin,
  market,
  categories,
  assets,
  wallets,
  lots,
  chart,
}: {
  workspace: { name: string; currency: string };
  businessDate: string;
  isAdmin: boolean;
  market: {
    refreshedAt: string | null;
    usdVndRate: string | null;
    goldSellVndPerChi: string | null;
    error: string | null;
  };
  categories: Category[];
  assets: Asset[];
  wallets: Wallet[];
  lots: Lot[];
  chart: {
    snapshots: ChartSnapshot[];
    buys: Array<{
      id: string;
      assetId: string;
      date: string;
      unitPrice: string;
    }>;
  };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "holding" | "sold">("overview");
  const [filterCategoryId, setFilterCategoryId] = useState("all");
  const [settingsSheet, setSettingsSheet] = useState(false);
  const [priceAsset, setPriceAsset] = useState<Asset | null>(null);
  const [tradeSheet, setTradeSheet] = useState<{
    side: "buy" | "sell";
    lot?: Lot;
  } | null>(null);
  const childCategoryIds = new Set(
    categories
      .map((category) => category.parentId)
      .filter((id): id is string => Boolean(id)),
  );
  const purchasableCategories = categories.filter((category) => {
    const linkedAsset = assets.find(
      (asset) => asset.categoryId === category.id,
    );
    return (
      category.status === "active"
      && !category.isProtected
      && !childCategoryIds.has(category.id)
      && linkedAsset?.status === "active"
    );
  });
  const [tradeCategoryId, setTradeCategoryId] = useState(
    purchasableCategories[0]?.id ?? "",
  );
  const [pending, startTransition] = useTransition();

  const root = categories.find(
    (category) => category.systemKey === INVESTMENT_ROOT_SYSTEM_KEY,
  );
  const filterCategories = categories.filter(
    (category) =>
      category.status === "active"
      && category.parentId === root?.id,
  );
  const selectedCategoryIds = useMemo(
    () =>
      filterCategoryId === "all"
        ? null
        : categoryDescendants(filterCategoryId, categories),
    [categories, filterCategoryId],
  );
  const filteredAssets = useMemo(
    () =>
      assets.filter(
        (asset) =>
          !selectedCategoryIds || selectedCategoryIds.has(asset.categoryId),
      ),
    [assets, selectedCategoryIds],
  );
  const filteredAssetIds = useMemo(
    () => new Set(filteredAssets.map((asset) => asset.id)),
    [filteredAssets],
  );
  const holdingLots = useMemo(
    () =>
      lots.filter(
        (lot) =>
          lot.status !== "closed" && filteredAssetIds.has(lot.assetId),
      ),
    [filteredAssetIds, lots],
  );
  const soldLots = useMemo(
    () =>
      lots.filter(
        (lot) =>
          lot.status === "closed" && filteredAssetIds.has(lot.assetId),
      ),
    [filteredAssetIds, lots],
  );
  const dynamicTotals = useMemo(
    () =>
      lots
        .filter((lot) => filteredAssetIds.has(lot.assetId))
        .reduce(
          (result, lot) => ({
            remainingCost: result.remainingCost.plus(lot.remainingCost),
            marketValue: result.marketValue.plus(lot.marketValue ?? 0),
            unrealizedProfit: result.unrealizedProfit.plus(
              lot.unrealizedProfit ?? 0,
            ),
            realizedProfit: result.realizedProfit.plus(lot.realizedProfit),
          }),
          {
            remainingCost: new Decimal(0),
            marketValue: new Decimal(0),
            unrealizedProfit: new Decimal(0),
            realizedProfit: new Decimal(0),
          },
        ),
    [filteredAssetIds, lots],
  );
  const unpricedHoldingCount = holdingLots.filter(
    (lot) => lot.adjustedUnitPrice == null,
  ).length;

  function submitInvestmentLeaf(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await saveInvestmentLeafAction({
        id: data.get("id") || undefined,
        parentId: data.get("parentId"),
        name: data.get("name"),
        code: data.get("code"),
        unit: data.get("unit"),
        status: data.get("status") || "active",
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã lưu hạng mục đầu tư.");
      setSettingsSheet(false);
      router.refresh();
    });
  }

  function submitPrice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!priceAsset) return;
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const priceDate = String(data.get("priceDate"));
      const result = await recordAssetPriceAction({
        assetId: priceAsset.id,
        bidPrice: data.get("bidPrice"),
        askPrice: data.get("askPrice") || data.get("bidPrice"),
        provider: "manual",
        priceAt: new Date(`${priceDate}T12:00:00`),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Đã lưu giá thị trường thủ công.");
      setPriceAsset(null);
      router.refresh();
    });
  }

  function submitTrade(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tradeSheet) return;
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createInvestmentTradeAction({
        assetId: tradeSheet.lot?.assetId,
        categoryId:
          tradeSheet.side === "buy" ? tradeCategoryId : undefined,
        walletId: data.get("walletId"),
        targetLotId: tradeSheet.lot?.id,
        side: tradeSheet.side,
        quantity:
          tradeSheet.lot?.remainingQuantity ?? data.get("quantity"),
        executedUnitPrice: data.get("unitPrice"),
        marketUnitPrice: data.get("marketUnitPrice") || undefined,
        description: data.get("description") || undefined,
        date: data.get("date"),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(
        tradeSheet.side === "buy"
          ? "Đã ghi nhận mua và tạo lô đầu tư."
          : "Đã bán lô và ghi nhận lợi nhuận.",
      );
      setTradeSheet(null);
      router.refresh();
    });
  }

  function refreshPrices() {
    startTransition(async () => {
      const result = await refreshInvestmentMarketPricesAction();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`Đã cập nhật giá cho ${result.count} tài sản.`);
      router.refresh();
    });
  }

  function openBuy() {
    setTradeCategoryId(purchasableCategories[0]?.id ?? "");
    setTradeSheet({ side: "buy" });
  }

  return (
    <main className="workspace-settings-container space-y-6">
      <header className="page-header">
        <div>
          <h1 className="page-title">Quản lý đầu tư</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Theo dõi từng lô theo giá mua thực tế, giá thị trường và dòng tiền
            đã ghi vào sổ giao dịch.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setSettingsSheet(true)}>
              <Settings2 /> Cài đặt hạng mục
            </Button>
          )}
          <Button variant="outline" disabled={pending} onClick={refreshPrices}>
            <RefreshCw className={pending ? "animate-spin" : ""} />
            Làm mới giá
          </Button>
          <Button
            disabled={!purchasableCategories.length || !wallets.length}
            onClick={openBuy}
          >
            <ArrowDownToLine /> Ghi nhận mua
          </Button>
        </div>
      </header>

      <MarketPriceSection
        market={market}
        assets={assets}
        isAdmin={isAdmin}
        onManualPrice={setPriceAsset}
      />

      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Tổng quan danh mục đầu tư"
      >
        <MetricCard
          label="Giá vốn đang nắm giữ"
          value={money(dynamicTotals.remainingCost, workspace.currency)}
          note={`${holdingLots.length} lô đang nắm giữ`}
          icon={<Coins />}
        />
        <MetricCard
          label="Giá trị thị trường"
          value={money(dynamicTotals.marketValue, workspace.currency)}
          note={
            unpricedHoldingCount
              ? `${unpricedHoldingCount} lô chưa có giá`
              : "Ước tính theo giá có thể bán ngay"
          }
          icon={<CircleDollarSign />}
        />
        <MetricCard
          label="Lãi/lỗ tạm tính"
          value={
            <ProfitValue
              value={dynamicTotals.unrealizedProfit.toString()}
              currency={workspace.currency}
            />
          }
          note="Chưa thực hiện"
          icon={
            dynamicTotals.unrealizedProfit.isNegative()
              ? <TrendingDown />
              : <TrendingUp />
          }
        />
        <MetricCard
          label="Lợi nhuận đã chốt"
          value={
            <ProfitValue
              value={dynamicTotals.realizedProfit.toString()}
              currency={workspace.currency}
            />
          }
          note={`${soldLots.length} lô đã bán`}
          icon={<ChartNoAxesCombined />}
        />
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={tab}
            onValueChange={(value) =>
              setTab(value as "overview" | "holding" | "sold")
            }
          >
            <TabsList>
              <TabsTrigger value="overview">Tổng quan</TabsTrigger>
              <TabsTrigger value="holding">
                Đang nắm giữ <TabsCount>{holdingLots.length}</TabsCount>
              </TabsTrigger>
              <TabsTrigger value="sold">
                Đã bán <TabsCount>{soldLots.length}</TabsCount>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Select
            value={filterCategoryId}
            onValueChange={setFilterCategoryId}
            label="Lọc danh mục"
            className="w-48"
            options={[
              { value: "all", label: "Tất cả tài sản" },
              ...filterCategories.map((category) => ({
                value: category.id,
                label: category.name,
              })),
            ]}
          />
        </div>

        {tab === "overview" && (
          <OverviewPanel
            snapshots={chart.snapshots}
            assets={filteredAssets}
            lots={holdingLots}
            selectedCategoryId={filterCategoryId}
            currency={workspace.currency}
          />
        )}
        {tab === "holding" && (
          <HoldingTable
            lots={holdingLots}
            onSell={(lot) => setTradeSheet({ side: "sell", lot })}
          />
        )}
        {tab === "sold" && <SoldTable lots={soldLots} />}
      </section>

      <InvestmentSettingsSheet
        open={settingsSheet}
        categories={categories}
        assets={assets}
        pending={pending}
        onOpenChange={setSettingsSheet}
        onSubmit={submitInvestmentLeaf}
      />
      <PriceSheet
        key={priceAsset?.id ?? "price-closed"}
        asset={priceAsset}
        businessDate={businessDate}
        pending={pending}
        onOpenChange={(open) => !open && setPriceAsset(null)}
        onSubmit={submitPrice}
      />
      <TradeSheet
        key={`${tradeSheet?.side ?? "closed"}-${tradeSheet?.lot?.id ?? tradeCategoryId}`}
        state={tradeSheet}
        assets={assets}
        categories={categories}
        purchasableCategories={purchasableCategories}
        categoryId={tradeCategoryId}
        wallets={wallets}
        businessDate={businessDate}
        isAdmin={isAdmin}
        pending={pending}
        onCategoryChange={setTradeCategoryId}
        onOpenChange={(open) => !open && setTradeSheet(null)}
        onSubmit={submitTrade}
      />
    </main>
  );
}

function MarketPriceSection({
  market,
  assets,
  isAdmin,
  onManualPrice,
}: {
  market: {
    refreshedAt: string | null;
    usdVndRate: string | null;
    goldSellVndPerChi: string | null;
    error: string | null;
  };
  assets: Asset[];
  isAdmin: boolean;
  onManualPrice: (asset: Asset) => void;
}) {
  const manualAssets = assets.filter((asset) => !asset.autoPriceEnabled);
  const additionalCurrencies = assets.filter(
    (asset) =>
      asset.autoPriceEnabled
      && asset.type === "currency"
      && asset.unit.toUpperCase() !== "USD",
  );
  return (
    <section aria-labelledby="market-price-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="market-price-heading" className="font-semibold">
            Giá thị trường
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Cập nhật {dateLabel(market.refreshedAt, true)}
          </p>
        </div>
        {market.error && (
          <p className="max-w-xl text-xs text-destructive">
            Không lấy được giá mới: {market.error}
          </p>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PriceCard
          label="Vàng thế giới"
          code="XAU/USD"
          singleLabel="Bán ra"
          singleValue={
            market.goldSellVndPerChi
              ? new Decimal(market.goldSellVndPerChi).times(10).toString()
              : null
          }
          unit="VND/lượng"
          note="API buy quy đổi từ USD/ounce"
        />
        <PriceCard
          label="Đô la Mỹ"
          code="USD/VND"
          bid={market.usdVndRate}
          ask={market.usdVndRate}
          unit="VND/USD"
          note="Tỷ giá tham chiếu Frankfurter"
        />
        {additionalCurrencies.map((asset) => (
          <PriceCard
            key={asset.id}
            label={asset.name}
            code={`${asset.unit.toUpperCase()}/VND`}
            bid={asset.latestBidPrice}
            ask={asset.latestAskPrice}
            unit={`VND/${asset.unit.toUpperCase()}`}
            note={
              asset.priceAt
                ? `Frankfurter · ${dateLabel(asset.priceAt)}`
                : "Chưa có tỷ giá thị trường"
            }
          />
        ))}
        {manualAssets.map((asset) => (
          <PriceCard
            key={asset.id}
            label={asset.name}
            code={asset.code}
            bid={asset.latestBidPrice}
            ask={asset.latestAskPrice}
            unit={`${asset.currency}/${asset.unit}`}
            note={
              asset.priceAt
                ? `Nhập tay · ${dateLabel(asset.priceAt)}`
                : "Chưa có giá thị trường"
            }
            action={
              isAdmin ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onManualPrice(asset)}
                >
                  Cập nhật
                </Button>
              ) : null
            }
          />
        ))}
      </div>
    </section>
  );
}

function PriceCard({
  label,
  code,
  bid,
  ask,
  unit,
  note,
  action,
  singleLabel,
  singleValue,
}: {
  label: string;
  code: string;
  bid?: string | null;
  ask?: string | null;
  unit: string;
  note: string;
  action?: React.ReactNode;
  singleLabel?: string;
  singleValue?: string | null;
}) {
  return (
    <Card as="article" size="sm">
      <CardHeader className="grid-cols-[1fr_auto]">
        <div>
          <CardTitle>{label}</CardTitle>
          <CardDescription>{code}</CardDescription>
        </div>
        {action}
      </CardHeader>
      <CardContent>
        {singleLabel ? (
          <dl>
            <div>
              <dt className="text-[11px] text-muted-foreground">
                {singleLabel}
              </dt>
              <dd className="mt-1 font-semibold tabular-nums">
                {singleValue
                  ? formatAmount(singleValue, { maximumFractionDigits: 0 })
                  : "—"}
              </dd>
            </div>
          </dl>
        ) : (
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-[11px] text-muted-foreground">Mua vào</dt>
              <dd className="mt-1 font-semibold tabular-nums">
                {bid ? formatAmount(bid, { maximumFractionDigits: 0 }) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Bán ra</dt>
              <dd className="mt-1 font-semibold tabular-nums">
                {ask ? formatAmount(ask, { maximumFractionDigits: 0 }) : "—"}
              </dd>
            </div>
          </dl>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          {unit} · {note}
        </p>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <Card as="article" className="gap-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs font-semibold text-muted-foreground">
            {label}
          </span>
          <strong className="mt-1 block truncate text-xl font-bold tabular-nums">
            {value}
          </strong>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {note}
          </span>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary [&_svg]:size-[18px]">
          {icon}
        </span>
      </div>
    </Card>
  );
}

function OverviewPanel({
  snapshots,
  assets,
  lots,
  selectedCategoryId,
  currency,
}: {
  snapshots: ChartSnapshot[];
  assets: Asset[];
  lots: Lot[];
  selectedCategoryId: string;
  currency: string;
}) {
  const assetIds = new Set(assets.map((asset) => asset.id));
  const data = snapshots.map((snapshot) => {
    const selectedItems = snapshot.items.filter((item) =>
      assetIds.has(item.assetId),
    );
    const cost = selectedItems.reduce(
      (sum, item) => sum.plus(item.cost),
      new Decimal(0),
    );
    const marketValue = selectedItems.reduce(
      (sum, item) => sum.plus(item.marketValue),
      new Decimal(0),
    );
    return {
      date: dateLabel(snapshot.date),
      cost: cost.toNumber(),
      marketValue: marketValue.toNumber(),
      purchasePrice:
        selectedCategoryId !== "all"
        && snapshot.tradeSide === "buy"
        && assetIds.has(snapshot.tradeAssetId)
          ? Number(snapshot.tradeUnitPrice)
          : null,
    };
  });

  if (!snapshots.length) {
    return (
      <Empty
        title="Chưa có dữ liệu tổng quan"
        description="Biểu đồ sẽ bắt đầu từ giao dịch mua đầu tiên."
      />
    );
  }

  const summaries = assets.map((asset) => {
    const assetLots = lots.filter((lot) => lot.assetId === asset.id);
    const cost = assetLots.reduce(
      (sum, lot) => sum.plus(lot.remainingCost),
      new Decimal(0),
    );
    const value = assetLots.reduce(
      (sum, lot) => sum.plus(lot.marketValue ?? 0),
      new Decimal(0),
    );
    const profit = value.minus(cost);
    return {
      asset,
      quantity: assetLots.reduce(
        (sum, lot) => sum.plus(lot.remainingQuantity),
        new Decimal(0),
      ),
      profit,
      returnPercent: cost.gt(0)
        ? profit.div(cost).times(100)
        : null,
    };
  }).filter((row) => row.quantity.gt(0));

  return (
    <div className="space-y-4">
      <Card as="section">
        <CardHeader>
          <CardTitle>Diễn biến danh mục</CardTitle>
          <CardDescription>
            Giá trị được chụp sau mỗi lần mua hoặc bán.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={chartConfig}
            className="h-[320px] w-full aspect-auto"
          >
            <LineChart data={data} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <YAxis
                yAxisId="value"
                tickLine={false}
                axisLine={false}
                width={76}
                tickFormatter={(value) =>
                  new Intl.NumberFormat("vi-VN", {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(value)
                }
              />
              {selectedCategoryId !== "all" && (
                <YAxis
                  yAxisId="price"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={76}
                  tickFormatter={(value) =>
                    new Intl.NumberFormat("vi-VN", {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    }).format(value)
                  }
                />
              )}
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex min-w-48 items-center justify-between gap-4">
                        <span className="text-muted-foreground">
                          {chartConfig[name as keyof typeof chartConfig]?.label}
                        </span>
                        <strong className="tabular-nums">
                          {money(String(value), currency)}
                        </strong>
                      </div>
                    )}
                  />
                }
              />
              <Line
                yAxisId="value"
                dataKey="cost"
                type="monotone"
                stroke="var(--color-cost)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="value"
                dataKey="marketValue"
                type="monotone"
                stroke="var(--color-marketValue)"
                strokeWidth={2}
                dot={false}
              />
              {selectedCategoryId !== "all" && (
                <Line
                  yAxisId="price"
                  dataKey="purchasePrice"
                  type="linear"
                  connectNulls
                  stroke="var(--color-purchasePrice)"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                />
              )}
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {summaries.length > 0 && (
        <Card className="gap-0 overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Tài sản</th>
                <th className="px-4 py-3 text-right font-semibold">
                  Số lượng
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  Lãi/lỗ tạm tính
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  Tỷ suất
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {summaries.map((row) => (
                <tr key={row.asset.id}>
                  <td className="px-4 py-3">
                    <strong>{row.asset.code}</strong>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.asset.name}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatAmount(row.quantity)} {row.asset.unit}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    <ProfitValue
                      value={row.profit.toString()}
                      currency={currency}
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {row.returnPercent
                      ? percent(row.returnPercent.toString())
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function HoldingTable({
  lots,
  onSell,
}: {
  lots: Lot[];
  onSell: (lot: Lot) => void;
}) {
  if (!lots.length) {
    return (
      <Empty
        title="Chưa có tài sản đang nắm giữ"
        description="Ghi nhận một giao dịch mua để bắt đầu theo dõi từng lô."
      />
    );
  }
  return (
    <Card className="gap-0 overflow-x-auto p-0">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Ngày mua / tài sản</th>
            <th className="px-4 py-3 text-right font-semibold">Giá mua</th>
            <th className="px-4 py-3 text-right font-semibold">Số lượng</th>
            <th className="px-4 py-3 text-right font-semibold">
              Giá bán hiện tại
            </th>
            <th className="px-4 py-3 text-right font-semibold">Lãi/lỗ</th>
            <th className="px-4 py-3 text-right font-semibold">%</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {lots.map((lot) => (
            <tr key={lot.id}>
              <td className="px-4 py-3">
                <strong>{lot.assetCode}</strong>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dateLabel(lot.openedAt)} · {lot.assetName}
                </p>
                {lot.appliesPurchaseAdjustment && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Chênh {percent(lot.purchaseAdjustmentPercent)} so với thị
                    trường lúc mua
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {money(lot.purchaseUnitPrice, lot.currency)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatAmount(lot.remainingQuantity)} {lot.unit}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {lot.adjustedUnitPrice
                  ? money(lot.adjustedUnitPrice, lot.currency)
                  : "—"}
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                <ProfitValue
                  value={lot.unrealizedProfit}
                  currency={lot.currency}
                />
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                {percent(lot.unrealizedReturnPercent)}
              </td>
              <td className="px-4 py-3 text-right">
                <Button size="sm" variant="outline" onClick={() => onSell(lot)}>
                  <ArrowUpFromLine /> Bán
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function SoldTable({ lots }: { lots: Lot[] }) {
  if (!lots.length) {
    return (
      <Empty
        title="Chưa có lịch sử bán"
        description="Lô đã chốt sẽ được lưu lại tại đây để phục vụ báo cáo."
      />
    );
  }
  return (
    <Card className="gap-0 overflow-x-auto p-0">
      <table className="w-full min-w-[1080px] text-left text-sm">
        <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Lô mua</th>
            <th className="px-4 py-3 font-semibold">Ngày bán</th>
            <th className="px-4 py-3 text-right font-semibold">Số lượng</th>
            <th className="px-4 py-3 text-right font-semibold">Giá mua</th>
            <th className="px-4 py-3 text-right font-semibold">Giá bán</th>
            <th className="px-4 py-3 text-right font-semibold">Thực nhận</th>
            <th className="px-4 py-3 text-right font-semibold">
              Lợi nhuận đã chốt
            </th>
            <th className="px-4 py-3 font-semibold">Ví nhận</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {lots.map((lot) => (
            <tr key={lot.id}>
              <td className="px-4 py-3">
                <strong>{lot.assetCode}</strong>
                <p className="mt-1 text-xs text-muted-foreground">
                  Mua {dateLabel(lot.openedAt)}
                </p>
              </td>
              <td className="px-4 py-3">{dateLabel(lot.soldAt)}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatAmount(lot.soldQuantity)} {lot.unit}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {money(lot.purchaseUnitPrice, lot.currency)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {lot.sellUnitPrice
                  ? money(lot.sellUnitPrice, lot.currency)
                  : "—"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {lot.netProceeds ? money(lot.netProceeds, lot.currency) : "—"}
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                <ProfitValue
                  value={lot.realizedProfit}
                  currency={lot.currency}
                />
              </td>
              <td className="px-4 py-3">
                {lot.destinationWallet ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function InvestmentSettingsSheet({
  open,
  categories,
  assets,
  pending,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  categories: Category[];
  assets: Asset[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const root = categories.find(
    (category) => category.systemKey === INVESTMENT_ROOT_SYSTEM_KEY,
  );
  const branches = categories.filter(
    (category) =>
      category.parentId === root?.id
      && category.status === "active"
      && category.systemKey?.startsWith("INVESTMENT_"),
  );
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [editingLeafId, setEditingLeafId] = useState<string | null>(null);
  const selectedBranch =
    branches.find((category) => category.id === branchId) ?? branches[0];
  const leaves = categories.filter(
    (category) => category.parentId === selectedBranch?.id,
  );
  const editingLeaf = leaves.find(
    (category) => category.id === editingLeafId,
  );
  const editingAsset = assets.find(
    (asset) => asset.categoryId === editingLeaf?.id,
  );
  const defaultUnit =
    selectedBranch?.systemKey === "INVESTMENT_GOLD"
      ? "chỉ"
      : selectedBranch?.systemKey === "INVESTMENT_MONEY"
        ? "USD"
        : "chứng chỉ quỹ";

  function selectBranch(value: string) {
    setBranchId(value);
    setEditingLeafId(null);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-xl p-5">
        <SheetHeader>
          <SheetTitle>Cài đặt hạng mục đầu tư</SheetTitle>
          <SheetDescription>
            Quản lý các tài sản lá và đơn vị dùng khi ghi nhận mua.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <Select
            value={selectedBranch?.id ?? ""}
            onValueChange={selectBranch}
            label="Nhóm đầu tư"
            options={branches.map((branch) => ({
              value: branch.id,
              label: branch.name,
            }))}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  Tài sản thuộc {selectedBranch?.name ?? "nhóm"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Chỉ các tài sản đang hoạt động mới xuất hiện khi mua.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEditingLeafId(null)}
              >
                <Plus className="size-4" />
                Thêm tài sản
              </Button>
            </div>

            {leaves.length ? (
              <div className="divide-y divide-border rounded-xl border border-border">
                {leaves.map((leaf) => {
                  const asset = assets.find(
                    (item) => item.categoryId === leaf.id,
                  );
                  return (
                    <div
                      key={leaf.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {leaf.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {leaf.code} · {asset?.unit ?? "Chưa cấu hình đơn vị"} ·{" "}
                          {leaf.status === "active"
                            ? "Đang hoạt động"
                            : "Ngừng hoạt động"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant={
                          editingLeafId === leaf.id ? "secondary" : "ghost"
                        }
                        aria-label={`Sửa ${leaf.name}`}
                        onClick={() => setEditingLeafId(leaf.id)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
                Chưa có tài sản nào trong nhóm này.
              </div>
            )}
          </div>

          {selectedBranch && (
            <form
              key={`${selectedBranch.id}-${editingLeaf?.id ?? "new"}`}
              className="space-y-4 rounded-xl bg-muted/35 p-4"
              onSubmit={onSubmit}
            >
              <div>
                <p className="text-sm font-semibold">
                  {editingLeaf ? `Sửa ${editingLeaf.name}` : "Thêm tài sản mới"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Đơn vị này sẽ tự động áp dụng cho số lượng và đơn giá giao
                  dịch.
                </p>
              </div>
              {editingLeaf && (
                <input type="hidden" name="id" value={editingLeaf.id} />
              )}
              <input
                type="hidden"
                name="parentId"
                value={selectedBranch.id}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Tên tài sản"
                  name="name"
                  required
                  defaultValue={editingLeaf?.name}
                  placeholder={
                    selectedBranch.systemKey === "INVESTMENT_GOLD"
                      ? "24K"
                      : selectedBranch.systemKey === "INVESTMENT_MONEY"
                        ? "USD"
                        : "Quỹ cổ phiếu"
                  }
                />
                <Input
                  label="Mã tài sản"
                  name="code"
                  required
                  defaultValue={editingLeaf?.code}
                  placeholder={
                    selectedBranch.systemKey === "INVESTMENT_GOLD"
                      ? "GOLD_24K"
                      : selectedBranch.systemKey === "INVESTMENT_MONEY"
                        ? "USD"
                        : "FUND_EQUITY"
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Input
                    label="Đơn vị"
                    name="unit"
                    required
                    defaultValue={editingAsset?.unit ?? defaultUnit}
                    placeholder={defaultUnit}
                  />
                  {selectedBranch.systemKey === "INVESTMENT_MONEY" && (
                    <p className="text-xs text-muted-foreground">
                      Nhập mã tiền tệ ISO gồm 3 ký tự, ví dụ USD hoặc CAD.
                    </p>
                  )}
                </div>
                <Select
                  name="status"
                  defaultValue={editingLeaf?.status ?? "active"}
                  label="Trạng thái"
                  options={[
                    { value: "active", label: "Đang hoạt động" },
                    { value: "deactive", label: "Ngừng hoạt động" },
                  ]}
                />
              </div>
              <SheetActions
                pending={pending}
                submitLabel={editingLeaf ? "Lưu thay đổi" : "Thêm tài sản"}
                onCancel={() =>
                  editingLeaf
                    ? setEditingLeafId(null)
                    : onOpenChange(false)
                }
              />
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PriceSheet({
  asset,
  businessDate,
  pending,
  onOpenChange,
  onSubmit,
}: {
  asset: Asset | null;
  businessDate: string;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [bidPrice, setBidPrice] = useState("");
  return (
    <Sheet open={Boolean(asset)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md p-5">
        <SheetHeader>
          <SheetTitle>Cập nhật giá {asset?.code}</SheetTitle>
          <SheetDescription>
            Nhập mức giá có thể bán ngay; snapshot có hiệu lực cho giao dịch
            mua trong 15 phút.
          </SheetDescription>
        </SheetHeader>
        {asset && (
          <form key={asset.id} className="mt-5 space-y-4" onSubmit={onSubmit}>
            <MoneyInput
              label={`Giá bán hiện tại / ${asset.unit}`}
              name="bidPrice"
              value={bidPrice}
              onValueChange={setBidPrice}
              required
            />
            <DatePicker
              label="Ngày áp dụng"
              name="priceDate"
              defaultValue={businessDate}
              required
            />
            <SheetActions
              pending={pending}
              submitLabel="Lưu giá"
              onCancel={() => onOpenChange(false)}
            />
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TradeSheet({
  state,
  assets,
  categories,
  purchasableCategories,
  categoryId,
  wallets,
  businessDate,
  isAdmin,
  pending,
  onCategoryChange,
  onOpenChange,
  onSubmit,
}: {
  state: { side: "buy" | "sell"; lot?: Lot } | null;
  assets: Asset[];
  categories: Category[];
  purchasableCategories: Category[];
  categoryId: string;
  wallets: Wallet[];
  businessDate: string;
  isAdmin: boolean;
  pending: boolean;
  onCategoryChange: (categoryId: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const selectedAsset = state?.lot
    ? assets.find((asset) => asset.id === state.lot?.assetId)
    : assets.find((asset) => asset.categoryId === categoryId);
  const [unitPrice, setUnitPrice] = useState("");
  const [marketUnitPrice, setMarketUnitPrice] = useState("");
  const unit = state?.lot?.unit ?? selectedAsset?.unit ?? "đơn vị";
  const usesAutomaticPrice = selectedAsset?.autoPriceEnabled ?? false;
  const referenceMarketPrice = marketUnitPrice
    || selectedAsset?.latestAskPrice;
  const adjustment = (() => {
    if (
      state?.side !== "buy"
      || !unitPrice
      || !referenceMarketPrice
    ) return null;
    return new Decimal(unitPrice)
      .div(referenceMarketPrice)
      .minus(1)
      .times(100);
  })();

  return (
    <Sheet open={Boolean(state)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md p-5">
        <SheetHeader>
          <SheetTitle>
            {state?.side === "sell" ? "Bán lô đầu tư" : "Ghi nhận mua"}
          </SheetTitle>
          <SheetDescription>
            {state?.side === "sell"
              ? "Giao dịch sẽ chốt toàn bộ số lượng còn lại của lô."
              : "Chọn danh mục; hệ thống tự xác định đơn vị và lấy giá thị trường khi ghi nhận."}
          </SheetDescription>
        </SheetHeader>
        {state && (
          <form
            key={`${state.side}-${state.lot?.id ?? categoryId}`}
            className="mt-5 space-y-4"
            onSubmit={onSubmit}
          >
            {state.lot ? (
              <Card size="sm">
                <CardContent>
                  <strong>{state.lot.assetCode}</strong>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mua {dateLabel(state.lot.openedAt)} · còn{" "}
                    {formatAmount(state.lot.remainingQuantity)}{" "}
                    {state.lot.unit}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Giá vốn {money(state.lot.remainingCost, state.lot.currency)}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Select
                  value={categoryId}
                  onValueChange={onCategoryChange}
                  label="Loại tài sản đầu tư"
                  options={purchasableCategories.map((category) => ({
                    value: category.id,
                    label: categoryPath(category.id, categories),
                  }))}
                />
              </>
            )}
            <Select
              name="walletId"
              defaultValue={wallets[0]?.id}
              label={
                state.side === "buy" ? "Ví thực hiện mua" : "Ví nhận tiền"
              }
              required
              options={wallets.map((wallet) => ({
                value: wallet.id,
                label: `${wallet.name} · ${money(wallet.balance)}`,
              }))}
            />
            {state.lot ? (
              <>
                <Input
                  label={`Số lượng bán (${state.lot.unit})`}
                  value={formatAmount(state.lot.remainingQuantity)}
                  disabled
                />
                <input
                  type="hidden"
                  name="quantity"
                  value={state.lot.remainingQuantity}
                />
              </>
            ) : (
              <Input
                label={`Số lượng (${unit})`}
                name="quantity"
                required
                inputMode="decimal"
                placeholder="0"
              />
            )}
            <MoneyInput
              label={`Giá ${state.side === "buy" ? "mua" : "bán"} thực tế / ${state.lot?.unit ?? unit}`}
              name="unitPrice"
              value={unitPrice}
              onValueChange={setUnitPrice}
              required
              placeholder="Nhập giá thực tế"
            />
            {state.side === "buy" && !usesAutomaticPrice && isAdmin && (
              <MoneyInput
                label={`Giá bán hiện tại / ${unit}`}
                name="marketUnitPrice"
                value={marketUnitPrice}
                onValueChange={setMarketUnitPrice}
                required
                placeholder="Nhập giá thị trường tham chiếu"
              />
            )}
            {state.side === "buy" && !usesAutomaticPrice && !isAdmin && (
              <p className="text-xs text-muted-foreground">
                Giao dịch dùng giá thị trường gần nhất do Admin cập nhật trong
                vòng 15 phút.
              </p>
            )}
            {usesAutomaticPrice && adjustment && (
              <p className="text-xs text-muted-foreground">
                Chênh lệch dự kiến so với giá thị trường:{" "}
                <strong>{percent(adjustment.toString())}</strong>
              </p>
            )}
            <DatePicker
              label="Ngày giao dịch"
              name="date"
              defaultValue={businessDate}
              required
            />
            <div className="grid gap-1">
              <Label>Ghi chú</Label>
              <Textarea
                name="description"
                rows={3}
                placeholder={
                  state.side === "buy"
                    ? "Nơi mua, số chứng từ..."
                    : "Nơi bán, số chứng từ..."
                }
              />
            </div>
            <SheetActions
              pending={pending}
              submitLabel={
                state.side === "buy" ? "Ghi nhận mua" : "Xác nhận bán"
              }
              onCancel={() => onOpenChange(false)}
            />
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SheetActions({
  pending,
  submitLabel,
  submitDisabled = false,
  onCancel,
}: {
  pending: boolean;
  submitLabel: string;
  submitDisabled?: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-border pt-4">
      <Button type="button" variant="outline" onClick={onCancel}>
        Hủy
      </Button>
      <Button type="submit" disabled={pending || submitDisabled}>
        {pending ? "Đang xử lý…" : submitLabel}
      </Button>
    </div>
  );
}
