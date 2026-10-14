"use client";

import Decimal from "decimal.js";
import { useMemo, useState, useTransition, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  CircleDollarSign,
  History,
  Link2,
  ListChecks,
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
  Empty,
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
  health:
    | "ahead"
    | "on_track"
    | "behind"
    | "at_risk"
    | "goal_reached"
    | "overdue";
  fundingEntries: Array<{
    id: string;
    amount: string;
    kind:
      | "opening"
      | "contribution"
      | "withdrawal"
      | "adjustment"
      | "reversal";
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
  ahead: {
    label: "Vượt tiến độ",
    className:
      "bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))] text-[var(--success)]",
  },
  on_track: {
    label: "Đúng tiến độ",
    className:
      "bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))] text-[var(--success)]",
  },
  behind: {
    label: "Chậm tiến độ",
    className:
      "bg-[color-mix(in_srgb,var(--warning)_14%,var(--surface))] text-[var(--warning)]",
  },
  at_risk: {
    label: "Cần chú ý",
    className:
      "bg-[color-mix(in_srgb,var(--warning)_14%,var(--surface))] text-[var(--warning)]",
  },
  goal_reached: {
    label: "Đã đạt mục tiêu",
    className:
      "bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))] text-[var(--success)]",
  },
  overdue: {
    label: "Quá hạn",
    className:
      "bg-[color-mix(in_srgb,var(--destructive)_14%,var(--surface))] text-[var(--destructive)]",
  },
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
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    desktopSnapshot,
    serverDesktopSnapshot,
  );
  const [editor, setEditor] = useState<FinancialGoalView | "new" | null>(null);
  const [fundingGoal, setFundingGoal] = useState<FinancialGoalView | null>(
    null,
  );
  const [historyGoal, setHistoryGoal] = useState<FinancialGoalView | null>(
    null,
  );
  const [cancellingGoal, setCancellingGoal] =
    useState<FinancialGoalView | null>(null);
  const [menuGoalId, setMenuGoalId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const mutable = planStatus === "draft" || planStatus === "active";

  function run(
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

  function move(index: number, direction: -1 | 1) {
    const next = [...goals];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    run(
      () =>
        reorderFinancialPlanGoalsAction({
          planId,
          goalIds: next.map((goal) => goal.id),
        }),
      "Đã cập nhật thứ tự ưu tiên.",
    );
  }

  return (
    <section className="grid gap-4" aria-labelledby="financial-goals-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2
            id="financial-goals-title"
            className="break-words text-base font-semibold leading-snug text-[var(--foreground)] md:text-lg"
          >
            Mục tiêu tích lũy ({goals.length})
          </h2>
          <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-secondary)]">
            Theo dõi tiến độ từ ví tiết kiệm liên kết hoặc các khoản đóng góp đã
            xác nhận.
          </p>
        </div>
        {canManage && mutable && (
          <Button
            variant="default"
            size="sm"
            onClick={() => setEditor("new")}
            disabled={pending}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span>Thêm mục tiêu</span>
          </Button>
        )}
      </div>

      {goals.length === 0 ? (
        <Card>
          <Empty
            icon={Target}
            title="Chưa có mục tiêu tích lũy"
            description="Thêm mục tiêu tiết kiệm cụ thể để hệ thống tự động tính mức cần để dành mỗi tháng."
            action={
              canManage && mutable ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setEditor("new")}
                  disabled={pending}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  <span>Thêm mục tiêu đầu tiên</span>
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div
          className={cn(
            "grid grid-cols-1 gap-4",
            goals.length > 1 && "lg:grid-cols-2",
          )}
        >
          {goals.map((goal, index) => {
            const shortfall = new Decimal(goal.shortfallThisMonth).greaterThan(
              0,
            );
            const reached = new Decimal(
              goal.actualProgress,
            ).greaterThanOrEqualTo(goal.targetAmount);
            const isMenuOpen = menuGoalId === goal.id;
            const hasManageActions =
              canManage && mutable && goal.status !== "cancelled";
            const hasAnyMenuActions =
              (goal.status === "active" && goal.trackingMode === "manual") ||
              (goal.trackingMode === "manual" &&
                goal.fundingEntries.length > 0) ||
              hasManageActions;
            const progressPct = Math.min(
              Math.max(Number(goal.progressPercentage) || 0, 0),
              100,
            );

            const cardBody = (
              <>
                <CardHeader className="pb-2">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-secondary)] text-[var(--primary)]"
                      aria-hidden="true"
                    >
                      {goal.trackingMode === "linked_wallet" ? (
                        <WalletCards className="size-4" />
                      ) : (
                        <Target className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="min-w-0 break-words leading-snug">
                          {goal.name}
                        </CardTitle>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium",
                            HEALTH[goal.health].className,
                          )}
                        >
                          {HEALTH[goal.health].label}
                        </span>
                      </div>
                      <CardDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-snug">
                        <span className="shrink-0">
                          Hạn: {monthLabel(goal.targetMonth)}
                        </span>
                        <span aria-hidden="true">•</span>
                        <span className="min-w-0 break-words">
                          {goal.linkedWallet
                            ? `Ví liên kết: ${goal.linkedWallet.name}`
                            : "Ghi nhận thủ công"}
                        </span>
                      </CardDescription>
                    </div>
                  </div>

                  {/* Desktop-Only Inline Icon Action Cluster */}
                  <CardAction
                    className="hidden shrink-0 items-center gap-1 lg:flex"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-1">
                      {goal.status === "active" &&
                        goal.trackingMode === "manual" && (
                          <Button
                            variant="selected"
                            size="icon"
                            onClick={() => setFundingGoal(goal)}
                            disabled={pending}
                            aria-label={`Ghi nhận đóng góp ${goal.name}`}
                            title="Ghi nhận đóng góp"
                          >
                            <CircleDollarSign aria-hidden="true" />
                          </Button>
                        )}
                      {goal.trackingMode === "manual" &&
                        goal.fundingEntries.length > 0 && (
                          <Button
                            variant="icon"
                            size="icon"
                            onClick={() => setHistoryGoal(goal)}
                            aria-label={`Lịch sử đóng góp ${goal.name}`}
                            title={`Lịch sử đóng góp (${goal.fundingEntries.length})`}
                          >
                            <History aria-hidden="true" />
                          </Button>
                        )}
                      {canManage && reached && goal.status === "active" && (
                        <Button
                          variant="success"
                          size="icon"
                          onClick={() =>
                            run(
                              () =>
                                finishFinancialPlanGoalAction({
                                  goalId: goal.id,
                                  status: "completed",
                                }),
                              "Đã hoàn thành mục tiêu.",
                            )
                          }
                          disabled={pending}
                          aria-label={`Hoàn thành mục tiêu ${goal.name}`}
                          title="Hoàn thành mục tiêu"
                        >
                          <Check aria-hidden="true" />
                        </Button>
                      )}
                      {hasManageActions && (
                        <>
                          {goals.length > 1 && (
                            <>
                              <Button
                                variant="icon"
                                size="icon"
                                onClick={() => move(index, -1)}
                                disabled={pending || index === 0}
                                aria-label={`Tăng ưu tiên ${goal.name}`}
                                title="Tăng mức ưu tiên"
                              >
                                <ArrowUp aria-hidden="true" />
                              </Button>
                              <Button
                                variant="icon"
                                size="icon"
                                onClick={() => move(index, 1)}
                                disabled={pending || index === goals.length - 1}
                                aria-label={`Giảm ưu tiên ${goal.name}`}
                                title="Giảm mức ưu tiên"
                              >
                                <ArrowDown aria-hidden="true" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="icon"
                            size="icon"
                            onClick={() => setEditor(goal)}
                            disabled={pending}
                            aria-label={`Sửa mục tiêu ${goal.name}`}
                            title="Chỉnh sửa mục tiêu"
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                        </>
                      )}
                      {canManage && goal.status === "active" && (
                        <Button
                          variant="destructiveIcon"
                          size="icon"
                          onClick={() => setCancellingGoal(goal)}
                          disabled={pending}
                          aria-label={`Hủy mục tiêu ${goal.name}`}
                          title="Hủy mục tiêu"
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </CardAction>
                </CardHeader>

                <CardContent className="grid gap-3.5 pt-0">
                  {/* Saved vs Target + Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-xs text-[var(--text-secondary)]">
                          Đã tích lũy:{" "}
                        </span>
                        <strong className="text-base font-bold text-[var(--foreground)] tabular-nums shrink-0 md:text-lg">
                          {money(goal.actualProgress, currency)}
                        </strong>
                        <span className="ml-1.5 text-xs text-[var(--text-muted)] tabular-nums shrink-0">
                          / {money(goal.targetAmount, currency)}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-[var(--primary)] tabular-nums shrink-0">
                        {goal.progressPercentage}%
                      </span>
                    </div>

                    <div
                      role="progressbar"
                      aria-label={`Tiến độ mục tiêu ${goal.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(progressPct)}
                      className="h-2 overflow-hidden rounded-full bg-[var(--surface-secondary)]"
                    >
                      <div
                        className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-300 motion-reduce:transition-none"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Key Monthly Metrics: Mục tiêu tiết kiệm tháng này & Mức cần bù thêm / Dự kiến */}
                  <dl className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 sm:grid-cols-2">
                    <div className="min-w-0">
                      <dt className="break-words text-xs leading-snug text-[var(--text-secondary)]">
                        Mục tiêu tiết kiệm tháng này
                      </dt>
                      <dd className="mt-1 text-sm font-bold text-[var(--foreground)] tabular-nums shrink-0">
                        {money(goal.requiredThisMonth, currency)}
                      </dd>
                    </div>

                    {shortfall ? (
                      <div className="min-w-0">
                        <dt className="break-words text-xs font-medium leading-snug text-[var(--warning)]">
                          Mức cần bù thêm
                        </dt>
                        <dd className="mt-1 text-sm font-bold text-[var(--warning)] tabular-nums shrink-0">
                          {money(goal.shortfallThisMonth, currency)}
                        </dd>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <dt className="break-words text-xs leading-snug text-[var(--text-secondary)]">
                          Dự kiến khi đến hạn
                        </dt>
                        <dd
                          className={cn(
                            "mt-1 text-sm font-bold tabular-nums shrink-0",
                            goal.health === "at_risk" ||
                              goal.health === "overdue"
                              ? "text-[var(--warning)]"
                              : "text-[var(--foreground)]",
                          )}
                        >
                          {money(goal.projectedAtDeadline, currency)}
                        </dd>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </>
            );

            if (!hasAnyMenuActions) {
              return (
                <Card key={goal.id} size="sm">
                  {cardBody}
                </Card>
              );
            }

            function handleGoalMenuOpenChange(nextOpen: boolean) {
              if (
                nextOpen &&
                typeof window !== "undefined" &&
                typeof window.matchMedia === "function" &&
                window.matchMedia("(min-width: 1024px)").matches
              ) {
                return;
              }
              setMenuGoalId(nextOpen ? goal.id : null);
            }

            return (
              <DropdownMenu
                key={goal.id}
                open={isMenuOpen}
                onOpenChange={handleGoalMenuOpenChange}
              >
                <SpotlightTrigger
                  open={isMenuOpen}
                  onOpenChange={handleGoalMenuOpenChange}
                  mobileOnly
                  dismissLabel={`Đóng menu tùy chọn mục tiêu ${goal.name}`}
                  render={
                    <Card
                      size="sm"
                      role="button"
                      tabIndex={0}
                      aria-label={`Mục tiêu ${goal.name}. Chạm để mở menu thao tác.`}
                      className="cursor-pointer select-none text-left transition-all duration-150 active:scale-[0.99] active:bg-[var(--surface-hover)] lg:cursor-default lg:select-auto lg:active:scale-100 lg:active:bg-[var(--surface)]"
                    />
                  }
                >
                  {(spotlightTrigger) => (
                    <DropdownMenuTrigger
                      nativeButton={false}
                      render={spotlightTrigger}
                    >
                      {cardBody}
                    </DropdownMenuTrigger>
                  )}
                </SpotlightTrigger>

                <DropdownMenuContent
                  align="center"
                  side="bottom"
                  sideOffset={6}
                  className="w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 lg:hidden"
                >
                  {goal.status === "active" &&
                    goal.trackingMode === "manual" && (
                      <DropdownMenuItem
                        onClick={() => {
                          setMenuGoalId(null);
                          setFundingGoal(goal);
                        }}
                      >
                        <CircleDollarSign
                          className="size-4 text-[var(--primary)]"
                          aria-hidden="true"
                        />
                        <span>Ghi nhận đóng góp</span>
                      </DropdownMenuItem>
                    )}
                  {goal.trackingMode === "manual" &&
                    goal.fundingEntries.length > 0 && (
                      <DropdownMenuItem
                        onClick={() => {
                          setMenuGoalId(null);
                          setHistoryGoal(goal);
                        }}
                      >
                        <History
                          className="size-4 text-[var(--text-secondary)]"
                          aria-hidden="true"
                        />
                        <span>
                          Lịch sử đóng góp ({goal.fundingEntries.length})
                        </span>
                      </DropdownMenuItem>
                    )}
                  {canManage && mutable && (
                    <DropdownMenuItem
                      onClick={() => {
                        setMenuGoalId(null);
                        setEditor(goal);
                      }}
                    >
                      <Pencil
                        className="size-4 text-[var(--text-secondary)]"
                        aria-hidden="true"
                      />
                      <span>Chỉnh sửa mục tiêu</span>
                    </DropdownMenuItem>
                  )}
                  {canManage && mutable && index > 0 && (
                    <DropdownMenuItem
                      onClick={() => {
                        setMenuGoalId(null);
                        move(index, -1);
                      }}
                    >
                      <ArrowUp
                        className="size-4 text-[var(--text-secondary)]"
                        aria-hidden="true"
                      />
                      <span>Tăng mức ưu tiên</span>
                    </DropdownMenuItem>
                  )}
                  {canManage && mutable && index < goals.length - 1 && (
                    <DropdownMenuItem
                      onClick={() => {
                        setMenuGoalId(null);
                        move(index, 1);
                      }}
                    >
                      <ArrowDown
                        className="size-4 text-[var(--text-secondary)]"
                        aria-hidden="true"
                      />
                      <span>Giảm mức ưu tiên</span>
                    </DropdownMenuItem>
                  )}
                  {canManage && reached && goal.status === "active" && (
                    <DropdownMenuItem
                      variant="primary"
                      onClick={() => {
                        setMenuGoalId(null);
                        run(
                          () =>
                            finishFinancialPlanGoalAction({
                              goalId: goal.id,
                              status: "completed",
                            }),
                          "Đã hoàn thành mục tiêu.",
                        );
                      }}
                    >
                      <Check
                        className="size-4 text-[var(--success)]"
                        aria-hidden="true"
                      />
                      <span>Hoàn thành mục tiêu</span>
                    </DropdownMenuItem>
                  )}
                  {canManage && goal.status === "active" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                          setMenuGoalId(null);
                          setCancellingGoal(goal);
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        <span>Hủy mục tiêu</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </div>
      )}

      {editor && (
        <GoalEditorSheet
          open
          onOpenChange={(open) => {
            if (!open) setEditor(null);
          }}
          planId={planId}
          planStatus={planStatus}
          goal={editor === "new" ? null : editor}
          wallets={wallets}
          currency={currency}
          businessMonth={businessMonth}
          onSaved={() => {
            setEditor(null);
            router.refresh();
          }}
        />
      )}

      {fundingGoal && (
        <FundingSheet
          open
          goal={fundingGoal}
          onOpenChange={(open) => {
            if (!open) setFundingGoal(null);
          }}
          onSaved={(status) => {
            setFundingGoal(null);
            toast.success(
              status === "pending"
                ? "Đã gửi Quản trị viên duyệt khoản đóng góp."
                : "Đã ghi nhận khoản đóng góp.",
            );
            router.refresh();
          }}
        />
      )}

      {historyGoal && (
        <GoalFundingHistorySheet
          open
          onOpenChange={(open) => {
            if (!open) setHistoryGoal(null);
          }}
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
        onOpenChange={(open) => {
          if (!open) setCancellingGoal(null);
        }}
        trigger={null}
        title="Hủy mục tiêu tích lũy?"
        description="Mục tiêu sẽ chuyển sang trạng thái chỉ đọc. Số tiền đã tích lũy và lịch sử đóng góp vẫn được lưu giữ."
        confirmLabel="Hủy mục tiêu"
        ariaLabel={
          cancellingGoal ? `Hủy mục tiêu ${cancellingGoal.name}` : "Hủy mục tiêu"
        }
        onConfirm={() => {
          if (!cancellingGoal) return;
          run(
            () =>
              finishFinancialPlanGoalAction({
                goalId: cancellingGoal.id,
                status: "cancelled",
              }),
            "Đã hủy mục tiêu.",
          );
          setCancellingGoal(null);
        }}
        disabled={pending}
        presentation={isDesktop ? "popover" : "sheet"}
      />
    </section>
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
  run: (
    action: () => Promise<{ ok: boolean; message?: string | null }>,
    success: string,
    after?: () => void,
  ) => void;
  onAddFunding?: () => void;
}) {
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    desktopSnapshot,
    serverDesktopSnapshot,
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        placement={isDesktop ? "inset" : "edge"}
        size={isDesktop ? "wide" : "default"}
        spacing="flush"
        elevation="flat"
      >
        <SheetHeader
          icon={History}
          title="Lịch sử đóng góp"
          description={`Mục tiêu ${goal.name} · Đã tích lũy ${money(goal.actualProgress, currency)} / ${money(goal.targetAmount, currency)}`}
        />
        <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto px-4 py-5 md:px-6">
          {goal.fundingEntries.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">
              Chưa có khoản đóng góp nào được ghi nhận.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {goal.fundingEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[var(--foreground)] tabular-nums shrink-0">
                        {money(entry.amount, currency)}
                      </span>
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-xs font-medium shrink-0",
                          entry.status === "approved"
                            ? "bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))] text-[var(--success)]"
                            : entry.status === "rejected"
                              ? "bg-[color-mix(in_srgb,var(--destructive)_14%,var(--surface))] text-[var(--destructive)]"
                              : "bg-[color-mix(in_srgb,var(--warning)_14%,var(--surface))] text-[var(--warning)]",
                        )}
                      >
                        {entry.status === "approved"
                          ? "Đã duyệt"
                          : entry.status === "rejected"
                            ? "Đã từ chối"
                            : "Chờ duyệt"}
                      </span>
                    </div>
                    <p className="mt-1 break-words text-xs leading-snug text-[var(--text-muted)]">
                      {entry.effectiveDate} · Người gửi: {entry.requester}
                      {entry.reviewer ? ` · Người duyệt: ${entry.reviewer}` : ""}
                      {entry.note ? ` · Ghi chú: ${entry.note}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 pt-1 sm:pt-0">
                    {canManage && entry.status === "pending" && (
                      <>
                        <Button
                          variant="success"
                          size="icon"
                          disabled={pending}
                          aria-label="Duyệt khoản đóng góp"
                          title="Duyệt khoản đóng góp"
                          onClick={() =>
                            run(
                              () =>
                                reviewFinancialGoalFundingAction({
                                  entryId: entry.id,
                                  approve: true,
                                }),
                              "Đã duyệt khoản đóng góp.",
                            )
                          }
                        >
                          <Check className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="destructiveIcon"
                          size="icon"
                          disabled={pending}
                          aria-label="Từ chối khoản đóng góp"
                          title="Từ chối khoản đóng góp"
                          onClick={() =>
                            run(
                              () =>
                                reviewFinancialGoalFundingAction({
                                  entryId: entry.id,
                                  approve: false,
                                }),
                              "Đã từ chối khoản đóng góp.",
                            )
                          }
                        >
                          <X className="size-4" aria-hidden="true" />
                        </Button>
                      </>
                    )}
                    {canManage &&
                      entry.status === "approved" &&
                      entry.kind !== "reversal" && (
                        <Button
                          variant="icon"
                          size="icon"
                          disabled={pending}
                          aria-label="Hoàn tác khoản đóng góp"
                          title="Hoàn tác khoản đóng góp"
                          onClick={() =>
                            run(
                              () =>
                                reverseFinancialGoalFundingAction({
                                  entryId: entry.id,
                                  effectiveDate: today(),
                                }),
                              "Đã hoàn tác khoản đóng góp.",
                            )
                          }
                        >
                          <RotateCcw className="size-4" aria-hidden="true" />
                        </Button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <SheetFooter
          onCancel={() => onOpenChange(false)}
          cancelLabel="Đóng"
          submitLabel={
            goal.status === "active" ? "Ghi nhận đóng góp" : undefined
          }
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
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    desktopSnapshot,
    serverDesktopSnapshot,
  );
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(goal?.name ?? "");
  const [targetAmount, setTargetAmount] = useState(goal?.targetAmount ?? "");
  const [existingAmount, setExistingAmount] = useState("0");
  const [targetMonth, setTargetMonth] = useState(
    goal?.targetMonth ?? businessMonth,
  );
  const [trackingMode, setTrackingMode] = useState<"manual" | "linked_wallet">(
    goal?.trackingMode ?? "manual",
  );
  const [walletId, setWalletId] = useState(goal?.linkedWallet?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const lockedSource = goal?.status === "active";
  const valid =
    name.trim() &&
    targetAmount &&
    targetMonth >= businessMonth &&
    (trackingMode === "manual" || walletId);

  function submit() {
    setError(null);
    startTransition(async () => {
      const payload = {
        name,
        targetAmount,
        targetMonth,
        trackingMode,
        linkedWalletId: trackingMode === "linked_wallet" ? walletId : null,
      };
      const result = goal
        ? await updateFinancialPlanGoalAction({ ...payload, goalId: goal.id })
        : await createFinancialPlanGoalAction({
            ...payload,
            planId,
            existingAmount,
          });
      if (!result.ok)
        return setError(result.message || "Không thể lưu mục tiêu.");
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
        spacing="flush"
        elevation="flat"
      >
        <SheetHeader
          icon={Target}
          title={goal ? "Chỉnh sửa mục tiêu tích lũy" : "Thêm mục tiêu tích lũy"}
          description="Thiết lập số tiền cần tích lũy, thời hạn hoàn thành và cách theo dõi tiến độ."
        />
        <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto px-4 py-5 md:px-6">
          {error && (
            <div
              role="alert"
              tabIndex={-1}
              className="rounded-xl border border-[color-mix(in_srgb,var(--destructive)_30%,var(--border))] bg-[color-mix(in_srgb,var(--destructive)_10%,var(--surface))] p-3 text-sm text-[var(--destructive)]"
            >
              {error}
            </div>
          )}
          <Input
            label="Tên mục tiêu"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ví dụ: Quỹ dự phòng khẩn cấp, Mua xe..."
            aria-invalid={Boolean(error) || undefined}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyInput
              label="Số tiền mục tiêu"
              required
              value={targetAmount}
              onValueChange={setTargetAmount}
            />
            <MonthPicker
              label="Tháng hoàn thành dự kiến"
              required
              minMonth={businessMonth}
              value={targetMonth}
              onValueChange={setTargetMonth}
            />
          </div>
          <Select
            label="Cách theo dõi tiến độ"
            value={trackingMode}
            onValueChange={(value) =>
              setTrackingMode(value as "manual" | "linked_wallet")
            }
            disabled={lockedSource}
            options={[
              {
                value: "manual",
                label: "Ghi nhận đóng góp thủ công",
                content: (
                  <>
                    <ListChecks aria-hidden="true" /> Ghi nhận đóng góp thủ công
                  </>
                ),
              },
              {
                value: "linked_wallet",
                label: "Theo số dư ví tiết kiệm liên kết",
                content: (
                  <>
                    <Link2 aria-hidden="true" /> Theo số dư ví tiết kiệm liên kết
                  </>
                ),
              },
            ]}
          />
          {trackingMode === "linked_wallet" ? (
            <Select
              label="Chọn ví tiết kiệm liên kết"
              value={walletId}
              onValueChange={setWalletId}
              disabled={lockedSource}
              placeholder="Chọn ví"
              options={wallets.map((wallet) => ({
                value: wallet.id,
                label: wallet.name,
                content: (
                  <span className="flex w-full justify-between gap-3">
                    <span className="break-words">{wallet.name}</span>
                    <span className="text-[var(--text-muted)] tabular-nums shrink-0">
                      {money(wallet.balance, currency)}
                    </span>
                  </span>
                ),
              }))}
            />
          ) : !goal ? (
            <MoneyInput
              label="Số tiền đã tích lũy sẵn"
              value={existingAmount}
              onValueChange={setExistingAmount}
            />
          ) : null}
          {lockedSource && (
            <p className="text-xs text-[var(--text-secondary)]">
              Cách theo dõi được cố định sau khi kế hoạch bắt đầu chạy để đảm
              bảo tính chính xác của dữ liệu lịch sử.
            </p>
          )}
          {planStatus === "active" && (
            <p className="text-xs text-[var(--text-secondary)]">
              <CalendarClock
                className="mr-1 inline size-3.5"
                aria-hidden="true"
              />
              Thay đổi số tiền mục tiêu hoặc thời hạn sẽ tự động tính lại mục
              tiêu tiết kiệm tháng này.
            </p>
          )}
        </div>
        <SheetFooter
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

function FundingSheet({
  open,
  goal,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  goal: FinancialGoalView;
  onOpenChange: (open: boolean) => void;
  onSaved: (status: "pending" | "approved" | "rejected") => void;
}) {
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    desktopSnapshot,
    serverDesktopSnapshot,
  );
  const [amount, setAmount] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const valid = useMemo(() => {
    try {
      return (
        new Decimal(amount || 0).greaterThan(0) && Boolean(effectiveDate)
      );
    } catch {
      return false;
    }
  }, [amount, effectiveDate]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        placement={isDesktop ? "inset" : "edge"}
        size={isDesktop ? "wide" : "default"}
        spacing="flush"
        elevation="flat"
      >
        <SheetHeader
          icon={CircleDollarSign}
          title="Ghi nhận đóng góp"
          description={`Mục tiêu ${goal.name}. Khoản đóng góp của thành viên sẽ được cộng vào tiến độ sau khi Quản trị viên duyệt.`}
        />
        <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-4 py-5 md:px-6">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-[color-mix(in_srgb,var(--destructive)_30%,var(--border))] bg-[color-mix(in_srgb,var(--destructive)_10%,var(--surface))] p-3 text-sm text-[var(--destructive)]"
            >
              {error}
            </div>
          )}
          <MoneyInput
            label="Số tiền đóng góp"
            required
            value={amount}
            onValueChange={setAmount}
          />
          <DatePicker
            label="Ngày ghi nhận"
            required
            value={effectiveDate}
            onValueChange={setEffectiveDate}
          />
          <Input
            label="Ghi chú (Không bắt buộc)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ví dụ: Trích thưởng tháng này"
          />
        </div>
        <SheetFooter
          onCancel={() => onOpenChange(false)}
          cancelLabel="Hủy"
          submitLabel="Ghi nhận đóng góp"
          isSubmitting={pending}
          submittingLabel="Đang gửi..."
          submitDisabled={pending || !valid}
          onSubmit={() =>
            startTransition(async () => {
              setError(null);
              const result = await createFinancialGoalFundingAction({
                goalId: goal.id,
                amount,
                effectiveDate,
                note,
              });
              if (!result.ok)
                return setError(
                  result.message || "Không thể ghi nhận khoản đóng góp.",
                );
              onSaved(result.status);
            })
          }
          submitType="button"
        />
      </SheetContent>
    </Sheet>
  );
}

