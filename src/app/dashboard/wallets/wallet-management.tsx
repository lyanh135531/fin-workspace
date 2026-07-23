"use client";

import {
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  Pencil,
  Plus,
  Search,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createManagedWalletAction,
  updateManagedWalletAction,
} from "@/app/dashboard/wallets/actions";
import { showToast } from "@/components/toast-container";
import { formatAmount } from "@/lib/format";

type WalletItem = {
  id: string;
  name: string;
  description: string | null;
  openingBalance: string;
  currentBalance: string;
  status: "active" | "deactive";
  transactionCount: number;
  updatedAt: string;
};

/* Deterministic gradient color generator based on wallet name */
const WALLET_COLORS = [
  "#FF5B3D",
  "#1677B8",
  "#7959C8",
  "#2F7D5B",
  "#334E8C",
  "#E58EB3",
  "#008E9B",
  "#D6A53A",
];

function walletColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return WALLET_COLORS[Math.abs(hash) % WALLET_COLORS.length];
}

export function WalletManagement({
  workspace,
  wallets,
  totalBalance,
  isAdmin,
}: {
  workspace: { name: string; currency: string };
  wallets: WalletItem[];
  totalBalance: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [creatingModal, setCreatingModal] = useState(false);
  const [editingWallet, setEditingWallet] = useState<WalletItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "deactive">("all");
  const [pending, startTransition] = useTransition();

  const activeCount = wallets.filter((wallet) => wallet.status === "active").length;
  const transactionCount = wallets.reduce((total, wallet) => total + wallet.transactionCount, 0);

  // Filtered wallets list based on search and status filter
  const filteredWallets = useMemo(() => {
    return wallets.filter((wallet) => {
      const matchesSearch =
        wallet.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (wallet.description && wallet.description.toLowerCase().includes(searchQuery.toLowerCase().trim()));
      const matchesStatus = filterStatus === "all" || wallet.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [wallets, searchQuery, filterStatus]);

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await createManagedWalletAction({
        name: data.get("name"),
        openingBalance: data.get("openingBalance"),
        description: data.get("description") || undefined,
      });
      if (result.ok) {
        showToast("Đã tạo ví mới thành công!", "success");
        form.reset();
        setCreatingModal(false);
        router.refresh();
      } else {
        showToast(result.message ?? "Không thể tạo ví.", "error");
      }
    });
  }

  function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingWallet) return;
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateManagedWalletAction({
        walletId: editingWallet.id,
        name: data.get("name"),
        description: data.get("description"),
      });
      if (result.ok) {
        showToast("Đã cập nhật thông tin ví thành công!", "success");
        setEditingWallet(null);
        router.refresh();
      } else {
        showToast(result.message ?? "Không thể cập nhật ví.", "error");
      }
    });
  }

  return (
    <div className="workspace-settings-container space-y-6">
      {/* ── Header Hero Section ── */}
      <header className="settings-hero">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="settings-badge">
              <WalletCards size={13} className="text-[var(--primary)]" />
              Quản lý ví · {workspace.name}
            </span>
          </div>
          <h1>Quản lý ví</h1>
          <p className="settings-hero-copy">
            Theo dõi số dư, trạng thái hoạt động và cấu hình thông tin từng tài khoản ví trong workspace.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            className="button-primary inline-flex items-center gap-2 font-semibold text-sm px-5 py-2.5 shadow-sm shrink-0"
            onClick={() => setCreatingModal(true)}
          >
            <Plus size={17} />
            <span>Thêm ví mới</span>
          </button>
        )}
      </header>

      {/* ── KPI Summary Cards ── */}
      <section className="wallet-kpi-grid" aria-label="Tổng quan ví">
        {/* KPI 1: Tổng số dư */}
        <article className="wallet-kpi-card flex items-center justify-between">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-slate-500 block">Tổng số dư đang hoạt động</span>
            <strong className="text-xl font-bold tracking-tight text-[var(--foreground)] block truncate tabular-nums">
              {formatAmount(totalBalance)} {workspace.currency}
            </strong>
            <span className="text-[11px] text-slate-400 block">
              Đã tính từ {activeCount} ví đang hoạt động
            </span>
          </div>
          <div className="wallet-kpi-icon bg-blue-500/10 text-blue-600 border border-blue-500/15 shrink-0 ml-3">
            <WalletCards size={20} />
          </div>
        </article>

        {/* KPI 2: Số lượng ví */}
        <article className="wallet-kpi-card flex items-center justify-between">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-slate-500 block">Ví đang hoạt động</span>
            <strong className="text-xl font-bold tracking-tight text-[var(--foreground)] block tabular-nums">
              {activeCount} <span className="text-sm font-normal text-slate-400">/ {wallets.length} ví</span>
            </strong>
            <span className="text-[11px] text-slate-400 block flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              {wallets.length - activeCount === 0 ? "Tất cả ví đều sẵn sàng" : `${wallets.length - activeCount} ví tạm ngưng`}
            </span>
          </div>
          <div className="wallet-kpi-icon bg-emerald-500/10 text-emerald-600 border border-emerald-500/15 shrink-0 ml-3">
            <CheckCircle2 size={20} />
          </div>
        </article>

        {/* KPI 3: Lượt giao dịch */}
        <article className="wallet-kpi-card flex items-center justify-between">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-slate-500 block">Lượt giao dịch liên quan</span>
            <strong className="text-xl font-bold tracking-tight text-[var(--foreground)] block tabular-nums">
              {transactionCount} <span className="text-sm font-normal text-slate-400">giao dịch</span>
            </strong>
            <span className="text-[11px] text-slate-400 block">
              Tổng lượt ghi nhận qua các ví
            </span>
          </div>
          <div className="wallet-kpi-icon bg-amber-500/10 text-amber-600 border border-amber-500/15 shrink-0 ml-3">
            <ArrowLeftRight size={20} />
          </div>
        </article>
      </section>

      {/* ── Toolbar: Search & Filter ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-1 border-b border-[var(--border)]">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[var(--surface-muted)] rounded-xl border border-[var(--border)]">
          <button
            type="button"
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterStatus === "all"
                ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm border border-[var(--border)]"
                : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"
            }`}
            onClick={() => setFilterStatus("all")}
          >
            Tất cả ({wallets.length})
          </button>
          <button
            type="button"
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterStatus === "active"
                ? "bg-[var(--surface)] text-emerald-600 shadow-sm border border-emerald-500/20"
                : "text-[var(--text-secondary)] hover:text-emerald-600"
            }`}
            onClick={() => setFilterStatus("active")}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Đang hoạt động ({activeCount})
          </button>
          {wallets.length - activeCount > 0 && (
            <button
              type="button"
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterStatus === "deactive"
                  ? "bg-[var(--surface)] text-amber-600 shadow-sm border border-amber-500/20"
                  : "text-[var(--text-secondary)] hover:text-amber-600"
              }`}
              onClick={() => setFilterStatus("deactive")}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              Tạm ngưng ({wallets.length - activeCount})
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="ws-category-search">
          <span className="ws-category-search-icon">
            <Search size={15} />
          </span>
          <input
            type="text"
            placeholder="Tìm kiếm ví..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ── Wallet Cards Grid ── */}
      <section className="wallet-card-grid pt-1" aria-label="Danh sách ví">
        {filteredWallets.map((wallet) => {
          const color = walletColor(wallet.name);
          const isActive = wallet.status === "active";
          return (
            <article className="wallet-card-redesigned sunrise-card p-5 space-y-4" key={wallet.id}>
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Gradient Icon Badge */}
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl font-bold shadow-inner"
                    style={{
                      background: `linear-gradient(135deg, ${color}22, ${color}11)`,
                      color: color,
                      border: `1px solid ${color}33`,
                    }}
                  >
                    <WalletCards size={20} />
                  </span>

                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-[var(--foreground)] truncate">
                      {wallet.name}
                    </h3>
                    <span
                      className={
                        isActive
                          ? "wallet-card-badge wallet-card-badge-active mt-0.5"
                          : "wallet-card-badge wallet-card-badge-deactive mt-0.5"
                      }
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-amber-500"}`} />
                      {isActive ? "Đang hoạt động" : "Tạm ngưng"}
                    </span>
                  </div>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    className="button-secondary icon-button !min-h-[34px] !min-w-[34px] !p-1.5 shrink-0"
                    title={`Chỉnh sửa ${wallet.name}`}
                    aria-label={`Chỉnh sửa ${wallet.name}`}
                    onClick={() => setEditingWallet(wallet)}
                  >
                    <Pencil size={15} />
                  </button>
                )}
              </div>

              {/* Balance Box */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3.5 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
                  Số dư hiện tại
                </span>
                <strong className="text-xl font-bold tracking-tight text-[var(--foreground)] block tabular-nums">
                  {formatAmount(wallet.currentBalance)} {workspace.currency}
                </strong>
                <span className="text-[11px] text-slate-400 block tabular-nums">
                  Số dư đầu kỳ: {formatAmount(wallet.openingBalance)} {workspace.currency}
                </span>
              </div>

              {/* Description */}
              <p className="text-xs leading-relaxed text-slate-500 min-h-[2.5rem] line-clamp-2">
                {wallet.description || "Chưa có mô tả cho ví này."}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] text-xs text-slate-400 font-medium">
                <span>{wallet.transactionCount} giao dịch</span>
                <span className="flex items-center gap-1 text-[11px]">
                  <Clock size={12} />
                  {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(wallet.updatedAt))}
                </span>
              </div>
            </article>
          );
        })}

        {/* Empty state */}
        {!filteredWallets.length && (
          <div className="col-span-full p-10 text-center border border-dashed border-[var(--border)] rounded-2xl bg-[var(--surface)]">
            <WalletCards size={32} className="mx-auto text-slate-400 opacity-60 mb-3" />
            <h3 className="text-base font-bold text-[var(--foreground)]">
              {searchQuery ? `Không tìm thấy ví "${searchQuery}"` : "Workspace chưa có ví"}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? "Thử từ khóa khác hoặc xóa bộ lọc tìm kiếm"
                : isAdmin
                ? "Tạo ví đầu tiên để bắt đầu ghi nhận giao dịch tài chính cho workspace này."
                : "Admin chưa khởi tạo ví cho workspace này."}
            </p>
            {isAdmin && !searchQuery && (
              <button
                type="button"
                className="button-primary inline-flex items-center gap-2 font-semibold text-xs px-4 py-2 mt-4"
                onClick={() => setCreatingModal(true)}
              >
                <Plus size={15} />
                Tạo ví đầu tiên
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── Modal Thêm Ví Mới ── */}
      {creatingModal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[var(--overlay)] p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-wallet-title"
        >
          <form
            onSubmit={handleCreate}
            className="sunrise-card w-full max-w-md p-6 space-y-4 relative overflow-hidden"
          >
            {/* Accent glow */}
            <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl pointer-events-none opacity-20 bg-blue-500" />

            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] relative">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/15">
                  <WalletCards size={18} />
                </div>
                <div>
                  <h2 id="create-wallet-title" className="text-lg font-bold text-[var(--foreground)]">
                    Thêm ví mới
                  </h2>
                  <p className="text-xs text-slate-500">Khởi tạo tài khoản ví cho workspace</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreatingModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 relative">
              <div>
                <label htmlFor="create-name" className="text-xs font-bold text-[var(--foreground)] mb-1 block">
                  Tên ví <span className="text-rose-500">*</span>
                </label>
                <input
                  id="create-name"
                  name="name"
                  required
                  maxLength={120}
                  autoFocus
                  placeholder="Ví dụ: Tiền mặt, Ngân hàng VCB..."
                  className="field w-full text-sm font-medium"
                />
              </div>

              <div>
                <label htmlFor="create-opening" className="text-xs font-bold text-[var(--foreground)] mb-1 block">
                  Số dư đầu kỳ <span className="text-rose-500">*</span>
                </label>
                <input
                  id="create-opening"
                  name="openingBalance"
                  required
                  inputMode="decimal"
                  placeholder="0"
                  className="field w-full text-sm font-semibold tabular-nums"
                />
              </div>

              <div>
                <label htmlFor="create-desc" className="text-xs font-bold text-[var(--foreground)] mb-1 block">
                  Mô tả ví <span className="text-slate-400 font-normal lowercase">(tùy chọn)</span>
                </label>
                <textarea
                  id="create-desc"
                  name="description"
                  rows={3}
                  maxLength={2000}
                  placeholder="Mục đích sử dụng của ví..."
                  className="field settings-textarea w-full text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)] relative">
              <button
                type="button"
                className="button-secondary text-xs font-semibold px-4 py-2"
                onClick={() => setCreatingModal(false)}
              >
                Hủy
              </button>
              <button className="button-primary text-xs font-semibold px-5 py-2 inline-flex items-center gap-1.5" disabled={pending}>
                {pending ? (
                  <>
                    <span className="btn-spinner" aria-hidden />
                    Đang tạo...
                  </>
                ) : (
                  "Tạo ví"
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Modal Chỉnh Sửa Ví ── */}
      {editingWallet && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[var(--overlay)] p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-wallet-title"
        >
          <form
            onSubmit={handleUpdate}
            className="sunrise-card w-full max-w-md p-6 space-y-4 relative overflow-hidden"
          >
            {/* Accent glow */}
            <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl pointer-events-none opacity-20 bg-amber-500" />

            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] relative">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/15">
                  <Pencil size={18} />
                </div>
                <div>
                  <h2 id="edit-wallet-title" className="text-lg font-bold text-[var(--foreground)]">
                    Chỉnh sửa ví
                  </h2>
                  <p className="text-xs text-slate-500">{editingWallet.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingWallet(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 relative">
              <div>
                <label htmlFor="edit-name" className="text-xs font-bold text-[var(--foreground)] mb-1 block">
                  Tên ví <span className="text-rose-500">*</span>
                </label>
                <input
                  id="edit-name"
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={editingWallet.name}
                  className="field w-full text-sm font-medium"
                />
              </div>

              <div>
                <label htmlFor="edit-desc" className="text-xs font-bold text-[var(--foreground)] mb-1 block">
                  Mô tả ví <span className="text-slate-400 font-normal lowercase">(tùy chọn)</span>
                </label>
                <textarea
                  id="edit-desc"
                  name="description"
                  rows={3}
                  maxLength={2000}
                  defaultValue={editingWallet.description ?? ""}
                  placeholder="Mục đích sử dụng của ví..."
                  className="field settings-textarea w-full text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)] relative">
              <button
                type="button"
                className="button-secondary text-xs font-semibold px-4 py-2"
                onClick={() => setEditingWallet(null)}
              >
                Hủy
              </button>
              <button className="button-primary text-xs font-semibold px-5 py-2 inline-flex items-center gap-1.5" disabled={pending}>
                {pending ? (
                  <>
                    <span className="btn-spinner" aria-hidden />
                    Đang lưu...
                  </>
                ) : (
                  "Lưu thay đổi"
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
