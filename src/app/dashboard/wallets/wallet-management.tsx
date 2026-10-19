"use client";

import Decimal from "decimal.js";
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  CreditCard,
  GripVertical,
  Info,
  Landmark,
  MoreHorizontal,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Repeat2,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Wallet,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type DragEvent,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { usePrivacyMask } from "@/lib/privacy-mask";

import {
  createManagedWalletAction,
  reorderManagedWalletsAction,
  setManagedWalletStatusAction,
  softDeleteManagedWalletAction,
  updateManagedWalletAction,
} from "@/app/dashboard/wallets/actions";
import {
  Button,
  Card,
  Empty,
  Input,
  Loading,
  MoneyInput,
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
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CreditCardCommitmentDetailItem } from "@/services/credit-card-service";

function formatDateVi(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

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
  reservedBalance?: string;
  availableBalance?: string;
  ownerLabel?: string;
};

type DestructiveWalletOperation = {
  wallet: WalletItem;
  kind: "deactivate" | "delete";
};

function WalletDeactivateSheet({
  wallet,
  currency,
  pending,
  onCancel,
  onConfirm,
  onOpenRecurringTransactions,
}: {
  wallet: WalletItem;
  currency: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onOpenRecurringTransactions: () => void;
}) {
  const hasRecurringDependencies = wallet.recurringTransactionCount > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <SheetHeader
        icon={PauseCircle}
        title={
          hasRecurringDependencies ? "Chưa thể tạm ngưng ví" : "Tạm ngưng ví"
        }
        description={
          hasRecurringDependencies
            ? "Cần chuyển hoặc xóa các giao dịch định kỳ của ví này trước."
            : "Ví sẽ ngừng nhận giao dịch mới nhưng vẫn giữ nguyên số dư và lịch sử."
        }
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 md:p-5">
        <section
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4"
          aria-label={`Thông tin ví ${wallet.name}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))] text-[var(--primary)]"
                aria-hidden="true"
              >
                <WalletCards size={17} />
              </span>
              <div className="min-w-0">
                <strong className="block break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                  {wallet.name}
                </strong>
                <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--success)]">
                  <span className="size-1.5 rounded-full bg-current" />
                  Đang hoạt động
                </span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <span className="block text-xs text-[var(--text-muted)]">
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
            className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--warning)_9%,var(--surface))] p-4"
            aria-labelledby="wallet-pause-dependency-title"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-[var(--warning)]"
                aria-hidden="true"
              />
              <div className="min-w-0">
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
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
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
                  Số dư hiện tại và toàn bộ lịch sử giao dịch vẫn được giữ
                  nguyên.
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
              Bạn có thể kích hoạt lại ví bất cứ lúc nào.
            </p>
          </section>
        )}
      </div>

      <SheetFooter className="flex-row justify-end gap-2.5">
        <Button
          type="button"
          variant="outline"
          className="flex-1 md:flex-none"
          disabled={pending}
          onClick={onCancel}
        >
          {hasRecurringDependencies ? "Đóng" : "Hủy"}
        </Button>
        <Button
          type="button"
          variant={hasRecurringDependencies ? "default" : "warning"}
          className="flex-1 md:flex-none"
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
    </div>
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
    iconBg:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  },
  {
    bg: "bg-sky-500",
    text: "text-sky-500",
    iconBg:
      "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
  },
  {
    bg: "bg-violet-500",
    text: "text-violet-500",
    iconBg:
      "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20",
  },
  {
    bg: "bg-amber-500",
    text: "text-amber-500",
    iconBg:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  },
  {
    bg: "bg-rose-500",
    text: "text-rose-500",
    iconBg:
      "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
  },
];

function getWalletVisual(wallet: WalletItem, index: number) {
  if (wallet.kind === "credit_card") {
    return {
      icon: CreditCard,
      iconBg:
        "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
      palette: WALLET_PALETTES[4],
      kindBadge: wallet.ownerLabel || "Thẻ tín dụng",
      kindBadgeClass:
        "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
      balanceLabel: "Dư nợ hiện tại",
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
      kindBadge: wallet.ownerLabel || "Tiền mặt · Ví chung",
      kindBadgeClass:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      balanceLabel: "Số dư có thể dùng",
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
      kindBadge: wallet.ownerLabel || "Ngân hàng · Ví chung",
      kindBadgeClass:
        "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
      balanceLabel: "Số dư có thể dùng",
      balanceColor: "text-[var(--foreground)]",
      isCreditCard: false,
    };
  }
  const palette = WALLET_PALETTES[(index + 2) % WALLET_PALETTES.length];
  return {
    icon: Wallet,
    iconBg: palette.iconBg,
    palette,
    kindBadge: wallet.ownerLabel || "Ví thanh toán · Ví chung",
    kindBadgeClass:
      "bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border)]",
    balanceLabel: "Số dư có thể dùng",
    balanceColor: "text-[var(--foreground)]",
    isCreditCard: false,
  };
}

export function WalletManagement({
  workspace,
  wallets,
  totalBalance,
  isAdmin,
  commitmentDetails = [],
  initialReservedWalletId,
}: {
  workspace: { name: string; currency: string };
  wallets: WalletItem[];
  totalBalance: string;
  isAdmin: boolean;
  commitmentDetails?: CreditCardCommitmentDetailItem[];
  initialReservedWalletId?: string;
}) {
  const router = useRouter();
  const [creatingModal, setCreatingModal] = useState(false);
  const [createFundingType, setCreateFundingType] = useState<
    "transfer" | "income"
  >("income");
  const [createFundingAmount, setCreateFundingAmount] = useState("");
  const [createFundingWalletId, setCreateFundingWalletId] = useState("");
  const [editingWallet, setEditingWallet] = useState<WalletItem | null>(null);
  const [detailWallet, setDetailWallet] = useState<WalletItem | null>(null);
  const [reservedBreakdownOpen, setReservedBreakdownOpen] = useState(
    Boolean(initialReservedWalletId),
  );
  const [selectedReservedWalletId, setSelectedReservedWalletId] =
    useState<string>(initialReservedWalletId || "all");
  const [prevInitialReservedWalletId, setPrevInitialReservedWalletId] =
    useState<string | undefined>(initialReservedWalletId);

  if (initialReservedWalletId !== prevInitialReservedWalletId) {
    setPrevInitialReservedWalletId(initialReservedWalletId);
    if (initialReservedWalletId) {
      setSelectedReservedWalletId(
        initialReservedWalletId === "all" ? "all" : initialReservedWalletId,
      );
      setReservedBreakdownOpen(true);
    }
  }

  function openReservedBreakdown(walletId = "all") {
    setMobileMenuWalletId(null);
    setSelectedReservedWalletId(walletId);
    setReservedBreakdownOpen(true);
  }

  function handleReservedBreakdownOpenChange(open: boolean) {
    setReservedBreakdownOpen(open);
    if (!open && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("reservedWalletId")) {
        url.searchParams.delete("reservedWalletId");
        window.history.replaceState(null, "", url.pathname + url.search);
      }
    }
  }

  const [filterStatus, setFilterStatus] = useState<
    "all" | "active" | "deactive"
  >("all");
  const [confirmOperation, setConfirmOperation] =
    useState<DestructiveWalletOperation | null>(null);
  const [settlementWalletId, setSettlementWalletId] = useState("");
  const [blockedOperation, setBlockedOperation] =
    useState<DestructiveWalletOperation | null>(null);
  const [customOrderIds, setCustomOrderIds] = useState<string[] | null>(null);
  const orderedWallets = useMemo(() => {
    if (!customOrderIds) return wallets;
    const byId = new Map(wallets.map((w) => [w.id, w]));
    const ordered: WalletItem[] = [];
    for (const id of customOrderIds) {
      const item = byId.get(id);
      if (item) {
        ordered.push(item);
        byId.delete(id);
      }
    }
    for (const item of byId.values()) {
      ordered.push(item);
    }
    return ordered;
  }, [wallets, customOrderIds]);
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
  const privacyMasked = usePrivacyMask();
  const showBalance = !privacyMasked;
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
      (acc, w) =>
        acc.plus(Decimal.max(new Decimal(w.currentBalance), new Decimal(0))),
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
    const query = window.matchMedia("(min-width: 768px)");
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
  const confirmedBalance = new Decimal(
    confirmOperation?.wallet.currentBalance ?? 0,
  );
  const requiresSettlement =
    confirmOperation?.kind === "delete" && !confirmedBalance.isZero();
  const showDeactivateSheet = confirmOperation?.kind === "deactivate";
  const settlementWallets = wallets.filter(
    (wallet) =>
      wallet.status === "active" &&
      wallet.kind !== "credit_card" &&
      wallet.id !== confirmOperation?.wallet.id,
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

  function saveWalletOrder(
    nextWallets: WalletItem[],
    previousWallets: WalletItem[],
  ) {
    setCustomOrderIds(nextWallets.map(({ id }) => id));
    startTransition(async () => {
      const result = await reorderManagedWalletsAction({
        walletIds: nextWallets.map(({ id }) => id),
      });
      if (result.ok) {
        toast.success("Đã cập nhật thứ tự ví.");
        router.refresh();
        return;
      }

      setCustomOrderIds(previousWallets.map(({ id }) => id));
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
              candidate.status === "active" &&
              candidate.kind !== "credit_card" &&
              candidate.id !== wallet.id,
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
        setDetailWallet(null);
        router.refresh();
      } else {
        toast.error(result.message ?? "Không thể xử lý ví.");
      }
    });
  }

  function renderWalletGridCard(wallet: WalletItem, index: number) {
    const isActive = wallet.status === "active";
    const anySheetOpen =
      reservedBreakdownOpen ||
      detailWallet !== null ||
      editingWallet !== null ||
      confirmOperation !== null ||
      blockedOperation !== null ||
      creatingModal;
    const menuOpen = mobileMenuWalletId === wallet.id && !anySheetOpen;
    const visual = getWalletVisual(wallet, index);
    const Icon = visual.icon;
    const isCredit = wallet.kind === "credit_card";

    const actualBalanceDec = new Decimal(wallet.currentBalance || 0);
    const cardDebtDec = Decimal.max(actualBalanceDec, new Decimal(0));
    const reservedBalanceDec = isCredit
      ? cardDebtDec
      : new Decimal(wallet.reservedBalance || 0);

    const menuItems = (
      <DropdownMenuContent
        align={isDesktop ? "end" : "center"}
        side="bottom"
        sideOffset={6}
        className="w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5"
      >
        <DropdownMenuItem
          onClick={() => {
            setMobileMenuWalletId(null);
            setDetailWallet(wallet);
          }}
        >
          <Info size={15} className="text-[var(--primary)]" aria-hidden="true" />
          <span>Chi tiết số dư</span>
        </DropdownMenuItem>
        {!isCredit && (
          <DropdownMenuItem
            onClick={() => {
              setMobileMenuWalletId(null);
              openReservedBreakdown(wallet.id);
            }}
          >
            <CreditCard
              size={15}
              className="text-[var(--warning)]"
              aria-hidden="true"
            />
            <span>Chi tiết tiền chờ thanh toán thẻ</span>
          </DropdownMenuItem>
        )}
        {isCredit && (
          <DropdownMenuItem
            onClick={() => {
              setMobileMenuWalletId(null);
              router.push(`/credit-cards/${wallet.id}`);
            }}
          >
            <CreditCard
              size={15}
              className="text-[var(--primary)]"
              aria-hidden="true"
            />
            <span>Mở trang thẻ tín dụng</span>
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={pending}
              onClick={() => {
                setMobileMenuWalletId(null);
                setEditingWallet(wallet);
              }}
            >
              <Pencil size={15} aria-hidden="true" />
              <span>Chỉnh sửa ví</span>
            </DropdownMenuItem>
            {!isCredit && (
              <>
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
                    <PauseCircle size={15} aria-hidden="true" />
                  ) : (
                    <PlayCircle size={15} aria-hidden="true" />
                  )}
                  <span>{isActive ? "Tạm ngưng ví" : "Kích hoạt lại"}</span>
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
                      <Trash2 size={15} aria-hidden="true" />
                      <span>Xóa ví</span>
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    );

    const cardInnerContent = (
      <>
        {/* Top Row: Wallet Name + Subtitle + Status Badge / Desktop Actions */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-xl md:size-10",
                visual.iconBg,
              )}
              aria-hidden="true"
            >
              <Icon size={17} />
            </span>

            <div className="min-w-0 flex-1">
              <h3
                className="break-words text-sm font-semibold leading-snug text-[var(--foreground)] md:text-base"
                title={wallet.name}
              >
                {wallet.name}
              </h3>
              <p className="mt-0.5 break-words text-[11px] leading-snug text-[var(--text-muted)]">
                {visual.kindBadge}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                isActive
                  ? "bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] text-[var(--success)]"
                  : "bg-[color-mix(in_srgb,var(--warning)_12%,var(--surface))] text-[var(--warning)]",
              )}
            >
              <span
                className="size-1.5 rounded-full bg-current"
                aria-hidden="true"
              />
              {isActive ? "Hoạt động" : "Tạm ngưng"}
            </span>

            {/* Desktop-only Drag & Menu Controls */}
            <div className="hidden shrink-0 items-center gap-1 lg:flex">
              {isAdmin && filterStatus === "all" && (
                <span
                  className="grid cursor-grab place-items-center rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] active:cursor-grabbing"
                  title={`Kéo để sắp xếp ${wallet.name}`}
                  aria-label={`Kéo để sắp xếp ${wallet.name}`}
                >
                  <GripVertical size={15} />
                </span>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Tùy chọn ví ${wallet.name}`}
                    />
                  }
                >
                  <MoreHorizontal size={16} aria-hidden="true" />
                </DropdownMenuTrigger>
                {menuItems}
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Balance Section */}
        <div className="space-y-2.5 border-t border-[var(--border)] pt-3">
          <div className="flex items-baseline justify-between gap-3 md:block md:space-y-1">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              {isCredit
                ? actualBalanceDec.lt(0)
                  ? "Số dư nộp thừa"
                  : "Dư nợ hiện tại"
                : "Số dư hiện tại"}
            </span>
            <div className="flex flex-wrap items-baseline justify-end gap-1 md:justify-start md:gap-1.5">
              <strong
                className={cn(
                  "text-base font-bold tracking-tight tabular-nums md:text-xl",
                  isCredit
                    ? actualBalanceDec.lt(0)
                      ? "text-[var(--success)]"
                      : cardDebtDec.gt(0)
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-[var(--foreground)]"
                    : actualBalanceDec.lt(0)
                      ? "text-[var(--destructive)]"
                      : "text-[var(--foreground)]",
                )}
              >
                {showBalance
                  ? isCredit
                    ? actualBalanceDec.lt(0)
                      ? `+${formatAmount(actualBalanceDec.abs())}`
                      : formatAmount(cardDebtDec)
                    : formatAmount(actualBalanceDec)
                  : "••••••••"}
              </strong>
              <span className="shrink-0 text-[11px] font-semibold uppercase text-[var(--text-muted)] md:text-xs">
                {workspace.currency}
              </span>
            </div>
          </div>

          {/* Secondary Row: shown on mobile only when there is reserved balance, always shown on md+ */}
          <div
            className={cn(
              "grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-2.5 text-xs",
              (isCredit || reservedBalanceDec.lte(0)) && "hidden md:grid",
            )}
          >
            <div className="min-w-0">
              <span className="block text-[11px] text-[var(--text-muted)]">
                {isCredit ? "Dư nợ ban đầu" : "Số dư ban đầu"}
              </span>
              <strong className="mt-0.5 block font-semibold tabular-nums text-[var(--foreground)]">
                {showBalance
                  ? `${formatAmount(wallet.openingBalance)} ${workspace.currency}`
                  : "••••••"}
              </strong>
            </div>

            {isCredit ? (
              <div className="min-w-0 text-right">
                <span className="block text-[11px] text-[var(--text-muted)]">
                  Biến động dư nợ
                </span>
                {(() => {
                  const netDiff = actualBalanceDec.minus(
                    wallet.openingBalance,
                  );
                  return (
                    <strong
                      className={cn(
                        "mt-0.5 block font-semibold tabular-nums",
                        netDiff.gt(0)
                          ? "text-[var(--destructive)]"
                          : netDiff.lt(0)
                            ? "text-[var(--success)]"
                            : "text-[var(--text-secondary)]",
                      )}
                    >
                      {showBalance
                        ? `${netDiff.gt(0) ? "+" : netDiff.lt(0) ? "-" : ""}${formatAmount(netDiff.abs())} ${workspace.currency}`
                        : "••••••"}
                    </strong>
                  );
                })()}
              </div>
            ) : (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  openReservedBreakdown(wallet.id);
                }}
                className="group/reserved -mx-1.5 -my-1 min-w-0 cursor-pointer rounded-lg px-1.5 py-1 text-right transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                title={`Xem chi tiết tiền chờ thanh toán thẻ của ${wallet.name}`}
              >
                <span className="inline-flex items-center justify-end gap-1 text-[11px] text-[var(--text-muted)] group-hover/reserved:text-[var(--foreground)]">
                  <span>Tiền chờ thanh toán thẻ</span>
                  <Info
                    size={11}
                    className="shrink-0 text-[var(--primary)]"
                    aria-hidden="true"
                  />
                </span>
                <strong
                  className={cn(
                    "mt-0.5 block font-semibold tabular-nums underline-offset-2 group-hover/reserved:underline",
                    reservedBalanceDec.gt(0)
                      ? "text-[var(--warning)]"
                      : "text-[var(--text-secondary)]",
                  )}
                >
                  {showBalance
                    ? `${formatAmount(reservedBalanceDec)} ${workspace.currency}`
                    : "••••••"}
                </strong>
              </button>
            )}
          </div>
        </div>

        {/* Footer: Activity counts + Desktop Quick Actions */}
        <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5 text-[11px] text-[var(--text-muted)]">
          <div className="min-w-0">
            <span>{wallet.transactionCount} giao dịch</span>
            {wallet.recurringTransactionCount > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-1 text-[var(--warning)]">
                · <Repeat2 size={11} aria-hidden="true" />
                {wallet.recurringTransactionCount} định kỳ
              </span>
            )}
          </div>

          {/* Touch hint on mobile/tablet, icon buttons on desktop */}
          <span className="font-medium text-[var(--text-secondary)] lg:hidden">
            Thao tác ›
          </span>

          <div className="hidden shrink-0 items-center gap-1 lg:flex">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-[var(--text-secondary)] hover:text-[var(--foreground)]"
              onClick={() => setDetailWallet(wallet)}
              aria-label={`Chi tiết số dư ${wallet.name}`}
              title="Chi tiết số dư"
            >
              <Info size={15} aria-hidden="true" />
            </Button>
            {isCredit && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-[var(--text-secondary)] hover:text-[var(--primary)]"
                onClick={() => router.push(`/credit-cards/${wallet.id}`)}
                aria-label={`Mở trang thẻ ${wallet.name}`}
                title="Mở trang thẻ tín dụng"
              >
                <ArrowUpRight size={15} aria-hidden="true" />
              </Button>
            )}
            {isAdmin && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                disabled={pending}
                onClick={() => setEditingWallet(wallet)}
                aria-label={`Chỉnh sửa ví ${wallet.name}`}
                title="Chỉnh sửa ví"
              >
                <Pencil size={14} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </>
    );

    return (
      <div key={wallet.id} className="contents">
        {/* Mobile & Tablet (<1024px): Touch Spotlight Card with Context Menu */}
        <div className="lg:hidden">
          <DropdownMenu
            open={menuOpen}
            onOpenChange={(open) =>
              setMobileMenuWalletId(open && !anySheetOpen ? wallet.id : null)
            }
          >
            <SpotlightTrigger
              open={menuOpen}
              onOpenChange={(open) =>
                setMobileMenuWalletId(open && !anySheetOpen ? wallet.id : null)
              }
              mobileOnly
              dismissLabel={`Đóng menu quản lý ${wallet.name}`}
              render={
                <article
                  role="button"
                  tabIndex={0}
                  data-wallet-status={wallet.status}
                  aria-label={`${wallet.name}. Chạm để mở menu thao tác ví.`}
                  className={cn(
                    "flex h-full cursor-pointer select-none flex-col justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-left transition-all duration-150 active:scale-[0.99] active:bg-[var(--surface-hover)] md:gap-3.5 md:p-5",
                    !isActive && "bg-[var(--surface-secondary)] opacity-80",
                  )}
                />
              }
            >
              {(spotlightTrigger) => (
                <DropdownMenuTrigger
                  nativeButton={false}
                  render={spotlightTrigger}
                >
                  {cardInnerContent}
                </DropdownMenuTrigger>
              )}
            </SpotlightTrigger>
            {menuItems}
          </DropdownMenu>
        </div>

        {/* Desktop (>=1024px): Draggable Card with Inline Action Buttons */}
        <article
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
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setDropTargetWalletId((current) =>
                current === wallet.id ? null : current,
              );
            }
          }}
          onDrop={(event) => handleWalletDrop(event, wallet.id)}
          data-wallet-status={wallet.status}
          className={cn(
            "hidden flex-col justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors lg:flex",
            !isActive && "bg-[var(--surface-secondary)] opacity-80",
            dropTargetWalletId === wallet.id &&
              "border-[var(--primary)] bg-[var(--primary-soft)]",
            draggedWalletId === wallet.id && "opacity-50",
          )}
        >
          {cardInnerContent}
        </article>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Unified Header + Top Summary Strip */}
      <Card as="section" className="p-4 md:p-5" aria-label="Tổng quan số dư ví">
        {/* Top Row: Mobile shows Primary Hero Metric (Tổng số dư hiện tại) + Action Buttons; Desktop shows Page Title + Action Buttons */}
        <div className="flex items-start justify-between gap-3 md:items-center md:border-b md:border-[var(--border)] md:pb-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 md:hidden">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                Tổng số dư hiện tại
              </span>
              <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--surface-secondary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                {assetWallets.length} ví thanh toán
              </span>
            </div>

            <h1 className="sr-only md:not-sr-only md:text-lg md:font-semibold md:text-[var(--foreground)]">
              Ví tài chính
            </h1>
            <p className="mt-0.5 hidden text-xs text-[var(--text-secondary)] md:block">
              Quản lý các ví thanh toán, thẻ tín dụng và số dư khả dụng.
            </p>

            <div className="mt-1 flex flex-wrap items-baseline gap-1.5 md:hidden">
              <strong className="text-2xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                {showBalance ? formatAmount(totalAssetBalance) : "••••••••"}
              </strong>
              <span className="shrink-0 text-xs font-semibold uppercase text-[var(--text-muted)]">
                {workspace.currency}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 md:size-9"
              onClick={() => openReservedBreakdown("all")}
              aria-label="Tiền chờ thanh toán thẻ"
              title="Xem phân bổ tiền chờ thanh toán thẻ"
            >
              <CreditCard size={15} />
            </Button>

            {isAdmin && (
              <Button
                type="button"
                variant="default"
                size="icon"
                className="size-8 md:size-9"
                onClick={() => setCreatingModal(true)}
                aria-label="Thêm ví"
                title="Thêm ví mới"
              >
                <Plus size={16} />
              </Button>
            )}
          </div>
        </div>

        {/* Mobile 2-Col Secondary Strip (<768px) & Desktop 3-Col Summary Strip (md:grid) */}
        <div className="mt-3.5 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-3 md:mt-4 md:grid-cols-3 md:gap-5 md:divide-x md:divide-[var(--border)] md:border-t-0 md:pt-0">
          {/* Metric 1: Tổng số dư hiện tại (Desktop only — already shown as Hero Metric on Mobile) */}
          <div className="hidden min-w-0 space-y-1 md:block">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Tổng số dư hiện tại
              </span>
              <span className="inline-flex shrink-0 rounded-md bg-[var(--surface-secondary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                {assetWallets.length} ví thanh toán
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-1">
              <strong className="text-2xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                {showBalance ? formatAmount(totalAssetBalance) : "••••••••"}
              </strong>
              <span className="shrink-0 text-xs font-semibold uppercase text-[var(--text-muted)]">
                {workspace.currency}
              </span>
            </div>
            <p className="text-xs leading-snug text-[var(--text-muted)]">
              Tổng tiền trong các ví đang hoạt động
            </p>
          </div>

          {/* Metric 2: Tiền chờ thanh toán thẻ */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => openReservedBreakdown("all")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openReservedBreakdown("all");
              }
            }}
            className="group/kpi-reserved min-w-0 cursor-pointer space-y-0.5 transition-colors md:space-y-1 md:pl-5"
            title="Bấm để xem chi tiết tiền chờ thanh toán thẻ"
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[11px] font-medium text-[var(--text-muted)] group-hover/kpi-reserved:text-[var(--foreground)] md:text-xs md:text-[var(--text-secondary)]">
                Tiền chờ thanh toán thẻ
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-5 shrink-0 text-[var(--primary)] md:size-6"
                onClick={(e) => {
                  e.stopPropagation();
                  openReservedBreakdown("all");
                }}
                aria-label="Chi tiết tiền chờ thanh toán thẻ"
                title="Chi tiết tiền chờ thanh toán thẻ"
              >
                <Info size={13} aria-hidden="true" />
              </Button>
            </div>
            <div className="flex flex-wrap items-baseline gap-1">
              <strong
                className={cn(
                  "text-sm font-bold tracking-tight tabular-nums underline-offset-4 group-hover/kpi-reserved:underline md:text-2xl",
                  totalCreditDebt.gt(0)
                    ? "text-[var(--warning)]"
                    : "text-[var(--foreground)]",
                )}
              >
                {showBalance
                  ? `${totalCreditDebt.gt(0) ? "-" : ""}${formatAmount(totalCreditDebt)}`
                  : "••••••••"}
              </strong>
              <span className="shrink-0 text-[11px] font-semibold uppercase text-[var(--text-muted)] md:text-xs">
                {workspace.currency}
              </span>
            </div>
            <p className="hidden text-xs leading-snug text-[var(--text-muted)] md:block">
              {creditWallets.length > 0
                ? `Khoản chờ trả của ${creditWallets.length} thẻ tín dụng`
                : "Chưa có khoản chờ trả thẻ"}
            </p>
          </div>

          {/* Metric 3: Số dư khả dụng */}
          <div className="min-w-0 space-y-0.5 border-l border-[var(--border)] pl-3 md:space-y-1 md:border-l-0 md:pl-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-[var(--primary)] md:text-xs">
                Số dư khả dụng
              </span>
              <span className="hidden shrink-0 items-center gap-1 rounded-md bg-[var(--primary-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--primary)] md:inline-flex">
                <ShieldCheck size={12} aria-hidden="true" />
                An toàn chi tiêu
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-1 md:gap-1.5">
              <strong className="text-sm font-bold tracking-tight tabular-nums text-[var(--foreground)] md:text-2xl">
                {showBalance ? formatAmount(totalBalance) : "••••••••"}
              </strong>
              <span className="shrink-0 text-[11px] font-semibold uppercase text-[var(--text-muted)] md:text-xs">
                {workspace.currency}
              </span>
            </div>
            <p className="hidden text-xs leading-snug text-[var(--text-muted)] md:block">
              Số tiền có thể chi tiêu (đã trừ khoản chờ trả thẻ)
            </p>
          </div>
        </div>
      </Card>

      {/* 2. Filter Bar & Wallets Grid */}
      <section className="space-y-3.5 md:space-y-4" aria-labelledby="wallet-list-title">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <h2
              id="wallet-list-title"
              className="text-sm font-semibold text-[var(--foreground)] md:text-base"
            >
              Danh sách ví ({filteredWallets.length})
            </h2>
            {isAdmin && filterStatus === "all" && (
              <span className="hidden text-xs text-[var(--text-muted)] lg:inline">
                · Kéo thả thẻ ví để đổi thứ tự hiển thị
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Kind Filter */}
            <Tabs
              value={filterKind}
              onValueChange={(val) =>
                setFilterKind(val as "all" | "asset" | "credit_card")
              }
              className="w-full md:w-auto"
            >
              <TabsList variant="segmented" className="grid w-full grid-cols-3 md:inline-flex md:w-auto">
                <TabsTrigger variant="segmented" value="all" className="px-2 text-xs">
                  Tất cả ({wallets.length})
                </TabsTrigger>
                <TabsTrigger variant="segmented" value="asset" className="px-2 text-xs">
                  Ví thanh toán
                </TabsTrigger>
                <TabsTrigger variant="segmented" value="credit_card" className="px-2 text-xs">
                  Thẻ tín dụng
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Status Filter (Only shown when inactive wallets exist) */}
            {wallets.length - activeCount > 0 && (
              <Tabs
                value={filterStatus}
                onValueChange={(value) =>
                  setFilterStatus(value as "all" | "active" | "deactive")
                }
                className="w-full md:w-auto"
              >
                <TabsList variant="segmented" className="grid w-full grid-cols-3 md:inline-flex md:w-auto">
                  <TabsTrigger variant="segmented" value="all" className="px-2 text-xs">
                    <span>Tất cả</span>
                    <TabsCount>{wallets.length}</TabsCount>
                  </TabsTrigger>
                  <TabsTrigger variant="segmented" value="active" className="px-2 text-xs">
                    <span>Hoạt động</span>
                    <TabsCount>{activeCount}</TabsCount>
                  </TabsTrigger>
                  <TabsTrigger variant="segmented" value="deactive" className="px-2 text-xs">
                    <span>Tạm ngưng</span>
                    <TabsCount>{wallets.length - activeCount}</TabsCount>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
        </div>

        {filteredWallets.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
            {filteredWallets.map((wallet, index) =>
              renderWalletGridCard(wallet, index),
            )}
          </div>
        ) : (
          <Card as="div">
            <Empty
              icon={WalletCards}
              title={
                wallets.length === 0
                  ? "Nhóm chưa có ví nào"
                  : "Không có ví phù hợp bộ lọc"
              }
              description={
                wallets.length === 0
                  ? isAdmin
                    ? "Tạo ví đầu tiên để bắt đầu quản lý thu chi và số dư."
                    : "Quản trị viên chưa tạo ví cho nhóm này."
                  : "Hãy chọn bộ lọc khác để xem các ví còn lại."
              }
              action={
                wallets.length === 0 && isAdmin ? (
                  <Button type="button" onClick={() => setCreatingModal(true)}>
                    <Plus size={16} />
                    Thêm ví đầu tiên
                  </Button>
                ) : undefined
              }
            />
          </Card>
        )}
      </section>

      {/* Sheet 1: Tạo ví mới / Chuyển số dư khởi tạo */}
      <Sheet
        open={creatingModal}
        onOpenChange={(open) => {
          if (!open) closeCreateSheet();
        }}
      >
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          placement={isDesktop ? "inset" : "edge"}
          size="md"
          spacing="flush"
          elevation="flat"
        >
          <form
            onSubmit={handleCreate}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            aria-busy={pending}
          >
            <SheetHeader
              icon={WalletCards}
              title="Tạo ví mới"
              description="Thiết lập ví tiền mặt, tài khoản ngân hàng hoặc quỹ chi tiêu."
            />

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 md:p-5">
              <div className="space-y-3.5">
                <Input
                  label="Tên ví"
                  id="create-name"
                  name="name"
                  required
                  maxLength={120}
                  placeholder="Tiền mặt, Techcombank, Quỹ sinh hoạt..."
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
                  className="min-h-[4.25rem] w-full resize-none"
                />
              </div>

              <div className="space-y-3.5 border-t border-[var(--border)] pt-4">
                <MoneyInput
                  label={`Số dư ban đầu (${workspace.currency})`}
                  id="create-funding-amount"
                  name="fundingAmount"
                  value={createFundingAmount}
                  onValueChange={setCreateFundingAmount}
                />

                {hasInitialFunding && (
                  <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5">
                    <p className="text-xs font-medium text-[var(--text-secondary)]">
                      Nguồn số dư ban đầu
                    </p>
                    <div
                      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                      role="radiogroup"
                      aria-label="Nguồn số dư ban đầu"
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={createFundingType === "income"}
                        onClick={() => setCreateFundingType("income")}
                        className="flex cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition-colors aria-checked:border-[var(--primary)] aria-checked:bg-[var(--primary-soft)]"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--surface-secondary)] text-[var(--primary)]"
                            aria-hidden="true"
                          >
                            <TrendingUp size={14} />
                          </span>
                          <div className="min-w-0">
                            <strong className="block text-xs font-semibold text-[var(--foreground)]">
                              Tiền có sẵn
                            </strong>
                            <small className="block text-[11px] text-[var(--text-muted)]">
                              Tạo khoản thu ban đầu
                            </small>
                          </div>
                        </div>
                        <i
                          className={cn(
                            "size-3.5 shrink-0 rounded-full border border-[var(--border-strong)]",
                            createFundingType === "income" &&
                              "border-[var(--primary)] bg-[var(--primary)]",
                          )}
                          aria-hidden="true"
                        />
                      </button>

                      <button
                        type="button"
                        role="radio"
                        aria-checked={createFundingType === "transfer"}
                        disabled={activeWallets.length === 0}
                        onClick={() => {
                          setCreateFundingType("transfer");
                          if (!createFundingWalletId) {
                            setCreateFundingWalletId(
                              activeWallets[0]?.id ?? "",
                            );
                          }
                        }}
                        className="flex cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition-colors aria-checked:border-[var(--primary)] aria-checked:bg-[var(--primary-soft)] disabled:opacity-50"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--surface-secondary)] text-[var(--primary)]"
                            aria-hidden="true"
                          >
                            <Landmark size={14} />
                          </span>
                          <div className="min-w-0">
                            <strong className="block text-xs font-semibold text-[var(--foreground)]">
                              Chuyển từ ví khác
                            </strong>
                            <small className="block text-[11px] text-[var(--text-muted)]">
                              Trừ từ ví đang có
                            </small>
                          </div>
                        </div>
                        <i
                          className={cn(
                            "size-3.5 shrink-0 rounded-full border border-[var(--border-strong)]",
                            createFundingType === "transfer" &&
                              "border-[var(--primary)] bg-[var(--primary)]",
                          )}
                          aria-hidden="true"
                        />
                      </button>
                    </div>

                    {createFundingType === "transfer" && (
                      <Select
                        value={createFundingWalletId}
                        onValueChange={setCreateFundingWalletId}
                        label="Ví chuyển tiền"
                        placeholder="Chọn ví nguồn"
                        className="w-full"
                        options={activeWallets.map((wallet) => ({
                          value: wallet.id,
                          label: `${wallet.name} · ${formatAmount(wallet.currentBalance)} ${workspace.currency}`,
                        }))}
                      />
                    )}

                    <p className="flex items-start gap-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
                      <ArrowLeftRight
                        size={13}
                        className="mt-0.5 shrink-0 text-[var(--primary)]"
                      />
                      <span>
                        {createFundingType === "income"
                          ? "Tự động tạo một giao dịch thu cho số dư ban đầu."
                          : "Tự động chuyển tiền từ ví đã chọn sang ví mới."}
                      </span>
                    </p>
                  </div>
                )}
              </div>
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

      {/* Sheet 2: Chỉnh sửa ví */}
      <Sheet
        open={editingWallet !== null}
        onOpenChange={(open) => {
          if (!open) setEditingWallet(null);
        }}
      >
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          placement={isDesktop ? "inset" : "edge"}
          size="md"
          spacing="flush"
          elevation="flat"
        >
          <SheetHeader
            icon={Pencil}
            title="Chỉnh sửa ví"
            description={
              editingWallet
                ? `${editingWallet.kind === "credit_card" ? "Thẻ tín dụng" : "Ví thanh toán"} · ${editingWallet.transactionCount} giao dịch đã ghi nhận`
                : "Cập nhật thông tin ví"
            }
          />

          {editingWallet && (
            <form
              onSubmit={handleUpdate}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              aria-busy={pending}
            >
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 md:p-5">
                {/* 1. Compact Luxury Balance & Status Snapshot */}
                <section
                  aria-label="Tóm tắt số dư ví"
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {(() => {
                        const editBalDec = new Decimal(
                          editingWallet.currentBalance,
                        );
                        const isCreditEdit =
                          editingWallet.kind === "credit_card";
                        return (
                          <>
                            <span className="block text-[11px] font-medium text-[var(--text-muted)]">
                              {isCreditEdit
                                ? editBalDec.lt(0)
                                  ? "Số dư nộp thừa"
                                  : "Dư nợ hiện tại"
                                : "Số dư hiện tại"}
                            </span>
                            <div className="mt-0.5 flex flex-wrap items-baseline gap-1">
                              <strong
                                className={cn(
                                  "text-lg font-bold tracking-tight tabular-nums",
                                  isCreditEdit
                                    ? editBalDec.lt(0)
                                      ? "text-[var(--success)]"
                                      : editBalDec.gt(0)
                                        ? "text-rose-600 dark:text-rose-400"
                                        : "text-[var(--foreground)]"
                                    : editBalDec.lt(0)
                                      ? "text-[var(--destructive)]"
                                      : "text-[var(--foreground)]",
                                )}
                              >
                                {isCreditEdit
                                  ? editBalDec.lt(0)
                                    ? `+${formatAmount(editBalDec.abs())}`
                                    : formatAmount(
                                        Decimal.max(editBalDec, new Decimal(0)),
                                      )
                                  : formatAmount(editBalDec)}
                              </strong>
                              <span className="shrink-0 text-[11px] font-semibold uppercase text-[var(--text-muted)]">
                                {workspace.currency}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                        editingWallet.status === "active"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-[var(--surface)] text-[var(--text-muted)]",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          editingWallet.status === "active"
                            ? "bg-emerald-500"
                            : "bg-[var(--text-muted)]",
                        )}
                        aria-hidden="true"
                      />
                      {editingWallet.status === "active"
                        ? "Hoạt động"
                        : "Tạm ngưng"}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-2.5 text-xs">
                    <div className="min-w-0">
                      <span className="block text-[11px] text-[var(--text-muted)]">
                        {editingWallet.kind === "credit_card"
                          ? "Dư nợ ban đầu"
                          : "Số dư ban đầu"}
                      </span>
                      <strong className="mt-0.5 block font-semibold tabular-nums text-[var(--foreground)]">
                        {formatAmount(editingWallet.openingBalance)}{" "}
                        {workspace.currency}
                      </strong>
                    </div>

                    <div className="min-w-0 border-l border-[var(--border)] pl-3">
                      <span className="block text-[11px] text-[var(--text-muted)]">
                        {editingWallet.kind === "credit_card"
                          ? "Biến động dư nợ"
                          : "Chênh lệch thu chi"}
                      </span>
                      {(() => {
                        const netDiff = new Decimal(
                          editingWallet.currentBalance,
                        ).minus(editingWallet.openingBalance);
                        const isCreditEdit =
                          editingWallet.kind === "credit_card";
                        return (
                          <strong
                            className={cn(
                              "mt-0.5 block font-semibold tabular-nums",
                              isCreditEdit
                                ? netDiff.gt(0)
                                  ? "text-[var(--destructive)]"
                                  : netDiff.lt(0)
                                    ? "text-[var(--success)]"
                                    : "text-[var(--foreground)]"
                                : netDiff.gt(0)
                                  ? "text-[var(--success)]"
                                  : netDiff.lt(0)
                                    ? "text-[var(--destructive)]"
                                    : "text-[var(--foreground)]",
                            )}
                          >
                            {`${netDiff.gt(0) ? "+" : netDiff.lt(0) ? "-" : ""}${formatAmount(netDiff.abs())} ${workspace.currency}`}
                          </strong>
                        );
                      })()}
                    </div>
                  </div>
                </section>

                {/* 2. Form Fields */}
                <div className="space-y-3.5">
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
                    className="min-h-[4.25rem] w-full resize-none"
                  />
                </div>

                {/* 3. Compact Status / Danger Action Bar */}
                {isAdmin &&
                  (editingWallet.kind === "credit_card" ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[var(--foreground)]">
                          Quản lý thẻ tín dụng
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Thiết lập hạn mức, kỳ sao kê hoặc xóa thẻ tại trang chi tiết thẻ
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const target = editingWallet;
                          setEditingWallet(null);
                          router.push(`/credit-cards/${target.id}`);
                        }}
                      >
                        <CreditCard size={14} />
                        <span>Mở trang thẻ tín dụng</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[var(--foreground)]">
                          {editingWallet.status === "active"
                            ? "Tạm ngưng sử dụng ví"
                            : "Quản lý trạng thái ví"}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {editingWallet.status === "active"
                            ? "Ngừng nhận giao dịch mới, giữ nguyên số dư"
                            : "Kích hoạt lại hoặc xóa ví khỏi danh sách"}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          type="button"
                          variant={
                            editingWallet.status === "active"
                              ? "warning"
                              : "outline"
                          }
                          size="sm"
                          disabled={pending}
                          onClick={() => {
                            const target = editingWallet;
                            setEditingWallet(null);
                            if (target.status === "active") {
                              requestDestructiveOperation(target, "deactivate");
                            } else {
                              activateWallet(target);
                            }
                          }}
                        >
                          {editingWallet.status === "active" ? (
                            <PauseCircle size={14} />
                          ) : (
                            <PlayCircle size={14} />
                          )}
                          <span>
                            {editingWallet.status === "active"
                              ? "Tạm ngưng ví"
                              : "Kích hoạt lại"}
                          </span>
                        </Button>

                        {editingWallet.status !== "active" && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={pending}
                            onClick={() => {
                              const target = editingWallet;
                              setEditingWallet(null);
                              requestDestructiveOperation(target, "delete");
                            }}
                          >
                            <Trash2 size={14} />
                            <span>Xóa ví</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
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

      {/* Sheet 3: Chi tiết số dư ví (Progressive Disclosure) */}
      <Sheet
        open={detailWallet !== null}
        onOpenChange={(open) => {
          if (!open) setDetailWallet(null);
        }}
      >
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          placement={isDesktop ? "inset" : "edge"}
          size="md"
          spacing="flush"
          elevation="flat"
        >
          {detailWallet && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <SheetHeader
                icon={WalletCards}
                title={detailWallet.name}
                description={
                  detailWallet.kind === "credit_card"
                    ? "Thông tin số dư và biến động của thẻ."
                    : "Thông tin số dư và khoản chờ trả thẻ của ví."
                }
              />

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 md:p-5">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4">
                  {(() => {
                    const detailBalDec = new Decimal(
                      detailWallet.currentBalance,
                    );
                    const isCreditDetail =
                      detailWallet.kind === "credit_card";
                    return (
                      <>
                        <span className="block text-xs font-medium text-[var(--text-secondary)]">
                          {isCreditDetail
                            ? detailBalDec.lt(0)
                              ? "Số dư nộp thừa"
                              : "Dư nợ hiện tại"
                            : "Số dư hiện tại"}
                        </span>
                        <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
                          <strong
                            className={cn(
                              "text-2xl font-bold tabular-nums",
                              isCreditDetail
                                ? detailBalDec.lt(0)
                                  ? "text-[var(--success)]"
                                  : detailBalDec.gt(0)
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "text-[var(--foreground)]"
                                : detailBalDec.lt(0)
                                  ? "text-[var(--destructive)]"
                                  : "text-[var(--foreground)]",
                            )}
                          >
                            {isCreditDetail
                              ? detailBalDec.lt(0)
                                ? `+${formatAmount(detailBalDec.abs())}`
                                : formatAmount(
                                    Decimal.max(detailBalDec, new Decimal(0)),
                                  )
                              : formatAmount(detailBalDec)}
                          </strong>
                          <span className="shrink-0 text-xs font-semibold uppercase text-[var(--text-muted)]">
                            {workspace.currency}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-xs">
                  {detailWallet.kind !== "credit_card" && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = detailWallet.id;
                        setDetailWallet(null);
                        openReservedBreakdown(targetId);
                      }}
                      className="group/detail-reserved -mx-4 flex w-[calc(100%+2rem)] cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                    >
                      <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] group-hover/detail-reserved:text-[var(--foreground)]">
                        <span>Tiền chờ thanh toán thẻ</span>
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-[var(--primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--primary)]">
                          Xem chi tiết
                          <ArrowUpRight size={11} aria-hidden="true" />
                        </span>
                      </span>
                      <strong className="font-semibold tabular-nums text-[var(--warning)] underline-offset-2 group-hover/detail-reserved:underline">
                        {formatAmount(detailWallet.reservedBalance ?? "0")}{" "}
                        {workspace.currency}
                      </strong>
                    </button>
                  )}
                  <div className="flex items-center justify-between gap-3 py-3">
                    <span className="text-[var(--text-secondary)]">
                      {detailWallet.kind === "credit_card"
                        ? "Dư nợ ban đầu"
                        : "Số dư ban đầu"}
                    </span>
                    <strong className="font-semibold tabular-nums text-[var(--foreground)]">
                      {formatAmount(detailWallet.openingBalance)}{" "}
                      {workspace.currency}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-3">
                    <span className="text-[var(--text-secondary)]">
                      {detailWallet.kind === "credit_card"
                        ? "Biến động dư nợ"
                        : "Chênh lệch thu chi"}
                    </span>
                    {(() => {
                      const netDiff = new Decimal(
                        detailWallet.currentBalance,
                      ).minus(detailWallet.openingBalance);
                      const isCreditDetail =
                        detailWallet.kind === "credit_card";
                      return (
                        <strong
                          className={cn(
                            "font-semibold tabular-nums",
                            isCreditDetail
                              ? netDiff.gt(0)
                                ? "text-[var(--destructive)]"
                                : netDiff.lt(0)
                                  ? "text-[var(--success)]"
                                  : "text-[var(--foreground)]"
                              : netDiff.gt(0)
                                ? "text-[var(--success)]"
                                : netDiff.lt(0)
                                  ? "text-[var(--destructive)]"
                                  : "text-[var(--foreground)]",
                          )}
                        >
                          {`${netDiff.gt(0) ? "+" : netDiff.lt(0) ? "-" : ""}${formatAmount(netDiff.abs())} ${workspace.currency}`}
                        </strong>
                      );
                    })()}
                  </div>
                  <div className="flex items-center justify-between gap-3 py-3">
                    <span className="text-[var(--text-secondary)]">
                      Tổng số giao dịch
                    </span>
                    <strong className="font-semibold tabular-nums text-[var(--foreground)]">
                      {detailWallet.transactionCount} giao dịch
                    </strong>
                  </div>
                </div>

                {detailWallet.description && (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5 text-xs text-[var(--text-secondary)]">
                    <span className="block font-semibold text-[var(--foreground)]">
                      Ghi chú
                    </span>
                    <p className="mt-1 leading-relaxed">
                      {detailWallet.description}
                    </p>
                  </div>
                )}
              </div>

              <SheetFooter
                onCancel={() => setDetailWallet(null)}
                cancelLabel="Đóng"
                submitLabel={
                  isAdmin
                    ? "Chỉnh sửa ví"
                    : detailWallet.kind === "credit_card"
                      ? "Xem thẻ tín dụng"
                      : undefined
                }
                submitType="button"
                onSubmit={() => {
                  const target = detailWallet;
                  setDetailWallet(null);
                  if (isAdmin) {
                    setEditingWallet(target);
                  } else if (target.kind === "credit_card") {
                    router.push(`/credit-cards/${target.id}`);
                  }
                }}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet 4: Chi tiết Tiền chờ thanh toán thẻ (Reserved Breakdown Sheet) */}
      <Sheet
        open={reservedBreakdownOpen}
        onOpenChange={handleReservedBreakdownOpenChange}
      >
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          placement={isDesktop ? "inset" : "edge"}
          size="md"
          spacing="flush"
          elevation="flat"
        >
          {(() => {
            const selectedWallet =
              selectedReservedWalletId !== "all"
                ? wallets.find(
                    (w) =>
                      w.id === selectedReservedWalletId &&
                      w.kind !== "credit_card",
                  ) ?? null
                : null;

            const filteredCommitments = commitmentDetails.filter((item) =>
              selectedWallet ? item.fundingWalletId === selectedWallet.id : true,
            );
            const activeItems = filteredCommitments.filter(
              (item) => !item.cardDeleted && item.cardStatus === "active",
            );

            const byCardMap = new Map<
              string,
              {
                cardWalletId: string;
                cardName: string;
                totalRemaining: Decimal;
                items: CreditCardCommitmentDetailItem[];
              }
            >();
            for (const item of activeItems) {
              const prev = byCardMap.get(item.cardWalletId) ?? {
                cardWalletId: item.cardWalletId,
                cardName: item.cardName,
                totalRemaining: new Decimal(0),
                items: [],
              };
              prev.totalRemaining = prev.totalRemaining.plus(
                item.remainingAmount,
              );
              prev.items.push(item);
              byCardMap.set(item.cardWalletId, prev);
            }
            const cardGroups = [...byCardMap.values()].filter(
              (c) => c.items.length > 0,
            );

            const summaryActualBalance = selectedWallet
              ? new Decimal(selectedWallet.currentBalance)
              : totalAssetBalance;
            const summaryReservedBalance = activeItems.reduce(
              (sum, item) => sum.plus(new Decimal(item.remainingAmount)),
              new Decimal(0),
            );
            const summaryUsableBalance =
              summaryActualBalance.minus(summaryReservedBalance);

            function getObligationPresentation(
              item: CreditCardCommitmentDetailItem,
            ) {
              if (item.kind === "opening_debt") {
                return {
                  title: "Dư nợ lúc tạo thẻ",
                  badge: "Dư nợ đầu kỳ",
                  badgeClass:
                    "bg-[color-mix(in_srgb,var(--warning)_15%,var(--surface))] text-[var(--warning)]",
                };
              }
              if (item.installmentPlan?.origin === "imported") {
                return {
                  title:
                    item.installmentPlan.description ||
                    "Trả góp có sẵn",
                  badge: `Trả góp ${item.installmentPlan.termCount} kỳ`,
                  badgeClass:
                    "bg-[color-mix(in_srgb,var(--warning)_15%,var(--surface))] text-[var(--warning)]",
                };
              }
              if (item.installmentPlan?.origin === "transaction") {
                return {
                  title:
                    item.transactionDescription ||
                    item.installmentPlan.description ||
                    "Giao dịch trả góp",
                  badge: `Trả góp ${item.installmentPlan.termCount} kỳ`,
                  badgeClass:
                    "bg-[var(--primary-soft)] text-[var(--primary)]",
                };
              }
              if (item.transactionPurpose === "credit_card_installment_fee") {
                return {
                  title:
                    item.transactionDescription || "Phí chuyển đổi trả góp",
                  badge: "Phí trả góp",
                  badgeClass:
                    "bg-[var(--surface-secondary)] text-[var(--text-secondary)]",
                };
              }
              if (
                item.kind === "purchase" &&
                item.transactionType === "transfer"
              ) {
                return {
                  title:
                    item.transactionDescription ||
                    "Chuyển tiền từ thẻ tín dụng",
                  badge: "Chuyển tiền",
                  badgeClass:
                    "bg-[var(--primary-soft)] text-[var(--primary)]",
                };
              }
              if (item.kind === "refund") {
                return {
                  title:
                    item.transactionDescription || "Hoàn tiền thẻ tín dụng",
                  badge: "Hoàn tiền",
                  badgeClass:
                    "bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))] text-[var(--success)]",
                };
              }
              if (item.kind === "adjustment") {
                return {
                  title: item.transactionDescription || "Điều chỉnh dư nợ thẻ",
                  badge: "Điều chỉnh",
                  badgeClass:
                    "bg-[var(--surface-secondary)] text-[var(--text-secondary)]",
                };
              }
              return {
                title:
                  item.transactionDescription ||
                  item.categoryName ||
                  "Giao dịch chi tiêu thẻ",
                badge: "Chi tiêu",
                badgeClass:
                  "bg-[var(--surface-secondary)] text-[var(--text-secondary)]",
              };
            }

            return (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <SheetHeader
                  icon={CreditCard}
                  title={
                    selectedWallet
                      ? `Chờ thanh toán thẻ · ${selectedWallet.name}`
                      : "Tiền chờ thanh toán thẻ"
                  }
                  description="Các khoản chi thẻ tín dụng sẽ trích từ ví này khi thanh toán sao kê."
                />

                <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain p-4 md:p-5">
                  {/* Horizontal Filter Pills by Asset Wallet */}
                  {assetWallets.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                      <button
                        type="button"
                        onClick={() => setSelectedReservedWalletId("all")}
                        className={cn(
                          "shrink-0 cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          !selectedWallet
                            ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                            : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
                        )}
                      >
                        Tất cả ({assetWallets.length})
                      </button>
                      {assetWallets.map((w) => {
                        const wReserved = new Decimal(w.reservedBalance ?? 0);
                        const active = selectedWallet?.id === w.id;
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => setSelectedReservedWalletId(w.id)}
                            className={cn(
                              "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                              active
                                ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                                : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
                            )}
                          >
                            <span>{w.name}</span>
                            {wReserved.gt(0) && (
                              <span className="text-[11px] font-semibold tabular-nums text-[var(--warning)]">
                                {formatAmount(wReserved)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Compact Luxury Balance Snapshot */}
                  <section
                    aria-label="Tóm tắt tiền chờ thanh toán thẻ"
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="block text-[11px] font-medium text-[var(--text-muted)]">
                          {selectedWallet
                            ? `Chờ thanh toán từ ví ${selectedWallet.name}`
                            : "Tổng tiền chờ thanh toán thẻ"}
                        </span>
                        <div className="mt-0.5 flex flex-wrap items-baseline gap-1">
                          <strong className="text-lg font-bold tracking-tight tabular-nums text-[var(--warning)]">
                            {summaryReservedBalance.gt(0) ? "-" : ""}
                            {formatAmount(summaryReservedBalance)}
                          </strong>
                          <span className="shrink-0 text-[11px] font-semibold uppercase text-[var(--text-muted)]">
                            {workspace.currency}
                          </span>
                        </div>
                      </div>

                      <span className="inline-flex shrink-0 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                        {activeItems.length} khoản mục
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-2.5 text-xs">
                      <div className="min-w-0">
                        <span className="block text-[11px] text-[var(--text-muted)]">
                          {selectedWallet
                            ? "Số dư hiện tại"
                            : "Tổng số dư hiện tại"}
                        </span>
                        <strong className="mt-0.5 block whitespace-nowrap font-semibold tabular-nums text-[var(--foreground)]">
                          {formatAmount(summaryActualBalance)}{" "}
                          {workspace.currency}
                        </strong>
                      </div>

                      <div className="min-w-0 border-l border-[var(--border)] pl-3">
                        <span className="block text-[11px] text-[var(--text-muted)]">
                          Số dư khả dụng
                        </span>
                        <strong
                          className={cn(
                            "mt-0.5 block whitespace-nowrap font-semibold tabular-nums",
                            summaryUsableBalance.lt(0)
                              ? "text-[var(--destructive)]"
                              : "text-[var(--primary)]",
                          )}
                        >
                          {formatAmount(summaryUsableBalance)}{" "}
                          {workspace.currency}
                        </strong>
                      </div>
                    </div>
                  </section>

                  {/* Unified Credit Card Groups & Compact Obligation Rows */}
                  {cardGroups.length > 0 ? (
                    <div className="space-y-3">
                      {cardGroups.map((group) => (
                        <div
                          key={group.cardWalletId}
                          className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
                        >
                          {/* Card Group Header */}
                          <div className="flex items-center justify-between gap-2.5 border-b border-[var(--border)] bg-[var(--surface-secondary)] px-3.5 py-2.5">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                <CreditCard size={14} />
                              </span>
                              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <span className="text-xs font-semibold text-[var(--foreground)]">
                                  Thẻ {group.cardName}
                                </span>
                                <span className="text-[10px] text-[var(--text-muted)]">
                                  ·
                                </span>
                                <Link
                                  href={`/credit-cards/${group.cardWalletId}`}
                                  onClick={() =>
                                    setReservedBreakdownOpen(false)
                                  }
                                  className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[var(--primary)] hover:underline"
                                >
                                  <span>Mở thẻ</span>
                                  <ArrowUpRight size={10} aria-hidden="true" />
                                </Link>
                              </div>
                            </div>

                            <strong className="shrink-0 whitespace-nowrap text-xs font-bold tabular-nums text-[var(--warning)]">
                              {formatAmount(
                                Decimal.max(
                                  group.totalRemaining,
                                  new Decimal(0),
                                ),
                              )}{" "}
                              {workspace.currency}
                            </strong>
                          </div>

                          {/* Compact Ledger Items */}
                          <div className="divide-y divide-[var(--border)]">
                            {group.items.map((item) => {
                              const meta = getObligationPresentation(item);
                              const remainingDec = new Decimal(
                                item.remainingAmount,
                              );
                              const originalDec = new Decimal(
                                item.originalAmount,
                              );
                              const paidDec = new Decimal(item.paidAmount);
                              const isNegative = remainingDec.lt(0);

                              const subtextParts: string[] = [
                                formatDateVi(item.effectiveDate),
                              ];
                              if (!selectedWallet) {
                                subtextParts.push(
                                  `Ví ${item.fundingWalletName}`,
                                );
                              }
                              if (item.categoryName) {
                                subtextParts.push(item.categoryName);
                              } else if (item.kind === "opening_debt") {
                                subtextParts.push("Dư nợ lúc tạo thẻ");
                              } else if (
                                item.installmentPlan?.origin === "imported"
                              ) {
                                subtextParts.push("Trả góp có sẵn");
                              }

                              return (
                                <div
                                  key={item.id}
                                  className="space-y-1 px-3.5 py-2.5 text-xs"
                                >
                                  <div className="flex items-start justify-between gap-2.5">
                                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                      <span className="break-words font-semibold leading-snug text-[var(--foreground)]">
                                        {meta.title}
                                      </span>
                                      <span
                                        className={cn(
                                          "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
                                          meta.badgeClass,
                                        )}
                                      >
                                        {meta.badge}
                                      </span>
                                    </div>

                                    <strong
                                      className={cn(
                                        "shrink-0 whitespace-nowrap font-bold tabular-nums",
                                        isNegative
                                          ? "text-[var(--success)]"
                                          : "text-[var(--foreground)]",
                                      )}
                                    >
                                      {formatAmount(remainingDec)}{" "}
                                      {workspace.currency}
                                    </strong>
                                  </div>

                                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px] text-[var(--text-muted)]">
                                    <span>{subtextParts.join(" · ")}</span>

                                    {!item.statement ? (
                                      <span>Chưa lên sao kê</span>
                                    ) : item.statement.status === "issued" ? (
                                      <Link
                                        href={`/credit-cards/${item.cardWalletId}/statements/${item.statement.id}`}
                                        onClick={() =>
                                          setReservedBreakdownOpen(false)
                                        }
                                        className="inline-flex items-center gap-0.5 font-medium text-[var(--warning)] hover:underline"
                                      >
                                        <span>
                                          Sao kê{" "}
                                          {formatDateVi(
                                            item.statement.cycleEndDate,
                                          ).slice(0, 5)}{" "}
                                          (Hạn{" "}
                                          {formatDateVi(
                                            item.statement.dueDate,
                                          ).slice(0, 5)}
                                          )
                                        </span>
                                        <ArrowUpRight
                                          size={10}
                                          aria-hidden="true"
                                        />
                                      </Link>
                                    ) : !item.statement.paidAt ? (
                                      <span className="text-[var(--warning)]">
                                        Đã gộp sang kỳ sau
                                      </span>
                                    ) : (
                                      <span className="text-[var(--success)]">
                                        Đã tất toán
                                      </span>
                                    )}
                                  </div>

                                  {paidDec.gt(0) && (
                                    <p className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                                      Gốc {formatAmount(originalDec)} · Đã trả{" "}
                                      <span className="font-medium text-[var(--success)]">
                                        {formatAmount(paidDec)}{" "}
                                        {workspace.currency}
                                      </span>
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-5 text-center text-xs text-[var(--text-muted)]">
                      {selectedWallet
                        ? `Ví “${selectedWallet.name}” hiện không có khoản tiền chờ thanh toán thẻ nào.`
                        : "Hiện không có khoản tiền chờ thanh toán thẻ nào."}
                    </div>
                  )}
                </div>

                <SheetFooter
                  onCancel={() => handleReservedBreakdownOpenChange(false)}
                  cancelLabel="Đóng"
                  submitLabel={
                    creditWallets.length > 0
                      ? "Quản lý thẻ tín dụng"
                      : undefined
                  }
                  submitType="button"
                  onSubmit={() => {
                    handleReservedBreakdownOpenChange(false);
                    router.push("/credit-cards");
                  }}
                />
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Sheet 5: Chặn xóa/tạm ngưng do lịch định kỳ */}
      <Sheet
        open={blockedOperation !== null}
        onOpenChange={(open) => {
          if (!open) setBlockedOperation(null);
        }}
      >
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          placement={isDesktop ? "inset" : "edge"}
          size="md"
          spacing="flush"
          elevation="flat"
        >
          {blockedOperation && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <SheetHeader
                icon={AlertTriangle}
                title={`Không thể ${blockedOperation.kind === "delete" ? "xóa" : "tạm ngưng"} ví`}
                description={`Ví “${blockedOperation.wallet.name}” đang có ${blockedOperation.wallet.recurringTransactionCount} giao dịch định kỳ.`}
              />

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 md:p-5">
                <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--warning)_10%,var(--surface))] p-4 text-xs leading-relaxed text-[var(--text-secondary)]">
                  Hãy chuyển các lịch định kỳ này sang ví khác hoặc xóa trước khi thực hiện. Lịch sử giao dịch cũ vẫn được giữ nguyên.
                </div>
              </div>

              <SheetFooter
                onCancel={() => setBlockedOperation(null)}
                cancelLabel="Đóng"
                submitLabel="Mở Giao dịch định kỳ"
                submitType="button"
                onSubmit={() => {
                  setBlockedOperation(null);
                  setEditingWallet(null);
                  router.push("/recurring-transactions");
                }}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet 6: Xác nhận Tạm ngưng / Tất toán & Xóa ví */}
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
          side={isDesktop ? "right" : "bottom"}
          placement={isDesktop ? "inset" : "edge"}
          size="md"
          spacing="flush"
          elevation="flat"
        >
          {confirmOperation && showDeactivateSheet ? (
            <WalletDeactivateSheet
              wallet={confirmOperation.wallet}
              currency={workspace.currency}
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
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <SheetHeader
                icon={
                  confirmOperation.kind === "delete" ? Trash2 : PauseCircle
                }
                title={
                  confirmOperation.kind === "delete"
                    ? "Xóa ví?"
                    : "Tạm ngưng ví?"
                }
                description={
                  confirmOperation.kind === "delete"
                    ? "Lịch sử giao dịch của ví vẫn được giữ lại an toàn."
                    : "Bạn có thể kích hoạt lại ví bất cứ lúc nào."
                }
              />

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 md:p-5">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4">
                  <div className="min-w-0">
                    <span className="block break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                      {confirmOperation.wallet.name}
                    </span>
                    <small className="mt-0.5 block text-xs text-[var(--text-muted)]">
                      {confirmOperation.kind === "delete"
                        ? "Ví sẽ được ẩn khỏi danh sách"
                        : "Ví sẽ ngừng nhận giao dịch mới"}
                    </small>
                  </div>
                  <strong className="shrink-0 text-sm font-bold tabular-nums text-[var(--foreground)]">
                    {formatAmount(confirmOperation.wallet.currentBalance)}{" "}
                    {workspace.currency}
                  </strong>
                </div>

                {confirmOperation.kind === "delete" && (
                  <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-[var(--text-secondary)]">
                        Số dư cần tất toán
                      </span>
                      <strong
                        data-required={requiresSettlement || undefined}
                        className={cn(
                          "font-semibold",
                          requiresSettlement
                            ? "text-[var(--warning)]"
                            : "text-[var(--success)]",
                        )}
                      >
                        {requiresSettlement ? "Cần xử lý" : "Đã bằng 0"}
                      </strong>
                    </div>
                    {requiresSettlement ? (
                      <div className="space-y-3 pt-1">
                        <p className="flex items-start gap-2 text-xs leading-5 text-[var(--text-secondary)]">
                          <ArrowLeftRight
                            size={14}
                            className="mt-0.5 shrink-0 text-[var(--primary)]"
                            aria-hidden="true"
                          />
                          <span>
                            {confirmedBalance.isPositive()
                              ? `Chuyển ${formatAmount(confirmedBalance)} ${workspace.currency} sang ví khác trước khi xóa.`
                              : `Chuyển ${formatAmount(confirmedBalance.abs())} ${workspace.currency} từ ví khác để đưa số dư về 0.`}
                          </span>
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
                          <p className="text-xs text-[var(--destructive)]">
                            Không có ví đang hoạt động để tất toán. Hãy tạo hoặc
                            kích hoạt một ví khác trước khi xóa.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--text-muted)]">
                        Không cần tạo giao dịch tất toán.
                      </p>
                    )}
                  </section>
                )}
              </div>

              <SheetFooter className="flex-row justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 md:flex-none"
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
                  variant="destructive"
                  className="flex-1 md:flex-none"
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
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
