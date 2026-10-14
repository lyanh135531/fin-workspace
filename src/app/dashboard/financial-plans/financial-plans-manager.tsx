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
  PageHeader,
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
import { SpotlightTrigger } from "@/components/ui/spotlight-trigger";
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
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  CircleX,
  History,
  Minus,
  Pencil,
  PieChart,
  Plus,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
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

const JAR_DESCRIPTIONS: Record<FinancialJarCode, string> = {
  ESSENTIAL: "Ăn uống, nhà ở, đi lại và sinh hoạt hàng ngày",
  RESPONSIBILITY: "Gia đình, bảo hiểm và nghĩa vụ tài chính",
  DEVELOPMENT: "Học tập, sách vở và nâng cao kỹ năng",
  ENJOYMENT: "Giải trí, thư giãn và chăm sóc bản thân",
  INVESTMENT: "Đầu tư tích sản và sinh lời dài hạn",
  GIVING: "Quà tặng, hiếu hỉ và chia sẻ cộng đồng",
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

function money(value: string, currency: string) {
  return `${formatAmount(value)} ${currency === "VND" ? "₫" : currency}`;
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
  businessMonth,
  canManage,
  plans,
  selectedPlan,
  financialGoals,
  goalWallets,
}: {
  workspaceName: string;
  currency: string;
  businessMonth: string;
  canManage: boolean;
  plans: PlanListItem[];
  selectedPlan: SelectedPlan;
  financialGoals: FinancialGoalView[];
  goalWallets: Array<{ id: string; name: string; balance: string }>;
}) {
  const router = useRouter();
  const [editorOpen, setEditorOpen] = useState(false);
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

  return (
    <div className="grid gap-4 md:gap-5">
      <PageHeader
        title="Kế hoạch tài chính & 6 Hũ"
        description={`Quản lý mục tiêu tiết kiệm và phân bổ ngân sách 6 hũ chi tiêu cho ${workspaceName}.`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {plans.length > 1 && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPlanPickerOpen(true)}
              disabled={isPending}
              aria-label={`Đổi kế hoạch (${plans.length})`}
              title={`Đổi kế hoạch (${plans.length})`}
            >
              <CalendarRange size={16} aria-hidden="true" />
            </Button>
          )}
          {canManage && !activeExists && (
            <Button onClick={() => setEditorOpen(true)} disabled={isPending}>
              <Plus size={16} aria-hidden="true" />
              <span>Tạo kế hoạch</span>
            </Button>
          )}
        </div>
      </PageHeader>

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
                description="Chọn kế hoạch đang chạy, bản nháp hoặc xem lại các kế hoạch trước đây."
              />
              <nav
                aria-label="Danh sách kế hoạch"
                className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto px-4 py-4 md:px-6"
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
                  <Button size="lg" onClick={() => setEditorOpen(true)}>
                    <Plus aria-hidden="true" />
                    <span>Tạo kế hoạch đầu tiên</span>
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : selectedPlan.status === "draft" ? (
          <div className="grid gap-5">
            <DraftReview
              plan={selectedPlan}
              currency={currency}
              isMobile={isMobile}
              disabled={isPending}
              onEdit={() => setEditorOpen(true)}
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
            businessMonth={businessMonth}
            canManage={canManage}
            financialGoals={financialGoals}
            goalWallets={goalWallets}
            currentMonth={currentPlanMonth}
            disabled={isPending}
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
          plan={selectedPlan?.status === "draft" ? selectedPlan : null}
          hasMultipleGoals={financialGoals.length > 1}
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
              initialRatios={ratiosFromMonth(currentPlanMonth)}
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
  currency,
  isMobile,
  disabled,
  onEdit,
  onActivate,
  onDelete,
}: {
  plan: DraftView;
  currency: string;
  isMobile: boolean;
  disabled: boolean;
  onEdit: () => void;
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
    <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-[color-mix(in_srgb,var(--warning)_15%,var(--surface))] px-2.5 py-0.5 text-xs font-semibold text-[var(--warning)]">
          <Pencil className="size-3" aria-hidden="true" />
          <span>Bản nháp kế hoạch</span>
        </span>
        <h2 className="mt-2 break-words text-xl font-bold leading-snug tracking-tight text-[var(--foreground)] md:text-2xl">
          {plan.name}
        </h2>
        <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-secondary)]">
          Kiểm tra lại mục tiêu và tỷ lệ phân bổ 6 hũ trước khi kích hoạt.
        </p>
      </div>

      {plan.canManage && (
        <div
          className="hidden shrink-0 items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-1 lg:flex"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Button
            variant="default"
            size="icon"
            onClick={onActivate}
            disabled={disabled}
            aria-label="Kích hoạt kế hoạch"
            title="Kích hoạt kế hoạch"
          >
            <CheckCircle2 size={16} aria-hidden="true" />
          </Button>
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
        </div>
      )}
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
          <p className="break-words text-xs font-medium leading-snug text-[var(--text-secondary)]">
            Tổng mục tiêu tích lũy
          </p>
          <p className="mt-1.5 text-lg font-bold tracking-tight text-[var(--foreground)] tabular-nums shrink-0 md:text-xl">
            {money(plan.targetAmount, currency)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
          <p className="break-words text-xs font-medium leading-snug text-[var(--text-secondary)]">
            Số dư tích lũy ban đầu
          </p>
          <p className="mt-1.5 text-lg font-bold tracking-tight text-[var(--foreground)] tabular-nums shrink-0 md:text-xl">
            {money(plan.existingGoalAmount, currency)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
          <p className="break-words text-xs font-medium leading-snug text-[var(--text-secondary)]">
            Tháng hoàn thành dự kiến
          </p>
          <p className="mt-1.5 text-lg font-bold tracking-tight text-[var(--foreground)] shrink-0 md:text-xl">
            {monthLabel(plan.targetMonth)}
          </p>
        </div>
      </div>

      {/* 6 Jars Ratio Preview */}
      <div className="space-y-3 border-t border-[var(--border)] pt-4">
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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {FINANCIAL_JAR_CODES.map((jarCode) => (
            <div
              key={jarCode}
              className="flex items-start justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5"
            >
              <div className="flex min-w-0 items-start gap-2">
                <span
                  className="mt-1.5 size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: JAR_COLORS[jarCode] }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                    {FINANCIAL_JAR_LABELS[jarCode]}
                  </p>
                  <p className="mt-0.5 hidden break-words text-[11px] leading-snug text-[var(--text-muted)] md:block">
                    {JAR_DESCRIPTIONS[jarCode]}
                  </p>
                </div>
              </div>
              <span className="rounded-md bg-[var(--surface-secondary)] px-2 py-0.5 text-xs font-bold text-[var(--foreground)] tabular-nums shrink-0">
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
  businessMonth,
  canManage,
  financialGoals,
  goalWallets,
  currentMonth,
  disabled,
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
  businessMonth: string;
  canManage: boolean;
  financialGoals: FinancialGoalView[];
  goalWallets: Array<{ id: string; name: string; balance: string }>;
  currentMonth?: PlanMonth;
  disabled: boolean;
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
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [planMenuOpen, setPlanMenuOpen] = useState(false);

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

  function handlePlanMenuOpenChange(nextOpen: boolean) {
    if (
      nextOpen &&
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(min-width: 1024px)").matches
    ) {
      return;
    }
    setPlanMenuOpen(nextOpen);
  }

  const hasPlanActions =
    plan.canManage &&
    (plan.status === "active" ||
      ((plan.status === "cancelled" || plan.status === "completed") &&
        Boolean(onDelete)));

  const statusCardInner = (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--primary-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--primary)]">
            <span
              className="size-1.5 rounded-full bg-[var(--primary)]"
              aria-hidden="true"
            />
            {STATUS_LABELS[plan.status]}
          </span>
          {plan.status === "active" && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
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
          <span className="text-xs text-[var(--text-muted)] tabular-nums shrink-0">
            {monthLabel(plan.startMonth)} → {monthLabel(plan.targetMonth)}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="min-w-0 break-words text-lg font-bold leading-snug tracking-tight text-[var(--foreground)] md:text-xl">
            {plan.name}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] tabular-nums shrink-0">
            Tiến độ tích lũy:{" "}
            <strong className="font-semibold text-[var(--foreground)]">
              {money(plan.realizedProgress, currency)}
            </strong>{" "}
            / {money(plan.targetAmount, currency)} (
            {plan.realizedProgressPercentage}%)
          </p>
        </div>
      </div>

      {hasPlanActions && (
        <div
          className="hidden shrink-0 items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-1 lg:flex"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {plan.status === "active" && (
            <>
              <Button
                variant="icon"
                size="icon"
                onClick={onEditAllocation}
                disabled={disabled}
                aria-label="Cấu hình tỷ lệ 6 hũ"
                title="Cấu hình phân bổ 6 hũ"
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
          {(plan.status === "cancelled" || plan.status === "completed") &&
            onDelete && (
              <Button
                variant="destructiveIcon"
                size="icon"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={disabled}
                aria-label="Xóa kế hoạch"
                title="Xóa kế hoạch"
              >
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            )}
        </div>
      )}
    </div>
  );

  return (
    <div className="grid gap-4 md:gap-5">
      {/* Plan Status Header Card */}
      {hasPlanActions ? (
        <DropdownMenu
          open={planMenuOpen}
          onOpenChange={handlePlanMenuOpenChange}
        >
          <SpotlightTrigger
            open={planMenuOpen}
            onOpenChange={handlePlanMenuOpenChange}
            mobileOnly
            dismissLabel={`Đóng menu thao tác kế hoạch ${plan.name}`}
            render={
              <Card
                size="sm"
                role="button"
                tabIndex={0}
                aria-label={`Kế hoạch ${plan.name}. Chạm để mở menu thao tác.`}
                className="cursor-pointer select-none text-left transition-all duration-150 active:scale-[0.99] active:bg-[var(--surface-hover)] lg:cursor-default lg:select-auto lg:active:scale-100 lg:active:bg-[var(--surface)]"
              />
            }
          >
            {(spotlightTrigger) => (
              <DropdownMenuTrigger
                nativeButton={false}
                render={spotlightTrigger}
              >
                {statusCardInner}
              </DropdownMenuTrigger>
            )}
          </SpotlightTrigger>

          <DropdownMenuContent
            align="center"
            side="bottom"
            sideOffset={6}
            className="w-60 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 lg:hidden"
          >
            {plan.status === "active" && (
              <>
                <DropdownMenuItem
                  disabled={disabled}
                  onClick={() => {
                    setPlanMenuOpen(false);
                    onEditAllocation();
                  }}
                >
                  <SlidersHorizontal
                    className="size-4 text-[var(--primary)]"
                    aria-hidden="true"
                  />
                  <span>Cấu hình phân bổ 6 hũ</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={disabled}
                  onClick={() => {
                    setPlanMenuOpen(false);
                    onEditDeadline();
                  }}
                >
                  <CalendarClock
                    className="size-4 text-[var(--text-secondary)]"
                    aria-hidden="true"
                  />
                  <span>Đổi thời hạn hoàn thành</span>
                </DropdownMenuItem>
                {plan.canComplete && (
                  <DropdownMenuItem
                    disabled={disabled}
                    onClick={() => {
                      setPlanMenuOpen(false);
                      onComplete();
                    }}
                  >
                    <CheckCircle2
                      className="size-4 text-[var(--success)]"
                      aria-hidden="true"
                    />
                    <span>Hoàn thành kế hoạch</span>
                  </DropdownMenuItem>
                )}
                {plans.length > 1 && (
                  <DropdownMenuItem
                    disabled={disabled}
                    onClick={() => {
                      setPlanMenuOpen(false);
                      onOpenPlanPicker();
                    }}
                  >
                    <CalendarRange
                      className="size-4 text-[var(--text-secondary)]"
                      aria-hidden="true"
                    />
                    <span>Chuyển đổi kế hoạch ({plans.length})</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={disabled}
                  onClick={() => {
                    setPlanMenuOpen(false);
                    setCancelConfirmOpen(true);
                  }}
                >
                  <AlertTriangle className="size-4" aria-hidden="true" />
                  <span>Hủy kế hoạch</span>
                </DropdownMenuItem>
              </>
            )}
            {(plan.status === "cancelled" || plan.status === "completed") &&
              onDelete && (
                <DropdownMenuItem
                  variant="destructive"
                  disabled={disabled}
                  onClick={() => {
                    setPlanMenuOpen(false);
                    setDeleteConfirmOpen(true);
                  }}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  <span>Xóa kế hoạch</span>
                </DropdownMenuItem>
              )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Card size="sm">{statusCardInner}</Card>
      )}

      {/* Top 4-Metric Summary Strip for Active Plan */}
      <section
        aria-label="Tổng quan ngân sách kế hoạch tháng này"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Card size="sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="break-words text-xs font-medium leading-snug text-[var(--text-secondary)]">
                Thu nhập dự kiến
              </p>
              <p className="mt-1.5 text-lg font-bold tracking-tight text-[var(--foreground)] tabular-nums shrink-0 md:text-xl">
                {money(estimatedIncome.toString(), currency)}
              </p>
              <p className="mt-1 break-words text-xs leading-snug text-[var(--text-muted)]">
                {currentMonth
                  ? `Kỳ ${monthLabel(currentMonth.month)}`
                  : `Kỳ ${monthLabel(plan.businessMonth)}`}
              </p>
            </div>
            <span
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-secondary)] text-[var(--income)]"
              aria-hidden="true"
            >
              <ArrowDownLeft size={18} />
            </span>
          </div>
        </Card>

        <Card size="sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="break-words text-xs font-medium leading-snug text-[var(--text-secondary)]">
                Mục tiêu tiết kiệm tháng này
              </p>
              <p className="mt-1.5 text-lg font-bold tracking-tight text-[var(--primary)] tabular-nums shrink-0 md:text-xl">
                {money(requiredSavingsThisMonth.toString(), currency)}
              </p>
              <p className="mt-1 break-words text-xs leading-snug text-[var(--text-muted)]">
                {hasShortfall ? (
                  <span className="font-semibold text-[var(--warning)] tabular-nums">
                    Mức cần bù thêm: {money(shortfall, currency)}
                  </span>
                ) : (
                  `Dự kiến cuối tháng: ${money(plan.projectedEndOfCurrentMonthProgress, currency)}`
                )}
              </p>
            </div>
            <span
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-secondary)] text-[var(--primary)]"
              aria-hidden="true"
            >
              <Target size={18} />
            </span>
          </div>
        </Card>

        <Card size="sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="break-words text-xs font-medium leading-snug text-[var(--text-secondary)]">
                Ngân sách chi tiêu tháng
              </p>
              <p className="mt-1.5 text-lg font-bold tracking-tight text-[var(--foreground)] tabular-nums shrink-0 md:text-xl">
                {money(monthlyBudget.toString(), currency)}
              </p>
              <p className="mt-1 break-words text-xs leading-snug text-[var(--text-muted)]">
                Số dư có thể dùng:{" "}
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    availableToSpend.isNegative()
                      ? "text-[var(--destructive)]"
                      : "text-[var(--foreground)]",
                  )}
                >
                  {money(availableToSpend.toString(), currency)}
                </span>
              </p>
            </div>
            <span
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-secondary)] text-[var(--foreground)]"
              aria-hidden="true"
            >
              <Wallet size={18} />
            </span>
          </div>
        </Card>

        <Card size="sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="break-words text-xs font-medium leading-snug text-[var(--text-secondary)]">
                Đã chi tiêu
              </p>
              <p
                className={cn(
                  "mt-1.5 text-lg font-bold tracking-tight tabular-nums shrink-0 md:text-xl",
                  PROGRESS_TEXT_TONES[monthlyUsageTone],
                )}
              >
                {money(spentThisMonth.toString(), currency)}
              </p>
              <p className="mt-1 break-words text-xs leading-snug text-[var(--text-muted)] tabular-nums">
                Đã dùng {monthlyUsage.toDecimalPlaces(0).toString()}% ngân sách
                chi tiêu tháng
              </p>
            </div>
            <span
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-secondary)] text-[var(--expense)]"
              aria-hidden="true"
            >
              <ArrowUpRight size={18} />
            </span>
          </div>
        </Card>
      </section>

      {/* Progressive Disclosure Tabs: 1. 6 Hũ chi tiêu | 2. Mục tiêu tích lũy | 3. Chi tiết & Cài đặt kế hoạch */}
      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as "jars" | "goals" | "details")
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList aria-label="Các phần của kế hoạch tài chính">
            <TabsTrigger value="jars">
              <PieChart aria-hidden="true" />
              <span>6 Hũ chi tiêu</span>
            </TabsTrigger>
            <TabsTrigger value="goals">
              <Target aria-hidden="true" />
              <span>Mục tiêu tích lũy</span>
              <TabsCount>{financialGoals.length}</TabsCount>
            </TabsTrigger>
            <TabsTrigger value="details">
              <Settings2 aria-hidden="true" />
              <span>Chi tiết & Cài đặt kế hoạch</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: 6 Hũ chi tiêu (6 Jars) */}
        <TabsContent value="jars">
          {currentMonth ? (
            <SixJarsSection
              month={currentMonth}
              currency={currency}
              canEditAllocation={plan.status === "active" && plan.canManage}
              disabled={disabled}
              onEditAllocation={onEditAllocation}
            />
          ) : (
            <Card>
              <Empty
                icon={PieChart}
                title="Chưa có dữ liệu phân bổ 6 hũ"
                description="Chọn tab Chi tiết & Cài đặt kế hoạch để xem lịch sử các tháng trước."
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

        {/* Tab 3: Chi tiết & Cài đặt kế hoạch */}
        <TabsContent value="details">
          <div className="grid gap-4 md:gap-5">
            {/* Plan Progress & Settings Card */}
            <Card>
              <CardHeader className="border-b border-[var(--border)]">
                <CardTitle>Tổng quan & Cài đặt kế hoạch</CardTitle>
                <CardDescription>
                  Theo dõi tiến độ tích lũy toàn kỳ và điều chỉnh thông số kế
                  hoạch khi cần.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5">
                    <dt className="break-words text-xs leading-snug text-[var(--text-secondary)]">
                      Đã tích lũy thực tế
                    </dt>
                    <dd className="mt-1 text-base font-bold text-[var(--foreground)] tabular-nums shrink-0">
                      {money(plan.realizedProgress, currency)}
                    </dd>
                    <small className="mt-0.5 block text-xs text-[var(--text-muted)] tabular-nums">
                      Mục tiêu: {money(plan.targetAmount, currency)}
                    </small>
                  </div>

                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5">
                    <dt className="break-words text-xs leading-snug text-[var(--text-secondary)]">
                      Dự kiến cuối tháng này
                    </dt>
                    <dd className="mt-1 text-base font-bold text-[var(--foreground)] tabular-nums shrink-0">
                      {money(plan.projectedEndOfCurrentMonthProgress, currency)}
                    </dd>
                    <small className="mt-0.5 block text-xs text-[var(--text-muted)] tabular-nums">
                      Đạt {plan.projectedCurrentProgressPercentage}% mục tiêu
                    </small>
                  </div>

                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5">
                    <dt className="break-words text-xs leading-snug text-[var(--text-secondary)]">
                      Dự kiến khi đến hạn
                    </dt>
                    <dd className="mt-1 text-base font-bold text-[var(--foreground)] tabular-nums shrink-0">
                      {money(plan.projectedEndOfPlanProgress, currency)}
                    </dd>
                    <small className="mt-0.5 block text-xs text-[var(--text-muted)]">
                      Hạn: {monthLabel(plan.targetMonth)}
                    </small>
                  </div>

                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5">
                    <dt className="break-words text-xs leading-snug text-[var(--text-secondary)]">
                      Mức cần bù thêm
                    </dt>
                    <dd
                      className={cn(
                        "mt-1 text-base font-bold tabular-nums shrink-0",
                        hasShortfall
                          ? "text-[var(--warning)]"
                          : "text-[var(--success)]",
                      )}
                    >
                      {hasShortfall ? money(shortfall, currency) : "0 ₫"}
                    </dd>
                    <small className="mt-0.5 block text-xs text-[var(--text-muted)]">
                      {hasShortfall
                        ? "Cần bổ sung thu nhập hoặc giãn hạn"
                        : "Đảm bảo đủ nguồn tích lũy"}
                    </small>
                  </div>
                </dl>

                {plan.canManage && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      Thao tác nhanh trên kế hoạch
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

            {/* Monthly Breakdown Table / List */}
            <MonthHistory months={plan.months} currency={currency} />

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
        presentation="sheet"
        onConfirm={onDelete ?? (() => {})}
        disabled={disabled}
      />
    </div>
  );
}

function SixJarsSection({
  month,
  currency,
  canEditAllocation,
  disabled,
  onEditAllocation,
}: {
  month: PlanMonth;
  currency: string;
  canEditAllocation?: boolean;
  disabled?: boolean;
  onEditAllocation?: () => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold leading-snug text-[var(--foreground)] md:text-lg">
            6 Hũ chi tiêu · {monthLabel(month.month)}
          </h3>
          <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-secondary)]">
            Theo dõi chi tiêu thực tế so với hạn mức phân bổ của từng hũ trong
            tháng.
          </p>
        </div>

        {canEditAllocation && onEditAllocation && (
          <Button
            variant="outline"
            size="icon"
            onClick={onEditAllocation}
            disabled={disabled}
            aria-label="Điều chỉnh tỷ lệ 6 hũ tháng sau"
            title="Điều chỉnh tỷ lệ 6 hũ tháng sau"
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
          </Button>
        )}
      </div>

      {/* 6 Jars Responsive Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
            <Card key={jar.jarCode} size="sm">
              {/* Top Row: Jar Name + % Share Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start gap-2">
                    <span
                      className="mt-1.5 size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <h4 className="min-w-0 break-words text-sm font-semibold leading-snug text-[var(--foreground)] md:text-base">
                      {FINANCIAL_JAR_LABELS[jar.jarCode]}
                    </h4>
                  </div>
                  <p className="mt-0.5 hidden break-words text-xs leading-snug text-[var(--text-muted)] md:block">
                    {JAR_DESCRIPTIONS[jar.jarCode]}
                  </p>
                </div>

                <span className="rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] px-2 py-0.5 text-xs font-bold text-[var(--foreground)] tabular-nums shrink-0">
                  {jar.percentage}%
                </span>
              </div>

              {/* Middle Row: Spent vs Allocated Amount */}
              <div className="space-y-2 border-t border-[var(--border)] pt-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                  <span className="break-words text-[var(--text-secondary)]">
                    Đã chi:{" "}
                    <strong className="font-bold text-[var(--foreground)] tabular-nums">
                      {money(spent, currency)}
                    </strong>
                  </span>
                  <span className="text-[var(--text-muted)] tabular-nums shrink-0">
                    / {money(jar.allocatedAmount, currency)}
                  </span>
                </div>

                {/* Progress Bar (green/amber/red status) */}
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

              {/* Bottom Row: Remaining Budget */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-secondary)] px-3 py-2 text-xs">
                <span className="break-words text-[var(--text-secondary)]">
                  {overspent ? "Vượt hạn mức" : "Ngân sách còn lại"}
                </span>
                <strong
                  className={cn(
                    "font-bold tabular-nums shrink-0",
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
            </Card>
          );
        })}
      </div>
    </div>
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
}: {
  months: PlanMonth[];
  currency: string;
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
              <span>Bảng chi tiết ngân sách theo tháng</span>
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

              <div className="flex items-center justify-between gap-3 md:shrink-0 md:justify-end">
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
          side="right"
          placement="inset"
          size="wide"
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
  hasMultipleGoals,
  isMobile,
  disabled,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessMonth: string;
  plan: DraftView | null;
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
  const valid = Boolean(
    draft.name.trim() &&
      (hasMultipleGoals ||
        (draft.targetAmount && draft.targetMonth >= nextMonth(businessMonth))) &&
      total.equals(100),
  );

  function submit() {
    startTransition(async () => {
      const payload = { ...draft, ...(plan ? { planId: plan.id } : {}) };
      const result = plan
        ? await updateFinancialPlanDraftAction(payload)
        : await createFinancialPlanWithGoalsAction({
            name: draft.name,
            goals: [
              {
                name: draft.name,
                targetAmount: draft.targetAmount,
                existingAmount: draft.existingGoalAmount,
                targetMonth: draft.targetMonth,
                trackingMode: "manual",
                linkedWalletId: null,
              },
            ],
            percentages: draft.percentages,
          });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(
        plan ? "Đã cập nhật bản nháp." : "Đã tạo bản nháp kế hoạch.",
      );
      onSaved(plan?.id ?? ("id" in result ? String(result.id) : ""));
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
              <TabsList variant="segmented" className="w-full">
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
                      minMonth={nextMonth(businessMonth)}
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
                  {!hasMultipleGoals && (
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
                    minMonth={nextMonth(businessMonth)}
                    value={draft.targetMonth}
                    onValueChange={(targetMonth) =>
                      setDraft({ ...draft, targetMonth })
                    }
                    disabled={isPending}
                  />
                )}
                {!hasMultipleGoals && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <MoneyInput
                      label="Số tiền mục tiêu"
                      required
                      value={draft.targetAmount}
                      onValueChange={(targetAmount) =>
                        setDraft({ ...draft, targetAmount })
                      }
                    />
                    <MoneyInput
                      label="Số tiền đã có sẵn"
                      value={draft.existingGoalAmount}
                      onValueChange={(existingGoalAmount) =>
                        setDraft({ ...draft, existingGoalAmount })
                      }
                    />
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
        </div>
        <SheetFooter
          onCancel={() => onOpenChange(false)}
          cancelLabel="Hủy"
          submitLabel={plan ? "Lưu bản nháp" : "Tạo bản nháp"}
          isSubmitting={isPending}
          submittingLabel={plan ? "Đang lưu..." : "Đang tạo..."}
          submitDisabled={disabled || isPending || !valid}
          onSubmit={submit}
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
        Sau khi tạo kế hoạch, bạn có thể thêm nhiều mục tiêu tích lũy khác và hệ
        thống sẽ tự động tính toán lại theo mức độ ưu tiên.
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
  isMobile,
  disabled,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRatios: RatioDraft;
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
          title="Điều chỉnh tỷ lệ 6 hũ tháng sau"
          description="Thay đổi tỷ lệ phân bổ bằng nút −/+. Tháng hiện tại và các tháng đã chốt không bị ảnh hưởng."
        />
        <div className="grid min-h-0 flex-1 content-start gap-6 overflow-y-auto px-4 py-5 md:px-6">
          <RatioEditor ratios={ratios} onChange={setRatios} />
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
  onChange,
}: {
  ratios: RatioDraft;
  onChange: (ratios: RatioDraft) => void;
}) {
  const ratioEditorId = useId();
  const total = ratioTotal(ratios);
  const is100 = total.equals(100);

  function adjustRatio(jarCode: FinancialJarCode, amount: number): void {
    const current = new Decimal(ratios[jarCode] || 0);
    const next = Decimal.max(0, Decimal.min(100, current.plus(amount)));
    onChange({ ...ratios, [jarCode]: next.toString() });
  }

  return (
    <fieldset className="grid gap-3">
      <legend className="sr-only">Phân bổ tỷ lệ 6 hũ chi tiêu</legend>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-[var(--foreground)]">
            Phân bổ tỷ lệ 6 hũ chi tiêu
          </p>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
              is100
                ? "bg-[color-mix(in_srgb,var(--success)_15%,var(--surface))] text-[var(--success)]"
                : "bg-[color-mix(in_srgb,var(--warning)_15%,var(--surface))] text-[var(--warning)]",
            )}
          >
            {is100 ? "Tổng 100%" : `Tổng ${total.toString()}% (Cần đủ 100%)`}
          </span>
        </div>
        <Button
          type="button"
          variant="icon"
          size="icon"
          onClick={() => onChange({ ...DEFAULT_RATIOS })}
          aria-label="Khôi phục tỷ lệ mặc định"
          title="Khôi phục tỷ lệ mặc định"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Stacked color progress bar */}
      <div
        className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-[var(--surface-secondary)]"
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
                backgroundColor: pct > 0 ? JAR_COLORS[jarCode] : "transparent",
              }}
            />
          );
        })}
      </div>

      {/* Jar rows */}
      <div className="grid divide-y divide-[var(--border)] pt-1">
        {FINANCIAL_JAR_CODES.map((jarCode) => {
          const label = FINANCIAL_JAR_LABELS[jarCode];
          const current = new Decimal(ratios[jarCode] || 0);
          const labelId = `${ratioEditorId}-${jarCode.toLowerCase()}`;
          const color = JAR_COLORS[jarCode];

          return (
            <div
              key={jarCode}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <span
                  className="mt-1.5 size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <span
                    id={labelId}
                    className="block break-words text-sm font-semibold leading-snug text-[var(--foreground)]"
                  >
                    {label}
                  </span>
                  <span className="mt-0.5 block break-words text-xs leading-snug text-[var(--text-muted)]">
                    {JAR_DESCRIPTIONS[jarCode]}
                  </span>
                </div>
              </div>

              <div
                className="flex shrink-0 items-center gap-1"
                role="group"
                aria-labelledby={labelId}
              >
                <Button
                  type="button"
                  variant="icon"
                  size="icon"
                  aria-label={`Giảm ${label} 5%`}
                  disabled={current.lessThanOrEqualTo(0)}
                  onClick={() => adjustRatio(jarCode, -5)}
                >
                  <Minus className="size-3.5" aria-hidden="true" />
                </Button>

                <output className="w-11 text-center text-sm font-bold text-[var(--foreground)] tabular-nums">
                  {current.toString()}%
                </output>

                <Button
                  type="button"
                  variant="icon"
                  size="icon"
                  aria-label={`Tăng ${label} 5%`}
                  disabled={current.greaterThanOrEqualTo(100)}
                  onClick={() => adjustRatio(jarCode, 5)}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}


