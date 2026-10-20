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
  cancelFinancialPlanGoalAction,
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
import { usePrivacyMask } from "@/lib/privacy-mask";
import { cn } from "@/lib/utils";

type DeviceTier = "mobile" | "tablet" | "desktop";

function subscribeDeviceTier(callback: () => void) {
  const tabletQuery = window.matchMedia("(min-width: 768px)");
  const desktopQuery = window.matchMedia("(min-width: 1024px)");
  tabletQuery.addEventListener("change", callback);
  desktopQuery.addEventListener("change", callback);
  return () => {
    tabletQuery.removeEventListener("change", callback);
    desktopQuery.removeEventListener("change", callback);
  };
}

function getDeviceTierSnapshot(): DeviceTier {
  if (window.matchMedia("(min-width: 1024px)").matches) return "desktop";
  if (window.matchMedia("(min-width: 768px)").matches) return "tablet";
  return "mobile";
}

function getServerDeviceTierSnapshot(): DeviceTier {
  return "desktop";
}

function getGoalSheetPresentation(
  device: DeviceTier,
  variant: "compact" | "form" | "detail" = "form",
): {
  side: "bottom" | "center" | "right";
  placement: "edge" | "inset";
  size: "default" | "sm" | "md" | "lg" | "wide";
  className?: string;
} {
  if (device === "mobile") {
    return {
      side: "bottom",
      placement: "edge",
      size: "default",
    };
  }
  if (device === "tablet") {
    const maxWidthClass =
      variant === "compact"
        ? "max-w-[30rem]"
        : variant === "form"
          ? "max-w-[36rem]"
          : "max-w-[38rem]";
    return {
      side: "center",
      placement: "inset",
      size: "lg",
      className: cn(
        "w-[calc(100%-2.5rem)] !h-auto max-h-[85dvh] rounded-2xl",
        maxWidthClass,
      ),
    };
  }
  const desktopWidthClass =
    variant === "compact"
      ? "lg:max-w-[28rem]"
      : variant === "form"
        ? "lg:max-w-[34rem]"
        : "lg:max-w-[36rem]";
  return {
    side: "right",
    placement: "inset",
    size: "wide",
    className: desktopWidthClass,
  };
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

const ENTRY_KIND_LABELS: Record<
  FinancialGoalView["fundingEntries"][number]["kind"],
  string
> = {
  opening: "Số dư ban đầu",
  contribution: "Đóng góp",
  withdrawal: "Rút ra",
  adjustment: "Điều chỉnh",
  reversal: "Hoàn tác",
};

function money(value: string, currency: string) {
  return `${formatAmount(value)} ${currency === "VND" ? "₫" : currency}`;
}

function monthLabel(month: string) {
  const [year, value] = month.split("-");
  return `Tháng ${Number(value)}/${year}`;
}

function formatViDate(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function monthCountInclusive(startMonth: string, targetMonth: string): number {
  const [startYear, startValue] = startMonth.split("-").map(Number);
  const [targetYear, targetValue] = targetMonth.split("-").map(Number);
  if (
    !startYear ||
    !startValue ||
    !targetYear ||
    !targetValue ||
    targetMonth < startMonth
  ) {
    return 1;
  }
  return Math.max(
    (targetYear - startYear) * 12 + (targetValue - startValue) + 1,
    1,
  );
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
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
  usePrivacyMask();
  const router = useRouter();
  const device = useSyncExternalStore(
    subscribeDeviceTier,
    getDeviceTierSnapshot,
    getServerDeviceTierSnapshot,
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
    <section className="grid gap-3.5" aria-labelledby="financial-goals-title">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <h2
            id="financial-goals-title"
            className="break-words text-sm font-semibold leading-snug text-[var(--foreground)] md:text-base"
          >
            Mục tiêu tích lũy ({goals.length})
          </h2>
          <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-secondary)]">
            Ưu tiên phân bổ từ trên xuống hoặc theo dõi theo số dư ví liên kết.
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
            "grid grid-cols-1 gap-3.5",
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
              canManage &&
              mutable &&
              (goal.status === "active" || goal.status === "draft");
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
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--primary)]"
                      aria-hidden="true"
                    >
                      {goal.trackingMode === "linked_wallet" ? (
                        <WalletCards className="size-4" />
                      ) : (
                        <Target className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {goals.length > 1 && (
                          <span className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-secondary)] tabular-nums">
                            #{index + 1}
                          </span>
                        )}
                        <CardTitle className="min-w-0 break-words text-sm font-bold leading-snug md:text-base">
                          {goal.name}
                        </CardTitle>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[10px] font-semibold sm:text-[11px]",
                            goal.status === "cancelled"
                              ? "bg-[var(--surface-secondary)] text-[var(--text-secondary)]"
                              : HEALTH[goal.health].className,
                          )}
                        >
                          {goal.status === "cancelled"
                            ? "Đã hủy"
                            : HEALTH[goal.health].label}
                        </span>
                      </div>
                      <CardDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-snug sm:text-xs">
                        <span className="shrink-0">
                          Hạn {monthLabel(goal.targetMonth)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="min-w-0 break-words">
                          {goal.linkedWallet
                            ? `Ví: ${goal.linkedWallet.name}`
                            : "Đóng góp thủ công"}
                        </span>
                      </CardDescription>
                    </div>
                  </div>

                  {/* Quick Action Cluster (visible on all screens) */}
                  <CardAction
                    className="flex shrink-0 items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/60 p-0.5">
                      {goal.status === "active" &&
                        goal.trackingMode === "manual" && (
                          <Button
                            variant="selected"
                            size="icon"
                            onClick={() => setFundingGoal(goal)}
                            disabled={pending}
                            aria-label={`Ghi nhận đóng góp ${goal.name}`}
                            title="Ghi nhận đóng góp"
                            className="size-7 sm:size-8"
                          >
                            <CircleDollarSign className="size-3.5 sm:size-4" aria-hidden="true" />
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
                            className="size-7 sm:size-8"
                          >
                            <History className="size-3.5 sm:size-4" aria-hidden="true" />
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
                          className="size-7 sm:size-8"
                        >
                          <Check className="size-3.5 sm:size-4" aria-hidden="true" />
                        </Button>
                      )}
                      {hasManageActions && (
                        <>
                          {goals.length > 1 && (
                            <div className="hidden items-center gap-0.5 md:flex">
                              <Button
                                variant="icon"
                                size="icon"
                                onClick={() => move(index, -1)}
                                disabled={pending || index === 0}
                                aria-label={`Tăng ưu tiên ${goal.name}`}
                                title="Tăng mức ưu tiên"
                                className="size-7 sm:size-8"
                              >
                                <ArrowUp className="size-3.5 sm:size-4" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="icon"
                                size="icon"
                                onClick={() => move(index, 1)}
                                disabled={pending || index === goals.length - 1}
                                aria-label={`Giảm ưu tiên ${goal.name}`}
                                title="Giảm mức ưu tiên"
                                className="size-7 sm:size-8"
                              >
                                <ArrowDown className="size-3.5 sm:size-4" aria-hidden="true" />
                              </Button>
                            </div>
                          )}
                          <Button
                            variant="icon"
                            size="icon"
                            onClick={() => setEditor(goal)}
                            disabled={pending}
                            aria-label={`Sửa mục tiêu ${goal.name}`}
                            title="Chỉnh sửa mục tiêu"
                            className="size-7 sm:size-8"
                          >
                            <Pencil className="size-3.5 sm:size-4" aria-hidden="true" />
                          </Button>
                        </>
                      )}
                      {canManage &&
                        (goal.status === "active" ||
                          (goal.status === "draft" && goals.length > 1)) && (
                          <Button
                            variant="destructiveIcon"
                            size="icon"
                            onClick={() => setCancellingGoal(goal)}
                            disabled={pending}
                            aria-label={
                              goal.status === "draft"
                                ? `Xóa mục tiêu ${goal.name}`
                                : `Hủy mục tiêu ${goal.name}`
                            }
                            title={
                              goal.status === "draft"
                                ? "Xóa mục tiêu"
                                : "Hủy mục tiêu"
                            }
                            className="size-7 sm:size-8"
                          >
                            <Trash2 className="size-3.5 sm:size-4" aria-hidden="true" />
                          </Button>
                        )}
                    </div>
                  </CardAction>
                </CardHeader>

                <CardContent className="grid gap-3 pt-0">
                  {/* Saved vs Target + Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <strong className="text-base font-bold text-[var(--foreground)] tabular-nums shrink-0">
                          {money(goal.actualProgress, currency)}
                        </strong>
                        <span className="ml-1.5 text-xs text-[var(--text-muted)] tabular-nums shrink-0">
                          / {money(goal.targetAmount, currency)}
                        </span>
                      </div>
                      <span className="rounded-md bg-[var(--primary-soft)] px-2 py-0.5 text-xs font-bold text-[var(--primary)] tabular-nums shrink-0">
                        {goal.progressPercentage}%
                      </span>
                    </div>

                    <div
                      role="progressbar"
                      aria-label={`Tiến độ mục tiêu ${goal.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(progressPct)}
                      className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-secondary)]"
                    >
                      <div
                        className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-300 motion-reduce:transition-none"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Key Monthly Metrics: 2-column compact strip */}
                  <dl className="grid grid-cols-2 gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/60 p-2.5">
                    <div className="min-w-0">
                      <dt className="break-words text-[11px] leading-snug text-[var(--text-secondary)]">
                        Cần tiết kiệm tháng này
                      </dt>
                      <dd className="mt-0.5 text-xs font-bold text-[var(--foreground)] tabular-nums shrink-0 sm:text-sm">
                        {money(goal.requiredThisMonth, currency)}
                      </dd>
                    </div>

                    {shortfall ? (
                      <div className="min-w-0">
                        <dt className="break-words text-[11px] font-medium leading-snug text-[var(--warning)]">
                          Cần bù thêm
                        </dt>
                        <dd className="mt-0.5 text-xs font-bold text-[var(--warning)] tabular-nums shrink-0 sm:text-sm">
                          {money(goal.shortfallThisMonth, currency)}
                        </dd>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <dt className="break-words text-[11px] leading-snug text-[var(--text-secondary)]">
                          Dự kiến khi đến hạn
                        </dt>
                        <dd
                          className={cn(
                            "mt-0.5 text-xs font-bold tabular-nums shrink-0 sm:text-sm",
                            goal.status !== "cancelled" &&
                              (goal.health === "at_risk" ||
                                goal.health === "overdue")
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
              if (nextOpen && device === "desktop") {
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
                  {hasManageActions && (
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
                  {hasManageActions && index > 0 && (
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
                  {hasManageActions && index < goals.length - 1 && (
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
                  {canManage &&
                    (goal.status === "active" ||
                      (goal.status === "draft" && goals.length > 1)) && (
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
                          <span>
                            {goal.status === "draft"
                              ? "Xóa mục tiêu"
                              : "Hủy mục tiêu"}
                          </span>
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
          device={device}
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
          currency={currency}
          device={device}
          onOpenChange={(open) => {
            if (!open) setFundingGoal(null);
          }}
          onSaved={(status) => {
            setFundingGoal(null);
            toast.success(
              status === "pending"
                ? "Đã gửi khoản đóng góp chờ duyệt."
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
          goal={goals.find((g) => g.id === historyGoal.id) ?? historyGoal}
          currency={currency}
          device={device}
          pending={pending}
          canManage={canManage}
          mutable={mutable}
          run={run}
          onAddFunding={() => {
            setFundingGoal(
              goals.find((g) => g.id === historyGoal.id) ?? historyGoal,
            );
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
        title={
          cancellingGoal?.status === "draft"
            ? "Xóa mục tiêu tích lũy?"
            : "Hủy mục tiêu tích lũy?"
        }
        description={
          cancellingGoal?.status === "draft"
            ? "Mục tiêu sẽ bị xóa khỏi bản nháp kế hoạch."
            : "Mục tiêu sẽ ngừng theo dõi. Số tiền đã tích lũy và lịch sử đóng góp vẫn được giữ nguyên."
        }
        confirmLabel={
          cancellingGoal?.status === "draft" ? "Xóa mục tiêu" : "Hủy mục tiêu"
        }
        ariaLabel={
          cancellingGoal
            ? `${cancellingGoal.status === "draft" ? "Xóa" : "Hủy"} mục tiêu ${cancellingGoal.name}`
            : "Hủy mục tiêu"
        }
        onConfirm={() => {
          if (!cancellingGoal) return;
          const isDraftGoal = cancellingGoal.status === "draft";
          run(
            () => cancelFinancialPlanGoalAction(cancellingGoal.id),
            isDraftGoal ? "Đã xóa mục tiêu." : "Đã hủy mục tiêu.",
          );
          setCancellingGoal(null);
        }}
        disabled={pending}
        presentation={device === "mobile" ? "sheet" : "popover"}
      />
    </section>
  );
}

function GoalFundingHistorySheet({
  open,
  onOpenChange,
  goal,
  currency,
  device,
  pending,
  canManage,
  mutable,
  run,
  onAddFunding,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: FinancialGoalView;
  currency: string;
  device: DeviceTier;
  pending: boolean;
  canManage: boolean;
  mutable: boolean;
  run: (
    action: () => Promise<{ ok: boolean; message?: string | null }>,
    success: string,
    after?: () => void,
  ) => void;
  onAddFunding?: () => void;
}) {
  const sheetProps = getGoalSheetPresentation(device, "detail");
  const isMobile = device === "mobile";
  const canMutateGoalFunding =
    canManage &&
    mutable &&
    (goal.status === "active" || goal.status === "draft");
  const remainingGoalAmount = Decimal.max(
    new Decimal(goal.targetAmount || 0).minus(goal.actualProgress || 0),
    0,
  ).toFixed(0);

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
          icon={History}
          title="Lịch sử đóng góp"
          description={`Mục tiêu ${goal.name} · Hạn ${monthLabel(goal.targetMonth)}`}
        />
        <div
          className={cn(
            "grid min-h-0 flex-1 content-start overflow-y-auto",
            isMobile ? "gap-3.5 px-4 py-4" : "gap-4 px-5 py-5 lg:px-6",
          )}
        >
          {/* Goal Progress Summary Strip */}
          <dl
            className={cn(
              "grid gap-2.5",
              isMobile ? "grid-cols-2" : "grid-cols-3",
            )}
          >
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
              <dt className="text-[11px] text-[var(--text-secondary)]">
                Đã tích lũy ({goal.progressPercentage}%)
              </dt>
              <dd className="mt-1 text-sm font-bold text-[var(--foreground)] tabular-nums sm:text-base">
                {money(goal.actualProgress, currency)}
              </dd>
            </div>
            {!isMobile && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
                <dt className="text-[11px] text-[var(--text-secondary)]">
                  Mục tiêu
                </dt>
                <dd className="mt-1 text-sm font-bold text-[var(--foreground)] tabular-nums sm:text-base">
                  {money(goal.targetAmount, currency)}
                </dd>
              </div>
            )}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
              <dt className="text-[11px] text-[var(--text-secondary)]">
                Còn cần tích lũy
              </dt>
              <dd className="mt-1 text-sm font-bold text-[var(--primary)] tabular-nums sm:text-base">
                {money(remainingGoalAmount, currency)}
              </dd>
            </div>
          </dl>

          {goal.fundingEntries.length === 0 ? (
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 py-8 text-center text-sm text-[var(--text-muted)]">
              Chưa có khoản đóng góp nào được ghi nhận.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5">
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
                      <span className="rounded-md bg-[var(--surface-secondary)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] shrink-0">
                        {ENTRY_KIND_LABELS[entry.kind] ?? "Đóng góp"}
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
                      {formatViDate(entry.effectiveDate)} · Người gửi:{" "}
                      {entry.requester}
                      {entry.reviewer ? ` · Người duyệt: ${entry.reviewer}` : ""}
                      {entry.note ? ` · Ghi chú: ${entry.note}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 pt-1 sm:pt-0">
                    {canMutateGoalFunding && entry.status === "pending" && (
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
                    {canMutateGoalFunding &&
                      entry.status === "approved" &&
                      entry.kind !== "reversal" &&
                      !goal.fundingEntries.some(
                        (e) => e.reversesEntryId === entry.id,
                      ) && (
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
            mutable && goal.status === "active"
              ? "+ Ghi nhận đóng góp"
              : undefined
          }
          onSubmit={
            mutable && goal.status === "active" && onAddFunding
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
  device,
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
  device: DeviceTier;
  onSaved: () => void;
}) {
  const sheetProps = getGoalSheetPresentation(device, "form");
  const isMobile = device === "mobile";
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

  const selectedWalletBalance = useMemo(() => {
    if (trackingMode !== "linked_wallet" || !walletId) return "0";
    return wallets.find((w) => w.id === walletId)?.balance ?? "0";
  }, [trackingMode, walletId, wallets]);

  const currentProgressDecimal = useMemo(() => {
    try {
      if (trackingMode === "linked_wallet") {
        return Decimal.max(new Decimal(selectedWalletBalance || 0), 0);
      }
      if (goal) {
        return Decimal.max(new Decimal(goal.actualProgress || 0), 0);
      }
      return Decimal.max(new Decimal(existingAmount || 0), 0);
    } catch {
      return new Decimal(0);
    }
  }, [trackingMode, selectedWalletBalance, goal, existingAmount]);

  const estimatedMonthly = useMemo(() => {
    try {
      const targetDec = Decimal.max(new Decimal(targetAmount || 0), 0);
      const remaining = Decimal.max(targetDec.minus(currentProgressDecimal), 0);
      const months = monthCountInclusive(businessMonth, targetMonth);
      return {
        months,
        remaining: remaining.toFixed(0),
        monthly: remaining.dividedToIntegerBy(months).toFixed(0),
      };
    } catch {
      return { months: 1, remaining: "0", monthly: "0" };
    }
  }, [targetAmount, currentProgressDecimal, businessMonth, targetMonth]);

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

  const showSecondarySourceField =
    trackingMode === "linked_wallet" || !goal;

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
          icon={Target}
          title={goal ? "Chỉnh sửa mục tiêu tích lũy" : "Thêm mục tiêu tích lũy"}
          description="Chọn số tiền mục tiêu, thời hạn và cách theo dõi."
        />
        <div
          className={cn(
            "grid min-h-0 flex-1 content-start overflow-y-auto",
            isMobile ? "gap-4 px-4 py-4" : "gap-5 px-5 py-5 lg:px-6",
          )}
        >
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
          <div
            className={cn(
              "grid gap-4",
              !isMobile && "grid-cols-2",
            )}
          >
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

          <div
            className={cn(
              "grid gap-4",
              !isMobile && showSecondarySourceField && "grid-cols-2",
            )}
          >
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
                  label: "Tự ghi nhận đóng góp",
                  content: (
                    <>
                      <ListChecks aria-hidden="true" /> Tự ghi nhận đóng góp
                    </>
                  ),
                },
                {
                  value: "linked_wallet",
                  label: "Theo số dư ví liên kết",
                  content: (
                    <>
                      <Link2 aria-hidden="true" /> Theo số dư ví liên kết
                    </>
                  ),
                },
              ]}
            />
            {trackingMode === "linked_wallet" ? (
              <Select
                label="Ví liên kết"
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
                label="Số tiền đã có sẵn"
                value={existingAmount}
                onValueChange={setExistingAmount}
              />
            ) : null}
          </div>

          {/* Live Monthly Savings Requirement Preview */}
          <div
            className="grid gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5 text-xs"
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[var(--text-secondary)]">
                Cần tiết kiệm dự kiến ({estimatedMonthly.months} tháng)
              </span>
              <strong className="text-sm font-bold text-[var(--foreground)] tabular-nums shrink-0">
                ~ {money(estimatedMonthly.monthly, currency)} / tháng
              </strong>
            </div>
            <p className="text-[11px] leading-5 text-[var(--text-muted)]">
              Còn cần tích lũy thêm {money(estimatedMonthly.remaining, currency)}{" "}
              đến {monthLabel(targetMonth)}.
            </p>
          </div>

          {lockedSource && (
            <p className="text-xs text-[var(--text-secondary)]">
              Không thể đổi cách theo dõi sau khi kế hoạch đã bắt đầu chạy.
            </p>
          )}
          {planStatus === "active" && (
            <p className="text-xs text-[var(--text-secondary)]">
              <CalendarClock
                className="mr-1 inline size-3.5"
                aria-hidden="true"
              />
              Khi đổi số tiền hoặc thời hạn, mức tiết kiệm hàng tháng sẽ tự động
              tính lại.
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
  currency,
  device,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  goal: FinancialGoalView;
  currency: string;
  device: DeviceTier;
  onOpenChange: (open: boolean) => void;
  onSaved: (status: "pending" | "approved" | "rejected") => void;
}) {
  const sheetProps = getGoalSheetPresentation(device, "compact");
  const isMobile = device === "mobile";
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

  const remainingGoalAmount = useMemo(
    () =>
      Decimal.max(
        new Decimal(goal.targetAmount || 0).minus(goal.actualProgress || 0),
        0,
      ).toFixed(0),
    [goal.targetAmount, goal.actualProgress],
  );

  const quickFillPresets = useMemo(() => {
    const items: Array<{ label: string; value: string }> = [];
    const reqDec = new Decimal(goal.requiredThisMonth || 0);
    const shortDec = new Decimal(goal.shortfallThisMonth || 0);
    const remDec = new Decimal(remainingGoalAmount || 0);

    if (reqDec.greaterThan(0)) {
      items.push({
        label: `Định mức tháng (${money(reqDec.toFixed(0), currency)})`,
        value: reqDec.toFixed(0),
      });
    }
    if (shortDec.greaterThan(0) && !shortDec.equals(reqDec)) {
      items.push({
        label: `Bù thiếu tháng (${money(shortDec.toFixed(0), currency)})`,
        value: shortDec.toFixed(0),
      });
    }
    if (
      remDec.greaterThan(0) &&
      !remDec.equals(reqDec) &&
      !remDec.equals(shortDec)
    ) {
      items.push({
        label: `Đủ mục tiêu (${money(remDec.toFixed(0), currency)})`,
        value: remDec.toFixed(0),
      });
    }
    return items;
  }, [goal.requiredThisMonth, goal.shortfallThisMonth, remainingGoalAmount, currency]);

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
          icon={CircleDollarSign}
          title="Ghi nhận đóng góp"
          description={`Cập nhật số tiền tích lũy cho mục tiêu ${goal.name}.`}
        />
        <div
          className={cn(
            "grid min-h-0 flex-1 content-start overflow-y-auto",
            isMobile ? "gap-4 px-4 py-4" : "gap-4.5 px-5 py-5 lg:px-6",
          )}
        >
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-[color-mix(in_srgb,var(--destructive)_30%,var(--border))] bg-[color-mix(in_srgb,var(--destructive)_10%,var(--surface))] p-3 text-sm text-[var(--destructive)]"
            >
              {error}
            </div>
          )}

          {/* Goal Context & Quick-Fill Strip */}
          <div className="grid gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 tabular-nums">
              <span className="text-[var(--text-secondary)]">
                Đã tích lũy:{" "}
                <strong className="font-semibold text-[var(--foreground)]">
                  {money(goal.actualProgress, currency)}
                </strong>{" "}
                / {money(goal.targetAmount, currency)} ({goal.progressPercentage}
                %)
              </span>
              <span className="font-semibold text-[var(--primary)]">
                Còn thiếu: {money(remainingGoalAmount, currency)}
              </span>
            </div>

            {quickFillPresets.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border)] pt-2">
                {quickFillPresets.map((preset) => {
                  const selected = amount === preset.value;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setAmount(preset.value)}
                      className={cn(
                        "rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors tabular-nums",
                        selected
                          ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--foreground)]",
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div
            className={cn(
              "grid gap-4",
              !isMobile && "grid-cols-2",
            )}
          >
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
          </div>
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


