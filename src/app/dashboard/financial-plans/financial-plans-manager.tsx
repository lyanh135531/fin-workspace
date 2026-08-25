"use client";

import Decimal from "decimal.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  activateFinancialPlanAction,
  cancelFinancialPlanAction,
  completeFinancialPlanAction,
  createFinancialPlanDraftAction,
  deleteFinancialPlanDraftAction,
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
  PageHeader,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/base";
import { ConfirmDelete } from "@/components/base/confirm-delete";
import { FINANCIAL_JAR_CODES, FINANCIAL_JAR_LABELS, type FinancialJarCode } from "@/domain";
import { formatAmount } from "@/lib/format";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Flag,
  History,
  LoaderCircle,
  Pencil,
  PiggyBank,
  Plus,
  SlidersHorizontal,
  Target,
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
  health: "ahead" | "on_track" | "behind" | "at_risk" | "goal_reached" | "overdue";
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
type EditorDraft = { name: string; targetAmount: string; existingGoalAmount: string; targetMonth: string; percentages: RatioDraft };

const DEFAULT_RATIOS: RatioDraft = {
  ESSENTIAL: "55", RESPONSIBILITY: "10", DEVELOPMENT: "10",
  ENJOYMENT: "10", INVESTMENT: "10", GIVING: "5",
};

const STATUS_LABELS = { draft: "Bản nháp", active: "Đang chạy", completed: "Hoàn thành", cancelled: "Đã hủy" } as const;
const HEALTH_LABELS = {
  ahead: "Đi trước", on_track: "Đúng tiến độ", behind: "Chậm tiến độ",
  at_risk: "Có rủi ro", goal_reached: "Đã đạt mục tiêu", overdue: "Quá hạn",
} as const;

function monthLabel(month: string) {
  const [year, value] = month.split("-");
  return `Tháng ${Number(value)}/${year}`;
}

function money(value: string, currency: string) {
  return `${formatAmount(value)} ${currency}`;
}

function ratioTotal(ratios: RatioDraft) {
  return FINANCIAL_JAR_CODES.reduce((sum, jarCode) => {
    try { return sum.plus(ratios[jarCode] || 0); } catch { return sum; }
  }, new Decimal(0));
}

function ratiosFromMonth(month?: PlanMonth): RatioDraft {
  if (!month) return { ...DEFAULT_RATIOS };
  return Object.fromEntries(FINANCIAL_JAR_CODES.map((jarCode) => [
    jarCode,
    month.jars.find((jar) => jar.jarCode === jarCode)?.percentage ?? DEFAULT_RATIOS[jarCode],
  ])) as RatioDraft;
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
  const [isPending, startTransition] = useTransition();

  function runAction(action: () => Promise<{ ok: boolean; message?: string | null }>, success: string, after?: () => void) {
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
  const running = selectedPlan && selectedPlan.status !== "draft" ? selectedPlan : null;
  const currentPlanMonth = running?.months.find((month) => month.month === running.businessMonth && !month.closed)
    ?? running?.months.find((month) => !month.closed)
    ?? running?.months.at(-1);

  return (
    <div className="grid gap-6">
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

      {plans.length > 0 && (
        <nav aria-label="Danh sách kế hoạch" className="flex gap-2 overflow-x-auto pb-1">
          {plans.map((plan) => (
            <Button
              key={plan.id}
              variant={selectedPlan?.id === plan.id ? "secondary" : "outline"}
              render={<Link href={`/financial-plans?plan=${plan.id}`} />}
            >
              <span className="max-w-44 truncate">{plan.name}</span>
              <span className="text-xs text-[var(--text-muted)]">{STATUS_LABELS[plan.status]}</span>
            </Button>
          ))}
        </nav>
      )}

      {!selectedPlan ? (
        <Card>
          <Empty
            icon={Target}
            title="Chưa có kế hoạch tài chính"
            description={canManage
              ? "Tạo mục tiêu, chọn deadline và tỷ lệ sáu hũ. Hệ thống sẽ tự tính khoản phải dành từ số dư và dòng tiền thực tế."
              : "Admin của workspace chưa tạo kế hoạch tài chính."}
            action={canManage ? <Button onClick={() => setEditorOpen(true)}><Plus aria-hidden /> Tạo kế hoạch đầu tiên</Button> : undefined}
          />
        </Card>
      ) : selectedPlan.status === "draft" ? (
        <DraftReview
          plan={selectedPlan}
          currency={currency}
          disabled={isPending}
          onEdit={() => setEditorOpen(true)}
          onActivate={() => runAction(() => activateFinancialPlanAction(selectedPlan.id), "Đã kích hoạt kế hoạch.")}
          onDelete={() => runAction(() => deleteFinancialPlanDraftAction(selectedPlan.id), "Đã xóa vĩnh viễn bản nháp.", () => router.replace("/financial-plans"))}
        />
      ) : (
        <PlanDetail
          plan={selectedPlan}
          currency={currency}
          currentMonth={currentPlanMonth}
          disabled={isPending}
          onEditDeadline={() => setDeadlineOpen(true)}
          onEditAllocation={() => setAllocationOpen(true)}
          onCancel={() => runAction(() => cancelFinancialPlanAction(selectedPlan.id), "Đã hủy kế hoạch.")}
          onComplete={() => runAction(() => completeFinancialPlanAction(selectedPlan.id), "Đã hoàn thành kế hoạch.")}
        />
      )}

      {canManage && editorOpen && (
        <PlanEditorSheet
          open={editorOpen}
          onOpenChange={setEditorOpen}
          businessMonth={businessMonth}
          plan={selectedPlan?.status === "draft" ? selectedPlan : null}
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
          {deadlineOpen && <DeadlineSheet open={deadlineOpen} onOpenChange={setDeadlineOpen} plan={running} disabled={isPending}
            onSave={(targetMonth) => runAction(() => updateFinancialPlanDeadlineAction({ planId: running.id, targetMonth }), "Đã cập nhật deadline.", () => setDeadlineOpen(false))} />
          }
          {allocationOpen && <AllocationSheet open={allocationOpen} onOpenChange={setAllocationOpen} initialRatios={ratiosFromMonth(currentPlanMonth)} disabled={isPending}
            onSave={(percentages) => runAction(() => updateFinancialPlanAllocationsAction({ planId: running.id, percentages }), "Tỷ lệ mới sẽ áp dụng từ tháng sau.", () => setAllocationOpen(false))} />}
        </>
      )}
    </div>
  );
}

function DraftReview({ plan, currency, disabled, onEdit, onActivate, onDelete }: {
  plan: DraftView; currency: string; disabled: boolean; onEdit: () => void; onActivate: () => void; onDelete: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card tone="primarySoft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Target aria-hidden /> {plan.name}</CardTitle>
          <CardDescription>Bản nháp chưa ảnh hưởng hạn mức chi tiêu.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          <Metric label="Mục tiêu" value={money(plan.targetAmount, currency)} icon={Flag} />
          <Metric label="Đã dành sẵn" value={money(plan.existingGoalAmount, currency)} icon={PiggyBank} />
          <Metric label="Deadline" value={monthLabel(plan.targetMonth)} icon={CalendarClock} />
        </CardContent>
        {plan.canManage && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={onActivate} disabled={disabled}><CheckCircle2 aria-hidden /> Kích hoạt kế hoạch</Button>
            <Button variant="outline" onClick={onEdit} disabled={disabled}><Pencil aria-hidden /> Sửa bản nháp</Button>
            <ConfirmDelete ariaLabel="Xóa bản nháp" title="Xóa vĩnh viễn bản nháp?" description="Kế hoạch nháp sẽ bị xóa và không thể khôi phục."
              confirmLabel="Xóa bản nháp" onConfirm={onDelete} disabled={disabled}
              trigger={<Button variant="destructive" disabled={disabled}>Xóa bản nháp</Button>} />
          </div>
        )}
      </Card>
      <Card>
        <CardHeader><CardTitle>Tỷ lệ sáu hũ</CardTitle><CardDescription>Tổng cố định 100% khi kích hoạt.</CardDescription></CardHeader>
        <CardContent><RatioList ratios={plan.percentages} /></CardContent>
      </Card>
    </div>
  );
}

function PlanDetail({ plan, currency, currentMonth, disabled, onEditDeadline, onEditAllocation, onCancel, onComplete }: {
  plan: RunningView; currency: string; currentMonth?: PlanMonth; disabled: boolean;
  onEditDeadline: () => void; onEditAllocation: () => void; onCancel: () => void; onComplete: () => void;
}) {
  const shortfall = currentMonth?.resourceShortfall ?? "0";
  return (
    <div className="grid gap-5">
      <Card tone="primarySoft">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><CardTitle>{plan.name}</CardTitle><CardDescription>{STATUS_LABELS[plan.status]}{plan.status === "active" ? ` · ${HEALTH_LABELS[plan.health]}` : ""} · {monthLabel(plan.startMonth)} → {monthLabel(plan.targetMonth)}</CardDescription></div>
            {plan.status === "active" && plan.canManage && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={onEditDeadline} disabled={disabled}><CalendarClock aria-hidden /> Deadline</Button>
                <Button variant="outline" onClick={onEditAllocation} disabled={disabled}><SlidersHorizontal aria-hidden /> Tỷ lệ tháng sau</Button>
                {plan.canComplete && <Button variant="success" onClick={onComplete} disabled={disabled}><CheckCircle2 aria-hidden /> Hoàn thành</Button>}
                <ConfirmDelete ariaLabel="Hủy kế hoạch" title="Hủy kế hoạch đang chạy?" description="Kế hoạch sẽ chuyển sang chỉ đọc. Snapshot các tháng đã đóng được giữ nguyên."
                  confirmLabel="Hủy kế hoạch" onConfirm={onCancel} disabled={disabled}
                  trigger={<Button variant="destructive" disabled={disabled}>Hủy kế hoạch</Button>} />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Mục tiêu" value={money(plan.targetAmount, currency)} icon={Target} />
            <Metric label="Đã ghi nhận" value={money(plan.realizedProgress, currency)} icon={PiggyBank} />
            <Metric label="Dự kiến cuối tháng" value={money(plan.projectedEndOfCurrentMonthProgress, currency)} icon={TrendingUp} />
            <Metric label="Thiếu hụt nguồn lực" value={money(shortfall, currency)} icon={AlertTriangle} tone={new Decimal(shortfall).greaterThan(0) ? "warning" : "default"} />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-sm"><span className="text-[var(--text-secondary)]">Tiến độ đã ghi nhận</span><strong>{plan.realizedProgressPercentage}%</strong></div>
            <div role="progressbar" aria-label="Tiến độ đã ghi nhận" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(plan.realizedProgressPercentage)} className="h-2 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
              <div className="h-full bg-[var(--primary)]" style={{ width: `${plan.realizedProgressPercentage}%` }} />
            </div>
            <p className="text-xs text-[var(--text-muted)]">Dự kiến cuối tháng: {plan.projectedCurrentProgressPercentage}% · Dự kiến đến deadline: {money(plan.projectedEndOfPlanProgress, currency)}</p>
          </div>
        </CardContent>
      </Card>

      {currentMonth && <CurrentMonthBudget month={currentMonth} currency={currency} />}
      <MonthHistory months={plan.months} currency={currency} />
    </div>
  );
}

function CurrentMonthBudget({ month, currency }: { month: PlanMonth; currency: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CircleDollarSign aria-hidden /> {month.closed ? "Snapshot" : "Hạn mức"} {monthLabel(month.month)}</CardTitle>
        <CardDescription>Khoản bắt buộc {money(month.adjustedRequiredAmount, currency)}. Vượt một hũ không đồng nghĩa kế hoạch tổng thể bị thiếu.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {month.jars.map((jar) => {
          const remaining = jar.remainingAmount ?? new Decimal(jar.allocatedAmount).minus(jar.closedActualAmount ?? 0).toFixed(0);
          const overspent = new Decimal(remaining).isNegative();
          return (
            <div key={jar.jarCode} className="grid gap-2 rounded-xl bg-[var(--surface-secondary)] p-4">
              <div className="flex items-center justify-between gap-3"><strong>{FINANCIAL_JAR_LABELS[jar.jarCode]}</strong><span className="text-xs text-[var(--text-muted)]">{jar.percentage}%</span></div>
              <div className="flex items-end justify-between gap-3"><span className="text-xs text-[var(--text-secondary)]">Còn lại</span><strong className={overspent ? "text-[var(--destructive)]" : "text-[var(--foreground)]"}>{money(remaining, currency)}</strong></div>
              <p className="text-xs text-[var(--text-muted)]">Đã/được dự kiến chi {money(jar.expenseAmount ?? jar.closedActualAmount ?? "0", currency)} / {money(jar.allocatedAmount, currency)}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function MonthHistory({ months, currency }: { months: PlanMonth[]; currency: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><History aria-hidden /> Lịch kế hoạch theo tháng</CardTitle><CardDescription>Tháng chưa đóng tự tính lại theo dữ liệu hiện tại; tháng đã đóng giữ snapshot và hiển thị delta backdate riêng.</CardDescription></CardHeader>
      <CardContent className="grid gap-2">
        {months.map((month) => (
          <details key={month.month} className="rounded-xl bg-[var(--surface-secondary)] px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
              <span><strong>{monthLabel(month.month)}</strong><span className="ml-2 text-xs text-[var(--text-muted)]">{month.closed ? "Đã đóng" : "Dự kiến"}</span></span>
              <span className="text-right text-sm"><span className="block text-xs text-[var(--text-muted)]">Khoản phải dành</span><strong>{money(month.adjustedRequiredAmount, currency)}</strong></span>
            </summary>
            <div className="mt-3 grid gap-3 border-t border-[var(--border)] pt-3 sm:grid-cols-3">
              <Metric label="Hạn mức phân bổ" value={money(month.allocatableGrossBudget, currency)} icon={CircleDollarSign} />
              <Metric label="Thiếu hụt nguồn lực" value={money(month.resourceShortfall, currency)} icon={AlertTriangle} />
              <Metric label={month.closed ? "Thực tế lúc đóng" : "Dự kiến dành được"} value={money(month.closedActualGoalAmount ?? month.projectedActualGoalAmount ?? "0", currency)} icon={PiggyBank} />
              {month.closed && month.adjustedDelta && month.adjustedDelta !== "0" && (
                <p className="sm:col-span-3 text-sm text-[var(--warning)]">Điều chỉnh do ledger thay đổi: {money(month.adjustedDelta, currency)}.</p>
              )}
            </div>
          </details>
        ))}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, icon: Icon, tone = "default" }: { label: string; value: string; icon: typeof Target; tone?: "default" | "warning" }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className={tone === "warning" ? "text-[var(--warning)]" : "text-[var(--primary)]"}><Icon aria-hidden /></span>
      <div className="min-w-0"><p className="text-xs text-[var(--text-muted)]">{label}</p><p className="truncate font-semibold tabular-nums text-[var(--foreground)]">{value}</p></div>
    </div>
  );
}

function RatioList({ ratios }: { ratios: RatioDraft }) {
  return <dl className="grid gap-2">{FINANCIAL_JAR_CODES.map((jarCode) => <div key={jarCode} className="flex justify-between gap-3"><dt className="text-[var(--text-secondary)]">{FINANCIAL_JAR_LABELS[jarCode]}</dt><dd className="font-semibold tabular-nums">{ratios[jarCode]}%</dd></div>)}</dl>;
}

function PlanEditorSheet({ open, onOpenChange, businessMonth, plan, disabled, onSaved }: {
  open: boolean; onOpenChange: (open: boolean) => void; businessMonth: string; plan: DraftView | null; disabled: boolean; onSaved: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const initial = useMemo<EditorDraft>(() => plan ? {
    name: plan.name, targetAmount: plan.targetAmount, existingGoalAmount: plan.existingGoalAmount,
    targetMonth: plan.targetMonth, percentages: { ...plan.percentages },
  } : { name: "", targetAmount: "", existingGoalAmount: "0", targetMonth: businessMonth, percentages: { ...DEFAULT_RATIOS } }, [plan, businessMonth]);
  const [draft, setDraft] = useState(initial);
  const total = ratioTotal(draft.percentages);
  const valid = Boolean(draft.name.trim() && draft.targetAmount && draft.targetMonth >= businessMonth && total.equals(100));

  function submit() {
    startTransition(async () => {
      const payload = { ...draft, ...(plan ? { planId: plan.id } : {}) };
      const result = plan ? await updateFinancialPlanDraftAction(payload) : await createFinancialPlanDraftAction(payload);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(plan ? "Đã cập nhật bản nháp." : "Đã tạo bản nháp để xem lại.");
      onSaved(plan?.id ?? ("id" in result ? String(result.id) : ""));
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="wide" elevation="flat" className="overflow-y-auto">
        <SheetHeader><SheetTitle>{plan ? "Sửa bản nháp" : "Tạo kế hoạch tài chính"}</SheetTitle><SheetDescription>Deadline tính cả tháng hiện tại. Tiền đã dành sẵn phải thực sự nằm trong số dư workspace.</SheetDescription></SheetHeader>
        <div className="grid gap-5 px-4 py-2">
          <Input label="Tên kế hoạch" required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ví dụ: Quỹ Tết năm sau" />
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyInput label="Số tiền mục tiêu" required value={draft.targetAmount} onValueChange={(targetAmount) => setDraft({ ...draft, targetAmount })} />
            <MoneyInput label="Đã dành sẵn cho mục tiêu" value={draft.existingGoalAmount} onValueChange={(existingGoalAmount) => setDraft({ ...draft, existingGoalAmount })} />
          </div>
          <Input label="Tháng mục tiêu" required type="month" min={businessMonth} value={draft.targetMonth} onChange={(event) => setDraft({ ...draft, targetMonth: event.target.value })} />
          <RatioEditor ratios={draft.percentages} onChange={(percentages) => setDraft({ ...draft, percentages })} />
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Đóng</Button>
          <Button onClick={submit} disabled={disabled || isPending || !valid} aria-busy={isPending}>{isPending && <LoaderCircle className="animate-spin" aria-hidden />}{plan ? "Lưu bản nháp" : "Tạo bản nháp"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function DeadlineSheet({ open, onOpenChange, plan, disabled, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; plan: RunningView; disabled: boolean; onSave: (month: string) => void }) {
  const [targetMonth, setTargetMonth] = useState(plan.targetMonth);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="right" elevation="flat">
      <SheetHeader><SheetTitle>Đổi deadline</SheetTitle><SheetDescription>Các tháng đã đóng không đổi. Toàn bộ tháng chưa đóng sẽ được chia lại.</SheetDescription></SheetHeader>
      <div className="px-4 py-2"><Input label="Tháng mục tiêu mới" type="month" min={plan.businessMonth} value={targetMonth} onChange={(event) => setTargetMonth(event.target.value)} /></div>
      <SheetFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button><Button onClick={() => onSave(targetMonth)} disabled={disabled || targetMonth < plan.businessMonth}>Áp dụng</Button></SheetFooter>
    </SheetContent></Sheet>
  );
}

function AllocationSheet({ open, onOpenChange, initialRatios, disabled, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; initialRatios: RatioDraft; disabled: boolean; onSave: (ratios: RatioDraft) => void }) {
  const [ratios, setRatios] = useState(initialRatios);
  const total = ratioTotal(ratios);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="right" elevation="flat" className="overflow-y-auto">
      <SheetHeader><SheetTitle>Tỷ lệ sáu hũ từ tháng sau</SheetTitle><SheetDescription>Tháng hiện tại và các tháng đã đóng giữ nguyên. Chỉ lưu khi tổng bằng chính xác 100%.</SheetDescription></SheetHeader>
      <div className="px-4 py-2"><RatioEditor ratios={ratios} onChange={setRatios} /></div>
      <SheetFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button><Button onClick={() => onSave(ratios)} disabled={disabled || !total.equals(100)}>Áp dụng từ tháng sau</Button></SheetFooter>
    </SheetContent></Sheet>
  );
}

function RatioEditor({ ratios, onChange }: { ratios: RatioDraft; onChange: (ratios: RatioDraft) => void }) {
  const total = ratioTotal(ratios);
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 font-semibold">Tỷ lệ sáu hũ</legend>
      {FINANCIAL_JAR_CODES.map((jarCode) => (
        <Input key={jarCode} label={FINANCIAL_JAR_LABELS[jarCode]} type="number" min="0" max="100" step="0.01" value={ratios[jarCode]}
          onChange={(event) => onChange({ ...ratios, [jarCode]: event.target.value })} endAdornment={<span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-[var(--text-muted)]">%</span>} className="pr-8 text-right tabular-nums" />
      ))}
      <p className={total.equals(100) ? "text-sm text-[var(--success)]" : "text-sm text-[var(--destructive)]"} role="status">Tổng tỷ lệ: {total.toString()}% {total.equals(100) ? "— hợp lệ" : "— phải bằng 100%"}</p>
    </fieldset>
  );
}
