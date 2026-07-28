"use client";

import Decimal from "decimal.js";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Repeat2,
  Search,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createManagedWalletAction,
  setManagedWalletStatusAction,
  softDeleteManagedWalletAction,
  updateManagedWalletAction,
} from "@/app/dashboard/wallets/actions";
import { FinanceSelect } from "@/components/finance/finance-select";
import { formatAmount } from "@/lib/format";
import { Button, Card, Tabs, TabsCount, TabsList, TabsTrigger } from "@/components/base";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type WalletItem = {
  id: string;
  name: string;
  description: string | null;
  openingBalance: string;
  currentBalance: string;
  status: "active" | "deactive";
  transactionCount: number;
  recurringTransactionCount: number;
  updatedAt: string;
};

type DestructiveWalletOperation = {
  wallet: WalletItem;
  kind: "deactivate" | "delete";
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
  const [createFundingType, setCreateFundingType] = useState<"transfer" | "income">("income");
  const [createFundingAmount, setCreateFundingAmount] = useState("0");
  const [createFundingWalletId, setCreateFundingWalletId] = useState("");
  const [editingWallet, setEditingWallet] = useState<WalletItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "deactive">("all");
  const [confirmOperation, setConfirmOperation] = useState<DestructiveWalletOperation | null>(null);
  const [settlementWalletId, setSettlementWalletId] = useState("");
  const [blockedOperation, setBlockedOperation] = useState<DestructiveWalletOperation | null>(null);
  const [pending, startTransition] = useTransition();

  const activeCount = wallets.filter((wallet) => wallet.status === "active").length;
  const activeWallets = wallets.filter((wallet) => wallet.status === "active");
  const transactionCount = wallets.reduce((total, wallet) => total + wallet.transactionCount, 0);
  const confirmedBalance = new Decimal(confirmOperation?.wallet.currentBalance ?? 0);
  const requiresSettlement = confirmOperation?.kind === "delete" && !confirmedBalance.isZero();
  const settlementWallets = wallets.filter((wallet) =>
    wallet.status === "active" && wallet.id !== confirmOperation?.wallet.id
  );
  const createFundingAmountIsValid = (() => {
    try {
      const amount = new Decimal(createFundingAmount);
      return amount.isFinite()
        && amount.decimalPlaces() <= 4
        && (createFundingType === "transfer" ? amount.gt(0) : amount.gte(0));
    } catch {
      return false;
    }
  })();

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
        description: data.get("description") || undefined,
        funding: createFundingType === "income"
          ? { type: "income", amount: createFundingAmount }
          : {
              type: "transfer",
              amount: createFundingAmount,
              sourceWalletId: createFundingWalletId,
            },
      });
      if (result.ok) {
        toast.success("Đã tạo ví mới.");
        form.reset();
        setCreateFundingType("income");
        setCreateFundingAmount("0");
        setCreateFundingWalletId("");
        setCreatingModal(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Không thể tạo ví.");
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
        toast.success("Đã cập nhật thông tin ví thành công!");
        setEditingWallet(null);
        router.refresh();
      } else {
        toast.error(result.message ?? "Không thể cập nhật ví.");
      }
    });
  }

  function requestDestructiveOperation(
    wallet: WalletItem,
    kind: DestructiveWalletOperation["kind"],
  ) {
    const operation = { wallet, kind };
    if (wallet.recurringTransactionCount > 0) {
      setBlockedOperation(operation);
      return;
    }
    setSettlementWalletId(
      kind === "delete"
        ? wallets.find((candidate) => candidate.status === "active" && candidate.id !== wallet.id)?.id ?? ""
        : "",
    );
    setConfirmOperation(operation);
  }

  function activateWallet(wallet: WalletItem) {
    startTransition(async () => {
      const result = await setManagedWalletStatusAction({
        walletId: wallet.id,
        status: "active",
      });
      if (result.ok) {
        toast.success(`Đã kích hoạt lại ví “${wallet.name}”.`);
        setEditingWallet(null);
        router.refresh();
      } else {
        toast.error(result.message ?? "Không thể kích hoạt lại ví.");
      }
    });
  }

  function confirmDestructiveOperation() {
    if (!confirmOperation) return;
    const { wallet, kind } = confirmOperation;
    startTransition(async () => {
      const result = kind === "deactivate"
        ? await setManagedWalletStatusAction({ walletId: wallet.id, status: "deactive" })
        : await softDeleteManagedWalletAction({
            walletId: wallet.id,
            settlementWalletId: requiresSettlement ? settlementWalletId : undefined,
          });
      if (result.ok) {
        toast.success(
          kind === "deactivate"
            ? `Đã tạm ngưng ví “${wallet.name}”.`
            : `Đã xóa ví “${wallet.name}”.`,
        );
        setConfirmOperation(null);
        setSettlementWalletId("");
        setEditingWallet(null);
        router.refresh();
      } else {
        toast.error(result.message ?? "Không thể xử lý ví.");
      }
    });
  }

  return (
    <div className="workspace-settings-container space-y-6">
      {/* ── Page Header ── */}
      <div className="page-header">
        <h1 className="page-title">Ví</h1>
        {isAdmin && (
          <Button
            type="button"
            variant="default" className="shrink-0"
            onClick={() => setCreatingModal(true)}
          >
            <Plus size={16} />
            <span>Thêm ví</span>
          </Button>
        )}
      </div>

      {/* ── KPI Summary Cards ── */}
      <section className="wallet-kpi-grid" aria-label="Tổng quan ví">
        {/* KPI 1: Tổng số dư */}
        <Card as="article" className="wallet-kpi-card gap-0 py-0 flex items-center justify-between">
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
        </Card>

        {/* KPI 2: Số lượng ví */}
        <Card as="article" className="wallet-kpi-card gap-0 py-0 flex items-center justify-between">
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
        </Card>

        {/* KPI 3: Lượt giao dịch */}
        <Card as="article" className="wallet-kpi-card gap-0 py-0 flex items-center justify-between">
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
        </Card>
      </section>

      {/* ── Toolbar: Search & Filter ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-1 border-b border-[var(--border)]">
        {/* Status Filter Tabs */}
        <Tabs
          value={filterStatus}
          onValueChange={(value) => setFilterStatus(value as "all" | "active" | "deactive")}
        >
          <TabsList>
          <TabsTrigger value="all">
            <span>Tất cả</span><TabsCount>{wallets.length}</TabsCount>
          </TabsTrigger>
          <TabsTrigger value="active">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            <span>Đang hoạt động</span><TabsCount>{activeCount}</TabsCount>
          </TabsTrigger>
          {wallets.length - activeCount > 0 && (
            <TabsTrigger value="deactive">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              <span>Tạm ngưng</span><TabsCount>{wallets.length - activeCount}</TabsCount>
            </TabsTrigger>
          )}
          </TabsList>
        </Tabs>

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
            <Card as="article" className="wallet-card-redesigned sunrise-card gap-0 p-5 space-y-4" key={wallet.id}>
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
                  <Button
                    type="button"
                    variant="outline" size="icon" className="shrink-0"
                    title={`Chỉnh sửa ${wallet.name}`}
                    aria-label={`Chỉnh sửa ${wallet.name}`}
                    onClick={() => setEditingWallet(wallet)}
                  >
                    <Pencil size={15} />
                  </Button>
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

              {wallet.recurringTransactionCount > 0 && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                  <Repeat2 size={13} />
                  {wallet.recurringTransactionCount} giao dịch định kỳ đang sử dụng
                </p>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] text-xs text-slate-400 font-medium">
                <span>{wallet.transactionCount} giao dịch</span>
                <span className="flex items-center gap-1 text-[11px]">
                  <Clock size={12} />
                  {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(wallet.updatedAt))}
                </span>
              </div>
            </Card>
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
              <Button
                type="button"
                variant="default" size="default" className="mt-4"
                onClick={() => setCreatingModal(true)}
              >
                <Plus size={15} />
                Tạo ví đầu tiên
              </Button>
            )}
          </div>
        )}
      </section>

      {/* ── Modal Thêm Ví Mới ── */}
      {creatingModal && (
        <div
          className="wallet-modal-overlay fixed inset-0 z-50 grid place-items-center bg-[var(--overlay)] p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-wallet-title"
        >
          <Card
            as="form"
            onSubmit={handleCreate}
            className="wallet-modal-panel sunrise-card gap-0 max-h-[calc(100dvh-2rem)] w-full max-w-md space-y-4 overflow-y-auto p-6 relative"
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
              <Button variant="unstyled" size="auto"
                type="button"
                onClick={() => {
                  setCreatingModal(false);
                  setCreateFundingType("income");
                  setCreateFundingAmount("0");
                  setCreateFundingWalletId("");
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </Button>
            </div>

            <div className="space-y-4 relative">
              <div>
                <Label htmlFor="create-name" className="text-xs font-bold text-[var(--foreground)] mb-1 block">
                  Tên ví <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="create-name"
                  name="name"
                  required
                  maxLength={120}
                  autoFocus
                  placeholder="Ví dụ: Tiền mặt, Ngân hàng VCB..."
                  className="w-full text-sm font-medium"
                />
              </div>

              <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3.5">
                <div>
                  <Label className="text-xs font-bold text-[var(--foreground)]">
                    Cập nhật số dư sau khi tạo
                  </Label>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    Số dư khởi tạo luôn là 0. Khoản tiền đầu tiên sẽ được ghi thành giao dịch trong Sổ giao dịch.
                  </p>
                </div>
                <FinanceSelect
                  value={createFundingType}
                  onValueChange={(value) => {
                    const nextType = value as "transfer" | "income";
                    setCreateFundingType(nextType);
                    if (nextType === "transfer" && !createFundingWalletId) {
                      setCreateFundingWalletId(activeWallets[0]?.id ?? "");
                    }
                  }}
                  label="Cách cập nhật số dư"
                  className="w-full"
                  options={[
                    { value: "income", label: "Tạo giao dịch thu nhập" },
                    { value: "transfer", label: "Chuyển từ ví khác", disabled: activeWallets.length === 0 },
                  ]}
                />
                <div className="space-y-3 border-t border-[var(--border)] pt-3">
                  {createFundingType === "transfer" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-[var(--foreground)]">Ví chuyển tiền</Label>
                      <FinanceSelect
                        value={createFundingWalletId}
                        onValueChange={setCreateFundingWalletId}
                        label="Chọn ví chuyển tiền"
                        className="w-full"
                        options={activeWallets.map((wallet) => ({
                          value: wallet.id,
                          label: `${wallet.name} · ${formatAmount(wallet.currentBalance)} ${workspace.currency}`,
                        }))}
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="create-funding-amount" className="mb-1 block text-xs font-bold text-[var(--foreground)]">
                      Số tiền <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="create-funding-amount"
                      name="fundingAmount"
                      required
                      inputMode="decimal"
                      value={createFundingAmount}
                      onChange={(event) => setCreateFundingAmount(event.target.value)}
                      placeholder="0"
                      className="w-full text-sm font-semibold tabular-nums"
                    />
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    {createFundingType === "income"
                      ? "Nhập 0 để chỉ tạo ví. Giá trị lớn hơn 0 sẽ tạo giao dịch thu nhập đã ghi nhận."
                      : "Chuyển khoản yêu cầu số tiền lớn hơn 0 và sẽ được ghi nhận ngay trong Sổ giao dịch."}
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="create-desc" className="text-xs font-bold text-[var(--foreground)] mb-1 block">
                  Mô tả ví <span className="text-slate-400 font-normal lowercase">(tùy chọn)</span>
                </Label>
                <Textarea
                  id="create-desc"
                  name="description"
                  rows={3}
                  maxLength={2000}
                  placeholder="Mục đích sử dụng của ví..."
                  className="settings-textarea w-full text-sm resize-none"
                />
              </div>

            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)] relative">
              <Button
                type="button"
                variant="outline" size="default"
                onClick={() => {
                  setCreatingModal(false);
                  setCreateFundingType("income");
                  setCreateFundingAmount("0");
                  setCreateFundingWalletId("");
                }}
              >
                Hủy
              </Button>
              <Button type="submit" variant="default" size="default" disabled={pending || !createFundingAmountIsValid || (createFundingType === "transfer" && !createFundingWalletId)}>
                {pending ? (
                  <>
                    <span className="btn-spinner" aria-hidden />
                    Đang tạo...
                  </>
                ) : (
                  "Tạo ví"
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Modal Chỉnh Sửa Ví ── */}
      {editingWallet && (
        <div
          className="wallet-modal-overlay fixed inset-0 z-50 grid place-items-center bg-[var(--overlay)] p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-wallet-title"
        >
          <Card
            as="form"
            onSubmit={handleUpdate}
            className="wallet-modal-panel sunrise-card gap-0 w-full max-w-md p-6 space-y-4 relative overflow-hidden"
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
              <Button variant="unstyled" size="auto"
                type="button"
                onClick={() => setEditingWallet(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </Button>
            </div>

            <div className="space-y-4 relative">
              <div>
                <Label htmlFor="edit-name" className="text-xs font-bold text-[var(--foreground)] mb-1 block">
                  Tên ví <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="edit-name"
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={editingWallet.name}
                  className="w-full text-sm font-medium"
                />
              </div>

              <div>
                <Label htmlFor="edit-desc" className="text-xs font-bold text-[var(--foreground)] mb-1 block">
                  Mô tả ví <span className="text-slate-400 font-normal lowercase">(tùy chọn)</span>
                </Label>
                <Textarea
                  id="edit-desc"
                  name="description"
                  rows={3}
                  maxLength={2000}
                  defaultValue={editingWallet.description ?? ""}
                  placeholder="Mục đích sử dụng của ví..."
                  className="settings-textarea w-full text-sm resize-none"
                />
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[var(--foreground)]">Trạng thái và xóa ví</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      Ví tạm ngưng không thể dùng cho giao dịch mới. Chỉ ví đã tạm ngưng mới có thể xóa.
                    </p>
                  </div>
                  <span className={editingWallet.status === "active" ? "wallet-card-badge wallet-card-badge-active" : "wallet-card-badge wallet-card-badge-deactive"}>
                    {editingWallet.status === "active" ? "Hoạt động" : "Tạm ngưng"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {editingWallet.status === "active" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="default"
                      disabled={pending}
                      onClick={() => requestDestructiveOperation(editingWallet, "deactivate")}
                    >
                      <PauseCircle size={15} />
                      Tạm ngưng
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="default"
                        disabled={pending}
                        onClick={() => activateWallet(editingWallet)}
                      >
                        <PlayCircle size={15} />
                        Kích hoạt lại
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="default"
                        disabled={pending}
                        onClick={() => requestDestructiveOperation(editingWallet, "delete")}
                      >
                        <Trash2 size={15} />
                        Xóa ví
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)] relative">
              <Button
                type="button"
                variant="outline" size="default"
                onClick={() => setEditingWallet(null)}
              >
                Hủy
              </Button>
              <Button type="submit" variant="default" size="default" disabled={pending}>
                {pending ? (
                  <>
                    <span className="btn-spinner" aria-hidden />
                    Đang lưu...
                  </>
                ) : (
                  "Lưu thay đổi"
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {blockedOperation && (
        <div
          className="wallet-modal-overlay fixed inset-0 z-[60] grid place-items-center bg-[var(--overlay)] p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="wallet-operation-blocked-title"
        >
          <Card as="section" className="wallet-modal-panel sunrise-card gap-0 w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="ws-danger-icon shrink-0"><AlertTriangle size={20} /></div>
              <div>
                <h2 id="wallet-operation-blocked-title" className="text-lg font-bold text-[var(--foreground)]">
                  Không thể {blockedOperation.kind === "delete" ? "xóa" : "tạm ngưng"} ví
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Ví <strong>“{blockedOperation.wallet.name}”</strong> đang được sử dụng bởi{" "}
                  <strong>{blockedOperation.wallet.recurringTransactionCount} giao dịch định kỳ</strong>.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 text-xs leading-relaxed text-slate-600">
              Để tiếp tục, hãy mở Giao dịch định kỳ và đổi sang ví khác, hoặc xóa các đăng ký
              đang sử dụng ví này. Lịch sử giao dịch đã phát sinh vẫn được giữ nguyên.
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] pt-4">
              <Button type="button" variant="outline" onClick={() => setBlockedOperation(null)}>
                Đóng
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={() => {
                  setBlockedOperation(null);
                  setEditingWallet(null);
                  router.push("/recurring-transactions");
                }}
              >
                <Repeat2 size={15} />
                Mở Giao dịch định kỳ
              </Button>
            </div>
          </Card>
        </div>
      )}

      {confirmOperation && (
        <div
          className="wallet-modal-overlay fixed inset-0 z-[60] grid place-items-center bg-[var(--overlay)] p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-wallet-operation-title"
        >
          <Card as="section" className="wallet-modal-panel sunrise-card gap-0 w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="ws-danger-icon shrink-0">
                {confirmOperation.kind === "delete" ? <Trash2 size={20} /> : <PauseCircle size={20} />}
              </div>
              <div>
                <h2 id="confirm-wallet-operation-title" className="text-lg font-bold text-[var(--foreground)]">
                  {confirmOperation.kind === "delete" ? "Xóa ví?" : "Tạm ngưng ví?"}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {confirmOperation.kind === "delete"
                    ? `Ví “${confirmOperation.wallet.name}” sẽ được ẩn khỏi workspace nhưng lịch sử giao dịch vẫn được giữ lại.`
                    : `Ví “${confirmOperation.wallet.name}” sẽ không thể dùng cho giao dịch mới cho đến khi được kích hoạt lại.`}
                </p>
              </div>
            </div>
            {confirmOperation.kind === "delete" && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-slate-500">Số dư cần tất toán</span>
                  <strong className={`text-sm tabular-nums ${requiresSettlement ? "text-amber-600" : "text-emerald-600"}`}>
                    {formatAmount(confirmOperation.wallet.currentBalance)} {workspace.currency}
                  </strong>
                </div>
                {requiresSettlement ? (
                  <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
                    <div className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
                      <ArrowLeftRight size={15} className="mt-0.5 shrink-0 text-amber-600" />
                      <p>
                        {confirmedBalance.isPositive()
                          ? `Hệ thống sẽ chuyển ${formatAmount(confirmedBalance)} ${workspace.currency} từ ví này sang ví bạn chọn.`
                          : `Hệ thống sẽ chuyển ${formatAmount(confirmedBalance.abs())} ${workspace.currency} từ ví bạn chọn vào ví này.`}
                        {" "}Giao dịch được ghi nhận ngay để đưa số dư về 0.
                      </p>
                    </div>
                    {settlementWallets.length ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-[var(--foreground)]">
                          {confirmedBalance.isPositive() ? "Ví nhận tiền" : "Ví chuyển tiền"}
                        </Label>
                        <FinanceSelect
                          value={settlementWalletId}
                          onValueChange={setSettlementWalletId}
                          label={confirmedBalance.isPositive() ? "Chọn ví nhận tiền" : "Chọn ví chuyển tiền"}
                          className="w-full"
                          options={settlementWallets.map((wallet) => ({
                            value: wallet.id,
                            label: `${wallet.name} · ${formatAmount(wallet.currentBalance)} ${workspace.currency}`,
                          }))}
                        />
                      </div>
                    ) : (
                      <p className="rounded-lg border border-rose-500/20 bg-rose-500/8 p-3 text-xs leading-relaxed text-rose-600">
                        Không có ví đang hoạt động để tất toán. Hãy tạo hoặc kích hoạt một ví khác trước khi xóa.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    Số dư đã bằng 0. Không cần tạo giao dịch tất toán.
                  </p>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
              <Button type="button" variant="outline" disabled={pending} onClick={() => {
                setConfirmOperation(null);
                setSettlementWalletId("");
              }}>
                Hủy
              </Button>
              <Button
                type="button"
                variant={confirmOperation.kind === "delete" ? "destructive" : "default"}
                disabled={pending || (requiresSettlement && !settlementWalletId)}
                onClick={confirmDestructiveOperation}
              >
                {pending
                  ? "Đang xử lý…"
                  : confirmOperation.kind === "delete"
                    ? requiresSettlement ? "Tất toán và xóa" : "Xác nhận xóa"
                    : "Xác nhận tạm ngưng"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
