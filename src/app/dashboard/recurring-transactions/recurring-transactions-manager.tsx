"use client";

import Decimal from "decimal.js";
import {
  createRecurringTransactionAction,
  deleteRecurringTransactionAction,
  reviewRecurringTransactionAction,
  runRecurringTransactionNowAction,
  setRecurringTransactionStatusAction,
  updateRecurringTransactionAction,
} from "@/app/dashboard/recurring-transactions/actions";
import {
  Button,
  Card,
  CategoryTreeSelect,
  DatePicker,
  Empty,
  Input,
  MoneyInput,
  Select,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/base";
import { ConfirmDelete } from "@/components/base/confirm-delete";
import { ApprovalActionIcon } from "@/components/approval-action-icon";
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
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat2,
  Trash2,
} from "lucide-react";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { usePrivacyMask } from "@/lib/privacy-mask";

type Option = {
  id: string;
  name: string;
  color?: string;
  icon?: string | null;
  parentId?: string | null;
};
type CategoryOption = Option & { type: "income" | "expense" };
type TransactionType = "income" | "expense" | "transfer";
type ScheduleStatusFilter =
  | "all"
  | "income"
  | "expense"
  | "active"
  | "deactive"
  | "completed";
type Schedule = {
  id: string;
  createdByMemberId: string;
  approvalStatus: "pending" | "approved" | "rejected";
  approvedAt: string | null;
  walletId: string;
  toWalletId: string | null;
  categoryId: string | null;
  type: TransactionType;
  amount: string;
  description: string | null;
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  nextExecutionDate: string;
  status: "active" | "deactive";
  completedAt: string | null;
  lastError: string | null;
  wallet: string;
  toWallet: string | null;
  category: { name: string; color: string } | null;
  createdBy: string;
  occurrenceCount: number;
};
type Draft = {
  description: string;
  type: TransactionType;
  categoryId: string;
  walletId: string;
  toWalletId: string;
  amount: string;
  startDate: string;
  endDate: string;
};

function subscribeMobile(callback: () => void) {
  const query = window.matchMedia("(max-width: 767px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function mobileSnapshot() {
  return window.matchMedia("(max-width: 767px)").matches;
}

function serverMobileSnapshot() {
  return false;
}

const typeOptions = [
  {
    value: "expense",
    label: "Chi tiêu",
    tabLabel: "Chi tiêu",
    icon: ArrowUpRight,
  },
  {
    value: "income",
    label: "Thu nhập",
    tabLabel: "Thu nhập",
    icon: ArrowDownLeft,
  },
  {
    value: "transfer",
    label: "Chuyển khoản",
    tabLabel: "Chuyển khoản",
    icon: ArrowLeftRight,
  },
] as const;

function defaultDestination(wallets: Option[], sourceId: string) {
  return wallets.find((wallet) => wallet.id !== sourceId)?.id ?? sourceId;
}

function categoriesForTransactionType(
  categories: CategoryOption[],
  type: TransactionType,
): CategoryOption[] {
  return type === "transfer"
    ? []
    : categories.filter((category) => category.type === type);
}

function emptyDraft(
  wallets: Option[],
  categories: CategoryOption[],
  businessDate: string,
): Draft {
  const walletId = wallets[0]?.id ?? "";
  return {
    description: "",
    type: "expense",
    categoryId:
      categoriesForTransactionType(categories, "expense")[0]?.id ?? "none",
    walletId,
    toWalletId: defaultDestination(wallets, walletId),
    amount: "",
    startDate: businessDate,
    endDate: "",
  };
}

function scheduleDraft(schedule: Schedule, wallets: Option[]): Draft {
  return {
    description: schedule.description ?? "",
    type: schedule.type,
    categoryId: schedule.categoryId ?? "none",
    walletId: schedule.walletId,
    toWalletId:
      schedule.toWalletId ?? defaultDestination(wallets, schedule.walletId),
    amount: schedule.amount,
    startDate: schedule.startDate,
    endDate: schedule.endDate ?? "",
  };
}

function actionInput(draft: Draft) {
  return {
    description: draft.description || undefined,
    type: draft.type,
    categoryId: draft.categoryId === "none" ? undefined : draft.categoryId,
    walletId: draft.walletId,
    toWalletId: draft.type === "transfer" ? draft.toWalletId : undefined,
    amount: draft.amount,
    startDate: draft.startDate,
    endDate: draft.endDate || undefined,
  };
}

function dateLabel(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function scheduleDayLabel(day: number) {
  return day <= 28
    ? `Hằng tháng (ngày ${day})`
    : `Hằng tháng (ngày ${day} · cuối tháng nếu thiếu ngày)`;
}

function daysBetweenIsoDates(fromDate: string, toDate: string): number {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 999;
  return Math.round((to - from) / 86_400_000);
}

export function RecurringTransactionsManager({
  currentMemberId,
  canCreate,
  canApprove,
  workspace,
  wallets,
  categories,
  activeMonthlyNetAmount,
  schedules,
}: {
  currentMemberId: string;
  canCreate: boolean;
  canApprove: boolean;
  workspace: {
    id: string;
    name: string;
    currency: string;
    timeZone: string;
    businessDate: string;
  };
  wallets: Option[];
  categories: CategoryOption[];
  activeMonthlyNetAmount: string;
  schedules: Schedule[];
}) {
  usePrivacyMask();
  const [status, setStatus] = useState<ScheduleStatusFilter>("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const isMobile = useSyncExternalStore(
    subscribeMobile,
    mobileSnapshot,
    serverMobileSnapshot,
  );
  const [busy, startTransition] = useTransition();

  const monthlyNetAmount = new Decimal(activeMonthlyNetAmount || "0");
  const currencySymbol =
    workspace.currency === "VND" ? "₫" : workspace.currency;

  const activeSchedules = useMemo(
    () =>
      schedules.filter(
        (item) =>
          item.approvalStatus === "approved" &&
          !item.completedAt &&
          item.status === "active",
      ),
    [schedules],
  );

  const monthlyIncomeTotal = useMemo(
    () =>
      activeSchedules
        .filter((item) => item.type === "income")
        .reduce((sum, item) => sum.plus(item.amount), new Decimal(0)),
    [activeSchedules],
  );

  const monthlyExpenseTotal = useMemo(
    () =>
      activeSchedules
        .filter((item) => item.type === "expense")
        .reduce((sum, item) => sum.plus(item.amount), new Decimal(0)),
    [activeSchedules],
  );

  const upcomingActiveSchedules = useMemo(
    () =>
      [...activeSchedules].sort((a, b) =>
        a.nextExecutionDate.localeCompare(b.nextExecutionDate),
      ),
    [activeSchedules],
  );

  const dueSoonSchedules = useMemo(
    () =>
      upcomingActiveSchedules.filter((item) => {
        const diff = daysBetweenIsoDates(
          workspace.businessDate,
          item.nextExecutionDate,
        );
        return diff >= 0 && diff <= 7;
      }),
    [upcomingActiveSchedules, workspace.businessDate],
  );

  const activeCount = activeSchedules.length;
  const pausedCount = schedules.filter(
    (item) =>
      item.approvalStatus === "approved" &&
      !item.completedAt &&
      item.status === "deactive",
  ).length;
  const completedCount = schedules.filter(
    (item) => item.approvalStatus === "approved" && Boolean(item.completedAt),
  ).length;
  const incomeCount = schedules.filter((item) => item.type === "income").length;
  const expenseCount = schedules.filter(
    (item) => item.type === "expense",
  ).length;
  const errorCount = schedules.filter((item) => Boolean(item.lastError)).length;
  const pendingApprovalCount = schedules.filter(
    (item) => item.approvalStatus === "pending",
  ).length;
  const attentionCount = errorCount + pendingApprovalCount;

  const visibleSchedules = useMemo(
    () =>
      schedules.filter((item) => {
        if (status === "all") return true;
        if (status === "income") return item.type === "income";
        if (status === "expense") return item.type === "expense";
        const displayStatus =
          item.approvalStatus === "approved"
            ? item.completedAt
              ? "completed"
              : item.status
            : item.approvalStatus;
        return displayStatus === status;
      }),
    [schedules, status],
  );

  function beginCreate() {
    setEditingId(null);
    setDraft(emptyDraft(wallets, categories, workspace.businessDate));
  }

  function beginEdit(schedule: Schedule) {
    setEditingId(schedule.id);
    setDraft(scheduleDraft(schedule, wallets));
  }

  function closeEditor() {
    setDraft(null);
    setEditingId(null);
  }

  function save() {
    if (!draft) return;
    startTransition(async () => {
      const result = editingId
        ? await updateRecurringTransactionAction(editingId, actionInput(draft))
        : await createRecurringTransactionAction(actionInput(draft));
      if (result.ok) {
        toast.success(
          editingId
            ? canApprove
              ? "Đã cập nhật giao dịch định kỳ."
              : "Đã gửi thay đổi để Quản trị viên duyệt."
            : canApprove
              ? "Đã đăng ký giao dịch định kỳ."
              : "Đã gửi lịch để Quản trị viên duyệt.",
        );
        closeEditor();
      } else {
        toast.error(result.message);
      }
    });
  }

  function toggleStatus(schedule: Schedule) {
    const nextStatus = schedule.status === "active" ? "deactive" : "active";
    startTransition(async () => {
      const result = await setRecurringTransactionStatusAction(
        schedule.id,
        nextStatus,
      );
      if (result.ok) {
        toast.success(
          result.approvalStatus === "pending"
            ? "Đã gửi yêu cầu kích hoạt lại."
            : nextStatus === "active"
              ? "Đã bật lại giao dịch định kỳ."
              : "Đã tạm dừng giao dịch định kỳ.",
        );
      } else {
        toast.error(result.message);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteRecurringTransactionAction(id);
      if (result.ok) {
        toast.success(
          "Đã xóa đăng ký. Các giao dịch đã phát sinh được giữ nguyên.",
        );
      } else {
        toast.error(result.message);
      }
    });
  }

  function review(id: string, approve: boolean) {
    startTransition(async () => {
      const result = await reviewRecurringTransactionAction(id, approve);
      if (result.ok) {
        toast.success(
          approve
            ? "Đã duyệt và kích hoạt giao dịch định kỳ."
            : "Đã từ chối giao dịch định kỳ.",
        );
      } else {
        toast.error(result.message);
      }
    });
  }

  function runNow(schedule: Schedule) {
    startTransition(async () => {
      const result = await runRecurringTransactionNowAction(schedule.id);
      if (result.ok) {
        toast.success("Đã thực hiện kỳ này ngay.");
      } else {
        toast.error(result.message);
      }
    });
  }

  function permissions(schedule: Schedule) {
    const isOwner = schedule.createdByMemberId === currentMemberId;
    const canManageOwnApprovedSchedule = canApprove || isOwner;
    return {
      canApprove: canApprove && schedule.approvalStatus === "pending",
      canRunNow:
        !schedule.completedAt &&
        schedule.approvalStatus === "approved" &&
        schedule.status === "active" &&
        canManageOwnApprovedSchedule,
      canPause:
        !schedule.completedAt &&
        schedule.approvalStatus === "approved" &&
        schedule.status === "active" &&
        canManageOwnApprovedSchedule,
      canReactivate:
        !schedule.completedAt &&
        schedule.approvalStatus === "approved" &&
        schedule.status === "deactive" &&
        canManageOwnApprovedSchedule,
      canEdit:
        canApprove ||
        (isOwner &&
          !schedule.completedAt &&
          !(
            schedule.approvalStatus === "approved" &&
            schedule.status === "active"
          )),
      canDelete:
        canApprove ||
        (isOwner &&
          !schedule.approvedAt &&
          (schedule.approvalStatus === "pending" ||
            schedule.approvalStatus === "rejected")),
    };
  }

  const nextDueSchedule = upcomingActiveSchedules[0] ?? null;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 1. Unified Header + Top Summary Strip */}
      <Card
        as="section"
        className="p-4 md:p-5"
        aria-label="Tổng quan giao dịch định kỳ"
      >
        <div className="flex items-start justify-between gap-3 md:items-center md:border-b md:border-[var(--border)] md:pb-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 md:hidden">
              <span className="text-xs font-semibold text-[var(--primary)]">
                Chênh lệch thu chi định kỳ
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--surface-secondary)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                {activeCount} lịch đang bật
              </span>
            </div>

            <h1 className="sr-only md:not-sr-only md:text-lg md:font-semibold md:text-[var(--foreground)]">
              Giao dịch định kỳ
            </h1>
            <p className="mt-0.5 hidden text-xs text-[var(--text-secondary)] md:block">
              Tự động ghi nhận các khoản thu nhập, chi tiêu và chuyển khoản lặp lại hằng tháng.
            </p>

            <div className="mt-1 flex flex-wrap items-baseline gap-1.5 md:hidden">
              <strong
                className={cn(
                  "text-2xl font-bold tracking-tight tabular-nums",
                  monthlyNetAmount.gt(0)
                    ? "text-[var(--income)]"
                    : monthlyNetAmount.lt(0)
                      ? "text-[var(--expense)]"
                      : "text-[var(--foreground)]",
                )}
              >
                {monthlyNetAmount.gt(0) ? "+" : ""}
                {formatAmount(activeMonthlyNetAmount)} {currencySymbol}
              </strong>
              <span className="shrink-0 text-xs font-medium text-[var(--text-muted)]">
                / tháng
              </span>
            </div>
          </div>

          {canCreate && (
            <Button
              variant="default"
              size="sm"
              className="shrink-0 md:h-9 md:px-3.5"
              disabled={busy || Boolean(draft) || wallets.length === 0}
              onClick={beginCreate}
              aria-label="Thêm giao dịch định kỳ"
              title="Thêm giao dịch định kỳ"
            >
              <Plus size={15} aria-hidden="true" />
              <span className="md:hidden">Thêm lịch</span>
              <span className="hidden md:inline">Thêm giao dịch định kỳ</span>
            </Button>
          )}
        </div>

        {/* Mobile 2-Col Income/Expense Strip & Desktop 3-Col Summary Strip */}
        <div className="mt-3.5 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-3 md:mt-4 md:grid-cols-3 md:gap-5 md:divide-x md:divide-[var(--border)] md:border-t-0 md:pt-0">
          {/* Metric 1: Tổng thu định kỳ/tháng */}
          <div className="min-w-0 space-y-0.5 md:space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-[var(--text-muted)] md:text-xs md:text-[var(--text-secondary)]">
                Tổng thu định kỳ/tháng
              </span>
              <span
                className="hidden size-7 shrink-0 place-items-center rounded-lg bg-[var(--surface-secondary)] text-[var(--income)] md:grid"
                aria-hidden="true"
              >
                <ArrowDownLeft size={15} />
              </span>
            </div>
            <p className="text-sm font-bold tracking-tight tabular-nums text-[var(--income)] md:text-2xl">
              +{formatAmount(monthlyIncomeTotal.toString())} {currencySymbol}
            </p>
            <p className="hidden text-xs leading-snug text-[var(--text-muted)] md:block">
              Chênh lệch thu chi:{" "}
              <span className="font-semibold tabular-nums text-[var(--foreground)]">
                {monthlyNetAmount.isPositive() ? "+" : ""}
                {formatAmount(activeMonthlyNetAmount)} {currencySymbol}
              </span>
            </p>
          </div>

          {/* Metric 2: Tổng chi định kỳ/tháng */}
          <div className="min-w-0 space-y-0.5 border-l border-[var(--border)] pl-3 md:space-y-1 md:border-l-0 md:pl-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-[var(--text-muted)] md:text-xs md:text-[var(--text-secondary)]">
                Tổng chi định kỳ/tháng
              </span>
              <span
                className="hidden size-7 shrink-0 place-items-center rounded-lg bg-[var(--surface-secondary)] text-[var(--expense)] md:grid"
                aria-hidden="true"
              >
                <ArrowUpRight size={15} />
              </span>
            </div>
            <p className="text-sm font-bold tracking-tight tabular-nums text-[var(--expense)] md:text-2xl">
              −{formatAmount(monthlyExpenseTotal.toString())} {currencySymbol}
            </p>
            <p className="hidden text-xs leading-snug text-[var(--text-muted)] md:block">
              {activeCount > 0
                ? `${activeCount} lịch đang bật · ${pausedCount} tạm dừng`
                : "Chưa có lịch định kỳ đang bật"}
            </p>
          </div>

          {/* Metric 3: Sắp đến hạn (Desktop column) */}
          <div className="hidden min-w-0 space-y-1 md:block md:pl-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Sắp đến hạn
              </span>
              <span
                className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--surface-secondary)] text-[var(--primary)]"
                aria-hidden="true"
              >
                <CalendarClock size={15} />
              </span>
            </div>
            <p className="text-2xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
              {dueSoonSchedules.length > 0
                ? `${dueSoonSchedules.length} giao dịch`
                : nextDueSchedule
                  ? dateLabel(nextDueSchedule.nextExecutionDate)
                  : "Chưa có lịch"}
            </p>
            <p className="text-xs leading-snug text-[var(--text-muted)]">
              {attentionCount > 0 ? (
                <span className="font-medium text-[var(--warning)]">
                  {pendingApprovalCount > 0
                    ? `${pendingApprovalCount} lịch chờ duyệt`
                    : `${errorCount} lịch cần kiểm tra`}
                </span>
              ) : dueSoonSchedules.length > 0 && nextDueSchedule ? (
                `Kỳ gần nhất: ${dateLabel(nextDueSchedule.nextExecutionDate)}`
              ) : nextDueSchedule ? (
                `${nextDueSchedule.description || "Giao dịch định kỳ"} · Ngày ${nextDueSchedule.dayOfMonth} hằng tháng`
              ) : (
                `Ngày làm việc: ${dateLabel(workspace.businessDate)}`
              )}
            </p>
          </div>
        </div>

        {/* Mobile Compact Next Due Footer Strip (<768px) */}
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-secondary)] px-3 py-2 text-xs md:hidden">
          <div className="flex min-w-0 items-center gap-1.5 text-[var(--text-secondary)]">
            <CalendarClock
              size={14}
              className="shrink-0 text-[var(--primary)]"
              aria-hidden="true"
            />
            <span>
              {attentionCount > 0
                ? "Cần xử lý"
                : dueSoonSchedules.length > 0
                  ? "Sắp đến hạn (7 ngày)"
                  : "Kỳ tiếp theo"}
            </span>
          </div>
          <strong className="shrink-0 font-semibold tabular-nums text-[var(--foreground)]">
            {attentionCount > 0 ? (
              <span className="text-[var(--warning)]">
                {pendingApprovalCount > 0
                  ? `${pendingApprovalCount} lịch chờ duyệt`
                  : `${errorCount} lịch cần kiểm tra`}
              </span>
            ) : dueSoonSchedules.length > 0 && nextDueSchedule ? (
              `${dueSoonSchedules.length} lịch · ${dateLabel(nextDueSchedule.nextExecutionDate)}`
            ) : nextDueSchedule ? (
              `${nextDueSchedule.description || "Khoản định kỳ"} · ${dateLabel(nextDueSchedule.nextExecutionDate)}`
            ) : (
              "Chưa có lịch"
            )}
          </strong>
        </div>
      </Card>

      {/* 2. Filter Bar & Schedule List */}
      <section
        className="space-y-3.5 md:space-y-4"
        aria-labelledby="recurring-list-title"
      >
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <h2
              id="recurring-list-title"
              className="text-sm font-semibold text-[var(--foreground)] md:text-base"
            >
              Danh sách giao dịch định kỳ ({visibleSchedules.length})
            </h2>
            {pausedCount > 0 && (
              <span className="text-xs text-[var(--text-muted)] md:hidden">
                {activeCount} bật · {pausedCount} tạm dừng
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Primary Filter: All / Expense / Income */}
            <Tabs
              value={
                status === "all" || status === "expense" || status === "income"
                  ? status
                  : "all"
              }
              onValueChange={(value) => setStatus(value as ScheduleStatusFilter)}
              className="w-full md:w-auto"
            >
              <TabsList
                variant="segmented"
                aria-label="Lọc giao dịch định kỳ"
                className="grid w-full grid-cols-3 md:inline-flex md:w-auto"
              >
                <TabsTrigger variant="segmented" value="all" className="px-2 text-xs">
                  Tất cả ({schedules.length})
                </TabsTrigger>
                <TabsTrigger variant="segmented" value="expense" className="px-2 text-xs">
                  Chi tiêu ({expenseCount})
                </TabsTrigger>
                <TabsTrigger variant="segmented" value="income" className="px-2 text-xs">
                  Thu nhập ({incomeCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Secondary Status Filter: Only shown when paused or completed schedules exist */}
            {(pausedCount > 0 || completedCount > 0) && (
              <Tabs
                value={
                  status === "active" ||
                  status === "deactive" ||
                  status === "completed"
                    ? status
                    : "all"
                }
                onValueChange={(value) =>
                  setStatus(value as ScheduleStatusFilter)
                }
                className="w-full md:w-auto"
              >
                <TabsList
                  variant="segmented"
                  className={cn(
                    "grid w-full md:inline-flex md:w-auto",
                    completedCount > 0 ? "grid-cols-4" : "grid-cols-3",
                  )}
                >
                  <TabsTrigger variant="segmented" value="all" className="px-2 text-xs">
                    Tất cả
                  </TabsTrigger>
                  <TabsTrigger variant="segmented" value="active" className="px-2 text-xs">
                    Đang bật ({activeCount})
                  </TabsTrigger>
                  <TabsTrigger variant="segmented" value="deactive" className="px-2 text-xs">
                    Tạm dừng ({pausedCount})
                  </TabsTrigger>
                  {completedCount > 0 && (
                    <TabsTrigger
                      variant="segmented"
                      value="completed"
                      className="px-2 text-xs"
                    >
                      Kết thúc ({completedCount})
                    </TabsTrigger>
                  )}
                </TabsList>
              </Tabs>
            )}
          </div>
        </div>

        {/* Schedule Items */}
        {visibleSchedules.length === 0 ? (
          <Card className="p-6">
            <Empty
              icon={Repeat2}
              title={
                schedules.length
                  ? "Không có lịch định kỳ phù hợp"
                  : "Chưa có giao dịch định kỳ"
              }
              description={
                schedules.length
                  ? "Thử chọn bộ lọc khác để xem các khoản định kỳ còn lại."
                  : "Thiết lập khoản thu, chi hoặc chuyển khoản lặp lại để hệ thống tự động ghi nhận mỗi tháng."
              }
              action={
                canCreate && schedules.length === 0 ? (
                  <Button
                    variant="default"
                    disabled={busy || Boolean(draft) || wallets.length === 0}
                    onClick={beginCreate}
                  >
                    <Plus size={16} aria-hidden="true" />
                    <span>Thêm giao dịch định kỳ</span>
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div
            className="space-y-2.5 md:space-y-3"
            aria-label="Danh sách giao dịch định kỳ"
          >
            {visibleSchedules.map((schedule) => (
              <RecurringScheduleRow
                key={schedule.id}
                schedule={schedule}
                currencySymbol={currencySymbol}
                busy={busy || Boolean(draft)}
                permissions={permissions(schedule)}
                onRunNow={() => runNow(schedule)}
                onToggle={() => toggleStatus(schedule)}
                onEdit={() => beginEdit(schedule)}
                onDelete={() => remove(schedule.id)}
                onReview={(approve) => review(schedule.id, approve)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Creation & Editing Sheet */}
      <Sheet
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          placement={isMobile ? "edge" : "inset"}
          size="md"
          spacing="flush"
          elevation="flat"
        >
          <SheetHeader
            icon={Repeat2}
            title={
              editingId
                ? "Chỉnh sửa giao dịch định kỳ"
                : "Thêm giao dịch định kỳ"
            }
            description="Thiết lập khoản thu, chi hoặc chuyển khoản tự động hằng tháng."
          />
          {draft && (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-5">
              <RecurringEditor
                mode={editingId ? "edit" : "create"}
                draft={draft}
                wallets={wallets}
                categories={categories}
                onChange={(patch) =>
                  setDraft((current) =>
                    current ? { ...current, ...patch } : current,
                  )
                }
              />
            </div>
          )}
          <SheetFooter
            onCancel={closeEditor}
            cancelLabel="Hủy"
            submitLabel={
              editingId ? "Lưu thay đổi" : "Thêm giao dịch định kỳ"
            }
            isSubmitting={busy}
            submittingLabel="Đang lưu..."
            onSubmit={save}
            submitType="button"
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RecurringScheduleRow({
  schedule,
  currencySymbol,
  busy,
  permissions,
  onRunNow,
  onToggle,
  onEdit,
  onDelete,
  onReview,
}: {
  schedule: Schedule;
  currencySymbol: string;
  busy: boolean;
  permissions: {
    canApprove: boolean;
    canRunNow: boolean;
    canPause: boolean;
    canReactivate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
  onRunNow: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReview: (approve: boolean) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const hasActions =
    permissions.canApprove ||
    permissions.canRunNow ||
    permissions.canPause ||
    permissions.canReactivate ||
    permissions.canEdit ||
    permissions.canDelete;

  const amountPrefix =
    schedule.type === "income"
      ? "+"
      : schedule.type === "expense"
        ? "−"
        : "↔";

  const amountTone =
    schedule.type === "income"
      ? "text-[var(--income)]"
      : schedule.type === "expense"
        ? "text-[var(--expense)]"
        : "text-[var(--transfer)]";

  const iconToneClass =
    schedule.type === "income"
      ? "bg-emerald-500/10 text-[var(--income)] border border-emerald-500/20"
      : schedule.type === "expense"
        ? "bg-rose-500/10 text-[var(--expense)] border border-rose-500/20"
        : "bg-sky-500/10 text-[var(--transfer)] border border-sky-500/20";

  const statusMeta =
    schedule.approvalStatus === "pending"
      ? {
          label: "Chờ duyệt",
          className:
            "bg-[color-mix(in_srgb,var(--warning)_14%,var(--surface))] text-[var(--warning)]",
        }
      : schedule.approvalStatus === "rejected"
        ? {
            label: "Đã từ chối",
            className:
              "bg-[color-mix(in_srgb,var(--danger)_14%,var(--surface))] text-[var(--danger)]",
          }
        : schedule.completedAt
          ? {
              label: "Đã kết thúc",
              className:
                "bg-[var(--surface-secondary)] text-[var(--text-muted)]",
            }
          : schedule.status === "active"
            ? {
                label: "Đang bật",
                className:
                  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
              }
            : {
                label: "Tạm dừng",
                className:
                  "bg-[color-mix(in_srgb,var(--warning)_14%,var(--surface))] text-[var(--warning)]",
              };

  const typeMeta = typeOptions.find((option) => option.value === schedule.type);
  const TypeIcon = typeMeta?.icon ?? Repeat2;
  const categoryLabel =
    schedule.type === "transfer"
      ? "Chuyển khoản nội bộ"
      : (schedule.category?.name ?? "Chưa phân loại");
  const walletRoute = schedule.toWallet
    ? `${schedule.wallet} → ${schedule.toWallet}`
    : schedule.wallet;

  function run(action: () => void) {
    setMenuOpen(false);
    action();
  }

  const rowInnerContent = (
    <>
      {/* Left: Icon + Title + Category/Wallet + Schedule Date */}
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl md:size-10",
            iconToneClass,
          )}
          aria-hidden="true"
        >
          <TypeIcon size={17} />
        </span>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="min-w-0 break-words text-sm font-semibold leading-snug text-[var(--foreground)] md:text-base">
              {schedule.description || "Giao dịch định kỳ"}
            </h3>

            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                statusMeta.className,
              )}
            >
              <span
                className="size-1.5 rounded-full bg-current"
                aria-hidden="true"
              />
              {statusMeta.label}
            </span>

            {schedule.lastError && (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--danger)_14%,var(--surface))] px-2 py-0.5 text-[11px] font-medium text-[var(--danger)]"
                title={schedule.lastError}
              >
                <AlertTriangle size={11} aria-hidden="true" />
                <span>Cần kiểm tra</span>
              </span>
            )}
          </div>

          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-snug text-[var(--text-muted)]">
            <span className="font-medium text-[var(--text-secondary)]">
              Ví {walletRoute}
            </span>
            <span aria-hidden="true">·</span>
            <span>{categoryLabel}</span>
            <span className="hidden md:inline" aria-hidden="true">
              ·
            </span>
            <span className="hidden md:inline">
              {scheduleDayLabel(schedule.dayOfMonth)}
            </span>
          </p>

          <p className="flex flex-wrap items-center gap-1.5 text-[11px] leading-snug text-[var(--text-secondary)] tabular-nums">
            <CalendarClock
              size={12}
              className="shrink-0 text-[var(--primary)]"
              aria-hidden="true"
            />
            <span>
              {schedule.completedAt
                ? `Đã hoàn tất (${schedule.occurrenceCount} kỳ)`
                : `Ngày ${schedule.dayOfMonth} hằng tháng · Kỳ tiếp theo: ${dateLabel(schedule.nextExecutionDate)}`}
            </span>
          </p>
        </div>
      </div>

      {/* Right: Amount + Desktop Inline Quick Actions */}
      <div className="flex shrink-0 items-center justify-end gap-3.5">
        <div className="min-w-0 text-right">
          <strong
            className={cn(
              "block text-sm font-bold tabular-nums shrink-0 md:text-lg",
              amountTone,
            )}
          >
            {amountPrefix}
            {formatAmount(schedule.amount)} {currencySymbol}
          </strong>
          <span className="mt-0.5 block text-[11px] text-[var(--text-muted)] tabular-nums">
            {schedule.occurrenceCount > 0
              ? `Đã chạy ${schedule.occurrenceCount} kỳ`
              : "Chưa chạy kỳ nào"}
          </span>
        </div>

        {hasActions && (
          <div
            className="hidden shrink-0 items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-1 lg:flex"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {permissions.canApprove && (
              <>
                <Button
                  variant="success"
                  size="icon"
                  type="button"
                  disabled={busy}
                  onClick={() => onReview(true)}
                  title="Duyệt và bật lịch định kỳ"
                  aria-label="Duyệt lịch định kỳ"
                >
                  <ApprovalActionIcon decision="approve" />
                </Button>
                <Button
                  variant="destructiveIcon"
                  size="icon"
                  type="button"
                  disabled={busy}
                  onClick={() => onReview(false)}
                  title="Từ chối lịch định kỳ"
                  aria-label="Từ chối lịch định kỳ"
                >
                  <ApprovalActionIcon decision="reject" />
                </Button>
              </>
            )}

            {permissions.canRunNow && (
              <Button
                variant="icon"
                size="icon"
                type="button"
                disabled={busy}
                onClick={onRunNow}
                title="Thực hiện kỳ này ngay"
                aria-label="Thực hiện kỳ này ngay"
              >
                <Play size={16} aria-hidden="true" />
              </Button>
            )}

            {(permissions.canPause || permissions.canReactivate) && (
              <Button
                variant={schedule.status === "active" ? "icon" : "selected"}
                size="icon"
                type="button"
                disabled={busy}
                onClick={onToggle}
                title={
                  schedule.status === "active"
                    ? "Tạm dừng giao dịch định kỳ"
                    : "Bật lại giao dịch định kỳ"
                }
                aria-label={
                  schedule.status === "active"
                    ? "Tạm dừng lịch"
                    : "Kích hoạt lại lịch"
                }
              >
                {schedule.status === "active" ? (
                  <Pause size={16} aria-hidden="true" />
                ) : (
                  <Play size={16} aria-hidden="true" />
                )}
              </Button>
            )}

            {permissions.canEdit && (
              <Button
                variant="icon"
                size="icon"
                type="button"
                disabled={busy}
                onClick={onEdit}
                title="Chỉnh sửa giao dịch định kỳ"
                aria-label="Chỉnh sửa lịch"
              >
                <Pencil size={16} aria-hidden="true" />
              </Button>
            )}

            {permissions.canDelete && (
              <ConfirmDelete
                ariaLabel="Xóa lịch"
                title="Xóa giao dịch định kỳ?"
                description={`“${schedule.description || "Giao dịch định kỳ"}” sẽ ngừng chạy. Các giao dịch đã ghi nhận trước đó vẫn được giữ nguyên.`}
                onConfirm={onDelete}
                disabled={busy}
                trigger={
                  <Button
                    type="button"
                    variant="destructiveIcon"
                    size="icon"
                    disabled={busy}
                    aria-label="Xóa lịch"
                    title="Xóa giao dịch định kỳ"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                }
              />
            )}
          </div>
        )}
      </div>
    </>
  );

  if (!hasActions) {
    return (
      <article
        className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 md:items-center md:gap-4 md:p-4"
        data-type={schedule.type}
        data-status={schedule.completedAt ? "completed" : schedule.status}
      >
        {rowInnerContent}
      </article>
    );
  }

  function handleMenuOpenChange(nextOpen: boolean) {
    if (
      nextOpen &&
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(min-width: 1024px)").matches
    ) {
      return;
    }
    setMenuOpen(nextOpen);
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
        <SpotlightTrigger
          open={menuOpen}
          onOpenChange={handleMenuOpenChange}
          mobileOnly
          dismissLabel={`Đóng menu thao tác ${schedule.description || "giao dịch định kỳ"}`}
          render={
            <article
              role="button"
              tabIndex={0}
              data-type={schedule.type}
              data-status={schedule.completedAt ? "completed" : schedule.status}
              aria-label={`${schedule.description || "Giao dịch định kỳ"}, ${amountPrefix}${formatAmount(schedule.amount)} ${currencySymbol}. Chạm để mở menu thao tác.`}
              className="flex cursor-pointer select-none items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-left transition-all duration-150 active:scale-[0.99] active:bg-[var(--surface-hover)] md:items-center md:gap-4 md:p-4 lg:cursor-default lg:select-auto lg:active:scale-100 lg:active:bg-[var(--surface)]"
            />
          }
        >
          {(spotlightTrigger) => (
            <DropdownMenuTrigger nativeButton={false} render={spotlightTrigger}>
              {rowInnerContent}
            </DropdownMenuTrigger>
          )}
        </SpotlightTrigger>

        <DropdownMenuContent
          align="center"
          side="bottom"
          sideOffset={6}
          className="w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 lg:hidden"
        >
          {permissions.canApprove && (
            <>
              <DropdownMenuItem
                disabled={busy}
                onClick={() => run(() => onReview(true))}
              >
                <ApprovalActionIcon decision="approve" />
                <span>Duyệt và bật lịch</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={busy}
                onClick={() => run(() => onReview(false))}
              >
                <ApprovalActionIcon decision="reject" />
                <span>Từ chối lịch</span>
              </DropdownMenuItem>
            </>
          )}
          {permissions.canRunNow && (
            <DropdownMenuItem disabled={busy} onClick={() => run(onRunNow)}>
              <Play size={15} aria-hidden="true" />
              <span>Thực hiện kỳ này ngay</span>
            </DropdownMenuItem>
          )}
          {(permissions.canPause || permissions.canReactivate) && (
            <DropdownMenuItem disabled={busy} onClick={() => run(onToggle)}>
              {schedule.status === "active" ? (
                <Pause size={15} aria-hidden="true" />
              ) : (
                <Play size={15} aria-hidden="true" />
              )}
              <span>
                {schedule.status === "active"
                  ? "Tạm dừng lịch"
                  : "Kích hoạt lại lịch"}
              </span>
            </DropdownMenuItem>
          )}
          {permissions.canEdit && (
            <DropdownMenuItem disabled={busy} onClick={() => run(onEdit)}>
              <Pencil size={15} aria-hidden="true" />
              <span>Chỉnh sửa lịch</span>
            </DropdownMenuItem>
          )}
          {permissions.canDelete && (
            <>
              {(permissions.canApprove ||
                permissions.canRunNow ||
                permissions.canPause ||
                permissions.canReactivate ||
                permissions.canEdit) && <DropdownMenuSeparator />}
              <DropdownMenuItem
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  setMenuOpen(false);
                  setDeleteOpen(true);
                }}
              >
                <Trash2 size={15} aria-hidden="true" />
                <span>Xóa lịch định kỳ</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={deleteOpen} onOpenChange={setDeleteOpen}>
        <SheetContent
          side="bottom"
          aria-label="Xác nhận xóa lịch giao dịch"
        >
          <SheetHeader
            icon={Trash2}
            title="Xóa giao dịch định kỳ?"
            description="Các giao dịch đã ghi nhận trước đó vẫn được giữ nguyên."
          />
          <div className="p-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3.5 py-3">
              <span className="min-w-0 break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                {schedule.description || "Giao dịch định kỳ"}
              </span>
              <strong className={cn("shrink-0 text-sm font-bold tabular-nums", amountTone)}>
                {amountPrefix}
                {formatAmount(schedule.amount)} {currencySymbol}
              </strong>
            </div>
          </div>
          <SheetFooter className="grid grid-cols-2 gap-2.5">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setDeleteOpen(false)}
            >
              Giữ lại
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => {
                setDeleteOpen(false);
                onDelete();
              }}
            >
              Xóa lịch
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function RecurringEditor({
  mode,
  draft,
  wallets,
  categories,
  onChange,
}: {
  mode: "create" | "edit";
  draft: Draft;
  wallets: Option[];
  categories: CategoryOption[];
  onChange: (patch: Partial<Draft>) => void;
}) {
  const dayNumber = draft.startDate ? Number(draft.startDate.slice(-2)) : null;

  return (
    <section
      className="space-y-3.5"
      aria-label={
        mode === "create"
          ? "Tạo giao dịch định kỳ"
          : "Chỉnh sửa giao dịch định kỳ"
      }
    >
      {/* 1. Equal-Width 3-Column Transaction Type Tabs */}
      <Tabs
        value={draft.type}
        onValueChange={(value) => {
          const nextType = value as TransactionType;
          onChange({
            type: nextType,
            categoryId:
              categoriesForTransactionType(categories, nextType)[0]?.id ??
              "none",
          });
        }}
      >
        <TabsList
          variant="navigation"
          className="grid w-full grid-cols-3"
          aria-label="Loại giao dịch"
        >
          {typeOptions.map((option) => {
            const Icon = option.icon;
            return (
              <TabsTrigger
                value={option.value}
                tone={
                  option.value === "expense"
                    ? "expense"
                    : option.value === "income"
                      ? "income"
                      : undefined
                }
                key={option.value}
                disabled={option.value === "transfer" && wallets.length < 2}
                className="justify-center px-2 text-xs"
              >
                <Icon size={15} className="transition-colors" />
                <span>{option.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* 2. Balanced Luxury Hero Amount Card (Full-width input so large numbers never clip) */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            Số tiền mỗi kỳ
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--primary)]">
            <CalendarClock size={11} aria-hidden="true" />
            <span>
              {dayNumber
                ? `Ngày ${dayNumber} hằng tháng`
                : "Tự động hằng tháng"}
            </span>
          </span>
        </div>

        <div className="mt-1">
          <MoneyInput
            wrapperClassName="quick-amount-field !m-0 w-full"
            className="w-full border-0! bg-transparent! !py-0.5 !text-left !text-2xl font-bold ring-0! focus-visible:border-0! focus-visible:ring-0!"
            value={draft.amount}
            onValueChange={(amount) => onChange({ amount })}
            placeholder="0"
            aria-label="Số tiền giao dịch định kỳ"
          />
        </div>
      </div>

      {/* 3. Description */}
      <Input
        label="Tên / Nội dung giao dịch"
        value={draft.description}
        onChange={(event) => onChange({ description: event.target.value })}
        placeholder="Ví dụ: Tiền thuê nhà, Lương tháng, Điện nước..."
        maxLength={2_000}
      />

      {/* 4. Wallet & Category (Full-width on mobile so category names never wrap awkwardly, 2 columns on tablet/desktop) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          value={draft.walletId}
          onValueChange={(walletId) =>
            onChange({
              walletId,
              toWalletId:
                draft.toWalletId === walletId
                  ? defaultDestination(wallets, walletId)
                  : draft.toWalletId,
            })
          }
          label={draft.type === "transfer" ? "Ví gửi" : "Ví thực hiện"}
          options={wallets.map((wallet) => ({
            value: wallet.id,
            label: wallet.name,
          }))}
        />

        {draft.type === "transfer" ? (
          <Select
            value={draft.toWalletId}
            onValueChange={(toWalletId) => onChange({ toWalletId })}
            label="Ví nhận"
            options={wallets.map((wallet) => ({
              value: wallet.id,
              label: wallet.name,
              disabled: wallet.id === draft.walletId,
            }))}
          />
        ) : (
          <CategoryTreeSelect
            value={draft.categoryId}
            onValueChange={(categoryId) => onChange({ categoryId })}
            label="Danh mục"
            required={draft.type === "expense"}
            categories={categoriesForTransactionType(categories, draft.type)}
            emptyOption={
              draft.type === "expense"
                ? undefined
                : { value: "none", label: "Không chọn" }
            }
          />
        )}
      </div>

      {/* 5. Schedule Dates (2 Equal Columns) */}
      <div className="grid grid-cols-2 gap-3">
        <DatePicker
          label="Ngày bắt đầu"
          value={draft.startDate}
          onValueChange={(startDate) =>
            onChange({
              startDate,
              endDate:
                draft.endDate && draft.endDate < startDate ? "" : draft.endDate,
            })
          }
          required
        />

        <DatePicker
          label="Ngày kết thúc"
          value={draft.endDate}
          onValueChange={(endDate) => onChange({ endDate })}
          minDate={draft.startDate}
          allowClear
        />
      </div>
    </section>
  );
}

