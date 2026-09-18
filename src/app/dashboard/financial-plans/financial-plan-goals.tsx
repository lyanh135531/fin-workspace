"use client";

import Decimal from "decimal.js";
import { useMemo, useState, useTransition, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  CircleDollarSign,
  History,
  Link2,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Target,
  Trash2,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SpotlightTrigger } from "@/components/ui/spotlight-trigger";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

function subscribeDesktop(callback: () => void) {
  const query = window.matchMedia("(min-width: 901px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function desktopSnapshot() {
  return window.matchMedia("(min-width: 901px)").matches;
}

function serverDesktopSnapshot() {
  return false;
}

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
  const isDesktop = useSyncExternalStore(subscribeDesktop, desktopSnapshot, serverDesktopSnapshot);
  const [editor, setEditor] = useState<FinancialGoalView | "new" | null>(null);
  const [fundingGoal, setFundingGoal] = useState<FinancialGoalView | null>(null);
  const [historyGoal, setHistoryGoal] = useState<FinancialGoalView | null>(null);
  const [cancellingGoal, setCancellingGoal] = useState<FinancialGoalView | null>(null);
  const [menuGoalId, setMenuGoalId] = useState<string | null>(null);
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
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 id="financial-goals-title" className="truncate text-base font-semibold text-[var(--foreground)] sm:text-lg">
            Mục tiêu trong kế hoạch
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)] line-clamp-1 sm:line-clamp-none">
            Tiến độ từ ví liên kết hoặc khoản đóng góp đã duyệt.
          </p>
        </div>
        {canManage && mutable && (
          <Button
            variant="default"
            size="sm"
            className="h-8 shrink-0 px-2.5 text-xs font-medium"
            onClick={() => setEditor("new")}
            disabled={pending}
          >
            <Plus className="mr-1 size-3.5" aria-hidden />
            <span>Thêm<span className="hidden sm:inline"> mục tiêu</span></span>
          </Button>
        )}
      </div>

      <div className="grid gap-3">
        {goals.map((goal, index) => {
          const shortfall = new Decimal(goal.shortfallThisMonth).greaterThan(0);
          const reached = new Decimal(goal.actualProgress).greaterThanOrEqualTo(goal.targetAmount);
          const isMenuOpen = menuGoalId === goal.id;
          const hasManageActions = canManage && mutable && goal.status !== "cancelled";
          const hasAnyMenuActions =
            (goal.status === "active" && goal.trackingMode === "manual") ||
            (goal.trackingMode === "manual" && goal.fundingEntries.length > 0) ||
            hasManageActions;

          const cardHeader = (
            <CardHeader className="pb-3">
              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-secondary)] text-[var(--primary)]" aria-hidden>
                  {goal.trackingMode === "linked_wallet" ? <WalletCards className="size-4" /> : <Target className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <CardTitle className="break-words">{goal.name}</CardTitle>
                    <span className={cn("inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-[var(--surface-secondary)]", HEALTH[goal.health].className)}>
                      {HEALTH[goal.health].label}
                    </span>
                  </div>
                  <CardDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{monthLabel(goal.targetMonth)}</span>
                    <span aria-hidden>·</span>
                    <span>{goal.linkedWallet ? goal.linkedWallet.name : "Sổ thủ công"}</span>
                  </CardDescription>
                </div>
              </div>

              {/* Desktop quick actions */}
              {hasManageActions && (
                <CardAction className="hidden shrink-0 items-center gap-1 md:flex">
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

              {/* Mobile context menu trigger button */}
              {hasAnyMenuActions && (
                <CardAction className="flex shrink-0 items-center md:hidden">
                  <Button
                    variant="icon"
                    size="icon"
                    aria-label={`Tùy chọn cho mục tiêu ${goal.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setMenuGoalId(isMenuOpen ? null : goal.id);
                    }}
                  >
                    <MoreHorizontal className="size-4" aria-hidden />
                  </Button>
                </CardAction>
              )}
            </CardHeader>
          );

          const cardContent = (
            <CardContent className="grid gap-3 pt-0">
              {/* Desktop metrics view */}
              <dl className="hidden grid-cols-2 gap-3 md:grid lg:grid-cols-4">
                <GoalMetric label="Tiền đã xác nhận" value={money(goal.actualProgress, currency)} />
                <GoalMetric label="Mục tiêu" value={money(goal.targetAmount, currency)} />
                <GoalMetric label="Cần dành tháng này" value={money(goal.requiredThisMonth, currency)} />
                <GoalMetric label="Dự kiến khi đến hạn" value={money(goal.projectedAtDeadline, currency)} tone={goal.health === "at_risk" || goal.health === "overdue" ? "warning" : "default"} />
              </dl>

              {/* Mobile key metrics view: clean, large, wrap-safe */}
              <div className="grid grid-cols-2 items-baseline justify-between gap-2 md:hidden">
                <div className="min-w-0">
                  <span className="block text-[11px] text-[var(--text-muted)]">Đã tích lũy</span>
                  <div className="mt-0.5 flex flex-wrap items-baseline gap-1">
                    <span className="text-base font-semibold tabular-nums text-[var(--foreground)]">{money(goal.actualProgress, currency)}</span>
                    <span className="text-[11px] text-[var(--text-muted)]">/ {money(goal.targetAmount, currency)}</span>
                  </div>
                </div>
                <div className="min-w-0 text-right">
                  <span className="block text-[11px] text-[var(--text-muted)]">Cần tháng này</span>
                  <span className="mt-0.5 block text-sm font-semibold tabular-nums text-[var(--foreground)]">{money(goal.requiredThisMonth, currency)}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div role="progressbar" aria-label={`Tiến độ mục tiêu ${goal.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Number(goal.progressPercentage))} className="h-2 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                  <div className="h-full rounded-full bg-[var(--primary)] motion-reduce:transition-none" style={{ width: `${Math.min(Number(goal.progressPercentage), 100)}%` }} />
                </div>
                <span className="text-xs font-semibold tabular-nums text-[var(--foreground)]">{goal.progressPercentage}%</span>
              </div>

              {/* Shortfall banner */}
              {shortfall && (
                <div className="flex w-full min-w-0 items-center justify-between gap-2 rounded-xl bg-[var(--warning)]/10 px-3 py-2 text-xs font-medium text-[var(--warning)]">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">Thiếu {money(goal.shortfallThisMonth, currency)} tháng này</span>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditor(goal);
                      }}
                      className="shrink-0 font-semibold underline hover:no-underline"
                    >
                      Điều chỉnh
                    </button>
                  )}
                </div>
              )}

              {/* Desktop action buttons */}
              {goal.status === "active" && (
                <div className="hidden flex-wrap gap-2 border-t border-[var(--border)] pt-3 md:flex">
                  {goal.trackingMode === "manual" && (
                    <Button variant="outline" size="sm" onClick={() => setFundingGoal(goal)} disabled={pending}>
                      <CircleDollarSign aria-hidden /> Ghi nhận đóng góp
                    </Button>
                  )}
                  {goal.trackingMode === "manual" && goal.fundingEntries.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setHistoryGoal(goal)}>
                      <History aria-hidden /> Lịch sử ({goal.fundingEntries.length})
                    </Button>
                  )}
                  {canManage && reached && (
                    <Button size="sm" onClick={() => run(() => finishFinancialPlanGoalAction({ goalId: goal.id, status: "completed" }), "Đã hoàn thành mục tiêu.")} disabled={pending}>
                      <Check aria-hidden /> Hoàn thành
                    </Button>
                  )}
                  {canManage && (
                    <Button variant="destructive" size="sm" onClick={() => setCancellingGoal(goal)} disabled={pending}>
                      <X aria-hidden /> Hủy mục tiêu
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          );

          if (!isDesktop && hasAnyMenuActions) {
            return (
              <DropdownMenu
                key={goal.id}
                open={isMenuOpen}
                onOpenChange={(open) => setMenuGoalId(open ? goal.id : null)}
              >
                <SpotlightTrigger
                  open={isMenuOpen}
                  onOpenChange={(open) => setMenuGoalId(open ? goal.id : null)}
                  mobileOnly
                  render={
                    <div
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "w-full min-w-0 rounded-2xl outline-none select-none transition-all cursor-pointer",
                        isMenuOpen && "bg-[var(--surface-secondary)]/25",
                      )}
                      aria-label={`Mục tiêu ${goal.name}. Chạm để mở menu tùy chọn.`}
                    />
                  }
                  dismissLabel={`Đóng menu tùy chọn mục tiêu ${goal.name}`}
                >
                  {(spotlightTrigger) => (
                    <DropdownMenuTrigger nativeButton={false} render={spotlightTrigger}>
                      <Card size="sm" className="relative w-full min-w-0 overflow-hidden transition-colors">
                        {cardHeader}
                        {cardContent}
                      </Card>
                    </DropdownMenuTrigger>
                  )}
                </SpotlightTrigger>

                <DropdownMenuContent
                  align="end"
                  side="bottom"
                  sideOffset={6}
                  className="w-56 !rounded-xl p-1.5 border border-[var(--border)] bg-[var(--surface)] shadow-none"
                >
                  {goal.status === "active" && goal.trackingMode === "manual" && (
                    <DropdownMenuItem
                      onClick={() => {
                        setMenuGoalId(null);
                        setFundingGoal(goal);
                      }}
                      className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium !rounded-lg cursor-pointer"
                    >
                      <CircleDollarSign className="size-4 text-[var(--primary)]" aria-hidden />
                      <span>Ghi nhận đóng góp</span>
                    </DropdownMenuItem>
                  )}
                  {goal.trackingMode === "manual" && goal.fundingEntries.length > 0 && (
                    <DropdownMenuItem
                      onClick={() => {
                        setMenuGoalId(null);
                        setHistoryGoal(goal);
                      }}
                      className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium !rounded-lg cursor-pointer"
                    >
                      <History className="size-4 text-[var(--text-secondary)]" aria-hidden />
                      <span>Lịch sử đóng góp ({goal.fundingEntries.length})</span>
                    </DropdownMenuItem>
                  )}
                  {canManage && mutable && (
                    <DropdownMenuItem
                      onClick={() => {
                        setMenuGoalId(null);
                        setEditor(goal);
                      }}
                      className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium !rounded-lg cursor-pointer"
                    >
                      <Pencil className="size-4 text-[var(--text-secondary)]" aria-hidden />
                      <span>Chỉnh sửa mục tiêu</span>
                    </DropdownMenuItem>
                  )}
                  {canManage && mutable && index > 0 && (
                    <DropdownMenuItem
                      onClick={() => {
                        setMenuGoalId(null);
                        move(index, -1);
                      }}
                      className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium !rounded-lg cursor-pointer"
                    >
                      <ArrowUp className="size-4 text-[var(--text-secondary)]" aria-hidden />
                      <span>Tăng mức ưu tiên</span>
                    </DropdownMenuItem>
                  )}
                  {canManage && mutable && index < goals.length - 1 && (
                    <DropdownMenuItem
                      onClick={() => {
                        setMenuGoalId(null);
                        move(index, 1);
                      }}
                      className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium !rounded-lg cursor-pointer"
                    >
                      <ArrowDown className="size-4 text-[var(--text-secondary)]" aria-hidden />
                      <span>Giảm mức ưu tiên</span>
                    </DropdownMenuItem>
                  )}
                  {canManage && reached && goal.status === "active" && (
                    <DropdownMenuItem
                      variant="primary"
                      onClick={() => {
                        setMenuGoalId(null);
                        run(() => finishFinancialPlanGoalAction({ goalId: goal.id, status: "completed" }), "Đã hoàn thành mục tiêu.");
                      }}
                      className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium !rounded-lg cursor-pointer"
                    >
                      <Check className="size-4 text-[var(--success)]" aria-hidden />
                      <span>Hoàn thành mục tiêu</span>
                    </DropdownMenuItem>
                  )}
                  {canManage && goal.status === "active" && (
                    <>
                      <DropdownMenuSeparator className="my-1 border-[var(--border)]" />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                          setMenuGoalId(null);
                          setCancellingGoal(goal);
                        }}
                        className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium !rounded-lg cursor-pointer text-[var(--destructive)]"
                      >
                        <Trash2 className="size-4 text-[var(--destructive)]" aria-hidden />
                        <span>Hủy mục tiêu</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          return (
            <Card key={goal.id} size="sm">
              {cardHeader}
              {cardContent}
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

      {historyGoal && (
        <GoalFundingHistorySheet
          open
          onOpenChange={(open) => { if (!open) setHistoryGoal(null); }}
          goal={historyGoal}
          currency={currency}
          pending={pending}
          canManage={canManage}
          run={run}
          onAddFunding={() => {
            setFundingGoal(historyGoal);
            setHistoryGoal(null);
          }}
        />
      )}

      <ConfirmDelete
        open={Boolean(cancellingGoal)}
        onOpenChange={(open) => { if (!open) setCancellingGoal(null); }}
        trigger={null}
        title="Hủy mục tiêu?"
        description="Mục tiêu sẽ chuyển sang chỉ đọc. Tiến độ và lịch sử đóng góp vẫn được giữ lại."
        confirmLabel="Hủy mục tiêu"
        ariaLabel={cancellingGoal ? `Hủy mục tiêu ${cancellingGoal.name}` : "Hủy mục tiêu"}
        onConfirm={() => {
          if (!cancellingGoal) return;
          run(() => finishFinancialPlanGoalAction({ goalId: cancellingGoal.id, status: "cancelled" }), "Đã hủy mục tiêu.");
          setCancellingGoal(null);
        }}
        disabled={pending}
        presentation={isDesktop ? "popover" : "sheet"}
      />
    </section>
  );
}

function GoalMetric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
      <dd className={cn("mt-1 break-words font-semibold tabular-nums", tone === "warning" ? "text-[var(--warning)]" : "text-[var(--foreground)]")}>{value}</dd>
    </div>
  );
}

function GoalFundingHistorySheet({
  open,
  onOpenChange,
  goal,
  currency,
  pending,
  canManage,
  run,
  onAddFunding,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: FinancialGoalView;
  currency: string;
  pending: boolean;
  canManage: boolean;
  run: (action: () => Promise<{ ok: boolean; message?: string | null }>, success: string, after?: () => void) => void;
  onAddFunding?: () => void;
}) {
  const isDesktop = useSyncExternalStore(subscribeDesktop, desktopSnapshot, serverDesktopSnapshot);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        placement={isDesktop ? "inset" : "edge"}
        size={isDesktop ? "wide" : "default"}
        spacing={isDesktop ? "default" : "flush"}
        elevation={isDesktop ? "flat" : "raised"}
        className={cn(isDesktop ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "quick-transaction-sheet")}
      >
        <SheetHeader
          icon={History}
          title="Lịch sử đóng góp"
          description={`Mục tiêu ${goal.name} · Đã xác nhận ${money(goal.actualProgress, currency)} / ${money(goal.targetAmount, currency)}`}
        />
        <div className={cn("grid min-h-0 flex-1 content-start gap-3 overflow-y-auto px-4 py-5 md:px-8", !isDesktop && "quick-transaction-scroll pb-6")}>
          {goal.fundingEntries.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">Chưa có khoản đóng góp nào.</p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {goal.fundingEntries.map((entry) => (
                <div key={entry.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums text-[var(--foreground)]">{money(entry.amount, currency)}</span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium",
                          entry.status === "approved"
                            ? "bg-[var(--success)]/10 text-[var(--success)]"
                            : entry.status === "rejected"
                              ? "bg-[var(--destructive)]/10 text-[var(--destructive)]"
                              : "bg-[var(--warning)]/10 text-[var(--warning)]",
                        )}
                      >
                        {entry.status === "approved" ? "Đã duyệt" : entry.status === "rejected" ? "Đã từ chối" : "Chờ duyệt"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {entry.effectiveDate} · Người gửi: {entry.requester}
                      {entry.reviewer ? ` · Người duyệt: ${entry.reviewer}` : ""}
                      {entry.note ? ` · Ghi chú: ${entry.note}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-1 sm:pt-0">
                    {canManage && entry.status === "pending" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-[var(--success)]"
                          disabled={pending}
                          onClick={() => run(() => reviewFinancialGoalFundingAction({ entryId: entry.id, approve: true }), "Đã duyệt khoản đóng góp.")}
                        >
                          <Check className="mr-1 size-3.5" /> Duyệt
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 text-xs"
                          disabled={pending}
                          onClick={() => run(() => reviewFinancialGoalFundingAction({ entryId: entry.id, approve: false }), "Đã từ chối khoản đóng góp.")}
                        >
                          <X className="mr-1 size-3.5" /> Từ chối
                        </Button>
                      </>
                    )}
                    {canManage && entry.status === "approved" && entry.kind !== "reversal" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={pending}
                        onClick={() => run(() => reverseFinancialGoalFundingAction({ entryId: entry.id, effectiveDate: today() }), "Đã hoàn tác khoản đóng góp.")}
                      >
                        <RotateCcw className="mr-1 size-3.5" /> Hoàn tác
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <SheetFooter
          className={cn(!isDesktop && "pb-[max(1.5rem,env(safe-area-inset-bottom))] px-4 py-3")}
          onCancel={() => onOpenChange(false)}
          cancelLabel="Đóng"
          submitLabel={goal.status === "active" ? "+ Ghi nhận đóng góp" : undefined}
          onSubmit={
            goal.status === "active" && onAddFunding
              ? () => {
                  onOpenChange(false);
                  onAddFunding();
                }
              : undefined
          }
          submitType="button"
        />
      </SheetContent>
    </Sheet>
  );
}

function GoalEditorSheet({
  open,
  onOpenChange,
  planId,
  planStatus,
  goal,
  wallets,
  currency,
  businessMonth,
  onSaved,
}: {
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
  const isDesktop = useSyncExternalStore(subscribeDesktop, desktopSnapshot, serverDesktopSnapshot);
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
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        placement={isDesktop ? "inset" : "edge"}
        size={isDesktop ? "wide" : "default"}
        spacing={isDesktop ? "default" : "flush"}
        elevation={isDesktop ? "flat" : "raised"}
        className={cn(isDesktop ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "quick-transaction-sheet")}
      >
        <SheetHeader icon={Target} title={goal ? "Sửa mục tiêu" : "Thêm mục tiêu"} description="Chọn số tiền, deadline và một nguồn xác nhận tiến độ." />
        <div className={cn("grid min-h-0 flex-1 content-start gap-5 overflow-y-auto px-4 py-5 md:px-8", !isDesktop && "quick-transaction-scroll pb-6")}>
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
        <SheetFooter
          className={cn(!isDesktop && "pb-[max(1.5rem,env(safe-area-inset-bottom))] px-4 py-3")}
          onCancel={() => onOpenChange(false)}
          cancelLabel="Hủy"
          submitLabel={goal ? "Lưu thay đổi" : "Thêm mục tiêu"}
          isSubmitting={pending}
          submittingLabel="Đang lưu..."
          submitDisabled={pending || !valid}
          onSubmit={submit}
          submitType="button"
        />
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
  const isDesktop = useSyncExternalStore(subscribeDesktop, desktopSnapshot, serverDesktopSnapshot);
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
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        placement={isDesktop ? "inset" : "edge"}
        size={isDesktop ? "wide" : "default"}
        spacing={isDesktop ? "default" : "flush"}
        elevation={isDesktop ? "flat" : "raised"}
        className={cn(isDesktop ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "quick-transaction-sheet")}
      >
        <SheetHeader icon={CircleDollarSign} title="Ghi nhận đóng góp" description={`Mục tiêu ${goal.name}. Khoản của Member chỉ có hiệu lực sau khi Admin duyệt.`} />
        <div className={cn("grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-4 py-5 md:px-8", !isDesktop && "quick-transaction-scroll pb-6")}>
          {error && <div role="alert" className="rounded-xl bg-[var(--destructive)]/10 p-3 text-sm text-[var(--destructive)]">{error}</div>}
          <MoneyInput label="Số tiền đóng góp" required value={amount} onValueChange={setAmount} />
          <DatePicker label="Ngày ghi nhận" required value={effectiveDate} onValueChange={setEffectiveDate} />
          <Input label="Ghi chú" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: Tiền thưởng tháng này" />
        </div>
        <SheetFooter
          className={cn(!isDesktop && "pb-[max(1.5rem,env(safe-area-inset-bottom))] px-4 py-3")}
          onCancel={() => onOpenChange(false)}
          cancelLabel="Hủy"
          submitLabel="Ghi nhận"
          isSubmitting={pending}
          submittingLabel="Đang gửi..."
          submitDisabled={pending || !valid}
          onSubmit={() => startTransition(async () => {
            setError(null);
            const result = await createFinancialGoalFundingAction({ goalId: goal.id, amount, effectiveDate, note });
            if (!result.ok) return setError(result.message || "Không thể ghi nhận khoản đóng góp.");
            onSaved(result.status);
          })}
          submitType="button"
        />
      </SheetContent>
    </Sheet>
  );
}
