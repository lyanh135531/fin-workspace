"use client";

import Decimal from "decimal.js";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  CircleDollarSign,
  Link2,
  ListChecks,
  Pencil,
  Plus,
  RotateCcw,
  Target,
  WalletCards,
  X,
} from "lucide-react";
import {
  createFinancialGoalFundingAction,
  createFinancialPlanGoalAction,
  finishFinancialPlanGoalAction,
  reorderFinancialPlanGoalsAction,
  reviewFinancialGoalFundingAction,
  reverseFinancialGoalFundingAction,
  updateFinancialPlanGoalAction,
} from "@/app/dashboard/financial-plans/actions";
import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDelete,
  DatePicker,
  Input,
  MoneyInput,
  MonthPicker,
  Select,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
} from "@/components/base";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

export type FinancialGoalView = {
  id: string;
  name: string;
  status: "draft" | "active" | "completed" | "cancelled";
  trackingMode: "manual" | "linked_wallet";
  linkedWallet: { id: string; name: string; balance: string } | null;
  targetAmount: string;
  targetMonth: string;
  sortOrder: number;
  actualProgress: string;
  progressPercentage: string;
  requiredThisMonth: string;
  projectedThisMonth: string;
  shortfallThisMonth: string;
  projectedAtDeadline: string;
  health: "ahead" | "on_track" | "behind" | "at_risk" | "goal_reached" | "overdue";
  fundingEntries: Array<{
    id: string;
    amount: string;
    kind: "opening" | "contribution" | "withdrawal" | "adjustment" | "reversal";
    status: "pending" | "approved" | "rejected";
    effectiveDate: string;
    note: string | null;
    requester: string;
    reviewer: string | null;
    reversesEntryId: string | null;
  }>;
  canManage: boolean;
};

type WalletOption = { id: string; name: string; balance: string };

const HEALTH = {
  ahead: { label: "Đi trước", className: "text-[var(--success)]" },
  on_track: { label: "Đúng tiến độ", className: "text-[var(--success)]" },
  behind: { label: "Chậm tiến độ", className: "text-[var(--warning)]" },
  at_risk: { label: "Có rủi ro", className: "text-[var(--warning)]" },
  goal_reached: { label: "Đã đủ tiền", className: "text-[var(--success)]" },
  overdue: { label: "Quá hạn", className: "text-[var(--destructive)]" },
} as const;

function money(value: string, currency: string) {
  return `${formatAmount(value)} ${currency === "VND" ? "₫" : currency}`;
}

function monthLabel(month: string) {
  const [year, value] = month.split("-");
  return `Tháng ${Number(value)}/${year}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function FinancialPlanGoals({
  planId,
  planStatus,
  goals,
  wallets,
  currency,
  businessMonth,
  canManage,
}: {
  planId: string;
  planStatus: "draft" | "active" | "completed" | "cancelled";
  goals: FinancialGoalView[];
  wallets: WalletOption[];
  currency: string;
  businessMonth: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editor, setEditor] = useState<FinancialGoalView | "new" | null>(null);
  const [fundingGoal, setFundingGoal] = useState<FinancialGoalView | null>(null);
  const [pending, startTransition] = useTransition();
  const mutable = planStatus === "draft" || planStatus === "active";

  function run(action: () => Promise<{ ok: boolean; message?: string | null }>, success: string, after?: () => void) {
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

  function move(index: number, direction: -1 | 1) {
    const next = [...goals];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    run(() => reorderFinancialPlanGoalsAction({ planId, goalIds: next.map((goal) => goal.id) }), "Đã cập nhật thứ tự ưu tiên.");
  }

  return (
    <section className="grid gap-4" aria-labelledby="financial-goals-title">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="financial-goals-title" className="text-lg font-semibold text-[var(--foreground)]">Mục tiêu trong kế hoạch</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Tiến độ chỉ lấy từ số dư ví liên kết hoặc khoản đóng góp đã được duyệt.</p>
        </div>
        {canManage && mutable && (
          <Button variant="outline" onClick={() => setEditor("new")} disabled={pending}>
            <Plus aria-hidden /> Thêm mục tiêu
          </Button>
        )}
      </div>

      <div className="grid gap-3">
        {goals.map((goal, index) => {
          const shortfall = new Decimal(goal.shortfallThisMonth).greaterThan(0);
          const reached = new Decimal(goal.actualProgress).greaterThanOrEqualTo(goal.targetAmount);
          return (
            <Card key={goal.id} size="sm">
              <CardHeader>
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-secondary)] text-[var(--primary)]" aria-hidden>
                    {goal.trackingMode === "linked_wallet" ? <WalletCards className="size-4" /> : <Target className="size-4" />}
                  </span>
                  <div className="min-w-0">
                    <CardTitle className="break-words">{goal.name}</CardTitle>
                    <CardDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={HEALTH[goal.health].className}>{HEALTH[goal.health].label}</span>
                      <span aria-hidden>·</span>
                      <span>{monthLabel(goal.targetMonth)}</span>
                      <span aria-hidden>·</span>
                      <span>{goal.linkedWallet ? goal.linkedWallet.name : "Theo dõi thủ công"}</span>
                    </CardDescription>
                  </div>
                </div>
                {canManage && mutable && goal.status !== "cancelled" && (
                  <CardAction className="flex items-center gap-1">
                    <Button variant="icon" size="icon" onClick={() => move(index, -1)} disabled={pending || index === 0} aria-label={`Tăng ưu tiên ${goal.name}`}>
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button variant="icon" size="icon" onClick={() => move(index, 1)} disabled={pending || index === goals.length - 1} aria-label={`Giảm ưu tiên ${goal.name}`}>
                      <ArrowDown aria-hidden />
                    </Button>
                    <Button variant="icon" size="icon" onClick={() => setEditor(goal)} disabled={pending} aria-label={`Sửa mục tiêu ${goal.name}`}>
                      <Pencil aria-hidden />
                    </Button>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent className="grid gap-4">
                <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <GoalMetric label="Tiền đã xác nhận" value={money(goal.actualProgress, currency)} />
                  <GoalMetric label="Mục tiêu" value={money(goal.targetAmount, currency)} />
                  <GoalMetric label="Cần dành tháng này" value={money(goal.requiredThisMonth, currency)} />
                  <GoalMetric label="Dự kiến khi đến hạn" value={money(goal.projectedAtDeadline, currency)} tone={goal.health === "at_risk" || goal.health === "overdue" ? "warning" : "default"} />
                </dl>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div role="progressbar" aria-label={`Tiến độ mục tiêu ${goal.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Number(goal.progressPercentage))} className="h-2 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                    <div className="h-full rounded-full bg-[var(--primary)] motion-reduce:transition-none" style={{ width: `${Math.min(Number(goal.progressPercentage), 100)}%` }} />
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">{goal.progressPercentage}%</span>
                </div>
                {shortfall && (
                  <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-[var(--warning)]">Thiếu {money(goal.shortfallThisMonth, currency)} trong tháng này. Hãy gia hạn, tăng thu hoặc giảm chi.</p>
                    {canManage && <Button variant="outline" size="sm" onClick={() => setEditor(goal)}>Điều chỉnh</Button>}
                  </div>
                )}
                {goal.status === "active" && (
                  <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                    {goal.trackingMode === "manual" && (
                      <Button variant="outline" size="sm" onClick={() => setFundingGoal(goal)} disabled={pending}>
                        <CircleDollarSign aria-hidden /> Ghi nhận đóng góp
                      </Button>
                    )}
                    {canManage && reached && (
                      <Button size="sm" onClick={() => run(() => finishFinancialPlanGoalAction({ goalId: goal.id, status: "completed" }), "Đã hoàn thành mục tiêu.")} disabled={pending}>
                        <Check aria-hidden /> Hoàn thành
                      </Button>
                    )}
                    {canManage && (
                      <ConfirmDelete
                        title="Hủy mục tiêu?"
                        description="Mục tiêu sẽ chuyển sang chỉ đọc. Tiến độ và lịch sử đóng góp vẫn được giữ lại."
                        confirmLabel="Hủy mục tiêu"
                        ariaLabel={`Hủy mục tiêu ${goal.name}`}
                        onConfirm={() => run(() => finishFinancialPlanGoalAction({ goalId: goal.id, status: "cancelled" }), "Đã hủy mục tiêu.")}
                        disabled={pending}
                        trigger={<Button variant="destructive" size="sm"><X aria-hidden /> Hủy mục tiêu</Button>}
                      />
                    )}
                  </div>
                )}
                {goal.trackingMode === "manual" && goal.fundingEntries.length > 0 && (
                  <FundingHistory goal={goal} currency={currency} pending={pending} canManage={canManage} run={run} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editor && (
        <GoalEditorSheet
          open
          onOpenChange={(open) => { if (!open) setEditor(null); }}
          planId={planId}
          planStatus={planStatus}
          goal={editor === "new" ? null : editor}
          wallets={wallets}
          currency={currency}
          businessMonth={businessMonth}
          onSaved={() => { setEditor(null); router.refresh(); }}
        />
      )}
      {fundingGoal && (
        <FundingSheet
          open
          goal={fundingGoal}
          onOpenChange={(open) => { if (!open) setFundingGoal(null); }}
          onSaved={(status) => {
            setFundingGoal(null);
            toast.success(status === "pending" ? "Đã gửi Admin duyệt khoản đóng góp." : "Đã ghi nhận khoản đóng góp.");
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

function GoalMetric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" }) {
  return <div className="min-w-0"><dt className="text-xs text-[var(--text-muted)]">{label}</dt><dd className={cn("mt-1 break-words font-semibold tabular-nums", tone === "warning" ? "text-[var(--warning)]" : "text-[var(--foreground)]")}>{value}</dd></div>;
}

function FundingHistory({ goal, currency, pending, canManage, run }: {
  goal: FinancialGoalView;
  currency: string;
  pending: boolean;
  canManage: boolean;
  run: (action: () => Promise<{ ok: boolean; message?: string | null }>, success: string, after?: () => void) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const entries = expanded ? goal.fundingEntries : goal.fundingEntries.slice(0, 3);
  return (
    <details open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)} className="border-t border-[var(--border)] pt-3">
      <summary className="cursor-pointer list-none text-sm font-medium text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Lịch sử đóng góp ({goal.fundingEntries.length})</summary>
      <div className="mt-3 grid divide-y divide-[var(--border)]">
        {entries.map((entry) => (
          <div key={entry.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <p className="font-medium tabular-nums text-[var(--foreground)]">{money(entry.amount, currency)}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{entry.effectiveDate} · {entry.requester}{entry.note ? ` · ${entry.note}` : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-xs font-medium", entry.status === "approved" ? "text-[var(--success)]" : entry.status === "rejected" ? "text-[var(--destructive)]" : "text-[var(--warning)]")}>{entry.status === "approved" ? "Đã duyệt" : entry.status === "rejected" ? "Đã từ chối" : "Chờ duyệt"}</span>
              {canManage && entry.status === "pending" && (
                <>
                  <Button variant="icon" size="icon" aria-label="Duyệt khoản đóng góp" disabled={pending} onClick={() => run(() => reviewFinancialGoalFundingAction({ entryId: entry.id, approve: true }), "Đã duyệt khoản đóng góp.")}><Check aria-hidden /></Button>
                  <Button variant="destructiveIcon" size="icon" aria-label="Từ chối khoản đóng góp" disabled={pending} onClick={() => run(() => reviewFinancialGoalFundingAction({ entryId: entry.id, approve: false }), "Đã từ chối khoản đóng góp.")}><X aria-hidden /></Button>
                </>
              )}
              {canManage && entry.status === "approved" && entry.kind !== "reversal" && (
                <Button variant="icon" size="icon" aria-label="Hoàn tác khoản đóng góp" disabled={pending} onClick={() => run(() => reverseFinancialGoalFundingAction({ entryId: entry.id, effectiveDate: today() }), "Đã hoàn tác khoản đóng góp.")}><RotateCcw aria-hidden /></Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function GoalEditorSheet({ open, onOpenChange, planId, planStatus, goal, wallets, currency, businessMonth, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  planStatus: "draft" | "active" | "completed" | "cancelled";
  goal: FinancialGoalView | null;
  wallets: WalletOption[];
  currency: string;
  businessMonth: string;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(goal?.name ?? "");
  const [targetAmount, setTargetAmount] = useState(goal?.targetAmount ?? "");
  const [existingAmount, setExistingAmount] = useState("0");
  const [targetMonth, setTargetMonth] = useState(goal?.targetMonth ?? businessMonth);
  const [trackingMode, setTrackingMode] = useState<"manual" | "linked_wallet">(goal?.trackingMode ?? "manual");
  const [walletId, setWalletId] = useState(goal?.linkedWallet?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const lockedSource = goal?.status === "active";
  const valid = name.trim() && targetAmount && targetMonth >= businessMonth && (trackingMode === "manual" || walletId);

  function submit() {
    setError(null);
    startTransition(async () => {
      const payload = { name, targetAmount, targetMonth, trackingMode, linkedWalletId: trackingMode === "linked_wallet" ? walletId : null };
      const result = goal
        ? await updateFinancialPlanGoalAction({ ...payload, goalId: goal.id })
        : await createFinancialPlanGoalAction({ ...payload, planId, existingAmount });
      if (!result.ok) return setError(result.message || "Không thể lưu mục tiêu.");
      toast.success(goal ? "Đã cập nhật mục tiêu." : "Đã thêm mục tiêu.");
      onSaved();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" placement="inset" size="wide" elevation="flat" className="flex min-h-0 flex-col overflow-hidden">
        <SheetHeader icon={Target} title={goal ? "Sửa mục tiêu" : "Thêm mục tiêu"} description="Chọn số tiền, deadline và một nguồn xác nhận tiến độ." />
        <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto px-4 py-5 md:px-8">
          {error && <div role="alert" tabIndex={-1} className="rounded-xl bg-[var(--destructive)]/10 p-3 text-sm text-[var(--destructive)]">{error}</div>}
          <Input label="Tên mục tiêu" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Quỹ khẩn cấp" aria-invalid={Boolean(error) || undefined} />
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyInput label="Số tiền cần có" required value={targetAmount} onValueChange={setTargetAmount} />
            <MonthPicker label="Hạn hoàn thành" required minMonth={businessMonth} value={targetMonth} onValueChange={setTargetMonth} />
          </div>
          <Select
            label="Nguồn xác nhận tiến độ"
            value={trackingMode}
            onValueChange={(value) => setTrackingMode(value as "manual" | "linked_wallet")}
            disabled={lockedSource}
            options={[
              { value: "manual", label: "Sổ đóng góp thủ công", content: <><ListChecks aria-hidden /> Sổ đóng góp thủ công</> },
              { value: "linked_wallet", label: "Số dư ví liên kết", content: <><Link2 aria-hidden /> Số dư ví liên kết</> },
            ]}
          />
          {trackingMode === "linked_wallet" ? (
            <Select label="Ví tiết kiệm" value={walletId} onValueChange={setWalletId} disabled={lockedSource} placeholder="Chọn ví" options={wallets.map((wallet) => ({ value: wallet.id, label: wallet.name, content: <span className="flex w-full justify-between gap-3"><span>{wallet.name}</span><span className="tabular-nums text-[var(--text-muted)]">{money(wallet.balance, currency)}</span></span> }))} />
          ) : !goal ? (
            <MoneyInput label="Tiền đã xác nhận ban đầu" value={existingAmount} onValueChange={setExistingAmount} />
          ) : null}
          {lockedSource && <p className="text-sm text-[var(--text-secondary)]">Nguồn theo dõi được khóa sau khi kích hoạt để không viết lại lịch sử.</p>}
          {planStatus === "active" && <p className="text-sm text-[var(--text-secondary)]"><CalendarClock className="mr-1 inline size-4" aria-hidden />Thay đổi target hoặc deadline sẽ tính lại forecast ngay.</p>}
        </div>
        <SheetFooter onCancel={() => onOpenChange(false)} cancelLabel="Hủy" submitLabel={goal ? "Lưu thay đổi" : "Thêm mục tiêu"} isSubmitting={pending} submittingLabel="Đang lưu..." submitDisabled={pending || !valid} onSubmit={submit} submitType="button" />
      </SheetContent>
    </Sheet>
  );
}

function FundingSheet({ open, goal, onOpenChange, onSaved }: {
  open: boolean;
  goal: FinancialGoalView;
  onOpenChange: (open: boolean) => void;
  onSaved: (status: "pending" | "approved" | "rejected") => void;
}) {
  const [amount, setAmount] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const valid = useMemo(() => {
    try { return new Decimal(amount || 0).greaterThan(0) && Boolean(effectiveDate); } catch { return false; }
  }, [amount, effectiveDate]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" placement="inset" size="wide" elevation="flat" className="flex min-h-0 flex-col overflow-hidden">
        <SheetHeader icon={CircleDollarSign} title="Ghi nhận đóng góp" description={`Mục tiêu ${goal.name}. Khoản của Member chỉ có hiệu lực sau khi Admin duyệt.`} />
        <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-4 py-5 md:px-8">
          {error && <div role="alert" className="rounded-xl bg-[var(--destructive)]/10 p-3 text-sm text-[var(--destructive)]">{error}</div>}
          <MoneyInput label="Số tiền đóng góp" required value={amount} onValueChange={setAmount} />
          <DatePicker label="Ngày ghi nhận" required value={effectiveDate} onValueChange={setEffectiveDate} />
          <Input label="Ghi chú" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: Tiền thưởng tháng này" />
        </div>
        <SheetFooter onCancel={() => onOpenChange(false)} cancelLabel="Hủy" submitLabel="Ghi nhận" isSubmitting={pending} submittingLabel="Đang gửi..." submitDisabled={pending || !valid} onSubmit={() => startTransition(async () => {
          setError(null);
          const result = await createFinancialGoalFundingAction({ goalId: goal.id, amount, effectiveDate, note });
          if (!result.ok) return setError(result.message || "Không thể ghi nhận khoản đóng góp.");
          onSaved(result.status);
        })} submitType="button" />
      </SheetContent>
    </Sheet>
  );
}
