"use client";

import Decimal from "decimal.js";
import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  Coins,
  History,
  Landmark,
  Layers,
  Plus,
  RefreshCw,
  Scale,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addGoldPurchaseLotAction,
  createGoldHoldingAction,
  createSavingsDepositAction,
  deleteGoldHoldingAction,
  deleteGoldPurchaseLotAction,
  deleteSavingsDepositAction,
  recordGoldSaleAction,
  refreshGoldMarketPricesAction,
  settleSavingsDepositAction,
  updateGoldHoldingSettingsAction,
} from "@/app/dashboard/investments/actions";
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  MoneyInput,
  Select,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  Tabs,
  TabsContent,
  TabsCount,
  TabsList,
  TabsTrigger,
} from "@/components/base";
import {
  allocateGoldSaleCostBasis,
  convertGoldPriceToPerChi,
  convertGoldWeightToChi,
  formatGoldWeightVi,
  GOLD_BRAND_QUOTES,
  GOLD_PRODUCT_TYPE_LABELS,
  type GoldWeightUnit,
} from "@/domain/investment/gold-calculator";
import {
  calculateEarlyWithdrawalInterest,
  calculateSavingsMaturityDate,
  calculateSavingsMetrics,
  POPULAR_VIETNAM_BANKS,
  SAVINGS_MATURITY_ACTION_LABELS,
  SAVINGS_PAYOUT_MODE_LABELS,
  SAVINGS_TERM_MONTH_OPTIONS,
} from "@/domain/investment/savings-calculator";
import { formatAmount as rawFormatAmount } from "@/lib/format";
import { usePrivacyMask } from "@/lib/privacy-mask";
import { cn } from "@/lib/utils";
import type { getWorkspaceInvestmentsOverview } from "@/services/investment-service";

type InvestmentsOverviewData = Awaited<
  ReturnType<typeof getWorkspaceInvestmentsOverview>
>;
type GoldHoldingItem = InvestmentsOverviewData["goldHoldings"][number];
type SavingsDepositItem = InvestmentsOverviewData["savingsDeposits"][number];

const ZERO = new Decimal(0);
const TEN = new Decimal(10);
const PRIMARY_TERM_MONTHS = [1, 3, 6, 9, 12, 24] as const;
const EXISTING_ASSET_VALUE = "__existing_asset__";

function formatAmount(value: Decimal.Value, currency = "VND"): string {
  const formatted = rawFormatAmount(value);
  return formatted === "••••••" ? formatted : `${formatted} ${currency}`;
}

function formatCompactQuoteMeta(
  providerCode: string,
  fallbackBrand: string,
): {
  brand: string;
  badge: string;
} {
  switch (providerCode) {
    case "SJL1L10":
      return { brand: "SJC", badge: "Vàng miếng" };
    case "SJ9999":
      return { brand: "SJC", badge: "Nhẫn 9999" };
    case "BT9999NTT":
      return { brand: "BTMC", badge: "Nhẫn 9999" };
    case "BTSJC":
      return { brand: "BTMC", badge: "Vàng miếng" };
    case "DOHNL":
      return { brand: "DOJI", badge: "Nhẫn 9999" };
    case "PQHNVM":
      return { brand: "Phú Quý", badge: "Nhẫn 9999" };
    case "PNJN":
      return { brand: "PNJ", badge: "Nhẫn 9999" };
    case "MIHONG999":
      return { brand: "Mi Hồng", badge: "Nhẫn 9999" };
    default:
      return { brand: fallbackBrand, badge: "9999" };
  }
}

function ResponsiveSheet({
  open,
  onOpenChange,
  size = "md",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size?: "default" | "md" | "lg" | "wide";
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size={size} spacing="flush" elevation="flat">
        {children}
      </SheetContent>
    </Sheet>
  );
}

function SheetBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain p-3.5 sm:p-5 space-y-3 sm:space-y-3.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Badge({
  variant = "default",
  className,
  children,
}: {
  variant?: "default" | "secondary" | "outline" | "warning" | "income";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium leading-tight whitespace-nowrap",
        variant === "default" &&
          "bg-[var(--primary-soft)] font-semibold text-[var(--primary)]",
        variant === "secondary" &&
          "bg-[var(--surface-secondary)] text-[var(--text-secondary)]",
        variant === "outline" &&
          "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]",
        variant === "warning" &&
          "bg-[color-mix(in_srgb,var(--warning)_14%,var(--surface))] font-semibold text-[var(--warning)]",
        variant === "income" &&
          "bg-[color-mix(in_srgb,var(--income)_12%,var(--surface))] font-semibold text-[var(--income)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

function buildFundingSourceOptions(
  wallets: InvestmentsOverviewData["wallets"],
  currency: string,
  existingLabel: string,
) {
  return [
    ...wallets.map((w) => ({
      value: w.id,
      label: `Ví ${w.name}`,
      selectedContent: (
        <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
          <Wallet className="size-3.5 shrink-0 text-[var(--text-muted)]" />
          <span>Ví: {w.name}</span>
        </span>
      ),
      content: (
        <div className="flex w-full items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-medium text-[var(--foreground)]">
            <Wallet className="size-3.5 shrink-0 text-[var(--text-muted)]" />
            <span>Ví: {w.name}</span>
          </span>
          <span className="shrink-0 text-xs text-[var(--text-muted)] tabular-nums">
            {formatAmount(w.currentBalance, currency)}
          </span>
        </div>
      ),
    })),
    {
      value: EXISTING_ASSET_VALUE,
      label: existingLabel,
      selectedContent: (
        <span className="font-medium text-[var(--foreground)] whitespace-nowrap">
          {existingLabel}
        </span>
      ),
      content: (
        <div className="flex w-full items-center justify-between gap-2">
          <span className="font-medium text-[var(--foreground)]">
            {existingLabel}
          </span>
          <span className="shrink-0 rounded-full bg-[var(--surface-secondary)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
            Không trừ ví
          </span>
        </div>
      ),
    },
  ];
}

const GOLD_PRODUCT_TYPE_OPTIONS = [
  {
    value: "sjc_bar",
    label: GOLD_PRODUCT_TYPE_LABELS.sjc_bar,
    selectedContent: "Vàng miếng SJC",
  },
  {
    value: "ring_9999",
    label: GOLD_PRODUCT_TYPE_LABELS.ring_9999,
    selectedContent: "Nhẫn tròn 9999",
  },
  {
    value: "jewelry_24k",
    label: GOLD_PRODUCT_TYPE_LABELS.jewelry_24k,
    selectedContent: "Trang sức 24K",
  },
  {
    value: "jewelry_18k",
    label: GOLD_PRODUCT_TYPE_LABELS.jewelry_18k,
    selectedContent: "Trang sức 18K",
  },
  {
    value: "other",
    label: GOLD_PRODUCT_TYPE_LABELS.other,
    selectedContent: "Vàng tích sản",
  },
];

const SAVINGS_PAYOUT_OPTIONS = [
  {
    value: "maturity",
    label: SAVINGS_PAYOUT_MODE_LABELS.maturity,
    selectedContent: "Lãi cuối kỳ",
  },
  {
    value: "monthly",
    label: SAVINGS_PAYOUT_MODE_LABELS.monthly,
    selectedContent: "Lãi hàng tháng",
  },
  {
    value: "upfront",
    label: SAVINGS_PAYOUT_MODE_LABELS.upfront,
    selectedContent: "Lãi đầu kỳ",
  },
];

const SAVINGS_MATURITY_OPTIONS = [
  {
    value: "settle_to_wallet",
    label: SAVINGS_MATURITY_ACTION_LABELS.settle_to_wallet,
    selectedContent: "Tất toán về ví",
  },
  {
    value: "renew_principal",
    label: SAVINGS_MATURITY_ACTION_LABELS.renew_principal,
    selectedContent: "Tái tục gốc",
  },
  {
    value: "renew_principal_and_interest",
    label: SAVINGS_MATURITY_ACTION_LABELS.renew_principal_and_interest,
    selectedContent: "Tái tục gốc + lãi",
  },
];

function formatShortViDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export function InvestmentsManager({
  data,
}: {
  data: InvestmentsOverviewData;
}) {
  const router = useRouter();
  usePrivacyMask();
  const [isPending, startTransition] = useTransition();
  const [isRefreshingQuotes, startRefreshTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"gold" | "savings">("gold");
  const [priceDisplayUnit, setPriceDisplayUnit] =
    useState<GoldWeightUnit>("chi");
  const [showAllBrandQuotes, setShowAllBrandQuotes] = useState(false);
  const [savingsFilter, setSavingsFilter] = useState<"active" | "settled">(
    "active",
  );

  // Sheet states
  const [createGoldOpen, setCreateGoldOpen] = useState(false);
  const [buyMoreHolding, setBuyMoreHolding] = useState<GoldHoldingItem | null>(
    null,
  );
  const [sellHolding, setSellHolding] = useState<GoldHoldingItem | null>(null);
  const [sellPreselectedLotId, setSellPreselectedLotId] = useState<
    string | null
  >(null);
  const [detailHoldingId, setDetailHoldingId] = useState<string | null>(null);
  const [settingsHolding, setSettingsHolding] =
    useState<GoldHoldingItem | null>(null);

  const [createSavingsOpen, setCreateSavingsOpen] = useState(false);
  const [settleDeposit, setSettleDeposit] = useState<SavingsDepositItem | null>(
    null,
  );
  const [detailDepositId, setDetailDepositId] = useState<string | null>(null);

  const detailHolding = useMemo(
    () => data.goldHoldings.find((h) => h.id === detailHoldingId) ?? null,
    [data.goldHoldings, detailHoldingId],
  );
  const detailDeposit = useMemo(
    () => data.savingsDeposits.find((d) => d.id === detailDepositId) ?? null,
    [data.savingsDeposits, detailDepositId],
  );

  const currency = data.workspace.currency;
  const displayMoney = (amount: string | number | Decimal) =>
    formatAmount(amount.toString(), currency);

  const formatSignedMoney = (amountStr: string) => {
    const d = new Decimal(amountStr || "0");
    if (d.isZero()) return displayMoney("0");
    const prefix = d.gt(0) ? "+" : "-";
    return `${prefix}${displayMoney(d.abs().toFixed(0))}`;
  };

  const formatGoldUnitPrice = (pricePerChiStr: string) => {
    const perChi = new Decimal(pricePerChiStr || "0");
    if (priceDisplayUnit === "luong") {
      return `${rawFormatAmount(perChi.mul(TEN).toFixed(0))} đ/lượng`;
    }
    return `${rawFormatAmount(perChi.toFixed(0))} đ/chỉ`;
  };

  function handleRefreshGoldQuotes() {
    startRefreshTransition(async () => {
      const res = await refreshGoldMarketPricesAction();
      if (!res.ok) {
        toast.error(res.error ?? "Không thể làm mới bảng giá vàng.");
        return;
      }
      toast.success(res.message ?? "Đã cập nhật bảng giá vàng mới nhất.");
      router.refresh();
    });
  }

  const activeSavings = useMemo(
    () => data.savingsDeposits.filter((d) => d.status === "active"),
    [data.savingsDeposits],
  );
  const settledSavings = useMemo(
    () => data.savingsDeposits.filter((d) => d.status === "settled"),
    [data.savingsDeposits],
  );
  const visibleSavings =
    savingsFilter === "active" ? activeSavings : settledSavings;

  const unrealizedPortfolioDecimal = new Decimal(
    data.summary.totalPortfolioUnrealizedGain,
  );
  const realizedPortfolioDecimal = new Decimal(
    data.summary.totalPortfolioRealizedGain,
  );
  const goldUnrealizedDecimal = new Decimal(
    data.summary.gold.totalUnrealizedProfit,
  );

  const primaryQuotes = showAllBrandQuotes
    ? data.quotes
    : data.quotes.slice(0, 4);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 1. UNIFIED HEADER + TOP SUMMARY STRIP */}
      <Card
        as="section"
        className="p-4 md:p-5"
        aria-label="Tổng quan sổ tiết kiệm và đầu tư"
      >
        {/* Top Row: Page Title + Subtitle + Primary Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border)] pb-3.5 md:pb-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-semibold text-[var(--foreground)] md:text-lg">
                Sổ tiết kiệm & Đầu tư
              </h1>
              {data.summary.savings.dueSoonCount > 0 && (
                <Badge variant="warning">
                  <CalendarClock className="size-3" />
                  {data.summary.savings.dueSoonCount} sổ sắp đáo hạn
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Theo dõi vàng tích sản, sổ tiết kiệm ngân hàng và lời/lỗ thực tế
              theo giá thị trường hôm nay.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveTab("gold");
                setCreateGoldOpen(true);
              }}
              className="flex-1 sm:flex-none md:h-9 md:px-3.5"
            >
              <Coins size={15} className="text-[var(--warning)]" />
              <span>Mua / Thêm Vàng</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setActiveTab("savings");
                setCreateSavingsOpen(true);
              }}
              className="flex-1 sm:flex-none md:h-9 md:px-3.5"
            >
              <Landmark size={15} />
              <span>Mở sổ tiết kiệm</span>
            </Button>
          </div>
        </div>

        {/* Bottom Symmetrical 2x2 (Mobile/Tablet) & 4-Column (Desktop) KPI Strip */}
        <div className="mt-3.5 grid grid-cols-2 gap-3.5 md:mt-4 xl:grid-cols-4 xl:gap-5 xl:divide-x xl:divide-[var(--border)]">
          {/* Metric 1: Tổng giá trị danh mục */}
          <div className="min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Tổng giá trị danh mục
              </span>
              <span
                className="hidden size-7 shrink-0 place-items-center rounded-lg bg-[var(--surface-secondary)] text-[var(--primary)] sm:grid"
                aria-hidden="true"
              >
                <Scale size={14} />
              </span>
            </div>
            <p className="text-base font-bold tracking-tight text-[var(--foreground)] tabular-nums sm:text-lg xl:text-2xl">
              {displayMoney(data.summary.totalPortfolioMarketValue)}
            </p>
            <p className="text-xs leading-snug text-[var(--text-muted)]">
              Tổng tiền gốc:{" "}
              <span className="font-semibold text-[var(--text-secondary)] tabular-nums">
                {displayMoney(data.summary.totalPortfolioCostBasis)}
              </span>
            </p>
          </div>

          {/* Metric 2: Vàng tích sản */}
          <div className="min-w-0 space-y-1 border-l border-[var(--border)] pl-3.5 xl:pl-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Vàng đang giữ
              </span>
              <span
                className="hidden size-7 shrink-0 place-items-center rounded-lg bg-[var(--surface-secondary)] text-[var(--warning)] sm:grid"
                aria-hidden="true"
              >
                <Coins size={14} />
              </span>
            </div>
            <p className="text-base font-bold tracking-tight text-[var(--foreground)] tabular-nums sm:text-lg xl:text-2xl">
              {displayMoney(data.summary.gold.totalMarketValue)}
            </p>
            <p className="text-xs leading-snug text-[var(--text-muted)]">
              Khối lượng:{" "}
              <span className="font-semibold text-[var(--text-secondary)]">
                {data.summary.gold.totalWeightFormatted.primary}
              </span>
            </p>
          </div>

          {/* Metric 3: Sổ tiết kiệm đang gửi */}
          <div className="min-w-0 space-y-1 border-t border-[var(--border)] pt-3 xl:border-t-0 xl:pt-0 xl:pl-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Sổ tiết kiệm đang gửi
              </span>
              <span
                className="hidden size-7 shrink-0 place-items-center rounded-lg bg-[var(--surface-secondary)] text-[var(--primary)] sm:grid"
                aria-hidden="true"
              >
                <Landmark size={14} />
              </span>
            </div>
            <p className="text-base font-bold tracking-tight text-[var(--foreground)] tabular-nums sm:text-lg xl:text-2xl">
              {displayMoney(data.summary.savings.totalPrincipal)}
            </p>
            <p className="text-xs leading-snug text-[var(--text-muted)]">
              Lãi tích lũy:{" "}
              <span className="font-semibold text-[var(--income)] tabular-nums">
                +{displayMoney(data.summary.savings.totalAccruedInterest)}
              </span>
            </p>
          </div>

          {/* Metric 4: Lãi/Lỗ & Chốt lời */}
          <div className="min-w-0 space-y-1 border-l border-t border-[var(--border)] pl-3.5 pt-3 xl:border-t-0 xl:pl-5 xl:pt-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Lời / Lỗ tạm tính
              </span>
              <span
                className="hidden size-7 shrink-0 place-items-center rounded-lg bg-[var(--surface-secondary)] text-[var(--income)] sm:grid"
                aria-hidden="true"
              >
                <TrendingUp size={14} />
              </span>
            </div>
            <p
              className={cn(
                "text-base font-bold tracking-tight tabular-nums sm:text-lg xl:text-2xl",
                unrealizedPortfolioDecimal.gt(0)
                  ? "text-[var(--income)]"
                  : unrealizedPortfolioDecimal.lt(0)
                    ? "text-[var(--expense)]"
                    : "text-[var(--foreground)]",
              )}
            >
              {formatSignedMoney(data.summary.totalPortfolioUnrealizedGain)}
            </p>
            <p className="text-xs leading-snug text-[var(--text-muted)]">
              Đã thu về ví:{" "}
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  realizedPortfolioDecimal.gt(0)
                    ? "text-[var(--income)]"
                    : realizedPortfolioDecimal.lt(0)
                      ? "text-[var(--expense)]"
                      : "text-[var(--text-secondary)]",
                )}
              >
                {formatSignedMoney(data.summary.totalPortfolioRealizedGain)}
              </span>
            </p>
          </div>
        </div>
      </Card>

      {/* 2. NAVIGATION TABS & CONTEXTUAL TOOLBAR */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "gold" | "savings")}
        className="w-full"
      >
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <TabsList
            variant="segmented"
            className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto"
          >
            <TabsTrigger variant="segmented" value="gold" className="px-3.5">
              <Coins className="size-3.5 text-[var(--warning)]" />
              <span>Đầu tư Vàng</span>
              <TabsCount>{data.goldHoldings.length}</TabsCount>
            </TabsTrigger>
            <TabsTrigger variant="segmented" value="savings" className="px-3.5">
              <Landmark className="size-3.5 text-[var(--primary)]" />
              <span>Sổ tiết kiệm</span>
              <TabsCount>{activeSavings.length}</TabsCount>
            </TabsTrigger>
          </TabsList>

          {activeTab === "gold" ? (
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <Tabs
                value={priceDisplayUnit}
                onValueChange={(val) =>
                  setPriceDisplayUnit(val as GoldWeightUnit)
                }
                className="w-auto"
              >
                <TabsList variant="segmented" className="w-auto">
                  <TabsTrigger
                    variant="segmented"
                    value="chi"
                    className="px-2.5 text-xs"
                  >
                    Theo Chỉ
                  </TabsTrigger>
                  <TabsTrigger
                    variant="segmented"
                    value="luong"
                    className="px-2.5 text-xs"
                  >
                    Theo Lượng
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRefreshingQuotes}
                onClick={handleRefreshGoldQuotes}
                className="h-9 gap-1.5 text-xs"
              >
                <RefreshCw
                  className={cn(
                    "size-3.5",
                    isRefreshingQuotes && "animate-spin",
                  )}
                />
                <span>Làm mới giá</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <Tabs
                value={savingsFilter}
                onValueChange={(val) =>
                  setSavingsFilter(val as "active" | "settled")
                }
                className="w-full sm:w-auto"
              >
                <TabsList
                  variant="segmented"
                  className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto"
                >
                  <TabsTrigger
                    variant="segmented"
                    value="active"
                    className="px-3 text-xs"
                  >
                    <span>Đang gửi</span>
                    <TabsCount>{activeSavings.length}</TabsCount>
                  </TabsTrigger>
                  <TabsTrigger
                    variant="segmented"
                    value="settled"
                    className="px-3 text-xs"
                  >
                    <span>Đã tất toán</span>
                    <TabsCount>{settledSavings.length}</TabsCount>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}
        </div>

        {/* ==================== TAB 1: ĐẦU TƯ VÀNG TÍCH SẢN ==================== */}
        <TabsContent value="gold" className="space-y-4">
          {/* UNIFORM GOLD MARKET TICKER STRIP */}
          <Card size="sm" className="p-3.5 md:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
                  <Sparkles className="size-3.5 text-[var(--warning)]" />
                  Bảng giá vàng hôm nay
                </span>
                <span className="hidden text-xs text-[var(--text-muted)] sm:inline">
                  · Tạm tính lời/lỗ theo{" "}
                  <strong className="font-medium text-[var(--text-secondary)]">
                    giá tiệm thu mua
                  </strong>{" "}
                  ({priceDisplayUnit === "luong" ? "VND / lượng" : "VND / chỉ"})
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowAllBrandQuotes((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline cursor-pointer"
              >
                <span>
                  {showAllBrandQuotes
                    ? "Thu gọn"
                    : `Xem tất cả (${data.quotes.length})`}
                </span>
                {showAllBrandQuotes ? (
                  <ChevronUp className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
              </button>
            </div>

            <div
              className={cn(
                "grid grid-cols-2 gap-2.5",
                showAllBrandQuotes ? "xl:grid-cols-5" : "xl:grid-cols-4",
              )}
            >
              {primaryQuotes.map((q) => {
                const buyVal =
                  priceDisplayUnit === "luong"
                    ? q.buyPricePerLuong
                    : q.buyPricePerChi;
                const sellVal =
                  priceDisplayUnit === "luong"
                    ? q.sellPricePerLuong
                    : q.sellPricePerChi;
                const meta = formatCompactQuoteMeta(
                  q.providerCode,
                  q.brandName,
                );

                return (
                  <div
                    key={q.providerCode}
                    className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/45 p-2.5 sm:p-3"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-bold text-[var(--foreground)] whitespace-nowrap">
                        {meta.brand}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5">
                        {meta.badge}
                      </Badge>
                    </div>

                    {/* Mobile (< sm): 2 clean horizontal lines so 8-9 digit prices never wrap inside a 2-col card */}
                    <div className="mt-2 space-y-1 border-t border-[var(--border)]/60 pt-2 sm:hidden">
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className="text-[var(--text-muted)]">Mua vào</span>
                        <strong className="font-bold text-[var(--income)] tabular-nums">
                          {rawFormatAmount(buyVal)}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className="text-[var(--text-muted)]">Bán ra</span>
                        <strong className="font-bold text-[var(--foreground)] tabular-nums">
                          {rawFormatAmount(sellVal)}
                        </strong>
                      </div>
                    </div>

                    {/* Tablet & Desktop (>= sm): Side-by-side 2-column quote layout */}
                    <div className="mt-2.5 hidden grid-cols-2 gap-2 border-t border-[var(--border)]/60 pt-2 sm:grid">
                      <div>
                        <span className="block text-[10px] text-[var(--text-muted)]">
                          Tiệm mua vào
                        </span>
                        <strong className="text-xs font-bold text-[var(--income)] tabular-nums md:text-sm">
                          {rawFormatAmount(buyVal)}
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] text-[var(--text-muted)]">
                          Tiệm bán ra
                        </span>
                        <strong className="text-xs font-bold text-[var(--foreground)] tabular-nums md:text-sm">
                          {rawFormatAmount(sellVal)}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* GOLD HOLDINGS PORTFOLIO */}
          {data.goldHoldings.length === 0 ? (
            <Card>
              <Empty
                icon={Coins}
                title="Chưa có khoản vàng nào đang giữ"
                description="Ghi lại vàng miếng SJC, nhẫn tròn trơn 9999 hoặc vàng mua tại tiệm quen để theo dõi giá mua trung bình và lời/lỗ nếu bán ra hôm nay."
                action={
                  <Button
                    type="button"
                    onClick={() => setCreateGoldOpen(true)}
                  >
                    <Plus className="size-4" />
                    <span>Thêm khoản vàng đầu tiên</span>
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-[var(--text-secondary)]">
                  Đang giữ:{" "}
                  <strong className="font-semibold text-[var(--foreground)]">
                    {data.summary.gold.totalWeightFormatted.fullText}
                  </strong>{" "}
                  · Lời/Lỗ tạm tính:{" "}
                  <strong
                    className={cn(
                      "font-semibold tabular-nums",
                      goldUnrealizedDecimal.gt(0)
                        ? "text-[var(--income)]"
                        : goldUnrealizedDecimal.lt(0)
                           ? "text-[var(--expense)]"
                          : "text-[var(--foreground)]",
                    )}
                  >
                    {formatSignedMoney(data.summary.gold.totalUnrealizedProfit)}
                  </strong>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateGoldOpen(true)}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Plus className="size-3.5" />
                  <span>Thêm loại vàng mới</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
                {data.goldHoldings.map((holding) => {
                  const qtyDecimal = new Decimal(
                    holding.valuation.totalQuantityChi,
                  );
                  const unrealizedDecimal = new Decimal(
                    holding.valuation.unrealizedProfitAmount,
                  );
                  const realizedDecimal = new Decimal(
                    holding.valuation.realizedProfitAmount,
                  );

                  return (
                    <Card
                      key={holding.id}
                      size="sm"
                      className="flex flex-col justify-between p-4 md:p-5"
                    >
                      <div className="space-y-3.5">
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="warning">
                                {holding.brandName}
                              </Badge>
                              <Badge variant="outline">
                                {holding.productTypeLabel}
                              </Badge>
                              {holding.priceSourceMode === "auto_brand" ? (
                                <Badge variant="default">
                                  <Sparkles className="size-2.5" />
                                  Giá tự động
                                </Badge>
                              ) : holding.priceSourceMode === "pegged_brand" ? (
                                <Badge variant="income">
                                  <RefreshCw className="size-2.5" />
                                  Theo giá chuẩn
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Tự nhập giá</Badge>
                              )}
                            </div>
                            <h3 className="text-base font-semibold text-[var(--foreground)] break-words">
                              {holding.name}
                            </h3>
                          </div>

                          <div className="shrink-0 text-right">
                            <span className="block text-[11px] text-[var(--text-muted)]">
                              Đang giữ
                            </span>
                            <strong className="text-sm font-bold text-[var(--foreground)] md:text-base">
                              {holding.weightFormatted.primary}
                            </strong>
                            {holding.weightFormatted.primary !==
                              holding.weightFormatted.chiText && (
                              <span className="block text-[11px] text-[var(--text-muted)] tabular-nums">
                                ({holding.weightFormatted.chiText})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Key Valuation Box */}
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/40 p-3.5 space-y-2.5">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="block text-[11px] text-[var(--text-muted)]">
                                Giá trị nếu bán hôm nay
                              </span>
                              <strong className="text-sm font-bold text-[var(--foreground)] tabular-nums md:text-base">
                                {displayMoney(
                                  holding.valuation.marketLiquidationValue,
                                )}
                              </strong>
                            </div>
                            <div className="text-right">
                              <span className="block text-[11px] text-[var(--text-muted)]">
                                Tổng tiền đã mua
                              </span>
                              <strong className="text-sm font-bold text-[var(--foreground)] tabular-nums md:text-base">
                                {displayMoney(
                                  holding.valuation.totalCostBasisAmount,
                                )}
                              </strong>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 border-t border-[var(--border)]/60 pt-2 text-xs">
                            <div>
                              <span className="block text-[11px] text-[var(--text-muted)]">
                                Giá mua trung bình
                              </span>
                              <strong className="font-semibold text-[var(--foreground)] tabular-nums">
                                {qtyDecimal.gt(0)
                                  ? formatGoldUnitPrice(
                                      holding.valuation.averageCostPerChi,
                                    )
                                  : "—"}
                              </strong>
                            </div>
                            <div className="text-right">
                              <span className="block text-[11px] text-[var(--text-muted)]">
                                Giá tiệm thu mua
                              </span>
                              <strong className="font-semibold text-[var(--income)] tabular-nums">
                                {formatGoldUnitPrice(
                                  holding.valuation.marketBuybackPricePerChi,
                                )}
                              </strong>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)]/60 pt-2 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-[var(--text-muted)]">
                                Lời / Lỗ tạm tính:
                              </span>
                              <strong
                                className={cn(
                                  "font-bold tabular-nums",
                                  unrealizedDecimal.gt(0)
                                    ? "text-[var(--income)]"
                                    : unrealizedDecimal.lt(0)
                                      ? "text-[var(--expense)]"
                                      : "text-[var(--foreground)]",
                                )}
                              >
                                {formatSignedMoney(
                                  holding.valuation.unrealizedProfitAmount,
                                )}{" "}
                                ({unrealizedDecimal.gt(0) ? "+" : ""}
                                {holding.valuation.unrealizedProfitPct}%)
                              </strong>
                            </div>

                            <div className="flex flex-wrap items-center gap-2.5">
                              {!realizedDecimal.isZero() && (
                                <span className="text-[11px] text-[var(--text-muted)]">
                                  Đã chốt:{" "}
                                  <strong
                                    className={cn(
                                      "font-semibold tabular-nums",
                                      realizedDecimal.gt(0)
                                        ? "text-[var(--income)]"
                                        : "text-[var(--expense)]",
                                    )}
                                  >
                                    {formatSignedMoney(
                                      holding.valuation.realizedProfitAmount,
                                    )}
                                  </strong>
                                </span>
                              )}
                              {holding.priceSourceMode !== "auto_brand" && (
                                <button
                                  type="button"
                                  onClick={() => setSettingsHolding(holding)}
                                  className="text-[11px] font-semibold text-[var(--primary)] hover:underline cursor-pointer"
                                >
                                  Cập nhật giá tiệm
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setBuyMoreHolding(holding)}
                            className="h-8 gap-1 text-xs"
                          >
                            <Plus className="size-3.5" />
                            <span>Mua thêm</span>
                          </Button>
                          {qtyDecimal.gt(0) && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSellPreselectedLotId(null);
                                setSellHolding(holding);
                              }}
                              className="h-8 gap-1 text-xs"
                            >
                              <ArrowUpRight className="size-3.5 text-[var(--income)]" />
                              <span>Bán vàng</span>
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setSettingsHolding(holding)}
                            className="size-8 text-[var(--text-secondary)]"
                            title="Cài đặt giá & thông tin"
                            aria-label="Cài đặt giá & thông tin"
                          >
                            <Settings2 className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailHoldingId(holding.id)}
                            className="h-8 gap-1 px-2.5 text-xs font-semibold text-[var(--primary)]"
                          >
                            <Layers className="size-3.5" />
                            <span>Lịch sử ({holding.lots.length})</span>
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ==================== TAB 2: SỔ TIẾT KIỆM NGÂN HÀNG ==================== */}
        <TabsContent value="savings" className="space-y-4">
          {visibleSavings.length === 0 ? (
            <Card>
              <Empty
                icon={Landmark}
                title={
                  savingsFilter === "active"
                    ? "Chưa có sổ tiết kiệm đang gửi"
                    : "Chưa có sổ tiết kiệm đã tất toán"
                }
                description="Theo dõi tiền gửi có kỳ hạn tại ngân hàng, tự động tính lãi tích lũy từng ngày theo chuẩn 365 ngày/năm, cảnh báo đáo hạn và hỗ trợ rút gốc một phần hoặc tái tục."
                action={
                  savingsFilter === "active" ? (
                    <Button
                      type="button"
                      onClick={() => setCreateSavingsOpen(true)}
                    >
                      <Plus className="size-4" />
                      <span>Mở sổ tiết kiệm đầu tiên</span>
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              {visibleSavings.map((deposit) => {
                const isActive = deposit.status === "active";
                return (
                  <Card
                    key={deposit.id}
                    size="sm"
                    className="flex flex-col justify-between p-4 md:p-5"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="default">
                              <Building2 className="size-3" />
                              {deposit.bankName}
                            </Badge>
                            <Badge variant="outline">
                              {deposit.termMonths} tháng ·{" "}
                              {deposit.annualInterestRate}%/năm
                            </Badge>
                            {isActive && deposit.metrics.isMatured && (
                              <Badge variant="income">Đã đến hạn</Badge>
                            )}
                            {isActive && deposit.metrics.isDueSoon && (
                              <Badge variant="warning">
                                Còn {deposit.metrics.remainingDays} ngày
                              </Badge>
                            )}
                          </div>
                          <h3 className="text-base font-semibold text-[var(--foreground)] break-words">
                            {deposit.name}
                          </h3>
                          {deposit.accountOrPassbookNumber && (
                            <p className="text-[11px] text-[var(--text-muted)]">
                              Mã sổ / TK: {deposit.accountOrPassbookNumber}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="block text-[11px] text-[var(--text-muted)]">
                            {isActive ? "Gốc đang gửi" : "Gốc ban đầu"}
                          </span>
                          <strong className="text-sm font-bold text-[var(--foreground)] tabular-nums md:text-base">
                            {displayMoney(
                              isActive
                                ? deposit.currentPrincipalAmount
                                : deposit.principalAmount,
                            )}
                          </strong>
                        </div>
                      </div>

                      {/* Term Progress Bar */}
                      {isActive && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                            <span>
                              Gửi {formatShortViDate(deposit.startDate)}
                            </span>
                            <span className="font-semibold text-[var(--foreground)] tabular-nums">
                              {deposit.metrics.elapsedDays}/
                              {deposit.metrics.totalDays} ngày (
                              {deposit.metrics.progressPct}%)
                            </span>
                            <span>
                              Đáo hạn {formatShortViDate(deposit.maturityDate)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                            <div
                              className="h-full rounded-full bg-[var(--primary)] transition-all"
                              style={{
                                width: `${deposit.metrics.progressPct}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Metrics Box */}
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/40 p-3.5 space-y-2.5">
                        {isActive ? (
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <span className="block text-[11px] text-[var(--text-muted)]">
                                  Lãi tích lũy hôm nay
                                </span>
                                <strong className="text-sm font-bold text-[var(--income)] tabular-nums">
                                  +
                                  {displayMoney(
                                    deposit.metrics.accruedTermInterestToDate,
                                  )}
                                </strong>
                              </div>
                              <div className="text-right">
                                <span className="block text-[11px] text-[var(--text-muted)]">
                                  Lãi dự kiến cuối kỳ
                                </span>
                                <strong className="text-sm font-bold text-[var(--foreground)] tabular-nums">
                                  +
                                  {displayMoney(
                                    deposit.metrics.expectedMaturityInterest,
                                  )}
                                </strong>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 border-t border-[var(--border)]/60 pt-2 text-xs">
                              <div>
                                <span className="block text-[11px] text-[var(--text-muted)]">
                                  Hình thức trả lãi
                                </span>
                                <strong className="font-semibold text-[var(--foreground)]">
                                  {deposit.interestPayoutModeLabel}
                                </strong>
                              </div>
                              <div className="text-right">
                                <span className="block text-[11px] text-[var(--text-muted)]">
                                  Tổng gốc + lãi đáo hạn
                                </span>
                                <strong className="font-bold text-[var(--primary)] tabular-nums">
                                  {displayMoney(
                                    deposit.metrics.expectedTotalAtMaturity,
                                  )}
                                </strong>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="block text-[11px] text-[var(--text-muted)]">
                                Tổng lãi thực nhận
                              </span>
                              <strong className="text-sm font-bold text-[var(--income)] tabular-nums">
                                +{displayMoney(deposit.totalInterestReceived)}
                              </strong>
                            </div>
                            <div className="text-right">
                              <span className="block text-[11px] text-[var(--text-muted)]">
                                Kỳ hạn gửi
                              </span>
                              <strong className="font-semibold text-[var(--foreground)]">
                                {formatShortViDate(deposit.startDate)} →{" "}
                                {formatShortViDate(deposit.maturityDate)}
                              </strong>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
                      {isActive ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setSettleDeposit(deposit)}
                          className="h-8 gap-1.5 text-xs"
                        >
                          <Check className="size-3.5" />
                          <span>Tất toán / Rút · Tái tục</span>
                        </Button>
                      ) : (
                        <Badge variant="secondary">Đã tất toán</Badge>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailDepositId(deposit.id)}
                        className="h-8 gap-1 px-2.5 text-xs font-semibold text-[var(--primary)]"
                      >
                        <History className="size-3.5" />
                        <span>Chi tiết ({deposit.settlements.length})</span>
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ==================== SHEET 1: TẠO VỊ THẾ VÀNG & MUA LÔ ĐẦU TIÊN ==================== */}
      {createGoldOpen && (
        <CreateGoldHoldingSheet
          open={createGoldOpen}
          onOpenChange={setCreateGoldOpen}
          wallets={data.wallets}
          quotes={data.quotes}
          businessDate={data.workspace.businessDate}
          currency={currency}
          isPending={isPending}
          startTransition={startTransition}
          onSuccess={() => {
            setCreateGoldOpen(false);
            router.refresh();
          }}
        />
      )}

      {/* ==================== SHEET 2: MUA THÊM VÀNG TÍCH LŨY (DCA) ==================== */}
      {buyMoreHolding && (
        <AddGoldLotSheet
          open={Boolean(buyMoreHolding)}
          onOpenChange={(open) => !open && setBuyMoreHolding(null)}
          holding={buyMoreHolding}
          wallets={data.wallets}
          businessDate={data.workspace.businessDate}
          currency={currency}
          isPending={isPending}
          startTransition={startTransition}
          onSuccess={() => {
            setBuyMoreHolding(null);
            router.refresh();
          }}
        />
      )}

      {/* ==================== SHEET 3: BÁN VÀNG (MỘT PHẦN / TOÀN BỘ) ==================== */}
      {sellHolding && (
        <SellGoldSheet
          open={Boolean(sellHolding)}
          onOpenChange={(open) => {
            if (!open) {
              setSellHolding(null);
              setSellPreselectedLotId(null);
            }
          }}
          holding={sellHolding}
          preselectedLotId={sellPreselectedLotId}
          wallets={data.wallets}
          businessDate={data.workspace.businessDate}
          currency={currency}
          isPending={isPending}
          startTransition={startTransition}
          onSuccess={() => {
            setSellHolding(null);
            setSellPreselectedLotId(null);
            router.refresh();
          }}
        />
      )}

      {/* ==================== SHEET 4: CHI TIẾT CÁC LÔ MUA & LỊCH SỬ BÁN VÀNG ==================== */}
      {detailHolding && (
        <GoldHoldingDetailSheet
          open={Boolean(detailHolding)}
          onOpenChange={(open) => !open && setDetailHoldingId(null)}
          holding={detailHolding}
          currency={currency}
          isPending={isPending}
          startTransition={startTransition}
          onBuyMore={() => {
            setDetailHoldingId(null);
            setBuyMoreHolding(detailHolding);
          }}
          onSellLot={(lotId) => {
            setDetailHoldingId(null);
            setSellPreselectedLotId(lotId);
            setSellHolding(detailHolding);
          }}
          onRefresh={() => router.refresh()}
        />
      )}

      {/* ==================== SHEET 5: CÀI ĐẶT NGUỒN GIÁ & THÔNG TIN VỊ THẾ VÀNG ==================== */}
      {settingsHolding && (
        <GoldHoldingSettingsSheet
          open={Boolean(settingsHolding)}
          onOpenChange={(open) => !open && setSettingsHolding(null)}
          holding={settingsHolding}
          quotes={data.quotes}
          isPending={isPending}
          startTransition={startTransition}
          onSuccess={() => {
            setSettingsHolding(null);
            router.refresh();
          }}
        />
      )}

      {/* ==================== SHEET 6: MỞ SỔ TIẾT KIỆM NGÂN HÀNG ==================== */}
      {createSavingsOpen && (
        <CreateSavingsDepositSheet
          open={createSavingsOpen}
          onOpenChange={setCreateSavingsOpen}
          wallets={data.wallets}
          businessDate={data.workspace.businessDate}
          currency={currency}
          isPending={isPending}
          startTransition={startTransition}
          onSuccess={() => {
            setCreateSavingsOpen(false);
            router.refresh();
          }}
        />
      )}

      {/* ==================== SHEET 7: TẤT TOÁN / RÚT GỐC MỘT PHẦN / TÁI TỤC SỔ TIẾT KIỆM ==================== */}
      {settleDeposit && (
        <SettleSavingsDepositSheet
          open={Boolean(settleDeposit)}
          onOpenChange={(open) => !open && setSettleDeposit(null)}
          deposit={settleDeposit}
          wallets={data.wallets}
          businessDate={data.workspace.businessDate}
          currency={currency}
          isPending={isPending}
          startTransition={startTransition}
          onSuccess={() => {
            setSettleDeposit(null);
            router.refresh();
          }}
        />
      )}

      {/* ==================== SHEET 8: CHI TIẾT & LỊCH SỬ SỔ TIẾT KIỆM ==================== */}
      {detailDeposit && (
        <SavingsDepositDetailSheet
          open={Boolean(detailDeposit)}
          onOpenChange={(open) => !open && setDetailDepositId(null)}
          deposit={detailDeposit}
          currency={currency}
          isPending={isPending}
          startTransition={startTransition}
          onSettle={() => {
            setDetailDepositId(null);
            setSettleDeposit(detailDeposit);
          }}
          onDeleted={() => {
            setDetailDepositId(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/* ============================================================================
 * SUB-COMPONENTS FOR GOLD & SAVINGS SHEETS
 * ========================================================================== */

function CreateGoldHoldingSheet({
  open,
  onOpenChange,
  wallets,
  quotes,
  businessDate,
  currency,
  isPending,
  startTransition,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: InvestmentsOverviewData["wallets"];
  quotes: InvestmentsOverviewData["quotes"];
  businessDate: string;
  currency: string;
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
  onSuccess: () => void;
}) {
  const [priceSourceMode, setPriceSourceMode] = useState<
    "auto_brand" | "pegged_brand" | "manual"
  >("auto_brand");
  const [quoteProviderCode, setQuoteProviderCode] = useState("BT9999NTT");
  const [brandName, setBrandName] = useState("Bảo Tín Minh Châu");
  const [productType, setProductType] = useState<
    "sjc_bar" | "ring_9999" | "jewelry_24k" | "jewelry_18k" | "other"
  >("ring_9999");
  const [localShopSpreadPerChi, setLocalShopSpreadPerChi] = useState("150000");
  const [manualBuybackPrice, setManualBuybackPrice] = useState("13860000");
  const [manualSellPrice, setManualSellPrice] = useState("14260000");
  const [storageLocation, setStorageLocation] = useState("");
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);

  // Đợt mua đầu tiên
  const [weightUnit, setWeightUnit] = useState<GoldWeightUnit>("chi");
  const [quantityInput, setQuantityInput] = useState("1");
  const [unitPriceInput, setUnitPriceInput] = useState(() => {
    const btQuote = quotes.find((q) => q.providerCode === "BT9999NTT");
    return btQuote?.sellPricePerChi ?? "14260000";
  });
  const [craftingFee, setCraftingFee] = useState("0");
  const [fundingSelection, setFundingSelection] = useState<string>(
    wallets[0]?.id ?? EXISTING_ASSET_VALUE,
  );
  const [purchaseDate, setPurchaseDate] = useState(businessDate);
  const [invoiceOrSerial, setInvoiceOrSerial] = useState("");

  const fundingMode =
    fundingSelection === EXISTING_ASSET_VALUE
      ? "existing_asset"
      : "from_wallet";
  const sourceWalletId =
    fundingSelection === EXISTING_ASSET_VALUE ? null : fundingSelection;

  const handleSelectMode = (
    nextMode: "auto_brand" | "pegged_brand" | "manual",
  ) => {
    setPriceSourceMode(nextMode);
    if (nextMode === "auto_brand") {
      handleSelectAutoBrand(quoteProviderCode || "SJ9999");
    } else if (nextMode === "pegged_brand") {
      const refCode = "SJ9999";
      setQuoteProviderCode(refCode);
      const sjcQuote = quotes.find((q) => q.providerCode === refCode);
      if (sjcQuote) {
        const ratio =
          productType === "jewelry_18k" ? new Decimal("0.75") : new Decimal(1);
        const suggestedPerChi = new Decimal(sjcQuote.sellPricePerChi)
          .mul(ratio)
          .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
        setUnitPriceInput(
          weightUnit === "luong"
            ? suggestedPerChi.mul(TEN).toFixed(0)
            : suggestedPerChi.toFixed(0),
        );
      }
      if (
        brandName === "Bảo Tín Minh Châu" ||
        brandName === "SJC" ||
        brandName === "DOJI"
      ) {
        setBrandName("");
      }
    }
  };

  const handleSelectAutoBrand = (code: string) => {
    setQuoteProviderCode(code);
    const matched = quotes.find((q) => q.providerCode === code);
    if (matched) {
      setBrandName(matched.brandName);
      setProductType(matched.productType);
      setUnitPriceInput(
        weightUnit === "luong"
          ? matched.sellPricePerLuong
          : matched.sellPricePerChi,
      );
    }
  };

  const handleChangeLocalProductType = (
    nextType: "sjc_bar" | "ring_9999" | "jewelry_24k" | "jewelry_18k" | "other",
  ) => {
    setProductType(nextType);
    const refQuote =
      quotes.find((q) => q.providerCode === quoteProviderCode) ?? quotes[0];
    if (refQuote) {
      const ratio =
        nextType === "jewelry_18k" ? new Decimal("0.75") : new Decimal(1);
      const suggestedPerChi = new Decimal(refQuote.sellPricePerChi)
        .mul(ratio)
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
      setUnitPriceInput(
        weightUnit === "luong"
          ? suggestedPerChi.mul(TEN).toFixed(0)
          : suggestedPerChi.toFixed(0),
      );
    }
  };

  const handleToggleWeightUnit = (nextUnit: GoldWeightUnit) => {
    if (nextUnit === weightUnit) return;
    const currentPrice = new Decimal(unitPriceInput || "0");
    if (currentPrice.gt(0)) {
      setUnitPriceInput(
        nextUnit === "luong"
          ? currentPrice.mul(TEN).toFixed(0)
          : currentPrice.div(TEN).toFixed(0),
      );
    }
    setWeightUnit(nextUnit);
  };

  const computedChi = convertGoldWeightToChi(quantityInput || "0", weightUnit);
  const computedPricePerChi = convertGoldPriceToPerChi(
    unitPriceInput || "0",
    weightUnit,
  );
  const computedTotalCost = computedChi
    .mul(computedPricePerChi)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .plus(new Decimal(craftingFee || "0"));

  const peggedShopSellPerChi = computedPricePerChi;
  const parsedLocalSpreadPerChi = new Decimal(localShopSpreadPerChi || "0");
  const peggedShopBuyPerChi = Decimal.max(
    peggedShopSellPerChi.minus(parsedLocalSpreadPerChi),
    ZERO,
  );

  const generatedHoldingName =
    priceSourceMode === "auto_brand"
      ? (GOLD_BRAND_QUOTES.find((q) => q.providerCode === quoteProviderCode)
          ?.shortLabel ?? `${GOLD_PRODUCT_TYPE_LABELS[productType]} ${brandName}`)
      : brandName.trim()
        ? `${GOLD_PRODUCT_TYPE_LABELS[productType]} — ${brandName.trim()}`
        : GOLD_PRODUCT_TYPE_LABELS[productType];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createGoldHoldingAction({
        name: generatedHoldingName,
        brandName,
        productType,
        priceSourceMode,
        quoteProviderCode:
          priceSourceMode === "auto_brand" || priceSourceMode === "pegged_brand"
            ? quoteProviderCode
            : null,
        manualBuybackPricePerChi:
          priceSourceMode === "pegged_brand"
            ? peggedShopBuyPerChi.toFixed(0)
            : priceSourceMode === "manual"
              ? manualBuybackPrice
              : null,
        manualSellPricePerChi:
          priceSourceMode === "pegged_brand"
            ? peggedShopSellPerChi.toFixed(0)
            : priceSourceMode === "manual"
              ? manualSellPrice
              : null,
        storageLocation,
        initialLot: {
          fundingMode,
          sourceWalletId,
          purchaseDate,
          quantityChi: computedChi.toFixed(4),
          unitPricePerChi: computedPricePerChi.toFixed(0),
          craftingFeeAmount: craftingFee || "0",
          shopName: brandName,
          invoiceOrSerial,
        },
      });
      if (!res.ok) {
        toast.error(res.error ?? "Không thể lưu khoản vàng.");
        return;
      }
      toast.success(res.message ?? "Đã lưu khoản vàng thành công.");
      onSuccess();
    });
  }

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange}>
      <SheetHeader
        icon={Coins}
        title="Mua / Thêm vàng tích sản"
        description="Theo dõi giá vốn và tự động tính lời/lỗ theo giá thị trường."
      />
      <form
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <SheetBody>
          {/* 1. Equal-Width 3-Column Source Mode Tabs */}
          <Tabs
            value={priceSourceMode}
            onValueChange={(val) =>
              handleSelectMode(val as "auto_brand" | "pegged_brand" | "manual")
            }
            className="gap-0"
          >
            <TabsList
              variant="navigation"
              className="grid w-full grid-cols-3"
              aria-label="Nguồn giá vàng"
            >
              <TabsTrigger value="auto_brand" className="px-1.5 text-xs">
                Thương hiệu lớn
              </TabsTrigger>
              <TabsTrigger value="pegged_brand" className="px-1.5 text-xs">
                Tiệm địa phương
              </TabsTrigger>
              <TabsTrigger value="manual" className="px-1.5 text-xs">
                Tự nhập giá
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* 2. Luxury Hero Card for Purchase Quantity & Price */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 sm:p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--foreground)] whitespace-nowrap">
                Số lượng & Giá mua
              </span>
              <div className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
                <button
                  type="button"
                  onClick={() => handleToggleWeightUnit("chi")}
                  className={cn(
                    "rounded-md px-2.5 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap",
                    weightUnit === "chi"
                      ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--foreground)]",
                  )}
                >
                  Theo Chỉ
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleWeightUnit("luong")}
                  className={cn(
                    "rounded-md px-2.5 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap",
                    weightUnit === "luong"
                      ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--foreground)]",
                  )}
                >
                  Lượng (Cây)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-[92px_1fr] gap-2.5 sm:grid-cols-[124px_1fr] sm:gap-3">
              <Input
                label={`Số lượng (${weightUnit === "luong" ? "Lượng" : "Chỉ"})`}
                type="number"
                step="0.01"
                min="0.01"
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                className="text-sm font-semibold tabular-nums"
                required
              />
              <MoneyInput
                label={`Giá mua (${weightUnit === "luong" ? "đ/lượng" : "đ/chỉ"})`}
                value={unitPriceInput}
                onValueChange={setUnitPriceInput}
                className="pr-11 text-sm font-semibold"
              />
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2 text-xs">
              <span className="text-[var(--text-secondary)] whitespace-nowrap">
                Thành tiền ({formatGoldWeightVi(computedChi).fullText}):
              </span>
              <strong className="text-sm font-bold text-[var(--primary)] tabular-nums whitespace-nowrap">
                {formatAmount(computedTotalCost.toFixed(0), currency)}
              </strong>
            </div>
          </div>

          {/* 3. Brand / Shop Configuration (Zero line wrapping on Mobile & Desktop) */}
          {priceSourceMode === "auto_brand" ? (
            <Select
              label="Thương hiệu & Loại vàng"
              value={quoteProviderCode}
              onValueChange={(val) => val && handleSelectAutoBrand(val)}
              className="text-sm whitespace-nowrap"
              options={GOLD_BRAND_QUOTES.map((q) => ({
                value: q.providerCode,
                label: q.shortLabel,
                selectedContent: (
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <span className="font-medium text-[var(--foreground)]">
                      {q.shortLabel}
                    </span>
                    <span className="rounded bg-[var(--surface-secondary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                      {q.brandName}
                    </span>
                  </span>
                ),
                content: (
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="font-medium text-[var(--foreground)]">
                      {q.shortLabel}
                    </span>
                    <span className="shrink-0 rounded bg-[var(--surface-secondary)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                      {q.brandName}
                    </span>
                  </div>
                ),
              }))}
            />
          ) : priceSourceMode === "pegged_brand" ? (
            <div className="space-y-2.5 sm:space-y-3">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <Input
                  label="Tên tiệm vàng"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="VD: Kim Phát..."
                  className="text-sm"
                  required
                />
                <Select
                  label="Loại vàng"
                  value={productType}
                  onValueChange={(val) =>
                    val &&
                    handleChangeLocalProductType(val as typeof productType)
                  }
                  className="text-sm whitespace-nowrap"
                  options={GOLD_PRODUCT_TYPE_OPTIONS}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <Select
                  label="Theo giá vàng vùng"
                  value={quoteProviderCode}
                  onValueChange={(val) => val && setQuoteProviderCode(val)}
                  className="text-sm whitespace-nowrap"
                  options={[
                    {
                      value: "SJ9999",
                      label: "Miền Nam (Nhẫn SJC 9999)",
                      selectedContent: "Miền Nam · SJC",
                    },
                    {
                      value: "BT9999NTT",
                      label: "Miền Bắc (Nhẫn BTMC 9999)",
                      selectedContent: "Miền Bắc · BTMC",
                    },
                  ]}
                />

                <MoneyInput
                  label="Tiệm mua thấp hơn"
                  value={localShopSpreadPerChi}
                  onValueChange={setLocalShopSpreadPerChi}
                  placeholder="150.000"
                  className="pr-11 text-sm"
                />
              </div>

              <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-xs">
                <span className="text-[var(--text-secondary)] whitespace-nowrap">
                  Giá tiệm thu mua dự kiến:
                </span>
                <strong className="font-bold text-[var(--income)] tabular-nums whitespace-nowrap">
                  {rawFormatAmount(peggedShopBuyPerChi.toFixed(0))} đ/chỉ
                </strong>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 sm:space-y-3">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <Input
                  label="Tên tiệm / Thương hiệu"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="VD: Kim Phát..."
                  className="text-sm"
                  required
                />
                <Select
                  label="Loại vàng"
                  value={productType}
                  onValueChange={(val) =>
                    val && setProductType(val as typeof productType)
                  }
                  className="text-sm whitespace-nowrap"
                  options={GOLD_PRODUCT_TYPE_OPTIONS}
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <MoneyInput
                  label="Giá tiệm mua vào (đ/chỉ)"
                  value={manualBuybackPrice}
                  onValueChange={setManualBuybackPrice}
                  className="pr-11 text-sm"
                />
                <MoneyInput
                  label="Giá tiệm bán ra (đ/chỉ)"
                  value={manualSellPrice}
                  onValueChange={setManualSellPrice}
                  className="pr-11 text-sm"
                />
              </div>
            </div>
          )}

          {/* 4. Symmetrical 2-Column Date & Funding Source */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <DatePicker
              label="Ngày mua"
              value={purchaseDate}
              onValueChange={(val: string) => val && setPurchaseDate(val)}
              className="text-sm whitespace-nowrap"
            />
            <Select
              label="Nguồn tiền thanh toán"
              value={fundingSelection}
              onValueChange={(val) => val && setFundingSelection(val)}
              className="text-sm whitespace-nowrap"
              options={buildFundingSourceOptions(
                wallets,
                currency,
                "Vàng đã có sẵn",
              )}
            />
          </div>

          {/* 5. Collapsible Optional Details (Symmetrical 2-Col) */}
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => setShowOptionalDetails((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] cursor-pointer"
            >
              <SlidersHorizontal className="size-3.5 text-[var(--primary)]" />
              <span>
                {showOptionalDetails
                  ? "Ẩn tiền công, số seri & nơi cất giữ"
                  : "Thêm tiền công chế tác, số seri hoặc nơi cất giữ"}
              </span>
            </button>

            {showOptionalDetails && (
              <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/45 p-3">
                <MoneyInput
                  label="Tiền công / Phí"
                  value={craftingFee}
                  onValueChange={setCraftingFee}
                  className="pr-11 text-sm"
                />
                <Input
                  label="Số seri / Hóa đơn"
                  value={invoiceOrSerial}
                  onChange={(e) => setInvoiceOrSerial(e.target.value)}
                  placeholder="VD: Seri SJC / Mã vỉ..."
                  className="text-sm"
                />
                <Input
                  wrapperClassName="col-span-2"
                  label="Nơi cất giữ / Bảo quản"
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  placeholder="VD: Két sắt gia đình..."
                  className="text-sm"
                />
              </div>
            )}
          </div>
        </SheetBody>
        <SheetFooter
          onCancel={() => onOpenChange(false)}
          cancelLabel="Hủy"
          submitLabel="Lưu khoản vàng"
          isSubmitting={isPending}
          submittingLabel="Đang lưu..."
        />
      </form>
    </ResponsiveSheet>
  );
}

function AddGoldLotSheet({
  open,
  onOpenChange,
  holding,
  wallets,
  businessDate,
  currency,
  isPending,
  startTransition,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holding: GoldHoldingItem;
  wallets: InvestmentsOverviewData["wallets"];
  businessDate: string;
  currency: string;
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
  onSuccess: () => void;
}) {
  const [weightUnit, setWeightUnit] = useState<GoldWeightUnit>("chi");
  const [quantityInput, setQuantityInput] = useState("1");
  const [unitPriceInput, setUnitPriceInput] = useState(
    holding.valuation.marketSellPricePerChi,
  );
  const [craftingFee, setCraftingFee] = useState("0");
  const [fundingSelection, setFundingSelection] = useState<string>(
    wallets[0]?.id ?? EXISTING_ASSET_VALUE,
  );
  const [purchaseDate, setPurchaseDate] = useState(businessDate);
  const [invoiceOrSerial, setInvoiceOrSerial] = useState("");
  const [note, setNote] = useState("");
  const [showOptional, setShowOptional] = useState(false);

  const fundingMode =
    fundingSelection === EXISTING_ASSET_VALUE
      ? "existing_asset"
      : "from_wallet";
  const sourceWalletId =
    fundingSelection === EXISTING_ASSET_VALUE ? null : fundingSelection;

  const handleToggleWeightUnit = (nextUnit: GoldWeightUnit) => {
    if (nextUnit === weightUnit) return;
    const currentPrice = new Decimal(unitPriceInput || "0");
    if (currentPrice.gt(0)) {
      setUnitPriceInput(
        nextUnit === "luong"
          ? currentPrice.mul(TEN).toFixed(0)
          : currentPrice.div(TEN).toFixed(0),
      );
    }
    setWeightUnit(nextUnit);
  };

  const computedChi = convertGoldWeightToChi(quantityInput || "0", weightUnit);
  const computedPricePerChi = convertGoldPriceToPerChi(
    unitPriceInput || "0",
    weightUnit,
  );
  const computedTotalCost = computedChi
    .mul(computedPricePerChi)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .plus(new Decimal(craftingFee || "0"));

  const nextTotalChi = new Decimal(holding.valuation.totalQuantityChi).plus(
    computedChi,
  );
  const nextTotalCost = new Decimal(
    holding.valuation.totalCostBasisAmount,
  ).plus(computedTotalCost);
  const nextAvgCostPerChi = nextTotalChi.gt(0)
    ? nextTotalCost.div(nextTotalChi).toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    : ZERO;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await addGoldPurchaseLotAction({
        holdingId: holding.id,
        fundingMode,
        sourceWalletId,
        purchaseDate,
        quantityChi: computedChi.toFixed(4),
        unitPricePerChi: computedPricePerChi.toFixed(0),
        craftingFeeAmount: craftingFee || "0",
        shopName: holding.brandName,
        invoiceOrSerial,
        note,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Không thể ghi nhận đợt mua vàng.");
        return;
      }
      toast.success(res.message ?? "Đã ghi nhận đợt mua thêm vàng.");
      onSuccess();
    });
  }

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange}>
      <SheetHeader
        icon={Plus}
        title={`Mua thêm vàng — ${holding.name}`}
        description="Tự động cộng thêm số vàng và tính lại giá mua trung bình."
      />
      <form
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <SheetBody>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 sm:p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--foreground)] whitespace-nowrap">
                Số lượng & Giá mua
              </span>
              <div className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
                <button
                  type="button"
                  onClick={() => handleToggleWeightUnit("chi")}
                  className={cn(
                    "rounded-md px-2.5 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap",
                    weightUnit === "chi"
                      ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--foreground)]",
                  )}
                >
                  Theo Chỉ
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleWeightUnit("luong")}
                  className={cn(
                    "rounded-md px-2.5 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap",
                    weightUnit === "luong"
                      ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--foreground)]",
                  )}
                >
                  Lượng (Cây)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-[92px_1fr] gap-2.5 sm:grid-cols-[124px_1fr] sm:gap-3">
              <Input
                label={`Số lượng (${weightUnit === "luong" ? "Lượng" : "Chỉ"})`}
                type="number"
                step="0.01"
                min="0.01"
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                className="text-sm font-semibold tabular-nums"
                required
              />
              <MoneyInput
                label={`Giá mua (${weightUnit === "luong" ? "đ/lượng" : "đ/chỉ"})`}
                value={unitPriceInput}
                onValueChange={setUnitPriceInput}
                className="pr-11 text-sm font-semibold"
              />
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2 text-xs">
              <span className="text-[var(--text-secondary)] whitespace-nowrap">
                Thành tiền ({formatGoldWeightVi(computedChi).fullText}):
              </span>
              <strong className="text-sm font-bold text-[var(--primary)] tabular-nums whitespace-nowrap">
                {formatAmount(computedTotalCost.toFixed(0), currency)}
              </strong>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <DatePicker
              label="Ngày mua"
              value={purchaseDate}
              onValueChange={(val: string) => val && setPurchaseDate(val)}
              className="text-sm whitespace-nowrap"
            />
            <Select
              label="Nguồn tiền thanh toán"
              value={fundingSelection}
              onValueChange={(val) => val && setFundingSelection(val)}
              className="text-sm whitespace-nowrap"
              options={buildFundingSourceOptions(
                wallets,
                currency,
                "Vàng đã có sẵn",
              )}
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowOptional((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] cursor-pointer"
            >
              <SlidersHorizontal className="size-3.5 text-[var(--primary)]" />
              <span>
                {showOptional
                  ? "Ẩn tiền công, số seri & ghi chú"
                  : "Thêm tiền công chế tác, số seri hoặc ghi chú"}
              </span>
            </button>

            {showOptional && (
              <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/45 p-3">
                <MoneyInput
                  label="Tiền công / Phí"
                  value={craftingFee}
                  onValueChange={setCraftingFee}
                  className="pr-11 text-sm"
                />
                <Input
                  label="Số seri / Hóa đơn"
                  value={invoiceOrSerial}
                  onChange={(e) => setInvoiceOrSerial(e.target.value)}
                  placeholder="VD: Seri miếng / Mã vỉ..."
                  className="text-sm"
                />
                <Input
                  wrapperClassName="col-span-2"
                  label="Ghi chú"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="VD: Mua tích sản..."
                  className="text-sm"
                />
              </div>
            )}
          </div>

          {/* DCA Summary */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/45 p-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">
                Tổng số vàng sau khi mua:
              </span>
              <strong className="font-semibold text-[var(--foreground)]">
                {formatGoldWeightVi(nextTotalChi).fullText}
              </strong>
            </div>
            <div className="flex items-center justify-between border-t border-[var(--border)]/60 pt-1.5">
              <span className="text-[var(--text-secondary)]">
                Giá mua trung bình mới:
              </span>
              <strong className="font-bold text-[var(--primary)] tabular-nums">
                {formatAmount(nextAvgCostPerChi.toFixed(0), currency)}/chỉ
              </strong>
            </div>
          </div>
        </SheetBody>
        <SheetFooter
          onCancel={() => onOpenChange(false)}
          cancelLabel="Hủy"
          submitLabel="Xác nhận mua thêm"
          isSubmitting={isPending}
          submittingLabel="Đang lưu..."
        />
      </form>
    </ResponsiveSheet>
  );
}

function SellGoldSheet({
  open,
  onOpenChange,
  holding,
  preselectedLotId = null,
  wallets,
  businessDate,
  currency,
  isPending,
  startTransition,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holding: GoldHoldingItem;
  preselectedLotId?: string | null;
  wallets: InvestmentsOverviewData["wallets"];
  businessDate: string;
  currency: string;
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
  onSuccess: () => void;
}) {
  const openLots = useMemo(
    () =>
      holding.lots.filter((l) => new Decimal(l.remainingQuantityChi).gt(0)),
    [holding.lots],
  );

  const [costMode, setCostMode] = useState<"average_cost" | "specific_lot">(
    preselectedLotId ? "specific_lot" : "average_cost",
  );
  const [purchaseLotId, setPurchaseLotId] = useState(
    preselectedLotId ?? openLots[0]?.id ?? "",
  );
  const [weightUnit, setWeightUnit] = useState<GoldWeightUnit>("chi");
  const [quantityInput, setQuantityInput] = useState(() => {
    if (preselectedLotId) {
      const lot = openLots.find((l) => l.id === preselectedLotId);
      if (lot)
        return new Decimal(lot.remainingQuantityChi).toNumber().toString();
    }
    return new Decimal(holding.valuation.totalQuantityChi)
      .toNumber()
      .toString();
  });
  const [sellPriceInput, setSellPriceInput] = useState(
    holding.valuation.marketBuybackPricePerChi,
  );
  const [feeOrDeduction, setFeeOrDeduction] = useState("0");
  const [destinationWalletId, setDestinationWalletId] = useState(
    wallets[0]?.id ?? "",
  );
  const [saleDate, setSaleDate] = useState(businessDate);
  const [note, setNote] = useState("");

  const maxSellableChi = useMemo(() => {
    if (costMode === "specific_lot") {
      const lot = openLots.find((l) => l.id === purchaseLotId);
      return lot ? new Decimal(lot.remainingQuantityChi) : ZERO;
    }
    return new Decimal(holding.valuation.totalQuantityChi);
  }, [costMode, openLots, purchaseLotId, holding.valuation.totalQuantityChi]);

  const handleChangeCostMode = (nextMode: "average_cost" | "specific_lot") => {
    setCostMode(nextMode);
    if (nextMode === "specific_lot") {
      const targetId = purchaseLotId || openLots[0]?.id || "";
      if (targetId && targetId !== purchaseLotId) {
        setPurchaseLotId(targetId);
      }
      const lot = openLots.find((l) => l.id === targetId);
      if (lot) {
        const remChi = new Decimal(lot.remainingQuantityChi);
        const currentChi = convertGoldWeightToChi(
          quantityInput || "0",
          weightUnit,
        );
        if (currentChi.lte(0) || currentChi.gt(remChi)) {
          setQuantityInput(
            weightUnit === "luong"
              ? remChi.div(TEN).toNumber().toString()
              : remChi.toNumber().toString(),
          );
        }
      }
    }
  };

  const handleToggleWeightUnit = (nextUnit: GoldWeightUnit) => {
    if (nextUnit === weightUnit) return;
    const currentPrice = new Decimal(sellPriceInput || "0");
    if (currentPrice.gt(0)) {
      setSellPriceInput(
        nextUnit === "luong"
          ? currentPrice.mul(TEN).toFixed(0)
          : currentPrice.div(TEN).toFixed(0),
      );
    }
    const currentQty = new Decimal(quantityInput || "0");
    if (currentQty.gt(0)) {
      setQuantityInput(
        nextUnit === "luong"
          ? currentQty.div(TEN).toNumber().toString()
          : currentQty.mul(TEN).toNumber().toString(),
      );
    }
    setWeightUnit(nextUnit);
  };

  const sellChi = convertGoldWeightToChi(quantityInput || "0", weightUnit);
  const sellPricePerChi = convertGoldPriceToPerChi(
    sellPriceInput || "0",
    weightUnit,
  );

  const previewResult = useMemo(() => {
    try {
      const data = allocateGoldSaleCostBasis({
        costMode,
        sellQuantityChi: sellChi,
        sellPricePerChi,
        feeOrDeductionAmount: feeOrDeduction || "0",
        holdingQuantityChi: holding.valuation.totalQuantityChi,
        holdingCostBasisAmount: holding.valuation.totalCostBasisAmount,
        openLots: openLots.map((l) => ({
          id: l.id,
          remainingQuantityChi: l.remainingQuantityChi,
          remainingCostAmount: l.remainingCostAmount,
        })),
        targetLotId: costMode === "specific_lot" ? purchaseLotId : null,
      });
      return { data, error: null as string | null };
    } catch (err) {
      return {
        data: null,
        error:
          err instanceof Error
            ? err.message
            : "Vui lòng kiểm tra lại số lượng và giá bán.",
      };
    }
  }, [
    costMode,
    sellChi,
    sellPricePerChi,
    feeOrDeduction,
    holding.valuation.totalQuantityChi,
    holding.valuation.totalCostBasisAmount,
    openLots,
    purchaseLotId,
  ]);
  const preview = previewResult.data;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await recordGoldSaleAction({
        holdingId: holding.id,
        costMode,
        purchaseLotId: costMode === "specific_lot" ? purchaseLotId : null,
        destinationWalletId,
        saleDate,
        quantityChi: sellChi.toFixed(4),
        sellPricePerChi: sellPricePerChi.toFixed(0),
        feeOrDeductionAmount: feeOrDeduction || "0",
        note,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Không thể ghi nhận giao dịch bán vàng.");
        return;
      }
      toast.success(res.message ?? "Đã bán vàng và cộng tiền vào ví.");
      onSuccess();
    });
  }

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange}>
      <SheetHeader
        icon={ArrowUpRight}
        title={`Bán vàng — ${holding.name}`}
        description="Tiền bán vàng sẽ tự động cộng vào ví bạn chọn."
      />
      <form
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <SheetBody>
          <Tabs
            value={costMode}
            onValueChange={(val) =>
              handleChangeCostMode(val as "average_cost" | "specific_lot")
            }
            className="gap-0"
          >
            <TabsList
              variant="navigation"
              className="grid w-full grid-cols-2"
              aria-label="Cách tính giá mua"
            >
              <TabsTrigger value="average_cost" className="px-2 text-xs">
                Tính theo giá trung bình
              </TabsTrigger>
              <TabsTrigger value="specific_lot" className="px-2 text-xs">
                Chọn đợt mua cụ thể
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {costMode === "specific_lot" && (
            <Select
              label="Chọn đợt mua muốn bán"
              value={purchaseLotId}
              className="text-sm whitespace-nowrap"
              onValueChange={(val) => {
                if (!val) return;
                setPurchaseLotId(val);
                const lot = openLots.find((l) => l.id === val);
                if (lot) {
                  const remChi = new Decimal(lot.remainingQuantityChi);
                  setQuantityInput(
                    weightUnit === "luong"
                      ? remChi.div(TEN).toNumber().toString()
                      : remChi.toNumber().toString(),
                  );
                }
              }}
              options={openLots.map((lot) => ({
                value: lot.id,
                label: `Ngày ${formatShortViDate(lot.purchaseDate)} · Còn ${lot.remainingFormatted.primary}`,
                selectedContent: `Đợt ${formatShortViDate(lot.purchaseDate)} (Còn ${lot.remainingFormatted.primary})`,
              }))}
            />
          )}

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 sm:p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--foreground)] whitespace-nowrap">
                Tối đa: {formatGoldWeightVi(maxSellableChi).primary}
              </span>
              <div className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
                <button
                  type="button"
                  onClick={() => handleToggleWeightUnit("chi")}
                  className={cn(
                    "rounded-md px-2.5 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap",
                    weightUnit === "chi"
                      ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--foreground)]",
                  )}
                >
                  Theo Chỉ
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleWeightUnit("luong")}
                  className={cn(
                    "rounded-md px-2.5 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap",
                    weightUnit === "luong"
                      ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--foreground)]",
                  )}
                >
                  Theo Lượng
                </button>
              </div>
            </div>

            <div className="grid grid-cols-[92px_1fr] gap-2.5 sm:grid-cols-[124px_1fr] sm:gap-3">
              <Input
                label={`Số lượng (${weightUnit === "luong" ? "Lượng" : "Chỉ"})`}
                type="number"
                step="0.01"
                min="0.01"
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                className="text-sm font-semibold tabular-nums"
                required
              />
              <MoneyInput
                label={`Giá bán (${weightUnit === "luong" ? "đ/lượng" : "đ/chỉ"})`}
                value={sellPriceInput}
                onValueChange={setSellPriceInput}
                className="pr-11 text-sm font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <Select
              label="Ví nhận tiền"
              value={destinationWalletId}
              onValueChange={(val) => val && setDestinationWalletId(val)}
              className="text-sm whitespace-nowrap"
              options={wallets.map((w) => ({
                value: w.id,
                label: w.name,
                selectedContent: `Ví: ${w.name}`,
                content: (
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="font-medium text-[var(--foreground)]">
                      Ví: {w.name}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] tabular-nums">
                      {formatAmount(w.currentBalance, currency)}
                    </span>
                  </div>
                ),
              }))}
            />
            <DatePicker
              label="Ngày bán"
              value={saleDate}
              onValueChange={(val: string) => val && setSaleDate(val)}
              className="text-sm whitespace-nowrap"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <MoneyInput
              label="Phí trừ hao / Kiểm định"
              value={feeOrDeduction}
              onValueChange={setFeeOrDeduction}
              className="pr-11 text-sm"
            />
            <Input
              label="Ghi chú (Tùy chọn)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Bán 2 chỉ..."
              className="text-sm"
            />
          </div>

          {preview ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/45 p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">
                  Số tiền thực nhận về ví:
                </span>
                <strong className="text-sm font-bold text-[var(--foreground)] tabular-nums">
                  {formatAmount(preview.netProceedsAmount.toFixed(0), currency)}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">
                  Tiền vốn lúc mua:
                </span>
                <span className="font-semibold text-[var(--text-secondary)] tabular-nums">
                  {formatAmount(
                    preview.costBasisAllocatedAmount.toFixed(0),
                    currency,
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border)]/60 pt-1.5">
                <span className="font-semibold text-[var(--foreground)]">
                  Lời / Lỗ thực tế:
                </span>
                <strong
                  className={cn(
                    "text-sm font-bold tabular-nums",
                    preview.realizedProfitAmount.gt(0)
                      ? "text-[var(--income)]"
                      : preview.realizedProfitAmount.lt(0)
                        ? "text-[var(--expense)]"
                        : "text-[var(--foreground)]",
                  )}
                >
                  {preview.realizedProfitAmount.gt(0) ? "+" : ""}
                  {formatAmount(
                    preview.realizedProfitAmount.toFixed(0),
                    currency,
                  )}
                </strong>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--expense)]/35 bg-[var(--expense)]/8 px-3.5 py-2.5 text-xs font-medium text-[var(--expense)]">
              {previewResult.error}
            </div>
          )}
        </SheetBody>
        <SheetFooter
          onCancel={() => onOpenChange(false)}
          cancelLabel="Hủy"
          submitLabel="Xác nhận bán vàng"
          submitDisabled={!preview}
          isSubmitting={isPending}
          submittingLabel="Đang xử lý..."
        />
      </form>
    </ResponsiveSheet>
  );
}

function GoldHoldingDetailSheet({
  open,
  onOpenChange,
  holding,
  currency,
  isPending,
  startTransition,
  onBuyMore,
  onSellLot,
  onRefresh,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holding: GoldHoldingItem;
  currency: string;
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
  onBuyMore: () => void;
  onSellLot: (lotId: string) => void;
  onRefresh: () => void;
}) {
  const [confirmDeleteHolding, setConfirmDeleteHolding] = useState(false);

  function handleDeleteLot(lotId: string) {
    startTransition(async () => {
      const res = await deleteGoldPurchaseLotAction(lotId);
      if (!res.ok) {
        toast.error(res.error ?? "Không thể xóa đợt mua vàng.");
        return;
      }
      toast.success(res.message ?? "Đã xóa đợt mua vàng.");
      onRefresh();
    });
  }

  function handleDeleteHolding() {
    startTransition(async () => {
      const res = await deleteGoldHoldingAction(holding.id);
      if (!res.ok) {
        toast.error(res.error ?? "Không thể xóa khoản vàng.");
        return;
      }
      toast.success(res.message ?? "Đã xóa khoản vàng.");
      onOpenChange(false);
      onRefresh();
    });
  }

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange}>
      <SheetHeader
        icon={Layers}
        title="Lịch sử Mua & Bán vàng"
        description={`${holding.name} · Đang giữ: ${holding.weightFormatted.fullText}`}
      />
      <SheetBody>
        {/* Danh sách các đợt mua */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-[var(--text-secondary)]">
              Các đợt đã mua ({holding.lots.length})
            </h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBuyMore}
              className="h-7 gap-1 px-2.5 text-xs"
            >
              <Plus className="size-3" />
              <span>Mua thêm đợt mới</span>
            </Button>
          </div>

          <div className="space-y-2">
            {holding.lots.map((lot) => {
              const remChi = new Decimal(lot.remainingQuantityChi);
              return (
                <div
                  key={lot.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/35 p-3 space-y-1.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-semibold text-[var(--foreground)]">
                        Mua {lot.quantityFormatted.primary}
                      </span>
                      <span className="ml-1.5 text-[11px] text-[var(--text-muted)]">
                        ({formatShortViDate(lot.purchaseDate)})
                      </span>
                    </div>
                    <Badge variant={remChi.gt(0) ? "default" : "secondary"}>
                      {remChi.gt(0)
                        ? `Còn giữ: ${lot.remainingFormatted.primary}`
                        : "Đã bán hết"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-[11px] text-[var(--text-secondary)]">
                    <span>
                      Giá mua: {formatAmount(lot.unitPricePerChi, currency)}/chỉ
                    </span>
                    <span className="text-right font-semibold text-[var(--foreground)] tabular-nums">
                      Thành tiền: {formatAmount(lot.totalCostAmount, currency)}
                    </span>
                    {Number(lot.craftingFeeAmount) > 0 && (
                      <span>
                        Tiền công:{" "}
                        {formatAmount(lot.craftingFeeAmount, currency)}
                      </span>
                    )}
                    <span>
                      Nguồn:{" "}
                      {lot.fundingMode === "from_wallet"
                        ? `Ví ${lot.sourceWalletName ?? ""}`
                        : "Vàng có sẵn"}
                    </span>
                  </div>

                  {lot.invoiceOrSerial && (
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Seri / Hóa đơn: {lot.invoiceOrSerial}
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-1">
                    {remChi.gt(0) && (
                      <button
                        type="button"
                        onClick={() => onSellLot(lot.id)}
                        className="text-[11px] font-semibold text-[var(--primary)] hover:underline cursor-pointer"
                      >
                        Bán từ đợt này
                      </button>
                    )}
                    {lot.canDelete && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDeleteLot(lot.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--expense)] hover:underline cursor-pointer"
                      >
                        <Trash2 className="size-3" />
                        <span>Xóa đợt mua</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lịch sử các lần bán */}
        {holding.sales.length > 0 && (
          <div className="space-y-2 border-t border-[var(--border)] pt-3">
            <h4 className="text-xs font-semibold text-[var(--text-secondary)]">
              Lịch sử bán vàng ({holding.sales.length})
            </h4>
            <div className="space-y-2">
              {holding.sales.map((sale) => {
                const profit = new Decimal(sale.realizedProfitAmount);
                return (
                  <div
                    key={sale.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 p-3 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--foreground)]">
                        Bán {sale.quantityFormatted.primary} (
                        {formatShortViDate(sale.saleDate)})
                      </span>
                      <strong
                        className={cn(
                          "font-bold tabular-nums",
                          profit.gt(0)
                            ? "text-[var(--income)]"
                            : profit.lt(0)
                              ? "text-[var(--expense)]"
                              : "text-[var(--foreground)]",
                        )}
                      >
                        Lời/Lỗ: {profit.gt(0) ? "+" : ""}
                        {formatAmount(sale.realizedProfitAmount, currency)}
                      </strong>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
                      <span>
                        Giá bán: {formatAmount(sale.sellPricePerChi, currency)}
                        /chỉ · Về ví: {sale.destinationWalletName}
                      </span>
                      <span className="font-semibold text-[var(--foreground)] tabular-nums">
                        Thực nhận:{" "}
                        {formatAmount(sale.netProceedsAmount, currency)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Xóa khoản vàng */}
        <div className="border-t border-[var(--border)] pt-3">
          {!confirmDeleteHolding ? (
            <button
              type="button"
              onClick={() => setConfirmDeleteHolding(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--expense)] hover:underline cursor-pointer"
            >
              <Trash2 className="size-3.5" />
              <span>Xóa khoản vàng này</span>
            </button>
          ) : (
            <div className="rounded-xl border border-[var(--expense)]/35 bg-[var(--expense)]/8 p-3 space-y-2">
              <p className="text-xs font-medium text-[var(--foreground)]">
                Bạn chắc chắn muốn xóa khoản vàng này? Nếu chưa có giao dịch
                bán nào, số tiền đã trích từ ví sẽ được hoàn lại.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={isPending}
                  onClick={handleDeleteHolding}
                  className="h-8 text-xs"
                >
                  Xác nhận xóa
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDeleteHolding(false)}
                  className="h-8 text-xs"
                >
                  Giữ lại
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetBody>
      <SheetFooter onCancel={() => onOpenChange(false)} cancelLabel="Đóng" />
    </ResponsiveSheet>
  );
}

function GoldHoldingSettingsSheet({
  open,
  onOpenChange,
  holding,
  quotes,
  isPending,
  startTransition,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holding: GoldHoldingItem;
  quotes: InvestmentsOverviewData["quotes"];
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
  onSuccess: () => void;
}) {
  const [brandName, setBrandName] = useState(holding.brandName);
  const [priceSourceMode, setPriceSourceMode] = useState<
    "auto_brand" | "pegged_brand" | "manual"
  >(holding.priceSourceMode);
  const [quoteProviderCode, setQuoteProviderCode] = useState(
    holding.quoteProviderCode ?? "SJ9999",
  );
  const [manualBuybackPrice, setManualBuybackPrice] = useState(
    holding.valuation.marketBuybackPricePerChi,
  );
  const [manualSellPrice, setManualSellPrice] = useState(
    holding.valuation.marketSellPricePerChi,
  );
  const [storageLocation, setStorageLocation] = useState(
    holding.storageLocation ?? "",
  );
  const [note, setNote] = useState(holding.note ?? "");

  const refQuote =
    quotes.find((q) => q.providerCode === quoteProviderCode) ?? quotes[0];
  const benchmarkRatio =
    holding.productType === "jewelry_18k"
      ? new Decimal("0.75")
      : new Decimal(1);
  const effBenchmarkBuy = refQuote
    ? new Decimal(refQuote.buyPricePerChi)
        .mul(benchmarkRatio)
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    : new Decimal("16950000");
  const computedOffset = new Decimal(manualBuybackPrice || "0").minus(
    effBenchmarkBuy,
  );

  const generatedHoldingName =
    priceSourceMode === "auto_brand"
      ? (GOLD_BRAND_QUOTES.find((q) => q.providerCode === quoteProviderCode)
          ?.shortLabel ?? holding.name)
      : brandName.trim()
        ? `${GOLD_PRODUCT_TYPE_LABELS[holding.productType]} — ${brandName.trim()}`
        : holding.name;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateGoldHoldingSettingsAction({
        holdingId: holding.id,
        name: generatedHoldingName,
        brandName,
        priceSourceMode,
        quoteProviderCode:
          priceSourceMode === "auto_brand" || priceSourceMode === "pegged_brand"
            ? quoteProviderCode
            : null,
        manualBuybackPricePerChi:
          priceSourceMode !== "auto_brand" ? manualBuybackPrice : null,
        manualSellPricePerChi:
          priceSourceMode !== "auto_brand" ? manualSellPrice : null,
        storageLocation,
        note,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Không thể cập nhật cài đặt.");
        return;
      }
      toast.success(res.message ?? "Đã lưu cài đặt khoản vàng.");
      onSuccess();
    });
  }

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange}>
      <SheetHeader
        icon={Settings2}
        title="Cài đặt giá & Thông tin vàng"
        description="Chọn cách cập nhật giá để tính đúng giá trị vàng của bạn."
      />
      <form
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <SheetBody>
          <Tabs
            value={priceSourceMode}
            onValueChange={(val) =>
              setPriceSourceMode(
                val as "auto_brand" | "pegged_brand" | "manual",
              )
            }
            className="gap-0"
          >
            <TabsList
              variant="navigation"
              className="grid w-full grid-cols-3"
              aria-label="Chế độ cập nhật giá"
            >
              <TabsTrigger value="auto_brand" className="px-1.5 text-xs">
                Thương hiệu lớn
              </TabsTrigger>
              <TabsTrigger value="pegged_brand" className="px-1.5 text-xs">
                Tiệm địa phương
              </TabsTrigger>
              <TabsTrigger value="manual" className="px-1.5 text-xs">
                Tự nhập giá
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {priceSourceMode === "auto_brand" ? (
            <Select
              label="Thương hiệu & Loại vàng"
              value={quoteProviderCode}
              className="text-sm whitespace-nowrap"
              onValueChange={(val) => {
                if (!val) return;
                setQuoteProviderCode(val);
                const found = quotes.find((q) => q.providerCode === val);
                if (found) setBrandName(found.brandName);
              }}
              options={GOLD_BRAND_QUOTES.map((q) => ({
                value: q.providerCode,
                label: q.shortLabel,
                selectedContent: `${q.shortLabel} (${q.brandName})`,
              }))}
            />
          ) : (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 sm:p-3.5 space-y-2.5 sm:space-y-3">
              <div
                className={cn(
                  "grid gap-2.5 sm:gap-3",
                  priceSourceMode === "pegged_brand"
                    ? "grid-cols-2"
                    : "grid-cols-1",
                )}
              >
                <Input
                  label="Tên tiệm vàng"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="text-sm"
                  required
                />

                {priceSourceMode === "pegged_brand" && (
                  <Select
                    label="Theo giá vàng chuẩn"
                    value={quoteProviderCode}
                    onValueChange={(val) => val && setQuoteProviderCode(val)}
                    className="text-sm whitespace-nowrap"
                    options={GOLD_BRAND_QUOTES.map((q) => {
                      const meta = formatCompactQuoteMeta(
                        q.providerCode,
                        q.brandName,
                      );
                      return {
                        value: q.providerCode,
                        label: q.shortLabel,
                        selectedContent: `${meta.brand} · ${meta.badge}`,
                      };
                    })}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <MoneyInput
                  label="Giá tiệm mua vào (đ/chỉ)"
                  value={manualBuybackPrice}
                  onValueChange={setManualBuybackPrice}
                  className="pr-11 text-sm"
                />
                <MoneyInput
                  label="Giá tiệm bán ra (đ/chỉ)"
                  value={manualSellPrice}
                  onValueChange={setManualSellPrice}
                  className="pr-11 text-sm"
                />
              </div>

              {priceSourceMode === "pegged_brand" && (
                <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2 text-xs">
                  <span className="text-[var(--text-secondary)] whitespace-nowrap">
                    Chênh lệch so với giá chuẩn:
                  </span>
                  <strong className="font-bold text-[var(--primary)] tabular-nums whitespace-nowrap">
                    {computedOffset.gte(0) ? "+" : ""}
                    {rawFormatAmount(computedOffset.toFixed(0))} đ/chỉ
                  </strong>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <Input
              label="Nơi cất giữ / Bảo quản"
              value={storageLocation}
              onChange={(e) => setStorageLocation(e.target.value)}
              placeholder="VD: Két sắt gia đình..."
              className="text-sm"
            />
            <Input
              label="Ghi chú"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="text-sm"
            />
          </div>
        </SheetBody>
        <SheetFooter
          onCancel={() => onOpenChange(false)}
          cancelLabel="Hủy"
          submitLabel="Lưu cài đặt"
          isSubmitting={isPending}
          submittingLabel="Đang lưu..."
        />
      </form>
    </ResponsiveSheet>
  );
}

function CreateSavingsDepositSheet({
  open,
  onOpenChange,
  wallets,
  businessDate,
  currency,
  isPending,
  startTransition,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: InvestmentsOverviewData["wallets"];
  businessDate: string;
  currency: string;
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
  onSuccess: () => void;
}) {
  const [bankName, setBankName] = useState("Vietcombank");
  const [accountOrPassbookNumber, setAccountOrPassbookNumber] = useState("");
  const [principalAmount, setPrincipalAmount] = useState("50000000");
  const [annualInterestRate, setAnnualInterestRate] = useState("5.2");
  const [nonTermInterestRate, setNonTermInterestRate] = useState("0.1");
  const [termMonths, setTermMonths] = useState(6);
  const [showAllTerms, setShowAllTerms] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [startDate, setStartDate] = useState(businessDate);
  const [interestPayoutMode, setInterestPayoutMode] = useState<
    "maturity" | "monthly" | "upfront"
  >("maturity");
  const [maturityAction, setMaturityAction] = useState<
    "settle_to_wallet" | "renew_principal_and_interest" | "renew_principal"
  >("settle_to_wallet");
  const [fundingSelection, setFundingSelection] = useState<string>(
    wallets[0]?.id ?? EXISTING_ASSET_VALUE,
  );
  const [note] = useState("");

  const fundingMode =
    fundingSelection === EXISTING_ASSET_VALUE
      ? "existing_asset"
      : "from_wallet";
  const sourceWalletId =
    fundingSelection === EXISTING_ASSET_VALUE ? null : fundingSelection;

  const maturityDate = useMemo(
    () => calculateSavingsMaturityDate(startDate, termMonths),
    [startDate, termMonths],
  );
  const previewMetrics = useMemo(
    () =>
      calculateSavingsMetrics({
        currentPrincipalAmount: principalAmount || "0",
        annualInterestRate: annualInterestRate || "0",
        nonTermInterestRate: nonTermInterestRate || "0.1",
        startDate,
        maturityDate,
        businessDate,
      }),
    [
      principalAmount,
      annualInterestRate,
      nonTermInterestRate,
      startDate,
      maturityDate,
      businessDate,
    ],
  );

  const displayedTerms = showAllTerms
    ? SAVINGS_TERM_MONTH_OPTIONS
    : PRIMARY_TERM_MONTHS;

  const generatedSavingsName = `Tiết kiệm ${bankName} kỳ hạn ${termMonths} tháng`;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createSavingsDepositAction({
        name: generatedSavingsName,
        bankName,
        accountOrPassbookNumber,
        fundingMode,
        sourceWalletId,
        principalAmount,
        annualInterestRate,
        nonTermInterestRate,
        termMonths,
        startDate,
        maturityDate,
        interestPayoutMode,
        maturityAction,
        note,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Không thể mở sổ tiết kiệm.");
        return;
      }
      toast.success(res.message ?? "Đã mở sổ tiết kiệm thành công.");
      onSuccess();
    });
  }

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange}>
      <SheetHeader
        icon={Landmark}
        title="Mở Sổ Tiết Kiệm Ngân Hàng"
        description="Theo dõi ngày đáo hạn và lãi tích lũy tự động."
      />
      <form
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <SheetBody>
          {/* 1. Balanced Luxury Hero Card for Principal & Expected Interest */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3.5 py-3 sm:px-4 sm:py-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                Số tiền gửi tiết kiệm
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] tabular-nums whitespace-nowrap">
                Đáo hạn {formatShortViDate(maturityDate)} · {previewMetrics.totalDays} ngày
              </span>
            </div>

            <div className="mt-1">
              <MoneyInput
                wrapperClassName="w-full [&_[data-slot=money-input-currency]]:right-0 [&_[data-slot=money-input-currency]]:font-semibold"
                className="h-9 rounded-none border-0! bg-transparent! pl-0 pr-11 text-left text-2xl font-bold tracking-tight text-[var(--foreground)] ring-0! focus-visible:border-0! focus-visible:ring-0!"
                value={principalAmount}
                onValueChange={setPrincipalAmount}
                placeholder="0"
                aria-label="Số tiền gửi tiết kiệm"
              />
            </div>

            <div className="mt-2 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-2.5">
              <div>
                <span className="block text-[11px] text-[var(--text-muted)]">
                  Tiền lãi cuối kỳ
                </span>
                <strong className="mt-0.5 block text-xs sm:text-sm font-bold text-[var(--income)] tabular-nums whitespace-nowrap">
                  +{formatAmount(previewMetrics.expectedMaturityInterest, currency)}
                </strong>
              </div>
              <div className="border-l border-[var(--border)] pl-3 text-right">
                <span className="block text-[11px] text-[var(--text-muted)]">
                  Tổng nhận đáo hạn
                </span>
                <strong className="mt-0.5 block text-xs sm:text-sm font-bold text-[var(--primary)] tabular-nums whitespace-nowrap">
                  {formatAmount(previewMetrics.expectedTotalAtMaturity, currency)}
                </strong>
              </div>
            </div>
          </div>

          {/* 2. Symmetrical 2-Column Bank & Interest Rate */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <Select
              label="Ngân hàng gửi"
              value={bankName}
              onValueChange={(val) => val && setBankName(val)}
              className="text-sm whitespace-nowrap"
              options={POPULAR_VIETNAM_BANKS.map((bank) => ({
                value: bank,
                label: bank,
              }))}
            />
            <Input
              label="Lãi suất (%/năm)"
              type="number"
              step="0.05"
              min="0.1"
              max="30"
              className="text-sm font-semibold"
              value={annualInterestRate}
              onChange={(e) => setAnnualInterestRate(e.target.value)}
            />
          </div>

          {/* 3. Term Months (Symmetrical 6-Column Grid) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Kỳ hạn gửi (Tháng)
              </span>
              <button
                type="button"
                onClick={() => setShowAllTerms((prev) => !prev)}
                className="text-xs font-medium text-[var(--primary)] hover:underline cursor-pointer"
              >
                {showAllTerms ? "Thu gọn" : "Kỳ hạn khác"}
              </button>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {displayedTerms.map((m) => {
                const active = termMonths === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTermMonths(m)}
                    className={cn(
                      "h-9 rounded-lg border text-center text-xs font-semibold transition-colors cursor-pointer select-none",
                      active
                        ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] font-bold"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--foreground)]",
                    )}
                  >
                    {m}T
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Symmetrical 2-Column Start Date & Funding Source */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <DatePicker
              label="Ngày gửi"
              value={startDate}
              onValueChange={(val: string) => val && setStartDate(val)}
              className="text-sm whitespace-nowrap"
            />
            <Select
              label="Nguồn tiền gửi"
              value={fundingSelection}
              onValueChange={(val) => val && setFundingSelection(val)}
              className="text-sm whitespace-nowrap"
              options={buildFundingSourceOptions(
                wallets,
                currency,
                "Sổ đã có sẵn",
              )}
            />
          </div>

          {/* 6. Collapsible Advanced Passbook Settings */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/45">
            <button
              type="button"
              onClick={() => setShowAdvancedOptions((prev) => !prev)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs cursor-pointer"
            >
              <span className="flex items-center gap-1.5 font-medium text-[var(--text-secondary)]">
                <SlidersHorizontal className="size-3.5 shrink-0 text-[var(--primary)]" />
                <span>
                  {
                    SAVINGS_PAYOUT_OPTIONS.find(
                      (o) => o.value === interestPayoutMode,
                    )?.selectedContent
                  }
                  {" · "}
                  {
                    SAVINGS_MATURITY_OPTIONS.find(
                      (o) => o.value === maturityAction,
                    )?.selectedContent
                  }
                </span>
              </span>
              <span className="shrink-0 font-semibold text-[var(--primary)]">
                {showAdvancedOptions ? "Thu gọn" : "Tùy chỉnh"}
              </span>
            </button>

            {showAdvancedOptions && (
              <div className="grid grid-cols-2 gap-2.5 border-t border-[var(--border)] p-3 sm:gap-3">
                <Select
                  label="Cách nhận lãi"
                  value={interestPayoutMode}
                  onValueChange={(val) =>
                    val &&
                    setInterestPayoutMode(val as typeof interestPayoutMode)
                  }
                  className="text-sm whitespace-nowrap"
                  options={SAVINGS_PAYOUT_OPTIONS}
                />
                <Select
                  label="Khi đến hạn"
                  value={maturityAction}
                  onValueChange={(val) =>
                    val && setMaturityAction(val as typeof maturityAction)
                  }
                  className="text-sm whitespace-nowrap"
                  options={SAVINGS_MATURITY_OPTIONS}
                />
                <Input
                  label="Mã sổ / Số TK"
                  className="text-sm"
                  value={accountOrPassbookNumber}
                  onChange={(e) => setAccountOrPassbookNumber(e.target.value)}
                  placeholder="Không bắt buộc"
                />
                <Input
                  label="Lãi không kỳ hạn (%)"
                  type="number"
                  step="0.05"
                  min="0"
                  max="5"
                  className="text-sm"
                  value={nonTermInterestRate}
                  onChange={(e) => setNonTermInterestRate(e.target.value)}
                />
              </div>
            )}
          </div>
        </SheetBody>
        <SheetFooter
          onCancel={() => onOpenChange(false)}
          cancelLabel="Hủy"
          submitLabel="Xác nhận mở sổ"
          isSubmitting={isPending}
          submittingLabel="Đang mở sổ..."
        />
      </form>
    </ResponsiveSheet>
  );
}

function SettleSavingsDepositSheet({
  open,
  onOpenChange,
  deposit,
  wallets,
  businessDate,
  currency,
  isPending,
  startTransition,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deposit: SavingsDepositItem;
  wallets: InvestmentsOverviewData["wallets"];
  businessDate: string;
  currency: string;
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
  onSuccess: () => void;
}) {
  const [settlementType, setSettlementType] = useState<
    "maturity" | "early_partial" | "early_full" | "rollover"
  >("maturity");
  const [settlementDate, setSettlementDate] = useState(businessDate);
  const [destinationWalletId, setDestinationWalletId] = useState(
    deposit.sourceWalletId ?? wallets[0]?.id ?? "",
  );
  const [principalWithdrawn, setPrincipalWithdrawn] = useState(
    deposit.currentPrincipalAmount,
  );
  const [interestReceived, setInterestReceived] = useState(
    deposit.metrics.expectedMaturityInterest,
  );
  const [rolloverMode, setRolloverMode] = useState<
    "renew_principal_and_interest" | "renew_principal"
  >("renew_principal_and_interest");
  const [newTermMonths, setNewTermMonths] = useState(deposit.termMonths);
  const [newAnnualRate, setNewAnnualRate] = useState(
    deposit.annualInterestRate,
  );
  const [note] = useState("");

  const handleSelectMode = (
    nextMode: "maturity" | "early_partial" | "early_full" | "rollover",
  ) => {
    setSettlementType(nextMode);
    if (nextMode === "maturity" || nextMode === "rollover") {
      setPrincipalWithdrawn(deposit.currentPrincipalAmount);
      setInterestReceived(deposit.metrics.expectedMaturityInterest);
    } else if (nextMode === "early_full") {
      setPrincipalWithdrawn(deposit.currentPrincipalAmount);
      const earlyInt = calculateEarlyWithdrawalInterest({
        withdrawnPrincipalAmount: deposit.currentPrincipalAmount,
        nonTermInterestRate: deposit.nonTermInterestRate,
        startDate: deposit.startDate,
        withdrawalDate: settlementDate,
      });
      setInterestReceived(earlyInt.toFixed(0));
    } else if (nextMode === "early_partial") {
      const half = new Decimal(deposit.currentPrincipalAmount)
        .div(2)
        .toDecimalPlaces(0);
      setPrincipalWithdrawn(half.toFixed(0));
      const earlyInt = calculateEarlyWithdrawalInterest({
        withdrawnPrincipalAmount: half,
        nonTermInterestRate: deposit.nonTermInterestRate,
        startDate: deposit.startDate,
        withdrawalDate: settlementDate,
      });
      setInterestReceived(earlyInt.toFixed(0));
    }
  };

  const handleChangeSettlementDate = (nextDate: string) => {
    setSettlementDate(nextDate);
    if (settlementType === "early_partial") {
      const earlyInt = calculateEarlyWithdrawalInterest({
        withdrawnPrincipalAmount: principalWithdrawn || "0",
        nonTermInterestRate: deposit.nonTermInterestRate,
        startDate: deposit.startDate,
        withdrawalDate: nextDate,
      });
      setInterestReceived(earlyInt.toFixed(0));
    } else if (settlementType === "early_full") {
      const earlyInt = calculateEarlyWithdrawalInterest({
        withdrawnPrincipalAmount: deposit.currentPrincipalAmount,
        nonTermInterestRate: deposit.nonTermInterestRate,
        startDate: deposit.startDate,
        withdrawalDate: nextDate,
      });
      setInterestReceived(earlyInt.toFixed(0));
    }
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await settleSavingsDepositAction({
        depositId: deposit.id,
        settlementType,
        settlementDate,
        destinationWalletId,
        principalWithdrawnAmount: principalWithdrawn,
        interestReceivedAmount: interestReceived || "0",
        rolloverMode,
        newTermMonths,
        newAnnualInterestRate: newAnnualRate,
        note,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Không thể xử lý sổ tiết kiệm.");
        return;
      }
      toast.success(res.message ?? "Đã xử lý sổ tiết kiệm thành công.");
      onSuccess();
    });
  }

  const totalToWallet =
    settlementType === "rollover"
      ? rolloverMode === "renew_principal"
        ? new Decimal(interestReceived || "0")
        : ZERO
      : (settlementType === "early_partial"
          ? new Decimal(principalWithdrawn || "0")
          : new Decimal(deposit.currentPrincipalAmount)
        ).plus(new Decimal(interestReceived || "0"));

  const nextRolloverPrincipal = new Decimal(
    deposit.currentPrincipalAmount,
  ).plus(new Decimal(interestReceived || "0"));

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange}>
      <SheetHeader
        icon={Check}
        title={`Tất toán / Rút tiền / Tái tục — ${deposit.bankName}`}
        description={`${deposit.name} · Gốc đang gửi: ${formatAmount(deposit.currentPrincipalAmount, currency)}`}
      />
      <form
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <SheetBody>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              {
                mode: "maturity" as const,
                title: "Tất toán đúng hạn",
                sub: "Nhận toàn bộ gốc + lãi",
              },
              {
                mode: "rollover" as const,
                title: "Tái tục kỳ hạn mới",
                sub: "Gửi tiếp kỳ hạn mới",
              },
              {
                mode: "early_partial" as const,
                title: "Rút gốc một phần",
                sub: "Phần còn lại giữ nguyên lãi",
              },
              {
                mode: "early_full" as const,
                title: "Rút toàn bộ trước hạn",
                sub: `Lãi không kỳ hạn ${deposit.nonTermInterestRate}%/năm`,
              },
            ].map((item) => {
              const active = settlementType === item.mode;
              return (
                <button
                  key={item.mode}
                  type="button"
                  onClick={() => handleSelectMode(item.mode)}
                  className={cn(
                    "rounded-xl border p-2.5 sm:p-3 text-left text-xs transition-colors cursor-pointer",
                    active
                      ? "border-[var(--primary)] bg-[var(--primary-soft)] font-semibold text-[var(--foreground)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--foreground)]",
                  )}
                >
                  <span className="block font-semibold text-[var(--foreground)]">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-normal text-[var(--text-muted)]">
                    {item.sub}
                  </span>
                </button>
              );
            })}
          </div>

          {settlementType === "early_partial" && (
            <div className="space-y-1.5">
              <MoneyInput
                label="Số tiền gốc muốn rút trước hạn"
                className="pr-11 text-sm"
                value={principalWithdrawn}
                onValueChange={(val) => {
                  setPrincipalWithdrawn(val);
                  const earlyInt = calculateEarlyWithdrawalInterest({
                    withdrawnPrincipalAmount: val || "0",
                    nonTermInterestRate: deposit.nonTermInterestRate,
                    startDate: deposit.startDate,
                    withdrawalDate: settlementDate,
                  });
                  setInterestReceived(earlyInt.toFixed(0));
                }}
              />
              <span className="block text-[11px] text-[var(--text-muted)]">
                Gốc còn lại tiếp tục hưởng lãi {deposit.annualInterestRate}
                %/năm:{" "}
                <strong className="text-[var(--foreground)] tabular-nums">
                  {formatAmount(
                    Decimal.max(
                      new Decimal(deposit.currentPrincipalAmount).minus(
                        new Decimal(principalWithdrawn || "0"),
                      ),
                      ZERO,
                    ).toFixed(0),
                    currency,
                  )}
                </strong>
              </span>
            </div>
          )}

          {settlementType === "rollover" && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 sm:p-3.5 space-y-2.5 sm:space-y-3">
              <Select
                label="Hình thức tái tục"
                value={rolloverMode}
                onValueChange={(val) =>
                  val && setRolloverMode(val as typeof rolloverMode)
                }
                className="text-sm whitespace-nowrap"
                options={[
                  {
                    value: "renew_principal_and_interest",
                    label: "Nhập lãi vào gốc để tái tục kỳ mới",
                  },
                  {
                    value: "renew_principal",
                    label: "Chỉ tái tục gốc, rút tiền lãi về ví",
                  },
                ]}
              />
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <Input
                  label="Kỳ hạn mới (Tháng)"
                  type="number"
                  min="1"
                  max="120"
                  className="text-sm"
                  value={newTermMonths}
                  onChange={(e) => setNewTermMonths(Number(e.target.value))}
                />
                <Input
                  label="Lãi suất mới (%/năm)"
                  type="number"
                  step="0.05"
                  className="text-sm"
                  value={newAnnualRate}
                  onChange={(e) => setNewAnnualRate(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <MoneyInput
              label="Tiền lãi thực nhận"
              className="pr-11 text-sm"
              value={interestReceived}
              onValueChange={setInterestReceived}
            />
            <DatePicker
              label="Ngày thực hiện"
              value={settlementDate}
              className="text-sm whitespace-nowrap"
              onValueChange={(val: string) =>
                val && handleChangeSettlementDate(val)
              }
            />
          </div>

          {(settlementType !== "rollover" ||
            rolloverMode === "renew_principal") && (
            <Select
              label="Ví tài sản nhận tiền"
              value={destinationWalletId}
              onValueChange={(val) => val && setDestinationWalletId(val)}
              className="text-sm whitespace-nowrap"
              options={wallets.map((w) => ({
                value: w.id,
                label: w.name,
                selectedContent: `Ví: ${w.name}`,
                content: (
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="font-medium text-[var(--foreground)]">
                      Ví: {w.name}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] tabular-nums">
                      {formatAmount(w.currentBalance, currency)}
                    </span>
                  </div>
                ),
              }))}
            />
          )}

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/45 p-3 sm:p-3.5 text-xs">
            {settlementType === "rollover" &&
            rolloverMode === "renew_principal_and_interest" ? (
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-[var(--text-secondary)]">
                  Gốc mới sau khi nhập lãi tái tục:
                </span>
                <strong className="text-sm font-bold text-[var(--primary)] tabular-nums whitespace-nowrap">
                  {formatAmount(nextRolloverPrincipal.toFixed(0), currency)}
                </strong>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-[var(--text-secondary)]">
                  Tổng tiền chuyển về ví:
                </span>
                <strong className="text-sm font-bold text-[var(--income)] tabular-nums whitespace-nowrap">
                  +{formatAmount(totalToWallet.toFixed(0), currency)}
                </strong>
              </div>
            )}
          </div>
        </SheetBody>
        <SheetFooter
          onCancel={() => onOpenChange(false)}
          cancelLabel="Hủy"
          submitLabel="Xác nhận thực hiện"
          isSubmitting={isPending}
          submittingLabel="Đang xử lý..."
        />
      </form>
    </ResponsiveSheet>
  );
}

function SavingsDepositDetailSheet({
  open,
  onOpenChange,
  deposit,
  currency,
  isPending,
  startTransition,
  onSettle,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deposit: SavingsDepositItem;
  currency: string;
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
  onSettle: () => void;
  onDeleted: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteSavingsDepositAction(deposit.id);
      if (!res.ok) {
        toast.error(res.error ?? "Không thể xóa sổ tiết kiệm.");
        return;
      }
      toast.success(res.message ?? "Đã xóa sổ tiết kiệm.");
      onDeleted();
    });
  }

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange}>
      <SheetHeader
        icon={Landmark}
        title={deposit.name}
        description={`${deposit.bankName} · Kỳ hạn ${deposit.termMonths} tháng (${deposit.annualInterestRate}%/năm)`}
      />
      <SheetBody>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/40 p-3.5 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)]">Gốc ban đầu:</span>
            <strong className="tabular-nums">
              {formatAmount(deposit.principalAmount, currency)}
            </strong>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)]">Gốc hiện tại:</span>
            <strong className="tabular-nums">
              {formatAmount(deposit.currentPrincipalAmount, currency)}
            </strong>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)]">
              Nguồn tiền mở sổ:
            </span>
            <span>
              {deposit.fundingMode === "from_wallet"
                ? `Trích từ ví ${deposit.sourceWalletName ?? ""}`
                : "Sổ đã có sẵn"}
            </span>
          </div>
          <div className="flex justify-between border-t border-[var(--border)]/60 pt-2">
            <span className="text-[var(--text-secondary)]">
              Tổng lãi đã thực nhận:
            </span>
            <strong className="text-[var(--income)] tabular-nums">
              +{formatAmount(deposit.totalInterestReceived, currency)}
            </strong>
          </div>
        </div>

        {deposit.settlements.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-[var(--text-secondary)]">
              Lịch sử Tất toán / Rút gốc / Tái tục ({deposit.settlements.length}
              )
            </h4>
            {deposit.settlements.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 p-3 space-y-1 text-xs"
              >
                <div className="flex justify-between font-semibold">
                  <span>
                    {s.settlementType === "rollover"
                      ? "Tái tục kỳ hạn mới"
                      : s.settlementType === "early_partial"
                        ? "Rút gốc một phần trước hạn"
                        : s.settlementType === "early_full"
                          ? "Tất toán trước hạn"
                          : "Tất toán đúng hạn"}{" "}
                    ({formatShortViDate(s.settlementDate)})
                  </span>
                  <span className="text-[var(--income)] tabular-nums">
                    {s.settlementType === "rollover" &&
                    Number(s.totalReceivedAmount) === 0
                      ? `Nhập lãi +${formatAmount(s.interestReceivedAmount, currency)}`
                      : `+${formatAmount(s.totalReceivedAmount, currency)}`}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-secondary)]">
                  Gốc rút: {formatAmount(s.principalWithdrawnAmount, currency)}{" "}
                  · Lãi: {formatAmount(s.interestReceivedAmount, currency)}
                  {s.destinationWalletName
                    ? ` · Về ví: ${s.destinationWalletName}`
                    : " · Nhập lãi vào gốc"}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-[var(--border)] pt-3">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--expense)] hover:underline cursor-pointer"
            >
              <Trash2 className="size-3.5" />
              <span>Xóa sổ tiết kiệm này</span>
            </button>
          ) : (
            <div className="rounded-xl border border-[var(--expense)]/35 bg-[var(--expense)]/8 p-3 space-y-2">
              <p className="text-xs font-medium text-[var(--foreground)]">
                Bạn chắc chắn muốn xóa sổ tiết kiệm này? Nếu sổ đang gửi và mở
                từ ví, tiền gốc sẽ được hoàn lại vào ví.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={isPending}
                  onClick={handleDelete}
                  className="h-8 text-xs"
                >
                  Xác nhận xóa
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDelete(false)}
                  className="h-8 text-xs"
                >
                  Giữ lại
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetBody>
      <SheetFooter
        onCancel={() => onOpenChange(false)}
        cancelLabel="Đóng"
        submitLabel={
          deposit.status === "active"
            ? "Tất toán / Rút gốc / Tái tục"
            : undefined
        }
        submitType="button"
        onSubmit={deposit.status === "active" ? onSettle : undefined}
      />
    </ResponsiveSheet>
  );
}
