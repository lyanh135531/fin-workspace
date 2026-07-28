"use client";

import {
  AlertTriangle,
  Check,
  Pencil,
  Pause,
  Play,
  Plus,
  Repeat2,
  Trash2,
  X,
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
import { Button, Card, Search, Select } from "@/components/base";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Option = { id: string; name: string; color?: string };
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
  { value: "expense", label: "Chi tiêu" },
  { value: "income", label: "Thu nhập" },
  { value: "transfer", label: "Chuyển khoản" },
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
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [busy, startTransition] = useTransition();

  const visibleSchedules = useMemo(
    () => schedules.filter((item) => {
      const displayStatus = item.completedAt ? "completed" : item.status;
      const matchesStatus = status === "all" || displayStatus === status;
      const haystack = `${item.description ?? ""} ${item.wallet} ${item.toWallet ?? ""} ${item.category?.name ?? ""}`.toLocaleLowerCase();
      return matchesStatus && haystack.includes(query.trim().toLocaleLowerCase());
    }),
    [query, schedules, status],
  );
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

      <Card as="section" className="sunrise-card recurring-ledger-card gap-0 py-0">
        <div className="recurring-toolbar">
          <Search
            containerClassName="max-[760px]:col-span-full"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm lịch giao dịch"
            aria-label="Tìm lịch giao dịch"
          />
          <Select
            value={status}
            onValueChange={setStatus}
            label="Lọc trạng thái"
            options={[
              { value: "all", label: "Tất cả" },
              { value: "active", label: "Đang hoạt động" },
              { value: "deactive", label: "Tạm dừng" },
              { value: "completed", label: "Đã kết thúc" },
            ]}
          />
          <Button
            variant="default"
            disabled={busy || Boolean(draft) || wallets.length === 0}
            onClick={beginCreate}
          >
            <Plus size={17} /> Đăng ký
          </Button>
        </div>

        {draft && (
          <RecurringEditor
            mode={editingId ? "edit" : "create"}
            draft={draft}
            wallets={wallets}
            categories={categories}
            busy={busy}
            onChange={(patch) => setDraft((current) => current ? { ...current, ...patch } : current)}
            onCancel={closeEditor}
            onSave={save}
          />
        )}

        {deleteTarget && (
          <Card as="section" className="ledger-confirm-panel recurring-delete-panel gap-0 py-0" aria-labelledby="delete-recurring-title">
            <div>
              <p className="public-eyebrow">Không ảnh hưởng lịch sử</p>
              <h2 id="delete-recurring-title">Xóa “{deleteTarget.description || "giao dịch định kỳ"}”?</h2>
              <p>Các giao dịch đã được ghi vào Sổ giao dịch và số dư hiện tại vẫn được giữ nguyên.</p>
            </div>
            <div className="dialog-actions">
              <Button variant="outline" disabled={busy} onClick={() => setDeleteTarget(null)}>Hủy</Button>
              <Button variant="destructive" disabled={busy} onClick={remove}>{busy ? "Đang xóa" : "Xác nhận xóa"}</Button>
            </div>
          </Card>
        )}

        <div className="recurring-mobile-list" aria-label="Danh sách giao dịch định kỳ">
          {visibleSchedules.map((schedule) => (
            <Card as="article" className="recurring-mobile-card gap-0 py-0" key={schedule.id}>
              <div className="recurring-mobile-heading">
                <div>
                  <strong>{schedule.description || "Không có nội dung"}</strong>
                  <small>{scheduleDayLabel(schedule.dayOfMonth)} · {schedule.occurrenceCount} kỳ</small>
                </div>
                <b className={`ledger-amount amount-${schedule.type}`}>
                  {schedule.type === "income" ? "+" : schedule.type === "expense" ? "−" : "↔"}
                  {formatAmount(schedule.amount)} {workspace.currency === "VND" ? "₫" : workspace.currency}
                </b>
              </div>
              <div className="recurring-mobile-meta">
                <span><small>Ví</small>{schedule.wallet}{schedule.toWallet ? ` → ${schedule.toWallet}` : ""}</span>
                <span><small>Danh mục</small>{schedule.category?.name ?? "Chưa phân loại"}</span>
                <span><small>Lần tới</small>{schedule.completedAt ? "Đã hoàn tất" : dateLabel(schedule.nextExecutionDate)}</span>
                <span><small>Hiệu lực</small>{dateLabel(schedule.startDate)} → {schedule.endDate ? dateLabel(schedule.endDate) : "Không giới hạn"}</span>
              </div>
              <div className="recurring-mobile-footer">
                <div>
                  <span className={`status recurring-status-${schedule.completedAt ? "completed" : schedule.status}`}>
                    {schedule.completedAt ? "Đã kết thúc" : schedule.status === "active" ? "Đang hoạt động" : "Tạm dừng"}
                  </span>
                  {schedule.lastError && <span className="recurring-error" title={schedule.lastError}><AlertTriangle size={13} /> Cần kiểm tra</span>}
                </div>
                <div className="ledger-row-actions">
                  {!schedule.completedAt && <Button variant="outline" size="icon" disabled={busy || Boolean(draft)} onClick={() => toggleStatus(schedule)} title={schedule.status === "active" ? "Tạm dừng" : "Kích hoạt lại"} aria-label={schedule.status === "active" ? "Tạm dừng lịch" : "Kích hoạt lại lịch"}>{schedule.status === "active" ? <Pause size={15} /> : <Play size={15} />}</Button>}
                  <Button variant="outline" size="icon" disabled={busy || Boolean(draft)} onClick={() => beginEdit(schedule)} title="Chỉnh sửa" aria-label="Chỉnh sửa lịch"><Pencil size={15} /></Button>
                  <Button variant="outline" size="icon" className="ledger-delete-button" disabled={busy || Boolean(draft)} onClick={() => setDeleteTarget(schedule)} title="Xóa" aria-label="Xóa lịch"><Trash2 size={15} /></Button>
                </div>
              </div>
            </Card>
          ))}
          {visibleSchedules.length === 0 && !draft && <div className="recurring-mobile-empty">
            <Repeat2 size={23} />
            <strong>{schedules.length ? "Không có lịch phù hợp" : "Chưa có giao dịch định kỳ"}</strong>
            <p>{schedules.length ? "Thử thay đổi bộ lọc hoặc từ khóa." : "Đăng ký khoản lặp lại để hệ thống tự ghi nhận mỗi tháng."}</p>
            {!schedules.length && wallets.length > 0 && <Button variant="outline" onClick={beginCreate}>Tạo đăng ký đầu tiên</Button>}
          </div>}
        </div>

        <div className="recurring-table-wrap">
          <table className="ledger-table recurring-table">
            <thead>
              <tr>
                <th>Giao dịch</th>
                <th>Loại</th>
                <th>Danh mục</th>
                <th>Ví</th>
                <th>Chu kỳ</th>
                <th>Hiệu lực</th>
                <th className="text-right">Số tiền</th>
                <th>Lần tới</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {visibleSchedules.map((schedule) => (
                <tr key={schedule.id}>
                  <td>
                    <p className="font-medium">{schedule.description || "Không có nội dung"}</p>
                    <p className="recurring-row-meta">{schedule.occurrenceCount} kỳ · {schedule.createdBy}</p>
                  </td>
                  <td>{typeOptions.find((option) => option.value === schedule.type)?.label}</td>
                  <td>
                    {schedule.category
                      ? <span className="category-tag" style={{ backgroundColor: `${schedule.category.color}22`, color: schedule.category.color }}>{schedule.category.name}</span>
                      : "—"}
                  </td>
                  <td>
                    <span>{schedule.wallet}</span>
                    {schedule.toWallet && <small className="recurring-wallet-destination">→ {schedule.toWallet}</small>}
                  </td>
                  <td><span className="recurring-day">{scheduleDayLabel(schedule.dayOfMonth)}</span></td>
                  <td>
                    <span className="recurring-effective-range">{dateLabel(schedule.startDate)}</span>
                    <small>đến {schedule.endDate ? dateLabel(schedule.endDate) : "không giới hạn"}</small>
                  </td>
                  <td className={`ledger-amount amount-${schedule.type}`}>
                    {schedule.type === "income" ? "+" : schedule.type === "expense" ? "−" : "↔"}
                    {formatAmount(schedule.amount)} {workspace.currency === "VND" ? "₫" : workspace.currency}
                  </td>
                  <td>
                    <span className="recurring-next-date">
                      {schedule.completedAt ? "Đã hoàn tất" : dateLabel(schedule.nextExecutionDate)}
                    </span>
                    <small>{schedule.completedAt ? dateLabel(schedule.completedAt.slice(0, 10)) : workspace.timeZone}</small>
                  </td>
                  <td>
                    <span className={`status recurring-status-${schedule.completedAt ? "completed" : schedule.status}`}>
                      {schedule.completedAt ? "Đã kết thúc" : schedule.status === "active" ? "Đang hoạt động" : "Tạm dừng"}
                    </span>
                    {schedule.lastError && (
                      <span className="recurring-error" title={schedule.lastError}>
                        <AlertTriangle size={13} /> Cần kiểm tra
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="ledger-row-actions">
                      {!schedule.completedAt && (
                        <Button
                          variant="outline" size="icon"
                          disabled={busy || Boolean(draft)}
                          onClick={() => toggleStatus(schedule)}
                          title={schedule.status === "active" ? "Tạm dừng" : "Kích hoạt lại"}
                          aria-label={schedule.status === "active" ? "Tạm dừng lịch" : "Kích hoạt lại lịch"}
                        >
                          {schedule.status === "active" ? <Pause size={14} /> : <Play size={14} />}
                        </Button>
                      )}
                      <Button
                        variant="outline" size="icon"
                        disabled={busy || Boolean(draft)}
                        onClick={() => beginEdit(schedule)}
                        title="Chỉnh sửa"
                        aria-label="Chỉnh sửa lịch"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="outline" size="icon" className="ledger-delete-button"
                        disabled={busy || Boolean(draft)}
                        onClick={() => setDeleteTarget(schedule)}
                        title="Xóa"
                        aria-label="Xóa lịch"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {visibleSchedules.length === 0 && !draft && (
                <tr>
                  <td colSpan={10}>
                    <div className="recurring-empty">
                      <span><Repeat2 size={22} /></span>
                      <strong>{schedules.length ? "Không có lịch phù hợp" : "Chưa có giao dịch định kỳ"}</strong>
                      <p>{schedules.length ? "Thử thay đổi bộ lọc hoặc từ khóa." : "Đăng ký khoản lương, tiền nhà hoặc đầu tư để hệ thống tự ghi nhận mỗi tháng."}</p>
                      {!schedules.length && wallets.length > 0 && <Button variant="outline" onClick={beginCreate}>Tạo đăng ký đầu tiên</Button>}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="ledger-record-count">Hiển thị {visibleSchedules.length} đăng ký trong {workspace.name}.</p>
      </Card>
    </div>
  );
}

function RecurringEditor({
  mode,
  draft,
  wallets,
  categories,
  busy,
  onChange,
  onCancel,
  onSave,
}: {
  mode: "create" | "edit";
  draft: Draft;
  wallets: Option[];
  categories: Option[];
  busy: boolean;
  onChange: (patch: Partial<Draft>) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <section className="recurring-editor" aria-labelledby="recurring-editor-title">
      <div className="recurring-editor-heading">
        <div>
          <p className="public-eyebrow">{mode === "create" ? "Đăng ký mới" : "Cập nhật chu kỳ"}</p>
          <h2 id="recurring-editor-title">{mode === "create" ? "Thiết lập giao dịch hằng tháng" : "Chỉnh sửa giao dịch định kỳ"}</h2>
        </div>
        <span>Mỗi tháng · theo khoảng hiệu lực</span>
      </div>
      <div className="recurring-editor-grid">
        <label className="recurring-field recurring-field-wide">
          Nội dung
          <Input
            autoFocus
            
            value={draft.description}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="Ví dụ: Lương tháng, tiền thuê nhà"
            maxLength={2_000}
          />
        </label>
        <label className="recurring-field">
          Loại giao dịch
          <Select
            value={draft.type}
            onValueChange={(value) => onChange({ type: value as TransactionType })}
            label="Loại giao dịch"
            options={typeOptions.map((option) => ({
              ...option,
              disabled: option.value === "transfer" && wallets.length < 2,
            }))}
          />
        </label>
        <label className="recurring-field">
          Danh mục
          <Select
            value={draft.categoryId}
            onValueChange={(categoryId) => onChange({ categoryId })}
            label="Danh mục"
            options={[
              { value: "none", label: "Không chọn" },
              ...categories.map((category) => ({ value: category.id, label: category.name })),
            ]}
          />
        </label>
        <label className="recurring-field">
          Ví thực hiện
          <Select
            value={draft.walletId}
            onValueChange={(walletId) => onChange({
              walletId,
              toWalletId: draft.toWalletId === walletId
                ? defaultDestination(wallets, walletId)
                : draft.toWalletId,
            })}
            label="Ví thực hiện"
            options={wallets.map((wallet) => ({ value: wallet.id, label: wallet.name }))}
          />
        </label>
        {draft.type === "transfer" && (
          <label className="recurring-field">
            Ví nhận
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
          </label>
        )}
        <div className="recurring-field">
          <span>Ngày bắt đầu</span>
          <DatePickerField
            label="Chọn ngày bắt đầu"
            value={draft.startDate}
            onValueChange={(startDate) => onChange({
              startDate,
              endDate: draft.endDate && draft.endDate < startDate ? "" : draft.endDate,
            })}
            required
          />
          <small>Ngày này cũng là ngày thực hiện lặp lại mỗi tháng.</small>
        </div>
        <div className="recurring-field">
          <span>Ngày kết thúc</span>
          <DatePickerField
            label="Chọn ngày kết thúc"
            value={draft.endDate}
            onValueChange={(endDate) => onChange({ endDate })}
            minDate={draft.startDate}
            allowClear
          />
          <small>Để trống nếu muốn lịch chạy không giới hạn.</small>
        </div>
        <label className="recurring-field">
          Số tiền
          <Input
            
            inputMode="decimal"
            value={draft.amount}
            onChange={(event) => onChange({ amount: event.target.value })}
            placeholder="0"
          />
        </label>
      </div>
      <div className="recurring-editor-footer">
        <p>Giao dịch đến hạn được ghi nhận ngay, không qua bước phê duyệt.</p>
        <div className="dialog-actions">
          <Button variant="outline" disabled={busy} onClick={onCancel}><X size={15} /> Hủy</Button>
          <Button variant="default" disabled={busy} onClick={onSave}><Check size={15} /> {busy ? "Đang lưu" : "Lưu đăng ký"}</Button>
        </div>
      </div>
    </section>
  );
}
