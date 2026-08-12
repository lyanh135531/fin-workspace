"use client";

import Decimal from "decimal.js";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  CircleDollarSign,
  FileText,
  GripVertical,
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
import { type DragEvent, useMemo, useState, useTransition } from "react";
import {
  createManagedWalletAction,
  reorderManagedWalletsAction,
  setManagedWalletStatusAction,
  softDeleteManagedWalletAction,
  updateManagedWalletAction,
} from "@/app/dashboard/wallets/actions";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
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
  TabsCount,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/base";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SpotlightTrigger } from "@/components/ui/spotlight-trigger";
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

function moveWallet(
  wallets: WalletItem[],
  draggedWalletId: string,
  targetWalletId: string,
): WalletItem[] {
  const sourceIndex = wallets.findIndex(({ id }) => id === draggedWalletId);
  const targetIndex = wallets.findIndex(({ id }) => id === targetWalletId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return wallets;
  }

  const wallet = wallets[sourceIndex];
  const remainingWallets = [
    ...wallets.slice(0, sourceIndex),
    ...wallets.slice(sourceIndex + 1),
  ];
  return [
    ...remainingWallets.slice(0, targetIndex),
    wallet,
    ...remainingWallets.slice(targetIndex),
  ];
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
  const [createFundingType, setCreateFundingType] = useState<
    "transfer" | "income"
  >("income");
  const [createFundingAmount, setCreateFundingAmount] = useState("");
  const [createFundingWalletId, setCreateFundingWalletId] = useState("");
  const [editingWallet, setEditingWallet] = useState<WalletItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<
    "all" | "active" | "deactive"
  >("all");
  const [confirmOperation, setConfirmOperation] =
    useState<DestructiveWalletOperation | null>(null);
  const [settlementWalletId, setSettlementWalletId] = useState("");
  const [blockedOperation, setBlockedOperation] =
    useState<DestructiveWalletOperation | null>(null);
  const [orderedWallets, setOrderedWallets] = useState(wallets);
  const [draggedWalletId, setDraggedWalletId] = useState<string | null>(null);
  const [dropTargetWalletId, setDropTargetWalletId] = useState<string | null>(
    null,
  );
  const [mobileMenuWalletId, setMobileMenuWalletId] = useState<string | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const activeCount = wallets.filter(
    (wallet) => wallet.status === "active",
  ).length;
  const activeWallets = wallets.filter((wallet) => wallet.status === "active");
  const transactionCount = wallets.reduce(
    (total, wallet) => total + wallet.transactionCount,
    0,
  );
  const confirmedBalance = new Decimal(
    confirmOperation?.wallet.currentBalance ?? 0,
  );
  const requiresSettlement =
    confirmOperation?.kind === "delete" && !confirmedBalance.isZero();
  const settlementWallets = wallets.filter(
    (wallet) =>
      wallet.status === "active" && wallet.id !== confirmOperation?.wallet.id,
  );
  const createFundingAmountIsValid = (() => {
    if (createFundingAmount.trim() === "") return true;
    try {
      const amount = new Decimal(createFundingAmount);
      return (
        amount.isFinite() &&
        amount.decimalPlaces() <= 4 &&
        (createFundingType === "transfer" ? amount.gt(0) : amount.gte(0))
      );
    } catch {
      return false;
    }
  })();
  const hasInitialFunding = (() => {
    try {
      return (
        createFundingAmount.trim() !== "" &&
        new Decimal(createFundingAmount).gt(0)
      );
    } catch {
      return false;
    }
  })();

  const filteredWallets = useMemo(
    () =>
      orderedWallets.filter(
        (wallet) => filterStatus === "all" || wallet.status === filterStatus,
      ),
    [orderedWallets, filterStatus],
  );

  function saveWalletOrder(
    nextWallets: WalletItem[],
    previousWallets: WalletItem[],
  ) {
    setOrderedWallets(nextWallets);
    startTransition(async () => {
      const result = await reorderManagedWalletsAction({
        walletIds: nextWallets.map(({ id }) => id),
      });
      if (result.ok) {
        toast.success("Đã cập nhật thứ tự ví.");
        router.refresh();
        return;
      }

      setOrderedWallets(previousWallets);
      toast.error(result.message ?? "Không thể sắp xếp ví.");
    });
  }

  function handleWalletDrop(
    event: DragEvent<HTMLElement>,
    targetWalletId: string,
  ) {
    event.preventDefault();
    const sourceWalletId =
      draggedWalletId || event.dataTransfer.getData("text/plain");
    setDraggedWalletId(null);
    setDropTargetWalletId(null);
    if (!sourceWalletId || sourceWalletId === targetWalletId) return;

    const nextWallets = moveWallet(
      orderedWallets,
      sourceWalletId,
      targetWalletId,
    );
    if (nextWallets !== orderedWallets) {
      saveWalletOrder(nextWallets, orderedWallets);
    }
  }

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
        ? (wallets.find(
            (candidate) =>
              candidate.status === "active" && candidate.id !== wallet.id,
          )?.id ?? "")
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
      const result =
        kind === "deactivate"
          ? await setManagedWalletStatusAction({
              walletId: wallet.id,
              status: "deactive",
            })
          : await softDeleteManagedWalletAction({
              walletId: wallet.id,
              settlementWalletId: requiresSettlement
                ? settlementWalletId
                : undefined,
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
    <div className="wallet-management-shell space-y-6">
      <div className="wallet-mobile-dashboard">
        <header className="wallet-mobile-header">
          <div className="min-w-0">
            <p>{workspace.name}</p>
            <h1>Ví tài chính</h1>
          </div>
          {isAdmin && (
            <Button
              type="button"
              variant="default"
              size="icon"
              className="wallet-mobile-add"
              onClick={() => setCreatingModal(true)}
              aria-label="Thêm ví"
            >
              <Plus size={18} />
            </Button>
          )}
        </header>

        <section className="wallet-mobile-balance" aria-label="Tổng tài sản">
          <div className="wallet-mobile-balance-heading">
            <span className="wallet-mobile-balance-icon" aria-hidden>
              <Landmark size={17} />
            </span>
            <p>Tổng số dư khả dụng</p>
          </div>
          <p className="wallet-mobile-balance-amount">
            {formatAmount(totalBalance)}
            <span>{workspace.currency}</span>
          </p>
          <dl className="wallet-mobile-balance-meta">
            <div>
              <dt>Đang hoạt động</dt>
              <dd>
                {activeCount}/{wallets.length} ví
              </dd>
            </div>
            <div>
              <dt>Tổng giao dịch</dt>
              <dd>{transactionCount}</dd>
            </div>
          </dl>
        </section>

        <section
          className="wallet-mobile-collection"
          aria-labelledby="wallet-mobile-list-title"
        >
          <div className="wallet-mobile-list-heading">
            <div>
              <h2 id="wallet-mobile-list-title">Ví của bạn</h2>
            </div>
          </div>

          <Tabs
            className="wallet-mobile-filters workspace-settings-tabs"
            value={filterStatus}
            onValueChange={(value) =>
              setFilterStatus(value as "all" | "active" | "deactive")
            }
          >
            <TabsList
              className={cn(
                "wallet-mobile-tab-list workspace-settings-tab-list rounded-2xl",
                wallets.length - activeCount > 0 && "has-paused",
              )}
            >
              <TabsTrigger value="all" className="rounded-2xl">
                <WalletCards aria-hidden />
                <span>Tất cả</span>
              </TabsTrigger>
              <TabsTrigger value="active" className="rounded-2xl">
                <CheckCircle2 aria-hidden />
                <span>Hoạt động</span>
              </TabsTrigger>
              {wallets.length - activeCount > 0 && (
                <TabsTrigger value="deactive" className="rounded-2xl">
                  <PauseCircle aria-hidden />
                  <span>Tạm ngưng</span>
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>

          <div className="wallet-mobile-list rounded-2xl">
            {filteredWallets.map((wallet) => {
              const isActive = wallet.status === "active";
              const menuOpen = mobileMenuWalletId === wallet.id;
              const rowContent = (
                <>
                  <div className="wallet-mobile-item-main">
                    <span className="wallet-mobile-item-icon" aria-hidden>
                      <WalletCards size={18} />
                    </span>
                    <div className="wallet-mobile-item-identity">
                      <h3>{wallet.name}</h3>
                      <p>
                        <span aria-hidden />
                        {isActive ? "Đang hoạt động" : "Tạm ngưng"}
                      </p>
                    </div>
                    <div className="wallet-mobile-item-balance">
                      <strong>{formatAmount(wallet.currentBalance)}</strong>
                      <span>{workspace.currency}</span>
                    </div>
                  </div>

                  <footer className="wallet-mobile-item-footer">
                    <div>
                      <span>{wallet.transactionCount} giao dịch</span>
                      {wallet.recurringTransactionCount > 0 && (
                        <span className="wallet-mobile-recurring">
                          <Repeat2 size={12} />
                          {wallet.recurringTransactionCount} định kỳ
                        </span>
                      )}
                    </div>
                    {isAdmin && (
                      <span className="wallet-mobile-item-hint">
                        Chạm để quản lý
                      </span>
                    )}
                  </footer>
                </>
              );

              if (!isAdmin) {
                return (
                  <article
                    key={wallet.id}
                    className={cn(
                      "wallet-mobile-item",
                      !isActive && "is-paused",
                    )}
                  >
                    {rowContent}
                  </article>
                );
              }

              return (
                <DropdownMenu
                  key={wallet.id}
                  open={menuOpen}
                  onOpenChange={(open) =>
                    setMobileMenuWalletId(open ? wallet.id : null)
                  }
                >
                  <SpotlightTrigger
                    open={menuOpen}
                    onOpenChange={(open) =>
                      setMobileMenuWalletId(open ? wallet.id : null)
                    }
                    render={
                      <article
                        className={cn(
                          "wallet-mobile-item wallet-mobile-item-interactive",
                          !isActive && "is-paused",
                        )}
                        aria-label={`${wallet.name}, số dư ${formatAmount(wallet.currentBalance)} ${workspace.currency}. Chạm để mở menu quản lý.`}
                      />
                    }
                    dismissLabel={`Đóng menu quản lý ${wallet.name}`}
                  >
                    {(spotlightTrigger) => (
                      <DropdownMenuTrigger
                        nativeButton={false}
                        render={spotlightTrigger}
                      >
                        {rowContent}
                      </DropdownMenuTrigger>
                    )}
                  </SpotlightTrigger>

                  <DropdownMenuContent
                    align="center"
                    side="bottom"
                    sideOffset={6}
                    className="wallet-mobile-context-menu"
                  >
                    <DropdownMenuItem
                      disabled={pending}
                      onClick={() => {
                        setMobileMenuWalletId(null);
                        setEditingWallet(wallet);
                      }}
                    >
                      <Pencil aria-hidden />
                      Chỉnh sửa ví
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant={isActive ? "destructive" : "default"}
                      disabled={pending}
                      onClick={() => {
                        setMobileMenuWalletId(null);
                        if (isActive) {
                          requestDestructiveOperation(wallet, "deactivate");
                        } else {
                          activateWallet(wallet);
                        }
                      }}
                    >
                      {isActive ? (
                        <PauseCircle aria-hidden />
                      ) : (
                        <PlayCircle aria-hidden />
                      )}
                      {isActive ? "Tạm ngưng ví" : "Kích hoạt lại"}
                    </DropdownMenuItem>
                    {!isActive && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={pending}
                          onClick={() => {
                            setMobileMenuWalletId(null);
                            requestDestructiveOperation(wallet, "delete");
                          }}
                        >
                          <Trash2 aria-hidden />
                          Xóa ví
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}

            {!filteredWallets.length && (
              <Empty
                variant="compact"
                icon={WalletCards}
                title={
                  filterStatus === "all"
                    ? "Workspace chưa có ví"
                    : "Không có ví ở trạng thái này"
                }
                description={
                  filterStatus === "all" && isAdmin
                    ? "Tạo ví đầu tiên để bắt đầu ghi nhận giao dịch."
                    : "Chọn trạng thái khác để xem các ví còn lại."
                }
                action={
                  filterStatus === "all" && isAdmin ? (
                    <Button
                      type="button"
                      onClick={() => setCreatingModal(true)}
                    >
                      <Plus size={16} />
                      Thêm ví đầu tiên
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
        </section>
      </div>

      <PageHeader
        className="wallet-desktop-only"
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
            Thêm ví
          </Button>
        )}
      </PageHeader>

      <Card
        as="section"
        className="wallet-desktop-only"
        aria-label="Tổng quan tài sản"
      >
        <CardHeader className="border-b">
          <CardTitle>Tổng quan tài sản</CardTitle>
          <CardDescription>
            Số liệu từ các ví đang hoạt động trong workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(22rem,1fr)] lg:items-end">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              Tổng số dư khả dụng
            </p>
            <p className="mt-2 truncate text-3xl font-semibold tracking-tight text-[var(--foreground)] tabular-nums sm:text-4xl">
              {formatAmount(totalBalance)}{" "}
              <span className="text-base font-medium text-[var(--text-secondary)]">
                {workspace.currency}
              </span>
            </p>
            <p className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span
                className="size-1.5 rounded-full bg-[var(--success)]"
                aria-hidden
              />
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
                {activeCount}
                <span className="text-sm font-normal text-[var(--text-muted)]">
                  /{wallets.length}
                </span>
              </dd>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                {wallets.length - activeCount === 0
                  ? "Tất cả đang hoạt động"
                  : `${wallets.length - activeCount} ví tạm ngưng`}
              </p>
            </div>
            <div className="px-4">
              <dt className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <ArrowLeftRight size={14} className="text-primary" />
                Giao dịch
              </dt>
              <dd className="mt-2 text-lg font-semibold text-[var(--foreground)] tabular-nums">
                {transactionCount}
              </dd>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                Lượt ghi nhận qua ví
              </p>
            </div>
          </dl>
        </CardContent>
      </Card>

      <section
        className="wallet-desktop-only space-y-4"
        aria-labelledby="wallet-list-title"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="wallet-list-title"
              className="text-base font-semibold text-[var(--foreground)]"
            >
              Danh sách ví
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {isAdmin && filterStatus === "all"
                ? "Kéo thả các thẻ để đổi thứ tự ví."
                : "Kiểm tra số dư, hoạt động và lịch sử của từng ví."}
            </p>
          </div>
          <Tabs
            value={filterStatus}
            onValueChange={(value) =>
              setFilterStatus(value as "all" | "active" | "deactive")
            }
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
                key={wallet.id}
                draggable={isAdmin && filterStatus === "all" && !pending}
                onDragStart={(event) => {
                  setDraggedWalletId(wallet.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", wallet.id);
                }}
                onDragEnd={() => {
                  setDraggedWalletId(null);
                  setDropTargetWalletId(null);
                }}
                onDragOver={(event) => {
                  if (!draggedWalletId || draggedWalletId === wallet.id) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDropTargetWalletId(wallet.id);
                }}
                onDragLeave={(event) => {
                  if (
                    !event.currentTarget.contains(event.relatedTarget as Node)
                  ) {
                    setDropTargetWalletId((current) =>
                      current === wallet.id ? null : current,
                    );
                  }
                }}
                onDrop={(event) => handleWalletDrop(event, wallet.id)}
                className={cn(
                  isAdmin &&
                    filterStatus === "all" &&
                    !pending &&
                    "cursor-grab active:cursor-grabbing",
                  dropTargetWalletId === wallet.id && "ring-2 ring-primary/60",
                  draggedWalletId === wallet.id && "opacity-60",
                )}
              >
                <CardHeader className="border-b">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
                      aria-hidden
                    >
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
                    <CardAction className="wallet-card-actions flex items-center gap-1">
                      {filterStatus === "all" && (
                        <span
                          className="wallet-drag-handle grid min-h-10 cursor-grab place-items-center px-1 text-[var(--text-muted)] active:cursor-grabbing"
                          title={`Kéo để sắp xếp ${wallet.name}`}
                          aria-label={`Kéo để sắp xếp ${wallet.name}`}
                        >
                          <GripVertical size={17} />
                        </span>
                      )}
                      <Button
                        variant="icon"
                        size="auto"
                        title={`Chỉnh sửa ${wallet.name}`}
                        aria-label={`Chỉnh sửa ${wallet.name}`}
                        onClick={() => setEditingWallet(wallet)}
                      >
                        <Pencil size={16} />
                      </Button>
                    </CardAction>
                  )}
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-5">
                  <div>
                    <p className="text-xs font-medium text-[var(--text-secondary)]">
                      Số dư hiện tại
                    </p>
                    <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-[var(--foreground)] tabular-nums">
                      {formatAmount(wallet.currentBalance)} {workspace.currency}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)] tabular-nums">
                      Số dư đầu kỳ: {formatAmount(wallet.openingBalance)}{" "}
                      {workspace.currency}
                    </p>
                  </div>

                  <p className="wallet-card-description min-h-10 text-sm leading-relaxed text-[var(--text-secondary)] line-clamp-2">
                    {wallet.description ||
                      "Chưa có mô tả. Thêm ghi chú để thành viên dễ nhận diện ví này."}
                  </p>

                  {wallet.recurringTransactionCount > 0 && (
                    <p className="flex items-center gap-2 rounded-lg bg-[var(--surface-secondary)] px-3 py-2 text-xs font-medium text-[var(--warning)]">
                      <Repeat2 size={14} />
                      {wallet.recurringTransactionCount} giao dịch định kỳ đang
                      sử dụng
                    </p>
                  )}
                </CardContent>

                <CardFooter className="wallet-card-footer justify-between gap-3 text-xs text-[var(--text-muted)]">
                  <span className="font-medium tabular-nums">
                    {wallet.transactionCount} giao dịch
                  </span>
                  <span className="wallet-card-updated flex items-center gap-1 text-[11px]">
                    <Clock size={12} />
                    {new Intl.DateTimeFormat("vi-VN", {
                      dateStyle: "medium",
                    }).format(new Date(wallet.updatedAt))}
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
              title={
                filterStatus === "all"
                  ? "Workspace chưa có ví"
                  : "Không có ví ở trạng thái này"
              }
              description={
                filterStatus !== "all"
                  ? "Chọn trạng thái khác để xem các ví còn lại."
                  : isAdmin
                    ? "Tạo ví đầu tiên để bắt đầu ghi nhận giao dịch tài chính cho workspace này."
                    : "Admin chưa khởi tạo ví cho workspace này."
              }
              action={
                filterStatus === "all" && isAdmin ? (
                  <Button type="button" onClick={() => setCreatingModal(true)}>
                    <Plus size={16} />
                    Thêm ví đầu tiên
                  </Button>
                ) : undefined
              }
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
        <SheetContent side="bottom" className="wallet-create-sheet">
          <form
            onSubmit={handleCreate}
            className="wallet-create-form"
            aria-busy={pending}
          >
            <span className="wallet-create-handle" aria-hidden />
            <SheetHeader className="wallet-create-header">
              <div className="wallet-create-heading">
                <span aria-hidden>
                  <WalletCards size={19} />
                </span>
                <div className="min-w-0">
                  <SheetTitle>Tạo ví mới</SheetTitle>
                  <SheetDescription>
                    Tạo nơi theo dõi tiền mặt, tài khoản hoặc quỹ riêng.
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="wallet-create-body">
              <section
                aria-labelledby="wallet-details-heading"
                className="wallet-create-section"
              >
                <div className="wallet-create-fields">
                  <Input
                    label="Tên ví"
                    id="create-name"
                    name="name"
                    required
                    maxLength={120}
                    placeholder="Tiền mặt, Ngân hàng"
                    className="w-full"
                  />
                  <Textarea
                    label={
                      <>
                        Ghi chú{" "}
                        <span className="font-normal text-[var(--text-muted)]">
                          (tuỳ chọn)
                        </span>
                      </>
                    }
                    id="create-desc"
                    name="description"
                    rows={2}
                    maxLength={2000}
                    placeholder="Mục đích sử dụng ví"
                    className="w-full resize-none"
                  />
                </div>
              </section>

              <section
                aria-labelledby="initial-balance-heading"
                className="wallet-create-funding"
              >
                <div className="wallet-create-funding-heading">
                  <span aria-hidden>
                    <CircleDollarSign size={17} />
                  </span>
                  <div className="min-w-0">
                    <h3 id="initial-balance-heading">Số dư ban đầu</h3>
                    <p>Có thể để trống và cập nhật bằng giao dịch sau.</p>
                  </div>
                </div>
                <div className="wallet-create-funding-body">
                  <MoneyInput
                    label={`Số tiền (${workspace.currency})`}
                    id="create-funding-amount"
                    name="fundingAmount"
                    value={createFundingAmount}
                    onValueChange={setCreateFundingAmount}
                    className="wallet-create-amount-input"
                  />
                  {hasInitialFunding && (
                    <div className="wallet-create-source">
                      <p className="wallet-create-source-label">Nguồn số dư</p>
                      <div
                        className="wallet-create-source-options"
                        role="radiogroup"
                        aria-label="Nguồn số dư ban đầu"
                      >
                        <button
                          type="button"
                          role="radio"
                          aria-checked={createFundingType === "income"}
                          onClick={() => setCreateFundingType("income")}
                          className="wallet-create-source-option"
                        >
                          <span aria-hidden>
                            <TrendingUp size={15} />
                          </span>
                          <span>
                            <strong>Tiền có sẵn</strong>
                            <small>Ghi nhận là khoản thu</small>
                          </span>
                          <i aria-hidden />
                        </button>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={createFundingType === "transfer"}
                          disabled={activeWallets.length === 0}
                          onClick={() => {
                            setCreateFundingType("transfer");
                            if (!createFundingWalletId)
                              setCreateFundingWalletId(
                                activeWallets[0]?.id ?? "",
                              );
                          }}
                          className="wallet-create-source-option"
                        >
                          <span aria-hidden>
                            <Landmark size={15} />
                          </span>
                          <span>
                            <strong>Chuyển từ ví khác</strong>
                            <small>Dịch chuyển số dư nội bộ</small>
                          </span>
                          <i aria-hidden />
                        </button>
                      </div>
                      {createFundingType === "transfer" && (
                        <Select
                          value={createFundingWalletId}
                          onValueChange={setCreateFundingWalletId}
                          label="Ví nguồn"
                          placeholder="Chọn ví chuyển tiền"
                          className="w-full"
                          options={activeWallets.map((wallet) => ({
                            value: wallet.id,
                            label: `${wallet.name} · ${formatAmount(wallet.currentBalance)} ${workspace.currency}`,
                          }))}
                        />
                      )}
                      <p className="wallet-create-source-note">
                        <ArrowLeftRight size={14} />
                        {createFundingType === "income"
                          ? "Hệ thống sẽ tạo một giao dịch thu khi tạo ví."
                          : "Hệ thống sẽ tạo một giao dịch chuyển tiền nội bộ."}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="wallet-create-actions">
              <Button
                type="button"
                variant="outline"
                onClick={closeCreateSheet}
              >
                Để sau
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={
                  pending ||
                  !createFundingAmountIsValid ||
                  (createFundingType === "transfer" && !createFundingWalletId)
                }
              >
                {pending ? (
                  <Loading label="Đang tạo..." />
                ) : (
                  <>
                    <Plus size={16} />
                    Tạo ví
                  </>
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
        <SheetContent side="bottom" className="wallet-edit-sheet">
          <span className="wallet-edit-handle" aria-hidden />
          <SheetHeader className="wallet-edit-header">
            <div className="wallet-edit-heading">
              <span aria-hidden>
                <Pencil size={17} />
              </span>
              <div className="min-w-0">
                <SheetTitle>Chỉnh sửa ví</SheetTitle>
                <SheetDescription>
                  {editingWallet?.name ?? "Cập nhật thông tin ví"}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {editingWallet && (
            <form
              onSubmit={handleUpdate}
              className="wallet-edit-form"
              aria-busy={pending}
            >
              <div className="wallet-edit-body">
                <section
                  aria-label="Tóm tắt ví"
                  className="wallet-edit-summary"
                >
                  <div className="wallet-edit-summary-identity">
                    <span aria-hidden>
                      <WalletCards size={18} />
                    </span>
                    <div className="min-w-0">
                      <p>{editingWallet.name}</p>
                      <small>
                        {editingWallet.transactionCount} giao dịch đã ghi nhận
                      </small>
                    </div>
                  </div>
                  <div className="wallet-edit-summary-balance">
                    <span>Số dư hiện tại</span>
                    <strong>
                      {formatAmount(editingWallet.currentBalance)}
                      <small>{workspace.currency}</small>
                    </strong>
                  </div>
                </section>

                <section
                  className="wallet-edit-section"
                  aria-labelledby="edit-wallet-details-heading"
                >
                  <div className="wallet-edit-section-heading">
                    <h3 id="edit-wallet-details-heading">Thông tin cơ bản</h3>
                    <p>Tên và ghi chú giúp thành viên nhận diện đúng ví.</p>
                  </div>
                  <div className="wallet-edit-fields">
                    <Input
                      label="Tên ví"
                      id="edit-name"
                      name="name"
                      required
                      maxLength={120}
                      defaultValue={editingWallet.name}
                      className="w-full"
                    />
                    <Textarea
                      label={
                        <>
                          Ghi chú{" "}
                          <span className="font-normal text-[var(--text-muted)]">
                            (tuỳ chọn)
                          </span>
                        </>
                      }
                      id="edit-desc"
                      name="description"
                      rows={2}
                      maxLength={2000}
                      defaultValue={editingWallet.description ?? ""}
                      placeholder="Ví này được dùng cho việc gì?"
                      className="w-full resize-none"
                    />
                  </div>
                </section>
              </div>

              <div className="wallet-edit-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingWallet(null)}
                >
                  Hủy
                </Button>
                <Button type="submit" variant="default" disabled={pending}>
                  {pending ? <Loading label="Đang lưu..." /> : "Lưu thay đổi"}
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
          <Card
            as="section"
            className="wallet-modal-panel sunrise-card gap-0 w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="ws-danger-icon shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2
                  id="wallet-operation-blocked-title"
                  className="text-lg font-bold text-[var(--foreground)]"
                >
                  Không thể{" "}
                  {blockedOperation.kind === "delete" ? "xóa" : "tạm ngưng"} ví
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Ví <strong>“{blockedOperation.wallet.name}”</strong> đang được
                  sử dụng bởi{" "}
                  <strong>
                    {blockedOperation.wallet.recurringTransactionCount} giao
                    dịch định kỳ
                  </strong>
                  .
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 text-xs leading-relaxed text-slate-600">
              Để tiếp tục, hãy mở Giao dịch định kỳ và đổi sang ví khác, hoặc
              xóa các đăng ký đang sử dụng ví này. Lịch sử giao dịch đã phát
              sinh vẫn được giữ nguyên.
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBlockedOperation(null)}
              >
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

      <Sheet
        open={confirmOperation !== null}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setConfirmOperation(null);
            setSettlementWalletId("");
          }
        }}
      >
        <SheetContent
          side="bottom"
          className="wallet-operation-sheet ledger-mobile-review-sheet pending-delete"
        >
          {confirmOperation && (
            <>
              <SheetHeader className="ledger-mobile-review-header">
                <div className="ledger-mobile-review-heading">
                  <span aria-hidden>
                    {confirmOperation.kind === "delete" ? (
                      <Trash2 size={18} />
                    ) : (
                      <PauseCircle size={18} />
                    )}
                  </span>
                  <div>
                    <SheetTitle>
                      {confirmOperation.kind === "delete"
                        ? "Xóa ví?"
                        : "Tạm ngưng ví?"}
                    </SheetTitle>
                    <SheetDescription>
                      {confirmOperation.kind === "delete"
                        ? "Lịch sử giao dịch của ví vẫn được giữ lại."
                        : "Bạn có thể kích hoạt lại ví bất cứ lúc nào."}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="ledger-mobile-review-body wallet-operation-body">
                <div className="ledger-mobile-review-transaction rounded-xl">
                  <div>
                    <span>{confirmOperation.wallet.name}</span>
                    <small>
                      {confirmOperation.kind === "delete"
                        ? "Ví sẽ được ẩn khỏi workspace"
                        : "Ví sẽ ngừng nhận giao dịch mới"}
                    </small>
                  </div>
                  <strong>
                    {formatAmount(confirmOperation.wallet.currentBalance)}{" "}
                    {workspace.currency}
                  </strong>
                </div>

                {confirmOperation.kind === "delete" && (
                  <section className="wallet-operation-settlement">
                    <div className="wallet-operation-settlement-heading">
                      <span>Số dư cần tất toán</span>
                      <strong data-required={requiresSettlement || undefined}>
                        {requiresSettlement ? "Cần xử lý" : "Đã bằng 0"}
                      </strong>
                    </div>
                    {requiresSettlement ? (
                      <div className="wallet-operation-settlement-content">
                        <p>
                          <ArrowLeftRight size={14} aria-hidden />
                          {confirmedBalance.isPositive()
                            ? `Chuyển ${formatAmount(confirmedBalance)} ${workspace.currency} sang ví khác trước khi xóa.`
                            : `Chuyển ${formatAmount(confirmedBalance.abs())} ${workspace.currency} từ ví khác để đưa số dư về 0.`}
                        </p>
                        {settlementWallets.length ? (
                          <Select
                            value={settlementWalletId}
                            onValueChange={setSettlementWalletId}
                            label={
                              confirmedBalance.isPositive()
                                ? "Ví nhận tiền"
                                : "Ví chuyển tiền"
                            }
                            placeholder="Chọn ví tất toán"
                            spotlight
                            className="w-full"
                            options={settlementWallets.map((wallet) => ({
                              value: wallet.id,
                              label: `${wallet.name} · ${formatAmount(wallet.currentBalance)} ${workspace.currency}`,
                            }))}
                          />
                        ) : (
                          <p className="wallet-operation-no-settlement">
                            Không có ví đang hoạt động để tất toán. Hãy tạo hoặc
                            kích hoạt một ví khác trước khi xóa.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="wallet-operation-zero-balance">
                        Không cần tạo giao dịch tất toán.
                      </p>
                    )}
                  </section>
                )}
              </div>

              <SheetFooter className="ledger-mobile-review-actions">
                <Button
                  type="button"
                  variant="outline"
                  className="ledger-mobile-review-reject"
                  data-delete
                  disabled={pending}
                  onClick={() => {
                    setConfirmOperation(null);
                    setSettlementWalletId("");
                  }}
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="ledger-mobile-review-approve"
                  data-delete
                  disabled={
                    pending || (requiresSettlement && !settlementWalletId)
                  }
                  onClick={confirmDestructiveOperation}
                >
                  {pending ? (
                    <Loading label="Đang xử lý..." />
                  ) : confirmOperation.kind === "delete" ? (
                    <>
                      <Trash2 size={15} />
                      {requiresSettlement ? "Tất toán và xóa" : "Xóa ví"}
                    </>
                  ) : (
                    <>
                      <PauseCircle size={15} />
                      Tạm ngưng ví
                    </>
                  )}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
