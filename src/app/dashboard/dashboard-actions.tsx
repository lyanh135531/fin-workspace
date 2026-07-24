"use client";

import { format } from "date-fns";
import { Check, Download, Pencil, Plus, Search, Trash2, WalletCards, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  addTransactionAction,
  addWalletAction,
  approveTransactionAction,
  deleteTransactionAction,
  deleteTransactionsAction,
  updateTransactionsAction,
} from "@/app/dashboard/actions";
import { FinanceSelect } from "@/components/finance/finance-select";
import { formatAmount } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Option = { id: string; name: string; color?: string };
type TransactionType = "income" | "expense" | "transfer";
type LedgerItem = {
  id: string;
  amount: string;
  type: TransactionType;
  status: "pending" | "scheduled" | "approved" | "rejected";
  description: string | null;
  date: string;
  walletId: string;
  toWalletId: string | null;
  categoryId: string | null;
  wallet: string;
  category: { name: string; color: string } | null;
  member: string;
  hasPendingChange: boolean;
  isRecurring: boolean;
};
type TransactionDraft = {
  description: string;
  type: TransactionType;
  categoryId: string;
  walletId: string;
  toWalletId: string;
  date: string;
  amount: string;
};

const typeOptions = [
  { value: "expense", label: "Chi tiêu" },
  { value: "income", label: "Thu nhập" },
  { value: "transfer", label: "Chuyển khoản" },
];

function defaultDestination(wallets: Option[], sourceId: string) {
  return wallets.find((wallet) => wallet.id !== sourceId)?.id ?? sourceId;
}

function newTransactionDraft(wallets: Option[], categories: Option[]): TransactionDraft {
  const walletId = wallets[0]?.id ?? "";
  return {
    description: "",
    type: "expense",
    categoryId: categories[0]?.id ?? "none",
    walletId,
    toWalletId: defaultDestination(wallets, walletId),
    date: format(new Date(), "yyyy-MM-dd"),
    amount: "",
  };
}

function draftFromTransaction(item: LedgerItem, wallets: Option[]): TransactionDraft {
  return {
    description: item.description ?? "",
    type: item.type,
    categoryId: item.categoryId ?? "none",
    walletId: item.walletId,
    toWalletId: item.toWalletId ?? defaultDestination(wallets, item.walletId),
    date: item.date.slice(0, 10),
    amount: item.amount,
  };
}

function transactionInput(draft: TransactionDraft) {
  return {
    walletId: draft.walletId,
    toWalletId: draft.type === "transfer" ? draft.toWalletId : undefined,
    categoryId: draft.categoryId === "none" ? undefined : draft.categoryId,
    type: draft.type,
    amount: draft.amount,
    description: draft.description || undefined,
    date: draft.date,
  };
}

function isChanged(item: LedgerItem, draft: TransactionDraft) {
  return item.description !== (draft.description || null)
    || item.type !== draft.type
    || item.categoryId !== (draft.categoryId === "none" ? null : draft.categoryId)
    || item.walletId !== draft.walletId
    || item.toWalletId !== (draft.type === "transfer" ? draft.toWalletId : null)
    || item.date.slice(0, 10) !== draft.date
    || item.amount !== draft.amount;
}

function WalletAction({ canManageWallets }: { canManageWallets: boolean }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const actionsRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !editorRef.current) return;
    const priorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const editor = editorRef.current;
    editor.querySelector<HTMLElement>("input")?.focus();
    function handleKeyDown(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || editor.contains(target) || actionsRef.current?.contains(target)) return;
      setOpen(false);
    }
    editor.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => { editor.removeEventListener("keydown", handleKeyDown); document.removeEventListener("pointerdown", handlePointerDown, true); priorFocus?.focus(); };
  }, [open]);

  function createWallet(data: FormData) {
    start(async () => {
      const result = await addWalletAction({ name: data.get("name"), openingBalance: data.get("openingBalance"), description: data.get("description") || undefined });
      setMessage(result.ok ? "Đã tạo ví." : result.message ?? "Không thể tạo ví.");
      if (result.ok) setOpen(false);
    });
  }

  return <>
    <div ref={actionsRef} className="ledger-wallet-action">
      <button disabled={!canManageWallets} aria-label="Thêm ví" title={canManageWallets ? "Thêm ví" : "Chỉ Admin được quản lý ví"} onClick={() => setOpen(true)} className="button-secondary icon-button"><WalletCards size={18}/></button>
    </div>
    {message && <p className="ledger-action-message" role="status">{message}</p>}
    {open && <div ref={editorRef} className="ledger-inline-editor ledger-inline-editor-wallet" role="region" aria-labelledby="wallet-action-title">
      <form action={createWallet} className="sunrise-card dialog-card">
        <div><p className="public-eyebrow">Quản lý ví</p><h2 id="wallet-action-title">Thêm ví</h2></div>
        <Field name="name" label="Tên ví"/>
        <Field name="openingBalance" label="Số dư đầu kỳ" inputMode="decimal"/>
        <Field name="description" label="Ghi chú" required={false}/>
        <div className="dialog-actions"><button type="button" onClick={() => setOpen(false)} className="button-secondary">Hủy</button><button disabled={pending} className="button-primary">{pending ? "Đang lưu" : "Lưu"}</button></div>
      </form>
    </div>}
  </>;
}

function Field({ name, label, required = true, inputMode }: { name: string; label: string; required?: boolean; inputMode?: "decimal" }) {
  return <label>{label}<Input required={required} name={name} inputMode={inputMode} /></label>;
}

export function Ledger({ workspaceId, transactions, canApprove, canEditTransactions, isAdmin, scopeLabel, wallets, categories, canManageWallets, readonly = false }: { workspaceId: string; transactions: LedgerItem[]; canApprove: boolean; canEditTransactions: boolean; isAdmin: boolean; scopeLabel: string; wallets: Option[]; categories: Option[]; canManageWallets: boolean; readonly?: boolean }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LedgerItem | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [createDraft, setCreateDraft] = useState<TransactionDraft | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editDrafts, setEditDrafts] = useState<Record<string, TransactionDraft>>({});
  const [editReason, setEditReason] = useState("");
  const [busy, start] = useTransition();
  const rows = useMemo(() => transactions.filter((item) => (status === "all" || item.status === status) && `${item.description ?? ""} ${item.category?.name ?? ""} ${item.wallet} ${item.member}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [transactions, query, status]);
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const columnCount = canApprove ? 9 : 8;

  function exportCsv() {
    const csv = ["Ngày,Loại,Danh mục,Ví,Số tiền,Trạng thái,Ghi chú", ...rows.map((item) => [new Date(item.date).toLocaleDateString("vi-VN"), item.type, item.category?.name ?? "", item.wallet, item.amount, item.status, item.description ?? ""].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))].join("\n");
    const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })); anchor.download = "so-thu-chi.csv"; anchor.click(); URL.revokeObjectURL(anchor.href);
  }

  function toggle(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function toggleAll() { setSelected((current) => { const next = new Set(current); if (allSelected) rows.forEach((row) => next.delete(row.id)); else rows.forEach((row) => next.add(row.id)); return next; }); }
  function removeBulk() {
    const ids = [...selected]; if (!ids.length) return;
    start(async () => {
      const result = await deleteTransactionsAction(ids);
      if (result.ok) {
        toast.success(`Đã xóa ${ids.length} giao dịch.`);
        setSelected(new Set());
        setConfirmBulkDelete(false);
      } else {
        toast.error(result.message ?? "Không thể xóa giao dịch.");
      }
    });
  }
  function removeOne() {
    if (!deleteTarget) return;
    start(async () => {
      const result = await deleteTransactionAction(deleteTarget.id, deleteReason);
      if (result.ok) {
        toast.success(result.kind === "requested" ? "Đã gửi yêu cầu xóa đến Admin." : "Đã xóa giao dịch và cập nhật lại số dư ví.");
        setDeleteTarget(null);
        setDeleteReason("");
      } else {
        toast.error(result.message ?? "Không thể xử lý yêu cầu xóa.");
      }
    });
  }
  function beginCreate() {
    setEditMode(false);
    setEditDrafts({});
    setCreateDraft(newTransactionDraft(wallets, categories));
  }
  function saveCreate() {
    if (!createDraft) return;
    start(async () => {
      const result = await addTransactionAction(transactionInput(createDraft));
      if (result.ok) {
        toast.success(result.status === "pending" ? "Đã gửi giao dịch quá khứ để Admin duyệt." : result.status === "scheduled" ? "Đã lên lịch giao dịch tương lai." : "Đã ghi nhận giao dịch và cập nhật số dư ví.");
        setCreateDraft(null);
      } else {
        toast.error(result.message ?? "Không thể lưu giao dịch.");
      }
    });
  }
  function beginEdit() {
    setCreateDraft(null);
    setDeleteTarget(null);
    setEditDrafts(Object.fromEntries(transactions.map((item) => [item.id, draftFromTransaction(item, wallets)])));
    setEditReason("");
    setEditMode(true);
  }
  function cancelEdit() {
    setEditMode(false);
    setEditDrafts({});
    setEditReason("");
  }
  function updateDraft(id: string, patch: Partial<TransactionDraft>) {
    setEditDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }
  function saveEdits() {
    const changes = transactions.flatMap((item) => {
      const draft = editDrafts[item.id];
      return draft && isChanged(item, draft) ? [{ transactionId: item.id, input: transactionInput(draft) }] : [];
    });
    if (!changes.length) { toast.info("Không có thay đổi để lưu."); cancelEdit(); return; }
    start(async () => {
      const result = await updateTransactionsAction(workspaceId, changes, editReason);
      if (result.ok) {
        toast.success(result.requested ? `Đã gửi ${result.requested} yêu cầu sửa đến Admin.` : `Đã lưu ${result.updated} giao dịch.`);
      } else {
        toast.error(result.message ?? "Không thể lưu các thay đổi.");
      }
      if (result.ok || (result.updated ?? 0) + (result.requested ?? 0) > 0) cancelEdit();
    });
  }

  return <div className="ledger-shell">
    <div className="ledger-toolbar">
      <label className="ledger-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} disabled={editMode} placeholder="Tìm giao dịch" aria-label="Tìm giao dịch hoặc ghi chú"/></label>
      <FinanceSelect value={status} onValueChange={setStatus} disabled={editMode} className="ledger-status" label="Lọc trạng thái" options={[{ value: "all", label: "Tất cả" }, { value: "approved", label: "Đã ghi nhận" }, { value: "pending", label: "Chờ xác nhận" }, { value: "scheduled", label: "Đã lên lịch" }, { value: "rejected", label: "Đã từ chối" }]}/>
      <button className="button-secondary icon-button" disabled={editMode} onClick={exportCsv} title="Xuất CSV" aria-label="Xuất CSV"><Download size={16}/></button>
      {canApprove && <button className="button-secondary icon-button ledger-delete-button" disabled={editMode || !selected.size || busy} onClick={() => setConfirmBulkDelete(true)} title={selected.size ? `Xóa ${selected.size} giao dịch đã chọn` : "Chọn giao dịch để xóa"} aria-label="Xóa giao dịch đã chọn"><Trash2 size={16}/></button>}
      {canEditTransactions && (editMode ? <div className="ledger-edit-actions"><button className="button-secondary" disabled={busy} onClick={cancelEdit}><X size={15}/>Hủy</button><button className="button-primary" disabled={busy} onClick={saveEdits}><Check size={15}/>{busy ? "Đang lưu" : "Lưu"}</button></div> : <button className="button-secondary icon-button" disabled={busy || !transactions.length || Boolean(createDraft)} onClick={beginEdit} title="Chỉnh sửa tất cả giao dịch" aria-label="Chỉnh sửa tất cả giao dịch"><Pencil size={16}/></button>)}
      {!readonly && <div className="ledger-create-actions"><WalletAction canManageWallets={canManageWallets}/><button aria-label="Thêm giao dịch" title="Thêm giao dịch" disabled={busy || editMode || Boolean(createDraft) || !wallets.length} onClick={beginCreate} className="button-primary icon-button"><Plus size={19}/></button></div>}
    </div>
    {confirmBulkDelete && <ConfirmDelete count={selected.size} busy={busy} onCancel={() => setConfirmBulkDelete(false)} onConfirm={removeBulk}/>}
    {deleteTarget && <section className="ledger-confirm-panel" aria-labelledby="delete-transaction-title"><div><p className="public-eyebrow">{isAdmin ? "Thao tác có hiệu lực ngay" : "Yêu cầu Admin phê duyệt"}</p><h2 id="delete-transaction-title">Xóa “{deleteTarget.description || "giao dịch này"}”?</h2><p>{isAdmin ? "Nếu đã ghi nhận, số dư ví sẽ được hoàn tác." : "Giao dịch chỉ bị xóa sau khi Admin duyệt."}</p>{!isAdmin && <Textarea className="ledger-reason" value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} placeholder="Lý do (mặc định: Đã thông báo)" maxLength={2000}/>}</div><div className="dialog-actions"><button type="button" disabled={busy} onClick={() => { setDeleteTarget(null); setDeleteReason(""); }} className="button-secondary">Hủy</button><button type="button" disabled={busy} onClick={removeOne} className="button-danger">{busy ? "Đang xử lý" : isAdmin ? "Xác nhận xóa" : "Gửi yêu cầu"}</button></div></section>}
    {editMode && !isAdmin && <div className="ledger-edit-reason-bar"><label>Lý do chỉnh sửa<Input  value={editReason} onChange={(event) => setEditReason(event.target.value)} placeholder="Mặc định: Đã thông báo" maxLength={2000}/></label><span>Áp dụng cho các hàng đã thay đổi.</span></div>}

    <div className="ledger-scroll-area"><table className="ledger-table w-full min-w-[1080px] text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--text-muted)]">{canApprove && <th className="w-10"><input type="checkbox" checked={allSelected} disabled={editMode} onChange={toggleAll} aria-label="Chọn tất cả giao dịch đang hiển thị"/></th>}<th>Giao dịch</th><th>Loại</th><th>Danh mục</th><th>Ví</th><th>Ngày</th><th className="text-right">Số tiền</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
      {createDraft && <DraftRow mode="create" draft={createDraft} wallets={wallets} categories={categories} canApprove={canApprove} busy={busy} onChange={(patch) => setCreateDraft((current) => current ? { ...current, ...patch } : current)} onSave={saveCreate} onCancel={() => setCreateDraft(null)}/>}
      {rows.map((item, index) => editMode ? <DraftRow key={item.id} mode="edit" draft={editDrafts[item.id] ?? draftFromTransaction(item, wallets)} wallets={wallets} categories={categories} canApprove={canApprove} busy={busy} disabled={!isAdmin && item.hasPendingChange} autoFocus={index === 0} status={<><Status value={item.status}/>{item.hasPendingChange && <small className="ledger-change-pending">Đang chờ thay đổi</small>}</>} onChange={(patch) => updateDraft(item.id, patch)}/> : <tr key={item.id} className="border-b border-[var(--border)]">{canApprove && <td><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} aria-label={`Chọn giao dịch ${item.description || item.id}`}/></td>}<td><p className="font-medium">{item.description || "Không có nội dung"}</p><p className="mt-1 text-xs text-[var(--text-muted)]">#{String(transactions.length - index).padStart(5, "0")} · {item.member}{item.isRecurring ? " · Tự động" : ""}</p></td><td>{typeOptions.find((option) => option.value === item.type)?.label}</td><td>{item.category ? <span className="category-tag" style={{ backgroundColor: `${item.category.color}22`, color: item.category.color }}>{item.category.name}</span> : "—"}</td><td>{item.wallet}</td><td>{new Date(item.date).toLocaleDateString("vi-VN")}</td><td className={`ledger-amount amount-${item.type}`}>{item.type === "income" ? "+" : item.type === "expense" ? "−" : "↔"}{formatAmount(item.amount)} ₫</td><td><Status value={item.status}/>{item.hasPendingChange && <small className="ledger-change-pending">Đang chờ thay đổi</small>}</td><td><div className="ledger-row-actions">{canApprove && (item.status === "pending" || item.status === "scheduled") && <button disabled={busy} onClick={() => start(async () => { const result = await approveTransactionAction(item.id); if (result.ok) toast.success("Đã ghi nhận giao dịch."); else toast.error(result.message ?? "Không thể duyệt giao dịch."); })} className="button-secondary text-xs">{item.status === "scheduled" ? "Ghi nhận sớm" : "Duyệt"}</button>}{!readonly && <button disabled={busy || item.hasPendingChange} onClick={() => setDeleteTarget(item)} className="button-secondary icon-button ledger-delete-button" title="Xóa giao dịch" aria-label={`Xóa ${item.description || "giao dịch"}`}><Trash2 size={14}/></button>}</div></td></tr>)}
      {!createDraft && rows.length === 0 && <tr><td colSpan={columnCount} className="p-10 text-center text-[var(--text-muted)]">Chưa có giao dịch phù hợp.</td></tr>}
    </tbody></table></div>
    <p className="ledger-record-count">Hiển thị {rows.length} giao dịch trong {scopeLabel}.</p>
  </div>;
}

function DraftRow({ mode, draft, wallets, categories, canApprove, busy, disabled = false, autoFocus = false, status, onChange, onSave, onCancel }: { mode: "create" | "edit"; draft: TransactionDraft; wallets: Option[]; categories: Option[]; canApprove: boolean; busy: boolean; disabled?: boolean; autoFocus?: boolean; status?: React.ReactNode; onChange: (patch: Partial<TransactionDraft>) => void; onSave?: () => void; onCancel?: () => void }) {
  const categoryOptions = mode === "create" && categories.length
    ? categories.map((item) => ({ value: item.id, label: item.name }))
    : [{ value: "none", label: "Không chọn" }, ...categories.map((item) => ({ value: item.id, label: item.name }))];
  return <tr className={`ledger-draft-row border-b border-[var(--border)] ${disabled ? "disabled" : ""}`}>
    {canApprove && <td aria-hidden="true"/>}
    <td><input autoFocus={autoFocus || mode === "create"} disabled={disabled || busy} className="ledger-cell-input" value={draft.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="Nội dung" aria-label="Nội dung giao dịch"/></td>
    <td><FinanceSelect disabled={disabled || busy} value={draft.type} onValueChange={(value) => { const type = value as TransactionType; onChange({ type, toWalletId: type === "transfer" ? draft.toWalletId || defaultDestination(wallets, draft.walletId) : draft.toWalletId }); }} className="ledger-cell-select" label="Loại giao dịch" options={typeOptions.map((option) => ({ ...option, disabled: option.value === "transfer" && wallets.length < 2 }))}/></td>
    <td><FinanceSelect disabled={disabled || busy || !categoryOptions.length} value={draft.categoryId} onValueChange={(categoryId) => onChange({ categoryId })} className="ledger-cell-select" label="Danh mục" options={categoryOptions}/></td>
    <td><div className="ledger-wallet-fields"><FinanceSelect disabled={disabled || busy || !wallets.length} value={draft.walletId} onValueChange={(walletId) => onChange({ walletId, toWalletId: draft.toWalletId === walletId ? defaultDestination(wallets, walletId) : draft.toWalletId })} className="ledger-cell-select" label="Ví thực hiện" options={wallets.map((item) => ({ value: item.id, label: item.name }))}/>{draft.type === "transfer" && <FinanceSelect disabled={disabled || busy || !wallets.length} value={draft.toWalletId} onValueChange={(toWalletId) => onChange({ toWalletId })} className="ledger-cell-select" label="Ví nhận" options={wallets.map((item) => ({ value: item.id, label: item.name, disabled: item.id === draft.walletId }))}/>}</div></td>
    <td><input disabled={disabled || busy} className="ledger-cell-input ledger-date-input" type="date" value={draft.date} onChange={(event) => onChange({ date: event.target.value })} aria-label="Ngày giao dịch"/></td>
    <td><input disabled={disabled || busy} className="ledger-cell-input ledger-amount-input" inputMode="decimal" value={draft.amount} onChange={(event) => onChange({ amount: event.target.value })} placeholder="0" aria-label="Số tiền"/></td>
    <td>{mode === "create" ? <span className="status status-scheduled">Mới</span> : status}</td>
    <td>{mode === "create" ? <div className="ledger-row-actions"><button disabled={busy} onClick={onCancel} className="button-secondary icon-button" title="Hủy" aria-label="Hủy tạo giao dịch"><X size={14}/></button><button disabled={busy} onClick={onSave} className="button-primary icon-button" title="Lưu" aria-label="Lưu giao dịch"><Check size={14}/></button></div> : disabled ? <small className="ledger-change-pending">Không thể sửa</small> : "—"}</td>
  </tr>;
}

function ConfirmDelete({ count, busy, onCancel, onConfirm }: { count: number; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <section className="ledger-confirm-panel" aria-labelledby="delete-transactions-title"><div><p className="public-eyebrow">Thao tác có hiệu lực ngay</p><h2 id="delete-transactions-title">Xóa {count} giao dịch?</h2><p>Giao dịch đã ghi nhận sẽ được hoàn tác khỏi số dư ví.</p></div><div className="dialog-actions"><button type="button" autoFocus disabled={busy} onClick={onCancel} className="button-secondary">Hủy</button><button type="button" disabled={busy} onClick={onConfirm} className="button-danger">{busy ? "Đang xóa" : "Xác nhận xóa"}</button></div></section>;
}

function Status({ value }: { value: LedgerItem["status"] }) {
  const label = { approved: "Đã ghi nhận", pending: "Chờ xác nhận", scheduled: "Đã lên lịch", rejected: "Đã từ chối" }[value];
  return <span className={`status status-${value}`}>{label}</span>;
}
