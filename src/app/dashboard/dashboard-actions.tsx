"use client";

import { Check, FilterX, Menu, Pencil, Plus, Trash2, WalletCards, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  addTransactionAction,
  addWalletAction,
  approveTransactionAction,
  deleteTransactionAction,
  deleteTransactionsAction,
  rejectTransactionAction,
  updateTransactionsAction,
} from "@/app/dashboard/actions";
import { formatAmount } from "@/lib/format";
import { Textarea } from "@/components/ui/textarea";
import { Button, Card, Empty, Input, Search, Select } from "@/components/base";
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
  toWallet: string | null;
  categoryId: string | null;
  wallet: string;
  category: { name: string; color: string } | null;
  member: string;
  canRequestDelete: boolean;
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

function newTransactionDraft(wallets: Option[], categories: Option[], businessDate: string): TransactionDraft {
  const walletId = wallets[0]?.id ?? "";
  return {
    description: "",
    type: "expense",
    categoryId: categories[0]?.id ?? "none",
    walletId,
    toWalletId: defaultDestination(wallets, walletId),
    date: businessDate,
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

function WalletAction({ workspaceId, canManageWallets }: { workspaceId: string; canManageWallets: boolean }) {
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
      const result = await addWalletAction(workspaceId, { name: data.get("name"), description: data.get("description") || undefined });
      setMessage(result.ok ? "Đã tạo ví." : result.message ?? "Không thể tạo ví.");
      if (result.ok) setOpen(false);
    });
  }

  return <>
    <div ref={actionsRef} className="ledger-wallet-action">
      <Button variant="outline" size="icon" disabled={!canManageWallets} aria-label="Thêm ví" title={canManageWallets ? "Thêm ví" : "Chỉ Admin được quản lý ví"} onClick={() => setOpen(true)} className="icon-button"><WalletCards size={18}/></Button>
    </div>
    {message && <p className="ledger-action-message" role="status">{message}</p>}
    {open && <div ref={editorRef} className="ledger-inline-editor ledger-inline-editor-wallet" role="region" aria-labelledby="wallet-action-title">
      <Card as="form" action={createWallet} className="sunrise-card dialog-card gap-0 py-0">
        <div><p className="public-eyebrow">Quản lý ví</p><h2 id="wallet-action-title">Thêm ví</h2></div>
        <Field name="name" label="Tên ví"/>
        <p className="text-xs leading-relaxed text-muted-foreground">Ví mới có số dư 0. Hãy tạo giao dịch thu nhập đầu tiên trong Sổ giao dịch để cập nhật số dư.</p>
        <Field name="description" label="Ghi chú" required={false}/>
        <div className="dialog-actions"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button disabled={pending} variant="default">{pending ? "Đang lưu" : "Lưu"}</Button></div>
      </Card>
    </div>}
  </>;

}

function Field({ name, label, required = true, inputMode }: { name: string; label: string; required?: boolean; inputMode?: "decimal" }) {
  return <label>{label}<Input required={required} name={name} inputMode={inputMode} /></label>;
}

export function Ledger({ workspaceId, businessDate, initialMonth, selectedMonth, onMonthChange, transactions, totalTransactions, pageSize, canApprove, canEditTransactions, isAdmin, scopeLabel, wallets, categories, canManageWallets, readonly = false, startWithNewTransaction = false }: { workspaceId: string; businessDate: string; initialMonth: string; selectedMonth?: string; onMonthChange?: (month: string) => void; transactions: LedgerItem[]; totalTransactions: number; pageSize: number; canApprove: boolean; canEditTransactions: boolean; isAdmin: boolean; scopeLabel: string; wallets: Option[]; categories: Option[]; canManageWallets: boolean; readonly?: boolean; startWithNewTransaction?: boolean }) {
  const [query, setQuery] = useState("");
  const [internalMonth, setInternalMonth] = useState(initialMonth);
  const month = selectedMonth ?? internalMonth;
  const [status, setStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LedgerItem | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [createDraft, setCreateDraft] = useState<TransactionDraft | null>(() =>
    startWithNewTransaction && wallets.length
      ? newTransactionDraft(wallets, categories, businessDate)
      : null,
  );
  const [editMode, setEditMode] = useState(false);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, TransactionDraft>>({});
  const [editReason, setEditReason] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const [busy, start] = useTransition();
  const hasActiveFilters = query.trim().length > 0 || month !== "all" || status !== "all";
  const monthOptions = useMemo(() => [
    { value: "all", label: "Tất cả tháng" },
    ...[...new Set([initialMonth, ...transactions.map((item) => item.date.slice(0, 7))])]
      .sort((left, right) => right.localeCompare(left))
      .map((value) => {
        const [year, monthNumber] = value.split("-");
        return { value, label: `Tháng ${monthNumber}/${year}` };
      }),
  ], [initialMonth, transactions]);
  const filteredRows = useMemo(() => transactions.filter((item) =>
    (month === "all" || item.date.slice(0, 7) === month)
    && (status === "all" || item.status === status)
    && `${item.description ?? ""} ${item.category?.name ?? ""} ${item.wallet} ${item.member}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  ), [transactions, month, query, status]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const page = Math.min(currentPage, pageCount);
  const rows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const columnCount = canApprove ? 9 : 8;
  const pageStart = filteredRows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(page * pageSize, filteredRows.length);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    function closeOnOutsidePress(event: PointerEvent) {
      if (!mobileMenuRef.current?.contains(event.target as Node)) setMobileMenuOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMobileMenuOpen(false);
      mobileMenuTriggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  function clearFilters() {
    setQuery("");
    setInternalMonth("all");
    onMonthChange?.("all");
    setStatus("all");
    setCurrentPage(1);
    setSelected(new Set());
    setConfirmBulkDelete(false);
  }

  function changeFilter(update: () => void) {
    update();
    setCurrentPage(1);
    setSelected(new Set());
    setConfirmBulkDelete(false);
  }

  function toggle(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function toggleAll() { setSelected((current) => { const next = new Set(current); if (allSelected) rows.forEach((row) => next.delete(row.id)); else rows.forEach((row) => next.add(row.id)); return next; }); }
  function removeBulk() {
    const ids = [...selected]; if (!ids.length) return;
    start(async () => {
      const result = await deleteTransactionsAction(workspaceId, ids);
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
      const result = await deleteTransactionAction(workspaceId, deleteTarget.id, deleteReason);
      if (result.ok) {
        toast.success(result.kind === "requested" ? "Đã gửi yêu cầu xóa đến Admin." : "Đã xóa giao dịch và cập nhật lại số dư ví.");
        setDeleteTarget(null);
        setDeleteReason("");
      } else {
        toast.error(result.message ?? "Không thể xử lý yêu cầu xóa.");
      }
    });
  }
  function approveOne(item: LedgerItem) {
    start(async () => {
      const result = await approveTransactionAction(workspaceId, item.id);
      if (result.ok) toast.success("Đã ghi nhận giao dịch.");
      else toast.error(result.message ?? "Không thể duyệt giao dịch.");
    });
  }
  function rejectOne(item: LedgerItem) {
    start(async () => {
      const result = await rejectTransactionAction(workspaceId, item.id);
      if (result.ok) toast.success("Đã từ chối giao dịch.");
      else toast.error(result.message ?? "Không thể từ chối giao dịch.");
    });
  }
  function beginCreate() {
    setEditMode(false);
    setEditDrafts({});
    setCreateDraft(newTransactionDraft(wallets, categories, businessDate));
  }
  function saveCreate() {
    if (!createDraft) return;
    start(async () => {
      const result = await addTransactionAction(workspaceId, transactionInput(createDraft));
      if (result.ok) {
        toast.success(result.status === "pending" ? "Đã gửi giao dịch quá khứ để Admin duyệt." : result.status === "scheduled" ? "Đã lên lịch giao dịch tương lai." : "Đã ghi nhận giao dịch và cập nhật số dư ví.");
        setCreateDraft(null);
      } else {
        toast.error(result.message ?? "Không thể lưu giao dịch.");
      }
    });
  }
  function beginEdit(transactionId?: string) {
    setCreateDraft(null);
    setDeleteTarget(null);
    const editableTransactions = transactionId ? transactions.filter((item) => item.id === transactionId) : rows;
    setEditDrafts(Object.fromEntries(editableTransactions.map((item) => [item.id, draftFromTransaction(item, wallets)])));
    setEditTargetId(transactionId ?? null);
    setEditReason("");
    setEditMode(true);
  }
  function cancelEdit() {
    setEditMode(false);
    setEditTargetId(null);
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
      <Search containerClassName="max-[760px]:col-span-2 max-[760px]:row-start-1" value={query} onChange={(event) => changeFilter(() => setQuery(event.target.value))} disabled={editMode} placeholder="Tìm giao dịch" aria-label="Tìm giao dịch hoặc ghi chú"/>
      <Select value={month} onValueChange={(value) => changeFilter(() => {
        setInternalMonth(value);
        onMonthChange?.(value);
      })} disabled={editMode} className="w-auto max-w-44" label="Lọc theo tháng" options={monthOptions}/>
      <Select value={status} onValueChange={(value) => changeFilter(() => setStatus(value))} disabled={editMode} className="w-auto max-w-38" label="Lọc trạng thái" options={[{ value: "all", label: "Tất cả" }, { value: "approved", label: "Đã ghi nhận" }, { value: "pending", label: "Chờ xác nhận" }, { value: "scheduled", label: "Đã lên lịch" }, { value: "rejected", label: "Đã từ chối" }]}/>
      <div className="ledger-desktop-tools">
        <Button variant="ghost" size="default" className="ledger-clear-filter" disabled={editMode || !hasActiveFilters} onClick={clearFilters} title="Xóa tìm kiếm và bộ lọc" aria-label="Xóa bộ lọc"><FilterX size={15}/>Xóa lọc</Button>
        {canApprove && <Button variant="outline" size="icon" className="ledger-delete-button" disabled={editMode || !selected.size || busy} onClick={() => setConfirmBulkDelete(true)} title={selected.size ? `Xóa ${selected.size} giao dịch đã chọn` : "Chọn giao dịch để xóa"} aria-label="Xóa giao dịch đã chọn"><Trash2 size={16}/></Button>}
        {canEditTransactions && (editMode ? <div className="ledger-edit-actions"><Button variant="outline" disabled={busy} onClick={cancelEdit}><X size={15}/>Hủy</Button><Button variant="default" disabled={busy} onClick={saveEdits}><Check size={15}/>{busy ? "Đang lưu" : "Lưu"}</Button></div> : <Button variant="outline" size="icon" disabled={busy || !transactions.length || Boolean(createDraft)} onClick={() => beginEdit()} title="Chỉnh sửa tất cả giao dịch" aria-label="Chỉnh sửa tất cả giao dịch"><Pencil size={16}/></Button>)}
        {!readonly && <div className="ledger-create-actions"><WalletAction workspaceId={workspaceId} canManageWallets={canManageWallets}/><Button variant="default" size="icon" aria-label="Thêm giao dịch" title="Thêm giao dịch" disabled={busy || editMode || Boolean(createDraft) || !wallets.length} onClick={beginCreate}><Plus size={19}/></Button></div>}
      </div>
      <div className="ledger-mobile-tools">
        {editMode ? <>
          <Button variant="outline" size="icon" disabled={busy} onClick={cancelEdit} aria-label="Hủy chỉnh sửa"><X size={17}/></Button>
          <Button variant="default" size="icon" disabled={busy} onClick={saveEdits} aria-label={busy ? "Đang lưu" : "Lưu chỉnh sửa"}><Check size={17}/></Button>
        </> : <>
          <div className="ledger-mobile-menu" ref={mobileMenuRef}>
            <Button variant="unstyled" size="auto"
              ref={mobileMenuTriggerRef}
              type="button"
              className="ledger-mobile-menu-trigger"
              aria-label={mobileMenuOpen ? "Đóng menu thao tác" : "Mở menu thao tác"}
              aria-haspopup="menu"
              aria-expanded={mobileMenuOpen}
              title="Thao tác khác"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <Menu size={18}/>
            </Button>
            {mobileMenuOpen && <div className="ledger-mobile-action-menu" role="menu" aria-label="Thao tác sổ giao dịch">
              <span className="ledger-mobile-action-menu-label">Thao tác</span>
              <Button variant="unstyled" size="auto" type="button" role="menuitem" disabled={!hasActiveFilters} onClick={() => { setMobileMenuOpen(false); clearFilters(); }}><FilterX/>Xóa bộ lọc</Button>
              {canEditTransactions && <Button variant="unstyled" size="auto" type="button" role="menuitem" disabled={busy || !transactions.length || Boolean(createDraft)} onClick={() => { setMobileMenuOpen(false); beginEdit(); }}><Pencil/>Chỉnh sửa nhiều giao dịch</Button>}
              {canApprove && <Button variant="unstyled" size="auto" type="button" role="menuitem" className="destructive" disabled={!selected.size || busy} onClick={() => { setMobileMenuOpen(false); setConfirmBulkDelete(true); }}><Trash2/>Xóa {selected.size ? `${selected.size} mục đã chọn` : "mục đã chọn"}</Button>}
              {!readonly && canManageWallets && <>
                <span className="ledger-mobile-action-menu-separator"/>
                <Link href="/wallets" role="menuitem" onClick={() => setMobileMenuOpen(false)}><WalletCards/>Quản lý ví</Link>
              </>}
            </div>}
          </div>
        </>}
      </div>
    </div>
    {confirmBulkDelete && <ConfirmDelete count={selected.size} busy={busy} onCancel={() => setConfirmBulkDelete(false)} onConfirm={removeBulk}/>}
    {deleteTarget && <Card as="section" className="ledger-confirm-panel gap-0 py-0" aria-labelledby="delete-transaction-title"><div><p className="public-eyebrow">{isAdmin ? "Thao tác có hiệu lực ngay" : "Yêu cầu Admin phê duyệt"}</p><h2 id="delete-transaction-title">Xóa “{deleteTarget.description || "giao dịch này"}”?</h2><p>{isAdmin ? "Nếu đã ghi nhận, số dư ví sẽ được hoàn tác." : "Giao dịch chỉ bị xóa sau khi Admin duyệt."}</p>{!isAdmin && <Textarea className="ledger-reason" value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} placeholder="Lý do (mặc định: Đã thông báo)" maxLength={2000}/>}</div><div className="dialog-actions"><Button type="button" variant="outline" disabled={busy} onClick={() => { setDeleteTarget(null); setDeleteReason(""); }}>Hủy</Button><Button type="button" variant="destructive" disabled={busy} onClick={removeOne}>{busy ? "Đang xử lý" : isAdmin ? "Xác nhận xóa" : "Gửi yêu cầu"}</Button></div></Card>}
    {editMode && !isAdmin && <div className="ledger-edit-reason-bar"><label>Lý do chỉnh sửa<Input  value={editReason} onChange={(event) => setEditReason(event.target.value)} placeholder="Mặc định: Đã thông báo" maxLength={2000}/></label><span>Áp dụng cho các hàng đã thay đổi.</span></div>}

    {createDraft && <MobileTransactionDraft
      mode="create"
      draft={createDraft}
      wallets={wallets}
      categories={categories}
      busy={busy}
      onChange={(patch) => setCreateDraft((current) => current ? { ...current, ...patch } : current)}
      onSave={saveCreate}
      onCancel={() => setCreateDraft(null)}
    />}

    {editMode && <div className="ledger-mobile-edit-list" aria-label="Chỉnh sửa giao dịch">
      {rows.filter((item) => !editTargetId || item.id === editTargetId).map((item) => {
        const draft = editDrafts[item.id] ?? draftFromTransaction(item, wallets);
        return <MobileTransactionDraft
          key={item.id}
          mode="edit"
          title={item.description || "Giao dịch chưa có nội dung"}
          status={<Status value={item.status}/>}
          draft={draft}
          wallets={wallets}
          categories={categories}
          busy={busy}
          disabled={!isAdmin && item.hasPendingChange}
          onChange={(patch) => updateDraft(item.id, patch)}
          onSave={saveEdits}
          onCancel={cancelEdit}
        />;
      })}
    </div>}

    {!createDraft && !editMode && <div className="ledger-mobile-list" aria-label="Danh sách giao dịch">
      {canApprove && rows.length > 0 && <div className="ledger-mobile-selection">
        <Button variant="ghost" size="default" onClick={toggleAll}>{allSelected ? "Bỏ chọn trang này" : "Chọn trang này"}</Button>
        <span>{selected.size ? `${selected.size} mục đã chọn` : `${rows.length} giao dịch`}</span>
      </div>}
      {rows.map((item, index) => <Card as="article" className="ledger-mobile-card gap-0 py-0" key={item.id}>
        <div className="ledger-mobile-card-heading">
          {canApprove && <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} aria-label={`Chọn giao dịch ${item.description || item.id}`}/>}
          <div className="ledger-mobile-card-copy">
            <strong title={item.description || "Không có nội dung"}>{item.description || "Không có nội dung"}</strong>
            <div className="ledger-mobile-card-subline">
              <small>#{String(Math.max(1, totalTransactions - ((page - 1) * pageSize + index))).padStart(5, "0")} · {item.member}{item.isRecurring ? " · Tự động" : ""}</small>
              <b
                className={`ledger-amount amount-${item.type}`}
                title={`${item.type === "income" ? "+" : item.type === "expense" ? "−" : "↔"}${formatAmount(item.amount)} ₫`}
                aria-label={`Số tiền ${formatAmount(item.amount)} đồng`}
              >
                {item.type === "income" ? "+" : item.type === "expense" ? "−" : "↔"}{formatAmount(item.amount)} ₫
              </b>
            </div>
          </div>
        </div>
        <div className="ledger-mobile-card-meta">
          <span><small>Loại</small>{typeOptions.find((option) => option.value === item.type)?.label}</span>
          <span><small>Ví</small>{item.wallet}{item.toWallet ? ` → ${item.toWallet}` : ""}</span>
          <span><small>Ngày</small>{formatLedgerDate(item.date)}</span>
          <span><small>Danh mục</small>{item.category?.name ?? "Chưa phân loại"}</span>
        </div>
        <div className="ledger-mobile-card-footer">
          <div><Status value={item.status}/>{item.hasPendingChange && <small className="ledger-change-pending">Đang chờ thay đổi</small>}</div>
          <div className="ledger-row-actions">
            {canApprove && (item.status === "pending" || item.status === "scheduled") && <Button variant="outline" size="default" disabled={busy} onClick={() => approveOne(item)}>{item.status === "scheduled" ? "Ghi nhận" : "Duyệt"}</Button>}
            {canApprove && item.status === "pending" && <Button variant="ghost" size="default" disabled={busy} onClick={() => rejectOne(item)}>Từ chối</Button>}
            {canEditTransactions && !item.hasPendingChange && <Button variant="outline" size="icon" disabled={busy} onClick={() => beginEdit(item.id)} title="Chỉnh sửa giao dịch" aria-label={`Chỉnh sửa ${item.description || "giao dịch"}`}><Pencil size={15}/></Button>}
            {!readonly && item.canRequestDelete && <Button variant="outline" size="icon" disabled={busy || item.hasPendingChange} onClick={() => setDeleteTarget(item)} className="ledger-delete-button" title="Xóa giao dịch" aria-label={`Xóa ${item.description || "giao dịch"}`}><Trash2 size={15}/></Button>}
          </div>
        </div>
      </Card>)}
      {!rows.length && (
        <Empty
          variant="compact"
          title="Chưa có giao dịch phù hợp"
          description="Thử thay đổi tìm kiếm hoặc bộ lọc hiện tại."
        />
      )}
    </div>}

    <div className="ledger-scroll-area ledger-desktop-table"><table className="ledger-table w-full min-w-[1080px] text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--text-muted)]">{canApprove && <th className="w-10"><input type="checkbox" checked={allSelected} disabled={editMode} onChange={toggleAll} aria-label="Chọn tất cả giao dịch đang hiển thị"/></th>}<th>Giao dịch</th><th>Loại</th><th>Danh mục</th><th>Ví</th><th>Ngày</th><th className="text-right">Số tiền</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
      {createDraft && <DraftRow mode="create" draft={createDraft} wallets={wallets} categories={categories} canApprove={canApprove} busy={busy} onChange={(patch) => setCreateDraft((current) => current ? { ...current, ...patch } : current)} onSave={saveCreate} onCancel={() => setCreateDraft(null)}/>}
      {rows.map((item, index) => editMode
        ? <DraftRow key={item.id} mode="edit" draft={editDrafts[item.id] ?? draftFromTransaction(item, wallets)} wallets={wallets} categories={categories} canApprove={canApprove} busy={busy} disabled={!isAdmin && item.hasPendingChange} autoFocus={index === 0} status={<><Status value={item.status}/>{item.hasPendingChange && <small className="ledger-change-pending">Đang chờ thay đổi</small>}</>} onChange={(patch) => updateDraft(item.id, patch)}/>
        : <tr key={item.id} className="border-b border-[var(--border)]">
          {canApprove && <td><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} aria-label={`Chọn giao dịch ${item.description || item.id}`}/></td>}
          <td><p className="font-medium">{item.description || "Không có nội dung"}</p><p className="mt-1 text-xs text-[var(--text-muted)]">#{String(Math.max(1, totalTransactions - ((page - 1) * pageSize + index))).padStart(5, "0")} · {item.member}{item.isRecurring ? " · Tự động" : ""}</p></td>
          <td>{typeOptions.find((option) => option.value === item.type)?.label}</td>
          <td>{item.category ? <span className="category-tag" style={{ backgroundColor: `${item.category.color}22`, color: item.category.color }}>{item.category.name}</span> : "—"}</td>
          <td>{item.wallet}{item.toWallet ? <small className="ledger-wallet-destination">→ {item.toWallet}</small> : null}</td>
          <td>{formatLedgerDate(item.date)}</td>
          <td className={`ledger-amount amount-${item.type}`}>{item.type === "income" ? "+" : item.type === "expense" ? "−" : "↔"}{formatAmount(item.amount)} ₫</td>
          <td><Status value={item.status}/>{item.hasPendingChange && <small className="ledger-change-pending">Đang chờ thay đổi</small>}</td>
          <td><div className="ledger-row-actions">
            {canApprove && item.status === "pending" && <Button variant="ghost" size="default" disabled={busy} onClick={() => rejectOne(item)}>Từ chối</Button>}
            {canApprove && (item.status === "pending" || item.status === "scheduled") && <Button variant="outline" size="default" disabled={busy} onClick={() => approveOne(item)}>{item.status === "scheduled" ? "Ghi nhận sớm" : "Duyệt"}</Button>}
            {!readonly && item.canRequestDelete && <Button variant="outline" size="icon" disabled={busy || item.hasPendingChange} onClick={() => setDeleteTarget(item)} className="ledger-delete-button" title="Xóa giao dịch" aria-label={`Xóa ${item.description || "giao dịch"}`}><Trash2 size={14}/></Button>}
          </div></td>
        </tr>)}
      {!createDraft && rows.length === 0 && (
        <tr>
          <td colSpan={columnCount} className="p-4">
            <Empty
              variant="compact"
              title="Chưa có giao dịch phù hợp"
              description="Thử thay đổi tìm kiếm hoặc bộ lọc hiện tại."
            />
          </td>
        </tr>
      )}
    </tbody></table></div>
    <footer className="ledger-pagination">
      <p className="ledger-record-count">Hiển thị {pageStart}–{pageEnd}/{filteredRows.length} giao dịch phù hợp · {totalTransactions} giao dịch trong {scopeLabel}.</p>
      {pageCount > 1 && <nav aria-label="Phân trang sổ giao dịch">
        <Button variant="outline" size="default" disabled={page <= 1} onClick={() => setCurrentPage(Math.max(1, page - 1))}>Trang trước</Button>
        <span>Trang {page}/{pageCount}</span>
        <Button variant="outline" size="default" disabled={page >= pageCount} onClick={() => setCurrentPage(Math.min(pageCount, page + 1))}>Trang sau</Button>
      </nav>}
    </footer>
  </div>;
}

function DraftRow({ mode, draft, wallets, categories, canApprove, busy, disabled = false, autoFocus = false, status, onChange, onSave, onCancel }: { mode: "create" | "edit"; draft: TransactionDraft; wallets: Option[]; categories: Option[]; canApprove: boolean; busy: boolean; disabled?: boolean; autoFocus?: boolean; status?: React.ReactNode; onChange: (patch: Partial<TransactionDraft>) => void; onSave?: () => void; onCancel?: () => void }) {
  const categoryOptions = mode === "create" && categories.length
    ? categories.map((item) => ({ value: item.id, label: item.name }))
    : [{ value: "none", label: "Không chọn" }, ...categories.map((item) => ({ value: item.id, label: item.name }))];
  return <tr className={`ledger-draft-row border-b border-[var(--border)] ${disabled ? "disabled" : ""}`}>
    {canApprove && <td aria-hidden="true"/>}
    <td><Input autoFocus={autoFocus || mode === "create"} disabled={disabled || busy} className="ledger-cell-input" value={draft.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="Nội dung" aria-label="Nội dung giao dịch"/></td>
    <td><Select disabled={disabled || busy} value={draft.type} onValueChange={(value) => { const type = value as TransactionType; onChange({ type, toWalletId: type === "transfer" ? draft.toWalletId || defaultDestination(wallets, draft.walletId) : draft.toWalletId }); }} label="Loại giao dịch" options={typeOptions.map((option) => ({ ...option, disabled: option.value === "transfer" && wallets.length < 2 }))}/></td>
    <td><Select disabled={disabled || busy || !categoryOptions.length} value={draft.categoryId} onValueChange={(categoryId) => onChange({ categoryId })} label="Danh mục" options={categoryOptions}/></td>
    <td><div className="ledger-wallet-fields"><Select disabled={disabled || busy || !wallets.length} value={draft.walletId} onValueChange={(walletId) => onChange({ walletId, toWalletId: draft.toWalletId === walletId ? defaultDestination(wallets, walletId) : draft.toWalletId })} label="Ví thực hiện" options={wallets.map((item) => ({ value: item.id, label: item.name }))}/>{draft.type === "transfer" && <Select disabled={disabled || busy || !wallets.length} value={draft.toWalletId} onValueChange={(toWalletId) => onChange({ toWalletId })} label="Ví nhận" options={wallets.map((item) => ({ value: item.id, label: item.name, disabled: item.id === draft.walletId }))}/>}</div></td>
    <td><Input disabled={disabled || busy} className="ledger-cell-input ledger-date-input" type="date" value={draft.date} onChange={(event) => onChange({ date: event.target.value })} aria-label="Ngày giao dịch"/></td>
    <td><Input disabled={disabled || busy} className="ledger-cell-input ledger-amount-input" inputMode="decimal" value={draft.amount} onChange={(event) => onChange({ amount: event.target.value })} placeholder="0" aria-label="Số tiền"/></td>
    <td>{mode === "create" ? <span className="status status-scheduled">Mới</span> : status}</td>
    <td>{mode === "create" ? <div className="ledger-row-actions"><Button variant="outline" size="icon" disabled={busy} onClick={onCancel} title="Hủy" aria-label="Hủy tạo giao dịch"><X size={14}/></Button><Button variant="default" size="icon" disabled={busy} onClick={onSave} title="Lưu" aria-label="Lưu giao dịch"><Check size={14}/></Button></div> : disabled ? <small className="ledger-change-pending">Không thể sửa</small> : "—"}</td>
  </tr>;
}

function formatLedgerDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function MobileTransactionDraft({ mode, title, status, draft, wallets, categories, busy, disabled = false, onChange, onSave, onCancel }: {
  mode: "create" | "edit";
  title?: string;
  status?: React.ReactNode;
  draft: TransactionDraft;
  wallets: Option[];
  categories: Option[];
  busy: boolean;
  disabled?: boolean;
  onChange: (patch: Partial<TransactionDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const locked = disabled || busy;
  return <section className={`ledger-mobile-draft ${disabled ? "disabled" : ""}`} aria-label={mode === "create" ? "Tạo giao dịch" : `Chỉnh sửa ${title ?? "giao dịch"}`}>
    <div className="ledger-mobile-draft-heading"><div><strong>{mode === "create" ? "Giao dịch mới" : title}</strong><small>{disabled ? "Giao dịch đang có yêu cầu thay đổi chờ duyệt" : mode === "create" ? "Điền các thông tin cần thiết" : "Cập nhật thông tin giao dịch"}</small></div>{mode === "create" ? <span className="status status-scheduled">Mới</span> : status}</div>
    <div className="ledger-mobile-draft-grid">
      <label className="quick-field">Loại giao dịch<Select disabled={locked} value={draft.type} onValueChange={(value) => { const type = value as TransactionType; onChange({ type, toWalletId: type === "transfer" ? draft.toWalletId || defaultDestination(wallets, draft.walletId) : draft.toWalletId }); }} label="Loại giao dịch" options={typeOptions.map((option) => ({ ...option, disabled: option.value === "transfer" && wallets.length < 2 }))}/></label>
      <label className="quick-field">Số tiền<Input autoFocus={mode === "create"} disabled={locked} inputMode="decimal" value={draft.amount} onChange={(event) => onChange({ amount: event.target.value })} placeholder="0"/></label>
      <label className="quick-field">Ví thực hiện<Select disabled={locked} value={draft.walletId} onValueChange={(walletId) => onChange({ walletId, toWalletId: draft.toWalletId === walletId ? defaultDestination(wallets, walletId) : draft.toWalletId })} label="Ví thực hiện" options={wallets.map((item) => ({ value: item.id, label: item.name }))}/></label>
      {draft.type === "transfer" && <label className="quick-field">Ví nhận<Select disabled={locked} value={draft.toWalletId} onValueChange={(toWalletId) => onChange({ toWalletId })} label="Ví nhận" options={wallets.map((item) => ({ value: item.id, label: item.name, disabled: item.id === draft.walletId }))}/></label>}
      {draft.type !== "transfer" && <label className="quick-field">Danh mục<Select disabled={locked} value={draft.categoryId} onValueChange={(categoryId) => onChange({ categoryId })} label="Danh mục" options={[{ value: "none", label: "Không chọn" }, ...categories.map((item) => ({ value: item.id, label: item.name }))]}/></label>}
      <label className="quick-field">Ngày giao dịch<Input disabled={locked} type="date" value={draft.date} onChange={(event) => onChange({ date: event.target.value })}/></label>
      <label className="quick-field ledger-mobile-draft-wide">Nội dung<Input disabled={locked} value={draft.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="Ví dụ: Ăn trưa, nhận lương"/></label>
    </div>
    <div className="ledger-mobile-draft-actions"><Button variant="outline" disabled={busy} onClick={onCancel}>Hủy</Button><Button variant="default" disabled={locked} onClick={onSave}>{busy ? "Đang lưu" : mode === "create" ? "Lưu giao dịch" : "Lưu thay đổi"}</Button></div>
  </section>;
}

function ConfirmDelete({ count, busy, onCancel, onConfirm }: { count: number; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <Card as="section" className="ledger-confirm-panel gap-0 py-0" aria-labelledby="delete-transactions-title"><div><p className="public-eyebrow">Thao tác có hiệu lực ngay</p><h2 id="delete-transactions-title">Xóa {count} giao dịch?</h2><p>Giao dịch đã ghi nhận sẽ được hoàn tác khỏi số dư ví.</p></div><div className="dialog-actions"><Button type="button" variant="outline" autoFocus disabled={busy} onClick={onCancel}>Hủy</Button><Button type="button" variant="destructive" disabled={busy} onClick={onConfirm}>{busy ? "Đang xóa" : "Xác nhận xóa"}</Button></div></Card>;
}


function Status({ value }: { value: LedgerItem["status"] }) {
  const label = { approved: "Đã ghi nhận", pending: "Chờ xác nhận", scheduled: "Đã lên lịch", rejected: "Đã từ chối" }[value];
  return <span className={`status status-${value}`}>{label}</span>;
}
