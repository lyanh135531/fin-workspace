"use client";

import Decimal from "decimal.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useId,
  useMemo,
  useState,
  useTransition,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import {
  activateFinancialPlanAction,
  cancelFinancialPlanAction,
  completeFinancialPlanAction,
  createAndActivateFinancialPlanAction,
  createFinancialPlanWithGoalsAction,
  deleteFinancialPlanAction,
  updateFinancialPlanAllocationsAction,
  updateFinancialPlanDeadlineAction,
  updateFinancialPlanDraftAction,
} from "@/app/dashboard/financial-plans/actions";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  Input,
  MoneyInput,
  MonthPicker,
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
import { ConfirmDelete } from "@/components/base/confirm-delete";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SpotlightTrigger } from "@/components/ui/spotlight-trigger";
import { usePrivacyMask } from "@/lib/privacy-mask";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FinancialPlanGoals,
  type FinancialGoalView,
} from "@/app/dashboard/financial-plans/financial-plan-goals";
import {
  FINANCIAL_JAR_CODES,
  FINANCIAL_JAR_LABELS,
  type FinancialJarCode,
} from "@/domain";
import { formatAmount, formatCompactAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDownLeft,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Compass,
  CreditCard,
  HelpCircle,
  History,
  Layers,
  Minus,
  Pencil,
  PieChart,
  Plus,
  ReceiptText,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";

export type DeviceTier = "mobile" | "tablet" | "desktop";

function subscribeDeviceTier(callback: () => void) {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return () => {};
  }
  const mdQuery = window.matchMedia("(min-width: 768px)");
  const lgQuery = window.matchMedia("(min-width: 1024px)");
  mdQuery.addEventListener("change", callback);
  lgQuery.addEventListener("change", callback);
  return () => {
    mdQuery.removeEventListener("change", callback);
    lgQuery.removeEventListener("change", callback);
  };
}

function getDeviceTierSnapshot(): DeviceTier {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return "desktop";
  }
  if (window.matchMedia("(min-width: 1024px)").matches) {
    return "desktop";
  }
  if (window.matchMedia("(min-width: 768px)").matches) {
    return "tablet";
  }
  return "mobile";
}

function getServerDeviceTierSnapshot(): DeviceTier {
  return "mobile";
}

function getPlanSheetPresentation(
  device: DeviceTier,
  variant: "compact" | "form" | "detail",
): {
  side: "bottom" | "center" | "right";
  placement: "edge" | "inset";
  size: "default" | "md" | "wide";
  className: string;
} {
  if (device === "mobile") {
    return {
      side: "bottom",
      placement: "edge",
      size: variant === "compact" ? "default" : "wide",
      className: variant === "compact" ? "max-h-[78dvh]" : "max-h-[85dvh]",
    };
  }
  if (device === "tablet") {
    return {
      side: "center",
      placement: "inset",
      size: variant === "compact" ? "md" : "wide",
      className:
        variant === "compact"
          ? "w-[calc(100%-2.5rem)] max-w-[30rem] max-h-[82dvh]"
          : variant === "form"
            ? "w-[calc(100%-2.5rem)] max-w-[36rem] max-h-[85dvh]"
            : "w-[calc(100%-2.5rem)] max-w-[40rem] max-h-[86dvh]",
    };
  }
  return {
    side: "right",
    placement: "inset",
    size: variant === "compact" ? "md" : "wide",
    className:
      variant === "compact"
        ? "lg:max-w-[28rem]"
        : variant === "form"
          ? "lg:max-w-[34rem]"
          : "lg:max-w-[38rem]",
  };
}

type PlanListItem = {
  id: string;
  name: string;
  status: "draft" | "active" | "completed" | "cancelled";
  targetAmount: string;
  existingGoalAmount: string;
  startMonth: string | null;
  targetMonth: string;
};

type PlanMonthJar = {
  jarCode: FinancialJarCode;
  percentage: string;
  allocatedAmount: string;
  closedActualAmount?: string;
  expenseAmount?: string;
  remainingAmount?: string;
  overspendAmount?: string;
};

type PlanMonth = {
  month: string;
  closed: boolean;
  baseRequiredAmount: string;
  adjustedRequiredAmount: string;
  rawGrossBudget: string;
  allocatableGrossBudget: string;
  resourceShortfall: string;
  availableToSpend: string;
  closedActualGoalAmount?: string;
  adjustedActualGoalAmount?: string;
  adjustedDelta?: string;
  eligibleExpense?: string;
  totalRemaining?: string;
  totalOverspend?: string;
  projectedActualGoalAmount?: string;
  pendingIncome?: string;
  pendingExpense?: string;
  jars: PlanMonthJar[];
};

type DraftView = {
  id: string;
  name: string;
  status: "draft";
  targetAmount: string;
  existingGoalAmount: string;
  startMonth: null;
  targetMonth: string;
  percentages: Record<FinancialJarCode, string>;
  canManage: boolean;
  financialGoals?: FinancialGoalView[];
};

type RunningView = {
  id: string;
  name: string;
  status: "active" | "completed" | "cancelled";
  health:
    | "ahead"
    | "on_track"
    | "behind"
    | "at_risk"
    | "goal_reached"
    | "overdue";
  targetAmount: string;
  existingGoalAmount: string;
  startMonth: string;
  targetMonth: string;
  realizedProgress: string;
  closedSnapshotProgress: string;
  adjustedActualProgress: string;
  projectedEndOfCurrentMonthProgress: string;
  projectedEndOfPlanProgress: string;
  realizedProgressPercentage: string;
  projectedCurrentProgressPercentage: string;
  businessMonth: string;
  canComplete: boolean;
  months: PlanMonth[];
  canManage: boolean;
};

export type JarCategoryItem = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  jarCode: FinancialJarCode;
};

export type JarTransactionItem = {
  id: string;
  jarCode: FinancialJarCode;
  month: string;
  date: string;
  amount: string;
  description: string | null;
  workflowStatus: "pending" | "scheduled" | "approved" | "rejected";
  walletName: string;
  walletKind?: "asset" | "credit_card";
  isInstallment?: boolean;
  memberName: string;
  categoryId: string | null;
  categoryName: string;
  categoryColor: string | null;
};

export type PlanWalletSummary = {
  totalAssetBalance: string;
  totalCreditCardDebt: string;
  assetWalletCount: number;
  creditCardCount: number;
};

type SelectedPlan = DraftView | RunningView | null;
type RatioDraft = Record<FinancialJarCode, string>;
type EditorDraft = {
  name: string;
  targetAmount: string;
  existingGoalAmount: string;
  targetMonth: string;
  percentages: RatioDraft;
};

const DEFAULT_RATIOS: RatioDraft = {
  ESSENTIAL: "55",
  RESPONSIBILITY: "10",
  DEVELOPMENT: "10",
  ENJOYMENT: "10",
  INVESTMENT: "10",
  GIVING: "5",
};

const RATIO_PRESETS: Array<{
  id: string;
  label: string;
  shortLabel: string;
  formula: string;
  ratios: RatioDraft;
}> = [
  {
    id: "standard",
    label: "Chuẩn 6 Hũ (55/10/10/10/10/5)",
    shortLabel: "Chuẩn 6 Hũ",
    formula: "55·10·10·10·10·5",
    ratios: { ...DEFAULT_RATIOS },
  },
  {
    id: "wealth",
    label: "Tích sản nhanh (50/10/10/5/20/5)",
    shortLabel: "Tích sản",
    formula: "50·10·10·5·20·5",
    ratios: {
      ESSENTIAL: "50",
      RESPONSIBILITY: "10",
      DEVELOPMENT: "10",
      ENJOYMENT: "5",
      INVESTMENT: "20",
      GIVING: "5",
    },
  },
  {
    id: "family",
    label: "Gia đình (60/15/10/5/5/5)",
    shortLabel: "Gia đình",
    formula: "60·15·10·5·5·5",
    ratios: {
      ESSENTIAL: "60",
      RESPONSIBILITY: "15",
      DEVELOPMENT: "10",
      ENJOYMENT: "5",
      INVESTMENT: "5",
      GIVING: "5",
    },
  },
];

const JAR_DESCRIPTIONS: Record<FinancialJarCode, string> = {
  ESSENTIAL: "Ăn uống, nhà ở, đi lại và sinh hoạt hàng ngày",
  RESPONSIBILITY: "Gia đình, bảo hiểm và nghĩa vụ tài chính",
  DEVELOPMENT: "Học tập, sách vở và nâng cao kỹ năng",
  ENJOYMENT: "Giải trí, thư giãn và chăm sóc bản thân",
  INVESTMENT: "Đầu tư tích sản và sinh lời dài hạn",
  GIVING: "Quà tặng, hiếu hỉ và chia sẻ cộng đồng",
};

const JAR_SHORT_DESCRIPTIONS: Record<FinancialJarCode, string> = {
  ESSENTIAL: "Sinh hoạt & nhà ở",
  RESPONSIBILITY: "Gia đình & bảo hiểm",
  DEVELOPMENT: "Học tập & kỹ năng",
  ENJOYMENT: "Giải trí & bản thân",
  INVESTMENT: "Đầu tư & tích sản",
  GIVING: "Quà tặng & sẻ chia",
};

const STATUS_LABELS = {
  draft: "Bản nháp",
  active: "Đang chạy",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
} as const;

const STATUS_ICONS = {
  draft: Pencil,
  active: TrendingUp,
  completed: CheckCircle2,
  cancelled: CircleX,
} as const;

const HEALTH_LABELS = {
  ahead: "Vượt tiến độ",
  on_track: "Đúng tiến độ",
  behind: "Chậm tiến độ",
  at_risk: "Cần chú ý",
  goal_reached: "Đã đạt mục tiêu",
  overdue: "Quá hạn",
} as const;

function monthLabel(month: string) {
  const [year, value] = month.split("-");
  return `Tháng ${Number(value)}/${year}`;
}

function shortMonthLabel(month: string) {
  const [year, value] = month.split("-");
  return `T${Number(value)}/${year}`;
}

function nextMonth(month: string) {
  const [year, m] = month.split("-").map(Number);
  return m === 12
    ? `${year + 1}-01`
    : `${year}-${String(m + 1).padStart(2, "0")}`;
}

function monthCountInclusive(startMonth: string, endMonth: string) {
  const [startYear, startValue] = startMonth.split("-").map(Number);
  const [endYear, endValue] = endMonth.split("-").map(Number);
  return Math.max((endYear - startYear) * 12 + endValue - startValue + 1, 1);
}

function getRemainingDaysInMonth(month: string, businessDate?: string) {
  const [year, m] = month.split("-").map(Number);
  const totalDays = new Date(Date.UTC(year, m, 0)).getUTCDate();
  if (!businessDate) return totalDays;
  const businessMonth = businessDate.slice(0, 7);
  if (month < businessMonth) return 0;
  if (month > businessMonth) return totalDays;
  const currentDay = Number(businessDate.slice(8, 10)) || 1;
  return Math.max(totalDays - currentDay + 1, 1);
}

function formatViDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function money(value: string, currency: string) {
  return `${formatAmount(value)} ${currency === "VND" ? "₫" : currency}`;
}

function compactMoney(value: string, currency: string) {
  return `${formatCompactAmount(value)} ${currency === "VND" ? "₫" : currency}`;
}

function ratioTotal(ratios: RatioDraft) {
  return FINANCIAL_JAR_CODES.reduce((sum, jarCode) => {
    try {
      return sum.plus(ratios[jarCode] || 0);
    } catch {
      return sum;
    }
  }, new Decimal(0));
}

function ratiosFromMonth(month?: PlanMonth): RatioDraft {
  if (!month) return { ...DEFAULT_RATIOS };
  return Object.fromEntries(
    FINANCIAL_JAR_CODES.map((jarCode) => [
      jarCode,
      month.jars.find((jar) => jar.jarCode === jarCode)?.percentage ??
        DEFAULT_RATIOS[jarCode],
    ]),
  ) as RatioDraft;
}

function progressWidth(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(parsed, 0), 100);
}

function progressTone(percentage: number) {
  if (percentage >= 90) return "critical";
  if (percentage >= 70) return "warning";
  return "safe";
}

const PROGRESS_BAR_TONES = {
  safe: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  critical: "bg-[var(--destructive)]",
} as const;

const PROGRESS_TEXT_TONES = {
  safe: "text-[var(--success)]",
  warning: "text-[var(--warning)]",
  critical: "text-[var(--destructive)]",
} as const;

const JAR_COLORS: Record<FinancialJarCode, string> = {
  ESSENTIAL: "var(--primary)",
  RESPONSIBILITY: "var(--warning)",
  DEVELOPMENT: "var(--success)",
  ENJOYMENT: "color-mix(in srgb, var(--destructive) 72%, var(--primary))",
  INVESTMENT: "var(--info)",
  GIVING: "color-mix(in srgb, var(--primary) 58%, var(--text-secondary))",
};

function jarUsagePercentage(jar: PlanMonthJar) {
  try {
    const allocated = new Decimal(jar.allocatedAmount);
    const spent = new Decimal(
      jar.expenseAmount ?? jar.closedActualAmount ?? "0",
    );
    if (allocated.lessThanOrEqualTo(0)) return spent.greaterThan(0) ? 100 : 0;
    return progressWidth(spent.dividedBy(allocated).times(100).toString());
  } catch {
    return 0;
  }
}

export function FinancialPlansManager({
  workspaceName,
  currency,
  businessDate,
  businessMonth,
  canManage,
  plans,
  selectedPlan,
  financialGoals,
  goalWallets,
  walletSummary,
  jarCategories = [],
  jarTransactions = [],
}: {
  workspaceName: string;
  currency: string;
  businessDate?: string;
  businessMonth: string;
  canManage: boolean;
  plans: PlanListItem[];
  selectedPlan: SelectedPlan;
  financialGoals: FinancialGoalView[];
  goalWallets: Array<{ id: string; name: string; balance: string }>;
  walletSummary?: PlanWalletSummary;
  jarCategories?: JarCategoryItem[];
  jarTransactions?: JarTransactionItem[];
}) {
  usePrivacyMask();
  const router = useRouter();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("edit");
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [allocationOpen, setAllocationOpen] = useState(false);
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<PlanListItem | null>(
    null,
  );
  const device = useSyncExternalStore(
    subscribeDeviceTier,
    getDeviceTierSnapshot,
    getServerDeviceTierSnapshot,
  );
  const planPickerSheetProps = getPlanSheetPresentation(
    device,
    device === "tablet" ? "form" : "compact",
  );
  const [isPending, startTransition] = useTransition();

  function runAction(
    action: () => Promise<{ ok: boolean; message?: string | null }>,
    success: string,
    after?: () => void,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.message || "Không thể thực hiện thao tác.");
        return;
      }
      toast.success(success);
      after?.();
      router.refresh();
    });
  }

  const activeExists = plans.some((plan) => plan.status === "active");
  const running =
    selectedPlan && selectedPlan.status !== "draft" ? selectedPlan : null;
  const currentPlanMonth =
    running?.months.find(
      (month) => month.month === running.businessMonth && !month.closed,
    ) ??
    running?.months.find((month) => !month.closed) ??
    running?.months.at(-1);
  const nextAllocationMonth =
    running?.months.find(
      (month) => month.month === nextMonth(running.businessMonth),
    ) ?? currentPlanMonth;

  return (
    <div className="grid gap-4">
      {/* Plan Switcher Sheet */}
      {plans.length > 0 && (
        <>
          <Sheet open={planPickerOpen} onOpenChange={setPlanPickerOpen}>
            <SheetContent
              side={planPickerSheetProps.side}
              placement={planPickerSheetProps.placement}
              size={planPickerSheetProps.size}
              className={planPickerSheetProps.className}
              spacing="flush"
              elevation="flat"
            >
              <SheetHeader
                icon={CalendarRange}
                title="Danh sách kế hoạch"
                description={`Quản lý ${plans.length} kế hoạch tài chính của ${workspaceName}.`}
              />
              <nav
                aria-label="Danh sách kế hoạch"
                className={cn(
                  "grid min-h-0 flex-1 content-start overflow-y-auto",
                  device === "mobile"
                    ? "grid-cols-1 gap-2 px-4 py-3.5"
                    : device === "tablet"
                      ? cn(
                          "gap-2.5 px-5 py-4",
                          plans.length >= 4 ? "grid-cols-2" : "grid-cols-1",
                        )
                      : "grid-cols-1 gap-2.5 px-6 py-5",
                )}
              >
                {plans.map((plan) => {
                  const StatusIcon = STATUS_ICONS[plan.status];
                  const selected = selectedPlan?.id === plan.id;
                  return (
                    <Card
                      key={plan.id}
                      size="sm"
                      tone={selected ? "primarySoft" : "default"}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Button
                          size="auto"
                          variant="ghost"
                          className="min-w-0 flex-1 justify-start gap-3 whitespace-normal px-2 py-1.5 text-left"
                          render={
                            <Link href={`/financial-plans?plan=${plan.id}`} />
                          }
                          onClick={() => setPlanPickerOpen(false)}
                          aria-current={selected ? "page" : undefined}
                        >
                          <StatusIcon
                            className="size-4 shrink-0 text-[var(--primary)]"
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block break-words font-semibold leading-snug text-[var(--foreground)]">
                              {plan.name}
                            </span>
                            <span className="mt-0.5 block break-words text-xs font-normal leading-snug text-[var(--text-muted)]">
                              {STATUS_LABELS[plan.status]} · Hạn{" "}
                              {monthLabel(plan.targetMonth)} ·{" "}
                              {money(plan.targetAmount, currency)}
                            </span>
                          </span>
                        </Button>
                        {canManage && plan.status !== "active" ? (
                          <Button
                            variant="destructiveIcon"
                            size="icon"
                            aria-label={`Xóa kế hoạch ${plan.name}`}
                            title="Xóa kế hoạch"
                            disabled={isPending}
                            onClick={() => {
                              setPlanPickerOpen(false);
                              setDeleteCandidate(plan);
                            }}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        ) : selected ? (
                          <span className="grid size-8 shrink-0 place-items-center text-[var(--primary)]">
                            <CheckCircle2
                              className="size-4"
                              aria-hidden="true"
                            />
                          </span>
                        ) : null}
                      </div>
                    </Card>
                  );
                })}
              </nav>
              <SheetFooter
                onCancel={() => setPlanPickerOpen(false)}
                cancelLabel="Đóng"
                submitLabel={
                  canManage && !activeExists ? "Tạo kế hoạch mới" : undefined
                }
                onSubmit={
                  canManage && !activeExists
                    ? () => {
                        setPlanPickerOpen(false);
                        setEditorMode("create");
                        setEditorOpen(true);
                      }
                    : undefined
                }
                submitType="button"
              />
            </SheetContent>
          </Sheet>

          <ConfirmDelete
            open={deleteCandidate !== null}
            onOpenChange={(open) => {
              if (!open) setDeleteCandidate(null);
            }}
            trigger={null}
            presentation="sheet"
            ariaLabel={
              deleteCandidate
                ? `Xóa kế hoạch ${deleteCandidate.name}`
                : "Xóa kế hoạch"
            }
            title="Xóa kế hoạch?"
            description="Kế hoạch sẽ bị xóa khỏi danh sách. Số liệu các tháng đã chốt vẫn được giữ nguyên."
            confirmLabel="Xóa kế hoạch"
            confirmDisabled={isPending}
            onConfirm={() => {
              if (!deleteCandidate) return false;
              const deletingSelected = selectedPlan?.id === deleteCandidate.id;
              runAction(
                () => deleteFinancialPlanAction(deleteCandidate.id),
                "Đã xóa kế hoạch.",
                () => {
                  setDeleteCandidate(null);
                  if (deletingSelected) router.replace("/financial-plans");
                },
              );
            }}
          />
        </>
      )}

      {/* Main Content Area */}
      <section className="min-w-0" aria-label="Chi tiết kế hoạch">
        {!selectedPlan ? (
          <Card>
            <Empty
              icon={Target}
              title="Chưa có kế hoạch tài chính"
              description={
                canManage
                  ? "Đặt mục tiêu tiết kiệm và tỷ lệ 6 hũ để tự động tính ngân sách chi tiêu mỗi tháng."
                  : "Quản trị viên chưa thiết lập kế hoạch tài chính cho nhóm này."
              }
              action={
                canManage || plans.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {plans.length > 0 && (
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setPlanPickerOpen(true)}
                      >
                        <CalendarRange aria-hidden="true" />
                        <span>Danh sách kế hoạch ({plans.length})</span>
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        size="lg"
                        onClick={() => {
                          setEditorMode("create");
                          setEditorOpen(true);
                        }}
                      >
                        <Plus aria-hidden="true" />
                        <span>Tạo kế hoạch đầu tiên</span>
                      </Button>
                    )}
                  </div>
                ) : undefined
              }
            />
          </Card>
        ) : selectedPlan.status === "draft" ? (
          <div className="grid gap-4">
            <DraftReview
              plan={selectedPlan}
              plans={plans}
              currency={currency}
              device={device}
              disabled={isPending}
              onEdit={() => {
                setEditorMode("edit");
                setEditorOpen(true);
              }}
              onOpenPlanPicker={() => setPlanPickerOpen(true)}
              onActivate={() =>
                runAction(
                  () => activateFinancialPlanAction(selectedPlan.id),
                  "Đã kích hoạt kế hoạch.",
                )
              }
              onDelete={() =>
                runAction(
                  () => deleteFinancialPlanAction(selectedPlan.id),
                  "Đã xóa kế hoạch.",
                  () => router.replace("/financial-plans"),
                )
              }
            />
            <FinancialPlanGoals
              planId={selectedPlan.id}
              planStatus={selectedPlan.status}
              goals={financialGoals}
              wallets={goalWallets}
              currency={currency}
              businessMonth={businessMonth}
              canManage={canManage}
            />
          </div>
        ) : (
          <PlanDetail
            key={selectedPlan.id}
            plan={selectedPlan}
            plans={plans}
            currency={currency}
            businessDate={businessDate}
            businessMonth={businessMonth}
            canManage={canManage}
            activeExists={activeExists}
            financialGoals={financialGoals}
            goalWallets={goalWallets}
            walletSummary={walletSummary}
            jarCategories={jarCategories}
            jarTransactions={jarTransactions}
            currentMonth={currentPlanMonth}
            device={device}
            disabled={isPending}
            onCreatePlan={() => {
              setEditorMode("create");
              setEditorOpen(true);
            }}
            onEditDeadline={() => setDeadlineOpen(true)}
            onEditAllocation={() => setAllocationOpen(true)}
            onOpenPlanPicker={() => setPlanPickerOpen(true)}
            onCancel={() =>
              runAction(
                () => cancelFinancialPlanAction(selectedPlan.id),
                "Đã hủy kế hoạch.",
              )
            }
            onComplete={() =>
              runAction(
                () => completeFinancialPlanAction(selectedPlan.id),
                "Đã hoàn thành kế hoạch.",
              )
            }
            onDelete={() =>
              runAction(
                () => deleteFinancialPlanAction(selectedPlan.id),
                "Đã xóa kế hoạch.",
                () => router.replace("/financial-plans"),
              )
            }
            onDeleteOtherPlan={(planItem) => setDeleteCandidate(planItem)}
          />
        )}
      </section>

      {canManage && editorOpen && (
        <PlanEditorSheet
          open={editorOpen}
          onOpenChange={setEditorOpen}
          businessMonth={businessMonth}
          plan={
            editorMode === "edit" && selectedPlan?.status === "draft"
              ? { ...selectedPlan, financialGoals }
              : null
          }
          canAutoActivate={!activeExists}
          hasMultipleGoals={
            editorMode === "edit" &&
            selectedPlan?.status === "draft" &&
            financialGoals.length > 1
          }
          device={device}
          disabled={isPending}
          onSaved={(id) => {
            setEditorOpen(false);
            router.replace(`/financial-plans?plan=${id}`);
            router.refresh();
          }}
        />
      )}

      {running?.status === "active" && running.canManage && (
        <>
          {deadlineOpen && (
            <DeadlineSheet
              open={deadlineOpen}
              onOpenChange={setDeadlineOpen}
              plan={running}
              currency={currency}
              device={device}
              disabled={isPending}
              onSave={(targetMonth) =>
                runAction(
                  () =>
                    updateFinancialPlanDeadlineAction({
                      planId: running.id,
                      targetMonth,
                    }),
                  "Đã cập nhật hạn hoàn thành.",
                  () => setDeadlineOpen(false),
                )
              }
            />
          )}
          {allocationOpen && (
            <AllocationSheet
              open={allocationOpen}
              onOpenChange={setAllocationOpen}
              initialRatios={ratiosFromMonth(nextAllocationMonth)}
              referenceBudget={currentPlanMonth?.allocatableGrossBudget}
              currency={currency}
              device={device}
              disabled={isPending}
              onSave={(percentages) =>
                runAction(
                  () =>
                    updateFinancialPlanAllocationsAction({
                      planId: running.id,
                      percentages,
                    }),
                  "Tỷ lệ 6 hũ mới sẽ áp dụng từ tháng sau.",
                  () => setAllocationOpen(false),
                )
              }
            />
          )}
        </>
      )}
    </div>
  );
}

function DraftReview({
  plan,
  plans,
  currency,
  device,
  disabled,
  onEdit,
  onOpenPlanPicker,
  onActivate,
  onDelete,
}: {
  plan: DraftView;
  plans: PlanListItem[];
  currency: string;
  device: DeviceTier;
  disabled: boolean;
  onEdit: () => void;
  onOpenPlanPicker: () => void;
  onActivate: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draftMenuOpen, setDraftMenuOpen] = useState(false);

  function handleDraftMenuOpenChange(nextOpen: boolean) {
    if (nextOpen && device === "desktop") {
      return;
    }
    setDraftMenuOpen(nextOpen);
  }

  const draftHeaderContent = (
    <div className="grid gap-2.5 border-b border-[var(--border)] pb-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--warning)_15%,var(--surface))] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--warning)] sm:text-xs">
            <Pencil className="size-3" aria-hidden="true" />
            <span>Bản nháp</span>
          </span>
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface)]/80 px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] tabular-nums">
            Hạn {shortMonthLabel(plan.targetMonth)}
          </span>
        </div>

        <div
          className="flex shrink-0 items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {plan.canManage && (
            <Button
              variant="default"
              size="sm"
              onClick={onActivate}
              disabled={disabled}
              aria-label="Kích hoạt kế hoạch"
              title="Kích hoạt kế hoạch"
              className="h-7 px-2.5 text-xs sm:h-8"
            >
              <CheckCircle2 size={14} aria-hidden="true" />
              <span>Kích hoạt</span>
            </Button>
          )}
          <div className="flex items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-0.5">
            {plans.length > 1 && (
              <Button
                variant="icon"
                size="icon"
                onClick={onOpenPlanPicker}
                disabled={disabled}
                aria-label={`Đổi kế hoạch (${plans.length})`}
                title={`Đổi kế hoạch (${plans.length})`}
                className="size-7 sm:size-8"
              >
                <CalendarRange size={14} aria-hidden="true" />
              </Button>
            )}
            {plan.canManage && (
              <>
                <Button
                  variant="icon"
                  size="icon"
                  onClick={onEdit}
                  disabled={disabled}
                  aria-label="Chỉnh sửa bản nháp"
                  title="Chỉnh sửa bản nháp"
                  className="size-7 sm:size-8"
                >
                  <Pencil size={14} aria-hidden="true" />
                </Button>
                <Button
                  variant="destructiveIcon"
                  size="icon"
                  onClick={() => setConfirmDelete(true)}
                  disabled={disabled}
                  aria-label="Xóa bản nháp"
                  title="Xóa bản nháp"
                  className="size-7 sm:size-8"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <h2 className="break-words text-base font-bold leading-snug tracking-tight text-[var(--foreground)] sm:text-lg md:text-xl">
          {plan.name}
        </h2>
        <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-secondary)]">
          Kiểm tra mục tiêu và tỷ lệ phân bổ 6 hũ trước khi kích hoạt.
        </p>
      </div>
    </div>
  );

  return (
    <Card tone="primarySoft">
      {plan.canManage ? (
        <DropdownMenu
          open={draftMenuOpen}
          onOpenChange={handleDraftMenuOpenChange}
        >
          <SpotlightTrigger
            open={draftMenuOpen}
            onOpenChange={handleDraftMenuOpenChange}
            mobileOnly
            dismissLabel={`Đóng menu thao tác bản nháp ${plan.name}`}
            render={
              <div
                role="button"
                tabIndex={0}
                aria-label={`Bản nháp ${plan.name}. Chạm để mở menu thao tác.`}
                className="cursor-pointer select-none rounded-xl text-left transition-all duration-150 active:scale-[0.99] lg:cursor-default lg:select-auto lg:active:scale-100"
              />
            }
          >
            {(spotlightTrigger) => (
              <DropdownMenuTrigger
                nativeButton={false}
                render={spotlightTrigger}
              >
                {draftHeaderContent}
              </DropdownMenuTrigger>
            )}
          </SpotlightTrigger>

          <DropdownMenuContent
            align="center"
            side="bottom"
            sideOffset={6}
            className="w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 lg:hidden"
          >
            <DropdownMenuItem
              disabled={disabled}
              onClick={() => {
                setDraftMenuOpen(false);
                onActivate();
              }}
            >
              <CheckCircle2
                className="size-4 text-[var(--primary)]"
                aria-hidden="true"
              />
              <span>Kích hoạt kế hoạch</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={disabled}
              onClick={() => {
                setDraftMenuOpen(false);
                onEdit();
              }}
            >
              <Pencil
                className="size-4 text-[var(--text-secondary)]"
                aria-hidden="true"
              />
              <span>Chỉnh sửa bản nháp</span>
            </DropdownMenuItem>
            {plans.length > 1 && (
              <DropdownMenuItem
                disabled={disabled}
                onClick={() => {
                  setDraftMenuOpen(false);
                  onOpenPlanPicker();
                }}
              >
                <CalendarRange
                  className="size-4 text-[var(--text-secondary)]"
                  aria-hidden="true"
                />
                <span>Đổi kế hoạch ({plans.length})</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={disabled}
              onClick={() => {
                setDraftMenuOpen(false);
                setConfirmDelete(true);
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              <span>Xóa bản nháp</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        draftHeaderContent
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="break-words text-xs font-medium leading-snug text-[var(--text-secondary)]">
            Tổng mục tiêu tích lũy
          </p>
          <p className="mt-1 text-base font-bold tracking-tight text-[var(--foreground)] tabular-nums shrink-0 md:text-lg">
            {money(plan.targetAmount, currency)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="break-words text-xs font-medium leading-snug text-[var(--text-secondary)]">
            Số tiền đã có sẵn
          </p>
          <p className="mt-1 text-base font-bold tracking-tight text-[var(--foreground)] tabular-nums shrink-0 md:text-lg">
            {money(plan.existingGoalAmount, currency)}
          </p>
        </div>
        <div className="col-span-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:col-span-1">
          <p className="break-words text-xs font-medium leading-snug text-[var(--text-secondary)]">
            Tháng hoàn thành dự kiến
          </p>
          <p className="mt-1 text-base font-bold tracking-tight text-[var(--foreground)] shrink-0 md:text-lg">
            {monthLabel(plan.targetMonth)}
          </p>
        </div>
      </div>

      {/* 6 Jars Ratio Preview */}
      <div className="space-y-3 border-t border-[var(--border)] pt-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-[var(--foreground)]">
            Tỷ lệ 6 hũ chi tiêu
          </p>
          <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
            Tổng 100% ngân sách tháng
          </span>
        </div>

        <div
          className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-[var(--surface-secondary)]"
          aria-hidden="true"
        >
          {FINANCIAL_JAR_CODES.map((jarCode) => {
            const pct = Number(plan.percentages[jarCode] || 0);
            return (
              <div
                key={jarCode}
                className="transition-all duration-300 first:rounded-l-full last:rounded-r-full"
                style={{
                  flex: pct,
                  backgroundColor:
                    pct > 0 ? JAR_COLORS[jarCode] : "transparent",
                }}
              />
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
          {FINANCIAL_JAR_CODES.map((jarCode) => (
            <div
              key={jarCode}
              className="flex items-start justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            >
              <div className="flex min-w-0 items-start gap-2">
                <span
                  className="mt-1.5 size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: JAR_COLORS[jarCode] }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="break-words text-xs font-semibold leading-snug text-[var(--foreground)] md:text-sm">
                    {FINANCIAL_JAR_LABELS[jarCode]}
                  </p>
                  <p className="mt-0.5 hidden break-words text-[11px] leading-snug text-[var(--text-muted)] md:block">
                    {JAR_DESCRIPTIONS[jarCode]}
                  </p>
                </div>
              </div>
              <span className="rounded-md bg-[var(--surface-secondary)] px-1.5 py-0.5 text-xs font-bold text-[var(--foreground)] tabular-nums shrink-0">
                {plan.percentages[jarCode]}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDelete
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        trigger={null}
        ariaLabel="Xóa bản nháp"
        title="Xóa bản nháp kế hoạch?"
        description="Bản nháp kế hoạch sẽ bị xóa khỏi danh sách."
        confirmLabel="Xóa bản nháp"
        presentation="sheet"
        onConfirm={onDelete}
        disabled={disabled}
      />
    </Card>
  );
}

function PlanDetail({
  plan,
  plans,
  currency,
  businessDate,
  businessMonth,
  canManage,
  activeExists,
  financialGoals,
  goalWallets,
  walletSummary,
  jarCategories,
  jarTransactions,
  currentMonth,
  device,
  disabled,
  onCreatePlan,
  onEditDeadline,
  onEditAllocation,
  onOpenPlanPicker,
  onCancel,
  onComplete,
  onDelete,
  onDeleteOtherPlan,
}: {
  plan: RunningView;
  plans: PlanListItem[];
  currency: string;
  businessDate?: string;
  businessMonth: string;
  canManage: boolean;
  activeExists: boolean;
  financialGoals: FinancialGoalView[];
  goalWallets: Array<{ id: string; name: string; balance: string }>;
  walletSummary?: PlanWalletSummary;
  jarCategories: JarCategoryItem[];
  jarTransactions: JarTransactionItem[];
  currentMonth?: PlanMonth;
  device: DeviceTier;
  disabled: boolean;
  onCreatePlan: () => void;
  onEditDeadline: () => void;
  onEditAllocation: () => void;
  onOpenPlanPicker: () => void;
  onCancel: () => void;
  onComplete: () => void;
  onDelete?: () => void;
  onDeleteOtherPlan?: (plan: PlanListItem) => void;
}) {
  const [activeTab, setActiveTab] = useState<"jars" | "goals" | "details">(
    "jars",
  );
  const [selectedJarMonthKey, setSelectedJarMonthKey] = useState<string>(
    currentMonth?.month ?? plan.months.at(-1)?.month ?? plan.businessMonth,
  );
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const activeJarMonth =
    plan.months.find((m) => m.month === selectedJarMonthKey) ??
    currentMonth ??
    plan.months.at(-1);

  const shortfall = currentMonth?.resourceShortfall ?? "0";
  const hasShortfall = new Decimal(shortfall).greaterThan(0);

  const requiredSavingsThisMonth = new Decimal(
    currentMonth?.adjustedRequiredAmount ?? "0",
  );
  const monthlyBudget = Decimal.max(
    0,
    currentMonth?.allocatableGrossBudget ?? "0",
  );
  const estimatedIncome = Decimal.max(
    0,
    new Decimal(currentMonth?.rawGrossBudget ?? "0").plus(
      requiredSavingsThisMonth,
    ),
  );
  const spentThisMonth = new Decimal(
    currentMonth?.eligibleExpense ??
      (currentMonth?.jars
        .reduce(
          (total, jar) =>
            total.plus(jar.expenseAmount ?? jar.closedActualAmount ?? "0"),
          new Decimal(0),
        )
        .toString() ??
        "0"),
  );
  const availableToSpend = new Decimal(currentMonth?.availableToSpend ?? "0");
  const monthlyUsage = monthlyBudget.isZero()
    ? spentThisMonth.gt(0)
      ? new Decimal(100)
      : new Decimal(0)
    : spentThisMonth.dividedBy(monthlyBudget).times(100);
  const monthlyUsageWidth = progressWidth(monthlyUsage.toString());
  const monthlyUsageTone = progressTone(monthlyUsageWidth);

  const remainingDaysThisMonth = getRemainingDaysInMonth(
    currentMonth?.month ?? plan.businessMonth,
    businessDate,
  );
  const safeDailyOverall =
    remainingDaysThisMonth > 0 && availableToSpend.greaterThan(0)
      ? availableToSpend.dividedToIntegerBy(remainingDaysThisMonth)
      : new Decimal(0);

  const currentMonthKey = currentMonth?.month ?? plan.businessMonth;
  const isCurrentClosed = currentMonth?.closed ?? false;
  const includeCurrentForecast =
    !isCurrentClosed && currentMonthKey >= plan.businessMonth;

  const currentMonthActiveTxs = useMemo(
    () =>
      jarTransactions.filter((tx) => {
        if (tx.month !== currentMonthKey) return false;
        if (isCurrentClosed) return tx.workflowStatus === "approved";
        return (
          tx.workflowStatus === "approved" ||
          (includeCurrentForecast && tx.workflowStatus === "scheduled")
        );
      }),
    [jarTransactions, currentMonthKey, isCurrentClosed, includeCurrentForecast],
  );

  const monthAssetSpent = useMemo(
    () =>
      Decimal.max(
        0,
        currentMonthActiveTxs
          .filter((tx) => tx.walletKind !== "credit_card")
          .reduce((sum, tx) => sum.plus(tx.amount), new Decimal(0)),
      ),
    [currentMonthActiveTxs],
  );

  const monthCardSpent = useMemo(
    () =>
      Decimal.max(
        0,
        currentMonthActiveTxs
          .filter((tx) => tx.walletKind === "credit_card")
          .reduce((sum, tx) => sum.plus(tx.amount), new Decimal(0)),
      ),
    [currentMonthActiveTxs],
  );

  const realizedProgressPct = progressWidth(plan.realizedProgressPercentage);
  const projectedProgressPct = progressWidth(
    plan.projectedCurrentProgressPercentage,
  );

  return (
    <div className="grid gap-4">
      {/* Unified Executive Plan Hero Card */}
      <Card className="overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
        {/* Top Identity & Action Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2.5 sm:pb-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--primary)] sm:px-2.5 sm:text-xs">
              <span
                className="size-1.5 rounded-full bg-[var(--primary)]"
                aria-hidden="true"
              />
              {STATUS_LABELS[plan.status]}
            </span>

            {plan.status === "active" && (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:px-2.5 sm:text-xs",
                  plan.health === "at_risk" ||
                    plan.health === "behind" ||
                    plan.health === "overdue"
                    ? "bg-[color-mix(in_srgb,var(--warning)_14%,var(--surface))] text-[var(--warning)]"
                    : "bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))] text-[var(--success)]",
                )}
              >
                {plan.health === "at_risk" && (
                  <AlertTriangle className="size-3" aria-hidden="true" />
                )}
                {HEALTH_LABELS[plan.health]}
              </span>
            )}

            <span className="hidden shrink-0 items-center rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] tabular-nums sm:inline-flex">
              {shortMonthLabel(plan.startMonth)} →{" "}
              {shortMonthLabel(plan.targetMonth)}
            </span>
          </div>

          {/* Sleek Action Cluster (Inline on Right for Mobile & Desktop) */}
          <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/60 p-0.5 sm:gap-1">
            {plans.length > 1 && (
              <Button
                variant="icon"
                size="icon"
                onClick={onOpenPlanPicker}
                disabled={disabled}
                aria-label={`Đổi kế hoạch (${plans.length})`}
                title={`Đổi kế hoạch (${plans.length})`}
                className="size-7 sm:size-8"
              >
                <CalendarRange size={14} aria-hidden="true" />
              </Button>
            )}
            {canManage && !activeExists && (
              <Button
                variant="icon"
                size="icon"
                onClick={onCreatePlan}
                disabled={disabled}
                aria-label="Tạo kế hoạch mới"
                title="Tạo kế hoạch mới"
                className="size-7 sm:size-8"
              >
                <Plus size={14} aria-hidden="true" />
              </Button>
            )}
            {plan.canManage && plan.status === "active" && (
              <>
                <Button
                  variant="icon"
                  size="icon"
                  onClick={onEditAllocation}
                  disabled={disabled}
                  aria-label="Cấu hình tỷ lệ 6 hũ"
                  title="Cấu hình phân bổ 6 hũ"
                  className="size-7 sm:size-8"
                >
                  <SlidersHorizontal size={14} aria-hidden="true" />
                </Button>
                <Button
                  variant="icon"
                  size="icon"
                  onClick={onEditDeadline}
                  disabled={disabled}
                  aria-label="Đổi thời hạn hoàn thành"
                  title="Đổi thời hạn hoàn thành"
                  className="size-7 sm:size-8"
                >
                  <CalendarClock size={14} aria-hidden="true" />
                </Button>
                {plan.canComplete && (
                  <Button
                    variant="success"
                    size="icon"
                    onClick={onComplete}
                    disabled={disabled}
                    aria-label="Hoàn thành kế hoạch"
                    title="Hoàn thành kế hoạch"
                    className="size-7 sm:size-8"
                  >
                    <CheckCircle2 size={14} aria-hidden="true" />
                  </Button>
                )}
                <Button
                  variant="destructiveIcon"
                  size="icon"
                  onClick={() => setCancelConfirmOpen(true)}
                  disabled={disabled}
                  aria-label="Hủy kế hoạch"
                  title="Hủy kế hoạch"
                  className="size-7 sm:size-8"
                >
                  <AlertTriangle size={14} aria-hidden="true" />
                </Button>
              </>
            )}
            {plan.canManage &&
              (plan.status === "cancelled" || plan.status === "completed") &&
              onDelete && (
                <Button
                  variant="destructiveIcon"
                  size="icon"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={disabled}
                  aria-label="Xóa kế hoạch"
                  title="Xóa kế hoạch"
                  className="size-7 sm:size-8"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </Button>
              )}
          </div>
        </div>

        {/* Plan Identity & Master Savings Progress */}
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="min-w-0 break-words text-base font-bold leading-snug tracking-tight text-[var(--foreground)] sm:text-lg md:text-xl">
              {plan.name}
            </h2>
            <span className="inline-flex shrink-0 items-center rounded-md bg-[var(--surface-secondary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] tabular-nums sm:hidden">
              {shortMonthLabel(plan.startMonth)} →{" "}
              {shortMonthLabel(plan.targetMonth)}
            </span>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/45 p-2.5 sm:p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Tiến độ tích lũy
                </span>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5 tabular-nums">
                  <strong className="text-base font-bold tracking-tight text-[var(--foreground)] sm:text-lg">
                    {money(plan.realizedProgress, currency)}
                  </strong>
                  <span className="text-xs text-[var(--text-muted)]">
                    / {money(plan.targetAmount, currency)}
                  </span>
                </div>
              </div>
              <span className="rounded-lg bg-[var(--primary-soft)] px-2 py-0.5 text-xs font-bold text-[var(--primary)] tabular-nums">
                {plan.realizedProgressPercentage}%
              </span>
            </div>

            <div
              role="progressbar"
              aria-label={`Tiến độ tích lũy kế hoạch ${plan.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(realizedProgressPct)}
              className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface)]"
            >
              {projectedProgressPct > realizedProgressPct && (
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[var(--primary)]/25 transition-all duration-300"
                  style={{ width: `${projectedProgressPct}%` }}
                />
              )}
              <div
                className="relative h-full rounded-full bg-[var(--primary)] transition-all duration-300"
                style={{ width: `${realizedProgressPct}%` }}
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)] sm:text-xs">
              <span className="tabular-nums">
                Dự kiến cuối tháng:{" "}
                <strong className="font-semibold text-[var(--foreground)]">
                  <span className="sm:hidden">
                    {compactMoney(
                      plan.projectedEndOfCurrentMonthProgress,
                      currency,
                    )}
                  </span>
                  <span className="hidden sm:inline">
                    {money(plan.projectedEndOfCurrentMonthProgress, currency)}
                  </span>
                </strong>{" "}
                ({plan.projectedCurrentProgressPercentage}%)
              </span>
              {hasShortfall ? (
                <span className="font-semibold text-[var(--warning)] tabular-nums">
                  Cần bù:{" "}
                  <span className="sm:hidden">
                    {compactMoney(shortfall, currency)}
                  </span>
                  <span className="hidden sm:inline">
                    {money(shortfall, currency)}
                  </span>
                </span>
              ) : (
                <span className="tabular-nums">
                  Cuối kỳ:{" "}
                  <strong className="font-semibold text-[var(--foreground)]">
                    <span className="sm:hidden">
                      {compactMoney(plan.projectedEndOfPlanProgress, currency)}
                    </span>
                    <span className="hidden sm:inline">
                      {money(plan.projectedEndOfPlanProgress, currency)}
                    </span>
                  </strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Compact 2x2 Mobile / 4-Column Desktop Cashflow & Budget Matrix */}
        <section
          aria-label="Tổng quan ngân sách kế hoạch tháng này"
          className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-2.5"
        >
          {/* Tile 1: Thu nhập dự kiến */}
          <div className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-2.5 sm:p-3">
            <div className="flex items-center justify-between gap-1.5">
              <p className="text-[11px] font-medium leading-snug text-[var(--text-secondary)] sm:text-xs">
                Thu nhập dự kiến
              </p>
              <ArrowDownLeft
                className="size-3.5 shrink-0 text-[var(--income)]"
                aria-hidden="true"
              />
            </div>
            <div className="mt-1.5">
              <p className="text-sm font-bold tracking-tight text-[var(--foreground)] tabular-nums sm:text-base md:text-lg">
                {money(estimatedIncome.toString(), currency)}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-muted)]">
                {currentMonth
                  ? `Kỳ ${shortMonthLabel(currentMonth.month)}`
                  : `Kỳ ${shortMonthLabel(plan.businessMonth)}`}
              </p>
            </div>
          </div>

          {/* Tile 2: Cần tiết kiệm tháng này */}
          <div className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-2.5 sm:p-3">
            <div className="flex items-center justify-between gap-1.5">
              <p className="text-[11px] font-medium leading-snug text-[var(--text-secondary)] sm:text-xs">
                <span className="sm:hidden">Cần tiết kiệm</span>
                <span className="hidden sm:inline">Cần tiết kiệm tháng này</span>
              </p>
              <Target
                className="size-3.5 shrink-0 text-[var(--primary)]"
                aria-hidden="true"
              />
            </div>
            <div className="mt-1.5">
              <p className="text-sm font-bold tracking-tight text-[var(--primary)] tabular-nums sm:text-base md:text-lg">
                {money(requiredSavingsThisMonth.toString(), currency)}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-muted)] tabular-nums">
                {hasShortfall ? (
                  <span className="font-semibold text-[var(--warning)]">
                    Bù thêm: {compactMoney(shortfall, currency)}
                  </span>
                ) : (
                  `${financialGoals.length} mục tiêu tích lũy`
                )}
              </p>
            </div>
          </div>

          {/* Tile 3: Ngân sách chi tiêu tháng */}
          <div className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-2.5 sm:p-3">
            <div className="flex items-center justify-between gap-1">
              <p className="min-w-0 text-[11px] font-medium leading-snug text-[var(--text-secondary)] sm:text-xs">
                <span className="sm:hidden">Ngân sách tháng</span>
                <span className="hidden sm:inline">Ngân sách chi tiêu tháng</span>
              </p>
              <div className="flex shrink-0 items-center gap-1">
                {walletSummary ? (
                  <Popover>
                    <PopoverTrigger
                      render={
                        <button
                          type="button"
                          aria-label="Cách tính ngân sách chi tiêu tháng"
                          className="inline-flex items-center gap-0.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary-soft)]"
                        />
                      }
                    >
                      <HelpCircle className="size-2.5" aria-hidden="true" />
                      <span>Cách tính</span>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      sideOffset={8}
                      className="w-80 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-xs"
                    >
                      <p className="font-bold text-[var(--foreground)]">
                        Cách tính ngân sách 6 hũ tháng này
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-muted)]">
                        Tính từ số dư ví, dư nợ thẻ tín dụng và mức cần tiết kiệm trong tháng.
                      </p>
                      <dl className="mt-2.5 grid gap-1.5 border-t border-[var(--border)] pt-2.5 tabular-nums">
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-[var(--text-secondary)]">
                            Số dư hiện tại ({walletSummary.assetWalletCount} ví)
                          </dt>
                          <dd
                            className={cn(
                              "font-semibold",
                              new Decimal(walletSummary.totalAssetBalance).isNegative()
                                ? "text-[var(--destructive)]"
                                : "text-[var(--success)]",
                            )}
                          >
                            {new Decimal(walletSummary.totalAssetBalance).gt(0)
                              ? `+${money(walletSummary.totalAssetBalance, currency)}`
                              : new Decimal(walletSummary.totalAssetBalance).isNegative()
                                ? `−${money(new Decimal(walletSummary.totalAssetBalance).abs().toFixed(0), currency)}`
                                : money("0", currency)}
                          </dd>
                        </div>
                        {new Decimal(walletSummary.totalCreditCardDebt).gt(0) && (
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-[var(--text-secondary)]">
                              <Link
                                href="/wallets?reservedWalletId=all"
                                className="underline decoration-dotted hover:text-[var(--primary)]"
                              >
                                Dư nợ thẻ tín dụng ({walletSummary.creditCardCount} thẻ)
                              </Link>
                            </dt>
                            <dd className="font-semibold text-[var(--warning)]">
                              −{money(new Decimal(walletSummary.totalCreditCardDebt).abs().toFixed(0), currency)}
                            </dd>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-[var(--text-secondary)]">
                            Đã tích lũy cho mục tiêu
                          </dt>
                          <dd className="font-semibold text-[var(--foreground)]">
                            {new Decimal(plan.realizedProgress).gt(0)
                              ? `−${money(new Decimal(plan.realizedProgress).abs().toFixed(0), currency)}`
                              : money("0", currency)}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-[var(--text-secondary)]">
                            Chi đầu tháng & thu dự kiến
                          </dt>
                          <dd className="font-semibold text-[var(--foreground)]">
                            {spentThisMonth.gt(0)
                              ? `+${money(spentThisMonth.toFixed(0), currency)}`
                              : money("0", currency)}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-[var(--text-secondary)]">
                            Trừ khoản tiết kiệm tháng này
                          </dt>
                          <dd className="font-semibold text-[var(--primary)]">
                            {requiredSavingsThisMonth.gt(0)
                              ? `−${money(requiredSavingsThisMonth.toFixed(0), currency)}`
                              : money("0", currency)}
                          </dd>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2 font-bold text-[var(--foreground)]">
                          <dt>= Ngân sách 6 hũ</dt>
                          <dd>{money(monthlyBudget.toFixed(0), currency)}</dd>
                        </div>
                      </dl>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Wallet
                    className="size-3.5 shrink-0 text-[var(--foreground)]"
                    aria-hidden="true"
                  />
                )}
              </div>
            </div>
            <div className="mt-1.5">
              <p className="text-sm font-bold tracking-tight text-[var(--foreground)] tabular-nums sm:text-base md:text-lg">
                {money(monthlyBudget.toString(), currency)}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-muted)]">
                Còn lại:{" "}
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    availableToSpend.isNegative()
                      ? "text-[var(--destructive)]"
                      : "text-[var(--foreground)]",
                  )}
                >
                  {availableToSpend.isNegative()
                    ? `−${compactMoney(availableToSpend.abs().toString(), currency)}`
                    : compactMoney(availableToSpend.toString(), currency)}
                </span>
              </p>
            </div>
          </div>

          {/* Tile 4: Đã chi tiêu */}
          <div className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-2.5 sm:p-3">
            <div className="flex items-center justify-between gap-1.5">
              <p className="text-[11px] font-medium leading-snug text-[var(--text-secondary)] sm:text-xs">
                Đã chi tiêu
              </p>
              <span
                className={cn(
                  "rounded-md bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  PROGRESS_TEXT_TONES[monthlyUsageTone],
                )}
              >
                {monthlyUsage.toDecimalPlaces(0).toString()}%
              </span>
            </div>
            <div className="mt-1.5">
              <p
                className={cn(
                  "text-sm font-bold tracking-tight tabular-nums sm:text-base md:text-lg",
                  PROGRESS_TEXT_TONES[monthlyUsageTone],
                )}
              >
                {money(spentThisMonth.toString(), currency)}
              </p>
              {monthCardSpent.gt(0) ? (
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-secondary)] tabular-nums">
                  Ví {compactMoney(monthAssetSpent.toFixed(0), currency)} · Thẻ{" "}
                  <strong className="font-semibold text-[var(--foreground)]">
                    {compactMoney(monthCardSpent.toFixed(0), currency)}
                  </strong>
                </p>
              ) : (
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-muted)] tabular-nums">
                  {safeDailyOverall.greaterThan(0)
                    ? `An toàn ${compactMoney(safeDailyOverall.toFixed(0), currency)}/ngày`
                    : `${monthlyUsage.toDecimalPlaces(0).toString()}% ngân sách tháng`}
                </p>
              )}
            </div>
          </div>
        </section>
      </Card>

      {/* Daily Spending Compass (La bàn chi tiêu mỗi ngày) */}
      {plan.status === "active" && currentMonth && (
        <DailySpendingCompass
          currentMonth={currentMonth}
          businessDate={businessDate}
          remainingDaysThisMonth={remainingDaysThisMonth}
          currency={currency}
          jarTransactions={jarTransactions}
        />
      )}

      {/* Full-Width 3-Column Segmented Navigation Bar (Zero Horizontal Overflow) */}
      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as "jars" | "goals" | "details")
        }
      >
        <TabsList
          variant="segmented"
          aria-label="Các phần của kế hoạch tài chính"
          className="grid w-full grid-cols-3"
        >
          <TabsTrigger
            value="jars"
            variant="segmented"
            className="px-2 text-xs sm:text-sm"
          >
            <PieChart className="size-3.5 shrink-0" aria-hidden="true" />
            <span>6 Hũ chi tiêu</span>
          </TabsTrigger>
          <TabsTrigger
            value="goals"
            variant="segmented"
            className="px-2 text-xs sm:text-sm"
          >
            <Target className="size-3.5 shrink-0" aria-hidden="true" />
            <span>Mục tiêu</span>
            <TabsCount>{financialGoals.length}</TabsCount>
          </TabsTrigger>
          <TabsTrigger
            value="details"
            variant="segmented"
            className="px-2 text-xs sm:text-sm"
          >
            <History className="size-3.5 shrink-0" aria-hidden="true" />
            <span>Lộ trình</span>
            <TabsCount>{plan.months.length}</TabsCount>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: 6 Hũ chi tiêu (6 Jars) */}
        <TabsContent value="jars">
          {activeJarMonth ? (
            <SixJarsSection
              month={activeJarMonth}
              months={plan.months}
              businessDate={businessDate}
              businessMonth={plan.businessMonth}
              currency={currency}
              jarCategories={jarCategories}
              jarTransactions={jarTransactions}
              device={device}
              canEditAllocation={plan.status === "active" && plan.canManage}
              disabled={disabled}
              onSelectMonth={(monthKey) => setSelectedJarMonthKey(monthKey)}
              onEditAllocation={onEditAllocation}
            />
          ) : (
            <Card>
              <Empty
                icon={PieChart}
                title="Chưa có dữ liệu phân bổ 6 hũ"
                description="Chọn tab Lộ trình để xem lịch sử các tháng trước."
              />
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: Mục tiêu tích lũy (Savings Goals) */}
        <TabsContent value="goals">
          <FinancialPlanGoals
            planId={plan.id}
            planStatus={plan.status}
            goals={financialGoals}
            wallets={goalWallets}
            currency={currency}
            businessMonth={businessMonth}
            canManage={canManage}
          />
        </TabsContent>

        {/* Tab 3: Lộ trình & Cài đặt kế hoạch */}
        <TabsContent value="details">
          <div className="grid gap-4">
            {/* Monthly Breakdown Table / List */}
            <MonthHistory
              months={plan.months}
              currency={currency}
              device={device}
              onInspectInJarsTab={(monthKey) => {
                setSelectedJarMonthKey(monthKey);
                setActiveTab("jars");
              }}
            />

            {/* Plan Progress & Settings Card */}
            <Card>
              <CardHeader className="border-b border-[var(--border)]">
                <CardTitle>Tiến độ & Cài đặt kế hoạch</CardTitle>
                <CardDescription>
                  Theo dõi tiến độ tích lũy và điều chỉnh kế hoạch khi cần.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <dl className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
                    <dt className="break-words text-xs leading-snug text-[var(--text-secondary)]">
                      Đã tích lũy thực tế
                    </dt>
                    <dd className="mt-1 text-sm font-bold text-[var(--foreground)] tabular-nums shrink-0 sm:text-base">
                      {money(plan.realizedProgress, currency)}
                    </dd>
                    <small className="mt-0.5 block text-[11px] text-[var(--text-muted)] tabular-nums">
                      Mục tiêu: {compactMoney(plan.targetAmount, currency)}
                    </small>
                  </div>

                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
                    <dt className="break-words text-xs leading-snug text-[var(--text-secondary)]">
                      Dự kiến cuối tháng này
                    </dt>
                    <dd className="mt-1 text-sm font-bold text-[var(--foreground)] tabular-nums shrink-0 sm:text-base">
                      {money(plan.projectedEndOfCurrentMonthProgress, currency)}
                    </dd>
                    <small className="mt-0.5 block text-[11px] text-[var(--text-muted)] tabular-nums">
                      Đạt {plan.projectedCurrentProgressPercentage}% mục tiêu
                    </small>
                  </div>

                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
                    <dt className="break-words text-xs leading-snug text-[var(--text-secondary)]">
                      Dự kiến khi đến hạn
                    </dt>
                    <dd className="mt-1 text-sm font-bold text-[var(--foreground)] tabular-nums shrink-0 sm:text-base">
                      {money(plan.projectedEndOfPlanProgress, currency)}
                    </dd>
                    <small className="mt-0.5 block text-[11px] text-[var(--text-muted)]">
                      Hạn: {monthLabel(plan.targetMonth)}
                    </small>
                  </div>

                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
                    <dt className="break-words text-xs leading-snug text-[var(--text-secondary)]">
                      Cần bù thêm
                    </dt>
                    <dd
                      className={cn(
                        "mt-1 text-sm font-bold tabular-nums shrink-0 sm:text-base",
                        hasShortfall
                          ? "text-[var(--warning)]"
                          : "text-[var(--success)]",
                      )}
                    >
                      {hasShortfall ? money(shortfall, currency) : "0 ₫"}
                    </dd>
                    <small className="mt-0.5 block text-[11px] text-[var(--text-muted)]">
                      {hasShortfall
                        ? "Cần tăng thu nhập hoặc lùi hạn hoàn thành"
                        : "Đủ khả năng đạt mục tiêu"}
                    </small>
                  </div>
                </dl>

                {plan.canManage && (
                  <div className="flex flex-col gap-2.5 border-t border-[var(--border)] pt-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      Tùy chỉnh kế hoạch
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {plan.status === "active" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={onEditAllocation}
                            disabled={disabled}
                            aria-label="Điều chỉnh tỷ lệ 6 hũ tháng sau"
                          >
                            <SlidersHorizontal size={14} aria-hidden="true" />
                            <span>Tỷ lệ 6 hũ</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={onEditDeadline}
                            disabled={disabled}
                            aria-label="Đổi thời hạn hoàn thành"
                          >
                            <CalendarClock size={14} aria-hidden="true" />
                            <span>Đổi thời hạn</span>
                          </Button>
                          {plan.canComplete && (
                            <Button
                              variant="success"
                              size="sm"
                              onClick={onComplete}
                              disabled={disabled}
                              aria-label="Hoàn thành kế hoạch"
                            >
                              <CheckCircle2 size={14} aria-hidden="true" />
                              <span>Hoàn thành kế hoạch</span>
                            </Button>
                          )}
                        </>
                      )}
                      {plans.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onOpenPlanPicker}
                          disabled={disabled}
                          aria-label={`Chuyển đổi kế hoạch (${plans.length})`}
                        >
                          <CalendarRange size={14} aria-hidden="true" />
                          <span>Đổi kế hoạch ({plans.length})</span>
                        </Button>
                      )}
                      {plan.status === "active" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setCancelConfirmOpen(true)}
                          disabled={disabled}
                          aria-label="Hủy kế hoạch"
                        >
                          <AlertTriangle size={14} aria-hidden="true" />
                          <span>Hủy kế hoạch</span>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Other Plans List if multiple plans exist */}
            {plans.length > 1 && (
              <Card>
                <CardHeader className="border-b border-[var(--border)]">
                  <CardTitle>Tất cả kế hoạch ({plans.length})</CardTitle>
                  <CardDescription>
                    Chuyển đổi giữa kế hoạch đang chạy, bản nháp hoặc các kế
                    hoạch đã kết thúc.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {plans.map((item) => {
                    const StatusIcon = STATUS_ICONS[item.status] ?? Target;
                    const isSelected = item.id === plan.id;
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors",
                          isSelected
                            ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                            : "border-[var(--border)] bg-[var(--surface-secondary)]",
                        )}
                      >
                        <Link
                          href={`/financial-plans?plan=${item.id}`}
                          className="flex min-w-0 flex-1 items-center gap-3 outline-none"
                          aria-current={isSelected ? "page" : undefined}
                        >
                          <span
                            className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--surface)] text-[var(--primary)]"
                            aria-hidden="true"
                          >
                            <StatusIcon className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                              {item.name}
                            </span>
                            <span className="mt-0.5 block break-words text-xs leading-snug text-[var(--text-muted)]">
                              {STATUS_LABELS[item.status]} · Hạn{" "}
                              {monthLabel(item.targetMonth)} ·{" "}
                              {money(item.targetAmount, currency)}
                            </span>
                          </span>
                        </Link>
                        {canManage &&
                          item.status !== "active" &&
                          onDeleteOtherPlan && (
                            <Button
                              variant="destructiveIcon"
                              size="icon"
                              aria-label={`Xóa kế hoạch ${item.name}`}
                              title="Xóa kế hoạch"
                              disabled={disabled}
                              onClick={() => onDeleteOtherPlan(item)}
                            >
                              <Trash2 size={15} aria-hidden="true" />
                            </Button>
                          )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDelete
        open={cancelConfirmOpen}
        onOpenChange={setCancelConfirmOpen}
        trigger={null}
        presentation="sheet"
        ariaLabel="Hủy kế hoạch"
        title="Hủy kế hoạch đang chạy?"
        description="Kế hoạch sẽ ngừng chạy và không thể chỉnh sửa thêm. Số liệu các tháng đã chốt vẫn được giữ nguyên."
        confirmLabel="Hủy kế hoạch"
        onConfirm={onCancel}
        disabled={disabled}
      />

      <ConfirmDelete
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        trigger={null}
        ariaLabel="Xóa kế hoạch"
        title="Xóa kế hoạch?"
        description="Kế hoạch sẽ bị xóa khỏi danh sách."
        confirmLabel="Xóa kế hoạch"
        presentation="sheet"
        onConfirm={onDelete ?? (() => {})}
        disabled={disabled}
      />
    </div>
  );
}

function DailySpendingCompass({
  currentMonth,
  businessDate,
  remainingDaysThisMonth,
  currency,
  jarTransactions,
}: {
  currentMonth: PlanMonth;
  businessDate?: string;
  remainingDaysThisMonth: number;
  currency: string;
  jarTransactions: JarTransactionItem[];
}) {
  const [compassScope, setCompassScope] = useState<"daily_living" | "all_jars">(
    "daily_living",
  );

  const scopeJars = useMemo(
    () =>
      compassScope === "daily_living"
        ? currentMonth.jars.filter(
            (j) => j.jarCode === "ESSENTIAL" || j.jarCode === "ENJOYMENT",
          )
        : currentMonth.jars,
    [compassScope, currentMonth.jars],
  );

  const scopeAllocated = useMemo(
    () =>
      scopeJars.reduce(
        (sum, jar) => sum.plus(jar.allocatedAmount || "0"),
        new Decimal(0),
      ),
    [scopeJars],
  );

  const scopeSpentMonth = useMemo(
    () =>
      scopeJars.reduce(
        (sum, jar) =>
          sum.plus(jar.expenseAmount ?? jar.closedActualAmount ?? "0"),
        new Decimal(0),
      ),
    [scopeJars],
  );

  const scopeRemainingMonth = useMemo(
    () => scopeAllocated.minus(scopeSpentMonth),
    [scopeAllocated, scopeSpentMonth],
  );

  const todayTransactions = useMemo(
    () =>
      jarTransactions.filter((tx) => {
        if (!businessDate || tx.date !== businessDate) return false;
        if (tx.workflowStatus === "rejected" || tx.workflowStatus === "pending") {
          return false;
        }
        if (compassScope === "daily_living") {
          return tx.jarCode === "ESSENTIAL" || tx.jarCode === "ENJOYMENT";
        }
        return true;
      }),
    [jarTransactions, businessDate, compassScope],
  );

  const spentTodayTotal = useMemo(
    () =>
      todayTransactions.reduce(
        (sum, tx) => sum.plus(tx.amount),
        new Decimal(0),
      ),
    [todayTransactions],
  );

  const spentTodayAsset = useMemo(
    () =>
      Decimal.max(
        0,
        todayTransactions
          .filter((tx) => tx.walletKind !== "credit_card")
          .reduce((sum, tx) => sum.plus(tx.amount), new Decimal(0)),
      ),
    [todayTransactions],
  );

  const spentTodayCard = useMemo(
    () =>
      Decimal.max(
        0,
        todayTransactions
          .filter((tx) => tx.walletKind === "credit_card")
          .reduce((sum, tx) => sum.plus(tx.amount), new Decimal(0)),
      ),
    [todayTransactions],
  );

  const poolAtStartOfToday = Decimal.max(
    0,
    scopeRemainingMonth.plus(Decimal.max(0, spentTodayTotal)),
  );
  const dailyAllowance =
    remainingDaysThisMonth > 0
      ? poolAtStartOfToday.dividedToIntegerBy(remainingDaysThisMonth)
      : new Decimal(0);
  const remainingForToday = dailyAllowance.minus(
    Decimal.max(0, spentTodayTotal),
  );
  const nextDaysSafeDaily =
    remainingDaysThisMonth > 0 && scopeRemainingMonth.gt(0)
      ? scopeRemainingMonth.dividedToIntegerBy(remainingDaysThisMonth)
      : new Decimal(0);

  const [yearNum, monthNum] = currentMonth.month.split("-").map(Number);
  const totalDaysInMonth = new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate();
  const currentDayOfMonth =
    businessDate && businessDate.slice(0, 7) === currentMonth.month
      ? Math.min(Math.max(Number(businessDate.slice(8, 10)) || 1, 1), totalDaysInMonth)
      : 1;
  const timeElapsedPct = Math.round((currentDayOfMonth / totalDaysInMonth) * 100);
  const budgetUsedPct = scopeAllocated.gt(0)
    ? Math.min(
        100,
        Math.round(scopeSpentMonth.dividedBy(scopeAllocated).times(100).toNumber()),
      )
    : scopeSpentMonth.gt(0)
      ? 100
      : 0;

  return (
    <Card className="border border-[var(--border)] bg-[var(--surface)]">
      {/* Compass Header + Scope Toggle */}
      <div className="flex flex-col gap-2 border-b border-[var(--border)] pb-2.5 sm:flex-row sm:items-center sm:justify-between sm:pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
              <Compass className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="break-words text-sm font-bold leading-snug text-[var(--foreground)] md:text-base">
                Định mức chi tiêu mỗi ngày
              </h3>
              <p className="text-[11px] leading-snug text-[var(--text-muted)] tabular-nums">
                {businessDate ? `Hôm nay ${formatViDate(businessDate)} · ` : ""}
                Còn {remainingDaysThisMonth} ngày trong tháng
              </p>
            </div>
          </div>
        </div>

        <div
          role="group"
          aria-label="Phạm vi tính định mức chi tiêu mỗi ngày"
          className="grid w-full grid-cols-2 items-center rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/70 p-0.5 sm:inline-flex sm:w-auto sm:shrink-0"
        >
          <button
            type="button"
            onClick={() => setCompassScope("daily_living")}
            aria-pressed={compassScope === "daily_living"}
            className={cn(
              "rounded-lg px-2.5 py-1 text-center text-xs font-semibold transition-colors",
              compassScope === "daily_living"
                ? "bg-[var(--surface)] text-[var(--primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--foreground)]",
            )}
          >
            Thiết yếu & Hưởng thụ
          </button>
          <button
            type="button"
            onClick={() => setCompassScope("all_jars")}
            aria-pressed={compassScope === "all_jars"}
            className={cn(
              "rounded-lg px-2.5 py-1 text-center text-xs font-semibold transition-colors",
              compassScope === "all_jars"
                ? "bg-[var(--surface)] text-[var(--primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--foreground)]",
            )}
          >
            Tất cả 6 Hũ
          </button>
        </div>
      </div>

      {/* Responsive Daily Strip: Hero Top + 2-Col Bottom on Mobile, 3-Col on Tablet/Desktop */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
        {/* Box 1: Định mức hôm nay */}
        <div className="col-span-2 flex flex-col justify-between rounded-xl border border-[var(--primary)]/30 bg-[var(--primary-soft)]/45 p-2.5 sm:col-span-1 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-[var(--text-secondary)] sm:text-xs">
              Định mức hôm nay
            </p>
            <span className="rounded-md bg-[var(--surface)]/80 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)] tabular-nums sm:hidden">
              TB {compactMoney(nextDaysSafeDaily.toFixed(0), currency)}/ngày
            </span>
          </div>
          <p className="mt-1 text-base font-bold tracking-tight text-[var(--primary)] tabular-nums md:text-lg">
            {money(dailyAllowance.toFixed(0), currency)} / ngày
          </p>
          <p className="mt-0.5 hidden break-words text-[11px] leading-snug text-[var(--text-muted)] tabular-nums sm:block">
            Trung bình {compactMoney(nextDaysSafeDaily.toFixed(0), currency)}/ngày
            cho {remainingDaysThisMonth} ngày cuối tháng
          </p>
        </div>

        {/* Box 2: Hôm nay đã chi */}
        <div className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-2.5 sm:p-3">
          <p className="text-[11px] font-medium text-[var(--text-secondary)] sm:text-xs">
            Hôm nay đã chi
          </p>
          <div className="mt-1">
            <p className="text-sm font-bold tracking-tight text-[var(--foreground)] tabular-nums sm:text-base md:text-lg">
              {money(Decimal.max(0, spentTodayTotal).toFixed(0), currency)}
            </p>
            <p className="mt-0.5 break-words text-[11px] leading-snug text-[var(--text-muted)] tabular-nums">
              {spentTodayCard.gt(0) || spentTodayAsset.gt(0)
                ? `Ví ${compactMoney(spentTodayAsset.toFixed(0), currency)} · Thẻ ${compactMoney(spentTodayCard.toFixed(0), currency)}`
                : "Chưa phát sinh"}
            </p>
          </div>
        </div>

        {/* Box 3: Còn được tiêu hôm nay */}
        <div className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-2.5 sm:p-3">
          <p className="text-[11px] font-medium text-[var(--text-secondary)] sm:text-xs">
            Còn được tiêu
          </p>
          <div className="mt-1">
            {remainingForToday.gte(0) ? (
              <>
                <p className="text-sm font-bold tracking-tight text-[var(--success)] tabular-nums sm:text-base md:text-lg">
                  {money(remainingForToday.toFixed(0), currency)}
                </p>
                <p className="mt-0.5 break-words text-[11px] leading-snug text-[var(--text-muted)]">
                  Trong ngưỡng an toàn
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold tracking-tight text-[var(--warning)] tabular-nums sm:text-base md:text-lg">
                  Vượt {money(remainingForToday.abs().toFixed(0), currency)}
                </p>
                <p className="mt-0.5 break-words text-[11px] leading-snug text-[var(--text-muted)] tabular-nums">
                  Từ mai:{" "}
                  {compactMoney(
                    Decimal.max(0, scopeRemainingMonth)
                      .dividedToIntegerBy(Math.max(remainingDaysThisMonth - 1, 1))
                      .toFixed(0),
                    currency,
                  )}
                  /ngày
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Spending Pace vs Time Bar (Nhịp độ chi tiêu tháng) */}
      <div className="grid gap-1.5 border-t border-[var(--border)] pt-2 text-[11px] sm:pt-2.5 sm:text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[var(--text-secondary)] tabular-nums">
            Đã qua{" "}
            <strong className="font-semibold text-[var(--foreground)]">
              {timeElapsedPct}%
            </strong>{" "}
            tháng (Ngày {currentDayOfMonth}/{totalDaysInMonth}) · Đã tiêu{" "}
            <strong className="font-semibold text-[var(--foreground)]">
              {budgetUsedPct}%
            </strong>{" "}
            ngân sách
          </span>

          {scopeAllocated.lte(0) ? (
            <span className="break-words text-[11px] font-medium text-[var(--warning)]">
              Ngân sách chi tiêu bằng 0 ₫ do mức cần tiết kiệm và dư nợ thẻ vượt số dư ví.
            </span>
          ) : budgetUsedPct <= timeElapsedPct ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))] px-2 py-0.5 text-[11px] font-semibold text-[var(--success)] tabular-nums">
              <span
                className="size-1.5 rounded-full bg-[var(--success)]"
                aria-hidden="true"
              />
              <span>
                Chi tiêu hợp lý (thấp hơn tiến độ {timeElapsedPct - budgetUsedPct}%)
              </span>
            </span>
          ) : budgetUsedPct <= 100 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--warning)_14%,var(--surface))] px-2 py-0.5 text-[11px] font-semibold text-[var(--warning)] tabular-nums">
              <span
                className="size-1.5 rounded-full bg-[var(--warning)]"
                aria-hidden="true"
              />
              <span>
                Chi tiêu hơi nhanh (+{budgetUsedPct - timeElapsedPct}% tiến độ)
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--destructive)_14%,var(--surface))] px-2 py-0.5 text-[11px] font-semibold text-[var(--destructive)]">
              <span
                className="size-1.5 rounded-full bg-[var(--destructive)]"
                aria-hidden="true"
              />
              <span>Đã vượt ngân sách nhóm này</span>
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

function SixJarsSection({
  month,
  months,
  businessDate,
  businessMonth,
  currency,
  jarCategories,
  jarTransactions,
  device,
  canEditAllocation,
  disabled,
  onSelectMonth,
  onEditAllocation,
}: {
  month: PlanMonth;
  months: PlanMonth[];
  businessDate?: string;
  businessMonth: string;
  currency: string;
  jarCategories: JarCategoryItem[];
  jarTransactions: JarTransactionItem[];
  device: DeviceTier;
  canEditAllocation?: boolean;
  disabled?: boolean;
  onSelectMonth: (monthKey: string) => void;
  onEditAllocation?: () => void;
}) {
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [inspectedJarCode, setInspectedJarCode] =
    useState<FinancialJarCode | null>(null);

  const monthIndex = months.findIndex((m) => m.month === month.month);
  const prevMonthItem = monthIndex > 0 ? months[monthIndex - 1] : null;
  const nextMonthItem =
    monthIndex >= 0 && monthIndex < months.length - 1
      ? months[monthIndex + 1]
      : null;

  const remainingDays = getRemainingDaysInMonth(month.month, businessDate);
  const isCurrentBusinessMonth =
    month.month === businessMonth && !month.closed;
  const includeForecast = !month.closed && month.month >= businessMonth;

  const monthTransactions = useMemo(
    () => jarTransactions.filter((tx) => tx.month === month.month),
    [jarTransactions, month.month],
  );

  const donorJar = useMemo(() => {
    let best: { jarCode: FinancialJarCode; remainingAmount: string } | null = null;
    for (const candidate of month.jars) {
      const rem =
        candidate.remainingAmount ??
        new Decimal(candidate.allocatedAmount)
          .minus(candidate.closedActualAmount ?? 0)
          .toFixed(0);
      if (new Decimal(rem).lte(0)) continue;
      if (!best || new Decimal(rem).gt(best.remainingAmount)) {
        best = { jarCode: candidate.jarCode, remainingAmount: rem };
      }
    }
    return best;
  }, [month.jars]);

  const inspectedJar = useMemo(
    () =>
      inspectedJarCode
        ? month.jars.find((j) => j.jarCode === inspectedJarCode) ?? null
        : null,
    [inspectedJarCode, month.jars],
  );

  return (
    <div className="grid gap-3">
      {/* Header Bar with Direct Month Selector Capsule */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 sm:px-3.5 sm:py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-secondary)]/70 p-0.5">
            <button
              type="button"
              disabled={!prevMonthItem}
              onClick={() =>
                prevMonthItem && onSelectMonth(prevMonthItem.month)
              }
              aria-label="Tháng trước"
              title="Tháng trước"
              className="grid size-7 place-items-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)] disabled:opacity-35"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
            </button>

            <Popover open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    aria-label="Chọn tháng phân bổ 6 hũ"
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface)]"
                  />
                }
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    isCurrentBusinessMonth
                      ? "bg-[var(--primary)]"
                      : month.closed
                        ? "bg-[var(--success)]"
                        : "bg-[var(--text-muted)]",
                  )}
                  aria-hidden="true"
                />
                <span>{monthLabel(month.month)}</span>
                <ChevronDown
                  className={cn(
                    "size-3 text-[var(--text-muted)] transition-transform duration-200",
                    monthPickerOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </PopoverTrigger>

              <PopoverContent
                align="start"
                sideOffset={8}
                className="w-72 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--foreground)]">
                    Chọn tháng
                  </span>
                  {month.month !== businessMonth &&
                    months.some((m) => m.month === businessMonth) && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectMonth(businessMonth);
                          setMonthPickerOpen(false);
                        }}
                        className="text-[11px] font-semibold text-[var(--primary)] hover:underline"
                      >
                        Về tháng hiện tại
                      </button>
                    )}
                </div>
                <div className="grid max-h-60 grid-cols-2 gap-1.5 overflow-y-auto">
                  {months.map((m) => {
                    const selected = m.month === month.month;
                    const isCurrent = m.month === businessMonth && !m.closed;
                    return (
                      <button
                        key={m.month}
                        type="button"
                        onClick={() => {
                          onSelectMonth(m.month);
                          setMonthPickerOpen(false);
                        }}
                        className={cn(
                          "flex flex-col items-start rounded-xl border px-2.5 py-2 text-left transition-colors",
                          selected
                            ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                            : "border-[var(--border)] bg-[var(--surface-secondary)]/50 text-[var(--foreground)] hover:bg-[var(--surface-secondary)]",
                        )}
                      >
                        <span className="text-xs font-bold tabular-nums">
                          {monthLabel(m.month)}
                        </span>
                        <span className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                          {isCurrent
                            ? "Kỳ hiện tại"
                            : m.closed
                              ? "Đã chốt sổ"
                              : "Dự kiến"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            <button
              type="button"
              disabled={!nextMonthItem}
              onClick={() =>
                nextMonthItem && onSelectMonth(nextMonthItem.month)
              }
              aria-label="Tháng tiếp theo"
              title="Tháng tiếp theo"
              className="grid size-7 place-items-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)] disabled:opacity-35"
            >
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </button>
          </div>

          <span
            className={cn(
              "hidden rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline-flex",
              isCurrentBusinessMonth
                ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                : month.closed
                  ? "bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))] text-[var(--success)]"
                  : "bg-[var(--surface-secondary)] text-[var(--text-muted)]",
            )}
          >
            {isCurrentBusinessMonth
              ? `Còn ${remainingDays} ngày trong tháng`
              : month.closed
                ? "Đã chốt sổ"
                : "Dự kiến"}
          </span>
        </div>

        {/* Multi-segment visual bar + Edit Ratios Action */}
        <div className="flex items-center gap-2">
          <div
            className="hidden h-2 w-28 gap-0.5 overflow-hidden rounded-full bg-[var(--surface-secondary)] md:flex"
            aria-hidden="true"
          >
            {month.jars.map((jar) => {
              const pct = Number(jar.percentage || 0);
              return (
                <div
                  key={jar.jarCode}
                  style={{
                    flex: pct,
                    backgroundColor:
                      pct > 0 ? JAR_COLORS[jar.jarCode] : "transparent",
                  }}
                />
              );
            })}
          </div>

          {canEditAllocation && onEditAllocation && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEditAllocation}
              disabled={disabled}
              aria-label="Điều chỉnh tỷ lệ 6 hũ tháng sau"
              title="Điều chỉnh tỷ lệ 6 hũ tháng sau"
              className="h-8 px-2.5 text-xs"
            >
              <SlidersHorizontal size={13} aria-hidden="true" />
              <span>Tỷ lệ 6 hũ</span>
            </Button>
          )}
        </div>
      </div>

      {/* 6 Jars Interactive Responsive Grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {month.jars.map((jar) => {
          const remaining =
            jar.remainingAmount ??
            new Decimal(jar.allocatedAmount)
              .minus(jar.closedActualAmount ?? 0)
              .toFixed(0);
          const spent = jar.expenseAmount ?? jar.closedActualAmount ?? "0";
          const overspent = new Decimal(remaining).isNegative();
          const jarUsage = jarUsagePercentage(jar);
          const jarUsageTone = overspent ? "critical" : progressTone(jarUsage);
          const color = JAR_COLORS[jar.jarCode];
          const isDailyCadence =
            jar.jarCode === "ESSENTIAL" || jar.jarCode === "ENJOYMENT";

          const jarTxs = monthTransactions.filter(
            (tx) => tx.jarCode === jar.jarCode,
          );
          const jarActiveTxs = jarTxs.filter((tx) =>
            month.closed
              ? tx.workflowStatus === "approved"
              : tx.workflowStatus === "approved" ||
                (includeForecast && tx.workflowStatus === "scheduled"),
          );
          const jarAssetSpent = Decimal.max(
            0,
            jarActiveTxs
              .filter((tx) => tx.walletKind !== "credit_card")
              .reduce((sum, tx) => sum.plus(tx.amount), new Decimal(0)),
          );
          const jarCardSpent = Decimal.max(
            0,
            jarActiveTxs
              .filter((tx) => tx.walletKind === "credit_card")
              .reduce((sum, tx) => sum.plus(tx.amount), new Decimal(0)),
          );

          const jarTxCount = jarTxs.length;
          const jarCats = jarCategories.filter(
            (cat) => cat.jarCode === jar.jarCode,
          );
          const mappedCatsCount = jarCats.length;
          const firstJarCat = jarCats[0];
          const safeDailyJar =
            isCurrentBusinessMonth &&
            remainingDays > 0 &&
            new Decimal(remaining).greaterThan(0)
              ? new Decimal(remaining).dividedToIntegerBy(remainingDays)
              : null;

          return (
            <Card
              key={jar.jarCode}
              size="sm"
              role="button"
              tabIndex={0}
              onClick={() => setInspectedJarCode(jar.jarCode)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setInspectedJarCode(jar.jarCode);
                }
              }}
              aria-label={`Xem chi tiết hũ ${FINANCIAL_JAR_LABELS[jar.jarCode]} (${jar.percentage}%)`}
              className="cursor-pointer select-none text-left transition-colors duration-150 hover:border-[var(--primary)]/50 active:bg-[var(--surface-secondary)]/50"
            >
              {/* Top Row: Jar Name + Cadence Badge + % Share Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <h4 className="min-w-0 break-words text-sm font-bold leading-snug text-[var(--foreground)] md:text-base">
                      {FINANCIAL_JAR_LABELS[jar.jarCode]}
                    </h4>
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                        isDailyCadence
                          ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                          : "bg-[var(--surface-secondary)] text-[var(--text-muted)]",
                      )}
                    >
                      {isDailyCadence ? "Chi hàng ngày" : "Chi theo đợt"}
                    </span>
                  </div>
                  <p className="mt-0.5 break-words text-[11px] leading-snug text-[var(--text-muted)]">
                    <span className="sm:hidden">
                      {JAR_SHORT_DESCRIPTIONS[jar.jarCode]}
                    </span>
                    <span className="hidden sm:inline">
                      {JAR_DESCRIPTIONS[jar.jarCode]}
                    </span>
                  </p>
                </div>

                <span className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2 py-0.5 text-xs font-bold text-[var(--foreground)] tabular-nums shrink-0">
                  {jar.percentage}%
                </span>
              </div>

              {/* Middle Row: Prominent Remaining Budget + Daily Safe Spend + Progress Bar */}
              <div className="space-y-2 border-t border-[var(--border)] pt-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      {overspent ? "Vượt hạn mức: " : "Còn được tiêu: "}
                    </span>
                    <strong
                      className={cn(
                        "text-sm font-bold tabular-nums md:text-base",
                        overspent
                          ? "text-[var(--destructive)]"
                          : "text-[var(--success)]",
                      )}
                    >
                      {overspent
                        ? `−${money(new Decimal(remaining).abs().toFixed(0), currency)}`
                        : money(remaining, currency)}
                    </strong>
                  </div>
                  {safeDailyJar && safeDailyJar.greaterThan(0) && (
                    <span className="rounded-md bg-[var(--primary-soft)]/70 px-1.5 py-0.5 text-[11px] font-semibold text-[var(--primary)] tabular-nums shrink-0">
                      ~ {compactMoney(safeDailyJar.toFixed(0), currency)}/ngày
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5">
                  <div
                    role="progressbar"
                    aria-label={`Mức sử dụng hũ ${FINANCIAL_JAR_LABELS[jar.jarCode]}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(jarUsage)}
                    className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)]"
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        PROGRESS_BAR_TONES[jarUsageTone],
                      )}
                      style={{ width: `${jarUsage}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-xs font-bold tabular-nums shrink-0",
                      PROGRESS_TEXT_TONES[jarUsageTone],
                    )}
                  >
                    {jarUsage.toFixed(0)}%
                  </span>
                </div>

                <div className="flex flex-wrap items-baseline justify-between gap-1.5 text-[11px] text-[var(--text-muted)] tabular-nums">
                  <span>
                    Đã chi:{" "}
                    <strong className="font-semibold text-[var(--foreground)]">
                      {money(spent, currency)}
                    </strong>{" "}
                    / {money(jar.allocatedAmount, currency)}
                  </span>
                  {jarCardSpent.gt(0) && (
                    <span className="text-[var(--text-secondary)]">
                      Ví {compactMoney(jarAssetSpent.toFixed(0), currency)} · Thẻ{" "}
                      <strong className="font-semibold text-[var(--foreground)]">
                        {compactMoney(jarCardSpent.toFixed(0), currency)}
                      </strong>
                    </span>
                  )}
                </div>

                {overspent && donorJar && donorJar.jarCode !== jar.jarCode && (
                  <p className="rounded-lg bg-[color-mix(in_srgb,var(--warning)_12%,var(--surface))] px-2.5 py-1 text-[11px] font-medium text-[var(--warning)] tabular-nums">
                    Có thể bù từ hũ {FINANCIAL_JAR_LABELS[donorJar.jarCode]} (còn{" "}
                    {compactMoney(donorJar.remainingAmount, currency)})
                  </p>
                )}
              </div>

              {/* Bottom Row: Clean Editorial Hairline Footer */}
              <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2 text-xs">
                <button
                  type="button"
                  onKeyDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    window.dispatchEvent(
                      new CustomEvent("open-quick-transaction", {
                        detail: {
                          type: "expense",
                          categoryId: firstJarCat?.id,
                        },
                      }),
                    );
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)]/70 px-2.5 py-1 text-[11px] font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary-soft)]"
                >
                  <Plus className="size-3" aria-hidden="true" />
                  <span>Ghi chi</span>
                </button>

                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)] tabular-nums">
                  {jarTxCount > 0 ? (
                    <span>{jarTxCount} giao dịch</span>
                  ) : (
                    <span>{mappedCatsCount} danh mục</span>
                  )}
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Jar Deep-Dive Sheet */}
      {inspectedJar && (
        <JarDetailSheet
          open={Boolean(inspectedJar)}
          onOpenChange={(open) => {
            if (!open) setInspectedJarCode(null);
          }}
          jar={inspectedJar}
          month={month}
          includeForecast={includeForecast}
          remainingDays={isCurrentBusinessMonth ? remainingDays : 0}
          currency={currency}
          device={device}
          categories={jarCategories.filter(
            (cat) => cat.jarCode === inspectedJar.jarCode,
          )}
          transactions={monthTransactions.filter(
            (tx) => tx.jarCode === inspectedJar.jarCode,
          )}
          canEditAllocation={canEditAllocation}
          onEditAllocation={
            canEditAllocation && onEditAllocation
              ? () => {
                  setInspectedJarCode(null);
                  onEditAllocation();
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function JarDetailSheet({
  open,
  onOpenChange,
  jar,
  month,
  includeForecast,
  remainingDays,
  currency,
  device,
  categories,
  transactions,
  canEditAllocation,
  onEditAllocation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jar: PlanMonthJar;
  month: PlanMonth;
  includeForecast: boolean;
  remainingDays: number;
  currency: string;
  device: DeviceTier;
  categories: JarCategoryItem[];
  transactions: JarTransactionItem[];
  canEditAllocation?: boolean;
  onEditAllocation?: () => void;
}) {
  const sheetProps = getPlanSheetPresentation(device, "detail");
  const isMobile = device === "mobile";
  const [mobileSection, setMobileSection] = useState<
    "transactions" | "categories"
  >(() => (transactions.length > 0 ? "transactions" : "categories"));

  const remaining =
    jar.remainingAmount ??
    new Decimal(jar.allocatedAmount)
      .minus(jar.closedActualAmount ?? 0)
      .toFixed(0);
  const spent = jar.expenseAmount ?? jar.closedActualAmount ?? "0";
  const overspent = new Decimal(remaining).isNegative();
  const jarUsage = jarUsagePercentage(jar);
  const jarUsageTone = overspent ? "critical" : progressTone(jarUsage);
  const safeDaily =
    remainingDays > 0 && new Decimal(remaining).greaterThan(0)
      ? new Decimal(remaining).dividedToIntegerBy(remainingDays)
      : new Decimal(0);
  const firstJarCat = categories[0];

  const includedTransactions = useMemo(
    () =>
      transactions.filter((tx) =>
        month.closed
          ? tx.workflowStatus === "approved"
          : tx.workflowStatus === "approved" ||
            (includeForecast && tx.workflowStatus === "scheduled"),
      ),
    [transactions, month.closed, includeForecast],
  );

  const jarAssetSpent = useMemo(
    () =>
      Decimal.max(
        0,
        includedTransactions
          .filter((tx) => tx.walletKind !== "credit_card")
          .reduce((sum, tx) => sum.plus(tx.amount), new Decimal(0)),
      ),
    [includedTransactions],
  );

  const jarCardSpent = useMemo(
    () =>
      Decimal.max(
        0,
        includedTransactions
          .filter((tx) => tx.walletKind === "credit_card")
          .reduce((sum, tx) => sum.plus(tx.amount), new Decimal(0)),
      ),
    [includedTransactions],
  );

  const categoryBreakdown = useMemo(() => {
    const totals = new Map<
      string,
      { name: string; color: string | null; amount: Decimal; count: number }
    >();
    for (const cat of categories) {
      totals.set(cat.id, {
        name: cat.name,
        color: cat.color,
        amount: new Decimal(0),
        count: 0,
      });
    }
    for (const tx of includedTransactions) {
      const key = tx.categoryId ?? "__uncategorized__";
      const existing = totals.get(key) ?? {
        name: tx.categoryName,
        color: tx.categoryColor,
        amount: new Decimal(0),
        count: 0,
      };
      existing.amount = existing.amount.plus(tx.amount);
      existing.count += 1;
      totals.set(key, existing);
    }
    const spentDecimal = Decimal.max(new Decimal(spent), 0);
    return Array.from(totals.entries())
      .map(([id, item]) => {
        const share =
          spentDecimal.greaterThan(0) && item.amount.greaterThan(0)
            ? Decimal.min(
                100,
                item.amount.dividedBy(spentDecimal).times(100),
              ).toNumber()
            : 0;
        return {
          id,
          name: item.name,
          color: item.color,
          amount: Decimal.max(0, item.amount).toFixed(0),
          count: item.count,
          share,
        };
      })
      .sort((a, b) => new Decimal(b.amount).comparedTo(a.amount));
  }, [categories, includedTransactions, spent]);

  const categoriesBlock = (
    <section className="grid gap-2.5">
      {!isMobile && (
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            <Layers className="size-3.5 text-[var(--primary)]" />
            <span>Danh mục thuộc hũ ({categoryBreakdown.length})</span>
          </h4>
        </div>
      )}

      {categoryBreakdown.length === 0 ? (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-3.5 text-xs text-[var(--text-muted)]">
          Chưa có danh mục chi tiêu nào được gán vào hũ này.
        </p>
      ) : (
        <div
          className={cn(
            "grid gap-2",
            !isMobile && categoryBreakdown.length > 1 && "grid-cols-2",
          )}
        >
          {categoryBreakdown.map((cat) => (
            <div
              key={cat.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: cat.color || "var(--primary)",
                    }}
                    aria-hidden="true"
                  />
                  <span className="break-words text-xs font-semibold text-[var(--foreground)] sm:text-sm">
                    {cat.name}
                  </span>
                  {cat.count > 0 && (
                    <span className="rounded-md bg-[var(--surface-secondary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)] tabular-nums shrink-0">
                      {cat.count} GD
                    </span>
                  )}
                </div>
                <strong className="text-xs font-bold text-[var(--foreground)] tabular-nums shrink-0 sm:text-sm">
                  {money(cat.amount, currency)}
                </strong>
              </div>
              {cat.share > 0 && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                  <div
                    className="h-full rounded-full bg-[var(--primary)]"
                    style={{ width: `${Math.max(cat.share, 3)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const transactionsBlock = (
    <section
      className={cn(
        "grid gap-2.5",
        !isMobile && "border-t border-[var(--border)] pt-4",
      )}
    >
      {!isMobile && (
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            <ReceiptText className="size-3.5 text-[var(--primary)]" />
            <span>Giao dịch trong tháng ({transactions.length})</span>
          </h4>
        </div>
      )}

      {transactions.length === 0 ? (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-4 text-center text-xs text-[var(--text-muted)]">
          Chưa có giao dịch chi tiêu nào trong hũ này vào{" "}
          {monthLabel(month.month)}.
        </p>
      ) : (
        <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">
          {transactions.map((tx) => {
            const isCard = tx.walletKind === "credit_card";
            const txAmountDec = new Decimal(tx.amount);
            const isRefund = txAmountDec.isNegative();
            return (
              <div
                key={tx.id}
                className="flex items-start justify-between gap-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="break-words text-xs font-semibold leading-snug text-[var(--foreground)] sm:text-sm">
                      {tx.description || tx.categoryName}
                    </p>
                    {tx.isInstallment && (
                      <span className="rounded-md bg-[color-mix(in_srgb,var(--warning)_15%,var(--surface))] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--warning)]">
                        Trả góp
                      </span>
                    )}
                    {isRefund && (
                      <span className="rounded-md bg-[color-mix(in_srgb,var(--success)_15%,var(--surface))] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--success)]">
                        Hoàn tiền
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 break-words text-[11px] leading-snug text-[var(--text-muted)]">
                    {formatViDate(tx.date)} · {tx.categoryName} ·{" "}
                    <span
                      className={cn(
                        "font-medium",
                        isCard
                          ? "text-[var(--warning)]"
                          : "text-[var(--text-secondary)]",
                      )}
                    >
                      {isCard ? `Thẻ ${tx.walletName}` : `Ví ${tx.walletName}`}
                    </span>
                    {tx.workflowStatus === "pending"
                      ? " · Chờ duyệt"
                      : tx.workflowStatus === "scheduled"
                        ? " · Dự kiến"
                        : ""}
                  </p>
                </div>
                <strong
                  className={cn(
                    "text-xs font-bold tabular-nums shrink-0 sm:text-sm",
                    isRefund
                      ? "text-[var(--success)]"
                      : "text-[var(--foreground)]",
                  )}
                >
                  {isRefund
                    ? `−${money(txAmountDec.abs().toFixed(0), currency)}`
                    : money(txAmountDec.toFixed(0), currency)}
                </strong>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={sheetProps.side}
        placement={sheetProps.placement}
        size={sheetProps.size}
        className={sheetProps.className}
        spacing="flush"
        elevation="flat"
      >
        <SheetHeader
          icon={PieChart}
          title={`${FINANCIAL_JAR_LABELS[jar.jarCode]} (${jar.percentage}%)`}
          description={`${monthLabel(month.month)} · ${JAR_DESCRIPTIONS[jar.jarCode]}`}
        />

        <div
          className={cn(
            "grid min-h-0 flex-1 content-start overflow-y-auto",
            isMobile
              ? "gap-3.5 px-4 py-4"
              : "gap-4 px-5 py-5 lg:px-6",
          )}
        >
          {/* Summary Metrics: 2x2 on Mobile, 4-col strip on Tablet & Desktop */}
          <dl
            className={cn(
              "grid",
              isMobile ? "grid-cols-2 gap-2" : "grid-cols-2 gap-2.5 sm:grid-cols-4",
            )}
          >
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 sm:p-3">
              <dt className="break-words text-[11px] leading-snug text-[var(--text-secondary)]">
                Ngân sách hũ ({jar.percentage}%)
              </dt>
              <dd className="mt-1 text-sm font-bold text-[var(--foreground)] tabular-nums sm:text-base">
                {money(jar.allocatedAmount, currency)}
              </dd>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 sm:p-3">
              <dt className="break-words text-[11px] leading-snug text-[var(--text-secondary)]">
                Đã chi ({jarUsage.toFixed(0)}%)
              </dt>
              <dd
                className={cn(
                  "mt-1 text-sm font-bold tabular-nums sm:text-base",
                  PROGRESS_TEXT_TONES[jarUsageTone],
                )}
              >
                {money(spent, currency)}
              </dd>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 sm:p-3">
              <dt className="break-words text-[11px] leading-snug text-[var(--text-secondary)]">
                {overspent ? "Vượt hạn mức" : "Còn được tiêu"}
              </dt>
              <dd
                className={cn(
                  "mt-1 text-sm font-bold tabular-nums sm:text-base",
                  overspent
                    ? "text-[var(--destructive)]"
                    : "text-[var(--success)]",
                )}
              >
                {overspent
                  ? `−${money(new Decimal(remaining).abs().toFixed(0), currency)}`
                  : money(remaining, currency)}
              </dd>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 sm:p-3">
              <dt className="break-words text-[11px] leading-snug text-[var(--text-secondary)]">
                An toàn mỗi ngày
              </dt>
              <dd className="mt-1 text-sm font-bold text-[var(--foreground)] tabular-nums sm:text-base">
                {remainingDays > 0
                  ? `${money(safeDaily.toFixed(0), currency)}`
                  : "Kỳ đã qua"}
              </dd>
            </div>
          </dl>

          {/* Wallet vs Credit Card Split + 1-Tap Quick Record Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/60 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
              <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]">
                <Wallet className="size-3.5 text-[var(--primary)]" aria-hidden="true" />
                <span>Chi từ Ví:</span>
                <strong className="font-semibold text-[var(--foreground)]">
                  {money(jarAssetSpent.toFixed(0), currency)}
                </strong>
              </span>
              <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]">
                <CreditCard className="size-3.5 text-[var(--warning)]" aria-hidden="true" />
                <span>Chi qua Thẻ:</span>
                <strong className="font-semibold text-[var(--foreground)]">
                  {money(jarCardSpent.toFixed(0), currency)}
                </strong>
              </span>
            </div>

            <Button
              variant="default"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                window.dispatchEvent(
                  new CustomEvent("open-quick-transaction", {
                    detail: {
                      type: "expense",
                      categoryId: firstJarCat?.id,
                    },
                  }),
                );
              }}
              className="h-8 text-xs"
            >
              <Plus size={14} aria-hidden="true" />
              <span>Ghi chi</span>
            </Button>
          </div>

          {isMobile ? (
            <Tabs
              value={mobileSection}
              onValueChange={(value) =>
                setMobileSection(value as "transactions" | "categories")
              }
              className="w-full"
            >
              <TabsList variant="segmented" className="grid w-full grid-cols-2">
                <TabsTrigger value="transactions" variant="segmented">
                  <ReceiptText className="size-3.5" aria-hidden="true" />
                  <span>Giao dịch ({transactions.length})</span>
                </TabsTrigger>
                <TabsTrigger value="categories" variant="segmented">
                  <Layers className="size-3.5" aria-hidden="true" />
                  <span>Danh mục ({categoryBreakdown.length})</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="transactions" className="mt-3">
                {transactionsBlock}
              </TabsContent>
              <TabsContent value="categories" className="mt-3">
                {categoriesBlock}
              </TabsContent>
            </Tabs>
          ) : (
            <>
              {categoriesBlock}
              {transactionsBlock}
            </>
          )}
        </div>

        <SheetFooter
          onCancel={() => onOpenChange(false)}
          cancelLabel="Đóng"
          submitLabel={
            canEditAllocation && onEditAllocation
              ? "Điều chỉnh tỷ lệ 6 hũ"
              : "+ Ghi chi vào hũ này"
          }
          onSubmit={() => {
            if (canEditAllocation && onEditAllocation) {
              onEditAllocation();
              return;
            }
            onOpenChange(false);
            window.dispatchEvent(
              new CustomEvent("open-quick-transaction", {
                detail: {
                  type: "expense",
                  categoryId: firstJarCat?.id,
                },
              }),
            );
          }}
          submitType="button"
        />
      </SheetContent>
    </Sheet>
  );
}

function BudgetJarList({
  month,
  currency,
  device = "desktop",
}: {
  month: PlanMonth;
  currency: string;
  device?: DeviceTier;
}) {
  return (
    <div
      className={cn(
        "grid",
        device === "mobile" ? "grid-cols-1 gap-2.5" : "grid-cols-2 gap-3",
      )}
    >
      {month.jars.map((jar) => {
        const remaining =
          jar.remainingAmount ??
          new Decimal(jar.allocatedAmount)
            .minus(jar.closedActualAmount ?? 0)
            .toFixed(0);
        const spent = jar.expenseAmount ?? jar.closedActualAmount ?? "0";
        const overspent = new Decimal(remaining).isNegative();
        const jarUsage = jarUsagePercentage(jar);
        const jarUsageTone = overspent ? "critical" : progressTone(jarUsage);
        const color = JAR_COLORS[jar.jarCode];

        return (
          <div
            key={jar.jarCode}
            className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2">
                <span
                  className="mt-1.5 size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                  {FINANCIAL_JAR_LABELS[jar.jarCode]}
                </span>
              </div>
              <span className="rounded-md bg-[var(--surface-secondary)] px-1.5 py-0.5 text-xs font-medium text-[var(--text-secondary)] tabular-nums shrink-0">
                {jar.percentage}%
              </span>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)]">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  PROGRESS_BAR_TONES[jarUsageTone],
                )}
                style={{ width: `${jarUsage}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
              <span className="break-words text-[var(--text-muted)]">
                Đã chi:{" "}
                <strong className="font-medium text-[var(--foreground)]">
                  {money(spent, currency)}
                </strong>{" "}
                / {money(jar.allocatedAmount, currency)}
              </span>
              <span
                className={cn(
                  "font-semibold shrink-0",
                  overspent
                    ? "text-[var(--destructive)]"
                    : "text-[var(--success)]",
                )}
              >
                {overspent
                  ? `Vượt ${money(new Decimal(remaining).abs().toFixed(0), currency)}`
                  : `Còn ${money(remaining, currency)}`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthHistory({
  months,
  currency,
  device = "desktop",
  onInspectInJarsTab,
}: {
  months: PlanMonth[];
  currency: string;
  device?: DeviceTier;
  onInspectInJarsTab?: (monthKey: string) => void;
}) {
  const [selectedMonth, setSelectedMonth] = useState<PlanMonth | null>(null);
  const unclosedMonth = months.find((m) => !m.closed);
  const monthSheetProps = getPlanSheetPresentation(device, "detail");

  return (
    <Card>
      <CardHeader className="border-b border-[var(--border)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2">
              <History
                className="size-4.5 text-[var(--primary)]"
                aria-hidden="true"
              />
              <span>Lộ trình ngân sách theo tháng</span>
            </CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              Theo dõi mức tiết kiệm, ngân sách chi tiêu và ngân sách còn lại
              của từng tháng. Nhấn vào tháng bất kỳ để xem chi tiết 6 hũ.
            </CardDescription>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--surface-secondary)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text-secondary)] tabular-nums">
            {months.length} tháng
          </span>
        </div>
      </CardHeader>

      <CardContent className="divide-y divide-[var(--border)]">
        {months.map((month) => {
          const isNegativeAvailable = new Decimal(
            month.availableToSpend,
          ).isNegative();
          const hasShortfall = new Decimal(month.resourceShortfall).greaterThan(
            0,
          );
          const isCurrent =
            !month.closed && month.month === unclosedMonth?.month;

          return (
            <div
              key={month.month}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedMonth(month)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedMonth(month);
                }
              }}
              aria-label={`Xem chi tiết 6 hũ ${monthLabel(month.month)}`}
              className="flex cursor-pointer flex-col gap-3 rounded-xl px-2 py-3.5 transition-colors first:pt-2 last:pb-2 hover:bg-[var(--surface-secondary)]/50 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm font-semibold text-[var(--foreground)]">
                    {monthLabel(month.month)}
                  </strong>
                  {isCurrent && (
                    <span className="rounded-md bg-[var(--primary-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--primary)]">
                      Tháng hiện tại
                    </span>
                  )}
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs font-medium",
                      month.closed
                        ? "bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))] text-[var(--success)]"
                        : "bg-[var(--surface-secondary)] text-[var(--text-muted)]",
                    )}
                  >
                    {month.closed ? "Đã chốt sổ" : "Dự kiến"}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                  <span className="tabular-nums">
                    Cần tiết kiệm:{" "}
                    <strong className="font-semibold text-[var(--foreground)]">
                      {money(month.adjustedRequiredAmount, currency)}
                    </strong>
                  </span>
                  <span className="tabular-nums">
                    Ngân sách chi tiêu tháng:{" "}
                    <strong className="font-semibold text-[var(--foreground)]">
                      {money(month.allocatableGrossBudget, currency)}
                    </strong>
                  </span>
                  {hasShortfall && (
                    <span className="font-semibold text-[var(--warning)] tabular-nums">
                      Cần bù thêm: {money(month.resourceShortfall, currency)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2.5 md:shrink-0 md:justify-end">
                <div className="text-left md:text-right">
                  <span className="block text-[11px] text-[var(--text-muted)]">
                    Ngân sách còn lại
                  </span>
                  <strong
                    className={cn(
                      "text-sm font-bold tabular-nums shrink-0",
                      isNegativeAvailable
                        ? "text-[var(--destructive)]"
                        : "text-[var(--foreground)]",
                    )}
                  >
                    {isNegativeAvailable
                      ? `−${money(new Decimal(month.availableToSpend).abs().toFixed(0), currency)}`
                      : money(month.availableToSpend, currency)}
                  </strong>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedMonth(month);
                    }}
                    onKeyDown={(event) => event.stopPropagation()}
                    aria-label={`Chi tiết 6 hũ ${monthLabel(month.month)}`}
                    title={`Xem chi tiết 6 hũ ${monthLabel(month.month)}`}
                    className="h-8 gap-1.5 px-2.5 text-xs"
                  >
                    <PieChart size={14} aria-hidden="true" />
                    <span className="hidden sm:inline">6 Hũ</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>

      {/* Month Detail Sheet */}
      <Sheet
        open={selectedMonth !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedMonth(null);
        }}
      >
        <SheetContent
          side={monthSheetProps.side}
          placement={monthSheetProps.placement}
          size={monthSheetProps.size}
          className={monthSheetProps.className}
          spacing="flush"
          elevation="flat"
        >
          {selectedMonth && (
            <>
              <SheetHeader
                icon={CalendarClock}
                title={`Chi tiết ${monthLabel(selectedMonth.month)}`}
                description={
                  selectedMonth.closed
                    ? "Số liệu đã chốt cuối tháng"
                    : "Số liệu phân bổ và chi tiêu trong tháng"
                }
              />
              <MonthSheetDetail
                month={selectedMonth}
                currency={currency}
                device={device}
              />
              <SheetFooter
                onCancel={() => setSelectedMonth(null)}
                cancelLabel="Đóng"
                submitLabel={
                  onInspectInJarsTab ? "Mở trong tab 6 Hũ chi tiêu" : undefined
                }
                onSubmit={
                  onInspectInJarsTab
                    ? () => {
                        const targetKey = selectedMonth.month;
                        setSelectedMonth(null);
                        onInspectInJarsTab(targetKey);
                      }
                    : undefined
                }
                submitType="button"
              />
            </>
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}

function MonthSheetDetail({
  month,
  currency,
  device = "desktop",
}: {
  month: PlanMonth;
  currency: string;
  device?: DeviceTier;
}) {
  const availableToSpend = new Decimal(month.availableToSpend);
  const hasShortfall = new Decimal(month.resourceShortfall).greaterThan(0);
  const savedAmount =
    month.closedActualGoalAmount ?? month.projectedActualGoalAmount ?? "0";
  const isMobile = device === "mobile";

  return (
    <div
      className={cn(
        "grid min-h-0 flex-1 content-start overflow-y-auto",
        isMobile ? "gap-3.5 px-4 py-4" : "gap-4 px-5 py-5 lg:px-6",
      )}
    >
      <dl className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 sm:p-3.5">
          <dt className="break-words text-[11px] leading-snug text-[var(--text-secondary)] sm:text-xs">
            Cần tiết kiệm
          </dt>
          <dd className="mt-1 text-sm font-bold text-[var(--foreground)] tabular-nums shrink-0 sm:text-base">
            {money(month.adjustedRequiredAmount, currency)}
          </dd>
          <small className="mt-0.5 block text-[11px] text-[var(--text-muted)] tabular-nums sm:text-xs">
            Đã tiết kiệm: {money(savedAmount, currency)}
          </small>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 sm:p-3.5">
          <dt className="break-words text-[11px] leading-snug text-[var(--text-secondary)] sm:text-xs">
            Ngân sách chi tiêu tháng
          </dt>
          <dd className="mt-1 text-sm font-bold text-[var(--foreground)] tabular-nums shrink-0 sm:text-base">
            {money(month.allocatableGrossBudget, currency)}
          </dd>
          <small className="mt-0.5 block text-[11px] text-[var(--text-muted)] tabular-nums sm:text-xs">
            Còn lại:{" "}
            <span
              className={cn(
                "font-semibold",
                availableToSpend.isNegative()
                  ? "text-[var(--destructive)]"
                  : "text-[var(--foreground)]",
              )}
            >
              {availableToSpend.isNegative()
                ? `−${money(availableToSpend.abs().toFixed(0), currency)}`
                : money(month.availableToSpend, currency)}
            </span>
          </small>
        </div>
      </dl>

      {hasShortfall && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--warning)_30%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_10%,var(--surface))] px-3.5 py-2.5 text-xs font-medium text-[var(--warning)]">
          <span>Cần bù thêm tháng này</span>
          <strong className="tabular-nums shrink-0">
            {money(month.resourceShortfall, currency)}
          </strong>
        </div>
      )}

      {month.closed && month.adjustedDelta && month.adjustedDelta !== "0" && (
        <p className="text-xs leading-5 text-[var(--warning)]">
          Đã điều chỉnh {money(month.adjustedDelta, currency)} theo chênh lệch
          thu chi thực tế khi chốt sổ.
        </p>
      )}

      {month.jars && month.jars.length > 0 && (
        <section className="grid gap-3 border-t border-[var(--border)] pt-3.5">
          <h4 className="text-sm font-semibold text-[var(--foreground)]">
            Phân bổ 6 hũ ({monthLabel(month.month)})
          </h4>
          <BudgetJarList month={month} currency={currency} device={device} />
        </section>
      )}
    </div>
  );
}

function PlanSheetHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Target;
  title: string;
  description: string;
}) {
  return <SheetHeader icon={Icon} title={title} description={description} />;
}

function PlanEditorSheet({
  open,
  onOpenChange,
  businessMonth,
  plan,
  canAutoActivate,
  hasMultipleGoals,
  device,
  disabled,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessMonth: string;
  plan: DraftView | null;
  canAutoActivate?: boolean;
  hasMultipleGoals: boolean;
  device: DeviceTier;
  disabled: boolean;
  onSaved: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"info" | "ratios">("info");
  const sheetProps = getPlanSheetPresentation(device, "detail");
  const isMobile = device === "mobile";
  const isTablet = device === "tablet";
  const initial = useMemo<EditorDraft>(
    () =>
      plan
        ? {
            name: plan.name,
            targetAmount: plan.targetAmount,
            existingGoalAmount: plan.existingGoalAmount,
            targetMonth: plan.targetMonth,
            percentages: { ...plan.percentages },
          }
        : {
            name: "",
            targetAmount: "",
            existingGoalAmount: "0",
            targetMonth: nextMonth(businessMonth),
            percentages: { ...DEFAULT_RATIOS },
          },
    [plan, businessMonth],
  );
  const [draft, setDraft] = useState(initial);
  const total = ratioTotal(draft.percentages);
  const hideExistingGoalAmount =
    hasMultipleGoals ||
    (plan?.financialGoals?.length === 1 &&
      plan.financialGoals[0]?.trackingMode === "linked_wallet");
  const hasPositiveTarget = useMemo(() => {
    try {
      return new Decimal(draft.targetAmount || 0).gt(0);
    } catch {
      return false;
    }
  }, [draft.targetAmount]);
  const minPlanTargetMonth = businessMonth;
  const valid = Boolean(
    draft.name.trim() &&
      (hasMultipleGoals ||
        (hasPositiveTarget && draft.targetMonth >= minPlanTargetMonth)) &&
      total.equals(100),
  );

  function submit(activateImmediately: boolean) {
    startTransition(async () => {
      if (plan) {
        const result = await updateFinancialPlanDraftAction({
          ...draft,
          existingGoalAmount: hideExistingGoalAmount ? "0" : draft.existingGoalAmount,
          planId: plan.id,
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success("Đã cập nhật bản nháp.");
        onSaved(plan.id);
        return;
      }

      const createPayload = {
        name: draft.name,
        goals: [
          {
            name: draft.name,
            targetAmount: draft.targetAmount,
            existingAmount: draft.existingGoalAmount,
            targetMonth: draft.targetMonth,
            trackingMode: "manual" as const,
            linkedWalletId: null,
          },
        ],
        percentages: draft.percentages,
      };

      const result = activateImmediately
        ? await createAndActivateFinancialPlanAction(createPayload)
        : await createFinancialPlanWithGoalsAction(createPayload);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (activateImmediately && "activated" in result && !result.activated) {
        const warningMessage =
          "message" in result && typeof result.message === "string" && result.message
            ? `Đã lưu bản nháp nhưng chưa thể kích hoạt: ${result.message}`
            : "Đã lưu bản nháp kế hoạch.";
        toast.warning(warningMessage);
      } else {
        toast.success(
          activateImmediately && "activated" in result && result.activated
            ? "Đã tạo và kích hoạt kế hoạch tài chính."
            : "Đã tạo bản nháp kế hoạch.",
        );
      }
      onSaved("id" in result ? String(result.id) : "");
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={sheetProps.side}
        placement={sheetProps.placement}
        size={sheetProps.size}
        className={sheetProps.className}
        spacing="flush"
        elevation="flat"
      >
        <PlanSheetHeader
          icon={Target}
          title={plan ? "Chỉnh sửa bản nháp" : "Tạo kế hoạch tài chính"}
          description="Thiết lập mục tiêu tích lũy, thời hạn hoàn thành và tỷ lệ phân bổ 6 hũ chi tiêu."
        />
        <div
          className={cn(
            "grid min-h-0 flex-1 content-start overflow-y-auto",
            isMobile
              ? "gap-4 px-4 py-4"
              : "gap-5 px-5 py-5 lg:px-6",
          )}
        >
          {isMobile ? (
            <Tabs
              value={activeTab}
              onValueChange={(val) => setActiveTab(val as "info" | "ratios")}
              className="w-full"
            >
              <TabsList variant="segmented" className="grid w-full grid-cols-2">
                <TabsTrigger value="info" variant="segmented">
                  <Target className="size-3.5" aria-hidden="true" />
                  <span>1. Thông tin</span>
                </TabsTrigger>
                <TabsTrigger value="ratios" variant="segmented">
                  <PieChart className="size-3.5" aria-hidden="true" />
                  <span>2. 6 Hũ chi tiêu</span>
                  {!total.equals(100) && (
                    <TabsCount>{total.toString()}%</TabsCount>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-3">
                <div className="space-y-4">
                  <Input
                    label="Tên kế hoạch"
                    required
                    value={draft.name}
                    onChange={(event) =>
                      setDraft({ ...draft, name: event.target.value })
                    }
                    placeholder="Ví dụ: Kế hoạch tích lũy năm nay"
                  />
                  {!hasMultipleGoals && (
                    <MonthPicker
                      label="Tháng hoàn thành dự kiến"
                      required
                      minMonth={minPlanTargetMonth}
                      value={draft.targetMonth}
                      onValueChange={(targetMonth) =>
                        setDraft({ ...draft, targetMonth })
                      }
                      disabled={isPending}
                    />
                  )}
                  {!hasMultipleGoals && (
                    <MoneyInput
                      label="Số tiền mục tiêu"
                      required
                      value={draft.targetAmount}
                      onValueChange={(targetAmount) =>
                        setDraft({ ...draft, targetAmount })
                      }
                    />
                  )}
                  {!hideExistingGoalAmount && (
                    <MoneyInput
                      label="Số tiền đã có sẵn"
                      value={draft.existingGoalAmount}
                      onValueChange={(existingGoalAmount) =>
                        setDraft({ ...draft, existingGoalAmount })
                      }
                    />
                  )}
                  {!hasMultipleGoals ? (
                    <DraftFeasibilityPreview
                      draft={draft}
                      businessMonth={businessMonth}
                    />
                  ) : (
                    <p className="text-sm leading-6 text-[var(--text-secondary)]">
                      Số tiền và thời hạn được chỉnh riêng trong từng mục tiêu
                      tích lũy.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="ratios" className="mt-3">
                <RatioEditor
                  ratios={draft.percentages}
                  columns={1}
                  onChange={(percentages) =>
                    setDraft({ ...draft, percentages })
                  }
                />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="grid gap-5">
              <div className="grid gap-4">
                <div
                  className={cn(
                    "grid gap-4",
                    !hasMultipleGoals && "grid-cols-2",
                  )}
                >
                  <Input
                    label="Tên kế hoạch"
                    required
                    value={draft.name}
                    onChange={(event) =>
                      setDraft({ ...draft, name: event.target.value })
                    }
                    placeholder="Ví dụ: Kế hoạch tích lũy năm nay"
                  />
                  {!hasMultipleGoals && (
                    <MonthPicker
                      label="Tháng hoàn thành dự kiến"
                      required
                      minMonth={minPlanTargetMonth}
                      value={draft.targetMonth}
                      onValueChange={(targetMonth) =>
                        setDraft({ ...draft, targetMonth })
                      }
                      disabled={isPending}
                    />
                  )}
                </div>
                {!hasMultipleGoals && (
                  <div
                    className={cn(
                      "grid gap-4",
                      !hideExistingGoalAmount && "grid-cols-2",
                    )}
                  >
                    <MoneyInput
                      label="Số tiền mục tiêu"
                      required
                      value={draft.targetAmount}
                      onValueChange={(targetAmount) =>
                        setDraft({ ...draft, targetAmount })
                      }
                    />
                    {!hideExistingGoalAmount && (
                      <MoneyInput
                        label="Số tiền đã có sẵn"
                        value={draft.existingGoalAmount}
                        onValueChange={(existingGoalAmount) =>
                          setDraft({ ...draft, existingGoalAmount })
                        }
                      />
                    )}
                  </div>
                )}
                {!hasMultipleGoals ? (
                  <DraftFeasibilityPreview
                    draft={draft}
                    businessMonth={businessMonth}
                  />
                ) : (
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">
                    Số tiền và thời hạn được chỉnh riêng trong từng mục tiêu
                    tích lũy.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4 md:p-4.5">
                <RatioEditor
                  ratios={draft.percentages}
                  columns={isTablet ? 2 : 1}
                  onChange={(percentages) =>
                    setDraft({ ...draft, percentages })
                  }
                />
              </div>
            </div>
          )}

          {!plan && canAutoActivate && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/60 px-3.5 py-2.5 text-xs">
              <span className="text-[var(--text-secondary)]">
                Muốn lưu nháp để chỉnh sửa thêm sau?
              </span>
              <button
                type="button"
                disabled={disabled || isPending || !valid}
                onClick={() => submit(false)}
                className="font-semibold text-[var(--primary)] hover:underline disabled:opacity-40"
              >
                Chỉ lưu bản nháp
              </button>
            </div>
          )}
        </div>
        <SheetFooter
          onCancel={() => onOpenChange(false)}
          cancelLabel="Hủy"
          submitLabel={
            plan
              ? "Lưu bản nháp"
              : canAutoActivate
                ? "Tạo & Kích hoạt ngay"
                : "Tạo bản nháp"
          }
          isSubmitting={isPending}
          submittingLabel={plan ? "Đang lưu..." : "Đang tạo..."}
          submitDisabled={disabled || isPending || !valid}
          onSubmit={() => submit(Boolean(!plan && canAutoActivate))}
          submitType="button"
        />
      </SheetContent>
    </Sheet>
  );
}

function DraftFeasibilityPreview({
  draft,
  businessMonth,
}: {
  draft: EditorDraft;
  businessMonth: string;
}) {
  let remaining = new Decimal(0);
  try {
    remaining = Decimal.max(
      new Decimal(draft.targetAmount || 0).minus(
        draft.existingGoalAmount || 0,
      ),
      0,
    );
  } catch {
    remaining = new Decimal(0);
  }
  const months = draft.targetMonth
    ? monthCountInclusive(businessMonth, draft.targetMonth)
    : 1;
  const monthly = remaining.dividedToIntegerBy(months);
  return (
    <div
      className="grid gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-[var(--text-secondary)]">
          Mục tiêu tiết kiệm tháng này (dự kiến)
        </span>
        <strong className="text-sm font-bold text-[var(--foreground)] tabular-nums shrink-0">
          {formatAmount(monthly.toFixed(0))} ₫ / tháng
        </strong>
      </div>
      <p className="text-xs leading-5 text-[var(--text-muted)]">
        Lộ trình {months} tháng ({shortMonthLabel(businessMonth)} →{" "}
        {shortMonthLabel(draft.targetMonth || nextMonth(businessMonth))}). Sau
        khi tạo, bạn có thể thêm nhiều mục tiêu tích lũy khác.
      </p>
    </div>
  );
}

function DeadlineSheet({
  open,
  onOpenChange,
  plan,
  currency = "VND",
  device,
  disabled,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: RunningView;
  currency?: string;
  device: DeviceTier;
  disabled: boolean;
  onSave: (month: string) => void;
}) {
  const [targetMonth, setTargetMonth] = useState(plan.targetMonth);
  const sheetProps = getPlanSheetPresentation(device, "compact");
  const isMobile = device === "mobile";

  const remainingToSave = useMemo(
    () =>
      Decimal.max(
        new Decimal(plan.targetAmount || 0).minus(plan.realizedProgress || 0),
        0,
      ),
    [plan.targetAmount, plan.realizedProgress],
  );
  const openMonthsCount = useMemo(
    () =>
      targetMonth >= plan.businessMonth
        ? monthCountInclusive(plan.businessMonth, targetMonth)
        : 1,
    [plan.businessMonth, targetMonth],
  );
  const estimatedMonthlyRequired = useMemo(
    () => remainingToSave.dividedToIntegerBy(openMonthsCount),
    [remainingToSave, openMonthsCount],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={sheetProps.side}
        placement={sheetProps.placement}
        size={sheetProps.size}
        className={sheetProps.className}
        spacing="flush"
        elevation="flat"
      >
        <PlanSheetHeader
          icon={CalendarClock}
          title="Đổi thời hạn hoàn thành"
          description="Số liệu các tháng đã chốt được giữ nguyên. Mức tiết kiệm hàng tháng sẽ tự động tính lại cho các tháng còn lại."
        />
        <div
          className={cn(
            "grid min-h-0 flex-1 content-start overflow-y-auto",
            isMobile ? "gap-4 px-4 py-4" : "gap-5 px-5 py-5 lg:px-6",
          )}
        >
          <MonthPicker
            label="Tháng hoàn thành mới"
            required
            minMonth={plan.businessMonth}
            value={targetMonth}
            onValueChange={setTargetMonth}
            disabled={disabled}
          />

          <div
            className="grid gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5 text-xs"
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[var(--text-secondary)]">
                Thời hạn hiện tại → Thời hạn mới
              </span>
              <strong className="font-semibold text-[var(--foreground)] tabular-nums shrink-0">
                {shortMonthLabel(plan.targetMonth)} →{" "}
                <span className="text-[var(--primary)]">
                  {shortMonthLabel(targetMonth)}
                </span>{" "}
                ({openMonthsCount} tháng còn lại)
              </strong>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-2">
              <span className="text-[var(--text-secondary)]">
                Cần tiết kiệm dự kiến mỗi tháng
              </span>
              <strong className="text-sm font-bold text-[var(--foreground)] tabular-nums shrink-0">
                ~ {money(estimatedMonthlyRequired.toFixed(0), currency)} / tháng
              </strong>
            </div>
          </div>
        </div>
        <SheetFooter
          onCancel={() => onOpenChange(false)}
          cancelLabel="Hủy"
          submitLabel="Lưu thay đổi"
          submitDisabled={
            disabled ||
            targetMonth < plan.businessMonth ||
            targetMonth === plan.targetMonth
          }
          onSubmit={() => onSave(targetMonth)}
          submitType="button"
        />
      </SheetContent>
    </Sheet>
  );
}

function AllocationSheet({
  open,
  onOpenChange,
  initialRatios,
  referenceBudget,
  currency = "VND",
  device,
  disabled,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRatios: RatioDraft;
  referenceBudget?: string;
  currency?: string;
  device: DeviceTier;
  disabled: boolean;
  onSave: (ratios: RatioDraft) => void;
}) {
  const [ratios, setRatios] = useState(initialRatios);
  const total = ratioTotal(ratios);
  const sheetProps = getPlanSheetPresentation(device, "form");
  const isMobile = device === "mobile";
  const isTablet = device === "tablet";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={sheetProps.side}
        placement={sheetProps.placement}
        size={sheetProps.size}
        className={sheetProps.className}
        spacing="flush"
        elevation="flat"
      >
        <PlanSheetHeader
          icon={SlidersHorizontal}
          title="Tỷ lệ phân bổ 6 hũ"
          description="Tỷ lệ mới sẽ áp dụng từ tháng sau."
        />
        <div
          className={cn(
            "grid min-h-0 flex-1 content-start overflow-y-auto",
            isMobile ? "gap-3 px-4 py-3.5" : "gap-4 px-5 py-4 lg:px-6",
          )}
        >
          <RatioEditor
            ratios={ratios}
            referenceBudget={referenceBudget}
            currency={currency}
            columns={isTablet ? 2 : 1}
            onChange={setRatios}
          />
        </div>
        <SheetFooter
          onCancel={() => onOpenChange(false)}
          cancelLabel="Hủy"
          submitLabel="Áp dụng từ tháng sau"
          submitDisabled={disabled || !total.equals(100)}
          onSubmit={() => onSave(ratios)}
          submitType="button"
        />
      </SheetContent>
    </Sheet>
  );
}

function RatioEditor({
  ratios,
  referenceBudget,
  currency = "VND",
  columns = 1,
  onChange,
}: {
  ratios: RatioDraft;
  referenceBudget?: string;
  currency?: string;
  columns?: 1 | 2;
  onChange: (ratios: RatioDraft) => void;
}) {
  const ratioEditorId = useId();
  const total = ratioTotal(ratios);
  const is100 = total.equals(100);
  const diff = total.minus(100);

  const budgetDecimal = useMemo(() => {
    try {
      const parsed = new Decimal(referenceBudget || 0);
      return parsed.greaterThan(0) ? parsed : null;
    } catch {
      return null;
    }
  }, [referenceBudget]);

  function adjustRatio(jarCode: FinancialJarCode, amount: number): void {
    const current = new Decimal(ratios[jarCode] || 0);
    const next = Decimal.max(0, Decimal.min(100, current.plus(amount)));
    onChange({ ...ratios, [jarCode]: next.toString() });
  }

  return (
    <fieldset className="grid gap-2.5">
      <legend className="sr-only">Phân bổ tỷ lệ 6 hũ chi tiêu</legend>

      {/* Unified Master Allocation & Presets Strip */}
      <div className="grid gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/55 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              Tổng phân bổ
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums",
                is100
                  ? "bg-[color-mix(in_srgb,var(--success)_15%,var(--surface))] text-[var(--success)]"
                  : "bg-[color-mix(in_srgb,var(--warning)_15%,var(--surface))] text-[var(--warning)]",
              )}
            >
              {is100
                ? "100% · Chuẩn"
                : diff.isNegative()
                  ? `${total.toString()}% · Thiếu ${diff.abs().toString()}%`
                  : `${total.toString()}% · Dư ${diff.toString()}%`}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_RATIOS })}
            aria-label="Khôi phục tỷ lệ mặc định"
            title="Khôi phục tỷ lệ mặc định"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--foreground)]"
          >
            <RotateCcw className="size-3" aria-hidden="true" />
            <span>Mặc định</span>
          </button>
        </div>

        {/* Stacked 6-color progress bar */}
        <div
          className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-[var(--background)]"
          aria-hidden="true"
        >
          {FINANCIAL_JAR_CODES.map((jarCode) => {
            const pct = Number(ratios[jarCode] || 0);
            return (
              <div
                key={jarCode}
                className="h-full transition-all duration-300 ease-out first:rounded-l-full last:rounded-r-full"
                style={{
                  flex: pct,
                  backgroundColor:
                    pct > 0 ? JAR_COLORS[jarCode] : "transparent",
                }}
              />
            );
          })}
        </div>

        {/* 1-Row 3-Column Segmented Presets */}
        <div className="grid grid-cols-3 gap-1.5">
          {RATIO_PRESETS.map((preset) => {
            const isMatched = FINANCIAL_JAR_CODES.every(
              (code) => ratios[code] === preset.ratios[code],
            );
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange({ ...preset.ratios })}
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-center transition-colors",
                  isMatched
                    ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--foreground)]",
                )}
              >
                <span className="inline-flex items-center gap-1 text-[11px] font-bold leading-tight">
                  <Sparkles className="size-2.5 shrink-0" aria-hidden="true" />
                  <span>{preset.shortLabel}</span>
                </span>
                <span className="mt-0.5 text-[10px] opacity-75 tabular-nums">
                  {preset.formula}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Compact 6-Jar Tactile Rows */}
      <div
        className={cn(
          "grid",
          columns === 2 ? "grid-cols-2 gap-2" : "grid-cols-1 gap-1.5",
        )}
      >
        {FINANCIAL_JAR_CODES.map((jarCode) => {
          const label = FINANCIAL_JAR_LABELS[jarCode];
          const current = new Decimal(ratios[jarCode] || 0);
          const labelId = `${ratioEditorId}-${jarCode.toLowerCase()}`;
          const color = JAR_COLORS[jarCode];
          const estimatedAmount = budgetDecimal
            ? budgetDecimal.times(current).dividedToIntegerBy(100)
            : null;

          return (
            <div
              key={jarCode}
              className="flex items-center justify-between gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 transition-colors"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span
                      id={labelId}
                      className="break-words text-xs font-bold leading-snug text-[var(--foreground)] sm:text-sm"
                    >
                      {label}
                    </span>
                    {estimatedAmount && (
                      <span className="text-[11px] font-semibold text-[var(--primary)] tabular-nums">
                        ~ {compactMoney(estimatedAmount.toFixed(0), currency)}
                      </span>
                    )}
                  </div>
                  <span className="block break-words text-[11px] leading-snug text-[var(--text-muted)]">
                    {JAR_SHORT_DESCRIPTIONS[jarCode]}
                  </span>
                </div>
              </div>

              {/* Unified Tactile Stepper Capsule */}
              <div
                className="inline-flex shrink-0 items-center rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/75 p-0.5"
                role="group"
                aria-labelledby={labelId}
              >
                <button
                  type="button"
                  aria-label={`Giảm ${label} 5%`}
                  disabled={current.lessThanOrEqualTo(0)}
                  onClick={() => adjustRatio(jarCode, -5)}
                  className="grid size-7 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)] active:scale-95 disabled:opacity-30"
                >
                  <Minus className="size-3.5" aria-hidden="true" />
                </button>

                <output className="w-11 text-center text-xs font-bold text-[var(--foreground)] tabular-nums sm:text-sm">
                  {current.toString()}%
                </output>

                <button
                  type="button"
                  aria-label={`Tăng ${label} 5%`}
                  disabled={current.greaterThanOrEqualTo(100)}
                  onClick={() => adjustRatio(jarCode, 5)}
                  className="grid size-7 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)] active:scale-95 disabled:opacity-30"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

