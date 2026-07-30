"use client";

import Decimal from "decimal.js";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  CircleDollarSign,
  FileText,
  Landmark,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Repeat2,
  Trash2,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createManagedWalletAction,
  setManagedWalletStatusAction,
  softDeleteManagedWalletAction,
  updateManagedWalletAction,
} from "@/app/dashboard/wallets/actions";
import { formatAmount } from "@/lib/format";
import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Empty,
  Input,
  Label,
  MoneyInput,
  PageHeader,
  Select,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsCount,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/base";
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
  const [createFundingAmount, setCreateFundingAmount] = useState("");
  const [createFundingWalletId, setCreateFundingWalletId] = useState("");
  const [editingWallet, setEditingWallet] = useState<WalletItem | null>(null);
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
      return createFundingAmount.trim() === "" || (amount.isFinite()
        && amount.decimalPlaces() <= 4
        && (createFundingType === "transfer" ? amount.gt(0) : amount.gte(0)));
    } catch {
      return false;
    }
  })();
  const hasInitialFunding = (() => {
    try {
      return createFundingAmount.trim() !== "" && new Decimal(createFundingAmount).gt(0);
    } catch {
      return false;
    }
  })();

  const filteredWallets = useMemo(
    () => wallets.filter((wallet) => filterStatus === "all" || wallet.status === filterStatus),
    [wallets, filterStatus],
  );

  function closeCreateSheet() {
    setCreatingModal(false);
    setCreateFundingType("income");
    setCreateFundingAmount("");
    setCreateFundingWalletId("");
  }

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await createManagedWalletAction({
        name: data.get("name"),
        description: data.get("description") || undefined,
        funding: !hasInitialFunding
          ? undefined
          : createFundingType === "income"
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
        setCreateFundingAmount("");
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
        toast.success("Đã cập nhật thông tin ví.");
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
    <div className="space-y-6">
      <PageHeader
        title="Quản lý ví tài chính"
        description={`Theo dõi số dư và trạng thái các ví trong ${workspace.name}.`}
      >
        {isAdmin && (
          <Button
            type="button"
            variant="default"
            className="shrink-0"
            onClick={() => setCreatingModal(true)}
          >
            <Plus size={16} />
            <span>Thêm ví</span>
          </Button>
        )}
      </PageHeader>

      <Card as="section" className="gap-0 py-0" aria-label="Tổng quan tài sản">
        <CardHeader className="border-b py-4">
          <CardTitle>Tổng quan tài sản</CardTitle>
          <CardDescription>Số liệu từ các ví đang hoạt động trong workspace</CardDescription>
          <CardAction>
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary" aria-hidden>
              <WalletCards size={18} />
            </span>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(22rem,1fr)] lg:items-end">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-secondary)]">Tổng số dư khả dụng</p>
            <p className="mt-2 truncate text-3xl font-semibold tracking-tight text-[var(--foreground)] tabular-nums sm:text-4xl">
              {formatAmount(totalBalance)} <span className="text-base font-medium text-[var(--text-secondary)]">{workspace.currency}</span>
            </p>
            <p className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span className="size-1.5 rounded-full bg-[var(--success)]" aria-hidden />
              Cập nhật từ {activeCount} ví đang hoạt động
            </p>
          </div>

          <dl className="grid grid-cols-2 divide-x divide-[var(--border)] rounded-lg bg-[var(--surface-secondary)] py-4">
            <div className="px-4">
              <dt className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <CheckCircle2 size={14} className="text-[var(--success)]" />
                Trạng thái ví
              </dt>
              <dd className="mt-2 text-lg font-semibold text-[var(--foreground)] tabular-nums">
                {activeCount}<span className="text-sm font-normal text-[var(--text-muted)]">/{wallets.length}</span>
              </dd>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                {wallets.length - activeCount === 0 ? "Tất cả đang hoạt động" : `${wallets.length - activeCount} ví tạm ngưng`}
              </p>
            </div>
            <div className="px-4">
              <dt className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <ArrowLeftRight size={14} className="text-primary" />
                Giao dịch
              </dt>
              <dd className="mt-2 text-lg font-semibold text-[var(--foreground)] tabular-nums">{transactionCount}</dd>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Lượt ghi nhận qua ví</p>
            </div>
          </dl>
        </CardContent>
      </Card>

      <section className="space-y-4" aria-labelledby="wallet-list-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="wallet-list-title" className="text-base font-semibold text-[var(--foreground)]">Danh sách ví</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Kiểm tra số dư, hoạt động và lịch sử của từng ví.</p>
          </div>
          <Tabs
            value={filterStatus}
            onValueChange={(value) => setFilterStatus(value as "all" | "active" | "deactive")}
          >
            <TabsList>
              <TabsTrigger value="all">
                <span>Tất cả</span>
                <TabsCount>{wallets.length}</TabsCount>
              </TabsTrigger>
              <TabsTrigger value="active">
                <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                <span>Đang hoạt động</span>
                <TabsCount>{activeCount}</TabsCount>
              </TabsTrigger>
              {wallets.length - activeCount > 0 && (
                <TabsTrigger value="deactive">
                  <span className="inline-block size-1.5 rounded-full bg-amber-500" />
                  <span>Tạm ngưng</span>
                  <TabsCount>{wallets.length - activeCount}</TabsCount>
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredWallets.map((wallet) => {
            const isActive = wallet.status === "active";
            return (
              <Card
                as="article"
                className="gap-0 py-0 transition-transform duration-200 hover:-translate-y-0.5"
                key={wallet.id}
              >
                <CardHeader className="border-b py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary" aria-hidden>
                      <WalletCards size={20} />
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="truncate">
                        <h3>{wallet.name}</h3>
                      </CardTitle>
                      <CardDescription
                        className={
                          isActive
                            ? "flex items-center gap-1.5 text-[var(--success)]"
                            : "flex items-center gap-1.5 text-[var(--warning)]"
                        }
                      >
                        <span
                          className={
                            isActive
                              ? "size-1.5 rounded-full bg-[var(--success)]"
                              : "size-1.5 rounded-full bg-[var(--warning)]"
                          }
                          aria-hidden
                        />
                        {isActive ? "Đang hoạt động" : "Tạm ngưng"}
                      </CardDescription>
                    </div>
                  </div>
                  {isAdmin && (
                    <CardAction>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title={`Chỉnh sửa ${wallet.name}`}
                        aria-label={`Chỉnh sửa ${wallet.name}`}
                        onClick={() => setEditingWallet(wallet)}
                      >
                        <Pencil size={15} />
                      </Button>
                    </CardAction>
                  )}
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-5 py-5">
                  <div>
                    <p className="text-xs font-medium text-[var(--text-secondary)]">Số dư hiện tại</p>
                    <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-[var(--foreground)] tabular-nums">
                      {formatAmount(wallet.currentBalance)} {workspace.currency}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)] tabular-nums">
                      Số dư đầu kỳ: {formatAmount(wallet.openingBalance)} {workspace.currency}
                    </p>
                  </div>

                  <p className="min-h-10 text-sm leading-relaxed text-[var(--text-secondary)] line-clamp-2">
                    {wallet.description || "Chưa có mô tả. Thêm ghi chú để thành viên dễ nhận diện ví này."}
                  </p>

                  {wallet.recurringTransactionCount > 0 && (
                    <p className="flex items-center gap-2 rounded-lg bg-[var(--surface-secondary)] px-3 py-2 text-xs font-medium text-[var(--warning)]">
                      <Repeat2 size={14} />
                      {wallet.recurringTransactionCount} giao dịch định kỳ đang sử dụng
                    </p>
                  )}
                </CardContent>

                <CardFooter className="justify-between gap-3 text-xs text-[var(--text-muted)]">
                  <span className="font-medium tabular-nums">{wallet.transactionCount} giao dịch</span>
                  <span className="flex items-center gap-1 text-[11px]">
                    <Clock size={12} />
                    {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(wallet.updatedAt))}
                  </span>
                </CardFooter>
              </Card>
            );
          })}

        {/* Empty state */}
        {!filteredWallets.length && (
          <Empty
            className="col-span-full"
            icon={WalletCards}
            title={filterStatus === "all" ? "Workspace chưa có ví" : "Không có ví ở trạng thái này"}
            description={
              filterStatus !== "all"
                ? "Chọn trạng thái khác để xem các ví còn lại."
                : isAdmin
                  ? "Tạo ví đầu tiên để bắt đầu ghi nhận giao dịch tài chính cho workspace này."
                  : "Admin chưa khởi tạo ví cho workspace này."
            }
            action={filterStatus === "all" && isAdmin ? (
              <Button type="button" onClick={() => setCreatingModal(true)}>
                <Plus size={16} />
                Thêm ví đầu tiên
              </Button>
            ) : undefined}
          />
        )}
        </div>
      </section>

      <Sheet
        open={creatingModal}
        onOpenChange={(open) => {
          if (!open) closeCreateSheet();
        }}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 border-l border-[var(--border)] bg-[var(--surface)] p-0 sm:max-w-lg"
        >
          <form onSubmit={handleCreate} className="flex h-full min-h-0 flex-col">
            <SheetHeader className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3.5 pr-14">
              <div className="relative flex items-start gap-3.5">
                <div className="min-w-0">
                  <SheetTitle className="text-lg font-semibold tracking-tight">Tạo ví mới</SheetTitle>
                  <SheetDescription className="mt-1 max-w-[34ch] text-xs leading-5">Đặt tên ví và thêm số dư ban đầu nếu cần.</SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
              <section aria-labelledby="wallet-details-heading" className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary"><FileText size={14} /></span>
                  <h3 id="wallet-details-heading" className="text-sm font-semibold text-[var(--foreground)]">Thông tin ví</h3>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[var(--foreground)]">
                    Tên ví <span className="text-destructive">*</span>
                  </Label>
                <Input
                  id="create-name"
                  name="name"
                  required
                  maxLength={120}
                  autoFocus
                  placeholder="Tiền mặt, Ngân hàng VCB..."
                  className="w-full bg-[var(--surface)] text-sm font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[var(--foreground)]">Ghi chú <span className="font-normal text-[var(--text-muted)]">(tuỳ chọn)</span></Label>
                <Textarea
                  id="create-desc"
                  name="description"
                  rows={3}
                  maxLength={2000}
                  placeholder="Ví này được dùng cho việc gì?"
                  className="w-full resize-none bg-[var(--surface)] text-sm"
                />
              </div>
              </section>

              <section aria-labelledby="initial-balance-heading" className="overflow-hidden rounded-2xl border border-primary/15 bg-primary/[0.035]">
                <div className="flex gap-3 border-b border-primary/10 px-4 py-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><CircleDollarSign size={18} /></span>
                  <div>
                    <h3 id="initial-balance-heading" className="text-sm font-semibold text-[var(--foreground)]">Số dư ban đầu</h3>
                    <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">Không bắt buộc. Để trống nếu bạn chỉ muốn tạo ví trống.</p>
                  </div>
                </div>
                <div className="space-y-4 p-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[var(--foreground)]">Số tiền</Label>
                    <div className="relative">
                      <MoneyInput
                        id="create-funding-amount"
                        name="fundingAmount"
                        value={createFundingAmount}
                        onValueChange={setCreateFundingAmount}
                        placeholder="Để trống nếu chưa có số dư"
                        className="bg-[var(--surface)] text-base font-semibold"
                      />
                    </div>
                  </div>
                  {hasInitialFunding && (
                    <>
                      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Nguồn số dư ban đầu">
                        <button type="button" role="radio" aria-checked={createFundingType === "income"} onClick={() => setCreateFundingType("income")} className={createFundingType === "income" ? "rounded-xl border border-primary bg-primary/10 px-3 py-3 text-left text-primary transition-colors" : "rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-left text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-secondary)]"}>
                          <TrendingUp size={16} />
                          <span className="mt-2 block text-xs font-semibold">Tiền có sẵn</span>
                          <span className="mt-0.5 block text-[11px] leading-4 opacity-75">Tạo giao dịch thu</span>
                        </button>
                        <button type="button" role="radio" aria-checked={createFundingType === "transfer"} disabled={activeWallets.length === 0} onClick={() => { setCreateFundingType("transfer"); if (!createFundingWalletId) setCreateFundingWalletId(activeWallets[0]?.id ?? ""); }} className={createFundingType === "transfer" ? "rounded-xl border border-primary bg-primary/10 px-3 py-3 text-left text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50" : "rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-left text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:cursor-not-allowed disabled:opacity-50"}>
                          <Landmark size={16} />
                          <span className="mt-2 block text-xs font-semibold">Chuyển từ ví</span>
                          <span className="mt-0.5 block text-[11px] leading-4 opacity-75">Dịch chuyển số dư</span>
                        </button>
                      </div>
                      {createFundingType === "transfer" && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-[var(--foreground)]">Ví nguồn</Label>
                      <Select
                        value={createFundingWalletId}
                        onValueChange={setCreateFundingWalletId}
                        label="Chọn ví chuyển tiền"
                        className="w-full bg-[var(--surface)]"
                        options={activeWallets.map((wallet) => ({
                          value: wallet.id,
                          label: `${wallet.name} · ${formatAmount(wallet.currentBalance)} ${workspace.currency}`,
                        }))}
                      />
                    </div>
                  )}
                      <p className="flex gap-2 rounded-lg bg-[var(--surface)] px-3 py-2.5 text-[11px] leading-4 text-[var(--text-secondary)]"><ArrowLeftRight size={14} className="mt-0.5 shrink-0 text-primary" />{createFundingType === "income" ? "Một giao dịch thu nhập sẽ được tạo và ghi nhận ngay sau khi tạo ví." : "Một giao dịch chuyển tiền giữa hai ví sẽ được tạo và ghi nhận ngay."}</p>
                    </>
                  )}
                </div>
              </section>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4">
              <Button
                type="button"
                variant="outline" size="default"
                onClick={closeCreateSheet}
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
          </form>
        </SheetContent>
      </Sheet>

      <Sheet
        open={editingWallet !== null}
        onOpenChange={(open) => {
          if (!open) setEditingWallet(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 border-l border-[var(--border)] bg-[var(--surface)] p-0 sm:max-w-lg"
        >
          <SheetHeader className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3.5 pr-14">
            <div className="relative flex items-start gap-3.5">
              <div className="min-w-0">
                <SheetTitle className="text-lg font-semibold tracking-tight">Chỉnh sửa ví</SheetTitle>
                <SheetDescription className="mt-1 truncate text-xs leading-5">{editingWallet?.name ?? "Cập nhật thông tin ví"}</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {editingWallet && (
          <form onSubmit={handleUpdate} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <section aria-label="Tóm tắt ví" className="flex items-center justify-between gap-4 rounded-2xl bg-[var(--surface-secondary)] px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface)] text-primary shadow-sm"><WalletCards size={18} /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">{editingWallet.name}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Ví đang được chỉnh sửa</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)]">Số dư</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--foreground)]">{formatAmount(editingWallet.currentBalance)} <span className="text-[11px] font-medium text-[var(--text-muted)]">{workspace.currency}</span></p>
                </div>
              </section>

              <section className="space-y-4" aria-labelledby="edit-wallet-details-heading">
                <div>
                  <h3 id="edit-wallet-details-heading" className="text-sm font-semibold text-[var(--foreground)]">Thông tin cơ bản</h3>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">Thay đổi tên hoặc ghi chú để thành viên dễ nhận diện ví.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[var(--foreground)]">
                    Tên ví <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-name"
                    name="name"
                    required
                    maxLength={120}
                    defaultValue={editingWallet.name}
                    className="w-full bg-[var(--surface)] text-sm font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[var(--foreground)]">
                    Ghi chú <span className="font-normal text-[var(--text-muted)]">(tuỳ chọn)</span>
                  </Label>
                  <Textarea
                    id="edit-desc"
                    name="description"
                    rows={3}
                    maxLength={2000}
                    defaultValue={editingWallet.description ?? ""}
                    placeholder="Ví này được dùng cho việc gì?"
                    className="w-full resize-none bg-[var(--surface)] text-sm"
                  />
                </div>
              </section>

              <section aria-labelledby="wallet-status-heading" className="overflow-hidden rounded-2xl border border-[var(--border)]">
                <div className="flex items-start justify-between gap-4 px-4 py-4">
                  <div>
                    <h3 id="wallet-status-heading" className="text-sm font-semibold text-[var(--foreground)]">Trạng thái hoạt động</h3>
                    <p className="mt-1 max-w-[30ch] text-xs leading-5 text-[var(--text-secondary)]">
                      {editingWallet.status === "active"
                        ? "Ví đang dùng được cho giao dịch mới. Bạn có thể tạm ngưng khi không còn sử dụng."
                        : "Ví này không thể dùng cho giao dịch mới. Bạn có thể kích hoạt lại bất cứ lúc nào."}
                    </p>
                  </div>
                  <span
                    className={
                      editingWallet.status === "active"
                        ? "flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--success)]/10 px-2.5 py-1 text-xs font-medium text-[var(--success)]"
                        : "flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--warning)]/10 px-2.5 py-1 text-xs font-medium text-[var(--warning)]"
                    }
                  >
                    <span
                      className={
                        editingWallet.status === "active"
                          ? "size-1.5 rounded-full bg-[var(--success)]"
                          : "size-1.5 rounded-full bg-[var(--warning)]"
                      }
                      aria-hidden
                    />
                    {editingWallet.status === "active" ? "Hoạt động" : "Tạm ngưng"}
                  </span>
                </div>
                <div className="border-t border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-3">
                  {editingWallet.status === "active" ? (
                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full justify-center"
                      disabled={pending}
                      onClick={() => requestDestructiveOperation(editingWallet, "deactivate")}
                    >
                      <PauseCircle size={15} />
                      Tạm ngưng ví này
                    </Button>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="default"
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
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4">
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
          </form>
          )}
        </SheetContent>
      </Sheet>

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
                        <Select
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
                variant="destructive"
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
