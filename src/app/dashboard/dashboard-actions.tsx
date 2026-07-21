"use client";

import { Download, Plus, Search, Trash2, WalletCards } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { addTransactionAction, addWalletAction, approveTransactionAction, deleteTransactionsAction } from "@/app/dashboard/actions";
import { formatAmount } from "@/lib/format";

type Option = { id: string; name: string; color?: string };
type TransactionType = "income" | "expense" | "transfer";
type LedgerItem = { id: string; amount: string; type: TransactionType; status: "pending" | "scheduled" | "approved" | "rejected"; description: string | null; date: string; wallet: string; category: { name: string; color: string } | null; member: string };

export function DashboardActions({ wallets, categories, canManageWallets }: { wallets: Option[]; categories: Option[]; canManageWallets: boolean }) {
  const [open, setOpen] = useState<"wallet" | "transaction" | null>(null);
  const [transactionType, setTransactionType] = useState<TransactionType>("expense");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const priorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = [...dialog.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)")];
    focusable[0]?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
      if (event.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    dialog.addEventListener("keydown", handleKeyDown);
    return () => { dialog.removeEventListener("keydown", handleKeyDown); priorFocus?.focus(); };
  }, [open, transactionType]);

  function wallet(data: FormData) {
    start(async () => {
      const result = await addWalletAction({ name: data.get("name"), openingBalance: data.get("openingBalance"), description: data.get("description") || undefined });
      setMessage(result.ok ? "Đã tạo ví." : result.message ?? "Không thể tạo ví.");
      if (result.ok) setOpen(null);
    });
  }

  function transaction(data: FormData) {
    start(async () => {
      const result = await addTransactionAction({ walletId: data.get("walletId"), toWalletId: data.get("toWalletId") || undefined, categoryId: data.get("categoryId") || undefined, type: data.get("type"), amount: data.get("amount"), description: data.get("description") || undefined, date: data.get("date") });
      setMessage(result.ok ? "Đã gửi giao dịch để xác nhận." : result.message ?? "Không thể lưu giao dịch.");
      if (result.ok) setOpen(null);
    });
  }

  return <>
    <div className="ledger-create-actions">
      <button disabled={!canManageWallets} aria-label="Thêm ví" title={canManageWallets ? "Thêm ví" : "Chỉ Admin được quản lý ví"} onClick={() => setOpen("wallet")} className="button-secondary icon-button"><WalletCards size={18}/></button>
      <button aria-label="Thêm giao dịch" title="Thêm giao dịch" onClick={() => setOpen("transaction")} className="button-primary icon-button"><Plus size={19}/></button>
    </div>
    {message && <p className="ledger-action-message" role="status">{message}</p>}
    {open && <div ref={dialogRef} className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="dashboard-action-title">
      <form action={open === "wallet" ? wallet : transaction} className="sunrise-card dialog-card">
        <div><p className="public-eyebrow">{open === "wallet" ? "Quản lý ví" : "Sổ giao dịch"}</p><h2 id="dashboard-action-title">{open === "wallet" ? "Thêm ví" : "Thêm giao dịch"}</h2></div>
        {open === "wallet" ? <>
          <Field name="name" label="Tên ví" />
          <Field name="openingBalance" label="Số dư đầu kỳ" inputMode="decimal" />
          <Field name="description" label="Ghi chú" required={false} />
        </> : <>
          <label>Loại giao dịch<select required name="type" className="field" value={transactionType} onChange={(event) => setTransactionType(event.target.value as TransactionType)}><option value="expense">Chi tiêu</option><option value="income">Thu nhập</option><option value="transfer">Chuyển khoản</option></select></label>
          <label>Ví thực hiện<select required name="walletId" className="field" defaultValue=""><option value="" disabled>Chọn ví</option>{wallets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          {transactionType === "transfer" && <label>Ví nhận<select required name="toWalletId" className="field" defaultValue=""><option value="" disabled>Chọn ví nhận</option>{wallets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
          <label>Danh mục<select name="categoryId" className="field" defaultValue=""><option value="">Không chọn danh mục</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <Field name="amount" label="Số tiền" inputMode="decimal" />
          <label>Ngày giao dịch<input required name="date" type="date" className="field" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
          <Field name="description" label="Nội dung" required={false} />
        </>}
        <div className="dialog-actions"><button type="button" onClick={() => setOpen(null)} className="button-secondary">Hủy</button><button disabled={pending} className="button-primary">{pending ? "Đang lưu" : "Lưu"}</button></div>
      </form>
    </div>}
  </>;
}

function Field({ name, label, required = true, inputMode }: { name: string; label: string; required?: boolean; inputMode?: "decimal" }) {
  return <label>{label}<input required={required} name={name} inputMode={inputMode} className="field" /></label>;
}

export function Ledger({ transactions, canApprove, monthLabel, wallets, categories, canManageWallets, readonly = false }: { transactions: LedgerItem[]; canApprove: boolean; monthLabel: string; wallets: Option[]; categories: Option[]; canManageWallets: boolean; readonly?: boolean }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const rows = useMemo(() => transactions.filter((item) => (status === "all" || item.status === status) && `${item.description ?? ""} ${item.category?.name ?? ""} ${item.wallet} ${item.member}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [transactions, query, status]);
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  function exportCsv() {
    const csv = ["Ngày,Loại,Danh mục,Ví,Số tiền,Trạng thái,Ghi chú", ...rows.map((item) => [new Date(item.date).toLocaleDateString("vi-VN"), item.type, item.category?.name ?? "", item.wallet, item.amount, item.status, item.description ?? ""].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))].join("\n");
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    anchor.download = "so-thu-chi.csv";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  function toggle(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function toggleAll() { setSelected((current) => { const next = new Set(current); if (allSelected) rows.forEach((row) => next.delete(row.id)); else rows.forEach((row) => next.add(row.id)); return next; }); }
  function remove() {
    const ids = [...selected];
    if (!ids.length) return;
    start(async () => {
      const result = await deleteTransactionsAction(ids);
      setMessage(result.ok ? `Đã xóa ${ids.length} giao dịch.` : result.message ?? "Không thể xóa giao dịch.");
      if (result.ok) setSelected(new Set());
      setConfirmDelete(false);
    });
  }

  return <>
    <div className="ledger-shell">
      <div className="ledger-toolbar">
        <label className="ledger-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm giao dịch" aria-label="Tìm giao dịch hoặc ghi chú"/></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="ledger-status" aria-label="Lọc trạng thái"><option value="all">Tất cả</option><option value="approved">Đã ghi nhận</option><option value="pending">Chờ xác nhận</option><option value="rejected">Đã từ chối</option></select>
        <button className="button-secondary icon-button" onClick={exportCsv} title="Xuất CSV" aria-label="Xuất CSV"><Download size={16}/></button>
        {canApprove && <button className="button-secondary icon-button ledger-delete-button" disabled={!selected.size || busy} onClick={() => setConfirmDelete(true)} title={selected.size ? `Xóa ${selected.size} giao dịch đã chọn` : "Chọn giao dịch để xóa"} aria-label="Xóa giao dịch đã chọn"><Trash2 size={16}/></button>}
        {!readonly && <DashboardActions wallets={wallets} categories={categories} canManageWallets={canManageWallets}/>}
      </div>
      {message && <p className="ledger-inline-message" role="status">{message}</p>}
      <div className="ledger-scroll-area"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--text-muted)]">{canApprove && <th className="w-10"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Chọn tất cả giao dịch đang hiển thị"/></th>}<th>Giao dịch</th><th>Danh mục</th><th>Ví</th><th>Ngày</th><th className="text-right">Số tiền</th><th>Trạng thái</th><th></th></tr></thead><tbody>{rows.map((item, index) => <tr key={item.id} className="border-b border-[var(--border)]">{canApprove && <td><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} aria-label={`Chọn giao dịch ${item.description || item.id}`}/></td>}<td><p className="font-medium">{item.description || "Không có nội dung"}</p><p className="mt-1 text-xs text-[var(--text-muted)]">#{String(transactions.length - index).padStart(5, "0")} · {item.member}</p></td><td>{item.category ? <span className="category-tag" style={{ backgroundColor: `${item.category.color}22`, color: item.category.color }}>{item.category.name}</span> : "—"}</td><td>{item.wallet}</td><td>{new Date(item.date).toLocaleDateString("vi-VN")}</td><td className={`ledger-amount amount-${item.type}`}>{item.type === "income" ? "+" : item.type === "expense" ? "−" : "↔"}{formatAmount(item.amount)} ₫</td><td><Status value={item.status}/></td><td>{canApprove && item.status === "pending" && <button disabled={busy} onClick={() => start(async () => { const result = await approveTransactionAction(item.id); setMessage(result.ok ? "Đã duyệt giao dịch." : result.message ?? "Không thể duyệt giao dịch."); })} className="button-secondary text-xs">Duyệt</button>}</td></tr>)}{rows.length === 0 && <tr><td colSpan={canApprove ? 8 : 7} className="p-10 text-center text-[var(--text-muted)]">Chưa có giao dịch phù hợp.</td></tr>}</tbody></table></div>
      <p className="ledger-record-count">Hiển thị {rows.length} giao dịch trong {monthLabel}.</p>
    </div>
    {confirmDelete && <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-transactions-title"><section className="sunrise-card confirm-card"><p className="public-eyebrow">Thao tác không thể hoàn tác trực tiếp</p><h2 id="delete-transactions-title">Xóa {selected.size} giao dịch?</h2><p>Giao dịch đã ghi nhận sẽ được hoàn tác khỏi số dư ví.</p><div className="dialog-actions"><button type="button" autoFocus disabled={busy} onClick={() => setConfirmDelete(false)} className="button-secondary">Hủy</button><button type="button" disabled={busy} onClick={remove} className="button-danger">{busy ? "Đang xóa" : "Xác nhận xóa"}</button></div></section></div>}
  </>;
}

function Status({ value }: { value: LedgerItem["status"] }) {
  const label = { approved: "Đã ghi nhận", pending: "Chờ xác nhận", scheduled: "Dự kiến", rejected: "Đã từ chối" }[value];
  return <span className={`status status-${value}`}>{label}</span>;
}
