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
  CardAction,
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
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsContent,
  TabsCount,
  TabsList,
  TabsTrigger,
} from "@/components/base";
import { ConfirmDelete } from "@/components/base/confirm-delete";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SpotlightTrigger } from "@/components/ui/spotlight-trigger";
import {
  FINANCIAL_JAR_CODES,
  FINANCIAL_JAR_LABELS,
  type FinancialJarCode,
} from "@/domain";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CalendarRange,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleX,
  CircleDollarSign,
  Eye,
  Flag,
  History,
  LoaderCircle,
  Minus,
  MoreHorizontal,
  Pencil,
  PieChart,
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

function nextMonth(month: string) {
  const [year, m] = month.split("-").map(Number);
  return m === 12
    ? `${year + 1}-01`
    : `${year}-${String(m + 1).padStart(2, "0")}`;
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

const JAR_COLORS: Record<FinancialJarCode, string> = {
  ESSENTIAL: "var(--primary)",
  RESPONSIBILITY: "var(--warning)",
  DEVELOPMENT: "var(--success)",
  ENJOYMENT: "#e879a0",
  INVESTMENT: "#60a5fa",
  GIVING: "#a78bfa",
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
  const [mobileDetailId, setMobileDetailId] = useState<string | null>(null);
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
      <div className="flex items-center justify-between gap-4 md:hidden">
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
            type="button"
            variant="default"
            size="icon"
            className="wallet-mobile-add"
            onClick={() => setEditorOpen(true)}
            disabled={isPending}
            aria-label="Tạo kế hoạch"
          >
            <Plus size={18} />
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

      {plans.length > 0 && activeExists && (
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

        </>
      )}

      {/* Mobile: flat list when no active plan */}
      {plans.length > 0 && !activeExists && (
        <div className="grid gap-3 md:hidden">
          {plans.map((plan) => (
            <DraftListItem
              key={plan.id}
              plan={plan}
              currency={currency}
              isMobile={isMobile}
              disabled={isPending}
              canManage={canManage}
              onActivate={() =>
                runAction(
                  () => activateFinancialPlanAction(plan.id),
                  "Đã kích hoạt kế hoạch.",
                )
              }
              onEdit={() => {
                router.replace(`/financial-plans?plan=${plan.id}`);
                setEditorOpen(true);
              }}
              onSelect={() => {
                setMobileDetailId(plan.id);
                router.push(`/financial-plans?plan=${plan.id}`);
              }}
              onDelete={() =>
                runAction(
                  () => deleteFinancialPlanAction(plan.id),
                  "Đã xóa kế hoạch.",
                  () => {
                    setMobileDetailId(null);
                    router.replace("/financial-plans");
                  },
                )
              }
            />
          ))}
        </div>
      )}

      {/* Mobile detail sheet when no active plan and user explicitly clicks 'Xem chi tiết' */}
      {isMobile &&
        !activeExists &&
        mobileDetailId !== null &&
        selectedPlan?.id === mobileDetailId && (
          <Sheet
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                setMobileDetailId(null);
                router.replace("/financial-plans");
              }
            }}
          >
            <SheetContent
              side="bottom"
              className="quick-transaction-sheet md:hidden"
            >
              <SheetHeader className="quick-transaction-header">
                <div className="quick-transaction-heading">
                  <span aria-hidden>
                    <Target size={18} />
                  </span>
                  <div>
                    <SheetTitle>{selectedPlan.name}</SheetTitle>
                    <SheetDescription>
                      {STATUS_LABELS[selectedPlan.status]} · Hạn{" "}
                      {monthLabel(selectedPlan.targetMonth)}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <div className="quick-transaction-scroll p-4">
                {selectedPlan.status === "draft" ? (
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
                        () => {
                          setMobileDetailId(null);
                          router.replace("/financial-plans");
                        },
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
              </div>
            </SheetContent>
          </Sheet>
        )}

      <div
        className={cn(
          plans.length > 0 &&
            "md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:items-start md:gap-5 xl:grid-cols-[19rem_minmax(0,1fr)] xl:gap-6",
          plans.length > 0 && !activeExists && "hidden md:grid",
        )}
      >
        {plans.length > 0 && (
          <DesktopPlanSidebar plans={plans} selectedPlan={selectedPlan} />
        )}

        <section className="min-w-0" aria-label="Chi tiết kế hoạch">
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
        </section>
      </div>

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

function DesktopPlanSidebar({
  plans,
  selectedPlan,
}: {
  plans: PlanListItem[];
  selectedPlan: SelectedPlan;
}) {
  return (
    <div className="hidden md:block">
      <Card as="aside" size="sm" className="sticky top-6 p-3">
        <CardHeader className="px-2 pb-2 pt-1">
          <CardTitle className="flex items-center justify-between gap-3">
            <span>Kế hoạch</span>
            <span className="text-xs font-normal tabular-nums text-[var(--text-muted)]">
              {plans.length}
            </span>
          </CardTitle>
          <CardDescription>Chọn mục tiêu để xem tiến độ.</CardDescription>
        </CardHeader>
        <CardContent>
          <nav
            aria-label="Danh sách kế hoạch"
            className="grid max-h-[calc(100dvh-13rem)] gap-1 overflow-y-auto"
          >
            {plans.map((plan) => {
              const StatusIcon = STATUS_ICONS[plan.status];
              const selected = selectedPlan?.id === plan.id;
              const statusTone =
                plan.status === "active"
                  ? "text-[var(--primary)]"
                  : plan.status === "completed"
                    ? "text-[var(--success)]"
                    : plan.status === "cancelled"
                      ? "text-[var(--text-muted)]"
                      : "text-[var(--warning)]";

              return (
                <Button
                  key={plan.id}
                  variant={selected ? "selected" : "ghost"}
                  size="auto"
                  className="w-full justify-start gap-3 px-3 py-3 text-left"
                  render={<Link href={`/financial-plans?plan=${plan.id}`} />}
                  aria-current={selected ? "page" : undefined}
                >
                  <StatusIcon
                    className={`size-4 shrink-0 ${statusTone}`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {plan.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-normal text-[var(--text-muted)]">
                      {STATUS_LABELS[plan.status]} · {monthLabel(plan.targetMonth)}
                    </span>
                  </span>
                </Button>
              );
            })}
          </nav>
        </CardContent>
      </Card>
    </div>
  );
}

function DraftListItem({
  plan,
  currency,
  isMobile,
  disabled,
  canManage,
  onActivate,
  onEdit,
  onSelect,
  onDelete,
}: {
  plan: PlanListItem;
  currency: string;
  isMobile: boolean;
  disabled: boolean;
  canManage: boolean;
  onActivate: () => void;
  onEdit: () => void;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const StatusIcon = STATUS_ICONS[plan.status] ?? Target;
  const isCancelled = plan.status === "cancelled";
  const isDraft = plan.status === "draft";

  const statusTone =
    plan.status === "active"
      ? "text-[var(--primary)]"
      : plan.status === "completed"
        ? "text-[var(--success)]"
        : plan.status === "cancelled"
          ? "text-[var(--text-muted)]"
          : "text-[var(--warning)]";

  const cardTone = isDraft ? "primarySoft" : "default";

  const cardContent = (
    <>
      <CardHeader>
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusTone}`}>
          <StatusIcon className="size-3.5" aria-hidden /> {STATUS_LABELS[plan.status]}
        </span>
        <CardTitle
          className={`mt-1.5 text-lg tracking-tight ${isCancelled ? "text-[var(--text-secondary)] line-through decoration-[var(--text-muted)]/40" : "text-[var(--foreground)]"}`}
        >
          {plan.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-1.5 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[var(--text-muted)]">Mục tiêu</dt>
            <dd
              className={`font-semibold tabular-nums ${isCancelled ? "text-[var(--text-muted)]" : "text-[var(--foreground)]"}`}
            >
              {money(plan.targetAmount, currency)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[var(--text-muted)]">Hạn hoàn thành</dt>
            <dd
              className={`font-semibold ${isCancelled ? "text-[var(--text-muted)]" : "text-[var(--foreground)]"}`}
            >
              {monthLabel(plan.targetMonth)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </>
  );

  if (!canManage) {
    return (
      <Card tone={cardTone} className={cn("p-4", isCancelled && "opacity-75")}>
        {cardContent}
      </Card>
    );
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <SpotlightTrigger
          open={menuOpen}
          onOpenChange={setMenuOpen}
          render={
            <Card
              tone={cardTone}
              className={cn("p-4", isCancelled && "opacity-75")}
              aria-label={`${plan.name}. Chạm để quản lý.`}
            />
          }
          dismissLabel={`Đóng menu ${plan.name}`}
        >
          {(spotlightTrigger) => (
            <DropdownMenuTrigger
              nativeButton={false}
              render={spotlightTrigger}
            >
              {cardContent}
            </DropdownMenuTrigger>
          )}
        </SpotlightTrigger>

        <DropdownMenuContent
          align="center"
          side="bottom"
          sideOffset={6}
          className="wallet-mobile-context-menu"
        >
          {plan.status === "draft" ? (
            <>
              <DropdownMenuItem
                variant="primary"
                disabled={disabled}
                onClick={() => {
                  setMenuOpen(false);
                  onActivate();
                }}
              >
                <CheckCircle2 aria-hidden />
                Kích hoạt kế hoạch
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={disabled}
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
              >
                <Pencil aria-hidden />
                Chỉnh sửa
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={disabled}
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmDelete(true);
                }}
              >
                <Trash2 aria-hidden />
                Xóa bản nháp
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem
                disabled={disabled}
                onClick={() => {
                  setMenuOpen(false);
                  onSelect();
                }}
              >
                <Eye aria-hidden />
                Xem chi tiết
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={disabled}
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmDelete(true);
                }}
              >
                <Trash2 aria-hidden />
                Xóa kế hoạch
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDelete
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        trigger={null}
        ariaLabel={plan.status === "draft" ? "Xóa bản nháp" : "Xóa kế hoạch"}
        title={plan.status === "draft" ? "Xóa bản nháp?" : "Xóa kế hoạch?"}
        description={
          plan.status === "draft"
            ? "Kế hoạch nháp sẽ bị xóa khỏi danh sách."
            : "Kế hoạch sẽ bị xóa khỏi danh sách."
        }
        confirmLabel={plan.status === "draft" ? "Xóa bản nháp" : "Xóa kế hoạch"}
        presentation={isMobile ? "sheet" : "popover"}
        onConfirm={onDelete}
        disabled={disabled}
      />
    </>
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const mobileCardContent = (
    <>
      <CardHeader>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary)]">
          <Target className="size-3.5" aria-hidden /> Bản nháp
        </span>
        <CardTitle className="mt-2 text-xl tracking-tight">
          {plan.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[var(--text-muted)]">Mục tiêu</dt>
            <dd className="font-semibold tabular-nums text-[var(--foreground)]">
              {money(plan.targetAmount, currency)}
            </dd>
          </div>
          {new Decimal(plan.existingGoalAmount).greaterThan(0) && (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--text-muted)]">Đã có sẵn</dt>
              <dd className="font-semibold tabular-nums text-[var(--foreground)]">
                {money(plan.existingGoalAmount, currency)}
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[var(--text-muted)]">Hạn hoàn thành</dt>
            <dd className="font-semibold text-[var(--foreground)]">
              {monthLabel(plan.targetMonth)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {/* Mobile: tappable card with dropdown context menu */}
      {plan.canManage ? (
        <DropdownMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
        >
          <SpotlightTrigger
            open={menuOpen}
            onOpenChange={setMenuOpen}
            render={
              <Card
                tone="primarySoft"
                className="p-4 md:hidden"
                aria-label={`${plan.name}. Chạm để quản lý.`}
              />
            }
            dismissLabel={`Đóng menu ${plan.name}`}
          >
            {(spotlightTrigger) => (
              <DropdownMenuTrigger
                nativeButton={false}
                render={spotlightTrigger}
              >
                {mobileCardContent}
              </DropdownMenuTrigger>
            )}
          </SpotlightTrigger>

          <DropdownMenuContent
            align="center"
            side="bottom"
            sideOffset={6}
            className="wallet-mobile-context-menu"
          >
            <DropdownMenuItem
              variant="primary"
              disabled={disabled}
              onClick={() => {
                setMenuOpen(false);
                onActivate();
              }}
            >
              <CheckCircle2 aria-hidden />
              Kích hoạt kế hoạch
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={disabled}
              onClick={() => {
                setMenuOpen(false);
                onEdit();
              }}
            >
              <Pencil aria-hidden />
              Chỉnh sửa
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={disabled}
              onClick={() => {
                setMenuOpen(false);
                setConfirmDelete(true);
              }}
            >
              <Trash2 aria-hidden />
              Xóa bản nháp
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Card tone="primarySoft" className="p-4 md:hidden">
          {mobileCardContent}
        </Card>
      )}

      <ConfirmDelete
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        trigger={null}
        ariaLabel="Xóa bản nháp"
        title="Xóa bản nháp?"
        description="Kế hoạch nháp sẽ bị xóa khỏi danh sách."
        confirmLabel="Xóa bản nháp"
        presentation={isMobile ? "sheet" : "popover"}
        onConfirm={onDelete}
        disabled={disabled}
      />

      {/* Desktop */}
      <Card tone="primarySoft" className="hidden p-6 md:block">
        <CardHeader>
          <p className="text-xs font-medium text-[var(--warning)]">
            Bản nháp
          </p>
          <CardTitle className="mt-1 text-xl tracking-tight">
            {plan.name}
          </CardTitle>
          <CardDescription className="mt-1">
            Bản nháp chưa ảnh hưởng hạn mức chi tiêu.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.75fr)]">
          <section>
            <p className="text-xs text-[var(--text-muted)]">Mục tiêu</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-[var(--foreground)]">
              {money(plan.targetAmount, currency)}
            </p>
          </section>
          <dl className="divide-y divide-[var(--border)] border-y border-[var(--border)] lg:border-y-0 lg:border-l lg:pl-6">
            <div className="flex items-center justify-between gap-4 py-3 lg:pt-0">
              <dt className="text-sm text-[var(--text-secondary)]">
                Đã dành sẵn
              </dt>
              <dd className="font-semibold tabular-nums text-[var(--foreground)]">
                {money(plan.existingGoalAmount, currency)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3 lg:pb-0">
              <dt className="text-sm text-[var(--text-secondary)]">
                Hạn hoàn thành
              </dt>
              <dd className="font-semibold text-[var(--foreground)]">
                {monthLabel(plan.targetMonth)}
              </dd>
            </div>
          </dl>
        </CardContent>
        {plan.canManage && (
          <div className="flex flex-wrap gap-2">
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
        )}
      </Card>
      <Card className="hidden p-4 md:block md:p-6">
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
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

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
              <CardTitle className="mt-1.5 text-lg tracking-tight">
                {plan.name}
              </CardTitle>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {monthLabel(plan.startMonth)} → {monthLabel(plan.targetMonth)}
              </p>
            </div>
            {plan.status === "active" && plan.canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="icon"
                      size="icon"
                      aria-label="Mở thao tác kế hoạch"
                    />
                  }
                >
                  <MoreHorizontal aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={6}
                  className="wallet-mobile-context-menu"
                >
                  <DropdownMenuItem
                    onClick={onEditDeadline}
                    disabled={disabled}
                  >
                    <CalendarClock aria-hidden />
                    Đổi hạn hoàn thành
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onEditAllocation}
                    disabled={disabled}
                  >
                    <SlidersHorizontal aria-hidden />
                    Tỷ lệ sáu hũ
                  </DropdownMenuItem>
                  {plan.canComplete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="primary"
                        onClick={onComplete}
                        disabled={disabled}
                      >
                        <CheckCircle2 aria-hidden />
                        Hoàn thành kế hoạch
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={disabled}
                    onClick={() => setCancelConfirmOpen(true)}
                  >
                    <AlertTriangle aria-hidden />
                    Hủy kế hoạch
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
            <div>
              <p className="text-xs font-medium text-[var(--primary)]">
                {STATUS_LABELS[plan.status]}
                {plan.status === "active"
                  ? ` · ${HEALTH_LABELS[plan.health]}`
                  : ""}
              </p>
              <CardTitle className="mt-1 text-xl tracking-tight">
                {plan.name}
              </CardTitle>
              <CardDescription className="mt-1">
                {monthLabel(plan.startMonth)} → {monthLabel(plan.targetMonth)}
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
        <CardContent className="grid gap-3">
          {/* Mobile: compact summary */}
          <div className="grid gap-3 md:hidden">
            <dl className="grid gap-1.5 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[var(--text-muted)]">Đã tích lũy</dt>
                <dd className="font-semibold tabular-nums text-[var(--foreground)]">
                  {money(plan.realizedProgress, currency)}
                  <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">
                    / {money(plan.targetAmount, currency)}
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[var(--text-muted)]">Cuối tháng (dự kiến)</dt>
                <dd className="font-semibold tabular-nums text-[var(--foreground)]">
                  {money(plan.projectedEndOfCurrentMonthProgress, currency)}
                </dd>
              </div>
              {hasShortfall && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[var(--warning)]">Còn thiếu</dt>
                  <dd className="font-semibold tabular-nums text-[var(--warning)]">
                    {money(shortfall, currency)}
                  </dd>
                </div>
              )}
            </dl>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
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
              <span className="min-w-8 text-right text-xs font-medium tabular-nums">
                {plan.realizedProgressPercentage}%
              </span>
            </div>
          </div>

          {/* Desktop: detailed layout */}
          <div className="hidden gap-6 md:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
            <section className="grid content-start gap-4">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Đã tích lũy</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-[var(--foreground)] xl:text-4xl">
                  {money(plan.realizedProgress, currency)}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  trên mục tiêu {money(plan.targetAmount, currency)}
                </p>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">
                    Tiến độ thực tế
                  </span>
                  <strong className="tabular-nums">
                    {plan.realizedProgressPercentage}%
                  </strong>
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
              </div>
            </section>

            <dl className="divide-y divide-[var(--border)] border-y border-[var(--border)] lg:border-y-0 lg:border-l lg:pl-6">
              <div className="flex items-center justify-between gap-4 py-3 lg:pt-0">
                <dt className="text-sm text-[var(--text-secondary)]">
                  Cuối tháng
                </dt>
                <dd className="font-semibold tabular-nums text-[var(--foreground)]">
                  {money(plan.projectedEndOfCurrentMonthProgress, currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-sm text-[var(--text-secondary)]">
                  Khi đến hạn
                </dt>
                <dd className="font-semibold tabular-nums text-[var(--foreground)]">
                  {money(plan.projectedEndOfPlanProgress, currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3 lg:pb-0">
                <dt className="text-sm text-[var(--text-secondary)]">
                  Tiến độ cuối tháng
                </dt>
                <dd className="font-semibold tabular-nums text-[var(--foreground)]">
                  {plan.projectedCurrentProgressPercentage}%
                </dd>
              </div>
              {hasShortfall && (
                <div className="flex items-center justify-between gap-4 py-3 lg:pb-0">
                  <dt className="text-sm text-[var(--warning)]">Còn thiếu</dt>
                  <dd className="font-semibold tabular-nums text-[var(--warning)]">
                    {money(shortfall, currency)}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </CardContent>
      </Card>

      {plan.status === "active" && plan.canManage && (
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
      )}

      {plan.status !== "cancelled" &&
        (currentMonth ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start">
            <CurrentMonthBudget month={currentMonth} currency={currency} />
            <MonthHistory months={plan.months} currency={currency} />
          </div>
        ) : (
          <MonthHistory months={plan.months} currency={currency} />
        ))}
      {plan.status === "cancelled" && currentMonth && (
        <CurrentMonthBudget month={currentMonth} currency={currency} />
      )}
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
        {/* Mobile: compact budget summary */}
        <div className="grid gap-3 md:hidden">
          <dl className="grid gap-1.5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--text-muted)]">
                {month.closed ? "Còn lại khi chốt" : "Hạn mức chi tiêu"}
              </dt>
              <dd
                className={`font-semibold tabular-nums ${availableToSpend.isNegative() ? "text-[var(--destructive)]" : "text-[var(--foreground)]"}`}
              >
                {money(month.availableToSpend, currency)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--text-muted)]">Đã chi tiêu</dt>
              <dd className="font-semibold tabular-nums text-[var(--foreground)]">
                {money(spentThisMonth.toString(), currency)}
                <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">
                  / {money(monthlyBudget.toString(), currency)}
                </span>
              </dd>
            </div>
          </dl>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
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

          <Button
            variant="ghost"
            size="auto"
            className="w-full justify-between pt-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)]"
            onClick={() => setJarDetailsOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={jarDetailsOpen}
          >
            <span>Chi tiết sáu hũ</span>
            <ChevronDown
              className="size-4 shrink-0 -rotate-90 text-[var(--text-muted)]"
              aria-hidden
            />
          </Button>
        </div>

        <div className="hidden gap-5 md:grid">
          <div className="grid gap-5 border-t border-[var(--border)] pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.8fr)]">
            <section>
              <p className="text-xs text-[var(--text-muted)]">
                {month.closed ? "Còn lại khi chốt" : "Còn có thể chi"}
              </p>
              <strong
                className={`mt-1 block text-3xl font-semibold tracking-tight tabular-nums ${availableToSpend.isNegative() ? "text-[var(--destructive)]" : "text-[var(--foreground)]"}`}
              >
                {money(month.availableToSpend, currency)}
              </strong>
            </section>
            <section className="grid content-start gap-2 lg:border-l lg:border-[var(--border)] lg:pl-5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--text-secondary)]">Đã dùng</span>
                <strong
                  className={`tabular-nums ${PROGRESS_TEXT_TONES[monthlyUsageTone]}`}
                >
                  {monthlyUsage.toDecimalPlaces(0).toString()}%
                </strong>
              </div>
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
                  className={`h-full rounded-full ${PROGRESS_BAR_TONES[monthlyUsageTone]}`}
                  style={{ width: `${monthlyUsageWidth}%` }}
                />
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {money(spentThisMonth.toString(), currency)} /{" "}
                {money(monthlyBudget.toString(), currency)}
              </p>
            </section>
          </div>

          <section className="border-t border-[var(--border)] pt-4">
            <div className="mb-2 flex items-center justify-between gap-4">
              <h3 className="font-medium text-[var(--foreground)]">
                Phân bổ sáu hũ
              </h3>
              <span className="text-xs text-[var(--text-muted)]">
                Chi tiêu / hạn mức
              </span>
            </div>
            <BudgetJarList month={month} currency={currency} />
          </section>
        </div>

        <Sheet open={jarDetailsOpen} onOpenChange={setJarDetailsOpen}>
          <SheetContent
            side="bottom"
            className="quick-transaction-sheet md:hidden"
          >
            <SheetHeader className="quick-transaction-header">
              <div className="quick-transaction-heading">
                <span aria-hidden>
                  <PieChart size={18} />
                </span>
                <div>
                  <SheetTitle>Chi tiết sáu hũ</SheetTitle>
                  <SheetDescription>{monthLabel(month.month)}</SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <div className="quick-transaction-scroll grid gap-3 px-4 pb-4">
              <BudgetJarList month={month} currency={currency} />
            </div>
          </SheetContent>
        </Sheet>
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
    <div className="grid divide-y divide-[var(--border)]">
      {month.jars.map((jar) => {
        const remaining =
          jar.remainingAmount ??
          new Decimal(jar.allocatedAmount)
            .minus(jar.closedActualAmount ?? 0)
            .toFixed(0);
        const spent = jar.expenseAmount ?? jar.closedActualAmount ?? "0";
        const allocated = new Decimal(jar.allocatedAmount);
        const overspent = new Decimal(remaining).isNegative();
        const jarUsage = jarUsagePercentage(jar);
        const jarUsageTone = progressTone(jarUsage);
        const color = JAR_COLORS[jar.jarCode];

        return (
          <div key={jar.jarCode} className="grid gap-2 py-2.5 md:py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {FINANCIAL_JAR_LABELS[jar.jarCode]}
                  </p>
                  <span className="text-xs text-[var(--text-muted)] font-normal">
                    {jar.percentage}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {money(spent, currency)} / {money(jar.allocatedAmount, currency)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] text-[var(--text-muted)]">Còn lại</p>
                <strong
                  className={`text-sm tabular-nums ${overspent ? "text-[var(--destructive)]" : "text-[var(--foreground)]"}`}
                >
                  {money(remaining, currency)}
                </strong>
              </div>
            </div>
            {(allocated.greaterThan(0) || new Decimal(spent).greaterThan(0)) && (
              <div
                className="h-1 overflow-hidden rounded-full bg-[var(--surface-secondary)] md:h-1.5"
                aria-hidden="true"
              >
                <div
                  className={`h-full rounded-full ${overspent ? PROGRESS_BAR_TONES.critical : PROGRESS_BAR_TONES[jarUsageTone]}`}
                  style={{ width: `${jarUsage}%` }}
                />
              </div>
            )}
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

  return (
    <Card className="p-4 md:p-6">
      <CardHeader>
        <CardTitle>
          <span className="md:hidden">Lịch theo tháng</span>
          <span className="hidden items-center gap-2 md:flex">
            <History aria-hidden /> Lịch kế hoạch theo tháng
          </span>
        </CardTitle>
        <CardDescription className="hidden md:block">
          Hạn mức sử dụng và khoản cần dành theo từng tháng.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid divide-y divide-[var(--border)] border-t border-[var(--border)] pt-2 md:hidden">
        {months.map((month) => (
          <Button
            key={month.month}
            variant="ghost"
            size="auto"
            className="w-full justify-between gap-3 rounded-none px-0 py-2.5 text-left"
            onClick={() => setSelectedMonth(month)}
            aria-haspopup="dialog"
          >
            <span className="min-w-0">
              <strong className="block text-sm font-medium text-[var(--foreground)]">
                {monthLabel(month.month)}
              </strong>
              <span className="mt-0.5 block text-xs font-normal text-[var(--text-muted)]">
                {month.closed ? "Đã chốt" : "Dự kiến"}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <strong
                className={`text-sm font-semibold tabular-nums ${new Decimal(month.availableToSpend).isNegative() ? "text-[var(--destructive)]" : "text-[var(--foreground)]"}`}
              >
                <span className="sr-only">Có thể chi </span>
                {money(month.availableToSpend, currency)}
              </strong>
              <ChevronDown
                className="size-4 -rotate-90 text-[var(--text-muted)]"
                aria-hidden
              />
            </span>
          </Button>
        ))}
      </CardContent>

      <Sheet
        open={selectedMonth !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedMonth(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="quick-transaction-sheet md:hidden"
        >
          {selectedMonth && (
            <>
              <SheetHeader className="quick-transaction-header">
                <div className="quick-transaction-heading">
                  <span aria-hidden>
                    <CalendarClock size={18} />
                  </span>
                  <div>
                    <SheetTitle>{monthLabel(selectedMonth.month)}</SheetTitle>
                    <SheetDescription>
                      {selectedMonth.closed ? "Số liệu đã chốt" : "Chi tiết dự kiến"}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <MonthSheetDetail month={selectedMonth} currency={currency} />
            </>
          )}
        </SheetContent>
      </Sheet>

      <CardContent className="hidden md:grid">
        <div className="grid grid-cols-[minmax(7rem,1fr)_7.5rem_7.5rem_1rem] gap-4 border-b border-[var(--border)] pb-2 text-xs text-[var(--text-muted)]">
          <span>Tháng</span>
          <span className="text-right">Có thể chi</span>
          <span className="text-right">Cần dành</span>
          <span aria-hidden />
        </div>
        {months.map((month) => (
          <details
            key={month.month}
            className="group border-b border-[var(--border)] last:border-b-0"
          >
            <summary className="grid cursor-pointer list-none grid-cols-[minmax(7rem,1fr)_7.5rem_7.5rem_1rem] items-center gap-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
              <span className="min-w-0">
                <strong className="block truncate">{monthLabel(month.month)}</strong>
                <span className="mt-0.5 block text-xs font-normal text-[var(--text-muted)]">
                  {month.closed ? "Đã chốt" : "Dự kiến"}
                </span>
              </span>
              <span
                className={`text-right font-semibold tabular-nums ${new Decimal(month.availableToSpend).isNegative() ? "text-[var(--destructive)]" : "text-[var(--foreground)]"}`}
              >
                {money(month.availableToSpend, currency)}
              </span>
              <span className="text-right font-semibold tabular-nums text-[var(--foreground)]">
                {money(month.adjustedRequiredAmount, currency)}
              </span>
              <span className="flex justify-end">
                <ChevronDown
                  className="size-4 shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </span>
            </summary>
            <MonthDetailMetrics
              month={month}
              currency={currency}
            />
          </details>
        ))}
      </CardContent>
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
    <div className="quick-transaction-scroll grid gap-4 px-4 pb-4">
      <dl className="grid divide-y divide-[var(--border)]">
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="text-sm text-[var(--text-muted)]">
            {month.closed ? "Còn lại khi chốt" : "Hạn mức chi tiêu"}
          </dt>
          <dd
            className={`font-semibold tabular-nums ${availableToSpend.isNegative() ? "text-[var(--destructive)]" : "text-[var(--foreground)]"}`}
          >
            {money(month.availableToSpend, currency)}
          </dd>
        </div>

        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="text-sm text-[var(--text-secondary)]">
            {month.closed ? "Đã tích lũy" : "Tích lũy tháng này"}
          </dt>
          <dd className="font-semibold tabular-nums text-[var(--foreground)]">
            {money(savedAmount, currency)}
          </dd>
        </div>
        {hasShortfall && (
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-sm text-[var(--warning)]">Thiếu cho mục tiêu</dt>
            <dd className="font-semibold tabular-nums text-[var(--warning)]">
              {money(month.resourceShortfall, currency)}
            </dd>
          </div>
        )}
      </dl>

      {month.closed && month.adjustedDelta && month.adjustedDelta !== "0" && (
        <p className="text-xs leading-5 text-[var(--warning)]">
          Tháng này có điều chỉnh bổ sung {money(month.adjustedDelta, currency)}{" "}
          do chênh lệch số dư.
        </p>
      )}

      {month.jars && month.jars.length > 0 && (
        <section className="grid gap-2 border-t border-[var(--border)] pt-3">
          <p className="text-xs font-medium text-[var(--text-muted)]">
            Phân bổ 6 hũ ({monthLabel(month.month)})
          </p>
          <BudgetJarList month={month} currency={currency} />
        </section>
      )}
    </div>
  );
}

function MonthDetailMetrics({
  month,
  currency,
}: {
  month: PlanMonth;
  currency: string;
}) {
  const hasShortfall = new Decimal(month.resourceShortfall).greaterThan(0);
  const savedAmount =
    month.closedActualGoalAmount ?? month.projectedActualGoalAmount ?? "0";

  return (
    <div className="grid gap-3 border-t border-[var(--border)] pb-4 pt-3">
      <dl
        className={`grid gap-x-6 gap-y-3 ${hasShortfall ? "grid-cols-3" : "grid-cols-2"}`}
      >
        <div>
          <dt className="text-xs text-[var(--text-muted)]">
            {month.closed ? "Thực tế để dành" : "Dự kiến để dành"}
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-[var(--foreground)]">
            {money(savedAmount, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--text-muted)]">
            {month.closed ? "Đã chi" : "Chi + dự kiến"}
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-[var(--foreground)]">
            {money(month.eligibleExpense ?? "0", currency)}
          </dd>
        </div>
        {hasShortfall && (
          <div>
            <dt className="text-xs text-[var(--warning)]">Còn thiếu</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-[var(--warning)]">
              {money(month.resourceShortfall, currency)}
            </dd>
          </div>
        )}
      </dl>
      {hasShortfall && (
        <p className="text-xs text-[var(--warning)]">
          Hạn mức tháng chưa đủ để đáp ứng kế hoạch.
        </p>
      )}
      {month.closed && month.adjustedDelta && month.adjustedDelta !== "0" && (
        <p className="text-xs text-[var(--warning)]">
          Điều chỉnh từ giao dịch cũ: {money(month.adjustedDelta, currency)}.
        </p>
      )}
    </div>
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
    draft.targetAmount &&
    draft.targetMonth >= nextMonth(businessMonth) &&
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
          description="Đặt mục tiêu, thời hạn và tỷ lệ phân bổ sáu hũ."
        />
        <div
          className={
            isMobile
              ? "quick-transaction-scroll space-y-4 p-4"
              : "grid gap-5 px-4 py-2"
          }
        >
          {isMobile ? (
            <Tabs
              value={activeTab}
              onValueChange={(val) => setActiveTab(val as "info" | "ratios")}
              className="w-full"
            >
              <TabsList variant="segmented" className="w-full">
                <TabsTrigger
                  value="info"
                  variant="segmented"
                  className="flex-1 gap-1.5"
                >
                  <Target className="size-3.5" aria-hidden />
                  <span>1. Thông tin</span>
                </TabsTrigger>
                <TabsTrigger
                  value="ratios"
                  variant="segmented"
                  className="flex-1 gap-1.5"
                >
                  <PieChart className="size-3.5" aria-hidden />
                  <span>2. Sáu hũ</span>
                  {!total.equals(100) && (
                    <TabsCount className="bg-[var(--warning)]/15 text-[var(--warning)]">
                      {total.toString()}%
                    </TabsCount>
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
                    placeholder="Quỹ Tết năm sau"
                  />
                  <MonthPicker
                    label="Hạn hoàn thành"
                    required
                    minMonth={nextMonth(businessMonth)}
                    value={draft.targetMonth}
                    onValueChange={(targetMonth) =>
                      setDraft({ ...draft, targetMonth })
                    }
                    disabled={isPending}
                  />
                  <MoneyInput
                    label="Bạn cần bao nhiêu?"
                    required
                    value={draft.targetAmount}
                    onValueChange={(targetAmount) =>
                      setDraft({ ...draft, targetAmount })
                    }
                  />
                  <MoneyInput
                    label="Đã có sẵn bao nhiêu?"
                    value={draft.existingGoalAmount}
                    onValueChange={(existingGoalAmount) =>
                      setDraft({ ...draft, existingGoalAmount })
                    }
                  />
                </div>
              </TabsContent>

              <TabsContent value="ratios" className="mt-3">
                <div>
                  <RatioEditor
                    ratios={draft.percentages}
                    onChange={(percentages) =>
                      setDraft({ ...draft, percentages })
                    }
                  />
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="grid gap-5">
              <div className="space-y-4">
                <Input
                  label="Tên kế hoạch"
                  required
                  value={draft.name}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                  placeholder="Quỹ Tết năm sau"
                />
                <MonthPicker
                  label="Hạn hoàn thành"
                  required
                  minMonth={nextMonth(businessMonth)}
                  value={draft.targetMonth}
                  onValueChange={(targetMonth) =>
                    setDraft({ ...draft, targetMonth })
                  }
                  disabled={isPending}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <MoneyInput
                    label="Bạn cần bao nhiêu?"
                    required
                    value={draft.targetAmount}
                    onValueChange={(targetAmount) =>
                      setDraft({ ...draft, targetAmount })
                    }
                  />
                  <MoneyInput
                    label="Đã có sẵn bao nhiêu?"
                    value={draft.existingGoalAmount}
                    onValueChange={(existingGoalAmount) =>
                      setDraft({ ...draft, existingGoalAmount })
                    }
                  />
                </div>
              </div>

              <div>
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
          className={isMobile ? "quick-transaction-footer" : undefined}
        >
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
        <div className={isMobile ? "quick-transaction-scroll p-4" : "px-4 py-2"}>
          <MonthPicker
            label="Tháng mục tiêu mới"
            required
            minMonth={plan.businessMonth}
            value={targetMonth}
            onValueChange={setTargetMonth}
            disabled={disabled}
          />
        </div>
        <SheetFooter
          className={isMobile ? "quick-transaction-footer" : undefined}
        >
          {!isMobile && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
          )}
          <Button
            size={isMobile ? "lg" : "default"}
            className={isMobile ? "w-full" : undefined}
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
        <div className={isMobile ? "quick-transaction-scroll p-4" : "px-4 py-2"}>
          <RatioEditor ratios={ratios} onChange={setRatios} />
        </div>
        <SheetFooter
          className={isMobile ? "quick-transaction-footer" : undefined}
        >
          {!isMobile && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
          )}
          <Button
            size={isMobile ? "lg" : "default"}
            className={isMobile ? "w-full" : undefined}
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



  function adjustRatio(jarCode: FinancialJarCode, amount: number): void {
    const current = new Decimal(ratios[jarCode] || 0);
    const next = Decimal.max(0, Decimal.min(100, current.plus(amount)));
    onChange({ ...ratios, [jarCode]: next.toString() });
  }

  return (
    <fieldset className="grid gap-5">
      <legend className="sr-only">Phân bổ tỷ lệ sáu hũ</legend>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          Phân bổ tỷ lệ sáu hũ
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange({ ...DEFAULT_RATIOS })}
        >
          <RotateCcw aria-hidden /> Mặc định
        </Button>
      </div>

      {/* Stacked bar */}
      <div
        className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
        aria-hidden
      >
        {FINANCIAL_JAR_CODES.map((jarCode) => {
          const pct = Number(ratios[jarCode] || 0);
          return (
            <div
              key={jarCode}
              className="transition-[flex] duration-300 ease-out first:rounded-l-full last:rounded-r-full"
              style={{
                flex: pct,
                backgroundColor: pct > 0 ? JAR_COLORS[jarCode] : "transparent",
              }}
            />
          );
        })}
      </div>

      {/* Jar rows */}
      <div className="grid gap-1">
        {FINANCIAL_JAR_CODES.map((jarCode) => {
          const label = FINANCIAL_JAR_LABELS[jarCode];
          const current = new Decimal(ratios[jarCode] || 0);
          const labelId = `${ratioEditorId}-${jarCode.toLowerCase()}`;
          const color = JAR_COLORS[jarCode];

          return (
            <div
              key={jarCode}
              className="flex items-center gap-3 rounded-lg px-2 py-2"
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              <span
                id={labelId}
                className="min-w-0 flex-1 text-sm text-[var(--text-secondary)]"
              >
                {label}
              </span>
              <div
                className="flex items-center gap-1"
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
                  <Minus aria-hidden />
                </Button>
                <output className="min-w-10 text-center text-sm font-semibold tabular-nums text-[var(--foreground)]">
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
                  <Plus aria-hidden />
                </Button>
              </div>
            </div>
          );
        })}
      </div>


    </fieldset>
  );
}

