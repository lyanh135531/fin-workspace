"use client";

import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  CircleDollarSign,
  Landmark,
  Pencil,
  Pause,
  Play,
  Plus,
  Repeat2,
  Trash2,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import {
  createRecurringTransactionAction,
  deleteRecurringTransactionAction,
  setRecurringTransactionStatusAction,
  updateRecurringTransactionAction,
} from "@/app/dashboard/recurring-transactions/actions";
import { DatePickerField } from "@/components/finance/date-picker-field";
import { formatAmount } from "@/lib/format";
import {
  Button,
  CategoryTreeSelect,
  Card,
  Empty,
  Input,
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
import { toast } from "sonner";

type Option = { id: string; name: string; color?: string; icon?: string | null; parentId?: string | null };
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

export function RecurringTransactionsManager({
  workspace,
  wallets,
  categories,
  schedules,
}: {
  workspace: { id: string; name: string; currency: string; timeZone: string; businessDate: string };
  wallets: Option[];
  categories: Option[];
  schedules: Schedule[];
}) {
  const [status, setStatus] = useState("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [busy, startTransition] = useTransition();

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
    setDeleteTarget(null);
    setDraft(emptyDraft(wallets, workspace.businessDate));
  }

  function beginEdit(schedule: Schedule) {
    setEditingId(schedule.id);
    setDeleteTarget(null);
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

  function remove() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteRecurringTransactionAction(deleteTarget.id);
      if (result.ok) {
        toast.success("Đã xóa đăng ký. Các giao dịch đã phát sinh được giữ nguyên.");
        setDeleteTarget(null);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="recurring-page">
      <PageHeader
        title="Giao dịch định kỳ"
        description="Tự động ghi nhận các khoản thu, chi và chuyển tiền lặp lại mỗi tháng."
      >
        <Button
          variant="default"
          disabled={busy || Boolean(draft) || wallets.length === 0}
          onClick={beginCreate}
        >
          <Plus size={16} /> Tạo lịch mới
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
              label="Lọc trạng thái"
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
          <SheetContent side="right" className="w-full gap-0 border-l border-[var(--border)] bg-[var(--surface)] p-0 sm:!w-[min(100vw,46rem)] sm:!max-w-none">
            <SheetHeader className="border-b border-border px-6 py-3.5 pr-14">
              <SheetTitle className="text-lg font-semibold tracking-tight">
                {editingId ? "Chỉnh sửa giao dịch định kỳ" : "Tạo giao dịch định kỳ"}
              </SheetTitle>
              <SheetDescription className="mt-1 text-xs leading-5">
                Giao dịch sẽ tự động ghi nhận mỗi tháng theo lịch bạn chọn.
              </SheetDescription>
            </SheetHeader>
            {draft && (
              <div className="min-h-0 flex-1 overflow-y-auto px-6">
                <RecurringEditor
                  mode={editingId ? "edit" : "create"}
                  draft={draft}
                  wallets={wallets}
                  categories={categories}
                  onChange={(patch) => setDraft((current) => current ? { ...current, ...patch } : current)}
                />
              </div>
            )}
            <SheetFooter className="shrink-0 flex-row justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4">
              <Button variant="outline" disabled={busy} onClick={closeEditor}>Hủy</Button>
              <Button variant="default" disabled={busy} onClick={save}>{busy ? "Đang lưu" : "Lưu đăng ký"}</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <div className="recurring-schedule-list" aria-label="Danh sách giao dịch định kỳ">
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
                <div className="ledger-row-actions">
                  {!schedule.completedAt && <Button variant="outline" size="icon" disabled={busy || Boolean(draft)} onClick={() => toggleStatus(schedule)} title={schedule.status === "active" ? "Tạm dừng" : "Kích hoạt lại"} aria-label={schedule.status === "active" ? "Tạm dừng lịch" : "Kích hoạt lại lịch"}>{schedule.status === "active" ? <Pause size={15} /> : <Play size={15} />}</Button>}
                  <Button variant="outline" size="icon" disabled={busy || Boolean(draft)} onClick={() => beginEdit(schedule)} title="Chỉnh sửa" aria-label="Chỉnh sửa lịch"><Pencil size={15} /></Button>
                  <Button variant="outline" size="icon" className="ledger-delete-button" disabled={busy || Boolean(draft)} onClick={() => setDeleteTarget(schedule)} title="Xóa" aria-label="Xóa lịch"><Trash2 size={15} /></Button>
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
      </section>

      {deleteTarget && (
        <div className="wallet-modal-overlay fixed inset-0 z-[60] grid place-items-center bg-[var(--overlay)] p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="delete-recurring-title">
          <Card as="section" className="wallet-modal-panel gap-0 w-full max-w-md space-y-4 p-6">
            <div className="flex items-start gap-3">
              <span className="ws-danger-icon shrink-0"><Trash2 size={19} /></span>
              <div><h2 id="delete-recurring-title" className="text-lg font-semibold">Xóa lịch giao dịch?</h2><p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">“{deleteTarget.description || "Giao dịch định kỳ"}” sẽ ngừng chạy. Các giao dịch đã ghi nhận vẫn được giữ nguyên.</p></div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
              <Button variant="outline" disabled={busy} onClick={() => setDeleteTarget(null)}>Hủy</Button>
              <Button variant="destructive" disabled={busy} onClick={remove}>{busy ? "Đang xóa" : "Xác nhận xóa"}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
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
  categories: Option[];
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
          onValueChange={(value) => onChange({ type: value as TransactionType })}
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
            <span>Nội dung giao dịch</span>
            <Input
              autoFocus
              value={draft.description}
              onChange={(event) => onChange({ description: event.target.value })}
              placeholder="Nhập nội dung giao dịch"
              maxLength={2_000}
            />
          </div>
          <div className="recurring-field">
            <span>Số tiền</span>
            <MoneyInput value={draft.amount} onValueChange={(amount) => onChange({ amount })} placeholder="0" />
          </div>
        </div>
      </div>

      <div className="recurring-editor-section">
        <div className="recurring-editor-section-title"><Landmark size={16} /><span>Nguồn tiền</span></div>
        <div className="recurring-editor-grid recurring-source-grid">
          <div className="recurring-field">
            <span>Ví thực hiện</span>
            <Select
              value={draft.walletId}
              onValueChange={(walletId) => onChange({ walletId, toWalletId: draft.toWalletId === walletId ? defaultDestination(wallets, walletId) : draft.toWalletId })}
              label="Ví thực hiện"
              options={wallets.map((wallet) => ({ value: wallet.id, label: wallet.name }))}
            />
          </div>
          {draft.type === "transfer" ? (
            <div className="recurring-field">
              <span>Ví nhận</span>
              <Select
                value={draft.toWalletId}
                onValueChange={(toWalletId) => onChange({ toWalletId })}
                label="Ví nhận"
                options={wallets.map((wallet) => ({ value: wallet.id, label: wallet.name, disabled: wallet.id === draft.walletId }))}
              />
            </div>
          ) : (
            <div className="recurring-field">
              <span>Danh mục</span>
              <CategoryTreeSelect
                value={draft.categoryId}
                onValueChange={(categoryId) => onChange({ categoryId })}
                label="Danh mục"
                categories={categories}
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
            <span>Ngày bắt đầu</span>
            <DatePickerField
              label="Chọn ngày bắt đầu"
              value={draft.startDate}
              onValueChange={(startDate) => onChange({ startDate, endDate: draft.endDate && draft.endDate < startDate ? "" : draft.endDate })}
              required
            />
            <small>Đây cũng là ngày lặp lại hằng tháng.</small>
          </div>
          <div className="recurring-field">
            <span>Kết thúc</span>
            <DatePickerField label="Chọn ngày kết thúc" value={draft.endDate} onValueChange={(endDate) => onChange({ endDate })} minDate={draft.startDate} allowClear />
            <small>Để trống để lịch chạy liên tục.</small>
          </div>
        </div>
      </div>
    </section>
  );
}
