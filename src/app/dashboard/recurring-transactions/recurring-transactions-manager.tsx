"use client";

import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  CircleDollarSign,
  Ellipsis,
  Landmark,
  Pencil,
  Pause,
  Play,
  Plus,
  Repeat2,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createRecurringTransactionAction,
  deleteRecurringTransactionAction,
  setRecurringTransactionStatusAction,
  updateRecurringTransactionAction,
} from "@/app/dashboard/recurring-transactions/actions";
import { formatAmount } from "@/lib/format";
import {
  Button,
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
import { toast } from "sonner";

type Option = { id: string; name: string; color?: string; icon?: string | null; parentId?: string | null };
type CategoryOption = Option & { type: "income" | "expense" };
type TransactionType = "income" | "expense" | "transfer";
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
  { value: "expense", label: "Chi tiêu", icon: ArrowUpRight },
  { value: "income", label: "Thu nhập", icon: ArrowDownLeft },
  { value: "transfer", label: "Chuyển khoản", icon: ArrowLeftRight },
];

function defaultDestination(wallets: Option[], sourceId: string) {
  return wallets.find((wallet) => wallet.id !== sourceId)?.id ?? sourceId;
}

function categoriesForTransactionType(categories: CategoryOption[], type: TransactionType): CategoryOption[] {
  return type === "transfer" ? [] : categories.filter((category) => category.type === type);
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
    toWalletId: schedule.toWalletId ?? defaultDestination(wallets, schedule.walletId),
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
  return day <= 28 ? `Ngày ${day} hằng tháng` : `Ngày ${day} · cuối tháng nếu thiếu ngày`;
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
  workspace: { id: string; name: string; currency: string; timeZone: string; businessDate: string };
  wallets: Option[];
  categories: CategoryOption[];
  schedules: Schedule[];
}) {
  const [status, setStatus] = useState("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const syncViewport = () => setIsMobile(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  const visibleSchedules = useMemo(
    () => schedules.filter((item) => {
      const displayStatus = item.completedAt ? "completed" : item.status;
      return status === "all" || displayStatus === status;
    }),
    [schedules, status],
  );
  const activeCount = schedules.filter((item) => !item.completedAt && item.status === "active").length;
  const pausedCount = schedules.filter((item) => !item.completedAt && item.status === "deactive").length;
  const completedCount = schedules.filter((item) => Boolean(item.completedAt)).length;
  const errorCount = schedules.filter((item) => Boolean(item.lastError)).length;
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
        toast.success(editingId ? "Đã cập nhật giao dịch định kỳ." : "Đã đăng ký giao dịch định kỳ.");
        closeEditor();
      } else {
        toast.error(result.message);
      }
    });
  }

  function toggleStatus(schedule: Schedule) {
    const nextStatus = schedule.status === "active" ? "deactive" : "active";
    startTransition(async () => {
      const result = await setRecurringTransactionStatusAction(schedule.id, nextStatus);
      if (result.ok) {
        toast.success(nextStatus === "active" ? "Đã kích hoạt lại lịch." : "Đã tạm dừng lịch.");
      } else {
        toast.error(result.message);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteRecurringTransactionAction(id);
      if (result.ok) {
        toast.success("Đã xóa đăng ký. Các giao dịch đã phát sinh được giữ nguyên.");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="recurring-page">
      <PageHeader
        className="recurring-page-header"
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
          <span className="recurring-create-label-mobile">Tạo lịch</span>
        </Button>
      </PageHeader>

      <section className="recurring-summary" aria-label="Tổng quan giao dịch định kỳ">
        <div className="recurring-summary-primary">
          <span className="recurring-summary-icon" aria-hidden><Repeat2 size={20} /></span>
          <div>
            <p>Đang tự động</p>
            <strong>{activeCount}</strong>
            <small>lịch đang hoạt động</small>
          </div>
        </div>
        <dl className="recurring-summary-details">
          <div><dt>Tổng số lịch</dt><dd>{schedules.length}</dd></div>
          <div><dt>Tạm dừng</dt><dd>{pausedCount}</dd></div>
          <div><dt>Đã kết thúc</dt><dd>{completedCount}</dd></div>
          <div className={errorCount ? "has-error" : ""}><dt>Cần kiểm tra</dt><dd>{errorCount}</dd></div>
        </dl>
      </section>

      <nav className="recurring-mobile-filters" aria-label="Lọc giao dịch định kỳ">
        {[
          { value: "all", label: "Tất cả", count: schedules.length },
          { value: "active", label: "Đang chạy", count: activeCount },
          { value: "deactive", label: "Tạm dừng", count: pausedCount },
          { value: "completed", label: "Đã xong", count: completedCount },
        ].map((filter) => (
          <button
            type="button"
            className="recurring-mobile-filter"
            data-active={status === filter.value}
            aria-pressed={status === filter.value}
            onClick={() => setStatus(filter.value)}
            key={filter.value}
          >
            {filter.label} <span>{filter.count}</span>
          </button>
        ))}
      </nav>

      <section className="recurring-ledger-card" aria-labelledby="recurring-list-title">
        <div className="recurring-list-heading">
          <div>
            <h2 id="recurring-list-title">Lịch tự động</h2>
            <p>{visibleSchedules.length} lịch trong {workspace.name}</p>
          </div>
          <div className="recurring-toolbar">
            <Select
              value={status}
              onValueChange={setStatus}
              options={[
                { value: "all", label: "Tất cả trạng thái" },
                { value: "active", label: "Đang hoạt động" },
                { value: "deactive", label: "Tạm dừng" },
                { value: "completed", label: "Đã kết thúc" },
              ]}
            />
          </div>
        </div>

        <Sheet
          open={draft !== null}
          onOpenChange={(open) => {
            if (!open) closeEditor();
          }}
        >
          <SheetContent side={isMobile ? "bottom" : "right"} className="recurring-sheet-content w-full gap-0 border-l border-[var(--border)] bg-[var(--surface)] p-0 sm:!w-[min(100vw,46rem)] sm:!max-w-none">
            <SheetHeader className="recurring-sheet-header border-b border-border px-6 py-3.5 pr-14">
              <SheetTitle className="text-lg font-semibold tracking-tight">
                {editingId ? "Chỉnh sửa giao dịch định kỳ" : "Tạo giao dịch định kỳ"}
              </SheetTitle>
              <SheetDescription className="mt-1 text-xs leading-5">
                Giao dịch sẽ tự động ghi nhận mỗi tháng theo lịch bạn chọn.
              </SheetDescription>
            </SheetHeader>
            {draft && (
              <div className="recurring-sheet-body min-h-0 flex-1 overflow-y-auto px-6">
                <RecurringEditor
                  mode={editingId ? "edit" : "create"}
                  draft={draft}
                  wallets={wallets}
                  categories={categories}
                  onChange={(patch) => setDraft((current) => current ? { ...current, ...patch } : current)}
                />
              </div>
            )}
            <SheetFooter className="recurring-sheet-footer shrink-0 flex-row justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4">
              <Button variant="outline" disabled={busy} onClick={closeEditor}>Hủy</Button>
              <Button variant="default" disabled={busy} onClick={save}>
                {busy ? <Loading label="Đang lưu..." /> : "Lưu đăng ký"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <div className="recurring-schedule-list recurring-desktop-schedule-list" aria-label="Danh sách giao dịch định kỳ">
          {visibleSchedules.map((schedule) => (
            <article className="recurring-schedule-row" key={schedule.id}>
              <div className="recurring-schedule-main">
                <div className="recurring-schedule-badges">
                  <span>{typeOptions.find((option) => option.value === schedule.type)?.label}</span>
                  <span className={`status recurring-status-${schedule.completedAt ? "completed" : schedule.status}`}>
                    {schedule.completedAt ? "Đã kết thúc" : schedule.status === "active" ? "Đang hoạt động" : "Tạm dừng"}
                  </span>
                  {schedule.lastError && <span className="recurring-error" title={schedule.lastError}><AlertTriangle size={12} /> Cần kiểm tra</span>}
                </div>
                <h3>{schedule.description || "Không có nội dung"}</h3>
                <p>{schedule.wallet}{schedule.toWallet ? ` → ${schedule.toWallet}` : ""}<span>·</span>{schedule.category?.name ?? "Chưa phân loại"}</p>
              </div>
              <dl className="recurring-schedule-timing">
                <div><dt>Lặp lại</dt><dd>{scheduleDayLabel(schedule.dayOfMonth)}</dd></div>
                <div><dt>Lần tiếp theo</dt><dd>{schedule.completedAt ? "Đã hoàn tất" : dateLabel(schedule.nextExecutionDate)}</dd></div>
                <div><dt>Hiệu lực</dt><dd>{dateLabel(schedule.startDate)} → {schedule.endDate ? dateLabel(schedule.endDate) : "Không giới hạn"}</dd></div>
              </dl>
              <div className="recurring-schedule-end">
                <strong className={`ledger-amount amount-${schedule.type}`}>
                  {schedule.type === "income" ? "+" : schedule.type === "expense" ? "−" : "↔"}{formatAmount(schedule.amount)} <small>{workspace.currency}</small>
                </strong>
                <p>{schedule.occurrenceCount} kỳ đã ghi nhận</p>
                <div className="ledger-row-actions flex items-center gap-3">
                  {!schedule.completedAt && <Button variant="unstyled" size="auto" type="button" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" disabled={busy || Boolean(draft)} onClick={() => toggleStatus(schedule)} title={schedule.status === "active" ? "Tạm dừng" : "Kích hoạt lại"} aria-label={schedule.status === "active" ? "Tạm dừng lịch" : "Kích hoạt lại lịch"}>{schedule.status === "active" ? <Pause size={16} /> : <Play size={16} />}</Button>}
                  <Button variant="unstyled" size="auto" type="button" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" disabled={busy || Boolean(draft)} onClick={() => beginEdit(schedule)} title="Chỉnh sửa" aria-label="Chỉnh sửa lịch"><Pencil size={16} /></Button>
                  <ConfirmDelete
                    ariaLabel="Xóa lịch"
                    title="Xóa lịch giao dịch?"
                    description={`“${schedule.description || "Giao dịch định kỳ"}” sẽ ngừng chạy. Các giao dịch đã ghi nhận vẫn được giữ nguyên.`}
                    onConfirm={() => remove(schedule.id)}
                    disabled={busy || Boolean(draft)}
                    className="!p-0 !w-auto !h-auto !bg-transparent hover:!bg-transparent text-slate-400 hover:!text-rose-500 transition-colors [&_svg]:size-[16px]"
                  />
                </div>
              </div>
            </article>
          ))}
          {visibleSchedules.length === 0 && !draft && (
            <Empty
              icon={Repeat2}
              title={schedules.length ? "Không có lịch phù hợp" : "Chưa có giao dịch định kỳ"}
              description={
                schedules.length
                  ? "Thử thay đổi bộ lọc hoặc từ khóa."
                  : "Đăng ký khoản lặp lại để hệ thống tự ghi nhận mỗi tháng."
              }
            />
          )}
        </div>

        <div className="recurring-mobile-schedule-list" aria-label="Danh sách giao dịch định kỳ trên di động">
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
          {visibleSchedules.length === 0 && !draft && (
            <Empty
              icon={Repeat2}
              title={schedules.length ? "Không có lịch phù hợp" : "Chưa có giao dịch định kỳ"}
              description={
                schedules.length
                  ? "Chọn trạng thái khác để xem các lịch còn lại."
                  : "Tạo lịch đầu tiên để Fin tự ghi nhận khoản lặp lại mỗi tháng."
              }
            />
          )}
        </div>
      </section>
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
  const amountPrefix = schedule.type === "income" ? "+" : schedule.type === "expense" ? "−" : "↔";
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
        <div className="recurring-mobile-card-status">
          <span className={`status recurring-status-${schedule.completedAt ? "completed" : schedule.status}`}>
            {statusLabel}
          </span>
          {schedule.lastError && <span className="recurring-error"><AlertTriangle size={12} /> Cần kiểm tra</span>}
        </div>
        <h3>{schedule.description || "Không có nội dung"}</h3>
        <p>{schedule.wallet}{schedule.toWallet ? ` → ${schedule.toWallet}` : ""}</p>
      </div>
      <div className="recurring-mobile-card-amount">
        <strong className={`ledger-amount amount-${schedule.type}`}>
          {amountPrefix}{formatAmount(schedule.amount)} <small>{currency}</small>
        </strong>
        <Ellipsis size={18} aria-hidden="true" />
      </div>
      <footer className="recurring-mobile-card-footer">
        <span>{scheduleDayLabel(schedule.dayOfMonth)}</span>
        <span>{schedule.category?.name ?? "Chưa phân loại"}</span>
        <small>{schedule.occurrenceCount} kỳ đã ghi nhận</small>
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
              className="recurring-mobile-card"
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

        <DropdownMenuContent align="center" side="bottom" sideOffset={6} className="recurring-mobile-context-menu">
          {!schedule.completedAt && (
            <DropdownMenuItem disabled={busy} onClick={() => run(onToggle)}>
              {schedule.status === "active" ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
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
        <SheetContent side="bottom" className="recurring-delete-sheet" aria-label="Xác nhận xóa lịch giao dịch">
          <SheetHeader className="recurring-delete-sheet-header">
            <span className="recurring-delete-sheet-icon" aria-hidden="true"><Trash2 size={18} /></span>
            <div>
              <SheetTitle>Xóa lịch giao dịch?</SheetTitle>
              <SheetDescription>Các giao dịch đã ghi nhận vẫn được giữ nguyên.</SheetDescription>
            </div>
          </SheetHeader>
          <div className="recurring-delete-sheet-body">
            <span>{schedule.description || "Giao dịch định kỳ"}</span>
            <strong className={`amount-${schedule.type}`}>{amountPrefix}{formatAmount(schedule.amount)} {currency}</strong>
          </div>
          <SheetFooter className="recurring-delete-sheet-footer">
            <Button variant="outline" disabled={busy} onClick={() => setDeleteOpen(false)}>Giữ lại</Button>
            <Button variant="destructive" disabled={busy} onClick={() => { setDeleteOpen(false); onDelete(); }}>
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
      className="recurring-editor !m-0 !rounded-none !border-0 !bg-transparent !px-0 !py-5 !shadow-none"
      aria-label={mode === "create" ? "Tạo giao dịch định kỳ" : "Chỉnh sửa giao dịch định kỳ"}
    >
      <div className="recurring-editor-intro">
        <div>
          <span className="recurring-editor-kicker"><Repeat2 size={13} /> LỊCH HẰNG THÁNG</span>
          <p>Fin tự ghi nhận đúng ngày.</p>
        </div>
        <div className="recurring-editor-preview" aria-label="Tóm tắt lịch chạy">
          <CalendarClock size={16} />
          <span>{draft.startDate ? scheduleDayLabel(Number(draft.startDate.slice(-2))) : "Chọn ngày bắt đầu"}</span>
        </div>
      </div>

      <div className="recurring-editor-section">
        <div className="recurring-editor-section-title"><CircleDollarSign size={16} /><span>Giao dịch</span></div>
        <Tabs
          value={draft.type}
          onValueChange={(value) => onChange({ type: value as TransactionType, categoryId: "none" })}
          className="gap-0"
        >
          <TabsList className="w-full" aria-label="Loại giao dịch">
            {typeOptions.map((option) => {
              const Icon = option.icon;
              const stateClass = option.value === "expense"
                ? "data-active:bg-rose-50/70 dark:data-active:bg-rose-950/30 data-active:text-rose-600 dark:data-active:text-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 hover:text-rose-600 dark:hover:text-rose-400"
                : option.value === "income"
                  ? "data-active:bg-emerald-50/70 dark:data-active:bg-emerald-950/30 data-active:text-emerald-600 dark:data-active:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 hover:text-emerald-600 dark:hover:text-emerald-400"
                  : "data-active:bg-[var(--primary-soft)] data-active:text-[var(--primary)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]";
              return (
                <TabsTrigger
                  value={option.value}
                  className={`flex-1 ${stateClass}`}
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
        <div className="recurring-editor-grid recurring-transaction-grid">
          <div className="recurring-field recurring-field-wide">
            <Input
              label="Nội dung giao dịch"
              autoFocus
              value={draft.description}
              onChange={(event) => onChange({ description: event.target.value })}
              placeholder="Nhập nội dung giao dịch"
              maxLength={2_000}
            />
          </div>
          <div className="recurring-field">
            <MoneyInput label="Số tiền" value={draft.amount} onValueChange={(amount) => onChange({ amount })} placeholder="0" />
          </div>
        </div>
      </div>

      <div className="recurring-editor-section">
        <div className="recurring-editor-section-title"><Landmark size={16} /><span>Nguồn tiền</span></div>
        <div className="recurring-editor-grid recurring-source-grid">
          <div className="recurring-field">
            <Select
              value={draft.walletId}
              onValueChange={(walletId) => onChange({ walletId, toWalletId: draft.toWalletId === walletId ? defaultDestination(wallets, walletId) : draft.toWalletId })}
              label="Ví thực hiện"
              options={wallets.map((wallet) => ({ value: wallet.id, label: wallet.name }))}
            />
          </div>
          {draft.type === "transfer" ? (
            <div className="recurring-field">
              <Select
                value={draft.toWalletId}
                onValueChange={(toWalletId) => onChange({ toWalletId })}
                label="Ví nhận"
                options={wallets.map((wallet) => ({ value: wallet.id, label: wallet.name, disabled: wallet.id === draft.walletId }))}
              />
            </div>
          ) : (
            <div className="recurring-field">
              <CategoryTreeSelect
                value={draft.categoryId}
                onValueChange={(categoryId) => onChange({ categoryId })}
                label="Danh mục"
                categories={categoriesForTransactionType(categories, draft.type)}
                emptyOption={{ value: "none", label: "Không chọn" }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="recurring-editor-section recurring-schedule-section">
        <div className="recurring-editor-section-title"><CalendarClock size={16} /><span>Lịch chạy</span></div>
        <div className="recurring-editor-grid recurring-date-grid">
          <div className="recurring-field">
            <DatePicker
              label="Ngày bắt đầu"
              value={draft.startDate}
              onValueChange={(startDate) => onChange({ startDate, endDate: draft.endDate && draft.endDate < startDate ? "" : draft.endDate })}
              required
            />
            <small>Đây cũng là ngày lặp lại hằng tháng.</small>
          </div>
          <div className="recurring-field">
            <DatePicker label="Kết thúc" value={draft.endDate} onValueChange={(endDate) => onChange({ endDate })} minDate={draft.startDate} allowClear />
            <small>Để trống để lịch chạy liên tục.</small>
          </div>
        </div>
      </div>
    </section>
  );
}
