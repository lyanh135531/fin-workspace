"use client";

import Decimal from "decimal.js";
import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Clock,
  CircleDollarSign,
  CreditCard,
  Eye,
  EyeOff,
  GripVertical,
  Landmark,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Repeat2,
  Trash2,
  TrendingUp,
  Wallet,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type DragEvent,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
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
  Empty,
  Input,
  Loading,
  MoneyInput,
  PageHeader,
  Select,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
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
  kind: "asset" | "credit_card";
};

type DestructiveWalletOperation = {
  wallet: WalletItem;
  kind: "deactivate" | "delete";
};

function WalletDeactivateSheet({
  wallet,
  currency,
  isDesktop,
  pending,
  onCancel,
  onConfirm,
  onOpenRecurringTransactions,
}: {
  wallet: WalletItem;
  currency: string;
  isDesktop: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onOpenRecurringTransactions: () => void;
}) {
  const hasRecurringDependencies = wallet.recurringTransactionCount > 0;

  return (
    <>
      <SheetHeader
        icon={PauseCircle}
        title={
          hasRecurringDependencies
            ? "Chưa thể tạm ngưng ví"
            : "Tạm ngưng ví"
        }
        description={
          hasRecurringDependencies
            ? "Hãy xử lý các lịch đang sử dụng ví này trước."
            : "Ví sẽ được chuyển khỏi danh sách đang hoạt động."
        }
      />

      <div
        className={cn(
          "min-h-0",
          isDesktop
            ? "flex-1 overflow-y-auto overscroll-contain px-8 pb-8 pt-6"
            : "px-4 pb-2",
        )}
      >
        <section
          className={cn(
            "rounded-2xl bg-[var(--surface-secondary)]",
            isDesktop ? "p-5" : "p-4",
          )}
          aria-label={`Thông tin ví ${wallet.name}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))] text-[var(--primary)]"
                aria-hidden="true"
              >
                <WalletCards size={17} />
              </span>
              <div className="min-w-0">
                <strong className="block truncate text-sm font-semibold text-[var(--foreground)]">
                  {wallet.name}
                </strong>
                <span className="mt-1 inline-flex items-center gap-1.5 text-[0.68rem] font-medium text-[var(--success)]">
                  <span className="size-1.5 rounded-full bg-current" />
                  Đang hoạt động
                </span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <span className="block text-[0.65rem] text-[var(--text-muted)]">
                Số dư hiện tại
              </span>
              <strong className="mt-1 block text-sm font-semibold tabular-nums text-[var(--foreground)]">
                {formatAmount(wallet.currentBalance)} {currency}
              </strong>
            </div>
          </div>
        </section>

        {hasRecurringDependencies ? (
          <section
            className={cn(
              "rounded-2xl bg-[color-mix(in_srgb,var(--warning)_9%,var(--surface))]",
              isDesktop ? "mt-6 p-5" : "mt-4 p-4",
            )}
            aria-labelledby="wallet-pause-dependency-title"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-[var(--warning)]"
                aria-hidden="true"
              />
              <div>
                <h3
                  id="wallet-pause-dependency-title"
                  className="text-xs font-semibold text-[var(--foreground)]"
                >
                  {wallet.recurringTransactionCount} giao dịch định kỳ đang sử
                  dụng ví
                </h3>
                <p className="mt-1.5 text-xs leading-5 text-[var(--text-secondary)]">
                  Đổi các lịch này sang ví khác hoặc xóa lịch trước khi tạm
                  ngưng. Giao dịch đã phát sinh vẫn được giữ nguyên.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section
            className={isDesktop ? "mt-6" : "mt-4"}
            aria-labelledby="wallet-pause-impact-title"
          >
            <h3
              id="wallet-pause-impact-title"
              className="text-xs font-semibold text-[var(--foreground)]"
            >
              Sau khi tạm ngưng
            </h3>
            <div className="mt-3 space-y-3">
              <div className="flex items-start gap-2.5">
                <PauseCircle
                  className="mt-0.5 size-4 shrink-0 text-[var(--warning)]"
                  aria-hidden="true"
                />
                <p className="text-xs leading-5 text-[var(--text-secondary)]">
                  Không thể chọn ví này khi tạo giao dịch mới.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-[var(--success)]"
                  aria-hidden="true"
                />
                <p className="text-xs leading-5 text-[var(--text-secondary)]">
                  Số dư và toàn bộ lịch sử giao dịch vẫn được giữ nguyên.
                </p>
              </div>
            </div>
            <p className="mt-4 text-[0.68rem] leading-5 text-[var(--text-muted)]">
              Bạn có thể kích hoạt lại ví bất cứ lúc nào.
            </p>
          </section>
        )}
      </div>

      <SheetFooter
        className={cn(
          "flex-row",
          isDesktop
            ? "justify-end px-8 pb-7 pt-4"
            : "px-4 pb-4 pt-2",
        )}
      >
        <Button
          type="button"
          variant="outline"
          className={isDesktop ? undefined : "flex-1"}
          disabled={pending}
          onClick={onCancel}
        >
          {hasRecurringDependencies ? "Đóng" : "Hủy"}
        </Button>
        <Button
          type="button"
          variant={hasRecurringDependencies ? "default" : "warning"}
          className={isDesktop ? undefined : "flex-1"}
          disabled={pending}
          onClick={
            hasRecurringDependencies ? onOpenRecurringTransactions : onConfirm
          }
        >
          {hasRecurringDependencies ? (
            <>
              <Repeat2 size={15} />
              Mở lịch định kỳ
            </>
          ) : pending ? (
            <Loading label="Đang xử lý..." />
          ) : (
            <>
              <PauseCircle size={15} />
              Tạm ngưng ví
            </>
          )}
        </Button>
      </SheetFooter>
    </>
  );
}

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

const WALLET_PALETTES = [
  {
    bg: "bg-emerald-500",
    text: "text-emerald-500",
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    bg: "bg-sky-500",
    text: "text-sky-500",
    iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    bg: "bg-violet-500",
    text: "text-violet-500",
    iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    bg: "bg-amber-500",
    text: "text-amber-500",
    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    bg: "bg-rose-500",
    text: "text-rose-500",
    iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
];

function getWalletVisual(wallet: WalletItem, index: number) {
  if (wallet.kind === "credit_card") {
    return {
      icon: CreditCard,
      iconBg:
        "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
      palette: {
        bg: "bg-rose-500",
        text: "text-rose-500",
        iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      },
      kindBadge: "Thẻ tín dụng",
      kindBadgeClass:
        "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
      balanceLabel: "Dư nợ",
      balanceColor: "text-rose-600 dark:text-rose-400",
      isCreditCard: true,
    };
  }

  const lower = wallet.name.toLowerCase();
  if (
    lower.includes("tiền") ||
    lower.includes("mặt") ||
    lower.includes("cash")
  ) {
    return {
      icon: Banknote,
      iconBg:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      palette: WALLET_PALETTES[0],
      kindBadge: "Tiền mặt",
      kindBadgeClass:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      balanceLabel: "Khả dụng",
      balanceColor: "text-[var(--foreground)]",
      isCreditCard: false,
    };
  }
  if (
    lower.includes("tech") ||
    lower.includes("bank") ||
    lower.includes("vcb") ||
    lower.includes("tcb") ||
    lower.includes("mb") ||
    lower.includes("acb") ||
    lower.includes("ngân hàng")
  ) {
    return {
      icon: Landmark,
      iconBg:
        "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
      palette: WALLET_PALETTES[1],
      kindBadge: "Ngân hàng",
      kindBadgeClass:
        "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
      balanceLabel: "Khả dụng",
      balanceColor: "text-[var(--foreground)]",
      isCreditCard: false,
    };
  }
  const palette = WALLET_PALETTES[(index + 2) % WALLET_PALETTES.length];
  return {
    icon: Wallet,
    iconBg: palette.iconBg,
    palette,
    kindBadge: "Ví tài sản",
    kindBadgeClass:
      "bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border)]",
    balanceLabel: "Khả dụng",
    balanceColor: "text-[var(--foreground)]",
    isCreditCard: false,
  };
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
  const [filterKind, setFilterKind] = useState<"all" | "asset" | "credit_card">(
    "all",
  );
  const [showBalance, setShowBalance] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [pending, startTransition] = useTransition();

  const {
    assetWallets,
    creditWallets,
    totalAssetBalance,
    totalCreditDebt,
  } = useMemo(() => {
    const assets = wallets.filter(
      (w) => w.kind !== "credit_card" && w.status === "active",
    );
    const credits = wallets.filter(
      (w) => w.kind === "credit_card" && w.status === "active",
    );

    const assetSum = assets.reduce(
      (acc, w) => acc.plus(new Decimal(w.currentBalance)),
      new Decimal(0),
    );
    const debtSum = credits.reduce(
      (acc, w) => acc.plus(new Decimal(w.currentBalance)),
      new Decimal(0),
    );

    return {
      assetWallets: assets,
      creditWallets: credits,
      totalAssetBalance: assetSum,
      totalCreditDebt: debtSum,
    };
  }, [wallets]);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 901px)");
    const updateViewport = () => setIsDesktop(query.matches);
    updateViewport();
    query.addEventListener("change", updateViewport);
    return () => query.removeEventListener("change", updateViewport);
  }, []);

  const activeCount = wallets.filter(
    (wallet) => wallet.status === "active",
  ).length;
  const activeWallets = wallets.filter(
    (wallet) => wallet.status === "active" && wallet.kind === "asset",
  );
  const transactionCount = wallets.reduce(
    (total, wallet) => total + wallet.transactionCount,
    0,
  );
  const confirmedBalance = new Decimal(
    confirmOperation?.wallet.currentBalance ?? 0,
  );
  const requiresSettlement =
    confirmOperation?.kind === "delete" && !confirmedBalance.isZero();
  const showDeactivateSheet = confirmOperation?.kind === "deactivate";
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
  const createFundingRequiresSourceWallet = (() => {
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
      orderedWallets.filter((wallet) => {
        const matchStatus =
          filterStatus === "all" || wallet.status === filterStatus;
        const matchKind =
          filterKind === "all" ||
          (filterKind === "asset" && wallet.kind !== "credit_card") ||
          (filterKind === "credit_card" && wallet.kind === "credit_card");
        return matchStatus && matchKind;
      }),
    [orderedWallets, filterStatus, filterKind],
  );

  const filteredAssetWallets = useMemo(
    () => filteredWallets.filter((w) => w.kind !== "credit_card"),
    [filteredWallets],
  );

  const filteredCreditWallets = useMemo(
    () => filteredWallets.filter((w) => w.kind === "credit_card"),
    [filteredWallets],
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
        kind: "asset",
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
    if (kind === "delete" && wallet.recurringTransactionCount > 0) {
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

  function openMobileDeactivateConfirmation(wallet: WalletItem) {
    setMobileMenuWalletId(null);
    setSettlementWalletId("");
    setConfirmOperation({ wallet, kind: "deactivate" });
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

  function renderWalletCard(wallet: WalletItem, index: number) {
    const isActive = wallet.status === "active";
    const menuOpen = mobileMenuWalletId === wallet.id;
    const visual = getWalletVisual(wallet, index);
    const Icon = visual.icon;
    const isCredit = wallet.kind === "credit_card";

    const rowContent = (
      <div className="flex items-center justify-between gap-3 px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl",
              visual.iconBg,
            )}
            aria-hidden
          >
            <Icon size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-[var(--foreground)]">
              {wallet.name}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              {!isActive ? (
                <span className="inline-flex items-center rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                  Tạm ngưng
                </span>
              ) : isCredit ? (
                <span>Thẻ tín dụng</span>
              ) : (
                <span>{visual.kindBadge}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <div
              className={cn(
                "text-sm font-bold tabular-nums tracking-tight",
                isCredit
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-[var(--foreground)]",
              )}
            >
              {showBalance
                ? `${isCredit && new Decimal(wallet.currentBalance).gt(0) ? "-" : ""}${formatAmount(wallet.currentBalance)}`
                : "••••••"}
              <span className="ml-1 text-[10px] font-medium uppercase text-[var(--text-muted)]">
                {workspace.currency}
              </span>
            </div>
          </div>
          {isAdmin && (
            <ChevronRight
              size={15}
              className="text-[var(--text-muted)]/40"
              aria-hidden
            />
          )}
        </div>
      </div>
    );

    if (!isAdmin) {
      return (
        <article
          key={wallet.id}
          className={cn(
            "overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]",
            !isActive && "opacity-75 bg-[var(--surface-secondary)]",
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
                "cursor-pointer select-none overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] transition-all duration-150 active:scale-[0.99] active:bg-[var(--surface-hover)]",
                !isActive && "opacity-75 bg-[var(--surface-secondary)]",
                menuOpen &&
                  "border-[var(--primary)] ring-1 ring-[var(--primary)]",
              )}
              aria-label={`${wallet.name}, ${visual.balanceLabel} ${formatAmount(wallet.currentBalance)} ${workspace.currency}. Chạm để mở menu quản lý.`}
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
          align="end"
          side="bottom"
          sideOffset={6}
          className="w-52 rounded-xl p-1.5"
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
              if (isActive) {
                openMobileDeactivateConfirmation(wallet);
              } else {
                setMobileMenuWalletId(null);
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

        {/* Hero Balance Card - Compact & Minimalist */}
        <section
          className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
          aria-label="Tổng tài sản"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
              <span className="flex size-6 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                <Landmark size={13} />
              </span>
              <span>Tổng số dư khả dụng ròng</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg text-[var(--text-muted)] hover:text-[var(--foreground)]"
              onClick={() => setShowBalance((prev) => !prev)}
              aria-label={showBalance ? "Ẩn số dư" : "Hiện số dư"}
            >
              {showBalance ? <Eye size={15} /> : <EyeOff size={15} />}
            </Button>
          </div>

          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-[var(--foreground)]">
              {showBalance ? formatAmount(totalBalance) : "••••••••"}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {workspace.currency}
            </span>
          </div>

          {/* Quick breakdown: Tài sản vs Dư nợ thẻ */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>Tài sản:</span>
              <strong className="tabular-nums font-bold">
                {showBalance ? `+${formatAmount(totalAssetBalance)}` : "••••••"}
              </strong>
            </div>

            {totalCreditDebt.gt(0) && (
              <div className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-1 text-rose-600 dark:text-rose-400">
                <span className="size-1.5 rounded-full bg-rose-500" />
                <span>Dư nợ:</span>
                <strong className="tabular-nums font-bold">
                  {showBalance ? `-${formatAmount(totalCreditDebt)}` : "••••••"}
                </strong>
              </div>
            )}
          </div>
        </section>

        {/* Wallets & Credit Cards Section */}
        <section
          className="wallet-mobile-collection space-y-3.5"
          aria-label="Danh sách ví và thẻ"
        >

          {/* Group 1: Ví tài sản */}
          {assetWallets.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1 text-xs font-semibold text-[var(--text-secondary)]">
                <span className="flex items-center gap-1.5">
                  <Wallet size={13} className="text-emerald-500" />
                  <span>Ví tài sản ({assetWallets.length})</span>
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {showBalance
                    ? `+${formatAmount(totalAssetBalance)} ${workspace.currency}`
                    : "••••••"}
                </span>
              </div>
              <div className="space-y-2">
                {assetWallets.map((wallet, index) =>
                  renderWalletCard(wallet, index),
                )}
              </div>
            </div>
          )}

          {/* Group 2: Thẻ tín dụng */}
          {creditWallets.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between px-1 text-xs font-semibold text-[var(--text-secondary)]">
                <span className="flex items-center gap-1.5">
                  <CreditCard size={13} className="text-rose-500" />
                  <span>Thẻ tín dụng ({creditWallets.length})</span>
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                  {showBalance
                    ? `Dư nợ: -${formatAmount(totalCreditDebt)} ${workspace.currency}`
                    : "••••••"}
                </span>
              </div>
              <div className="space-y-2">
                {creditWallets.map((wallet, index) =>
                  renderWalletCard(wallet, index),
                )}
              </div>
            </div>
          )}

          {!wallets.length && (
            <Empty
              variant="compact"
              icon={WalletCards}
              title="Chưa có ví nào"
              description="Bắt đầu tạo ví tài sản hoặc thêm thẻ tín dụng để quản lý dòng tiền."
              action={
                isAdmin ? (
                  <Button
                    type="button"
                    onClick={() => setCreatingModal(true)}
                  >
                    <Plus size={16} />
                    Thêm ví mới
                  </Button>
                ) : undefined
              }
            />
          )}
        </section>
      </div>

      <PageHeader
        className="wallet-desktop-only"
        title="Quản lý ví"
        description={`Theo dõi số dư và tổ chức các ví của ${workspace.name}.`}
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

      <div className="wallet-desktop-only space-y-5">
        <Card as="section" className="gap-0" aria-label="Tổng quan tài sản">
          <div className="grid items-center gap-6 min-[1100px]:grid-cols-[minmax(18rem,1.35fr)_minmax(26rem,1fr)]">
            <div className="flex min-w-0 items-start gap-4">
              <span
                className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"
                aria-hidden="true"
              >
                <Landmark size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--text-muted)]">
                  Tổng số dư khả dụng
                </p>
                <p className="mt-2 flex min-w-0 items-baseline gap-2 text-[2rem] font-semibold leading-none tracking-[-0.045em] text-[var(--foreground)] tabular-nums min-[1200px]:text-[2.35rem]">
                  <span className="truncate">{formatAmount(totalBalance)}</span>
                  <span className="shrink-0 text-xs font-semibold tracking-wide text-[var(--text-muted)]">
                    {workspace.currency}
                  </span>
                </p>
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Tài sản: +{formatAmount(totalAssetBalance)}
                  </span>
                  {totalCreditDebt.gt(0) && (
                    <span className="inline-flex items-center gap-1.5 font-medium text-rose-600 dark:text-rose-400">
                      <span className="size-1.5 rounded-full bg-rose-500" />
                      Dư nợ thẻ: -{formatAmount(totalCreditDebt)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-3 border-y border-[var(--border)] min-[1100px]:border-y-0">
              <div className="py-4 min-[1100px]:px-5 min-[1100px]:py-2">
                <dt className="text-xs text-[var(--text-muted)]">Tổng số ví</dt>
                <dd className="mt-1.5 text-lg font-semibold text-[var(--foreground)] tabular-nums">
                  {wallets.length}
                </dd>
              </div>
              <div className="border-l border-[var(--border)] px-5 py-4 min-[1100px]:py-2">
                <dt className="text-xs text-[var(--text-muted)]">Hoạt động</dt>
                <dd className="mt-1.5 text-lg font-semibold text-[var(--foreground)] tabular-nums">
                  {activeCount}
                </dd>
              </div>
              <div className="border-l border-[var(--border)] px-5 py-4 min-[1100px]:py-2 min-[1100px]:pr-0">
                <dt className="text-xs text-[var(--text-muted)]">Giao dịch</dt>
                <dd className="mt-1.5 text-lg font-semibold text-[var(--foreground)] tabular-nums">
                  {transactionCount}
                </dd>
              </div>
            </dl>
          </div>
        </Card>

        <Card
          as="section"
          className="gap-0"
          aria-labelledby="wallet-list-title"
        >
          <header className="flex items-center justify-between gap-6 pb-5">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"
                aria-hidden="true"
              >
                <WalletCards size={18} />
              </span>
              <div className="min-w-0">
                <h2
                  id="wallet-list-title"
                  className="text-base font-semibold text-[var(--foreground)]"
                >
                  Danh sách ví
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {isAdmin && filterStatus === "all"
                    ? "Kéo từng hàng để thay đổi thứ tự hiển thị."
                    : "Theo dõi số dư và hoạt động của từng ví."}
                </p>
              </div>
            </div>
            <Tabs
              className="w-[23rem] shrink-0 gap-0"
              value={filterStatus}
              onValueChange={(value) =>
                setFilterStatus(value as "all" | "active" | "deactive")
              }
            >
              <TabsList
                variant="navigation"
                className={cn(
                  wallets.length - activeCount > 0
                    ? "grid-cols-3"
                    : "grid-cols-2",
                )}
              >
                <TabsTrigger variant="navigation" value="all">
                  <span>Tất cả</span>
                  <TabsCount>{wallets.length}</TabsCount>
                </TabsTrigger>
                <TabsTrigger variant="navigation" value="active">
                  <span>Hoạt động</span>
                  <TabsCount>{activeCount}</TabsCount>
                </TabsTrigger>
                {wallets.length - activeCount > 0 && (
                  <TabsTrigger variant="navigation" value="deactive">
                    <span>Tạm ngưng</span>
                    <TabsCount>{wallets.length - activeCount}</TabsCount>
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          </header>

          <div>
            <div
              className="grid grid-cols-[1.25rem_2.5rem_minmax(10rem,1fr)_minmax(8rem,0.7fr)_6.5rem] items-center gap-3 border-t border-[var(--border)] py-2.5 text-[0.68rem] font-medium text-[var(--text-muted)] min-[1320px]:grid-cols-[1.25rem_2.5rem_minmax(12rem,1.25fr)_minmax(9rem,0.75fr)_minmax(8rem,0.65fr)_minmax(7rem,0.55fr)_6.5rem]"
              aria-hidden="true"
            >
              <span />
              <span />
              <span>Ví</span>
              <span>Số dư</span>
              <span className="hidden min-[1320px]:block">Hoạt động</span>
              <span className="hidden min-[1320px]:block">Cập nhật</span>
              <span className="text-right">Thao tác</span>
            </div>

            <div>
              {filteredWallets.map((wallet, index) => {
                const isActive = wallet.status === "active";
                const visual = getWalletVisual(wallet, index);
                return (
                  <article
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
                      if (!draggedWalletId || draggedWalletId === wallet.id)
                        return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDropTargetWalletId(wallet.id);
                    }}
                    onDragLeave={(event) => {
                      if (
                        !event.currentTarget.contains(
                          event.relatedTarget as Node,
                        )
                      ) {
                        setDropTargetWalletId((current) =>
                          current === wallet.id ? null : current,
                        );
                      }
                    }}
                    onDrop={(event) => handleWalletDrop(event, wallet.id)}
                    className={cn(
                      "group/wallet grid min-h-[4.75rem] grid-cols-[1.25rem_2.5rem_minmax(10rem,1fr)_minmax(8rem,0.7fr)_6.5rem] items-center gap-3 border-t border-[var(--border)] py-3.5 transition-colors min-[1320px]:grid-cols-[1.25rem_2.5rem_minmax(12rem,1.25fr)_minmax(9rem,0.75fr)_minmax(8rem,0.65fr)_minmax(7rem,0.55fr)_6.5rem]",
                      isAdmin &&
                      filterStatus === "all" &&
                      !pending &&
                      "cursor-grab active:cursor-grabbing",
                      dropTargetWalletId === wallet.id &&
                      "border-t-2 border-t-[var(--primary)] bg-[var(--primary-soft)]",
                      draggedWalletId === wallet.id && "opacity-50",
                      !isActive && "opacity-75",
                    )}
                    data-wallet-status={wallet.status}
                  >
                    <div className="grid place-items-center text-[var(--text-muted)]">
                      {isAdmin && filterStatus === "all" ? (
                        <span
                          className="grid place-items-center"
                          title={`Kéo để sắp xếp ${wallet.name}`}
                          aria-label={`Kéo để sắp xếp ${wallet.name}`}
                        >
                          <GripVertical size={16} />
                        </span>
                      ) : (
                        <span />
                      )}
                    </div>

                    <span
                      className={cn(
                        "grid size-10 place-items-center rounded-xl",
                        visual.iconBg,
                      )}
                      aria-hidden="true"
                    >
                      <visual.icon size={18} />
                    </span>

                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-[var(--foreground)]">
                          {wallet.name}
                        </h3>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            visual.kindBadgeClass,
                          )}
                        >
                          {visual.kindBadge}
                        </span>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 text-[0.68rem] font-medium",
                            isActive
                              ? "text-[var(--success)]"
                              : "text-[var(--warning)]",
                          )}
                        >
                          <span
                            className="size-1.5 rounded-full bg-current"
                            aria-hidden="true"
                          />
                          {isActive ? "Hoạt động" : "Tạm ngưng"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                        {wallet.description || "Chưa có ghi chú cho ví này."}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="flex items-baseline gap-1.5">
                        <strong
                          className={cn(
                            "truncate text-sm font-semibold tabular-nums",
                            visual.isCreditCard
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-[var(--foreground)]",
                          )}
                        >
                          {visual.isCreditCard &&
                          new Decimal(wallet.currentBalance).gt(0)
                            ? "-"
                            : ""}
                          {formatAmount(wallet.currentBalance)}
                        </strong>
                        <span className="text-[0.65rem] font-medium text-[var(--text-muted)]">
                          {workspace.currency}
                        </span>
                      </p>
                      <p className="mt-1 text-[0.68rem] text-[var(--text-muted)] tabular-nums">
                        {visual.balanceLabel} · Đầu kỳ {formatAmount(wallet.openingBalance)}
                      </p>
                    </div>

                    <div className="hidden min-w-0 min-[1320px]:block">
                      <p className="text-xs font-medium text-[var(--text-secondary)]">
                        {wallet.transactionCount} giao dịch
                      </p>
                      {wallet.recurringTransactionCount > 0 ? (
                        <p className="mt-1 flex items-center gap-1.5 text-[0.68rem] text-[var(--warning)]">
                          <Repeat2 size={12} />
                          {wallet.recurringTransactionCount} định kỳ
                        </p>
                      ) : (
                        <p className="mt-1 text-[0.68rem] text-[var(--text-muted)]">
                          Không có lịch định kỳ
                        </p>
                      )}
                    </div>

                    <div className="hidden min-w-0 items-center gap-1.5 text-[0.68rem] text-[var(--text-muted)] min-[1320px]:flex">
                      <Clock size={13} aria-hidden />
                      <span>
                        {new Intl.DateTimeFormat("vi-VN", {
                          dateStyle: "medium",
                        }).format(new Date(wallet.updatedAt))}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-1">
                      {isAdmin && (
                        <>
                          <Button
                            variant="icon"
                            size="icon"
                            title={`Chỉnh sửa ${wallet.name}`}
                            aria-label={`Chỉnh sửa ${wallet.name}`}
                            disabled={pending}
                            onClick={() => setEditingWallet(wallet)}
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            variant={isActive ? "destructiveIcon" : "icon"}
                            size="icon"
                            title={
                              isActive ? "Tạm ngưng ví" : "Kích hoạt lại ví"
                            }
                            aria-label={
                              isActive
                                ? `Tạm ngưng ${wallet.name}`
                                : `Kích hoạt lại ${wallet.name}`
                            }
                            disabled={pending}
                            onClick={() => {
                              if (isActive) {
                                requestDestructiveOperation(
                                  wallet,
                                  "deactivate",
                                );
                              } else {
                                activateWallet(wallet);
                              }
                            }}
                          >
                            {isActive ? (
                              <PauseCircle size={16} />
                            ) : (
                              <PlayCircle size={16} />
                            )}
                          </Button>
                          {!isActive && (
                            <Button
                              variant="destructiveIcon"
                              size="icon"
                              title={`Xóa ${wallet.name}`}
                              aria-label={`Xóa ${wallet.name}`}
                              disabled={pending}
                              onClick={() =>
                                requestDestructiveOperation(wallet, "delete")
                              }
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </article>
                );
              })}

              {!filteredWallets.length && (
                <Empty
                  icon={WalletCards}
                  title={
                    filterStatus === "all"
                      ? "Nhóm chưa có ví"
                      : "Không có ví ở trạng thái này"
                  }
                  description={
                    filterStatus !== "all"
                      ? "Chọn trạng thái khác để xem các ví còn lại."
                      : isAdmin
                        ? "Tạo ví đầu tiên để bắt đầu ghi nhận giao dịch tài chính."
                        : "Quản trị viên chưa tạo ví cho nhóm này."
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
          </div>
        </Card>
      </div>

      <Sheet
        open={creatingModal}
        onOpenChange={(open) => {
          if (!open) closeCreateSheet();
        }}
      >
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          placement={isDesktop ? "inset" : "edge"}
          size={isDesktop ? "wide" : "default"}
          spacing={isDesktop ? "flush" : "default"}
          elevation={isDesktop ? "flat" : "raised"}
          className={isDesktop ? undefined : "quick-transaction-sheet"}
        >
          <form
            onSubmit={handleCreate}
            className={cn(
              isDesktop
                ? "flex min-h-0 flex-1 flex-col overflow-hidden"
                : "quick-transaction-form",
            )}
            aria-busy={pending}
          >
            <SheetHeader
              icon={WalletCards}
              title="Tạo ví mới"
              description="Tạo nơi theo dõi tiền mặt, tài khoản hoặc quỹ riêng."
            />

            <div
              className={cn(
                isDesktop
                  ? "grid min-h-0 flex-1 grid-cols-2 content-start items-start gap-0 overflow-y-auto px-8 pt-6 pb-8"
                  : "quick-transaction-scroll grid gap-5 p-4",
              )}
            >
              <section
                aria-labelledby="wallet-details-heading"
                className={cn(
                  isDesktop ? "space-y-5 pr-8" : "grid gap-4",
                )}
              >
                {isDesktop && (
                  <div className="flex items-start gap-3">
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--surface-secondary)] text-[var(--primary)]"
                      aria-hidden="true"
                    >
                      <WalletCards size={16} />
                    </span>
                    <div>
                      <h3
                        id="wallet-details-heading"
                        className="text-sm font-semibold text-[var(--foreground)]"
                      >
                        Thông tin ví
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                        Đặt tên ngắn gọn để mọi người dễ nhận diện.
                      </p>
                    </div>
                  </div>
                )}
                <div className="grid gap-4">
                  <Input
                    label="Tên ví"
                    id="create-name"
                    name="name"
                    required
                    maxLength={120}
                    placeholder="Tiền mặt, tài khoản ngân hàng..."
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
                    placeholder="Mục đích sử dụng ví..."
                    className="w-full resize-none"
                  />
                </div>
              </section>

              <section
                aria-labelledby="initial-balance-heading"
                className={cn(
                  isDesktop
                    ? "space-y-5 border-l border-[var(--border)] pl-8"
                    : "grid gap-4 border-t border-[var(--border)] pt-4",
                )}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                  <CircleDollarSign size={18} className="text-[var(--primary)]" aria-hidden />
                  <span>Số dư ban đầu</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] -mt-2">
                  Có thể để trống và cập nhật bằng giao dịch sau.
                </p>

                <div className="grid gap-4">
                  <>
                  <MoneyInput
                    label={`Số tiền (${workspace.currency})`}
                    id="create-funding-amount"
                    name="fundingAmount"
                    value={createFundingAmount}
                    onValueChange={setCreateFundingAmount}
                  />

                  {hasInitialFunding && (
                    <div className="grid gap-3 border-t border-[var(--border)] pt-3">
                      <p className="text-xs font-medium text-[var(--text-secondary)]">
                        Nguồn số dư
                      </p>
                      <div
                        className="grid gap-2"
                        role="radiogroup"
                        aria-label="Nguồn số dư ban đầu"
                      >
                        <button
                          type="button"
                          role="radio"
                          aria-checked={createFundingType === "income"}
                          onClick={() => setCreateFundingType("income")}
                          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3 text-left transition-colors aria-checked:border-[var(--primary)] aria-checked:bg-[var(--primary-soft)]"
                        >
                          <div className="flex items-center gap-3">
                            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--surface-secondary)] text-[var(--primary)]" aria-hidden>
                              <TrendingUp size={15} />
                            </span>
                            <div>
                              <strong className="block text-xs font-semibold text-[var(--foreground)]">
                                Tiền có sẵn
                              </strong>
                              <small className="mt-0.5 block text-[0.68rem] text-[var(--text-muted)]">
                                Ghi nhận là khoản thu
                              </small>
                            </div>
                          </div>
                          <i
                            className={cn(
                              "size-4 rounded-full border border-[var(--border-strong)]",
                              createFundingType === "income" &&
                              "border-[var(--primary)] bg-[var(--primary)]",
                            )}
                            aria-hidden
                          />
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
                          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3 text-left transition-colors aria-checked:border-[var(--primary)] aria-checked:bg-[var(--primary-soft)] disabled:opacity-50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--surface-secondary)] text-[var(--primary)]" aria-hidden>
                              <Landmark size={15} />
                            </span>
                            <div>
                              <strong className="block text-xs font-semibold text-[var(--foreground)]">
                                Chuyển từ ví khác
                              </strong>
                              <small className="mt-0.5 block text-[0.68rem] text-[var(--text-muted)]">
                                Dịch chuyển số dư nội bộ
                              </small>
                            </div>
                          </div>
                          <i
                            className={cn(
                              "size-4 rounded-full border border-[var(--border-strong)]",
                              createFundingType === "transfer" &&
                              "border-[var(--primary)] bg-[var(--primary)]",
                            )}
                            aria-hidden
                          />
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
                      <p className="flex items-start gap-2 text-[0.68rem] leading-5 text-[var(--text-muted)]">
                        <ArrowLeftRight size={14} className="shrink-0 mt-0.5" />
                        {createFundingType === "income"
                          ? "Hệ thống sẽ tạo một giao dịch thu khi tạo ví."
                          : "Hệ thống sẽ tạo một giao dịch chuyển tiền nội bộ."}
                      </p>
                    </div>
                  )}
                  </>
                </div>
              </section>
            </div>

            <SheetFooter
              onCancel={closeCreateSheet}
              cancelLabel="Hủy"
              submitLabel="Tạo ví"
              isSubmitting={pending}
              submittingLabel="Đang tạo..."
              submitDisabled={
                pending ||
                !createFundingAmountIsValid ||
                (createFundingType === "transfer" && !createFundingWalletId)
              }
              submitType="submit"
            />
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
          side={isDesktop ? "right" : "bottom"}
          placement={isDesktop ? "inset" : "edge"}
          size={isDesktop ? "wide" : "default"}
          spacing={isDesktop ? "flush" : "default"}
          elevation={isDesktop ? "flat" : "raised"}
          className={isDesktop ? undefined : "wallet-edit-sheet"}
        >
          <SheetHeader
            icon={Pencil}
            title="Chỉnh sửa ví"
            description={
              isDesktop
                ? "Cập nhật tên và ghi chú giúp thành viên nhận diện đúng ví."
                : (editingWallet?.name ?? "Cập nhật thông tin ví")
            }
          />

          {editingWallet && (
            <form
              onSubmit={handleUpdate}
              className={cn(
                isDesktop
                  ? "flex min-h-0 flex-1 flex-col overflow-hidden"
                  : "wallet-edit-form",
              )}
              aria-busy={pending}
            >
              <div
                className={cn(
                  isDesktop
                    ? "grid min-h-0 flex-1 grid-cols-2 content-start items-start gap-0 overflow-y-auto px-8 pt-6 pb-8"
                    : "wallet-edit-body",
                )}
              >
                <section
                  aria-label="Tóm tắt ví"
                  className={cn(
                    isDesktop
                      ? "col-start-2 row-start-1 space-y-6 border-l border-[var(--border)] pl-8"
                      : "wallet-edit-summary",
                  )}
                >
                  {isDesktop && (
                    <div className="flex items-start gap-3">
                      <span
                        className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--surface-secondary)] text-[var(--primary)]"
                        aria-hidden="true"
                      >
                        <WalletCards size={16} />
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--foreground)]">
                          Thông tin hiện tại
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                          Số dư và hoạt động đã ghi nhận của ví.
                        </p>
                      </div>
                    </div>
                  )}
                  <div
                    className={cn(
                      isDesktop ? "min-w-0" : "wallet-edit-summary-identity",
                    )}
                  >
                    {!isDesktop && (
                      <span aria-hidden="true">
                        <WalletCards size={18} />
                      </span>
                    )}
                    <div className="min-w-0">
                      {isDesktop && (
                        <span className="text-[0.68rem] font-medium text-[var(--text-muted)]">
                          Tên ví
                        </span>
                      )}
                      <p
                        className={cn(
                          isDesktop &&
                          "mt-1 truncate text-sm font-semibold text-[var(--foreground)]",
                        )}
                      >
                        {editingWallet.name}
                      </p>
                      <small
                        className={cn(
                          isDesktop &&
                          "mt-2 block text-[0.68rem] text-[var(--text-muted)]",
                        )}
                      >
                        {editingWallet.transactionCount} giao dịch đã ghi nhận
                      </small>
                    </div>
                  </div>
                  <div
                    className={cn(
                      isDesktop
                        ? "border-y border-[var(--border)] py-5"
                        : "wallet-edit-summary-balance",
                    )}
                  >
                    <span
                      className={cn(
                        isDesktop &&
                        "text-[0.68rem] font-medium text-[var(--text-muted)]",
                      )}
                    >
                      Số dư hiện tại
                    </span>
                    <strong
                      className={cn(
                        isDesktop &&
                        "mt-2 flex items-baseline gap-1.5 text-[1.6rem] font-semibold leading-none tracking-[-0.035em] text-[var(--foreground)] tabular-nums",
                      )}
                    >
                      {formatAmount(editingWallet.currentBalance)}
                      <small
                        className={cn(
                          isDesktop &&
                          "text-[0.65rem] font-medium text-[var(--text-muted)]",
                        )}
                      >
                        {workspace.currency}
                      </small>
                    </strong>
                  </div>
                </section>

                <section
                  className={cn(
                    isDesktop
                      ? "col-start-1 row-start-1 space-y-5 pr-8"
                      : "wallet-edit-section",
                  )}
                  aria-labelledby="edit-wallet-details-heading"
                >
                  <div
                    className={cn(!isDesktop && "wallet-edit-section-heading")}
                  >
                    <h3
                      id="edit-wallet-details-heading"
                      className={cn(
                        isDesktop &&
                        "text-sm font-semibold text-[var(--foreground)]",
                      )}
                    >
                      Thông tin cơ bản
                    </h3>
                    <p
                      className={cn(
                        isDesktop &&
                        "mt-1 text-xs leading-5 text-[var(--text-muted)]",
                      )}
                    >
                      Tên và ghi chú giúp thành viên nhận diện đúng ví.
                    </p>
                  </div>
                  <div
                    className={cn(
                      isDesktop ? "space-y-4" : "wallet-edit-fields",
                    )}
                  >
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

              <SheetFooter
                onCancel={() => setEditingWallet(null)}
                cancelLabel="Hủy"
                submitLabel="Lưu thay đổi"
                isSubmitting={pending}
                submittingLabel="Đang lưu..."
                submitType="submit"
              />
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
          side={showDeactivateSheet && isDesktop ? "right" : "bottom"}
          placement={showDeactivateSheet && isDesktop ? "inset" : "edge"}
          size={showDeactivateSheet && isDesktop ? "wide" : "default"}
          spacing={showDeactivateSheet ? "flush" : "default"}
          elevation={showDeactivateSheet ? "flat" : "raised"}
          className={
            showDeactivateSheet
              ? undefined
              : "wallet-operation-sheet ledger-mobile-review-sheet pending-delete"
          }
        >
          {confirmOperation && showDeactivateSheet ? (
            <WalletDeactivateSheet
              wallet={confirmOperation.wallet}
              currency={workspace.currency}
              isDesktop={isDesktop}
              pending={pending}
              onCancel={() => {
                setConfirmOperation(null);
                setSettlementWalletId("");
              }}
              onConfirm={confirmDestructiveOperation}
              onOpenRecurringTransactions={() => {
                setConfirmOperation(null);
                setEditingWallet(null);
                router.push("/recurring-transactions");
              }}
            />
          ) : confirmOperation ? (
            <>
              <SheetHeader
                icon={confirmOperation.kind === "delete" ? Trash2 : PauseCircle}
                title={
                  confirmOperation.kind === "delete"
                    ? "Xóa ví?"
                    : "Tạm ngưng ví?"
                }
                description={
                  confirmOperation.kind === "delete"
                    ? "Lịch sử giao dịch của ví vẫn được giữ lại."
                    : "Bạn có thể kích hoạt lại ví bất cứ lúc nào."
                }
              />

              <div className="ledger-mobile-review-body wallet-operation-body">
                <div className="ledger-mobile-review-transaction rounded-xl">
                  <div>
                    <span>{confirmOperation.wallet.name}</span>
                    <small>
                      {confirmOperation.kind === "delete"
                        ? "Ví sẽ được ẩn khỏi nhóm"
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
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
