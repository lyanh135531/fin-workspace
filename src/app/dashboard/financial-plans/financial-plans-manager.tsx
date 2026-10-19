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
  ArrowUpRight,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleX,
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

function subscribeDesktop(callback: () => void) {
  const query = window.matchMedia("(min-width: 768px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function desktopSnapshot() {
  return window.matchMedia("(min-width: 768px)").matches;
}

function serverDesktopSnapshot() {
  return false;
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
  memberName: string;
  categoryId: string | null;
  categoryName: string;
  categoryColor: string | null;
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
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    desktopSnapshot,
    serverDesktopSnapshot,
  );
  const isMobile = !isDesktop;
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
              side={isMobile ? "bottom" : "right"}
              placement={isMobile ? "edge" : "inset"}
              size="md"
              spacing="flush"
              elevation="flat"
            >
              <SheetHeader
                icon={CalendarRange}
                title="Danh sách kế hoạch"
                description={`Quản lý các kế hoạch tài chính của ${workspaceName}.`}
              />
              <nav
                aria-label="Danh sách kế hoạch"
                className="grid min-h-0 flex-1 content-start gap-2.5 overflow-y-auto px-4 py-4 md:px-6"
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
            presentation={isMobile ? "sheet" : "popover"}
            ariaLabel={
              deleteCandidate
                ? `Xóa kế hoạch ${deleteCandidate.name}`
                : "Xóa kế hoạch"
            }
            title="Xóa kế hoạch?"
            description="Kế hoạch sẽ bị xóa khỏi danh sách. Các số liệu tài chính đã chốt vẫn được lưu trong hệ thống."
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
                  ? "Thiết lập mục tiêu tiết kiệm, chọn thời hạn hoàn thành và tỷ lệ phân bổ 6 hũ. Hệ thống sẽ tự động tính ngân sách chi tiêu tháng từ thu nhập và số dư thực tế."
                  : "Quản trị viên chưa thiết lập kế hoạch tài chính cho nhóm này."
              }
              action={
                canManage ? (
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
              isMobile={isMobile}
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
            jarCategories={jarCategories}
            jarTransactions={jarTransactions}
            currentMonth={currentPlanMonth}
            isMobile={isMobile}
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
          isMobile={isMobile}
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
              isMobile={isMobile}
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
              isMobile={isMobile}
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
  isMobile,
  disabled,
  onEdit,
  onOpenPlanPicker,
  onActivate,
  onDelete,
}: {
  plan: DraftView;
  plans: PlanListItem[];
  currency: string;
  isMobile: boolean;
  disabled: boolean;
  onEdit: () => void;
  onOpenPlanPicker: () => void;
  onActivate: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draftMenuOpen, setDraftMenuOpen] = useState(false);

  function handleDraftMenuOpenChange(nextOpen: boolean) {
    if (
      nextOpen &&
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(min-width: 1024px)").matches
    ) {
      return;
    }
    setDraftMenuOpen(nextOpen);
  }

  const draftHeaderContent = (
    <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-3.5 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--warning)_15%,var(--surface))] px-2.5 py-0.5 text-xs font-semibold text-[var(--warning)]">
            <Pencil className="size-3" aria-hidden="true" />
            <span>Bản nháp kế hoạch</span>
          </span>
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            Hạn dự kiến: {monthLabel(plan.targetMonth)}
          </span>
        </div>
        <h2 className="mt-1.5 break-words text-lg font-bold leading-snug tracking-tight text-[var(--foreground)] md:text-xl">
          {plan.name}
        </h2>
        <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-secondary)]">
          Kiểm tra mục tiêu và tỷ lệ phân bổ 6 hũ trước khi kích hoạt.
        </p>
      </div>

      <div
        className="flex shrink-0 flex-wrap items-center gap-1.5"
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
          >
            <CheckCircle2 size={15} aria-hidden="true" />
            <span>Kích hoạt ngay</span>
          </Button>
        )}
        <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-1">
          {plans.length > 1 && (
            <Button
              variant="icon"
              size="icon"
              onClick={onOpenPlanPicker}
              disabled={disabled}
              aria-label={`Đổi kế hoạch (${plans.length})`}
              title={`Đổi kế hoạch (${plans.length})`}
            >
              <CalendarRange size={16} aria-hidden="true" />
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
              >
                <Pencil size={16} aria-hidden="true" />
              </Button>
              <Button
                variant="destructiveIcon"
                size="icon"
                onClick={() => setConfirmDelete(true)}
                disabled={disabled}
                aria-label="Xóa bản nháp"
                title="Xóa bản nháp"
              >
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
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
            Tích lũy ban đầu
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
            Cấu hình phân bổ 6 hũ chi tiêu
          </p>
          <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
            Tổng 100% ngân sách chi tiêu tháng
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
        presentation={isMobile ? "sheet" : "popover"}
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
  jarCategories,
  jarTransactions,
  currentMonth,
  isMobile,
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
  jarCategories: JarCategoryItem[];
  jarTransactions: JarTransactionItem[];
  currentMonth?: PlanMonth;
  isMobile: boolean;
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
    ? spentThisMonth.isPositive()
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

  const realizedProgressPct = progressWidth(plan.realizedProgressPercentage);
  const projectedProgressPct = progressWidth(
    plan.projectedCurrentProgressPercentage,
  );

  return (
    <div className="grid gap-4">
      {/* Unified Executive Plan Hero Card */}
      <Card className="overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
        {/* Top Identity & Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--border)] pb-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--primary-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--primary)]">
              <span
                className="size-1.5 rounded-full bg-[var(--primary)]"
                aria-hidden="true"
              />
              {STATUS_LABELS[plan.status]}
            </span>

            {plan.status === "active" && (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
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

            <span className="inline-flex shrink-0 items-center rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] tabular-nums">
              {shortMonthLabel(plan.startMonth)} →{" "}
              {shortMonthLabel(plan.targetMonth)}
            </span>
          </div>

          {/* Sleek Action Cluster (Accessible on Mobile & Desktop) */}
          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/60 p-0.5">
            {plans.length > 1 && (
              <Button
                variant="icon"
                size="icon"
                onClick={onOpenPlanPicker}
                disabled={disabled}
                aria-label={`Đổi kế hoạch (${plans.length})`}
                title={`Đổi kế hoạch (${plans.length})`}
              >
                <CalendarRange size={15} aria-hidden="true" />
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
              >
                <Plus size={15} aria-hidden="true" />
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
                >
                  <SlidersHorizontal size={15} aria-hidden="true" />
                </Button>
                <Button
                  variant="icon"
                  size="icon"
                  onClick={onEditDeadline}
                  disabled={disabled}
                  aria-label="Đổi thời hạn hoàn thành"
                  title="Đổi thời hạn hoàn thành"
                >
                  <CalendarClock size={15} aria-hidden="true" />
                </Button>
                {plan.canComplete && (
                  <Button
                    variant="success"
                    size="icon"
                    onClick={onComplete}
                    disabled={disabled}
                    aria-label="Hoàn thành kế hoạch"
                    title="Hoàn thành kế hoạch"
                  >
                    <CheckCircle2 size={15} aria-hidden="true" />
                  </Button>
                )}
                <Button
                  variant="destructiveIcon"
                  size="icon"
                  onClick={() => setCancelConfirmOpen(true)}
                  disabled={disabled}
                  aria-label="Hủy kế hoạch"
                  title="Hủy kế hoạch"
                >
                  <AlertTriangle size={15} aria-hidden="true" />
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
                >
                  <Trash2 size={15} aria-hidden="true" />
                </Button>
              )}
          </div>
        </div>

        {/* Plan Identity & Master Savings Progress */}
        <div className="grid gap-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="min-w-0 break-words text-lg font-bold leading-snug tracking-tight text-[var(--foreground)] md:text-xl">
              {plan.name}
            </h2>
            <div className="flex flex-wrap items-baseline gap-1.5 text-xs tabular-nums">
              <span className="text-[var(--text-secondary)]">Tích lũy:</span>
              <strong className="text-sm font-bold text-[var(--foreground)] md:text-base">
                {money(plan.realizedProgress, currency)}
              </strong>
              <span className="text-[var(--text-muted)]">
                / {money(plan.targetAmount, currency)}
              </span>
              <span className="rounded-md bg-[var(--primary-soft)] px-1.5 py-0.5 text-xs font-bold text-[var(--primary)]">
                {plan.realizedProgressPercentage}%
              </span>
            </div>
          </div>

          <div
            role="progressbar"
            aria-label={`Tiến độ tích lũy kế hoạch ${plan.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(realizedProgressPct)}
            className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)]"
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

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
            <span className="tabular-nums">
              Dự kiến cuối tháng:{" "}
              <strong className="font-semibold text-[var(--foreground)]">
                {money(plan.projectedEndOfCurrentMonthProgress, currency)}
              </strong>{" "}
              ({plan.projectedCurrentProgressPercentage}%)
            </span>
            {hasShortfall ? (
              <span className="font-semibold text-[var(--warning)] tabular-nums">
                Mức cần bù thêm: {money(shortfall, currency)}
              </span>
            ) : (
              <span className="tabular-nums">
                Dự kiến cuối kỳ:{" "}
                <strong className="font-semibold text-[var(--foreground)]">
                  {money(plan.projectedEndOfPlanProgress, currency)}
                </strong>
              </span>
            )}
          </div>
        </div>

        {/* Compact 2x2 Mobile / 4-Column Desktop Cashflow & Budget Matrix */}
        <section
          aria-label="Tổng quan ngân sách kế hoạch tháng này"
          className="grid grid-cols-2 gap-2.5 border-t border-[var(--border)] pt-3.5 lg:grid-cols-4"
        >
          {/* Tile 1: Thu nhập dự kiến */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-3">
            <div className="flex items-center justify-between gap-1.5">
              <p className="break-words text-xs font-medium leading-snug text-[var(--text-secondary)]">
                Thu nhập dự kiến
              </p>
              <ArrowDownLeft
                className="size-3.5 shrink-0 text-[var(--income)]"
                aria-hidden="true"
              />
            </div>
            <p className="mt-1.5 text-sm font-bold tracking-tight text-[var(--foreground)] tabular-nums sm:text-base md:text-lg">
              {money(estimatedIncome.toString(), currency)}
            </p>
            <p className="mt-0.5 break-words text-[11px] leading-snug text-[var(--text-muted)]">
              {currentMonth
                ? `Kỳ ${monthLabel(currentMonth.month)}`
                : `Kỳ ${monthLabel(plan.businessMonth)}`}
            </p>
          </div>

          {/* Tile 2: Mục tiêu tiết kiệm tháng này */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-3">
            <div className="flex items-center justify-between gap-1.5">
              <p className="break-words text-xs font-medium leading-snug text-[var(--text-secondary)]">
                Mục tiêu tiết kiệm tháng này
              </p>
              <Target
                className="size-3.5 shrink-0 text-[var(--primary)]"
                aria-hidden="true"
              />
            </div>
            <p className="mt-1.5 text-sm font-bold tracking-tight text-[var(--primary)] tabular-nums sm:text-base md:text-lg">
              {money(requiredSavingsThisMonth.toString(), currency)}
            </p>
            <p className="mt-0.5 break-words text-[11px] leading-snug text-[var(--text-muted)] tabular-nums">
              {hasShortfall ? (
                <span className="font-semibold text-[var(--warning)]">
                  Bù thêm: {compactMoney(shortfall, currency)}
                </span>
              ) : (
                `Đã gán ${financialGoals.length} mục tiêu`
              )}
            </p>
          </div>

          {/* Tile 3: Ngân sách chi tiêu tháng */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-3">
            <div className="flex items-center justify-between gap-1.5">
              <p className="break-words text-xs font-medium leading-snug text-[var(--text-secondary)]">
                Ngân sách chi tiêu tháng
              </p>
              <Wallet
                className="size-3.5 shrink-0 text-[var(--foreground)]"
                aria-hidden="true"
              />
            </div>
            <p className="mt-1.5 text-sm font-bold tracking-tight text-[var(--foreground)] tabular-nums sm:text-base md:text-lg">
              {money(monthlyBudget.toString(), currency)}
            </p>
            <p className="mt-0.5 break-words text-[11px] leading-snug text-[var(--text-muted)]">
              Số dư có thể dùng:{" "}
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  availableToSpend.isNegative()
                    ? "text-[var(--destructive)]"
                    : "text-[var(--foreground)]",
                )}
              >
                {compactMoney(availableToSpend.toString(), currency)}
              </span>
            </p>
          </div>

          {/* Tile 4: Đã chi tiêu */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-3">
            <div className="flex items-center justify-between gap-1.5">
              <p className="break-words text-xs font-medium leading-snug text-[var(--text-secondary)]">
                Đã chi tiêu
              </p>
              <ArrowUpRight
                className="size-3.5 shrink-0 text-[var(--expense)]"
                aria-hidden="true"
              />
            </div>
            <p
              className={cn(
                "mt-1.5 text-sm font-bold tracking-tight tabular-nums sm:text-base md:text-lg",
                PROGRESS_TEXT_TONES[monthlyUsageTone],
              )}
            >
              {money(spentThisMonth.toString(), currency)}
            </p>
            <p className="mt-0.5 break-words text-[11px] leading-snug text-[var(--text-muted)] tabular-nums">
              {monthlyUsage.toDecimalPlaces(0).toString()}% ngân sách
              {safeDailyOverall.greaterThan(0)
                ? ` · An toàn ${compactMoney(safeDailyOverall.toFixed(0), currency)}/ngày`
                : ""}
            </p>
          </div>
        </section>
      </Card>

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
              isMobile={isMobile}
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
              isMobile={isMobile}
              onInspectInJarsTab={(monthKey) => {
                setSelectedJarMonthKey(monthKey);
                setActiveTab("jars");
              }}
            />

            {/* Plan Progress & Settings Card */}
            <Card>
              <CardHeader className="border-b border-[var(--border)]">
                <CardTitle>Dự báo tích lũy & Quản trị kế hoạch</CardTitle>
                <CardDescription>
                  Theo dõi tiến độ tích lũy toàn kỳ và điều chỉnh thông số kế
                  hoạch khi cần.
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
                      Mức cần bù thêm
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
                        ? "Cần bổ sung thu nhập hoặc giãn hạn"
                        : "Đảm bảo đủ nguồn tích lũy"}
                    </small>
                  </div>
                </dl>

                {plan.canManage && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3.5">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      Thao tác quản trị kế hoạch
                    </span>
                    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-1">
                      {plan.status === "active" && (
                        <>
                          <Button
                            variant="icon"
                            size="icon"
                            onClick={onEditAllocation}
                            disabled={disabled}
                            aria-label="Điều chỉnh tỷ lệ 6 hũ tháng sau"
                            title="Điều chỉnh tỷ lệ 6 hũ tháng sau"
                          >
                            <SlidersHorizontal size={16} aria-hidden="true" />
                          </Button>
                          <Button
                            variant="icon"
                            size="icon"
                            onClick={onEditDeadline}
                            disabled={disabled}
                            aria-label="Đổi thời hạn hoàn thành"
                            title="Đổi thời hạn hoàn thành"
                          >
                            <CalendarClock size={16} aria-hidden="true" />
                          </Button>
                          {plan.canComplete && (
                            <Button
                              variant="success"
                              size="icon"
                              onClick={onComplete}
                              disabled={disabled}
                              aria-label="Hoàn thành kế hoạch"
                              title="Hoàn thành kế hoạch"
                            >
                              <CheckCircle2 size={16} aria-hidden="true" />
                            </Button>
                          )}
                        </>
                      )}
                      {plans.length > 1 && (
                        <Button
                          variant="icon"
                          size="icon"
                          onClick={onOpenPlanPicker}
                          disabled={disabled}
                          aria-label={`Chuyển đổi kế hoạch (${plans.length})`}
                          title={`Chuyển đổi kế hoạch (${plans.length})`}
                        >
                          <CalendarRange size={16} aria-hidden="true" />
                        </Button>
                      )}
                      {plan.status === "active" && (
                        <Button
                          variant="destructiveIcon"
                          size="icon"
                          onClick={() => setCancelConfirmOpen(true)}
                          disabled={disabled}
                          aria-label="Hủy kế hoạch"
                          title="Hủy kế hoạch"
                        >
                          <AlertTriangle size={16} aria-hidden="true" />
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
        presentation={isMobile ? "sheet" : "popover"}
        ariaLabel="Hủy kế hoạch"
        title="Hủy kế hoạch đang chạy?"
        description="Kế hoạch sẽ dừng và chuyển sang chế độ chỉ đọc. Số liệu các tháng đã chốt vẫn được giữ nguyên."
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
        presentation={isMobile ? "sheet" : "popover"}
        onConfirm={onDelete ?? (() => {})}
        disabled={disabled}
      />
    </div>
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
  isMobile,
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
  isMobile: boolean;
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

  const monthTransactions = useMemo(
    () => jarTransactions.filter((tx) => tx.month === month.month),
    [jarTransactions, month.month],
  );

  const inspectedJar = useMemo(
    () =>
      inspectedJarCode
        ? month.jars.find((j) => j.jarCode === inspectedJarCode) ?? null
        : null,
    [inspectedJarCode, month.jars],
  );

  return (
    <div className="grid gap-3.5">
      {/* Header Bar with Direct Month Selector Capsule */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
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
                    Chọn kỳ ngân sách 6 hũ
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
                : "Kỳ dự kiến"}
          </span>
        </div>

        {/* Multi-segment visual bar + Edit Ratios Action */}
        <div className="flex items-center gap-2.5">
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
              className="h-8 text-xs"
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
              <span>Tỷ lệ 6 hũ</span>
            </Button>
          )}
        </div>
      </div>

      {/* 6 Jars Interactive Responsive Grid */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
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

          const jarTxCount = monthTransactions.filter(
            (tx) => tx.jarCode === jar.jarCode,
          ).length;
          const mappedCatsCount = jarCategories.filter(
            (cat) => cat.jarCode === jar.jarCode,
          ).length;
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
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setInspectedJarCode(jar.jarCode);
                }
              }}
              aria-label={`Xem chi tiết hũ ${FINANCIAL_JAR_LABELS[jar.jarCode]} (${jar.percentage}%)`}
              className="cursor-pointer select-none text-left transition-colors duration-150 hover:border-[var(--primary)]/50 active:bg-[var(--surface-secondary)]/50"
            >
              {/* Top Row: Jar Name + Category Count + % Share Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <h4 className="min-w-0 break-words text-sm font-bold leading-snug text-[var(--foreground)] md:text-base">
                      {FINANCIAL_JAR_LABELS[jar.jarCode]}
                    </h4>
                  </div>
                  <p className="mt-0.5 break-words text-[11px] leading-snug text-[var(--text-muted)]">
                    {JAR_DESCRIPTIONS[jar.jarCode]}
                  </p>
                </div>

                <span className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2 py-0.5 text-xs font-bold text-[var(--foreground)] tabular-nums shrink-0">
                  {jar.percentage}%
                </span>
              </div>

              {/* Middle Row: Spent vs Allocated Amount + Progress Bar */}
              <div className="space-y-2 border-t border-[var(--border)] pt-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                  <span className="break-words text-[var(--text-secondary)]">
                    Đã chi:{" "}
                    <strong className="text-sm font-bold text-[var(--foreground)] tabular-nums">
                      {money(spent, currency)}
                    </strong>
                  </span>
                  <span className="text-[var(--text-muted)] tabular-nums shrink-0">
                    / {money(jar.allocatedAmount, currency)}
                  </span>
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
              </div>

              {/* Bottom Row: Remaining Budget + Daily Safe Spend / Transactions Count */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/60 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    {overspent ? "Vượt hạn mức: " : "Còn lại: "}
                  </span>
                  <strong
                    className={cn(
                      "font-bold tabular-nums",
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

                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)] tabular-nums">
                  {safeDailyJar && safeDailyJar.greaterThan(0) ? (
                    <span>
                      {compactMoney(safeDailyJar.toFixed(0), currency)}/ngày
                    </span>
                  ) : jarTxCount > 0 ? (
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
          includeForecast={!month.closed && month.month >= businessMonth}
          remainingDays={isCurrentBusinessMonth ? remainingDays : 0}
          currency={currency}
          isMobile={isMobile}
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
  isMobile,
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
  isMobile: boolean;
  categories: JarCategoryItem[];
  transactions: JarTransactionItem[];
  canEditAllocation?: boolean;
  onEditAllocation?: () => void;
}) {
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
    for (const tx of transactions) {
      const included = month.closed
        ? tx.workflowStatus === "approved"
        : tx.workflowStatus === "approved" ||
          (includeForecast && tx.workflowStatus === "scheduled");
      if (!included) continue;
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
          amount: item.amount.toFixed(0),
          count: item.count,
          share,
        };
      })
      .sort((a, b) => new Decimal(b.amount).comparedTo(a.amount));
  }, [categories, transactions, month.closed, includeForecast, spent]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        placement={isMobile ? "edge" : "inset"}
        size={isMobile ? "default" : "wide"}
        spacing="flush"
        elevation="flat"
      >
        <SheetHeader
          icon={PieChart}
          title={`${FINANCIAL_JAR_LABELS[jar.jarCode]} (${jar.percentage}%)`}
          description={`${monthLabel(month.month)} · ${JAR_DESCRIPTIONS[jar.jarCode]}`}
        />

        <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto px-4 py-5 md:px-6">
          {/* 2x2 Summary Metrics */}
          <dl className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
              <dt className="break-words text-xs leading-snug text-[var(--text-secondary)]">
                Hạn mức phân bổ ({jar.percentage}%)
              </dt>
              <dd className="mt-1 text-base font-bold text-[var(--foreground)] tabular-nums">
                {money(jar.allocatedAmount, currency)}
              </dd>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
              <dt className="break-words text-xs leading-snug text-[var(--text-secondary)]">
                Đã chi thực tế ({jarUsage.toFixed(0)}%)
              </dt>
              <dd
                className={cn(
                  "mt-1 text-base font-bold tabular-nums",
                  PROGRESS_TEXT_TONES[jarUsageTone],
                )}
              >
                {money(spent, currency)}
              </dd>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
              <dt className="break-words text-xs leading-snug text-[var(--text-secondary)]">
                {overspent ? "Vượt hạn mức" : "Ngân sách còn lại"}
              </dt>
              <dd
                className={cn(
                  "mt-1 text-base font-bold tabular-nums",
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

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
              <dt className="break-words text-xs leading-snug text-[var(--text-secondary)]">
                Định mức an toàn/ngày
              </dt>
              <dd className="mt-1 text-base font-bold text-[var(--foreground)] tabular-nums">
                {remainingDays > 0
                  ? `${money(safeDaily.toFixed(0), currency)}`
                  : "Kỳ đã qua"}
              </dd>
            </div>
          </dl>

          {/* Category Breakdown */}
          <section className="grid gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                <Layers className="size-3.5 text-[var(--primary)]" />
                <span>Danh mục thuộc hũ ({categoryBreakdown.length})</span>
              </h4>
            </div>

            {categoryBreakdown.length === 0 ? (
              <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-3.5 text-xs text-[var(--text-muted)]">
                Chưa có danh mục chi tiêu nào được gán vào hũ này.
              </p>
            ) : (
              <div className="grid gap-2">
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
                          <span className="rounded-md bg-[var(--surface-secondary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)] tabular-nums">
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

          {/* Transactions in Selected Month & Jar */}
          <section className="grid gap-2.5 border-t border-[var(--border)] pt-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                <ReceiptText className="size-3.5 text-[var(--primary)]" />
                <span>Giao dịch trong tháng ({transactions.length})</span>
              </h4>
            </div>

            {transactions.length === 0 ? (
              <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-4 text-center text-xs text-[var(--text-muted)]">
                Chưa có giao dịch chi tiêu nào trong hũ này vào{" "}
                {monthLabel(month.month)}.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-start justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-xs font-semibold leading-snug text-[var(--foreground)] sm:text-sm">
                        {tx.description || tx.categoryName}
                      </p>
                      <p className="mt-0.5 break-words text-[11px] leading-snug text-[var(--text-muted)]">
                        {formatViDate(tx.date)} · {tx.categoryName} ·{" "}
                        {tx.walletName}
                        {tx.workflowStatus === "pending"
                          ? " · Chờ duyệt"
                          : tx.workflowStatus === "scheduled"
                            ? " · Dự kiến"
                            : ""}
                      </p>
                    </div>
                    <strong className="text-xs font-bold text-[var(--foreground)] tabular-nums shrink-0 sm:text-sm">
                      {money(tx.amount, currency)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <SheetFooter
          onCancel={() => onOpenChange(false)}
          cancelLabel="Đóng"
          submitLabel={
            canEditAllocation && onEditAllocation
              ? "Điều chỉnh tỷ lệ 6 hũ"
              : undefined
          }
          onSubmit={canEditAllocation ? onEditAllocation : undefined}
          submitType="button"
        />
      </SheetContent>
    </Sheet>
  );
}

function BudgetJarList({
  month,
  currency,
}: {
  month: PlanMonth;
  currency: string;
}) {
  return (
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
  isMobile = false,
  onInspectInJarsTab,
}: {
  months: PlanMonth[];
  currency: string;
  isMobile?: boolean;
  onInspectInJarsTab?: (monthKey: string) => void;
}) {
  const [selectedMonth, setSelectedMonth] = useState<PlanMonth | null>(null);
  const unclosedMonth = months.find((m) => !m.closed);

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
              Theo dõi mục tiêu tiết kiệm tháng này, ngân sách chi tiêu tháng và
              số dư có thể dùng của từng kỳ.
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
              className="flex flex-col gap-3 py-3.5 first:pt-1 last:pb-0 md:flex-row md:items-center md:justify-between"
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
                    Mục tiêu tiết kiệm tháng này:{" "}
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
                      Mức cần bù thêm: {money(month.resourceShortfall, currency)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2.5 md:shrink-0 md:justify-end">
                <div className="text-left md:text-right">
                  <span className="block text-[11px] text-[var(--text-muted)]">
                    Số dư có thể dùng
                  </span>
                  <strong
                    className={cn(
                      "text-sm font-bold tabular-nums shrink-0",
                      isNegativeAvailable
                        ? "text-[var(--destructive)]"
                        : "text-[var(--foreground)]",
                    )}
                  >
                    {money(month.availableToSpend, currency)}
                  </strong>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="icon"
                    size="icon"
                    onClick={() => setSelectedMonth(month)}
                    aria-label={`Chi tiết 6 hũ ${monthLabel(month.month)}`}
                    title={`Xem chi tiết 6 hũ ${monthLabel(month.month)}`}
                  >
                    <PieChart size={16} aria-hidden="true" />
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
          side={isMobile ? "bottom" : "right"}
          placement={isMobile ? "edge" : "inset"}
          size={isMobile ? "default" : "wide"}
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
              <MonthSheetDetail month={selectedMonth} currency={currency} />
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
}: {
  month: PlanMonth;
  currency: string;
}) {
  const availableToSpend = new Decimal(month.availableToSpend);
  const hasShortfall = new Decimal(month.resourceShortfall).greaterThan(0);
  const savedAmount =
    month.closedActualGoalAmount ?? month.projectedActualGoalAmount ?? "0";

  return (
    <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-4 py-5 md:px-6">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5">
          <dt className="break-words text-xs leading-snug text-[var(--text-secondary)]">
            Mục tiêu tiết kiệm tháng này
          </dt>
          <dd className="mt-1 text-base font-bold text-[var(--foreground)] tabular-nums shrink-0">
            {money(month.adjustedRequiredAmount, currency)}
          </dd>
          <small className="mt-0.5 block text-xs text-[var(--text-muted)] tabular-nums">
            Thực tế ghi nhận: {money(savedAmount, currency)}
          </small>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5">
          <dt className="break-words text-xs leading-snug text-[var(--text-secondary)]">
            Ngân sách chi tiêu tháng
          </dt>
          <dd className="mt-1 text-base font-bold text-[var(--foreground)] tabular-nums shrink-0">
            {money(month.allocatableGrossBudget, currency)}
          </dd>
          <small className="mt-0.5 block text-xs text-[var(--text-muted)] tabular-nums">
            Số dư có thể dùng:{" "}
            <span
              className={cn(
                "font-semibold",
                availableToSpend.isNegative()
                  ? "text-[var(--destructive)]"
                  : "text-[var(--foreground)]",
              )}
            >
              {money(month.availableToSpend, currency)}
            </span>
          </small>
        </div>
      </dl>

      {hasShortfall && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--warning)_30%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_10%,var(--surface))] px-3.5 py-2.5 text-xs font-medium text-[var(--warning)]">
          <span>Mức cần bù thêm cho mục tiêu tháng này</span>
          <strong className="tabular-nums shrink-0">
            {money(month.resourceShortfall, currency)}
          </strong>
        </div>
      )}

      {month.closed && month.adjustedDelta && month.adjustedDelta !== "0" && (
        <p className="text-xs leading-5 text-[var(--warning)]">
          Tháng này có điều chỉnh bổ sung {money(month.adjustedDelta, currency)}{" "}
          do chênh lệch thu chi khi chốt sổ.
        </p>
      )}

      {month.jars && month.jars.length > 0 && (
        <section className="grid gap-3 border-t border-[var(--border)] pt-4">
          <h4 className="text-sm font-semibold text-[var(--foreground)]">
            Phân bổ 6 hũ ({monthLabel(month.month)})
          </h4>
          <BudgetJarList month={month} currency={currency} />
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
  isMobile?: boolean;
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
  isMobile,
  disabled,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessMonth: string;
  plan: DraftView | null;
  canAutoActivate?: boolean;
  hasMultipleGoals: boolean;
  isMobile: boolean;
  disabled: boolean;
  onSaved: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"info" | "ratios">("info");
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
        side={isMobile ? "bottom" : "right"}
        placement={isMobile ? "edge" : "inset"}
        size={isMobile ? "default" : "wide"}
        spacing="flush"
        elevation="flat"
      >
        <PlanSheetHeader
          isMobile={isMobile}
          icon={Target}
          title={plan ? "Chỉnh sửa bản nháp" : "Tạo kế hoạch tài chính"}
          description="Thiết lập mục tiêu tích lũy, thời hạn hoàn thành và tỷ lệ phân bổ 6 hũ chi tiêu."
        />
        <div className="grid min-h-0 flex-1 content-start gap-6 overflow-y-auto px-4 py-5 md:px-6">
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
                      Số tiền mục tiêu và thời hạn hoàn thành được quản lý riêng
                      trên từng mục tiêu tích lũy.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="ratios" className="mt-3">
                <RatioEditor
                  ratios={draft.percentages}
                  onChange={(percentages) =>
                    setDraft({ ...draft, percentages })
                  }
                />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="grid gap-6">
              <div className="grid gap-4">
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
                  <div
                    className={cn(
                      "grid gap-4",
                      !hideExistingGoalAmount && "sm:grid-cols-2",
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
                    Số tiền mục tiêu và thời hạn hoàn thành được quản lý riêng
                    trên từng mục tiêu tích lũy.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4 md:p-5">
                <RatioEditor
                  ratios={draft.percentages}
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
  isMobile,
  disabled,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: RunningView;
  isMobile: boolean;
  disabled: boolean;
  onSave: (month: string) => void;
}) {
  const [targetMonth, setTargetMonth] = useState(plan.targetMonth);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        placement={isMobile ? "edge" : "inset"}
        size={isMobile ? "default" : "wide"}
        spacing="flush"
        elevation="flat"
      >
        <PlanSheetHeader
          isMobile={isMobile}
          icon={CalendarClock}
          title="Đổi thời hạn hoàn thành"
          description="Số liệu các tháng đã chốt được giữ nguyên. Các tháng chưa chốt sẽ tự động tính lại mục tiêu tiết kiệm tháng này."
        />
        <div className="grid min-h-0 flex-1 content-start gap-6 overflow-y-auto px-4 py-5 md:px-6">
          <MonthPicker
            label="Tháng hoàn thành mới"
            required
            minMonth={plan.businessMonth}
            value={targetMonth}
            onValueChange={setTargetMonth}
            disabled={disabled}
          />
        </div>
        <SheetFooter
          onCancel={() => onOpenChange(false)}
          cancelLabel="Hủy"
          submitLabel="Lưu thay đổi"
          submitDisabled={disabled || targetMonth < plan.businessMonth}
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
  isMobile,
  disabled,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRatios: RatioDraft;
  referenceBudget?: string;
  currency?: string;
  isMobile: boolean;
  disabled: boolean;
  onSave: (ratios: RatioDraft) => void;
}) {
  const [ratios, setRatios] = useState(initialRatios);
  const total = ratioTotal(ratios);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        placement={isMobile ? "edge" : "inset"}
        size={isMobile ? "default" : "wide"}
        spacing="flush"
        elevation="flat"
      >
        <PlanSheetHeader
          isMobile={isMobile}
          icon={SlidersHorizontal}
          title="Tỷ lệ phân bổ 6 hũ"
          description="Áp dụng cho kỳ ngân sách từ tháng kế tiếp."
        />
        <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto px-4 py-3.5 md:px-6 md:py-4">
          <RatioEditor
            ratios={ratios}
            referenceBudget={referenceBudget}
            currency={currency}
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
  onChange,
}: {
  ratios: RatioDraft;
  referenceBudget?: string;
  currency?: string;
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
      <div className="grid gap-1.5">
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
