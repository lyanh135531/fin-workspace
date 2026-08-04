"use client";

import { Check, FilterX, Menu, Pencil, Plus, Trash2, WalletCards, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  addTransactionAction,
  approveTransactionAction,
  deleteTransactionAction,
  deleteTransactionsAction,
  rejectTransactionAction,
  updateTransactionsAction,
} from "@/app/dashboard/actions";
import { formatAmount } from "@/lib/format";
import { Textarea } from "@/components/ui/textarea";
import { Button, Card, CategoryTreeSelect, Checkbox, DatePicker, Empty, Input, MoneyInput, Search, Select } from "@/components/base";
import { toast } from "sonner";


type Option = { id: string; name: string; color?: string; icon?: string | null; parentId?: string | null };
type CategoryOption = Option & { type: "income" | "expense" };
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

function categoriesForTransactionType(categories: CategoryOption[], type: TransactionType): CategoryOption[] {
  return type === "transfer" ? [] : categories.filter((category) => category.type === type);
}

function newTransactionDraft(wallets: Option[], categories: CategoryOption[], businessDate: string): TransactionDraft {
  const walletId = wallets[0]?.id ?? "";
  return {
    description: "",
    type: "expense",
    categoryId: categoriesForTransactionType(categories, "expense")[0]?.id ?? "none",
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

export function Ledger({ workspaceId, businessDate, initialMonth, selectedMonth, onMonthChange, transactions, totalTransactions, pageSize, canApprove, canEditTransactions, isAdmin, scopeLabel, wallets, categories, canManageWallets, currency, readonly = false, startWithNewTransaction = false }: { workspaceId: string; businessDate: string; initialMonth: string; selectedMonth?: string; onMonthChange?: (month: string) => void; transactions: LedgerItem[]; totalTransactions: number; pageSize: number; canApprove: boolean; canEditTransactions: boolean; isAdmin: boolean; scopeLabel: string; wallets: Option[]; categories: CategoryOption[]; canManageWallets: boolean; currency: string; readonly?: boolean; startWithNewTransaction?: boolean }) {
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
      <Select value={month} ariaLabel="Lọc theo tháng" onValueChange={(value) => changeFilter(() => {
        setInternalMonth(value);
        onMonthChange?.(value);
      })} disabled={editMode} className="w-auto max-w-44" options={monthOptions}/>
      <Select value={status} ariaLabel="Lọc trạng thái" onValueChange={(value) => changeFilter(() => setStatus(value))} disabled={editMode} className="w-auto max-w-38" options={[{ value: "all", label: "Tất cả" }, { value: "approved", label: "Đã ghi nhận" }, { value: "pending", label: "Chờ xác nhận" }, { value: "scheduled", label: "Đã lên lịch" }, { value: "rejected", label: "Đã từ chối" }]}/>
      <Button variant="icon" size="icon" className="ledger-clear-filter max-[760px]:hidden" disabled={editMode || !hasActiveFilters} onClick={clearFilters} title="Xóa tìm kiếm và bộ lọc" aria-label="Xóa bộ lọc"><FilterX size={16}/></Button>
      <div className="ledger-desktop-tools">
        {canApprove && selected.size > 0 && <Button variant="outline" size="icon" className="ledger-delete-button" disabled={editMode || busy} onClick={() => setConfirmBulkDelete(true)} title={`Xóa ${selected.size} giao dịch đã chọn`} aria-label={`Xóa ${selected.size} giao dịch đã chọn`}><Trash2 size={16}/></Button>}
        {!readonly && <div className="ledger-create-actions"><Button variant="default" size="default" className="ledger-primary-create" disabled={busy || editMode || Boolean(createDraft) || !wallets.length} onClick={beginCreate}><Plus size={17}/>Giao dịch mới</Button></div>}
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
    {editMode && !isAdmin && <div className="ledger-edit-reason-bar"><Input label="Lý do chỉnh sửa" wrapperClassName="w-full max-w-[28rem]" value={editReason} onChange={(event) => setEditReason(event.target.value)} placeholder="Mặc định: Đã thông báo" maxLength={2000}/><span>Áp dụng cho các hàng đã thay đổi.</span></div>}

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
          {canApprove && <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggle(item.id)} aria-label={`Chọn giao dịch ${item.description || item.id}`}/>}
          <div className="ledger-mobile-card-copy">
            <strong title={item.description || "Không có nội dung"}>{item.description || "Không có nội dung"}</strong>
            <div className="ledger-mobile-card-subline">
              <small>#{String(Math.max(1, totalTransactions - ((page - 1) * pageSize + index))).padStart(5, "0")} · {item.member}{item.isRecurring ? " · Tự động" : ""}</small>
              <b
                className={`ledger-amount amount-${item.type}`}
                title={`${item.type === "income" ? "+" : item.type === "expense" ? "−" : "↔"}${formatAmount(item.amount)} ${currency}`}
                aria-label={`Số tiền ${formatAmount(item.amount)} ${currency}`}
              >
                {item.type === "income" ? "+" : item.type === "expense" ? "−" : "↔"}{formatAmount(item.amount)} {currency}
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
            {canEditTransactions && !item.hasPendingChange && <Button variant="icon" size="icon" disabled={busy} onClick={() => beginEdit(item.id)} title="Chỉnh sửa giao dịch" aria-label={`Chỉnh sửa ${item.description || "giao dịch"}`}><Pencil size={16}/></Button>}
            {!readonly && item.canRequestDelete && <Button variant="icon" size="icon" disabled={busy || item.hasPendingChange} onClick={() => setDeleteTarget(item)} title="Xóa giao dịch" aria-label={`Xóa ${item.description || "giao dịch"}`}><Trash2 size={16}/></Button>}
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

    <div className="ledger-scroll-area ledger-desktop-table"><table className="ledger-table w-full min-w-[1080px] text-left text-sm"><colgroup>{canApprove && <col className="ledger-selection-column" />}<col className="ledger-description-column" /><col className="ledger-type-column" /><col className="ledger-category-column" /><col className="ledger-wallet-column" /><col className="ledger-date-column" /><col className="ledger-amount-column" /><col className="ledger-status-column" /><col className="ledger-actions-column" /></colgroup><thead><tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--text-muted)]">{canApprove && <th className="w-10"><Checkbox checked={allSelected} disabled={editMode} onCheckedChange={toggleAll} aria-label="Chọn tất cả giao dịch đang hiển thị"/></th>}<th className="ledger-description-column">Giao dịch</th><th className="ledger-type-column">Loại</th><th className="ledger-category-column">Danh mục</th><th className="ledger-wallet-column">Ví</th><th className="ledger-date-column">Ngày</th><th className="ledger-amount-column text-right">Số tiền</th><th className="ledger-status-column">Trạng thái</th><th className="ledger-actions-column">Thao tác</th></tr></thead><tbody>
      {createDraft && <CreateDraftRow draft={createDraft} wallets={wallets} categories={categories} canApprove={canApprove} busy={busy} onChange={(patch) => setCreateDraft((current) => current ? { ...current, ...patch } : current)} onSave={saveCreate} onCancel={() => setCreateDraft(null)}/>}
      {rows.map((item, index) => editMode && (!editTargetId || item.id === editTargetId)
        ? <EditDraftRow key={item.id} draft={editDrafts[item.id] ?? draftFromTransaction(item, wallets)} wallets={wallets} categories={categories} canApprove={canApprove} busy={busy} disabled={!isAdmin && item.hasPendingChange} autoFocus={index === 0} status={<><Status value={item.status}/>{item.hasPendingChange && <small className="ledger-change-pending">Đang chờ thay đổi</small>}</>} onChange={(patch) => updateDraft(item.id, patch)} onSave={saveEdits} onCancel={cancelEdit}/>
        : <tr key={item.id} className="border-b border-[var(--border)]">
          {canApprove && <td><Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggle(item.id)} aria-label={`Chọn giao dịch ${item.description || item.id}`}/></td>}
          <td className="ledger-description-column"><p className="font-medium">{item.description || "Không có nội dung"}</p><p className="mt-1 text-xs text-[var(--text-muted)]">#{String(Math.max(1, totalTransactions - ((page - 1) * pageSize + index))).padStart(5, "0")} · {item.member}{item.isRecurring ? " · Tự động" : ""}</p></td>
          <td className="ledger-type-column">{typeOptions.find((option) => option.value === item.type)?.label}</td>
          <td className="ledger-category-column">{item.category ? <span className="category-tag" style={{ backgroundColor: `${item.category.color}22`, color: item.category.color }}>{item.category.name}</span> : "—"}</td>
          <td className="ledger-wallet-column">{item.wallet}{item.toWallet ? <small className="ledger-wallet-destination">→ {item.toWallet}</small> : null}</td>
          <td className="ledger-date-column">{formatLedgerDate(item.date)}</td>
          <td className={`ledger-amount ledger-amount-column amount-${item.type}`}>{item.type === "income" ? "+" : item.type === "expense" ? "−" : "↔"}{formatAmount(item.amount)} {currency}</td>
          <td className="ledger-status-column"><Status value={item.status}/>{item.hasPendingChange && <small className="ledger-change-pending">Đang chờ thay đổi</small>}</td>
          <td className="ledger-actions-column"><div className="ledger-row-actions">
            {canApprove && item.status === "pending" && <Button variant="ghost" size="default" disabled={busy || editMode} onClick={() => rejectOne(item)}>Từ chối</Button>}
            {canApprove && (item.status === "pending" || item.status === "scheduled") && <Button variant="outline" size="default" disabled={busy || editMode} onClick={() => approveOne(item)}>{item.status === "scheduled" ? "Ghi nhận sớm" : "Duyệt"}</Button>}
            {canEditTransactions && !item.hasPendingChange && <Button variant="icon" size="icon" disabled={busy || editMode} onClick={() => beginEdit(item.id)} title="Chỉnh sửa giao dịch" aria-label={`Chỉnh sửa ${item.description || "giao dịch"}`}><Pencil size={16}/></Button>}
            {!readonly && item.canRequestDelete && <Button variant="icon" size="icon" disabled={busy || editMode || item.hasPendingChange} onClick={() => setDeleteTarget(item)} title="Xóa giao dịch" aria-label={`Xóa ${item.description || "giao dịch"}`}><Trash2 size={16}/></Button>}
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
      <p className="ledger-record-count">Hiển thị {pageStart}–{pageEnd}/{filteredRows.length} giao dịch · {totalTransactions} trong {scopeLabel}.</p>
      {pageCount > 1 && <nav aria-label="Phân trang sổ giao dịch">
        <Button variant="outline" size="default" disabled={page <= 1} onClick={() => setCurrentPage(Math.max(1, page - 1))}>Trang trước</Button>
        <span>Trang {page}/{pageCount}</span>
        <Button variant="outline" size="default" disabled={page >= pageCount} onClick={() => setCurrentPage(Math.min(pageCount, page + 1))}>Trang sau</Button>
      </nav>}
    </footer>
  </div>;
}

function CreateDraftRow({ draft, wallets, categories, canApprove, busy, onChange, onSave, onCancel }: { draft: TransactionDraft; wallets: Option[]; categories: CategoryOption[]; canApprove: boolean; busy: boolean; onChange: (patch: Partial<TransactionDraft>) => void; onSave: () => void; onCancel: () => void }) {
  const handleTypeChange = (value: string) => {
    const type = value as TransactionType;
    onChange({
      type,
      categoryId: "none",
      toWalletId: type === "transfer" ? draft.toWalletId || defaultDestination(wallets, draft.walletId) : draft.toWalletId,
    });
  };

  const handleWalletChange = (walletId: string) => {
    onChange({
      walletId,
      toWalletId: draft.toWalletId === walletId ? defaultDestination(wallets, walletId) : draft.toWalletId,
    });
  };

  return <tr className="ledger-create-row ledger-draft-row border-b border-[var(--border)]" aria-label="Tạo giao dịch mới">
    {canApprove && <td aria-hidden="true"/>}
    <td className="ledger-description-column"><Input autoFocus disabled={busy} className="ledger-cell-input" value={draft.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="Nội dung" aria-label="Nội dung giao dịch"/></td>
    <td className="ledger-type-column"><Select disabled={busy} value={draft.type} onValueChange={handleTypeChange} ariaLabel="Loại giao dịch" options={typeOptions.map((option) => ({ ...option, disabled: option.value === "transfer" && wallets.length < 2 }))}/></td>
    <td className="ledger-category-column"><CategoryTreeSelect disabled={busy || draft.type === "transfer" || !categoriesForTransactionType(categories, draft.type).length} value={draft.categoryId} onValueChange={(categoryId) => onChange({ categoryId })} ariaLabel="Danh mục" categories={categoriesForTransactionType(categories, draft.type)} emptyOption={{ value: "none", label: "Không chọn" }}/></td>
    <td className="ledger-wallet-column"><div className="ledger-wallet-fields">
      <Select disabled={busy || !wallets.length} value={draft.walletId} onValueChange={handleWalletChange} ariaLabel="Ví thực hiện" options={wallets.map((item) => ({ value: item.id, label: item.name }))}/>
      {draft.type === "transfer" && <Select disabled={busy || !wallets.length} value={draft.toWalletId} onValueChange={(toWalletId) => onChange({ toWalletId })} ariaLabel="Ví nhận" options={wallets.map((item) => ({ value: item.id, label: item.name, disabled: item.id === draft.walletId }))}/>}
    </div></td>
    <td className="ledger-date-column"><DatePicker disabled={busy} className="ledger-date-input" ariaLabel="Ngày giao dịch" value={draft.date} onValueChange={(date) => onChange({ date })}/></td>
    <td className="ledger-amount-column"><MoneyInput disabled={busy} className="ledger-amount-input" value={draft.amount} onValueChange={(amount) => onChange({ amount })} aria-label="Số tiền"/></td>
    <td className="ledger-status-column"><span className="status status-scheduled">Mới</span></td>
    <td className="ledger-actions-column"><div className="ledger-row-actions">
      <Button variant="icon" size="icon" disabled={busy} onClick={onCancel} title="Hủy tạo giao dịch" aria-label="Hủy tạo giao dịch"><X size={16}/></Button>
      <Button variant="icon" size="icon" disabled={busy} onClick={onSave} title={busy ? "Đang lưu" : "Lưu giao dịch"} aria-label={busy ? "Đang lưu" : "Lưu giao dịch"}><Check size={16}/></Button>
    </div></td>
  </tr>;
}

function EditDraftRow({ draft, wallets, categories, canApprove, busy, disabled = false, autoFocus = false, status, onChange, onSave, onCancel }: { draft: TransactionDraft; wallets: Option[]; categories: CategoryOption[]; canApprove: boolean; busy: boolean; disabled?: boolean; autoFocus?: boolean; status?: React.ReactNode; onChange: (patch: Partial<TransactionDraft>) => void; onSave: () => void; onCancel: () => void }) {
  return <tr className={`ledger-draft-row border-b border-[var(--border)] ${disabled ? "disabled" : ""}`}>
    {canApprove && <td aria-hidden="true"/>}
    <td className="ledger-description-column"><Input autoFocus={autoFocus} disabled={disabled || busy} className="ledger-cell-input" value={draft.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="Nội dung" aria-label="Nội dung giao dịch"/></td>
    <td className="ledger-type-column"><Select disabled={disabled || busy} value={draft.type} onValueChange={(value) => { const type = value as TransactionType; onChange({ type, categoryId: "none", toWalletId: type === "transfer" ? draft.toWalletId || defaultDestination(wallets, draft.walletId) : draft.toWalletId }); }} ariaLabel="Loại giao dịch" options={typeOptions.map((option) => ({ ...option, disabled: option.value === "transfer" && wallets.length < 2 }))}/></td>
    <td className="ledger-category-column"><CategoryTreeSelect disabled={disabled || busy || draft.type === "transfer" || !categoriesForTransactionType(categories, draft.type).length} value={draft.categoryId} onValueChange={(categoryId) => onChange({ categoryId })} ariaLabel="Danh mục" categories={categoriesForTransactionType(categories, draft.type)} emptyOption={{ value: "none", label: "Không chọn" }}/></td>
    <td className="ledger-wallet-column"><div className="ledger-wallet-fields"><Select disabled={disabled || busy || !wallets.length} value={draft.walletId} onValueChange={(walletId) => onChange({ walletId, toWalletId: draft.toWalletId === walletId ? defaultDestination(wallets, walletId) : draft.toWalletId })} ariaLabel="Ví thực hiện" options={wallets.map((item) => ({ value: item.id, label: item.name }))}/>{draft.type === "transfer" && <Select disabled={disabled || busy || !wallets.length} value={draft.toWalletId} onValueChange={(toWalletId) => onChange({ toWalletId })} ariaLabel="Ví nhận" options={wallets.map((item) => ({ value: item.id, label: item.name, disabled: item.id === draft.walletId }))}/>}</div></td>
    <td className="ledger-date-column"><DatePicker disabled={disabled || busy} className="ledger-date-input" ariaLabel="Ngày giao dịch" value={draft.date} onValueChange={(date) => onChange({ date })}/></td>
    <td className="ledger-amount-column"><MoneyInput disabled={disabled || busy} className="ledger-amount-input" value={draft.amount} onValueChange={(amount) => onChange({ amount })} placeholder="0" aria-label="Số tiền"/></td>
    <td className="ledger-status-column">{status}</td>
    <td className="ledger-actions-column"><div className="ledger-row-actions">
      <Button variant="icon" size="icon" disabled={busy} onClick={onCancel} title="Hủy chỉnh sửa" aria-label="Hủy chỉnh sửa"><X size={16}/></Button>
      <Button variant="icon" size="icon" disabled={disabled || busy} onClick={onSave} title={busy ? "Đang lưu" : "Lưu thay đổi"} aria-label={busy ? "Đang lưu" : "Lưu thay đổi"}><Check size={16}/></Button>
    </div></td>
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
  categories: CategoryOption[];
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
      <Select disabled={locked} value={draft.type} onValueChange={(value) => { const type = value as TransactionType; onChange({ type, categoryId: "none", toWalletId: type === "transfer" ? draft.toWalletId || defaultDestination(wallets, draft.walletId) : draft.toWalletId }); }} label="Loại giao dịch" options={typeOptions.map((option) => ({ ...option, disabled: option.value === "transfer" && wallets.length < 2 }))}/>
      <MoneyInput autoFocus={mode === "create"} disabled={locked} value={draft.amount} onValueChange={(amount) => onChange({ amount })} placeholder="0" label="Số tiền"/>
      <Select disabled={locked} value={draft.walletId} onValueChange={(walletId) => onChange({ walletId, toWalletId: draft.toWalletId === walletId ? defaultDestination(wallets, walletId) : draft.toWalletId })} label="Ví thực hiện" options={wallets.map((item) => ({ value: item.id, label: item.name }))}/>
      {draft.type === "transfer" && <Select disabled={locked} value={draft.toWalletId} onValueChange={(toWalletId) => onChange({ toWalletId })} label="Ví nhận" options={wallets.map((item) => ({ value: item.id, label: item.name, disabled: item.id === draft.walletId }))}/>}
      {draft.type !== "transfer" && <CategoryTreeSelect disabled={locked} value={draft.categoryId} onValueChange={(categoryId) => onChange({ categoryId })} label="Danh mục" categories={categoriesForTransactionType(categories, draft.type)} emptyOption={{ value: "none", label: "Không chọn" }}/>}
      <DatePicker disabled={locked} label="Ngày giao dịch" value={draft.date} onValueChange={(date) => onChange({ date })}/>
      <Input disabled={locked} value={draft.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="Ăn trưa, nhận lương" label="Nội dung" wrapperClassName="ledger-mobile-draft-wide" />
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
