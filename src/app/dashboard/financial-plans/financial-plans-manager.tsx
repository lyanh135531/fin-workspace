"use client";

import Decimal from "decimal.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  activateFinancialPlanAction,
  cancelFinancialPlanAction,
  completeFinancialPlanAction,
  createFinancialPlanDraftAction,
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
  DatePicker,
  Empty,
  Input,
  MoneyInput,
  PageHeader,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/base";
import { ConfirmDelete } from "@/components/base/confirm-delete";
import {
  FINANCIAL_JAR_CODES,
  FINANCIAL_JAR_LABELS,
  type FinancialJarCode,
} from "@/domain";
import { formatAmount } from "@/lib/format";
import {
  AlertTriangle,
  CalendarRange,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleX,
  CircleDollarSign,
  Flag,
  History,
  LoaderCircle,
  Minus,
  MoreHorizontal,
  Pencil,
  PiggyBank,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";

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
  ahead: "Đi trước",
  on_track: "Đúng tiến độ",
  behind: "Chậm tiến độ",
  at_risk: "Có rủi ro",
  goal_reached: "Đã đạt mục tiêu",
  overdue: "Quá hạn",
} as const;

function monthLabel(month: string) {
  const [year, value] = month.split("-");
  return `Tháng ${Number(value)}/${year}`;
}

function monthEndDate(month: string) {
  const [year, value] = month.split("-").map(Number);
  const lastDay = new Date(year, value, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
}

function money(value: string, currency: string) {
  return `${formatAmount(value)} ${currency}`;
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

function jarUsagePercentage(jar: PlanMonthJar) {
  try {
    const allocated = new Decimal(jar.allocatedAmount);
    const spent = new Decimal(
      jar.expenseAmount ?? jar.closedActualAmount ?? "0",
    );
    if (allocated.lessThanOrEqualTo(0)) return spent.isPositive() ? 100 : 0;
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
}: {
  workspaceName: string;
  currency: string;
  businessMonth: string;
  canManage: boolean;
  plans: PlanListItem[];
  selectedPlan: SelectedPlan;
}) {
  const router = useRouter();
  const [editorOpen, setEditorOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [allocationOpen, setAllocationOpen] = useState(false);
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<PlanListItem | null>(
    null,
  );
  const [isMobile, setIsMobile] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const syncViewport = () => setIsMobile(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

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
    <div className="grid gap-4 md:gap-6">
      <div className="flex items-start justify-between gap-4 md:hidden">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--primary)]">
            Kế hoạch tài chính
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Mục tiêu của bạn
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
            Theo dõi tiến độ và hạn mức của {workspaceName}.
          </p>
        </div>
        {canManage && !activeExists && (
          <Button
            size="icon"
            onClick={() => setEditorOpen(true)}
            disabled={isPending}
            aria-label="Tạo kế hoạch"
          >
            <Plus aria-hidden />
          </Button>
        )}
      </div>

      <div className="hidden md:block">
        <PageHeader
          title="Kế hoạch tài chính"
          description={`Lập mục tiêu dài hạn cho ${workspaceName}, giữ khoản bắt buộc và kiểm soát hạn mức sáu hũ.`}
        >
          {canManage && !activeExists && (
            <Button onClick={() => setEditorOpen(true)} disabled={isPending}>
              <Plus aria-hidden /> Tạo kế hoạch
            </Button>
          )}
        </PageHeader>
      </div>

      {plans.length > 0 && (
        <>
          <Button
            size="lg"
            variant="outline"
            className="w-full justify-between px-3 text-left md:hidden"
            onClick={() => setPlanPickerOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={planPickerOpen}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <CalendarRange
                className="size-4 text-[var(--primary)]"
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {selectedPlan?.name ?? "Chọn kế hoạch"}
                </span>
                {selectedPlan && (
                  <span className="block text-xs font-normal text-[var(--text-muted)]">
                    {STATUS_LABELS[selectedPlan.status]} ·{" "}
                    {monthLabel(selectedPlan.targetMonth)}
                  </span>
                )}
              </span>
            </span>
            <ChevronDown
              className="size-4 text-[var(--text-muted)]"
              aria-hidden
            />
          </Button>

          <Sheet open={planPickerOpen} onOpenChange={setPlanPickerOpen}>
            <SheetContent
              side="bottom"
              className="quick-transaction-sheet md:hidden"
            >
              <SheetHeader className="quick-transaction-header">
                <div className="quick-transaction-heading">
                  <span aria-hidden>
                    <CalendarRange size={18} />
                  </span>
                  <div>
                    <SheetTitle>Chọn kế hoạch</SheetTitle>
                    <SheetDescription>
                      Xem mục tiêu đang chạy, bản nháp hoặc các kế hoạch trước
                      đây.
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <nav
                aria-label="Chọn kế hoạch"
                className="quick-transaction-scroll grid gap-2"
              >
                {plans.map((plan) => {
                  const StatusIcon = STATUS_ICONS[plan.status];
                  const selected = selectedPlan?.id === plan.id;
                  return (
                    <Card
                      key={plan.id}
                      size="sm"
                      tone={selected ? "primarySoft" : "default"}
                      className="flex-row items-center gap-2 p-2"
                    >
                      <Button
                        size="auto"
                        variant="ghost"
                        className="min-w-0 flex-1 justify-start gap-3 px-2 py-2 text-left"
                        render={
                          <Link href={`/financial-plans?plan=${plan.id}`} />
                        }
                        onClick={() => setPlanPickerOpen(false)}
                        aria-current={selected ? "page" : undefined}
                      >
                        <StatusIcon
                          className="size-5 text-[var(--primary)]"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">
                            {plan.name}
                          </span>
                          <span className="block text-xs font-normal text-[var(--text-muted)]">
                            {STATUS_LABELS[plan.status]} · Hạn{" "}
                            {monthLabel(plan.targetMonth)}
                          </span>
                        </span>
                      </Button>
                      {canManage && plan.status !== "active" ? (
                        <Button
                          variant="destructiveIcon"
                          size="icon"
                          aria-label={`Xóa kế hoạch ${plan.name}`}
                          disabled={isPending}
                          onClick={() => {
                            setPlanPickerOpen(false);
                            setDeleteCandidate(plan);
                          }}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      ) : selected ? (
                        <span className="grid size-8 place-items-center text-[var(--primary)]">
                          <CheckCircle2 className="size-4" aria-hidden />
                        </span>
                      ) : (
                        <span className="size-8" aria-hidden />
                      )}
                    </Card>
                  );
                })}
              </nav>
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
            description="Kế hoạch sẽ bị xóa khỏi danh sách. Các số liệu tài chính đã chốt vẫn được lưu trong hệ thống."
            content={
              deleteCandidate ? (
                <div className="ledger-mobile-review-transaction rounded-2xl">
                  <div>
                    <span>{deleteCandidate.name}</span>
                    <small>
                      {STATUS_LABELS[deleteCandidate.status]} · Hạn{" "}
                      {monthLabel(deleteCandidate.targetMonth)}
                    </small>
                  </div>
                </div>
              ) : undefined
            }
            confirmLabel="Xóa kế hoạch"
            confirmDisabled={isPending}
            onConfirm={() => {
              if (!deleteCandidate) return false;
              const deletingSelected = selectedPlan?.id === deleteCandidate.id;
              runAction(
                () => deleteFinancialPlanAction(deleteCandidate.id),
                "Đã xóa kế hoạch.",
                () => {
                  if (deletingSelected) router.replace("/financial-plans");
                },
              );
            }}
          />

          <nav
            aria-label="Danh sách kế hoạch"
            className="hidden gap-2 overflow-x-auto pb-1 md:flex"
          >
            {plans.map((plan) => (
              <Button
                key={plan.id}
                variant={selectedPlan?.id === plan.id ? "secondary" : "outline"}
                render={<Link href={`/financial-plans?plan=${plan.id}`} />}
              >
                <span className="max-w-44 truncate">{plan.name}</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {STATUS_LABELS[plan.status]}
                </span>
              </Button>
            ))}
          </nav>
        </>
      )}

      {!selectedPlan ? (
        <Card className="p-4 md:p-6">
          <Empty
            icon={Target}
            title="Chưa có kế hoạch tài chính"
            description={
              canManage
                ? "Tạo mục tiêu, chọn hạn hoàn thành và tỷ lệ sáu hũ. Hệ thống sẽ tự tính khoản cần để dành từ số dư và dòng tiền thực tế."
                : "Admin của workspace chưa tạo kế hoạch tài chính."
            }
            action={
              canManage ? (
                <Button size="lg" onClick={() => setEditorOpen(true)}>
                  <Plus aria-hidden /> Tạo kế hoạch đầu tiên
                </Button>
              ) : undefined
            }
            className="min-h-64 px-2 py-8 md:min-h-44 md:p-8"
          />
        </Card>
      ) : selectedPlan.status === "draft" ? (
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
      ) : (
        <PlanDetail
          plan={selectedPlan}
          currency={currency}
          currentMonth={currentPlanMonth}
          disabled={isPending}
          onEditDeadline={() => setDeadlineOpen(true)}
          onEditAllocation={() => setAllocationOpen(true)}
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
        />
      )}

      {canManage && editorOpen && (
        <PlanEditorSheet
          open={editorOpen}
          onOpenChange={setEditorOpen}
          businessMonth={businessMonth}
          plan={selectedPlan?.status === "draft" ? selectedPlan : null}
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
                  "Tỷ lệ mới sẽ áp dụng từ tháng sau.",
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
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card tone="primarySoft" className="p-4 md:p-6">
        <CardHeader>
          <div className="md:hidden">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary)]">
              <Target className="size-3.5" aria-hidden /> Bản nháp
            </span>
            <CardTitle className="mt-2 text-xl tracking-tight">
              {plan.name}
            </CardTitle>
            <CardDescription className="mt-1">
              Kiểm tra các con số trước khi kích hoạt.
            </CardDescription>
          </div>
          <div className="hidden md:block">
            <CardTitle className="flex items-center gap-2">
              <Target aria-hidden /> {plan.name}
            </CardTitle>
            <CardDescription>
              Bản nháp chưa ảnh hưởng hạn mức chi tiêu.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-3">
          <div className="col-span-2 md:col-span-1">
            <Metric
              label="Mục tiêu"
              value={money(plan.targetAmount, currency)}
              icon={Flag}
              featured
            />
          </div>
          <Metric
            label="Đã dành sẵn"
            value={money(plan.existingGoalAmount, currency)}
            icon={PiggyBank}
          />
          <Metric
            label="Hạn hoàn thành"
            value={monthLabel(plan.targetMonth)}
            icon={CalendarClock}
          />
        </CardContent>
        {plan.canManage && (
          <>
            <div className="grid grid-cols-2 gap-2 md:hidden">
              <Button
                size="lg"
                className="col-span-2"
                onClick={onActivate}
                disabled={disabled}
              >
                <CheckCircle2 aria-hidden /> Kích hoạt kế hoạch
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={onEdit}
                disabled={disabled}
              >
                <Pencil aria-hidden /> Chỉnh sửa
              </Button>
              <ConfirmDelete
                ariaLabel="Xóa bản nháp"
                title="Xóa bản nháp?"
                description="Kế hoạch nháp sẽ bị xóa khỏi danh sách."
                confirmLabel="Xóa bản nháp"
                presentation={isMobile ? "sheet" : "popover"}
                onConfirm={onDelete}
                disabled={disabled}
                trigger={
                  <Button
                    size="lg"
                    className="w-full"
                    variant="destructive"
                    disabled={disabled}
                  >
                    Xóa
                  </Button>
                }
              />
            </div>
            <div className="hidden flex-wrap gap-2 md:flex">
              <Button onClick={onActivate} disabled={disabled}>
                <CheckCircle2 aria-hidden /> Kích hoạt kế hoạch
              </Button>
              <Button variant="outline" onClick={onEdit} disabled={disabled}>
                <Pencil aria-hidden /> Sửa bản nháp
              </Button>
              <ConfirmDelete
                ariaLabel="Xóa bản nháp"
                title="Xóa bản nháp?"
                description="Kế hoạch nháp sẽ bị xóa khỏi danh sách."
                confirmLabel="Xóa bản nháp"
                presentation={isMobile ? "sheet" : "popover"}
                onConfirm={onDelete}
                disabled={disabled}
                trigger={
                  <Button variant="destructive" disabled={disabled}>
                    Xóa bản nháp
                  </Button>
                }
              />
            </div>
          </>
        )}
      </Card>
      <Card className="p-4 md:p-6">
        <CardHeader>
          <CardTitle>Tỷ lệ sáu hũ</CardTitle>
          <CardDescription>Tổng cố định 100% khi kích hoạt.</CardDescription>
        </CardHeader>
        <CardContent>
          <RatioList ratios={plan.percentages} />
        </CardContent>
      </Card>
    </div>
  );
}

function PlanDetail({
  plan,
  currency,
  currentMonth,
  disabled,
  onEditDeadline,
  onEditAllocation,
  onCancel,
  onComplete,
}: {
  plan: RunningView;
  currency: string;
  currentMonth?: PlanMonth;
  disabled: boolean;
  onEditDeadline: () => void;
  onEditAllocation: () => void;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const shortfall = currentMonth?.resourceShortfall ?? "0";
  const hasShortfall = new Decimal(shortfall).greaterThan(0);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelConfirmRequested, setCancelConfirmRequested] = useState(false);

  useEffect(() => {
    if (actionsOpen || !cancelConfirmRequested) return;

    const timer = window.setTimeout(() => {
      setCancelConfirmRequested(false);
      setCancelConfirmOpen(true);
    }, 200);

    return () => window.clearTimeout(timer);
  }, [actionsOpen, cancelConfirmRequested]);

  return (
    <div className="grid gap-5">
      <Card tone="primarySoft" className="p-4 md:p-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 md:hidden">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary)]">
                <span
                  className="size-1.5 rounded-full bg-[var(--primary)]"
                  aria-hidden
                />
                {STATUS_LABELS[plan.status]}
                {plan.status === "active"
                  ? ` · ${HEALTH_LABELS[plan.health]}`
                  : ""}
              </span>
              <CardTitle className="mt-2 text-xl tracking-tight">
                {plan.name}
              </CardTitle>
              <CardDescription className="mt-1">
                {monthLabel(plan.startMonth)} → {monthLabel(plan.targetMonth)}
              </CardDescription>
            </div>
            {plan.status === "active" && plan.canManage && (
              <Button
                variant="icon"
                size="icon"
                onClick={() => setActionsOpen(true)}
                aria-label="Mở thao tác kế hoạch"
              >
                <MoreHorizontal aria-hidden />
              </Button>
            )}
          </div>
          <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
            <div>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>
                {STATUS_LABELS[plan.status]}
                {plan.status === "active"
                  ? ` · ${HEALTH_LABELS[plan.health]}`
                  : ""}{" "}
                · {monthLabel(plan.startMonth)} → {monthLabel(plan.targetMonth)}
              </CardDescription>
            </div>
            {plan.status === "active" && plan.canManage && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={onEditDeadline}
                  disabled={disabled}
                >
                  <CalendarClock aria-hidden /> Hạn hoàn thành
                </Button>
                <Button
                  variant="outline"
                  onClick={onEditAllocation}
                  disabled={disabled}
                >
                  <SlidersHorizontal aria-hidden /> Tỷ lệ tháng sau
                </Button>
                {plan.canComplete && (
                  <Button
                    variant="success"
                    onClick={onComplete}
                    disabled={disabled}
                  >
                    <CheckCircle2 aria-hidden /> Hoàn thành
                  </Button>
                )}
                <ConfirmDelete
                  ariaLabel="Hủy kế hoạch"
                  title="Hủy kế hoạch đang chạy?"
                  description="Kế hoạch sẽ chuyển sang chỉ đọc. Snapshot các tháng đã đóng được giữ nguyên."
                  confirmLabel="Hủy kế hoạch"
                  onConfirm={onCancel}
                  disabled={disabled}
                  trigger={
                    <Button variant="destructive" disabled={disabled}>
                      Hủy kế hoạch
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="md:hidden">
            <p className="text-xs text-[var(--text-muted)]">Đã tích lũy</p>
            <p className="mt-1 truncate text-3xl font-semibold tracking-tight tabular-nums text-[var(--foreground)]">
              {money(plan.realizedProgress, currency)}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              trên mục tiêu {money(plan.targetAmount, currency)}
            </p>
          </div>
          <div
            className={`hidden gap-4 md:grid md:grid-cols-2 ${hasShortfall ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
          >
            <Metric
              label="Mục tiêu"
              value={money(plan.targetAmount, currency)}
              icon={Target}
            />
            <Metric
              label="Đã tích lũy"
              value={money(plan.realizedProgress, currency)}
              icon={PiggyBank}
            />
            <Metric
              label="Ước tính tích lũy cuối tháng"
              value={money(plan.projectedEndOfCurrentMonthProgress, currency)}
              icon={TrendingUp}
            />
            {hasShortfall && (
              <Metric
                label="Số tiền còn thiếu"
                value={money(shortfall, currency)}
                icon={AlertTriangle}
                tone="warning"
              />
            )}
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">
                Tiến độ đã tích lũy
              </span>
              <strong>{plan.realizedProgressPercentage}%</strong>
            </div>
            <div
              role="progressbar"
              aria-label="Tiến độ đã ghi nhận"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Number(plan.realizedProgressPercentage)}
              className="h-2 overflow-hidden rounded-full bg-[var(--surface-secondary)]"
            >
              <div
                className="h-full bg-[var(--primary)] transition-[width] duration-300"
                style={{
                  width: `${progressWidth(plan.realizedProgressPercentage)}%`,
                }}
              />
            </div>
            <p className="hidden text-xs text-[var(--text-muted)] md:block">
              Ước tính cuối tháng: {plan.projectedCurrentProgressPercentage}% ·
              Ước tính khi đến hạn:{" "}
              {money(plan.projectedEndOfPlanProgress, currency)}
            </p>
          </div>
          <div
            className={`grid gap-x-4 border-t border-[var(--border)] pt-4 md:hidden ${hasShortfall ? "grid-cols-2" : "grid-cols-1"}`}
          >
            <Metric
              label="Ước tính tích lũy cuối tháng"
              value={money(plan.projectedEndOfCurrentMonthProgress, currency)}
              icon={TrendingUp}
            />
            {hasShortfall && (
              <Metric
                label="Số tiền còn thiếu"
                value={money(shortfall, currency)}
                icon={AlertTriangle}
                tone="warning"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {plan.status === "active" && plan.canManage && (
        <>
          <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
            <SheetContent
              side="bottom"
              className="quick-transaction-sheet md:hidden"
            >
            <SheetHeader className="quick-transaction-header">
              <div className="quick-transaction-heading">
                <span aria-hidden>
                  <SlidersHorizontal size={18} />
                </span>
                <div>
                  <SheetTitle>Quản lý kế hoạch</SheetTitle>
                  <SheetDescription>Kế hoạch: {plan.name}</SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <div className="quick-transaction-scroll grid gap-4">
              <section
                className="grid gap-2"
                aria-labelledby={`plan-adjustments-${plan.id}`}
              >
                <p
                  id={`plan-adjustments-${plan.id}`}
                  className="px-1 text-xs font-medium text-[var(--text-muted)]"
                >
                  Điều chỉnh
                </p>
                <Button
                  size="auto"
                  variant="outline"
                  className="w-full justify-start px-4 py-3 text-left rounded-2xl"
                  onClick={() => {
                    setActionsOpen(false);
                    onEditDeadline();
                  }}
                  disabled={disabled}
                >
                  <CalendarClock className="size-5" aria-hidden />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="text-sm font-semibold">
                      Đổi hạn hoàn thành
                    </span>
                    <span className="truncate text-xs font-normal text-[var(--text-muted)]">
                      Điều chỉnh tháng kết thúc kế hoạch
                    </span>
                  </span>
                </Button>
                <Button
                  size="auto"
                  variant="outline"
                  className="w-full justify-start px-4 py-3 text-left rounded-2xl"
                  onClick={() => {
                    setActionsOpen(false);
                    onEditAllocation();
                  }}
                  disabled={disabled}
                >
                  <SlidersHorizontal className="size-5" aria-hidden />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="text-sm font-semibold">Tỷ lệ sáu hũ</span>
                    <span className="truncate text-xs font-normal text-[var(--text-muted)]">
                      Điều chỉnh phân bổ từ tháng sau
                    </span>
                  </span>
                </Button>
              </section>

              <section
                className="grid gap-2 border-t border-[var(--border)] pt-4"
                aria-labelledby={`plan-status-${plan.id}`}
              >
                <p
                  id={`plan-status-${plan.id}`}
                  className="px-1 text-xs font-medium text-[var(--text-muted)]"
                >
                  Trạng thái kế hoạch
                </p>
                {plan.canComplete && (
                  <Button
                    size="auto"
                    variant="success"
                    className="w-full justify-start px-4 py-3 text-left rounded-2xl"
                    onClick={() => {
                      setActionsOpen(false);
                      onComplete();
                    }}
                    disabled={disabled}
                  >
                    <CheckCircle2 className="size-5" aria-hidden />
                    <span className="grid min-w-0 gap-0.5">
                      <span className="text-sm font-semibold">
                        Hoàn thành kế hoạch
                      </span>
                      <span className="truncate text-xs font-normal">
                        Chốt kế hoạch khi đã đạt mục tiêu
                      </span>
                    </span>
                  </Button>
                )}
                <Button
                  size="auto"
                  variant="destructive"
                  className="w-full justify-start px-4 py-3 text-left rounded-2xl"
                  onClick={() => {
                    setCancelConfirmRequested(true);
                    setActionsOpen(false);
                  }}
                  disabled={disabled}
                >
                  <AlertTriangle className="size-5" aria-hidden />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="text-sm font-semibold">
                      Hủy kế hoạch
                    </span>
                    <span className="truncate text-xs font-normal">
                      Dừng theo dõi và giữ nguyên lịch sử
                    </span>
                  </span>
                </Button>
              </section>
            </div>
            <SheetFooter className="quick-transaction-footer">
              <Button
                size="lg"
                variant="outline"
                onClick={() => setActionsOpen(false)}
              >
                Đóng
              </Button>
            </SheetFooter>
            </SheetContent>
          </Sheet>

          <ConfirmDelete
            open={cancelConfirmOpen}
            onOpenChange={setCancelConfirmOpen}
            trigger={null}
            presentation="sheet"
            ariaLabel="Hủy kế hoạch"
            title="Hủy kế hoạch đang chạy?"
            description="Kế hoạch sẽ dừng và chuyển sang chế độ chỉ đọc. Dữ liệu các tháng đã chốt vẫn được giữ nguyên."
            confirmLabel="Hủy kế hoạch"
            onConfirm={onCancel}
            disabled={disabled}
          />
        </>
      )}

      {currentMonth && (
        <CurrentMonthBudget month={currentMonth} currency={currency} />
      )}
      <MonthHistory months={plan.months} currency={currency} />
    </div>
  );
}

function CurrentMonthBudget({
  month,
  currency,
}: {
  month: PlanMonth;
  currency: string;
}) {
  const [jarDetailsOpen, setJarDetailsOpen] = useState(false);
  const availableToSpend = new Decimal(month.availableToSpend);
  const spentThisMonth = new Decimal(
    month.eligibleExpense ??
      month.jars
        .reduce(
          (total, jar) =>
            total.plus(jar.expenseAmount ?? jar.closedActualAmount ?? "0"),
          new Decimal(0),
        )
        .toString(),
  );
  const monthlyBudget = Decimal.max(0, month.allocatableGrossBudget);
  const monthlyUsage = monthlyBudget.isZero()
    ? spentThisMonth.isPositive()
      ? new Decimal(100)
      : new Decimal(0)
    : spentThisMonth.dividedBy(monthlyBudget).times(100);
  const monthlyUsageWidth = progressWidth(monthlyUsage.toString());
  const monthlyUsageTone = progressTone(monthlyUsageWidth);

  return (
    <Card className="p-4 md:p-6">
      <CardHeader>
        <CardTitle>
          <span className="md:hidden">{monthLabel(month.month)}</span>
          <span className="hidden items-center gap-2 md:flex">
            <CircleDollarSign aria-hidden />{" "}
            {month.closed ? "Số liệu đã chốt" : "Ngân sách"}{" "}
            {monthLabel(month.month)}
          </span>
        </CardTitle>
        <CardDescription className="hidden md:block">
          Cần để dành {money(month.adjustedRequiredAmount, currency)} cho mục
          tiêu tháng này.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:gap-4">
        <div className="grid gap-1 border-t border-[var(--border)] pt-3 md:flex md:items-end md:justify-between md:gap-4 md:pt-4">
          <span className="text-xs text-[var(--text-muted)] md:text-sm md:text-[var(--text-secondary)]">
            {month.closed ? "Còn lại khi chốt" : "Còn có thể chi"}
          </span>
          <strong
            className={`text-2xl font-semibold tracking-tight tabular-nums md:text-xl ${availableToSpend.isNegative() ? "text-[var(--destructive)]" : "text-[var(--foreground)]"}`}
          >
            {money(month.availableToSpend, currency)}
          </strong>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 md:hidden">
          <div
            className="h-2 overflow-hidden rounded-full bg-[var(--surface-secondary)]"
            role="progressbar"
            aria-label={`Tiến độ chi tiêu ${monthLabel(month.month)}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(monthlyUsageWidth)}
            aria-valuetext={`${monthlyUsage.toDecimalPlaces(0).toString()}%, ${money(spentThisMonth.toString(), currency)} trên ${money(monthlyBudget.toString(), currency)}`}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${PROGRESS_BAR_TONES[monthlyUsageTone]}`}
              style={{ width: `${monthlyUsageWidth}%` }}
            />
          </div>
          <span
            className={`min-w-8 text-right text-xs font-medium tabular-nums ${PROGRESS_TEXT_TONES[monthlyUsageTone]}`}
            aria-hidden="true"
          >
            {monthlyUsage.toDecimalPlaces(0).toString()}%
          </span>
        </div>

        <div className="border-t border-[var(--border)] md:hidden">
          <Button
            variant="ghost"
            size="auto"
            className="w-full justify-between py-2.5 text-sm font-medium"
            onClick={() => setJarDetailsOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={jarDetailsOpen}
          >
            <span>Chi tiết 6 hũ</span>
            <ChevronDown
              className="size-4 shrink-0 -rotate-90 text-[var(--text-muted)]"
              aria-hidden
            />
          </Button>
        </div>

        <Sheet open={jarDetailsOpen} onOpenChange={setJarDetailsOpen}>
          <SheetContent side="bottom" placement="inset">
            <SheetHeader>
              <SheetTitle>Chi tiết 6 hũ</SheetTitle>
              <SheetDescription>{monthLabel(month.month)}</SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto px-4 pb-4">
              <BudgetJarList month={month} currency={currency} />
            </div>
          </SheetContent>
        </Sheet>

        <details className="group hidden border-t border-[var(--border)] md:block">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] md:py-3 md:text-base">
            <span>Chi tiết 6 hũ</span>
            <ChevronDown
              className="size-4 shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <BudgetJarList month={month} currency={currency} />
        </details>
      </CardContent>
    </Card>
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
    <div className="grid divide-y divide-[var(--border)] border-t border-[var(--border)]">
      {month.jars.map((jar) => {
        const remaining =
          jar.remainingAmount ??
          new Decimal(jar.allocatedAmount)
            .minus(jar.closedActualAmount ?? 0)
            .toFixed(0);
        const spent = jar.expenseAmount ?? jar.closedActualAmount ?? "0";
        const overspent = new Decimal(remaining).isNegative();
        const jarUsage = jarUsagePercentage(jar);
        const jarUsageTone = progressTone(jarUsage);

        return (
          <div key={jar.jarCode} className="grid gap-2 py-2.5 md:py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)] md:text-base">
                  {FINANCIAL_JAR_LABELS[jar.jarCode]}
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-[var(--text-muted)] md:text-xs">
                  <span className="md:hidden">
                    {money(spent, currency)} /{" "}
                    {money(jar.allocatedAmount, currency)}
                  </span>
                  <span className="hidden md:inline">
                    {month.closed ? "Đã chi" : "Đã chi và ước tính sẽ chi"}{" "}
                    {money(spent, currency)} · {jar.percentage}%
                  </span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] text-[var(--text-muted)]">Còn lại</p>
                <strong
                  className={`text-sm tabular-nums md:text-base ${overspent ? "text-[var(--destructive)]" : "text-[var(--foreground)]"}`}
                >
                  {money(remaining, currency)}
                </strong>
              </div>
            </div>
            <div
              className="h-1 overflow-hidden rounded-full bg-[var(--surface-secondary)] md:h-1.5"
              aria-hidden="true"
            >
              <div
                className={`h-full rounded-full ${overspent ? PROGRESS_BAR_TONES.critical : PROGRESS_BAR_TONES[jarUsageTone]}`}
                style={{ width: `${jarUsage}%` }}
              />
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
  return (
    <Card className="p-4 md:p-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History aria-hidden /> Lịch kế hoạch theo tháng
        </CardTitle>
        <CardDescription className="hidden md:block">
          Tháng chưa kết thúc được cập nhật theo dữ liệu hiện tại; tháng đã kết
          thúc giữ nguyên số liệu đã chốt và hiển thị riêng các điều chỉnh từ
          giao dịch cũ.
        </CardDescription>
        <CardDescription className="md:hidden">
          Mở từng tháng để xem ngân sách và số tiền cần để dành.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {months.map((month) => (
          <details
            key={month.month}
            className="group border-b border-[var(--border)] py-3 last:border-b-0 md:rounded-xl md:border-b-0 md:bg-[var(--surface-secondary)] md:px-4"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
              <span className="min-w-0">
                <strong className="block md:inline">
                  {monthLabel(month.month)}
                </strong>
                <span className="text-xs text-[var(--text-muted)] md:ml-2">
                  {month.closed ? "Đã đóng" : "Dự kiến"}
                </span>
              </span>
              <span className="flex items-center gap-2 text-right text-sm">
                <span>
                  <span className="block text-[10px] text-[var(--text-muted)] md:text-xs">
                    Cần để dành
                  </span>
                  <strong className="tabular-nums">
                    {money(month.adjustedRequiredAmount, currency)}
                  </strong>
                </span>
                <ChevronDown
                  className="size-4 shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180 md:hidden"
                  aria-hidden
                />
              </span>
            </summary>
            <div
              className={`mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--border)] pt-3 ${new Decimal(month.resourceShortfall).greaterThan(0) ? "md:grid-cols-3" : "md:grid-cols-2"}`}
            >
              <Metric
                label={month.closed ? "Còn lại khi chốt" : "Còn có thể chi"}
                value={money(month.availableToSpend, currency)}
                icon={CircleDollarSign}
                tone={
                  new Decimal(month.availableToSpend).isNegative()
                    ? "warning"
                    : "default"
                }
              />
              {new Decimal(month.resourceShortfall).greaterThan(0) && (
                <Metric
                  label="Số tiền còn thiếu"
                  value={money(month.resourceShortfall, currency)}
                  icon={AlertTriangle}
                  tone="warning"
                />
              )}
              <div
                className={
                  new Decimal(month.resourceShortfall).greaterThan(0)
                    ? "col-span-2 md:col-span-1"
                    : ""
                }
              >
                <Metric
                  label={
                    month.closed ? "Thực tế đã để dành" : "Ước tính để dành"
                  }
                  value={money(
                    month.closedActualGoalAmount ??
                      month.projectedActualGoalAmount ??
                      "0",
                    currency,
                  )}
                  icon={PiggyBank}
                />
              </div>
              {month.closed &&
                month.adjustedDelta &&
                month.adjustedDelta !== "0" && (
                  <p className="sm:col-span-3 text-sm text-[var(--warning)]">
                    Điều chỉnh do giao dịch cũ thay đổi:{" "}
                    {money(month.adjustedDelta, currency)}.
                  </p>
                )}
            </div>
          </details>
        ))}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tone = "default",
  featured = false,
}: {
  label: string;
  value: string;
  icon: typeof Target;
  tone?: "default" | "warning";
  featured?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span
        className={
          tone === "warning" ? "text-[var(--warning)]" : "text-[var(--primary)]"
        }
      >
        <Icon aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
        <p
          className={`truncate font-semibold tabular-nums text-[var(--foreground)] ${featured ? "text-xl tracking-tight md:text-sm md:tracking-normal" : ""}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function RatioList({ ratios }: { ratios: RatioDraft }) {
  return (
    <dl className="grid divide-y divide-[var(--border)] md:gap-2 md:divide-y-0">
      {FINANCIAL_JAR_CODES.map((jarCode) => (
        <div
          key={jarCode}
          className="flex justify-between gap-3 py-2 first:pt-0 last:pb-0 md:py-0"
        >
          <dt className="text-[var(--text-secondary)]">
            {FINANCIAL_JAR_LABELS[jarCode]}
          </dt>
          <dd className="font-semibold tabular-nums">{ratios[jarCode]}%</dd>
        </div>
      ))}
    </dl>
  );
}

function PlanSheetHeader({
  isMobile,
  icon: Icon,
  title,
  description,
}: {
  isMobile: boolean;
  icon: typeof Target;
  title: string;
  description: string;
}) {
  return (
    <SheetHeader className={isMobile ? "quick-transaction-header" : undefined}>
      <div className={isMobile ? "quick-transaction-heading" : undefined}>
        {isMobile && (
          <span aria-hidden>
            <Icon size={18} />
          </span>
        )}
        <div>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </div>
      </div>
    </SheetHeader>
  );
}

function PlanEditorSheet({
  open,
  onOpenChange,
  businessMonth,
  plan,
  isMobile,
  disabled,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessMonth: string;
  plan: DraftView | null;
  isMobile: boolean;
  disabled: boolean;
  onSaved: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
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
            targetMonth: businessMonth,
            percentages: { ...DEFAULT_RATIOS },
          },
    [plan, businessMonth],
  );
  const [draft, setDraft] = useState(initial);
  const total = ratioTotal(draft.percentages);
  const valid = Boolean(
    draft.name.trim() &&
    draft.targetAmount &&
    draft.targetMonth >= businessMonth &&
    total.equals(100),
  );

  function submit() {
    startTransition(async () => {
      const payload = { ...draft, ...(plan ? { planId: plan.id } : {}) };
      const result = plan
        ? await updateFinancialPlanDraftAction(payload)
        : await createFinancialPlanDraftAction(payload);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(
        plan ? "Đã cập nhật bản nháp." : "Đã tạo bản nháp để xem lại.",
      );
      onSaved(plan?.id ?? ("id" in result ? String(result.id) : ""));
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        size={isMobile ? "default" : "wide"}
        spacing={isMobile ? "flush" : "default"}
        elevation={isMobile ? "raised" : "flat"}
        className={isMobile ? "quick-transaction-sheet" : "overflow-y-auto"}
      >
        <PlanSheetHeader
          isMobile={isMobile}
          icon={Target}
          title={plan ? "Sửa bản nháp" : "Tạo kế hoạch tài chính"}
          description="Hạn hoàn thành tính cả tháng hiện tại. Tiền đã dành sẵn phải thực sự nằm trong số dư của không gian làm việc."
        />
        <div
          className={
            isMobile
              ? "quick-transaction-scroll grid gap-5"
              : "grid gap-5 px-4 py-2"
          }
        >
          <Input
            label="Tên kế hoạch"
            required
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
            placeholder="Ví dụ: Quỹ Tết năm sau"
          />
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
              label="Đã dành sẵn cho mục tiêu"
              value={draft.existingGoalAmount}
              onValueChange={(existingGoalAmount) =>
                setDraft({ ...draft, existingGoalAmount })
              }
            />
          </div>
          <DatePicker
            label="Ngày mục tiêu"
            required
            minDate={`${businessMonth}-01`}
            value={monthEndDate(draft.targetMonth)}
            onValueChange={(targetDate) =>
              setDraft({ ...draft, targetMonth: targetDate.slice(0, 7) })
            }
            disabled={isPending}
          />
          <RatioEditor
            ratios={draft.percentages}
            onChange={(percentages) => setDraft({ ...draft, percentages })}
          />
        </div>
        <SheetFooter
          className={isMobile ? "quick-transaction-footer" : undefined}
        >
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Đóng
          </Button>
          <Button
            onClick={submit}
            disabled={disabled || isPending || !valid}
            aria-busy={isPending}
          >
            {isPending && <LoaderCircle className="animate-spin" aria-hidden />}
            {plan ? "Lưu bản nháp" : "Tạo bản nháp"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
        spacing={isMobile ? "flush" : "default"}
        elevation={isMobile ? "raised" : "flat"}
        className={isMobile ? "quick-transaction-sheet" : undefined}
      >
        <PlanSheetHeader
          isMobile={isMobile}
          icon={CalendarClock}
          title="Đổi hạn hoàn thành"
          description="Các tháng đã chốt không đổi. Toàn bộ tháng chưa chốt sẽ được tính lại."
        />
        <div className={isMobile ? "quick-transaction-scroll" : "px-4 py-2"}>
          <DatePicker
            label="Ngày mục tiêu mới"
            required
            minDate={`${plan.businessMonth}-01`}
            value={monthEndDate(targetMonth)}
            onValueChange={(targetDate) =>
              setTargetMonth(targetDate.slice(0, 7))
            }
            disabled={disabled}
          />
        </div>
        <SheetFooter
          className={isMobile ? "quick-transaction-footer" : undefined}
        >
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button
            onClick={() => onSave(targetMonth)}
            disabled={disabled || targetMonth < plan.businessMonth}
          >
            Áp dụng
          </Button>
        </SheetFooter>
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
        spacing={isMobile ? "flush" : "default"}
        elevation={isMobile ? "raised" : "flat"}
        className={isMobile ? "quick-transaction-sheet" : "overflow-y-auto"}
      >
        <PlanSheetHeader
          isMobile={isMobile}
          icon={SlidersHorizontal}
          title="Phân bổ tháng sau"
          description="Điều chỉnh từng hũ bằng nút −/+. Tháng hiện tại và các tháng đã đóng sẽ không thay đổi."
        />
        <div className={isMobile ? "quick-transaction-scroll" : "px-4 py-2"}>
          <RatioEditor ratios={ratios} onChange={setRatios} />
        </div>
        <SheetFooter
          className={isMobile ? "quick-transaction-footer" : undefined}
        >
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button
            onClick={() => onSave(ratios)}
            disabled={disabled || !total.equals(100)}
          >
            Áp dụng từ tháng sau
          </Button>
        </SheetFooter>
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
  const remaining = new Decimal(100).minus(total);

  function adjustRatio(jarCode: FinancialJarCode, amount: number): void {
    const current = new Decimal(ratios[jarCode] || 0);
    const next = Decimal.max(0, Decimal.min(100, current.plus(amount)));
    onChange({ ...ratios, [jarCode]: next.toString() });
  }

  return (
    <fieldset className="grid gap-4">
      <legend className="sr-only">Phân bổ tỷ lệ sáu hũ</legend>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-[var(--foreground)]">
            Chia 100% vào sáu hũ
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Mỗi lần chạm thay đổi 5%.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange({ ...DEFAULT_RATIOS })}
        >
          <RotateCcw aria-hidden /> Về mặc định
        </Button>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {FINANCIAL_JAR_CODES.map((jarCode) => {
          const label = FINANCIAL_JAR_LABELS[jarCode];
          const current = new Decimal(ratios[jarCode] || 0);
          const labelId = `${ratioEditorId}-${jarCode.toLowerCase()}`;

          return (
            <div
              key={jarCode}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span
                id={labelId}
                className="min-w-0 font-medium text-[var(--text-secondary)]"
              >
                {label}
              </span>
              <div
                className="flex items-center gap-2"
                role="group"
                aria-labelledby={labelId}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="fab"
                  aria-label={`Giảm ${label} 5%`}
                  disabled={current.lessThanOrEqualTo(0)}
                  onClick={() => adjustRatio(jarCode, -5)}
                >
                  <Minus aria-hidden />
                </Button>
                <output className="min-w-14 text-center text-lg font-semibold tabular-nums text-[var(--foreground)]">
                  {current.toString()}%
                </output>
                <Button
                  type="button"
                  variant="outline"
                  size="fab"
                  aria-label={`Tăng ${label} 5%`}
                  disabled={current.greaterThanOrEqualTo(100)}
                  onClick={() => adjustRatio(jarCode, 5)}
                >
                  <Plus aria-hidden />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-2 border-t border-[var(--border)] pt-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-[var(--text-secondary)]">
            Tổng phân bổ
          </span>
          <strong className="text-lg tabular-nums text-[var(--foreground)]">
            {total.toString()}%
          </strong>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-secondary)]"
          aria-hidden
        >
          <div
            className={`h-full transition-[width] duration-200 ${
              total.equals(100)
                ? "bg-[var(--success)]"
                : total.greaterThan(100)
                  ? "bg-[var(--destructive)]"
                  : "bg-[var(--primary)]"
            }`}
            style={{
              width: `${Decimal.max(0, Decimal.min(100, total)).toString()}%`,
            }}
          />
        </div>
        <p
          className={
            total.equals(100)
              ? "text-sm text-[var(--success)]"
              : total.greaterThan(100)
                ? "text-sm text-[var(--destructive)]"
                : "text-sm text-[var(--warning)]"
          }
          role="status"
          aria-live="polite"
        >
          {total.equals(100)
            ? "Đã phân bổ đủ 100%."
            : remaining.isPositive()
              ? `Còn ${remaining.toString()}% chưa phân bổ.`
              : `Đang vượt ${remaining.abs().toString()}%. Hãy giảm bớt để tiếp tục.`}
        </p>
      </div>
    </fieldset>
  );
}
