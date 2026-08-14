"use client";

import {
  createRecurringTransactionAction,
  deleteRecurringTransactionAction,
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
  Loading,
  MoneyInput,
  PageHeader,
  Select,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Tabs,
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
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  CircleCheckBig,
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
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
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
type ScheduleStatusFilter = "all" | "active" | "deactive" | "completed";
type Schedule = {
  id: string;
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

const typeOptions = [
  {
    value: "expense",
    label: "Chi tiêu",
    tabLabel: "Chi",
    icon: ArrowUpRight,
  },
  {
    value: "income",
    label: "Thu nhập",
    tabLabel: "Thu",
    icon: ArrowDownLeft,
  },
  {
    value: "transfer",
    label: "Chuyển khoản",
    tabLabel: "Chuyển",
    icon: ArrowLeftRight,
  },
];

const statusFilterOptions = [
  { value: "all", label: "Tất cả lịch", tabLabel: "Tất cả", icon: LayoutGrid },
  {
    value: "active",
    label: "Đang hoạt động",
    tabLabel: "Đang chạy",
    icon: CirclePlay,
  },
  {
    value: "deactive",
    label: "Tạm dừng",
    tabLabel: "Tạm dừng",
    icon: CirclePause,
  },
  {
    value: "completed",
    label: "Đã kết thúc",
    tabLabel: "Đã xong",
    icon: CircleCheckBig,
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
    ? `Ngày ${day} hằng tháng`
    : `Ngày ${day} · cuối tháng nếu thiếu ngày`;
}

function mobileDateParts(date: string) {
  const [, month, day] = date.split("-");
  return { day, month: `TH ${Number(month)}` };
}

export function RecurringTransactionsManager({
  workspace,
  wallets,
  categories,
  schedules,
}: {
  workspace: {
    id: string;
    name: string;
    currency: string;
    timeZone: string;
    businessDate: string;
  };
  wallets: Option[];
  categories: CategoryOption[];
  schedules: Schedule[];
}) {
  const [status, setStatus] = useState<ScheduleStatusFilter>("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [busy, startTransition] = useTransition();
  const SummaryContainer = isMobile ? "section" : Card;
  const ListContainer = isMobile ? "section" : Card;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const syncViewport = () => setIsMobile(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  const visibleSchedules = useMemo(
    () =>
      schedules.filter((item) => {
        const displayStatus = item.completedAt ? "completed" : item.status;
        return status === "all" || displayStatus === status;
      }),
    [schedules, status],
  );
  const activeCount = schedules.filter(
    (item) => !item.completedAt && item.status === "active",
  ).length;
  const pausedCount = schedules.filter(
    (item) => !item.completedAt && item.status === "deactive",
  ).length;
  const completedCount = schedules.filter((item) =>
    Boolean(item.completedAt),
  ).length;
  const errorCount = schedules.filter((item) => Boolean(item.lastError)).length;
  const filterCounts: Record<ScheduleStatusFilter, number> = {
    all: schedules.length,
    active: activeCount,
    deactive: pausedCount,
    completed: completedCount,
  };

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
            ? "Đã cập nhật giao dịch định kỳ."
            : "Đã đăng ký giao dịch định kỳ.",
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
          nextStatus === "active"
            ? "Đã kích hoạt lại lịch."
            : "Đã tạm dừng lịch.",
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

  return (
    <div className={isMobile ? "recurring-page" : "space-y-5"}>
      <PageHeader
        className={isMobile ? "recurring-page-header" : undefined}
        title="Giao dịch định kỳ"
        description="Tự động ghi nhận các khoản thu, chi và chuyển tiền lặp lại mỗi tháng."
      >
        <Button
          variant="default"
          disabled={busy || Boolean(draft) || wallets.length === 0}
          onClick={beginCreate}
        >
          <Plus size={16} />
          <span className="recurring-create-label-desktop">Tạo lịch mới</span>
        </Button>
      </PageHeader>

      <section
        className="recurring-mobile-control rounded-2xl"
        aria-label="Trung tâm điều khiển lịch tự động"
      >
        <header>
          <small>{schedules.length} lịch đã thiết lập</small>
        </header>
        <div className="recurring-mobile-control-main">
          <div>
            <span>Lịch đang hoạt động</span>
            <strong>{activeCount}</strong>
            <p>
              {activeCount > 0
                ? "Felix sẽ tự ghi nhận đúng ngày"
                : "Tạo hoặc kích hoạt một lịch để bắt đầu"}
            </p>
          </div>
          <div
            className="recurring-mobile-orbit"
            data-active={activeCount > 0}
            aria-hidden="true"
          >
            <span>
              <Repeat2 size={22} />
            </span>
            <i />
          </div>
        </div>
        <dl className="recurring-mobile-control-stats">
          <div>
            <dt>Tạm dừng</dt>
            <dd>{pausedCount}</dd>
          </div>
          <div>
            <dt>Đã hoàn tất</dt>
            <dd>{completedCount}</dd>
          </div>
          <div data-alert={errorCount > 0}>
            <dt>Cần kiểm tra</dt>
            <dd>{errorCount}</dd>
          </div>
        </dl>
      </section>

      <SummaryContainer
        className={cn(
          isMobile
            ? "recurring-summary"
            : "max-[760px]:hidden grid grid-cols-[minmax(16rem,1.15fr)_minmax(0,1.85fr)] items-stretch gap-0",
        )}
        aria-label="Tổng quan giao dịch định kỳ"
      >
        <div
          className={cn(
            isMobile
              ? "recurring-summary-primary"
              : "flex min-w-0 items-center gap-4 pr-6",
          )}
        >
          <span
            className={cn(
              isMobile
                ? "recurring-summary-icon"
                : "grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]",
            )}
            aria-hidden="true"
          >
            <Repeat2 size={20} />
          </span>
          <div>
            <div
              className={cn(
                isMobile
                  ? "recurring-summary-status"
                  : "flex items-center gap-2 text-xs font-medium text-[var(--text-muted)]",
              )}
            >
              <i
                className={cn(
                  !isMobile && "size-1.5 rounded-full bg-[var(--success)]",
                )}
                data-active={activeCount > 0}
                aria-hidden="true"
              />
              <p>{isMobile ? "Trung tâm tự động" : "Tự động ghi nhận"}</p>
            </div>
            <div
              className={cn(
                isMobile
                  ? "recurring-summary-value"
                  : "mt-2 flex items-baseline gap-2",
              )}
            >
              <strong
                className={cn(
                  !isMobile &&
                    "text-[2rem] font-semibold leading-none tracking-[-0.04em] text-[var(--foreground)] tabular-nums",
                )}
              >
                {activeCount}
              </strong>
              <span
                className={cn(
                  !isMobile &&
                    "text-sm font-medium text-[var(--text-secondary)]",
                )}
              >
                lịch đang chạy
              </span>
            </div>
            <small
              className={cn(
                !isMobile &&
                  "mt-2 block text-xs leading-5 text-[var(--text-muted)]",
              )}
            >
              {activeCount > 0
                ? "Felix sẽ ghi nhận đúng ngày đã đặt"
                : "Kích hoạt một lịch để bắt đầu tự động hóa"}
            </small>
          </div>
        </div>
        <dl
          className={cn(
            isMobile
              ? "recurring-summary-details"
              : "grid grid-cols-4 border-l border-[var(--border)] text-center [&>div]:flex [&>div]:flex-col [&>div]:items-center [&>div]:justify-center [&>div]:px-4 [&_dd]:mt-2 [&_dd]:text-xl [&_dd]:font-semibold [&_dd]:text-[var(--foreground)] [&_dd]:tabular-nums [&_dt]:flex [&_dt]:items-center [&_dt]:justify-center [&_dt]:gap-2 [&_dt]:text-[0.7rem] [&_dt]:font-medium [&_dt]:text-[var(--text-muted)] [&_small]:mt-1 [&_small]:block [&_small]:text-[0.65rem] [&_small]:text-[var(--text-muted)] [&_svg]:size-3.5",
          )}
        >
          <div
            className={
              isMobile
                ? "recurring-summary-metric recurring-summary-metric-total"
                : undefined
            }
          >
            <dt>
              <LayoutGrid aria-hidden="true" />
              <span>Tổng số lịch</span>
            </dt>
            <dd>{schedules.length}</dd>
            <small>Đã thiết lập</small>
          </div>
          <div
            className={
              isMobile
                ? "recurring-summary-metric recurring-summary-metric-paused"
                : undefined
            }
          >
            <dt>
              <CirclePause aria-hidden="true" />
              <span>Tạm dừng</span>
            </dt>
            <dd>{pausedCount}</dd>
            <small>Chờ kích hoạt lại</small>
          </div>
          <div
            className={
              isMobile
                ? "recurring-summary-metric recurring-summary-metric-completed"
                : undefined
            }
          >
            <dt>
              <CircleCheckBig aria-hidden="true" />
              <span>Đã kết thúc</span>
            </dt>
            <dd>{completedCount}</dd>
            <small>Đã hoàn thành</small>
          </div>
          <div
            className={
              isMobile
                ? `recurring-summary-metric recurring-summary-metric-error${errorCount ? " has-error" : ""}`
                : errorCount
                  ? "text-[var(--danger)]"
                  : undefined
            }
          >
            <dt>
              <AlertTriangle aria-hidden="true" />
              <span>Cần kiểm tra</span>
            </dt>
            <dd>{errorCount}</dd>
            <small>{errorCount ? "Cần xử lý" : "Không có lỗi"}</small>
          </div>
        </dl>
      </SummaryContainer>

      <nav
        className="recurring-mobile-filters"
        aria-label="Lọc giao dịch định kỳ"
      >
        {[
          { value: "all", label: "Tất cả", icon: LayoutGrid },
          { value: "active", label: "Đang chạy", icon: CirclePlay },
          { value: "deactive", label: "Tạm dừng", icon: CirclePause },
          { value: "completed", label: "Đã xong", icon: CircleCheckBig },
        ].map((filter) => {
          const Icon = filter.icon;
          return (
            <button
              type="button"
              className="recurring-mobile-filter"
              data-active={status === filter.value}
              aria-pressed={status === filter.value}
              onClick={() => setStatus(filter.value as ScheduleStatusFilter)}
              key={filter.value}
            >
              <Icon aria-hidden="true" />
              <span>{filter.label}</span>
            </button>
          );
        })}
      </nav>

      <div className={cn(isMobile ? "recurring-content-grid" : "space-y-0")}>
        <ListContainer
          className={cn(
            isMobile
              ? "recurring-ledger-card rounded-2xl"
              : "max-[760px]:hidden gap-0",
          )}
          aria-labelledby="recurring-list-title"
        >
          <header
            className={cn(
              isMobile
                ? "recurring-list-heading"
                : "flex items-center justify-between gap-6 pb-5",
            )}
          >
            <div className="min-w-0">
              <div
                className={cn(
                  !isMobile &&
                    "flex items-center gap-2 text-xs text-[var(--text-muted)]",
                )}
              >
                {!isMobile && <CalendarClock size={14} aria-hidden="true" />}
                <span
                  className={isMobile ? "recurring-list-kicker" : undefined}
                >
                  {isMobile
                    ? "Danh sách lịch"
                    : `Ngày làm việc ${dateLabel(workspace.businessDate)}`}
                </span>
              </div>
              <h2
                id="recurring-list-title"
                className={cn(
                  !isMobile &&
                    "mt-1.5 text-base font-semibold text-[var(--foreground)]",
                )}
              >
                {status === "all"
                  ? "Tất cả giao dịch định kỳ"
                  : statusFilterOptions.find(
                      (filter) => filter.value === status,
                    )?.label}
              </h2>
              <p
                className={cn(
                  !isMobile && "mt-1 text-xs text-[var(--text-muted)]",
                )}
              >
                {visibleSchedules.length} lịch trong chế độ xem này
              </p>
            </div>
            {!isMobile && (
              <Tabs
                className="w-[34rem] shrink-0 gap-0"
                value={status}
                onValueChange={(value) =>
                  setStatus(value as ScheduleStatusFilter)
                }
              >
                <TabsList variant="navigation" className="grid-cols-4 gap-1">
                  {statusFilterOptions.map((filter) => (
                    <TabsTrigger
                      key={filter.value}
                      value={filter.value}
                      variant="navigation"
                    >
                      <span>{filter.tabLabel}</span>
                      <TabsCount>{filterCounts[filter.value]}</TabsCount>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
          </header>
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
              className={
                isMobile
                  ? "recurring-sheet-content w-full gap-0 border-l border-[var(--border)] bg-[var(--surface)] p-0 sm:max-w-none"
                  : undefined
              }
            >
              <SheetHeader
                className={cn(
                  isMobile
                    ? "recurring-sheet-header border-b border-border"
                    : "px-8 pb-5 pt-7",
                )}
              >
                <div
                  className={cn(
                    isMobile
                      ? "recurring-sheet-heading"
                      : "flex items-start gap-3.5",
                  )}
                >
                  <span
                    className={cn(
                      !isMobile &&
                        "grid size-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))] text-[var(--primary)]",
                    )}
                    aria-hidden="true"
                  >
                    <Repeat2 size={18} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <SheetTitle
                      className={cn(
                        isMobile
                          ? "text-lg font-semibold tracking-tight"
                          : "text-xl font-semibold tracking-tight",
                      )}
                    >
                      {editingId
                        ? "Chỉnh sửa lịch tự động"
                        : "Tạo giao dịch định kỳ"}
                    </SheetTitle>
                    <SheetDescription
                      className={cn(
                        isMobile
                          ? "recurring-desktop-sheet-description"
                          : "mt-1 max-w-[30rem] text-xs leading-5 text-[var(--text-muted)]",
                      )}
                    >
                      Thiết lập nội dung, nguồn tiền và thời gian ghi nhận tự
                      động.
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              {draft && (
                <div
                  className={cn(
                    "min-h-0 flex-1 overflow-y-auto",
                    isMobile ? "recurring-sheet-body px-6" : "px-8",
                  )}
                >
                  <RecurringEditor
                    mode={editingId ? "edit" : "create"}
                    draft={draft}
                    wallets={wallets}
                    categories={categories}
                    isMobile={isMobile}
                    onChange={(patch) =>
                      setDraft((current) =>
                        current ? { ...current, ...patch } : current,
                      )
                    }
                  />
                </div>
              )}
              <SheetFooter
                className={cn(
                  "shrink-0 flex-row justify-end gap-2 border-t border-[var(--border)]",
                  isMobile
                    ? "recurring-sheet-footer bg-[var(--surface)] px-6 py-4"
                    : "px-8 py-4",
                )}
              >
                <Button variant="outline" disabled={busy} onClick={closeEditor}>
                  Hủy
                </Button>
                <Button variant="default" disabled={busy} onClick={save}>
                  {busy ? <Loading label="Đang lưu..." /> : "Lưu đăng ký"}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <div
            className="hidden border-t border-[var(--border)] min-[761px]:block"
            aria-label="Danh sách giao dịch định kỳ"
          >
            {visibleSchedules.map((schedule) => {
              const nextDate = mobileDateParts(schedule.nextExecutionDate);
              return (
                <article
                  className="grid min-h-[6rem] grid-cols-[3.5rem_minmax(12rem,1fr)_minmax(22rem,1.55fr)_13rem] items-center gap-4 border-b border-[var(--border)] py-4 transition-colors last:border-b-0"
                  data-type={schedule.type}
                  data-status={
                    schedule.completedAt ? "completed" : schedule.status
                  }
                  key={schedule.id}
                >
                  <time
                    className="grid place-items-center text-center text-[var(--text-muted)]"
                    dateTime={schedule.nextExecutionDate}
                  >
                    {schedule.completedAt ? (
                      <CircleCheckBig size={20} aria-hidden="true" />
                    ) : (
                      <>
                        <span className="text-[0.62rem] font-semibold uppercase text-[var(--text-muted)]">
                          {nextDate.month}
                        </span>
                        <strong className="mt-0.5 text-xl font-semibold leading-none text-[var(--foreground)] tabular-nums">
                          {nextDate.day}
                        </strong>
                      </>
                    )}
                  </time>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[0.68rem]">
                      <span className="font-medium text-[var(--text-muted)]">
                        {
                          typeOptions.find(
                            (option) => option.value === schedule.type,
                          )?.label
                        }
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 font-medium",
                          schedule.completedAt
                            ? "text-[var(--text-muted)]"
                            : schedule.status === "active"
                              ? "text-[var(--success)]"
                              : "text-[var(--warning)]",
                        )}
                      >
                        <span
                          className="size-1.5 rounded-full bg-current"
                          aria-hidden="true"
                        />
                        {schedule.completedAt
                          ? "Đã kết thúc"
                          : schedule.status === "active"
                            ? "Đang hoạt động"
                            : "Tạm dừng"}
                      </span>
                      {schedule.lastError && (
                        <span
                          className="inline-flex items-center gap-1 text-[var(--danger)]"
                          title={schedule.lastError}
                        >
                          <AlertTriangle size={12} /> Cần kiểm tra
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 truncate text-sm font-semibold text-[var(--foreground)]">
                      {schedule.description || "Không có nội dung"}
                    </h3>
                    <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                      {schedule.wallet}
                      {schedule.toWallet ? ` → ${schedule.toWallet}` : ""}
                      <span>·</span>
                      {schedule.category?.name ?? "Chưa phân loại"}
                    </p>
                  </div>
                  <dl className="grid min-w-0 grid-cols-[0.85fr_0.85fr_1.3fr] [&>div]:min-w-0 [&>div]:px-4 [&>div:first-child]:pl-0 [&>div+div]:border-l [&>div+div]:border-[var(--border)] [&_dd]:mt-1.5 [&_dd]:text-xs [&_dd]:font-medium [&_dd]:leading-5 [&_dd]:text-[var(--text-secondary)] [&_dt]:text-[0.65rem] [&_dt]:text-[var(--text-muted)]">
                    <div>
                      <dt>Chu kỳ</dt>
                      <dd>{scheduleDayLabel(schedule.dayOfMonth)}</dd>
                    </div>
                    <div>
                      <dt>Lần tiếp theo</dt>
                      <dd>
                        {schedule.completedAt
                          ? "Đã hoàn tất"
                          : dateLabel(schedule.nextExecutionDate)}
                      </dd>
                    </div>
                    <div>
                      <dt>Hiệu lực</dt>
                      <dd className="whitespace-normal break-words">
                        {dateLabel(schedule.startDate)} →{" "}
                        {schedule.endDate
                          ? dateLabel(schedule.endDate)
                          : "Không giới hạn"}
                      </dd>
                    </div>
                  </dl>
                  <div className="min-w-0 text-right">
                    <strong
                      className={cn(
                        "block truncate text-sm font-semibold tabular-nums",
                        schedule.type === "income"
                          ? "text-[var(--income)]"
                          : schedule.type === "expense"
                            ? "text-[var(--expense)]"
                            : "text-[var(--transfer)]",
                      )}
                    >
                      {schedule.type === "income"
                        ? "+"
                        : schedule.type === "expense"
                          ? "−"
                          : "↔"}
                      {formatAmount(schedule.amount)}{" "}
                      <small className="ml-1 text-[0.65rem] font-medium">
                        {workspace.currency}
                      </small>
                    </strong>
                    <p className="mt-1 text-[0.68rem] text-[var(--text-muted)]">
                      {schedule.occurrenceCount} kỳ đã ghi nhận
                    </p>
                    <div className="mt-2 flex items-center justify-end gap-1">
                      {!schedule.completedAt && (
                        <Button
                          variant="icon"
                          size="icon"
                          type="button"
                          disabled={busy || Boolean(draft)}
                          onClick={() => toggleStatus(schedule)}
                          title={
                            schedule.status === "active"
                              ? "Tạm dừng"
                              : "Kích hoạt lại"
                          }
                          aria-label={
                            schedule.status === "active"
                              ? "Tạm dừng lịch"
                              : "Kích hoạt lại lịch"
                          }
                        >
                          {schedule.status === "active" ? (
                            <Pause size={16} />
                          ) : (
                            <Play size={16} />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="icon"
                        size="icon"
                        type="button"
                        disabled={busy || Boolean(draft)}
                        onClick={() => beginEdit(schedule)}
                        title="Chỉnh sửa"
                        aria-label="Chỉnh sửa lịch"
                      >
                        <Pencil size={16} />
                      </Button>
                      <ConfirmDelete
                        ariaLabel="Xóa lịch"
                        title="Xóa lịch giao dịch?"
                        description={`“${schedule.description || "Giao dịch định kỳ"}” sẽ ngừng chạy. Các giao dịch đã ghi nhận vẫn được giữ nguyên.`}
                        onConfirm={() => remove(schedule.id)}
                        disabled={busy || Boolean(draft)}
                        trigger={
                          <Button
                            type="button"
                            variant="destructiveIcon"
                            size="icon"
                            disabled={busy || Boolean(draft)}
                            aria-label="Xóa lịch"
                            title="Xóa lịch"
                          >
                            <Trash2 size={16} />
                          </Button>
                        }
                      />
                    </div>
                  </div>
                </article>
              );
            })}
            {visibleSchedules.length === 0 && (
              <Empty
                icon={Repeat2}
                title={
                  schedules.length
                    ? "Không có lịch phù hợp"
                    : "Chưa có giao dịch định kỳ"
                }
                description={
                  schedules.length
                    ? "Thử thay đổi bộ lọc hoặc từ khóa."
                    : "Đăng ký khoản lặp lại để hệ thống tự ghi nhận mỗi tháng."
                }
              />
            )}
          </div>

          <div
            className="recurring-mobile-schedule-list"
            aria-label="Danh sách giao dịch định kỳ trên di động"
          >
            {visibleSchedules.map((schedule) => (
              <RecurringMobileScheduleCard
                key={schedule.id}
                schedule={schedule}
                currency={workspace.currency}
                busy={busy || Boolean(draft)}
                onToggle={() => toggleStatus(schedule)}
                onEdit={() => beginEdit(schedule)}
                onDelete={() => remove(schedule.id)}
              />
            ))}
            {visibleSchedules.length === 0 && (
              <Empty
                icon={Repeat2}
                title={
                  schedules.length
                    ? "Không có lịch phù hợp"
                    : "Chưa có giao dịch định kỳ"
                }
                description={
                  schedules.length
                    ? "Chọn trạng thái khác để xem các lịch còn lại."
                    : "Tạo lịch đầu tiên để Fin tự ghi nhận khoản lặp lại mỗi tháng."
                }
              />
            )}
          </div>
        </ListContainer>
      </div>
    </div>
  );
}

function RecurringMobileScheduleCard({
  schedule,
  currency,
  busy,
  onToggle,
  onEdit,
  onDelete,
}: {
  schedule: Schedule;
  currency: string;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const nextDate = mobileDateParts(schedule.nextExecutionDate);
  const amountPrefix =
    schedule.type === "income" ? "+" : schedule.type === "expense" ? "−" : "↔";
  const statusLabel = schedule.completedAt
    ? "Đã kết thúc"
    : schedule.status === "active"
      ? "Đang hoạt động"
      : "Tạm dừng";

  function run(action: () => void) {
    setMenuOpen(false);
    action();
  }

  const cardContent = (
    <>
      <div className="recurring-mobile-date" aria-hidden="true">
        {schedule.completedAt ? (
          <Repeat2 size={20} />
        ) : (
          <>
            <span>{nextDate.month}</span>
            <strong>{nextDate.day}</strong>
          </>
        )}
      </div>
      <div className="recurring-mobile-card-main">
        <div className="recurring-mobile-card-topline">
          <div className="recurring-mobile-card-status">
            <span
              className={`status recurring-status-${schedule.completedAt ? "completed" : schedule.status}`}
            >
              {statusLabel}
            </span>
            {schedule.lastError && (
              <span className="recurring-error">
                <AlertTriangle size={12} /> Cần kiểm tra
              </span>
            )}
          </div>
          <strong
            className={`recurring-mobile-card-amount ledger-amount amount-${schedule.type}`}
          >
            {amountPrefix}
            {formatAmount(schedule.amount)} <small>{currency}</small>
          </strong>
        </div>
        <h3>{schedule.description || "Không có nội dung"}</h3>
        <p>
          {schedule.wallet}
          {schedule.toWallet ? ` → ${schedule.toWallet}` : ""}
          {` · ${schedule.occurrenceCount} kỳ đã ghi nhận`}
        </p>
      </div>
      <footer className="recurring-mobile-card-footer">
        <span>{scheduleDayLabel(schedule.dayOfMonth)}</span>
        <span>{schedule.category?.name ?? "Chưa phân loại"}</span>
        <small className="recurring-mobile-card-hint">Chạm để quản lý</small>
      </footer>
    </>
  );

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <SpotlightTrigger
          open={menuOpen}
          onOpenChange={setMenuOpen}
          render={
            <article
              className="recurring-mobile-card rounded-2xl"
              data-type={schedule.type}
              data-status={schedule.completedAt ? "completed" : schedule.status}
              aria-label={`${schedule.description || "Giao dịch định kỳ"}, ${amountPrefix}${formatAmount(schedule.amount)} ${currency}, ${statusLabel}. Chạm để mở menu thao tác.`}
            />
          }
          dismissLabel={`Đóng menu thao tác ${schedule.description || "giao dịch định kỳ"}`}
        >
          {(spotlightTrigger) => (
            <DropdownMenuTrigger nativeButton={false} render={spotlightTrigger}>
              {cardContent}
            </DropdownMenuTrigger>
          )}
        </SpotlightTrigger>

        <DropdownMenuContent
          align="center"
          side="bottom"
          sideOffset={6}
          className="recurring-mobile-context-menu"
        >
          {!schedule.completedAt && (
            <DropdownMenuItem disabled={busy} onClick={() => run(onToggle)}>
              {schedule.status === "active" ? (
                <Pause aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )}
              {schedule.status === "active" ? "Tạm dừng lịch" : "Kích hoạt lại"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem disabled={busy} onClick={() => run(onEdit)}>
            <Pencil aria-hidden="true" />
            Chỉnh sửa lịch
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={busy}
            onClick={() => {
              setMenuOpen(false);
              setDeleteOpen(true);
            }}
          >
            <Trash2 aria-hidden="true" />
            Xóa lịch
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={deleteOpen} onOpenChange={setDeleteOpen}>
        <SheetContent
          side="bottom"
          className="recurring-delete-sheet"
          aria-label="Xác nhận xóa lịch giao dịch"
        >
          <SheetHeader className="recurring-delete-sheet-header">
            <span className="recurring-delete-sheet-icon" aria-hidden="true">
              <Trash2 size={18} />
            </span>
            <div>
              <SheetTitle>Xóa lịch giao dịch?</SheetTitle>
              <SheetDescription>
                Các giao dịch đã ghi nhận vẫn được giữ nguyên.
              </SheetDescription>
            </div>
          </SheetHeader>
          <div className="recurring-delete-sheet-body">
            <span>{schedule.description || "Giao dịch định kỳ"}</span>
            <strong className={`amount-${schedule.type}`}>
              {amountPrefix}
              {formatAmount(schedule.amount)} {currency}
            </strong>
          </div>
          <SheetFooter className="recurring-delete-sheet-footer">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setDeleteOpen(false)}
            >
              Giữ lại
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                setDeleteOpen(false);
                onDelete();
              }}
            >
              <Trash2 size={16} /> Xóa lịch
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
  isMobile,
  onChange,
}: {
  mode: "create" | "edit";
  draft: Draft;
  wallets: Option[];
  categories: CategoryOption[];
  isMobile: boolean;
  onChange: (patch: Partial<Draft>) => void;
}) {
  return (
    <section
      className={cn(
        isMobile
          ? "recurring-editor !m-0 !rounded-none !border-0 !bg-transparent !px-0 !py-5 !shadow-none"
          : "grid grid-cols-2 gap-x-8 gap-y-7 py-6",
      )}
      aria-label={
        mode === "create"
          ? "Tạo giao dịch định kỳ"
          : "Chỉnh sửa giao dịch định kỳ"
      }
    >
      <div
        className={cn(
          isMobile
            ? "recurring-editor-intro"
            : "col-span-2 flex items-center justify-between gap-5 pb-5",
        )}
      >
        <div>
          <span
            className={cn(
              isMobile
                ? "recurring-editor-kicker"
                : "inline-flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--primary)]",
            )}
          >
            <Repeat2 size={13} /> Lặp hằng tháng
          </span>
          <p
            className={cn(
              !isMobile && "mt-1.5 text-xs text-[var(--text-muted)]",
            )}
          >
            {isMobile
              ? "Fin tự ghi nhận đúng ngày."
              : mode === "edit"
                ? "Các thay đổi sẽ áp dụng từ kỳ ghi nhận tiếp theo."
                : "Fin tự ghi nhận giao dịch đúng ngày đã chọn."}
          </p>
        </div>
        <div
          className={cn(
            isMobile
              ? "recurring-editor-preview"
              : "flex shrink-0 items-center gap-2.5 text-right text-xs text-[var(--text-muted)]",
          )}
          aria-label="Tóm tắt lịch chạy"
        >
          <CalendarClock
            className={cn(!isMobile && "text-[var(--primary)]")}
            size={16}
          />
          <span
            className={cn(!isMobile && "font-medium text-[var(--foreground)]")}
          >
            {draft.startDate
              ? scheduleDayLabel(Number(draft.startDate.slice(-2)))
              : "Chọn ngày bắt đầu"}
          </span>
        </div>
      </div>

      <div
        className={cn(
          isMobile
            ? "recurring-editor-section recurring-transaction-section"
            : "col-span-2 space-y-4",
        )}
      >
        <div
          className={cn(
            isMobile
              ? "recurring-editor-section-title recurring-desktop-section-title"
              : "flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]",
          )}
        >
          <ArrowLeftRight
            className={cn(!isMobile && "text-[var(--primary)]")}
            size={16}
          />
          <span>Thông tin giao dịch</span>
        </div>
        <Tabs
          value={draft.type}
          onValueChange={(value) =>
            onChange({ type: value as TransactionType, categoryId: "none" })
          }
          className={cn(
            isMobile ? "recurring-type-tabs quick-type-tabs gap-0" : "gap-0",
          )}
        >
          <TabsList
            variant={isMobile ? "default" : "navigation"}
            className={cn(
              isMobile
                ? "recurring-type-switch quick-type-switch w-full rounded-2xl"
                : "grid-cols-3",
            )}
            aria-label="Loại giao dịch"
          >
            {typeOptions.map((option) => {
              const Icon = option.icon;
              return (
                <TabsTrigger
                  value={option.value}
                  data-transaction-type={option.value}
                  variant={isMobile ? "default" : "navigation"}
                  tone={
                    !isMobile
                      ? option.value === "expense"
                        ? "expense"
                        : option.value === "income"
                          ? "income"
                          : undefined
                      : undefined
                  }
                  className={isMobile ? "flex-1 rounded-2xl" : undefined}
                  key={option.value}
                  disabled={option.value === "transfer" && wallets.length < 2}
                >
                  <Icon className="transition-colors" />
                  <span>{option.tabLabel}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
        <div
          className={cn(
            isMobile
              ? "recurring-editor-grid recurring-transaction-grid"
              : "grid grid-cols-[minmax(0,1fr)_13rem] gap-4",
          )}
        >
          <div
            className={
              isMobile ? "recurring-field recurring-field-wide" : undefined
            }
          >
            <Input
              label="Nội dung giao dịch"
              value={draft.description}
              onChange={(event) =>
                onChange({ description: event.target.value })
              }
              placeholder="Nhập nội dung giao dịch"
              maxLength={2_000}
            />
          </div>
          <div
            className={
              isMobile ? "recurring-field recurring-amount-field" : undefined
            }
          >
            <MoneyInput
              label="Số tiền"
              wrapperClassName={isMobile ? "quick-amount-field" : undefined}
              value={draft.amount}
              onValueChange={(amount) => onChange({ amount })}
              placeholder="0"
              aria-label="Số tiền giao dịch định kỳ"
            />
          </div>
        </div>
      </div>

      <div
        className={cn(
          isMobile
            ? "recurring-editor-section recurring-source-section"
            : "space-y-4",
        )}
      >
        <div
          className={cn(
            isMobile
              ? "recurring-editor-section-title"
              : "flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]",
          )}
        >
          <Landmark
            className={cn(!isMobile && "text-[var(--primary)]")}
            size={16}
          />
          <span>Nguồn tiền</span>
        </div>
        <div
          className={cn(
            isMobile
              ? "recurring-editor-grid recurring-source-grid"
              : "space-y-4",
          )}
        >
          <div className={isMobile ? "recurring-field" : undefined}>
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
          </div>
          {draft.type === "transfer" ? (
            <div className={isMobile ? "recurring-field" : undefined}>
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
            </div>
          ) : (
            <div className={isMobile ? "recurring-field" : undefined}>
              <CategoryTreeSelect
                value={draft.categoryId}
                onValueChange={(categoryId) => onChange({ categoryId })}
                label="Danh mục"
                categories={categoriesForTransactionType(
                  categories,
                  draft.type,
                )}
                emptyOption={{ value: "none", label: "Không chọn" }}
              />
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          isMobile
            ? "recurring-editor-section recurring-schedule-section"
            : "space-y-4",
        )}
      >
        <div
          className={cn(
            isMobile
              ? "recurring-editor-section-title"
              : "flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]",
          )}
        >
          <CalendarClock
            className={cn(!isMobile && "text-[var(--primary)]")}
            size={16}
          />
          <span>Lịch chạy</span>
        </div>
        <div
          className={cn(
            isMobile ? "recurring-desktop-schedule-preview" : "hidden",
          )}
          aria-label="Tóm tắt lịch chạy trên desktop"
        >
          <span aria-hidden="true">
            <CalendarClock size={18} />
          </span>
          <div>
            <small>Ghi nhận tự động</small>
            <strong>
              {draft.startDate
                ? scheduleDayLabel(Number(draft.startDate.slice(-2)))
                : "Chọn ngày bắt đầu"}
            </strong>
          </div>
        </div>
        <div
          className={cn(
            isMobile
              ? "recurring-editor-grid recurring-date-grid"
              : "space-y-4",
          )}
        >
          <div className={isMobile ? "recurring-field" : undefined}>
            <DatePicker
              label="Ngày bắt đầu"
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
            <small
              className={cn(
                !isMobile &&
                  "mt-1.5 block text-[0.68rem] leading-4 text-[var(--text-muted)]",
              )}
            >
              Đây cũng là ngày lặp lại hằng tháng.
            </small>
          </div>
          <div className={isMobile ? "recurring-field" : undefined}>
            <DatePicker
              label="Kết thúc"
              value={draft.endDate}
              onValueChange={(endDate) => onChange({ endDate })}
              minDate={draft.startDate}
              allowClear
            />
            <small
              className={cn(
                !isMobile &&
                  "mt-1.5 block text-[0.68rem] leading-4 text-[var(--text-muted)]",
              )}
            >
              Để trống để lịch chạy liên tục.
            </small>
          </div>
        </div>
      </div>
    </section>
  );
}
