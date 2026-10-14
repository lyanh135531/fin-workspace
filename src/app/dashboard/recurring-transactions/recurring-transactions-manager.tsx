"use client";

import Decimal from "decimal.js";
import {
  createRecurringTransactionAction,
  deleteRecurringTransactionAction,
  reviewRecurringTransactionAction,
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
  PageHeader,
  Select,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  Tabs,
  TabsCount,
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
  CirclePause,
  CirclePlay,
  Landmark,
  LayoutGrid,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat2,
  Trash2,
  Wallet,
} from "lucide-react";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

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

const statusFilterOptions = [
  { value: "all", label: "Tất cả", icon: LayoutGrid },
  { value: "income", label: "Thu nhập", icon: ArrowDownLeft },
  { value: "expense", label: "Chi tiêu", icon: ArrowUpRight },
  { value: "active", label: "Đang bật", icon: CirclePlay },
  { value: "deactive", label: "Tạm dừng", icon: CirclePause },
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

function emptyDraft(wallets: Option[], businessDate: string): Draft {
  const walletId = wallets[0]?.id ?? "";
  return {
    description: "",
    type: "expense",
    categoryId: "none",
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

  const filterCounts: Record<ScheduleStatusFilter, number> = {
    all: schedules.length,
    income: incomeCount,
    expense: expenseCount,
    active: activeCount,
    deactive: pausedCount,
    completed: completedCount,
  };

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
    setDraft(emptyDraft(wallets, workspace.businessDate));
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

  function permissions(schedule: Schedule) {
    const isOwner = schedule.createdByMemberId === currentMemberId;
    const canManageOwnApprovedSchedule = canApprove || isOwner;
    return {
      canApprove: canApprove && schedule.approvalStatus === "pending",
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
    <div className="grid gap-4 md:gap-5">
      <PageHeader
        title="Giao dịch định kỳ"
        description="Tự động ghi nhận các khoản thu nhập, chi tiêu và chuyển khoản lặp lại hằng tháng."
      >
        {canCreate && (
          <Button
            variant="default"
            disabled={busy || Boolean(draft) || wallets.length === 0}
            onClick={beginCreate}
          >
            <Plus size={16} aria-hidden="true" />
            <span>Thêm giao dịch định kỳ</span>
          </Button>
        )}
      </PageHeader>

      {/* Top 3-Metric Summary Strip */}
      <section
        aria-label="Tổng quan giao dịch định kỳ"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <Card size="sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="break-words text-xs font-medium leading-snug text-[var(--text-secondary)]">
                Tổng thu định kỳ/tháng
              </p>
              <p className="mt-1.5 text-xl font-bold tracking-tight text-[var(--income)] tabular-nums shrink-0 md:text-2xl">
                +{formatAmount(monthlyIncomeTotal.toString())} {currencySymbol}
              </p>
              <p className="mt-1 break-words text-xs leading-snug text-[var(--text-muted)]">
                Chênh lệch thu chi:{" "}
                <span className="font-semibold text-[var(--foreground)] tabular-nums">
                  {monthlyNetAmount.isPositive() ? "+" : ""}
                  {formatAmount(activeMonthlyNetAmount)} {currencySymbol}
                </span>
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
                Tổng chi định kỳ/tháng
              </p>
              <p className="mt-1.5 text-xl font-bold tracking-tight text-[var(--expense)] tabular-nums shrink-0 md:text-2xl">
                −{formatAmount(monthlyExpenseTotal.toString())} {currencySymbol}
              </p>
              <p className="mt-1 break-words text-xs leading-snug text-[var(--text-muted)]">
                {activeCount > 0
                  ? `${activeCount} lịch đang bật · ${pausedCount} tạm dừng`
                  : "Chưa có lịch định kỳ đang bật"}
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

        <Card size="sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="break-words text-xs font-medium leading-snug text-[var(--text-secondary)]">
                Sắp đến hạn
              </p>
              <p className="mt-1.5 text-xl font-bold tracking-tight text-[var(--foreground)] tabular-nums shrink-0 md:text-2xl">
                {dueSoonSchedules.length > 0
                  ? `${dueSoonSchedules.length} giao dịch`
                  : nextDueSchedule
                    ? dateLabel(nextDueSchedule.nextExecutionDate)
                    : "0 giao dịch"}
              </p>
              <p className="mt-1 break-words text-xs leading-snug text-[var(--text-muted)]">
                {attentionCount > 0 ? (
                  <span className="font-medium text-[var(--warning)]">
                    {pendingApprovalCount > 0
                      ? `${pendingApprovalCount} lịch chờ duyệt`
                      : `${errorCount} lịch cần kiểm tra`}
                  </span>
                ) : nextDueSchedule ? (
                  `Kỳ tiếp theo: ${dateLabel(nextDueSchedule.nextExecutionDate)}`
                ) : (
                  `Ngày làm việc: ${dateLabel(workspace.businessDate)}`
                )}
              </p>
            </div>
            <span
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-secondary)] text-[var(--primary)]"
              aria-hidden="true"
            >
              <CalendarClock size={18} />
            </span>
          </div>
        </Card>
      </section>

      {/* Filter Bar & Schedule List Card */}
      <Card aria-labelledby="recurring-list-title">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2
              id="recurring-list-title"
              className="break-words text-base font-semibold leading-snug text-[var(--foreground)]"
            >
              Danh sách giao dịch định kỳ
            </h2>
            <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-secondary)]">
              Hiển thị {visibleSchedules.length} / {schedules.length} lịch định kỳ
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={status}
              onValueChange={(value) => setStatus(value as ScheduleStatusFilter)}
            >
              <TabsList aria-label="Lọc giao dịch định kỳ">
                {statusFilterOptions.map((filter) => (
                  <TabsTrigger key={filter.value} value={filter.value}>
                    <span>{filter.label}</span>
                    <TabsCount>{filterCounts[filter.value]}</TabsCount>
                  </TabsTrigger>
                ))}
                {completedCount > 0 && (
                  <TabsTrigger value="completed">
                    <span>Đã kết thúc</span>
                    <TabsCount>{completedCount}</TabsCount>
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Schedule Items */}
        {visibleSchedules.length === 0 ? (
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
        ) : (
          <div
            className="divide-y divide-[var(--border)]"
            aria-label="Danh sách giao dịch định kỳ"
          >
            {visibleSchedules.map((schedule) => (
              <RecurringScheduleRow
                key={schedule.id}
                schedule={schedule}
                currencySymbol={currencySymbol}
                busy={busy || Boolean(draft)}
                permissions={permissions(schedule)}
                onToggle={() => toggleStatus(schedule)}
                onEdit={() => beginEdit(schedule)}
                onDelete={() => remove(schedule.id)}
                onReview={(approve) => review(schedule.id, approve)}
              />
            ))}
          </div>
        )}
      </Card>

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
          size={isMobile ? "default" : "wide"}
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
            description="Thiết lập nội dung, nguồn tiền và ngày tự động ghi nhận hằng tháng."
          />
          {draft && (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
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
    canPause: boolean;
    canReactivate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReview: (approve: boolean) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const hasActions =
    permissions.canApprove ||
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
                  "bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))] text-[var(--success)]",
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
      {/* Left: Title + Category badge, Wallet/Card name, Frequency & Next run date */}
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-secondary)]",
            amountTone,
          )}
          aria-hidden="true"
        >
          <TypeIcon size={18} />
        </span>

        <div className="min-w-0 flex-1 space-y-1">
          {/* Core Data Point 1: Title + Category badge + Status badge */}
          <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
            <h3 className="min-w-0 break-words text-sm font-semibold leading-snug text-[var(--foreground)] md:text-base">
              {schedule.description || "Giao dịch định kỳ"}
            </h3>

            <span className="hidden shrink-0 items-center rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)] md:inline-flex">
              {categoryLabel}
            </span>

            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium md:text-xs",
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
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[color-mix(in_srgb,var(--danger)_14%,var(--surface))] px-2 py-0.5 text-xs font-medium text-[var(--danger)]"
                title={schedule.lastError}
              >
                <AlertTriangle size={12} aria-hidden="true" />
                <span>Cần kiểm tra</span>
              </span>
            )}
          </div>

          {/* Core Data Points 2 & 3: Wallet/Card name + Next run date */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs leading-snug text-[var(--text-secondary)]">
            <span className="inline-flex min-w-0 items-center gap-1.5 break-words font-medium text-[var(--foreground)]">
              <Wallet
                size={13}
                className="shrink-0 text-[var(--text-muted)]"
                aria-hidden="true"
              />
              <span className="break-words">{walletRoute}</span>
            </span>

            <span className="hidden text-[var(--border)] md:inline" aria-hidden="true">
              •
            </span>

            <span className="hidden shrink-0 md:inline">
              {scheduleDayLabel(schedule.dayOfMonth)}
            </span>

            <span className="text-[var(--border)]" aria-hidden="true">
              •
            </span>

            <span className="shrink-0 font-medium text-[var(--text-secondary)] tabular-nums">
              {schedule.completedAt
                ? `Đã hoàn tất (${schedule.occurrenceCount} kỳ)`
                : `Kỳ tiếp theo: ${dateLabel(schedule.nextExecutionDate)}`}
            </span>
          </div>
        </div>
      </div>

      {/* Core Data Point 4: Tabular-nums Amount + Desktop Inline Quick Actions */}
      <div className="flex shrink-0 items-center justify-end gap-4">
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
          <span className="hidden text-[11px] text-[var(--text-muted)] tabular-nums md:block">
            Đã chạy {schedule.occurrenceCount} kỳ
          </span>
        </div>

        {hasActions && (
          <div
            className="hidden shrink-0 items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-1 lg:flex"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
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
        className="flex items-start justify-between gap-3 py-3.5 first:pt-2 last:pb-0 md:items-center md:gap-4"
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
              className="flex cursor-pointer select-none items-start justify-between gap-3 rounded-xl px-2 py-3.5 -mx-2 text-left transition-all duration-150 active:scale-[0.99] active:bg-[var(--surface-hover)] md:items-center md:gap-4 lg:cursor-default lg:select-auto lg:px-0 lg:mx-0 lg:active:scale-100 lg:active:bg-transparent"
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
  return (
    <section
      className="grid gap-6"
      aria-label={
        mode === "create"
          ? "Tạo giao dịch định kỳ"
          : "Chỉnh sửa giao dịch định kỳ"
      }
    >
      {/* Schedule frequency preview */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--primary)]">
            Chu kỳ lặp lại tự động
          </p>
          <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-secondary)]">
            {mode === "edit"
              ? "Thay đổi sẽ áp dụng từ kỳ ghi nhận tiếp theo."
              : "Hệ thống tự động ghi nhận đúng ngày đã chọn mỗi tháng."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--foreground)]">
          <CalendarClock
            size={14}
            className="text-[var(--primary)]"
            aria-hidden="true"
          />
          <span>
            {draft.startDate
              ? scheduleDayLabel(Number(draft.startDate.slice(-2)))
              : "Chọn ngày bắt đầu"}
          </span>
        </div>
      </div>

      {/* Section 1: Transaction Details */}
      <div className="grid gap-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
          <ArrowLeftRight
            size={16}
            className="text-[var(--primary)]"
            aria-hidden="true"
          />
          <span>1. Thông tin giao dịch</span>
        </div>

        <Tabs
          value={draft.type}
          onValueChange={(value) =>
            onChange({ type: value as TransactionType, categoryId: "none" })
          }
        >
          <TabsList
            variant="navigation"
            className="w-full"
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
                >
                  <Icon className="transition-colors" />
                  <span>{option.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Tên / Nội dung giao dịch"
            value={draft.description}
            onChange={(event) =>
              onChange({ description: event.target.value })
            }
            placeholder="Ví dụ: Tiền thuê nhà, Lương tháng, Tiết kiệm..."
            maxLength={2_000}
          />
          <MoneyInput
            label="Số tiền mỗi kỳ"
            value={draft.amount}
            onValueChange={(amount) => onChange({ amount })}
            placeholder="0"
            aria-label="Số tiền giao dịch định kỳ"
          />
        </div>
      </div>

      {/* Section 2: Wallet & Category */}
      <div className="grid gap-4 border-t border-[var(--border)] pt-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
          <Landmark
            size={16}
            className="text-[var(--primary)]"
            aria-hidden="true"
          />
          <span>2. Ví & Danh mục</span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            label="Ví thực hiện"
            options={wallets.map((wallet) => ({
              value: wallet.id,
              label: wallet.name,
            }))}
          />

          {draft.type === "transfer" ? (
            <Select
              value={draft.toWalletId}
              onValueChange={(toWalletId) => onChange({ toWalletId })}
              label="Ví nhận tiền"
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
              label="Danh mục thu chi"
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
      </div>

      {/* Section 3: Schedule Dates */}
      <div className="grid gap-4 border-t border-[var(--border)] pt-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
          <CalendarClock
            size={16}
            className="text-[var(--primary)]"
            aria-hidden="true"
          />
          <span>3. Thời gian thực hiện</span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <DatePicker
              label="Kỳ đầu tiên (Ngày bắt đầu)"
              value={draft.startDate}
              onValueChange={(startDate) =>
                onChange({
                  startDate,
                  endDate:
                    draft.endDate && draft.endDate < startDate
                      ? ""
                      : draft.endDate,
                })
              }
              required
            />
            <small className="mt-1.5 block text-xs text-[var(--text-muted)]">
              Giao dịch sẽ tự động lặp lại vào ngày này hằng tháng.
            </small>
          </div>

          <div>
            <DatePicker
              label="Ngày kết thúc (Không bắt buộc)"
              value={draft.endDate}
              onValueChange={(endDate) => onChange({ endDate })}
              minDate={draft.startDate}
              allowClear
            />
            <small className="mt-1.5 block text-xs text-[var(--text-muted)]">
              Để trống nếu muốn duy trì lịch định kỳ liên tục.
            </small>
          </div>
        </div>
      </div>
    </section>
  );
}

