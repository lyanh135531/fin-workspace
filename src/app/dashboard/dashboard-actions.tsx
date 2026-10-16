"use client";

import {
  addTransactionAction,
  approveTransactionAction,
  deleteTransactionAction,
  deleteTransactionsAction,
  rejectTransactionAction,
  reviewTransactionChangeAction,
  updateTransactionsAction,
} from "@/app/dashboard/actions";
import {
  getCategoryFilterIds,
  getMonthDateRange,
  isDateInRange,
} from "@/app/dashboard/dashboard-ledger-filters";
import { DesktopTransactionCreatePopoverContent } from "@/app/dashboard/desktop-transaction-create-draft";
import type { DateRangeValue } from "@/components/base";
import {
  Button,
  CategoryIcon,
  CategoryTreeSelect,
  Checkbox,
  DatePicker,
  DateRangePicker,
  Empty,
  Input,
  MoneyInput,
  Popover,
  PopoverTrigger,
  Search,
  Select,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTrigger,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/base";
import {
  getMobileLedgerActions,
  useLongPress,
} from "@/app/dashboard/mobile-ledger-interactions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SpotlightTrigger } from "@/components/ui/spotlight-trigger";
import { Textarea } from "@/components/ui/textarea";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import Decimal from "decimal.js";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheckBig,
  CreditCard,
  FilterX,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

type Option = {
  id: string;
  name: string;
  kind?: "asset" | "credit_card";
  defaultFundingWalletId?: string | null;
  color?: string;
  icon?: string | null;
  parentId?: string | null;
};

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
  category: { name: string; color: string; icon: string | null } | null;
  member: string;
  canRequestEdit: boolean;
  canRequestDelete: boolean;
  hasPendingChange: boolean;
  pendingChangeRequestId: string | null;
  pendingChangeAction: "update" | "delete" | null;
  pendingChangeRequester: string | null;
  pendingChangeReason: string | null;
  pendingChangeDetails: {
    label: string;
    previous: string;
    proposed: string;
  }[];
  isRecurring: boolean;
  allocations?: { walletId: string; amount: string }[];
};

type TransactionDraft = {
  description: string;
  type: TransactionType;
  categoryId: string;
  walletId: string;
  toWalletId: string;
  date: string;
  amount: string;
  allocations: { walletId: string; amount: string }[];
};

type LedgerDateTotals = {
  income: Decimal;
  expense: Decimal;
};

const transactionTypeTabs = [
  { value: "expense", label: "Chi tiêu", icon: ArrowUpRight },
  { value: "income", label: "Thu nhập", icon: ArrowDownLeft },
  { value: "transfer", label: "Chuyển khoản", icon: ArrowLeftRight },
] satisfies {
  value: TransactionType;
  label: string;
  icon: typeof ArrowUpRight;
}[];

const filterTypeOptions = [
  { value: "all", label: "Tất cả loại" },
  { value: "expense", label: "Chi tiêu" },
  { value: "income", label: "Thu nhập" },
  { value: "transfer", label: "Chuyển khoản" },
];

function defaultDestination(wallets: Option[], sourceId: string) {
  return (
    wallets.find(
      (wallet) => wallet.kind !== "credit_card" && wallet.id !== sourceId,
    )?.id ?? sourceId
  );
}

function categoriesForTransactionType(
  categories: CategoryOption[],
  type: TransactionType,
): CategoryOption[] {
  return type === "transfer"
    ? []
    : categories.filter((category) => category.type === type);
}

function newTransactionDraft(
  wallets: Option[],
  categories: CategoryOption[],
  businessDate: string,
): TransactionDraft {
  const defaultWallet =
    wallets.find((wallet) => wallet.kind !== "credit_card") ?? wallets[0];
  const walletId = defaultWallet?.id ?? "";
  const defaultFundingId =
    defaultWallet?.defaultFundingWalletId ??
    wallets.find((wallet) => wallet.kind !== "credit_card")?.id ??
    "";
  return {
    description: "",
    type: "expense",
    categoryId:
      categoriesForTransactionType(categories, "expense")[0]?.id ?? "none",
    walletId,
    toWalletId: defaultDestination(wallets, walletId),
    date: businessDate,
    amount: "",
    allocations:
      defaultWallet?.kind === "credit_card" && defaultFundingId
        ? [{ walletId: defaultFundingId, amount: "" }]
        : [],
  };
}

function draftFromTransaction(
  item: LedgerItem,
  wallets: Option[],
): TransactionDraft {
  const selectedWallet = wallets.find((w) => w.id === item.walletId);
  const isCreditCard =
    (item.type === "expense" || item.type === "transfer") &&
    selectedWallet?.kind === "credit_card";
  const defaultFundingId =
    selectedWallet?.defaultFundingWalletId ??
    wallets.find((w) => w.kind === "asset")?.id ??
    "";
  return {
    description: item.description ?? "",
    type: item.type,
    categoryId: item.categoryId ?? "none",
    walletId: item.walletId,
    toWalletId: item.toWalletId ?? defaultDestination(wallets, item.walletId),
    date: item.date.slice(0, 10),
    amount: item.amount,
    allocations:
      item.allocations && item.allocations.length > 0
        ? item.allocations
        : isCreditCard
          ? [{ walletId: defaultFundingId, amount: item.amount }]
          : [],
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
    allocations: draft.allocations.length ? draft.allocations : undefined,
  };
}

function isChanged(item: LedgerItem, draft: TransactionDraft) {
  const baseChanged =
    item.description !== (draft.description || null) ||
    item.type !== draft.type ||
    item.categoryId !==
      (draft.categoryId === "none" ? null : draft.categoryId) ||
    item.walletId !== draft.walletId ||
    item.toWalletId !== (draft.type === "transfer" ? draft.toWalletId : null) ||
    item.date.slice(0, 10) !== draft.date ||
    item.amount !== draft.amount;
  if (baseChanged) return true;
  if (draft.type === "expense" || draft.type === "transfer") {
    const itemAllocs = item.allocations ?? [];
    if (itemAllocs.length !== draft.allocations.length) return true;
    return draft.allocations.some(
      (alloc, idx) =>
        alloc.walletId !== itemAllocs[idx]?.walletId ||
        alloc.amount !== itemAllocs[idx]?.amount,
    );
  }
  return false;
}

function requiresReview(item: LedgerItem): boolean {
  return item.status === "pending" || item.pendingChangeRequestId !== null;
}

function formatLedgerDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

const dayNamesVi = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function groupTransactionsByDate<T extends { date: string }>(
  items: T[],
): { dateKey: string; label: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.date.slice(0, 10);
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.entries()].map(([dateKey, groupItems]) => {
    const [year, month, day] = dateKey.split("-");
    const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
    const dayName = dayNamesVi[dateObj.getDay()];
    return {
      dateKey,
      label: `${dayName}, ${day}/${month}/${year}`,
      items: groupItems,
    };
  });
}

function getLedgerDateTotals(items: LedgerItem[]): LedgerDateTotals {
  return items.reduce<LedgerDateTotals>(
    (totals, item) => {
      if (item.status !== "approved") return totals;
      if (item.type === "income") {
        return {
          income: totals.income.plus(item.amount),
          expense: totals.expense,
        };
      }
      if (item.type === "expense") {
        return {
          income: totals.income,
          expense: totals.expense.plus(item.amount),
        };
      }
      return totals;
    },
    { income: new Decimal(0), expense: new Decimal(0) },
  );
}

function TouchTransactionRow({
  item,
  currency,
  selected,
  selectionMode,
  canApprove,
  canEditTransactions,
  readonly,
  busy,
  onToggle,
  onOpenSheet,
  onOpenDeleteConfirm,
  onApprove,
  onReject,
}: {
  item: LedgerItem;
  currency: string;
  selected: boolean;
  selectionMode: boolean;
  canApprove: boolean;
  canEditTransactions: boolean;
  readonly: boolean;
  busy: boolean;
  onToggle: () => void;
  onOpenSheet: () => void;
  onOpenDeleteConfirm: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isIncome = item.type === "income";
  const isExpense = item.type === "expense";
  const isTransfer = item.type === "transfer";
  const amountPrefix = isIncome ? "+" : isExpense ? "−" : "↔";
  const categoryName =
    item.category?.name ?? (isTransfer ? "Chuyển khoản" : "Chưa phân loại");
  const primaryTitle = item.description || categoryName;
  const hasReviewRequest = Boolean(item.pendingChangeRequestId);
  const isDeleteRequest = item.pendingChangeAction === "delete";
  const canSelect = canApprove && !requiresReview(item);

  const actions = getMobileLedgerActions({
    canApprove: canSelect,
    canEdit: canEditTransactions && item.canRequestEdit,
    canDelete: !readonly && item.canRequestDelete,
    hasPendingChange: item.hasPendingChange,
    status: item.status,
  });

  const longPressEnabled = !selectionMode && !menuOpen && actions.length > 0;
  const { isPressing, handlers } = useLongPress(
    () => setMenuOpen(true),
    longPressEnabled,
    () => {
      if (busy) return;
      if (selectionMode && canSelect) {
        onToggle();
        return;
      }
      onOpenSheet();
    },
  );

  function run(action: () => void) {
    setMenuOpen(false);
    action();
  }

  const rowContent = (
    <>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {selectionMode && canSelect && (
          <div
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            className="mt-1.5 flex shrink-0 items-center"
          >
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggle()}
              aria-label={`Chọn giao dịch ${primaryTitle}`}
            />
          </div>
        )}

        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)]/60",
            isTransfer && "bg-[var(--primary)]/10 text-[var(--primary)]",
            !isTransfer &&
              !item.category &&
              "bg-[var(--surface-secondary)] text-[var(--text-secondary)]",
          )}
          style={
            !isTransfer && item.category
              ? {
                  backgroundColor: `${item.category.color}18`,
                  color: item.category.color,
                }
              : undefined
          }
        >
          {isTransfer ? (
            <ArrowLeftRight className="size-4" aria-hidden="true" />
          ) : (
            <CategoryIcon
              category={
                item.category ?? {
                  color: "var(--text-secondary)",
                  icon: "tag",
                }
              }
              size={17}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <strong className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
              {primaryTitle}
            </strong>

            {item.description && item.category && (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.65rem] font-medium"
                style={{
                  backgroundColor: `${item.category.color}16`,
                  color: item.category.color,
                }}
              >
                <span className="break-words leading-snug">
                  {item.category.name}
                </span>
              </span>
            )}

            {hasReviewRequest && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold",
                  isDeleteRequest
                    ? "bg-[color-mix(in_srgb,var(--danger)_14%,var(--surface))] text-[var(--danger)]"
                    : "bg-[color-mix(in_srgb,var(--warning)_14%,var(--surface))] text-[var(--warning)]",
                )}
              >
                {isDeleteRequest ? "Chờ duyệt xóa" : "Chờ duyệt sửa"}
              </span>
            )}

            {!hasReviewRequest && item.status === "pending" && (
              <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--warning)_14%,var(--surface))] px-2 py-0.5 text-[0.65rem] font-semibold text-[var(--warning)]">
                Chờ duyệt
              </span>
            )}

            {!hasReviewRequest && item.status === "scheduled" && (
              <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--info)_14%,var(--surface))] px-2 py-0.5 text-[0.65rem] font-semibold text-[var(--info)]">
                Đã lên lịch
              </span>
            )}

            {!hasReviewRequest && item.status === "rejected" && (
              <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--danger)_14%,var(--surface))] px-2 py-0.5 text-[0.65rem] font-semibold text-[var(--danger)]">
                Đã từ chối
              </span>
            )}
          </div>

          <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-muted)]">
            {/^(ví|thẻ)(\s|$)/i.test(item.wallet.trim())
              ? item.wallet
              : `Ví ${item.wallet}`}
            {item.toWallet ? ` → ${item.toWallet}` : ""}
            {item.member ? ` · ${item.member}` : ""}
            {item.isRecurring ? " · Định kỳ" : ""}
          </p>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <strong
          className={cn(
            "block whitespace-nowrap text-[0.925rem] font-bold leading-snug tabular-nums",
            isIncome && "text-[var(--income)]",
            isExpense && "text-[var(--expense)]",
            isTransfer && "text-[var(--foreground)]",
          )}
        >
          {amountPrefix}
          {formatAmount(item.amount)}{" "}
          <span className="text-[0.68rem] font-medium opacity-75">
            {currency}
          </span>
        </strong>
      </div>
    </>
  );

  if (actions.length === 0) {
    return (
      <article
        onClick={onOpenSheet}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenSheet();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`${primaryTitle}, ${amountPrefix}${formatAmount(item.amount)} ${currency}`}
        className={cn(
          "flex select-none items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors active:bg-[var(--surface-hover)] cursor-pointer md:px-5",
          selected &&
            "bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))]",
        )}
      >
        {rowContent}
      </article>
    );
  }

  return (
    <DropdownMenu
      open={!selectionMode && menuOpen}
      onOpenChange={(open) => {
        if (!open) setMenuOpen(false);
      }}
    >
      <SpotlightTrigger
        open={!selectionMode && menuOpen}
        onOpenChange={(open) => {
          if (!open) setMenuOpen(false);
        }}
        dismissLabel={`Đóng menu thao tác ${primaryTitle}`}
        render={
          <article
            role="button"
            tabIndex={0}
            data-pressing={isPressing || undefined}
            data-selected={selected || undefined}
            aria-label={`${primaryTitle}, ${amountPrefix}${formatAmount(item.amount)} ${currency}. Chạm để xem chi tiết, nhấn giữ để mở menu thao tác.`}
            className={cn(
              "flex select-none items-center justify-between gap-3 px-4 py-3.5 text-left transition-all duration-150 cursor-pointer md:px-5",
              isPressing && "scale-[0.99] bg-[var(--surface-hover)]",
              selected &&
                "bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))]",
            )}
            {...handlers}
          />
        }
      >
        {(spotlightTrigger) => (
          <DropdownMenuTrigger nativeButton={false} render={spotlightTrigger}>
            {rowContent}
          </DropdownMenuTrigger>
        )}
      </SpotlightTrigger>

      <DropdownMenuContent
        align="center"
        side="bottom"
        sideOffset={6}
        className="w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5"
      >
        {actions.includes("select") && (
          <DropdownMenuItem onClick={() => run(onToggle)} disabled={busy}>
            <Check className="size-4 text-[var(--primary)]" aria-hidden="true" />
            <span>{selected ? "Bỏ chọn giao dịch" : "Chọn nhiều giao dịch"}</span>
          </DropdownMenuItem>
        )}
        {actions.includes("approve") && (
          <DropdownMenuItem onClick={() => run(onApprove)} disabled={busy}>
            <CircleCheckBig
              className="size-4 text-[var(--success)]"
              aria-hidden="true"
            />
            <span>Duyệt giao dịch</span>
          </DropdownMenuItem>
        )}
        {actions.includes("reject") && (
          <DropdownMenuItem onClick={() => run(onReject)} disabled={busy}>
            <X className="size-4 text-[var(--danger)]" aria-hidden="true" />
            <span>Từ chối giao dịch</span>
          </DropdownMenuItem>
        )}
        {actions.includes("approve-early") && (
          <DropdownMenuItem onClick={() => run(onApprove)} disabled={busy}>
            <CircleCheckBig
              className="size-4 text-[var(--info)]"
              aria-hidden="true"
            />
            <span>Ghi nhận sớm</span>
          </DropdownMenuItem>
        )}
        {actions.includes("edit") && (
          <DropdownMenuItem onClick={() => run(onOpenSheet)} disabled={busy}>
            <Pencil className="size-4 text-[var(--text-secondary)]" aria-hidden="true" />
            <span>Xem & chỉnh sửa</span>
          </DropdownMenuItem>
        )}
        {actions.includes("delete") && (
          <>
            {actions.some((action) => action !== "delete") && (
              <DropdownMenuSeparator />
            )}
            <DropdownMenuItem
              variant="destructive"
              disabled={busy}
              onClick={() => run(onOpenDeleteConfirm)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              <span>Xóa giao dịch</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Ledger({
  workspaceId,
  businessDate,
  transactions,
  pageSize,
  canApprove,
  canEditTransactions,
  isAdmin,
  scopeLabel,
  wallets,
  categories,
  currency,
  isDesktop,
  readonly = false,
  startWithNewTransaction = false,
  dateRange: controlledDateRange,
  onDateRangeChange,
  filterCategory: controlledFilterCategory,
  onFilterCategoryChange,
  filterType: controlledFilterType,
  onFilterTypeChange,
  filterWallet: controlledFilterWallet,
  onFilterWalletChange,
  filterReviewOnly: controlledFilterReviewOnly,
  onFilterReviewOnlyChange,
  query: controlledQuery,
  onQueryChange,
  mobileFilterOpen: controlledMobileFilterOpen,
  onMobileFilterOpenChange,
}: {
  workspaceId: string;
  businessDate: string;
  transactions: LedgerItem[];
  pageSize: number;
  canApprove: boolean;
  canEditTransactions: boolean;
  isAdmin: boolean;
  scopeLabel: string;
  wallets: Option[];
  categories: CategoryOption[];
  currency: string;
  isDesktop: boolean;
  readonly?: boolean;
  startWithNewTransaction?: boolean;
  dateRange?: DateRangeValue | null;
  onDateRangeChange?: (value: DateRangeValue | null) => void;
  filterCategory?: string;
  onFilterCategoryChange?: (value: string) => void;
  filterType?: string;
  onFilterTypeChange?: (value: string) => void;
  filterWallet?: string;
  onFilterWalletChange?: (value: string) => void;
  filterReviewOnly?: boolean;
  onFilterReviewOnlyChange?: (value: boolean) => void;
  query?: string;
  onQueryChange?: (value: string) => void;
  mobileFilterOpen?: boolean;
  onMobileFilterOpenChange?: (open: boolean) => void;
}) {
  const [internalQuery, setInternalQuery] = useState("");
  const query = controlledQuery !== undefined ? controlledQuery : internalQuery;
  const setQuery = (value: string | ((prev: string) => string)) => {
    const nextValue = typeof value === "function" ? value(query) : value;
    setInternalQuery(nextValue);
    onQueryChange?.(nextValue);
  };

  const [internalDateRange, setInternalDateRange] =
    useState<DateRangeValue | null>(() => getMonthDateRange(businessDate));
  const dateRange =
    controlledDateRange !== undefined ? controlledDateRange : internalDateRange;
  const setDateRange = (
    value:
      | DateRangeValue
      | null
      | ((prev: DateRangeValue | null) => DateRangeValue | null),
  ) => {
    const nextValue = typeof value === "function" ? value(dateRange) : value;
    setInternalDateRange(nextValue);
    onDateRangeChange?.(nextValue);
  };

  const [internalFilterCategory, setInternalFilterCategory] = useState("");
  const filterCategory =
    controlledFilterCategory !== undefined
      ? controlledFilterCategory
      : internalFilterCategory;
  const setFilterCategory = (value: string | ((prev: string) => string)) => {
    const nextValue =
      typeof value === "function" ? value(filterCategory) : value;
    setInternalFilterCategory(nextValue);
    onFilterCategoryChange?.(nextValue);
  };

  const [internalFilterType, setInternalFilterType] = useState("");
  const filterType =
    controlledFilterType !== undefined
      ? controlledFilterType
      : internalFilterType;
  const setFilterType = (value: string | ((prev: string) => string)) => {
    const nextValue = typeof value === "function" ? value(filterType) : value;
    setInternalFilterType(nextValue);
    onFilterTypeChange?.(nextValue);
  };

  const [internalFilterWallet, setInternalFilterWallet] = useState("");
  const filterWallet =
    controlledFilterWallet !== undefined
      ? controlledFilterWallet
      : internalFilterWallet;
  const setFilterWallet = (value: string | ((prev: string) => string)) => {
    const nextValue = typeof value === "function" ? value(filterWallet) : value;
    setInternalFilterWallet(nextValue);
    onFilterWalletChange?.(nextValue);
  };

  const [internalFilterReviewOnly, setInternalFilterReviewOnly] =
    useState(false);
  const filterReviewOnly =
    controlledFilterReviewOnly !== undefined
      ? controlledFilterReviewOnly
      : internalFilterReviewOnly;
  const setFilterReviewOnly = (
    value: boolean | ((prev: boolean) => boolean),
  ) => {
    const nextValue =
      typeof value === "function" ? value(filterReviewOnly) : value;
    setInternalFilterReviewOnly(nextValue);
    onFilterReviewOnlyChange?.(nextValue);
  };

  const [internalMobileFilterOpen, setInternalMobileFilterOpen] =
    useState(false);
  const mobileFilterOpen =
    controlledMobileFilterOpen !== undefined
      ? controlledMobileFilterOpen
      : internalMobileFilterOpen;
  const setMobileFilterOpen = (
    value: boolean | ((prev: boolean) => boolean),
  ) => {
    const nextValue =
      typeof value === "function" ? value(mobileFilterOpen) : value;
    setInternalMobileFilterOpen(nextValue);
    onMobileFilterOpenChange?.(nextValue);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteReason, setDeleteReason] = useState("");
  const [showDeleteConfirmInSheet, setShowDeleteConfirmInSheet] =
    useState(false);
  const [createDraft, setCreateDraft] = useState<TransactionDraft | null>(() =>
    startWithNewTransaction && wallets.length
      ? newTransactionDraft(wallets, categories, businessDate)
      : null,
  );
  const [activeTarget, setActiveTarget] = useState<LedgerItem | null>(null);
  const [activeDraft, setActiveDraft] = useState<TransactionDraft | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [scheduledSheetOpen, setScheduledSheetOpen] = useState(false);
  const [busy, start] = useTransition();

  const totalPendingReviewCount = useMemo(
    () => transactions.filter((item) => requiresReview(item)).length,
    [transactions],
  );

  const hasActiveFilters =
    query.trim().length > 0 ||
    dateRange !== null ||
    filterCategory !== "" ||
    filterType !== "" ||
    filterWallet !== "" ||
    filterReviewOnly;

  const activeFilterCount =
    Number(dateRange !== null) +
    Number(filterCategory !== "") +
    Number(filterType !== "") +
    Number(filterWallet !== "") +
    Number(filterReviewOnly);

  const categoryFilterIds = useMemo(
    () => getCategoryFilterIds(categories, filterCategory),
    [categories, filterCategory],
  );

  const filteredRows = useMemo(
    () =>
      transactions.filter((item) => {
        const itemDate = item.date?.slice(0, 10) || "";
        return (
          isDateInRange(itemDate, dateRange) &&
          (filterType === "" || item.type === filterType) &&
          (filterWallet === "" ||
            item.walletId === filterWallet ||
            item.toWalletId === filterWallet) &&
          (!filterReviewOnly || requiresReview(item)) &&
          (filterCategory === "" ||
            (item.categoryId !== null &&
              categoryFilterIds.has(item.categoryId))) &&
          `${item.description ?? ""} ${item.category?.name ?? ""} ${item.wallet} ${item.member}`
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase())
        );
      }),
    [
      transactions,
      dateRange,
      filterType,
      filterWallet,
      filterReviewOnly,
      filterCategory,
      categoryFilterIds,
      query,
    ],
  );

  const scheduledRows = filteredRows.filter(
    (item) => item.status === "scheduled",
  );
  const nearestScheduledDate = scheduledRows.reduce<string | null>(
    (nearestDate, item) =>
      nearestDate === null || item.date < nearestDate ? item.date : nearestDate,
    null,
  );
  const orderedScheduledRows = [...scheduledRows].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const latestRows = filteredRows.filter((item) => item.status !== "scheduled");
  const pageCount = Math.max(1, Math.ceil(latestRows.length / pageSize));
  const page = Math.min(currentPage, pageCount);
  const rows = latestRows.slice((page - 1) * pageSize, page * pageSize);
  const selectableRows = rows.filter((item) => !requiresReview(item));
  const allSelected =
    selectableRows.length > 0 &&
    selectableRows.every((row) => selected.has(row.id));
  const pageStart = latestRows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(page * pageSize, latestRows.length);

  function clearFilters() {
    setQuery("");
    setDateRange(null);
    setFilterCategory("");
    setFilterType("");
    setFilterWallet("");
    setFilterReviewOnly(false);
    setCurrentPage(1);
    setSelected(new Set());
  }

  function changeFilter(update: () => void) {
    update();
    setCurrentPage(1);
    setSelected(new Set());
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      if (allSelected) selectableRows.forEach((row) => next.delete(row.id));
      else selectableRows.forEach((row) => next.add(row.id));
      return next;
    });
  }

  function removeBulk() {
    const ids = [...selected];
    if (!ids.length) return;
    start(async () => {
      const result = await deleteTransactionsAction(workspaceId, ids);
      if (result.ok) {
        toast.success(`Đã xóa ${ids.length} giao dịch.`);
        setSelected(new Set());
      } else {
        toast.error(result.message ?? "Không thể xóa giao dịch.");
      }
    });
  }

  function removeOne(target: LedgerItem, reason = "") {
    start(async () => {
      const result = await deleteTransactionAction(
        workspaceId,
        target.id,
        reason,
      );
      if (result.ok) {
        toast.success(
          result.kind === "requested"
            ? "Đã gửi yêu cầu xóa đến Admin."
            : "Đã xóa giao dịch và cập nhật lại số dư ví.",
        );
        setDeleteReason("");
        setShowDeleteConfirmInSheet(false);
        setActiveTarget(null);
        setActiveDraft(null);
      } else {
        toast.error(result.message ?? "Không thể xử lý yêu cầu xóa.");
      }
    });
  }

  function approveOne(item: LedgerItem) {
    start(async () => {
      const result = await approveTransactionAction(workspaceId, item.id);
      if (result.ok) {
        toast.success("Đã ghi nhận giao dịch.");
        setActiveTarget(null);
        setActiveDraft(null);
      } else {
        toast.error(result.message ?? "Không thể duyệt giao dịch.");
      }
    });
  }

  function rejectOne(item: LedgerItem) {
    start(async () => {
      const result = await rejectTransactionAction(workspaceId, item.id);
      if (result.ok) {
        toast.success("Đã từ chối giao dịch.");
        setActiveTarget(null);
        setActiveDraft(null);
      } else {
        toast.error(result.message ?? "Không thể từ chối giao dịch.");
      }
    });
  }

  function reviewChange(item: LedgerItem, approve: boolean) {
    const changeRequestId = item.pendingChangeRequestId;
    if (!changeRequestId) {
      toast.error("Không tìm thấy yêu cầu đang chờ duyệt.");
      return;
    }
    start(async () => {
      const result = await reviewTransactionChangeAction(
        workspaceId,
        changeRequestId,
        approve,
      );
      if (result.ok) {
        toast.success(
          item.pendingChangeAction === "delete"
            ? approve
              ? "Đã duyệt xóa giao dịch."
              : "Đã từ chối yêu cầu xóa giao dịch."
            : approve
              ? "Đã duyệt thay đổi giao dịch."
              : "Đã từ chối thay đổi giao dịch.",
        );
        setActiveTarget(null);
        setActiveDraft(null);
      } else {
        toast.error(result.message ?? "Không thể xử lý yêu cầu.");
      }
    });
  }

  function beginCreate() {
    setActiveTarget(null);
    setActiveDraft(null);
    setCreateDraft(newTransactionDraft(wallets, categories, businessDate));
  }

  function saveCreate() {
    if (!createDraft) return;
    start(async () => {
      const result = await addTransactionAction(
        workspaceId,
        transactionInput(createDraft),
      );
      if (result.ok) {
        toast.success(
          result.status === "pending"
            ? "Đã gửi giao dịch quá khứ để Admin duyệt."
            : result.status === "scheduled"
              ? "Đã lên lịch giao dịch tương lai."
              : "Đã ghi nhận giao dịch và cập nhật số dư ví.",
        );
        setCreateDraft(null);
      } else {
        toast.error(result.message ?? "Không thể lưu giao dịch.");
      }
    });
  }

  function openTransactionSheet(item: LedgerItem) {
    setCreateDraft(null);
    setShowDeleteConfirmInSheet(false);
    setDeleteReason("");
    setActiveTarget(item);
    setActiveDraft(draftFromTransaction(item, wallets));
  }

  function openTransactionDeleteConfirm(item: LedgerItem) {
    setCreateDraft(null);
    setDeleteReason("");
    setActiveTarget(item);
    setActiveDraft(draftFromTransaction(item, wallets));
    setShowDeleteConfirmInSheet(true);
  }

  function closeTransactionSheet() {
    if (busy) return;
    setShowDeleteConfirmInSheet(false);
    setDeleteReason("");
    setActiveTarget(null);
    setActiveDraft(null);
  }

  function saveActiveEdit() {
    if (!activeTarget || !activeDraft) return;
    if (!isChanged(activeTarget, activeDraft)) {
      toast.info("Không có thay đổi để lưu.");
      closeTransactionSheet();
      return;
    }

    const target = activeTarget;
    const draft = activeDraft;
    start(async () => {
      const result = await updateTransactionsAction(workspaceId, [
        { transactionId: target.id, input: transactionInput(draft) },
      ]);
      if (result.ok) {
        toast.success(
          result.requested
            ? "Đã gửi yêu cầu sửa đến Admin."
            : "Đã lưu thay đổi giao dịch.",
        );
      } else {
        toast.error(result.message ?? "Không thể lưu thay đổi giao dịch.");
      }
      if (
        result.ok ||
        ("updated" in result && result.updated + result.requested > 0)
      ) {
        setActiveTarget(null);
        setActiveDraft(null);
      }
    });
  }

  const walletFilterOptions = useMemo(
    () => [
      { value: "all", label: "Tất cả ví" },
      ...wallets.map((w) => ({ value: w.id, label: w.name })),
    ],
    [wallets],
  );

  const walletKindById = useMemo(
    () => new Map(wallets.map((w) => [w.id, w.kind ?? "asset"])),
    [wallets],
  );

  const selectionMode = selected.size > 0;

  function renderTransactionRow(item: LedgerItem, compact = false) {
    if (!isDesktop) {
      return (
        <TouchTransactionRow
          key={item.id}
          item={item}
          currency={currency}
          selected={selected.has(item.id)}
          selectionMode={selectionMode}
          canApprove={canApprove}
          canEditTransactions={canEditTransactions}
          readonly={Boolean(readonly)}
          busy={busy}
          onToggle={() => toggle(item.id)}
          onOpenSheet={() => openTransactionSheet(item)}
          onOpenDeleteConfirm={() => openTransactionDeleteConfirm(item)}
          onApprove={() => approveOne(item)}
          onReject={() => rejectOne(item)}
        />
      );
    }

    const isIncome = item.type === "income";
    const isExpense = item.type === "expense";
    const isTransfer = item.type === "transfer";
    const amountPrefix = isIncome ? "+" : isExpense ? "−" : "↔";
    const categoryName =
      item.category?.name ??
      (isTransfer ? "Chuyển khoản" : "Chưa phân loại");
    const primaryTitle = item.description || categoryName;
    const isSelected = selected.has(item.id);
    const hasReviewRequest = Boolean(item.pendingChangeRequestId);
    const isDeleteRequest = item.pendingChangeAction === "delete";
    const isCreditWallet = walletKindById.get(item.walletId) === "credit_card";
    const formattedWalletName = /^(ví|thẻ)(\s|$)/i.test(item.wallet.trim())
      ? item.wallet
      : isCreditWallet
        ? `Thẻ ${item.wallet}`
        : `Ví ${item.wallet}`;

    if (compact) {
      return (
        <article
          key={item.id}
          onClick={() => openTransactionSheet(item)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openTransactionSheet(item);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`${primaryTitle}, ${amountPrefix}${formatAmount(item.amount)} ${currency}`}
          className={cn(
            "flex items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] cursor-pointer md:px-5",
            isSelected &&
              "bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))]",
          )}
        >
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-xl",
                isTransfer && "bg-[var(--primary)]/10 text-[var(--primary)]",
                !isTransfer &&
                  !item.category &&
                  "bg-[var(--surface-secondary)] text-[var(--text-secondary)]",
              )}
              style={
                !isTransfer && item.category
                  ? {
                      backgroundColor: `${item.category.color}18`,
                      color: item.category.color,
                    }
                  : undefined
              }
            >
              {isTransfer ? (
                <ArrowLeftRight className="size-4" aria-hidden="true" />
              ) : (
                <CategoryIcon
                  category={
                    item.category ?? {
                      color: "var(--text-secondary)",
                      icon: "tag",
                    }
                  }
                  size={16}
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <strong className="break-words text-sm font-medium leading-snug text-[var(--foreground)]">
                  {primaryTitle}
                </strong>
                {!hasReviewRequest && item.status === "scheduled" && (
                  <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--info)_14%,var(--surface))] px-2 py-0.5 text-[0.65rem] font-semibold text-[var(--info)]">
                    Đã lên lịch
                  </span>
                )}
              </div>
              <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <span className="break-words leading-snug">
                  {formattedWalletName}
                  {item.toWallet ? ` → ${item.toWallet}` : ""} · {item.member}
                </span>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <strong
              className={cn(
                "block break-words text-sm font-semibold leading-snug tabular-nums",
                isIncome && "text-[var(--income)]",
                isExpense && "text-[var(--expense)]",
                isTransfer && "text-[var(--foreground)]",
              )}
            >
              {amountPrefix}
              {formatAmount(item.amount)} {currency}
            </strong>
            <ChevronRight
              className="size-4 shrink-0 text-[var(--text-muted)]"
              aria-hidden="true"
            />
          </div>
        </article>
      );
    }

    const subtitleText = item.description
      ? isTransfer
        ? "Ghi chú chuyển khoản nội bộ"
        : isIncome
          ? "Ghi chú khoản thu nhập"
          : isCreditWallet
            ? "Chi tiêu qua thẻ tín dụng"
            : "Ghi chú khoản chi tiêu"
      : isTransfer
        ? "Luân chuyển số dư giữa các ví"
        : isIncome
          ? "Khoản thu nhập vào ví"
          : isCreditWallet
            ? "Giao dịch chi tiêu thẻ tín dụng"
            : "Giao dịch chi tiêu trực tiếp";

    return (
      <article
        key={item.id}
        onClick={() => openTransactionSheet(item)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openTransactionSheet(item);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`${primaryTitle}, ${amountPrefix}${formatAmount(item.amount)} ${currency}`}
        className={cn(
          "group grid grid-cols-12 items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] cursor-pointer",
          isSelected &&
            "bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))]",
        )}
      >
        {/* Col 1-5: Checkbox, Luxury Category Icon & Transaction Description */}
        <div className="col-span-5 flex min-w-0 items-center gap-3.5">
          {canApprove && (
            <div
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              className="flex shrink-0 items-center"
            >
              {!requiresReview(item) ? (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggle(item.id)}
                  aria-label={`Chọn giao dịch ${primaryTitle}`}
                />
              ) : (
                <span className="block size-4 shrink-0" aria-hidden="true" />
              )}
            </div>
          )}

          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)]/60 transition-transform group-hover:scale-[1.02]",
              isTransfer && "bg-[var(--primary)]/10 text-[var(--primary)]",
              !isTransfer &&
                !item.category &&
                "bg-[var(--surface-secondary)] text-[var(--text-secondary)]",
            )}
            style={
              !isTransfer && item.category
                ? {
                    backgroundColor: `${item.category.color}18`,
                    color: item.category.color,
                  }
                : undefined
            }
          >
            {isTransfer ? (
              <ArrowLeftRight className="size-4" aria-hidden="true" />
            ) : (
              <CategoryIcon
                category={
                  item.category ?? {
                    color: "var(--text-secondary)",
                    icon: "tag",
                  }
                }
                size={17}
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <strong className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                {primaryTitle}
              </strong>

              {item.isRecurring && (
                <span className="inline-flex shrink-0 items-center rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                  Định kỳ
                </span>
              )}

              {hasReviewRequest && (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold",
                    isDeleteRequest
                      ? "bg-[color-mix(in_srgb,var(--danger)_14%,var(--surface))] text-[var(--danger)]"
                      : "bg-[color-mix(in_srgb,var(--warning)_14%,var(--surface))] text-[var(--warning)]",
                  )}
                >
                  {isDeleteRequest ? "Chờ duyệt xóa" : "Chờ duyệt sửa"}
                </span>
              )}

              {!hasReviewRequest && item.status === "pending" && (
                <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--warning)_14%,var(--surface))] px-2 py-0.5 text-[0.65rem] font-semibold text-[var(--warning)]">
                  Chờ duyệt
                </span>
              )}

              {!hasReviewRequest && item.status === "scheduled" && (
                <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--info)_14%,var(--surface))] px-2 py-0.5 text-[0.65rem] font-semibold text-[var(--info)]">
                  Đã lên lịch
                </span>
              )}

              {!hasReviewRequest && item.status === "rejected" && (
                <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--danger)_14%,var(--surface))] px-2 py-0.5 text-[0.65rem] font-semibold text-[var(--danger)]">
                  Đã từ chối
                </span>
              )}
            </div>

            <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-muted)]">
              {subtitleText}
            </p>
          </div>
        </div>

        {/* Col 6-7: Category / Classification Pill */}
        <div className="col-span-2 min-w-0">
          {isTransfer ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
              <ArrowLeftRight className="size-3 shrink-0 text-[var(--primary)]" aria-hidden="true" />
              <span className="break-words leading-snug">Chuyển khoản</span>
            </span>
          ) : item.category ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium"
              style={{
                backgroundColor: `${item.category.color}16`,
                color: item.category.color,
              }}
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.category.color }}
                aria-hidden="true"
              />
              <span className="break-words leading-snug">
                {item.category.name}
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">
              <span className="break-words leading-snug">Chưa phân loại</span>
            </span>
          )}
        </div>

        {/* Col 8-9: Source Wallet / Card & Member */}
        <div className="col-span-2 min-w-0">
          <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
            {isCreditWallet ? (
              <CreditCard
                className="size-3.5 shrink-0 text-[var(--primary)]"
                aria-hidden="true"
              />
            ) : (
              <Wallet
                className="size-3.5 shrink-0 text-[var(--text-secondary)]"
                aria-hidden="true"
              />
            )}
            <span className="break-words leading-snug">
              {formattedWalletName}
              {item.toWallet ? ` → ${item.toWallet}` : ""}
            </span>
          </div>
          <p className="mt-0.5 pl-5 break-words text-[11px] leading-snug text-[var(--text-muted)]">
            Bởi {item.member}
          </p>
        </div>

        {/* Col 10-12: Amount & Quick Actions */}
        <div className="col-span-3 flex items-center justify-end gap-2.5 text-right">
          <div className="min-w-0">
            <strong
              className={cn(
                "block whitespace-nowrap text-sm font-bold leading-snug tabular-nums",
                isIncome && "text-[var(--income)]",
                isExpense && "text-[var(--expense)]",
                isTransfer && "text-[var(--foreground)]",
              )}
            >
              {amountPrefix}
              {formatAmount(item.amount)}{" "}
              <span className="text-[11px] font-semibold opacity-75">
                {currency}
              </span>
            </strong>
            <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">
              {isIncome ? "Khoản thu" : isExpense ? "Khoản chi" : "Chuyển ví"}
            </span>
          </div>

          <span
            className="grid size-7 shrink-0 place-items-center rounded-lg border border-transparent text-[var(--text-muted)] transition-colors group-hover:border-[var(--border)] group-hover:bg-[var(--surface-secondary)] group-hover:text-[var(--foreground)]"
            aria-hidden="true"
          >
            <ChevronRight className="size-4" />
          </span>
        </div>
      </article>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Filter & Search Toolbar */}
      <div className="flex flex-col gap-2.5 border-b border-[var(--border)] bg-[var(--surface)] p-3.5 md:px-5 md:py-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <Search
            containerClassName="min-w-0 flex-1 md:max-w-xs"
            value={query}
            onChange={(event) =>
              changeFilter(() => setQuery(event.target.value))
            }
            placeholder="Tìm theo nội dung, danh mục, ví..."
            aria-label="Tìm giao dịch hoặc ghi chú"
          />

          {/* Quick Filter Triggers on Desktop (lg:) */}
          <div className="hidden items-center gap-2 lg:flex">
            <div className="w-36">
              <Select
                value={filterType || "all"}
                onValueChange={(val) =>
                  changeFilter(() => setFilterType(val === "all" ? "" : val))
                }
                options={filterTypeOptions}
                aria-label="Lọc theo loại giao dịch"
              />
            </div>

            <div className="w-40">
              <Select
                value={filterWallet || "all"}
                onValueChange={(val) =>
                  changeFilter(() => setFilterWallet(val === "all" ? "" : val))
                }
                options={walletFilterOptions}
                aria-label="Lọc theo ví"
              />
            </div>

            <div className="w-44">
              <CategoryTreeSelect
                value={filterCategory}
                ariaLabel="Lọc danh mục"
                placeholder="Tất cả danh mục"
                categories={categories}
                emptyOption={{ value: "", label: "Tất cả danh mục" }}
                onValueChange={(value) =>
                  changeFilter(() => setFilterCategory(value))
                }
              />
            </div>

            <DateRangePicker
              value={dateRange}
              ariaLabel="Lọc theo khoảng thời gian"
              allowClear
              onValueChange={(value) =>
                changeFilter(() => setDateRange(value))
              }
            />
          </div>

          {/* Filter Sheet Trigger for Mobile & Tablet (<1024px) */}
          <div className="lg:hidden">
            <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant={activeFilterCount > 0 ? "selected" : "outline"}
                    size="icon"
                    type="button"
                    className="relative"
                    aria-label={`Mở bộ lọc giao dịch${activeFilterCount > 0 ? `, ${activeFilterCount} bộ lọc đang áp dụng` : ""}`}
                    title={`Mở bộ lọc giao dịch${activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}`}
                  />
                }
              >
                <SlidersHorizontal size={15} />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[var(--primary)] text-[0.6rem] font-bold text-[var(--text-on-primary)] tabular-nums">
                    {activeFilterCount}
                  </span>
                )}
              </SheetTrigger>
              <SheetContent
                side="bottom"
                aria-label="Bộ lọc giao dịch"
              >
                <SheetHeader
                  icon={SlidersHorizontal}
                  title="Bộ lọc giao dịch"
                  description={`Thu hẹp danh sách theo loại, ví, danh mục và thời gian trong ${scopeLabel}.`}
                />

                <div className="overflow-y-auto px-4 py-3.5">
                  <div className="grid grid-cols-1 gap-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/40 p-3.5 sm:grid-cols-2">
                    <Select
                      label="Loại giao dịch"
                      value={filterType || "all"}
                      onValueChange={(val) =>
                        changeFilter(() =>
                          setFilterType(val === "all" ? "" : val),
                        )
                      }
                      options={filterTypeOptions}
                    />

                    <Select
                      label="Ví thực hiện"
                      value={filterWallet || "all"}
                      onValueChange={(val) =>
                        changeFilter(() =>
                          setFilterWallet(val === "all" ? "" : val),
                        )
                      }
                      options={walletFilterOptions}
                    />

                    <CategoryTreeSelect
                      label="Danh mục"
                      value={filterCategory}
                      ariaLabel="Lọc danh mục"
                      placeholder="Tất cả danh mục"
                      categories={categories}
                      emptyOption={{ value: "", label: "Tất cả danh mục" }}
                      onValueChange={(value) =>
                        changeFilter(() => setFilterCategory(value))
                      }
                    />

                    <div className="grid content-start gap-1.5">
                      <span className="text-xs font-medium text-[var(--text-secondary)]">
                        Khoảng thời gian
                      </span>
                      <DateRangePicker
                        value={dateRange}
                        ariaLabel="Lọc theo khoảng thời gian"
                        allowClear
                        onValueChange={(value) =>
                          changeFilter(() => setDateRange(value))
                        }
                        className="w-full justify-between"
                      />
                    </div>
                  </div>
                </div>

                <SheetFooter className="flex-row items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3.5">
                  <Button
                    variant="outline"
                    size="icon"
                    type="button"
                    disabled={!hasActiveFilters}
                    aria-label="Đặt lại bộ lọc"
                    title="Đặt lại bộ lọc"
                    onClick={() => {
                      clearFilters();
                      setMobileFilterOpen(false);
                    }}
                  >
                    <FilterX size={15} />
                  </Button>
                  <Button
                    variant="default"
                    type="button"
                    className="flex-1"
                    onClick={() => setMobileFilterOpen(false)}
                  >
                    Xem {filteredRows.length} giao dịch
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>

          {/* Pending Review Quick Filter Badge */}
          {totalPendingReviewCount > 0 && (
            <Button
              type="button"
              variant={filterReviewOnly ? "selected" : "warning"}
              size="icon"
              className="relative"
              onClick={() =>
                changeFilter(() => setFilterReviewOnly((prev) => !prev))
              }
              aria-pressed={filterReviewOnly}
              aria-label={`Lọc ${totalPendingReviewCount} giao dịch cần duyệt`}
              title={`Lọc ${totalPendingReviewCount} giao dịch cần duyệt`}
            >
              <CircleAlert size={15} />
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[var(--warning)] text-[0.6rem] font-bold text-[var(--surface)] tabular-nums">
                {totalPendingReviewCount}
              </span>
            </Button>
          )}

          {/* Scheduled Transactions Trigger */}
          {scheduledRows.length > 0 && (
            <Button
              variant="info"
              size="icon"
              type="button"
              className="relative"
              disabled={busy}
              onClick={() => setScheduledSheetOpen(true)}
              aria-label={`Xem ${scheduledRows.length} giao dịch đã lên lịch`}
              title={`Xem ${scheduledRows.length} giao dịch đã lên lịch`}
            >
              <CalendarClock size={15} />
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[var(--info)] text-[0.6rem] font-bold text-[var(--surface)] tabular-nums">
                {scheduledRows.length}
              </span>
            </Button>
          )}

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={clearFilters}
              aria-label="Đặt lại bộ lọc"
              title="Đặt lại bộ lọc"
              className="hidden lg:inline-flex"
            >
              <FilterX size={15} />
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            {canApprove && selected.size > 0 && (
              <div className="hidden items-center gap-1.5 rounded-xl border border-[var(--primary)]/30 bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))] px-2.5 py-1 lg:flex">
                <span className="text-xs font-semibold text-[var(--foreground)] tabular-nums">
                  Đã chọn {selected.size}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => setSelected(new Set())}
                  aria-label="Bỏ chọn tất cả"
                  title="Bỏ chọn tất cả"
                >
                  <X size={13} />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  type="button"
                  className="size-6"
                  disabled={busy}
                  onClick={() => setBulkDeleteOpen(true)}
                  aria-label={`Xóa ${selected.size} giao dịch đã chọn`}
                  title={`Xóa ${selected.size} giao dịch đã chọn`}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            )}

            {!readonly &&
              (isDesktop ? (
                <Popover
                  open={Boolean(createDraft)}
                  onOpenChange={(open) => {
                    if (open) beginCreate();
                    else if (!busy) setCreateDraft(null);
                  }}
                >
                  <PopoverTrigger
                    render={
                      <Button
                        variant="default"
                        size="sm"
                        disabled={busy || !wallets.length}
                        aria-label="Tạo giao dịch mới"
                        title="Tạo giao dịch mới"
                        className="h-9 gap-1.5 px-3.5 text-xs font-semibold"
                      />
                    }
                  >
                    <Plus size={15} />
                    <span>Ghi giao dịch</span>
                  </PopoverTrigger>
                  {createDraft && (
                    <DesktopTransactionCreatePopoverContent
                      draft={createDraft}
                      wallets={wallets}
                      categories={categories}
                      busy={busy}
                      onChange={(patch) =>
                        setCreateDraft((current) =>
                          current ? { ...current, ...patch } : current,
                        )
                      }
                      onSave={saveCreate}
                      onCancel={() => setCreateDraft(null)}
                    />
                  )}
                </Popover>
              ) : (
                <Button
                  variant="default"
                  size="icon"
                  type="button"
                  className="hidden md:inline-flex"
                  disabled={busy || !wallets.length}
                  onClick={beginCreate}
                  aria-label="Tạo giao dịch mới"
                  title="Tạo giao dịch mới"
                >
                  <Plus size={16} />
                </Button>
              ))}
          </div>
        </div>

        {/* Segmented Quick Type Filter on Mobile & Tablet (<1024px) */}
        <div
          className="grid grid-cols-4 gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-1 lg:hidden"
          role="group"
          aria-label="Lọc nhanh loại giao dịch"
        >
          {[
            { value: "", label: "Tất cả" },
            { value: "expense", label: "Chi tiêu" },
            { value: "income", label: "Thu nhập" },
            { value: "transfer", label: "Chuyển ví" },
          ].map((pill) => {
            const active = filterType === pill.value;
            return (
              <button
                key={pill.value || "all"}
                type="button"
                aria-pressed={active}
                onClick={() => changeFilter(() => setFilterType(pill.value))}
                className={cn(
                  "rounded-lg px-1.5 py-1.5 text-center text-[0.72rem] font-medium transition-colors",
                  active
                    ? "border border-[var(--border)] bg-[var(--surface)] font-semibold text-[var(--foreground)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--foreground)]",
                )}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Dedicated Touch Multi-Select Bar on Mobile & Tablet (<1024px) */}
        {canApprove && selectionMode && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--primary)]/30 bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))] px-3 py-2 lg:hidden">
            <div className="flex min-w-0 items-center gap-2.5">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                aria-label="Chọn tất cả giao dịch đang hiển thị"
              />
              <span className="text-xs font-semibold text-[var(--foreground)] tabular-nums">
                Đã chọn {selected.size} mục
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setSelected(new Set())}
                aria-label="Bỏ chọn tất cả"
                title="Bỏ chọn tất cả"
              >
                <X size={15} />
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                disabled={busy}
                onClick={() => setBulkDeleteOpen(true)}
                aria-label={`Xóa ${selected.size} giao dịch đã chọn`}
                title={`Xóa ${selected.size} giao dịch đã chọn`}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Desktop 12-Column Table Header Strip */}
      {rows.length > 0 && (
        <div
          className="hidden border-b border-[var(--border)] bg-[var(--surface-secondary)]/50 px-5 py-2.5 text-[11px] font-semibold tracking-wider text-[var(--text-muted)] uppercase lg:grid lg:grid-cols-12 lg:items-center lg:gap-4"
          aria-hidden="false"
        >
          <div className="col-span-5 flex items-center gap-3.5">
            {canApprove && selectableRows.length > 0 && (
              <div className="flex shrink-0 items-center">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Chọn tất cả giao dịch đang hiển thị"
                />
              </div>
            )}
            <span>Giao dịch & nội dung</span>
          </div>
          <div className="col-span-2">Danh mục</div>
          <div className="col-span-2">Nguồn tiền · Thành viên</div>
          <div className="col-span-3 text-right pr-9">Số tiền</div>
        </div>
      )}

      {/* Unified Transaction List Grouped by Date */}
      <div
        className="divide-y divide-[var(--border)]"
        aria-label="Danh sách giao dịch"
      >
        {groupTransactionsByDate(rows).map(({ dateKey, label, items }) => {
          const totals = getLedgerDateTotals(items);
          const totalAmount = totals.income.minus(totals.expense);
          return (
            <section key={dateKey} className="divide-y divide-[var(--border)]">
              <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-[var(--surface-secondary)]/85 px-4 py-2 text-xs backdrop-blur-md md:px-5">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="hidden size-1.5 shrink-0 rounded-full bg-[var(--primary)] md:inline-block"
                    aria-hidden="true"
                  />
                  <strong className="break-words text-[0.72rem] font-semibold tracking-wide text-[var(--foreground)] uppercase tabular-nums">
                    {label}
                  </strong>
                  <span className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[0.65rem] font-medium text-[var(--text-muted)] tabular-nums">
                    {items.length} giao dịch
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {totals.income.gt(0) && totals.expense.gt(0) && (
                    <div className="hidden items-center gap-2 text-[0.68rem] font-medium tabular-nums lg:flex">
                      <span className="text-[var(--income)]">
                        Thu: +{formatAmount(totals.income)}
                      </span>
                      <span className="text-[var(--text-muted)]">·</span>
                      <span className="text-[var(--expense)]">
                        Chi: −{formatAmount(totals.expense)}
                      </span>
                    </div>
                  )}
                  <span
                    className={cn(
                      "shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-[0.7rem] font-semibold tabular-nums",
                      totalAmount.isPositive()
                        ? "text-[var(--income)]"
                        : totalAmount.isNegative()
                          ? "text-[var(--expense)]"
                          : "text-[var(--text-secondary)]",
                    )}
                  >
                    {totalAmount.isPositive()
                      ? "+"
                      : totalAmount.isNegative()
                        ? "−"
                        : ""}
                    {formatAmount(totalAmount.abs())} {currency}
                  </span>
                </div>
              </header>
              <div className="divide-y divide-[var(--border)]">
                {items.map((item) => renderTransactionRow(item, false))}
              </div>
            </section>
          );
        })}

        {rows.length === 0 && (
          <div className="p-8">
            <Empty
              variant="compact"
              title="Chưa có giao dịch phù hợp"
              description={
                scheduledRows.length > 0
                  ? "Các giao dịch đang chờ thực thi nằm trong mục Đã lên lịch."
                  : "Thử thay đổi từ khóa tìm kiếm hoặc đặt lại bộ lọc."
              }
            />
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <footer className="flex min-h-12 shrink-0 items-center justify-between gap-4 border-t border-[var(--border)] bg-[var(--surface-secondary)]/30 px-4 py-2.5 text-xs text-[var(--text-muted)] md:px-5">
        <span className="break-words leading-snug tabular-nums">
          Hiển thị {pageStart}–{pageEnd} / {latestRows.length} giao dịch
          {scheduledRows.length > 0
            ? ` · ${scheduledRows.length} đã lên lịch`
            : ""}
        </span>
        {pageCount > 1 && (
          <nav
            className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--text-secondary)]"
            aria-label="Phân trang sổ giao dịch"
          >
            <Button
              variant="icon"
              size="icon"
              disabled={page <= 1}
              onClick={() => setCurrentPage(Math.max(1, page - 1))}
              title="Trang trước"
              aria-label="Trang trước"
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="px-1 font-medium tabular-nums">
              Trang {page}/{pageCount}
            </span>
            <Button
              variant="icon"
              size="icon"
              disabled={page >= pageCount}
              onClick={() => setCurrentPage(Math.min(pageCount, page + 1))}
              title="Trang sau"
              aria-label="Trang sau"
            >
              <ChevronRight size={16} />
            </Button>
          </nav>
        )}
      </footer>

      {/* Mobile/Tablet Create Transaction Sheet */}
      <Sheet
        open={!isDesktop && Boolean(createDraft)}
        onOpenChange={(open) => {
          if (!open && !busy) setCreateDraft(null);
        }}
      >
        <SheetContent side="bottom" aria-label="Tạo giao dịch mới">
          <SheetHeader
            icon={Plus}
            title="Tạo giao dịch mới"
            description="Nhập số tiền và thông tin phân loại giao dịch."
          />
          {createDraft && (
            <>
              <div className="overflow-y-auto p-4">
                <TransactionEditorForm
                  draft={createDraft}
                  wallets={wallets}
                  categories={categories}
                  busy={busy}
                  disabled={false}
                  onChange={(patch) =>
                    setCreateDraft((current) =>
                      current ? { ...current, ...patch } : current,
                    )
                  }
                />
              </div>
              <SheetFooter
                onCancel={() => setCreateDraft(null)}
                cancelLabel="Hủy"
                cancelDisabled={busy}
                submitLabel="Lưu giao dịch"
                submittingLabel="Đang lưu..."
                isSubmitting={busy}
                submitDisabled={busy}
                onSubmit={saveCreate}
                submitType="button"
              />
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Unified Detail / Edit / Approval Sheet */}
      <Sheet
        open={Boolean(activeTarget && activeDraft)}
        onOpenChange={(open) => {
          if (!open) closeTransactionSheet();
        }}
      >
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          placement={isDesktop ? "inset" : "edge"}
          size={isDesktop ? "wide" : "default"}
          spacing="flush"
          elevation="flat"
          aria-label="Chi tiết giao dịch"
        >
          {activeTarget && activeDraft && (
            <TransactionDetailSheetBody
              item={activeTarget}
              draft={activeDraft}
              wallets={wallets}
              categories={categories}
              currency={currency}
              busy={busy}
              canApprove={canApprove}
              canEdit={
                canEditTransactions &&
                activeTarget.canRequestEdit &&
                !activeTarget.hasPendingChange &&
                activeTarget.status !== "rejected"
              }
              canDelete={!readonly && activeTarget.canRequestDelete}
              isAdmin={isAdmin}
              deleteReason={deleteReason}
              onDeleteReasonChange={setDeleteReason}
              showDeleteConfirm={showDeleteConfirmInSheet}
              onShowDeleteConfirmChange={setShowDeleteConfirmInSheet}
              onChange={(patch) =>
                setActiveDraft((current) =>
                  current ? { ...current, ...patch } : current,
                )
              }
              onSave={saveActiveEdit}
              onApprove={() => approveOne(activeTarget)}
              onReject={() => rejectOne(activeTarget)}
              onReviewChange={(approve) => reviewChange(activeTarget, approve)}
              onDelete={() => removeOne(activeTarget, deleteReason)}
              onClose={closeTransactionSheet}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Scheduled Transactions Sheet */}
      <Sheet open={scheduledSheetOpen} onOpenChange={setScheduledSheetOpen}>
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          placement={isDesktop ? "inset" : "edge"}
          size={isDesktop ? "wide" : "default"}
          spacing="flush"
          elevation="flat"
          aria-label="Giao dịch đã lên lịch"
        >
          <SheetHeader
            icon={CalendarClock}
            title="Giao dịch đã lên lịch"
            description={`Có ${scheduledRows.length} giao dịch đang chờ đến ngày tự động ghi nhận${nearestScheduledDate ? ` (gần nhất: ${formatLedgerDate(nearestScheduledDate)})` : ""}.`}
          />
          <div className="min-h-0 flex-1 divide-y divide-[var(--border)] overflow-y-auto">
            {orderedScheduledRows.length > 0 ? (
              orderedScheduledRows.map((item) => renderTransactionRow(item, true))
            ) : (
              <div className="p-6">
                <Empty
                  variant="compact"
                  title="Không còn giao dịch đã lên lịch"
                  description="Các khoản đã xử lý sẽ tự động rời khỏi danh sách này."
                />
              </div>
            )}
          </div>
          <SheetFooter
            onCancel={() => setScheduledSheetOpen(false)}
            cancelLabel="Đóng"
          />
        </SheetContent>
      </Sheet>

      {/* Bulk Delete Confirmation Sheet */}
      <Sheet open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <SheetContent
          side="bottom"
          aria-label={`Xác nhận xóa ${selected.size} giao dịch`}
        >
          <SheetHeader
            icon={Trash2}
            title={`Xóa ${selected.size} giao dịch đã chọn?`}
            description="Các giao dịch đã ghi nhận sẽ được hoàn tác khỏi số dư ví. Hành động này không thể hoàn tác."
          />
          <SheetFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setBulkDeleteOpen(false)}
              className="flex-1 sm:flex-none"
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                setBulkDeleteOpen(false);
                removeBulk();
              }}
              className="flex-1 sm:flex-none gap-2"
            >
              <Trash2 size={15} />
              <span>Xóa {selected.size} giao dịch</span>
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function TransactionEditorForm({
  draft,
  wallets,
  categories,
  busy,
  disabled,
  onChange,
}: {
  draft: TransactionDraft;
  wallets: Option[];
  categories: CategoryOption[];
  busy: boolean;
  disabled: boolean;
  onChange: (patch: Partial<TransactionDraft>) => void;
}) {
  const locked = Boolean(disabled || busy);
  const selectedWallet = wallets.find((wallet) => wallet.id === draft.walletId);
  const isCreditCardExpense =
    (draft.type === "expense" || draft.type === "transfer") &&
    selectedWallet?.kind === "credit_card";
  const assetWallets = wallets.filter(
    (wallet) => wallet.kind !== "credit_card",
  );

  function changeType(type: TransactionType): void {
    const nextWalletId =
      type === "income" && selectedWallet?.kind === "credit_card"
        ? (assetWallets[0]?.id ?? draft.walletId)
        : draft.walletId;
    const nextWallet = wallets.find((w) => w.id === nextWalletId);
    const isCard = nextWallet?.kind === "credit_card";
    const defaultFundingId =
      nextWallet?.defaultFundingWalletId ?? assetWallets[0]?.id ?? "";
    onChange({
      type,
      walletId: nextWalletId,
      categoryId:
        categoriesForTransactionType(categories, type)[0]?.id ?? "none",
      allocations:
        (type === "expense" || type === "transfer") && isCard
          ? draft.allocations.length > 0
            ? draft.allocations
            : [{ walletId: defaultFundingId, amount: draft.amount }]
          : [],
      toWalletId:
        type === "transfer"
          ? draft.toWalletId && draft.toWalletId !== nextWalletId
            ? draft.toWalletId
            : defaultDestination(wallets, nextWalletId)
          : draft.toWalletId,
    });
  }

  return (
    <div className="space-y-3.5">
      <Tabs
        value={draft.type}
        onValueChange={(value) => changeType(value as TransactionType)}
        className="gap-0"
      >
        <TabsList
          variant="navigation"
          className="w-full"
          aria-label="Loại giao dịch"
        >
          {transactionTypeTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                variant="navigation"
                tone={
                  tab.value === "expense"
                    ? "expense"
                    : tab.value === "income"
                      ? "income"
                      : undefined
                }
                disabled={
                  locked || (tab.value === "transfer" && wallets.length < 2)
                }
              >
                <Icon aria-hidden="true" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Hero Amount Card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-3">
        <span className="block text-[0.68rem] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
          Số tiền giao dịch
        </span>
        <div className="mt-0.5">
          <MoneyInput
            required
            disabled={locked}
            value={draft.amount}
            onValueChange={(amount) =>
              onChange({
                amount,
                allocations: isCreditCardExpense
                  ? [
                      {
                        walletId:
                          draft.allocations[0]?.walletId ||
                          selectedWallet?.defaultFundingWalletId ||
                          assetWallets[0]?.id ||
                          "",
                        amount,
                      },
                    ]
                  : [],
              })
            }
            placeholder="0"
            aria-label="Số tiền"
            wrapperClassName="w-full"
            className="h-10 rounded-none border-0 bg-transparent pl-0 pr-12 text-left text-2xl font-bold tracking-tight text-[var(--foreground)] focus-visible:border-transparent focus-visible:ring-0"
          />
        </div>
      </div>

      {/* Grouped Details Card */}
      <div className="grid grid-cols-1 gap-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/40 p-3.5 sm:grid-cols-2">
        <Select
          disabled={locked || !wallets.length}
          value={draft.walletId}
          onValueChange={(walletId) => {
            const wallet = wallets.find((item) => item.id === walletId);
            const isCard = wallet?.kind === "credit_card";
            const defaultFundingId =
              wallet?.defaultFundingWalletId || assetWallets[0]?.id || "";
            onChange({
              walletId,
              toWalletId:
                draft.toWalletId === walletId
                  ? defaultDestination(wallets, walletId)
                  : draft.toWalletId,
              allocations:
                (draft.type === "expense" || draft.type === "transfer") &&
                isCard
                  ? [{ walletId: defaultFundingId, amount: draft.amount }]
                  : [],
            });
          }}
          label={
            draft.type === "transfer"
              ? "Ví gửi"
              : isCreditCardExpense
                ? "Thẻ thanh toán"
                : "Ví thực hiện"
          }
          options={wallets.map((wallet) => {
            const isCard = wallet.kind === "credit_card";
            return {
              value: wallet.id,
              label: wallet.name,
              content: (
                <div className="flex w-full min-w-0 items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    {isCard ? (
                      <CreditCard
                        className="size-4 shrink-0 text-[var(--primary)]"
                        aria-hidden="true"
                      />
                    ) : (
                      <Wallet
                        className="size-4 shrink-0 text-[var(--text-muted)]"
                        aria-hidden="true"
                      />
                    )}
                    <span className="break-words leading-snug">{wallet.name}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      isCard
                        ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                        : "bg-[var(--surface-secondary)] text-[var(--text-muted)]"
                    }`}
                  >
                    {isCard ? "Thẻ tín dụng" : "Ví tài sản"}
                  </span>
                </div>
              ),
              selectedContent: (
                <span className="flex min-w-0 items-center gap-2">
                  {isCard ? (
                    <CreditCard
                      className="size-4 shrink-0 text-[var(--primary)]"
                      aria-hidden="true"
                    />
                  ) : (
                    <Wallet
                      className="size-4 shrink-0 text-[var(--text-muted)]"
                      aria-hidden="true"
                    />
                  )}
                  <span className="break-words leading-snug">{wallet.name}</span>
                </span>
              ),
              disabled: isCard && draft.type === "income",
            };
          })}
        />

        {draft.type === "transfer" && (
          <Select
            disabled={locked || !wallets.length}
            value={draft.toWalletId}
            onValueChange={(toWalletId) => onChange({ toWalletId })}
            label="Ví nhận"
            options={wallets.map((item) => ({
              value: item.id,
              label: item.name,
              disabled:
                item.id === draft.walletId || item.kind === "credit_card",
            }))}
          />
        )}

        {isCreditCardExpense && (
          <Select
            disabled={locked}
            label="Ví thanh toán thẻ"
            value={
              draft.allocations[0]?.walletId ||
              selectedWallet?.defaultFundingWalletId ||
              assetWallets[0]?.id ||
              ""
            }
            onValueChange={(walletId) =>
              onChange({
                allocations: [{ walletId, amount: draft.amount }],
              })
            }
            options={assetWallets.map((wallet) => ({
              value: wallet.id,
              label: wallet.name,
            }))}
          />
        )}

        {draft.type !== "transfer" && (
          <CategoryTreeSelect
            disabled={
              locked ||
              !categoriesForTransactionType(categories, draft.type).length
            }
            value={draft.categoryId}
            onValueChange={(categoryId) => onChange({ categoryId })}
            label="Danh mục"
            required={draft.type === "expense"}
            categories={categoriesForTransactionType(categories, draft.type)}
            emptyOption={
              draft.type === "expense"
                ? undefined
                : { value: "none", label: "Không chọn" }
            }
          />
        )}

        <DatePicker
          disabled={locked}
          label="Ngày giao dịch"
          value={draft.date}
          onValueChange={(date) => onChange({ date })}
          required
        />

        <div className="sm:col-span-2">
          <Input
            disabled={locked}
            value={draft.description}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="Ăn trưa, nhận lương..."
            label="Nội dung"
          />
        </div>
      </div>
    </div>
  );
}

function TransactionDetailSheetBody({
  item,
  draft,
  wallets,
  categories,
  currency,
  busy,
  canApprove,
  canEdit,
  canDelete,
  isAdmin,
  deleteReason,
  onDeleteReasonChange,
  showDeleteConfirm,
  onShowDeleteConfirmChange,
  onChange,
  onSave,
  onApprove,
  onReject,
  onReviewChange,
  onDelete,
  onClose,
}: {
  item: LedgerItem;
  draft: TransactionDraft;
  wallets: Option[];
  categories: CategoryOption[];
  currency: string;
  busy: boolean;
  canApprove: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isAdmin: boolean;
  deleteReason: string;
  onDeleteReasonChange: (value: string) => void;
  showDeleteConfirm: boolean;
  onShowDeleteConfirmChange: (open: boolean) => void;
  onChange: (patch: Partial<TransactionDraft>) => void;
  onSave: () => void;
  onApprove: () => void;
  onReject: () => void;
  onReviewChange: (approve: boolean) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const hasChanges = isChanged(item, draft);
  const isChangeReview = Boolean(
    canApprove &&
      item.pendingChangeRequestId &&
      (item.pendingChangeAction === "update" ||
        item.pendingChangeAction === "delete"),
  );
  const isDeleteReview = item.pendingChangeAction === "delete";
  const formattedWallet = /^(ví|thẻ)(\s|$)/i.test(item.wallet.trim())
    ? item.wallet
    : `Ví ${item.wallet}`;

  return (
    <>
      <SheetHeader
        icon={Pencil}
        title={
          isChangeReview
            ? isDeleteReview
              ? "Duyệt yêu cầu xóa giao dịch"
              : "Duyệt yêu cầu sửa giao dịch"
            : "Chi tiết giao dịch"
        }
        description={`${item.member} · ${formattedWallet} · ${formatLedgerDate(item.date)}`}
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3.5 md:p-6">
        {/* Approval Section for Pending Change Request */}
        {isChangeReview && (
          <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--foreground)]">
                <strong>{item.pendingChangeRequester ?? "Thành viên"}</strong>{" "}
                {isDeleteReview
                  ? "đề nghị xóa giao dịch này"
                  : `đề nghị sửa ${item.pendingChangeDetails.length} thông tin`}
              </span>
              <span className="rounded-full bg-[color-mix(in_srgb,var(--warning)_15%,var(--surface))] px-2 py-0.5 text-[0.65rem] font-semibold text-[var(--warning)]">
                Cần duyệt
              </span>
            </div>

            {isDeleteReview ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs">
                <span className="block font-medium text-[var(--text-secondary)]">
                  Lý do xóa:
                </span>
                <p className="mt-1 break-words leading-snug text-[var(--foreground)]">
                  {item.pendingChangeReason ?? "Không có lý do"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                {item.pendingChangeDetails.map((detail) => {
                  const unit = detail.label === "Số tiền" ? ` ${currency}` : "";
                  return (
                    <div
                      key={detail.label}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-[var(--text-secondary)]">
                        {detail.label}
                      </span>
                      <div className="flex items-center gap-2 tabular-nums">
                        <del className="text-[var(--text-muted)]">
                          {detail.previous}
                          {unit}
                        </del>
                        <span aria-hidden="true">→</span>
                        <strong className="font-semibold text-[var(--foreground)]">
                          {detail.proposed}
                          {unit}
                        </strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="icon"
                disabled={busy}
                onClick={() => onReviewChange(false)}
                aria-label="Từ chối yêu cầu"
                title="Từ chối yêu cầu"
              >
                <X size={15} />
              </Button>
              <Button
                variant={isDeleteReview ? "destructive" : "default"}
                size="icon"
                disabled={busy}
                onClick={() => onReviewChange(true)}
                aria-label={isDeleteReview ? "Duyệt xóa" : "Duyệt sửa"}
                title={isDeleteReview ? "Duyệt xóa" : "Duyệt sửa"}
              >
                <Check size={15} />
              </Button>
            </div>
          </div>
        )}

        {/* Approval Banner for Pending New Transaction */}
        {canApprove &&
          !item.pendingChangeRequestId &&
          item.status === "pending" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--foreground)]">
                  Giao dịch đang chờ duyệt
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Duyệt để ghi nhận vào số dư ví hoặc từ chối.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={busy}
                  onClick={onReject}
                  aria-label="Từ chối giao dịch"
                  title="Từ chối giao dịch"
                >
                  <X size={15} />
                </Button>
                <Button
                  variant="success"
                  size="icon"
                  disabled={busy}
                  onClick={onApprove}
                  aria-label="Duyệt giao dịch"
                  title="Duyệt giao dịch"
                >
                  <Check size={15} />
                </Button>
              </div>
            </div>
          )}

        {/* Early Execution Banner for Scheduled Transaction */}
        {canApprove && item.status === "scheduled" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--foreground)]">
                Giao dịch đã lên lịch ({formatLedgerDate(item.date)})
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Bạn có thể ghi nhận sớm ngay hôm nay.
              </p>
            </div>
            <Button
              variant="success"
              size="icon"
              disabled={busy}
              onClick={onApprove}
              aria-label="Ghi nhận sớm"
              title="Ghi nhận sớm"
            >
              <CircleCheckBig size={15} />
            </Button>
          </div>
        )}

        {/* Editable Form */}
        <TransactionEditorForm
          draft={draft}
          wallets={wallets}
          categories={categories}
          busy={busy}
          disabled={!canEdit}
          onChange={onChange}
        />

        {/* Delete Confirmation Section */}
        {canDelete && !item.pendingChangeRequestId && (
          <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
            {!showDeleteConfirm ? (
              <>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--foreground)]">
                    Xóa giao dịch
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {isAdmin
                      ? "Xóa giao dịch và hoàn tác số dư ví."
                      : "Gửi yêu cầu xóa giao dịch đến Admin."}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  type="button"
                  disabled={busy || item.hasPendingChange}
                  onClick={() => onShowDeleteConfirmChange(true)}
                  aria-label="Xóa giao dịch"
                  title="Xóa giao dịch"
                >
                  <Trash2 size={15} />
                </Button>
              </>
            ) : (
              <div className="w-full space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4">
                <div>
                  <h4 className="text-xs font-semibold text-[var(--foreground)]">
                    Xác nhận xóa giao dịch?
                  </h4>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {isAdmin
                      ? "Số dư ví sẽ được hoàn tác sau khi xóa."
                      : "Yêu cầu xóa sẽ được gửi đến Admin để phê duyệt."}
                  </p>
                </div>
                {!isAdmin && (
                  <Textarea
                    value={deleteReason}
                    onChange={(event) =>
                      onDeleteReasonChange(event.target.value)
                    }
                    placeholder="Nhập lý do xóa (bắt buộc)"
                    aria-label="Lý do xóa giao dịch"
                    required
                    maxLength={2000}
                  />
                )}
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={busy}
                    onClick={() => onShowDeleteConfirmChange(false)}
                  >
                    Hủy xóa
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    type="button"
                    disabled={busy || (!isAdmin && !deleteReason.trim())}
                    onClick={onDelete}
                  >
                    <Trash2 size={15} />
                    <span>{isAdmin ? "Xác nhận xóa" : "Gửi yêu cầu xóa"}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <SheetFooter
        onCancel={onClose}
        cancelLabel="Đóng"
        cancelDisabled={busy}
        submitLabel={canEdit ? "Lưu thay đổi" : undefined}
        submittingLabel="Đang lưu..."
        isSubmitting={busy}
        submitDisabled={busy || !hasChanges}
        onSubmit={canEdit ? onSave : undefined}
        submitType="button"
      />
    </>
  );
}
