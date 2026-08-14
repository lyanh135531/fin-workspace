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
  isDateInRange,
} from "@/app/dashboard/dashboard-ledger-filters";
import {
  getMobileLedgerActions,
  useLongPress,
} from "@/app/dashboard/mobile-ledger-interactions";
import type { DateRangeValue } from "@/components/base";
import {
  Button,
  CategoryIcon,
  CategoryTreeSelect,
  Checkbox,
  ConfirmDelete as ConfirmDeletePopover,
  DatePicker,
  DateRangePicker,
  Empty,
  Input,
  MoneyInput,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  Search,
  Select,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/base";
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
import Decimal from "decimal.js";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  FilterX,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

type Option = {
  id: string;
  name: string;
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
type LedgerDateTotals = {
  income: Decimal;
  expense: Decimal;
};
const typeOptions = [
  { value: "expense", label: "Chi tiêu", icon: ArrowUpRight },
  { value: "income", label: "Thu nhập", icon: ArrowDownLeft },
  { value: "transfer", label: "Chuyển khoản", icon: ArrowLeftRight },
] satisfies {
  value: TransactionType;
  label: string;
  icon: typeof ArrowUpRight;
}[];

function TransactionTypeLabel({
  type,
  variant,
}: {
  type: TransactionType;
  variant: "badge" | "option";
}) {
  const option = typeOptions.find((item) => item.value === type);
  if (!option) {
    throw new Error(
      `Không tìm thấy cấu hình hiển thị cho loại giao dịch: ${type}`,
    );
  }
  const Icon = option.icon;
  return (
    <span
      className={`ledger-transaction-type ledger-transaction-type-${variant} type-${type}`}
    >
      <span className="ledger-transaction-type-icon" aria-hidden>
        <Icon size={14} strokeWidth={2} />
      </span>
      <span>{option.label}</span>
    </span>
  );
}
const transactionTypeTabs = [
  { value: "expense", label: "Chi", icon: ArrowUpRight },
  { value: "income", label: "Thu", icon: ArrowDownLeft },
  { value: "transfer", label: "Chuyển", icon: ArrowLeftRight },
] satisfies {
  value: TransactionType;
  label: string;
  icon: typeof ArrowUpRight;
}[];

function LatestTransactionsLabel({ mobile = false }: { mobile?: boolean }) {
  return (
    <div
      className="ledger-latest-transactions-label"
      data-mobile={mobile || undefined}
    >
      <span>{mobile ? "Giao dịch gần đây" : "Giao dịch mới nhất"}</span>
    </div>
  );
}

function TransactionReviewSheetContent({
  item,
  currency,
  busy,
  onReview,
  onClose,
}: {
  item: LedgerItem;
  currency: string;
  busy: boolean;
  onReview: (approve: boolean) => void;
  onClose: () => void;
}) {
  const isDeleteReview = item.pendingChangeAction === "delete";
  const categoryName = item.category?.name ?? "Chưa phân loại";
  const amountPrefix =
    item.type === "income" ? "+" : item.type === "expense" ? "−" : "↔";

  function review(approve: boolean) {
    onClose();
    onReview(approve);
  }

  return (
    <SheetContent
      side="bottom"
      className={`ledger-mobile-review-sheet${isDeleteReview ? " pending-delete" : ""}`}
      aria-label={
        isDeleteReview
          ? "Duyệt yêu cầu xóa giao dịch"
          : "Duyệt yêu cầu sửa giao dịch"
      }
    >
      <SheetHeader className="ledger-mobile-review-header">
        <div className="ledger-mobile-review-heading">
          <span aria-hidden="true">
            {isDeleteReview ? <Trash2 size={18} /> : <Pencil size={18} />}
          </span>
          <div>
            <SheetTitle>
              {item.pendingChangeRequester ?? "Thành viên"}{" "}
              {isDeleteReview ? "đề nghị xóa giao dịch" : "đã sửa giao dịch"}
            </SheetTitle>
            <SheetDescription>
              {isDeleteReview
                ? "Kiểm tra lý do trước khi duyệt xóa"
                : `Yêu cầu chỉnh sửa · ${item.pendingChangeDetails.length} thay đổi`}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="ledger-mobile-review-body">
        <div className="ledger-mobile-review-transaction">
          <div>
            <span>{categoryName}</span>
          </div>
          <strong>
            {amountPrefix}
            {formatAmount(item.amount)} {currency}
          </strong>
        </div>
        {isDeleteReview ? (
          <div className="ledger-mobile-delete-reason">
            <span>Lý do xóa</span>
            <p>{item.pendingChangeReason ?? "Không có lý do"}</p>
          </div>
        ) : (
          <div className="ledger-mobile-review-comparisons">
            {item.pendingChangeDetails.map((detail) => {
              const unit = detail.label === "Số tiền" ? ` ${currency}` : "";
              return (
                <section key={detail.label}>
                  <h3>{detail.label}</h3>
                  <div>
                    <del>
                      {detail.previous}
                      {unit}
                    </del>
                    <span aria-hidden="true">→</span>
                    <strong>
                      {detail.proposed}
                      {unit}
                    </strong>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <SheetFooter className="ledger-mobile-review-actions">
        <Button
          variant="outline"
          className="ledger-mobile-review-reject"
          data-delete={isDeleteReview || undefined}
          disabled={busy}
          onClick={() => review(false)}
        >
          <X size={16} />
          Từ chối
        </Button>
        <Button
          variant="outline"
          className="ledger-mobile-review-approve"
          data-delete={isDeleteReview || undefined}
          disabled={busy}
          onClick={() => review(true)}
        >
          <Check size={16} />
          {isDeleteReview ? "Duyệt xóa" : "Duyệt sửa"}
        </Button>
      </SheetFooter>
    </SheetContent>
  );
}

function DesktopTransactionReviewSheet({
  item,
  currency,
  busy,
  onReview,
  onClose,
}: {
  item: LedgerItem;
  currency: string;
  busy: boolean;
  onReview: (approve: boolean) => void;
  onClose: () => void;
}) {
  const isDeleteReview = item.pendingChangeAction === "delete";
  const categoryName = item.category?.name ?? "Chưa phân loại";
  const amountPrefix =
    item.type === "income" ? "+" : item.type === "expense" ? "−" : "↔";

  function review(approve: boolean) {
    onClose();
    onReview(approve);
  }

  return (
    <SheetContent
      side="right"
      className="ledger-desktop-review-sheet w-full gap-0 border-l border-[var(--border)] bg-[var(--surface)] p-0 sm:!w-[min(100vw,32rem)] sm:!max-w-none"
      aria-label={
        isDeleteReview
          ? "Duyệt yêu cầu xóa giao dịch"
          : "Duyệt yêu cầu sửa giao dịch"
      }
    >
      <SheetHeader className="ledger-desktop-review-header">
        <SheetTitle>
          {isDeleteReview ? "Yêu cầu xóa giao dịch" : "Yêu cầu sửa giao dịch"}
        </SheetTitle>
        <SheetDescription>
          <strong>{item.pendingChangeRequester ?? "Thành viên"}</strong>{" "}
          {isDeleteReview
            ? "đề nghị xóa giao dịch này."
            : `đã thay đổi ${item.pendingChangeDetails.length} mục.`}
        </SheetDescription>
      </SheetHeader>

      <div className="ledger-desktop-review-body">
        <section className="ledger-desktop-review-summary">
          <div>
            <span>Danh mục</span>
            <strong>{categoryName}</strong>
          </div>
          <div>
            <span>Số tiền</span>
            <strong>
              {amountPrefix}
              {formatAmount(item.amount)} {currency}
            </strong>
          </div>
        </section>

        {isDeleteReview ? (
          <section className="ledger-desktop-delete-reason">
            <h3>Lý do xóa</h3>
            <p>{item.pendingChangeReason ?? "Không có lý do"}</p>
          </section>
        ) : (
          <section className="ledger-desktop-review-changes">
            <h3>Chi tiết thay đổi</h3>
            <div>
              {item.pendingChangeDetails.map((detail) => {
                const unit = detail.label === "Số tiền" ? ` ${currency}` : "";
                return (
                  <dl key={detail.label}>
                    <dt>{detail.label}</dt>
                    <dd>
                      <del>
                        {detail.previous}
                        {unit}
                      </del>
                      <span aria-hidden="true">→</span>
                      <strong>
                        {detail.proposed}
                        {unit}
                      </strong>
                    </dd>
                  </dl>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <SheetFooter className="ledger-desktop-review-footer">
        <Button
          variant="outline"
          className="ledger-desktop-review-reject"
          data-delete={isDeleteReview || undefined}
          disabled={busy}
          onClick={() => review(false)}
        >
          <X size={16} />
          Từ chối
        </Button>
        <Button
          variant="outline"
          className="ledger-desktop-review-approve"
          data-delete={isDeleteReview || undefined}
          disabled={busy}
          onClick={() => review(true)}
        >
          <Check size={16} />
          {isDeleteReview ? "Duyệt xóa" : "Duyệt sửa"}
        </Button>
      </SheetFooter>
    </SheetContent>
  );
}

function MobileTransactionRow({
  item,
  currency,
  selected,
  selectionMode,
  canApprove,
  canEditTransactions,
  isAdmin,
  readonly,
  busy,
  onToggle,
  onApprove,
  onReject,
  onReviewChange,
  onEdit,
  onDelete,
}: {
  item: LedgerItem;
  currency: string;
  selected: boolean;
  selectionMode: boolean;
  canApprove: boolean;
  canEditTransactions: boolean;
  isAdmin: boolean;
  readonly: boolean;
  busy: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  onReviewChange: (approve: boolean) => void;
  onEdit: () => void;
  onDelete: (reason: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [mobileDeleteReason, setMobileDeleteReason] = useState("");
  const isChangeReview = Boolean(
    canApprove &&
    item.pendingChangeRequestId &&
    (item.pendingChangeAction === "update" ||
      item.pendingChangeAction === "delete"),
  );
  const isDeleteReview = item.pendingChangeAction === "delete";
  const longPressEnabled =
    !isChangeReview && !selectionMode && !menuOpen && !deleteConfirmOpen;
  const { isPressing, handlers } = useLongPress(
    () => setMenuOpen(true),
    longPressEnabled,
  );
  const actions = getMobileLedgerActions({
    canApprove,
    canEdit: canEditTransactions,
    canDelete: !readonly && item.canRequestDelete,
    hasPendingChange: item.hasPendingChange,
    status: item.status,
  });
  const categoryName = item.category?.name ?? "Chưa phân loại";
  const amountPrefix =
    item.type === "income" ? "+" : item.type === "expense" ? "−" : "↔";

  function run(action: () => void) {
    setMenuOpen(false);
    action();
  }

  const rowHandlers = selectionMode
    ? {
        ...handlers,
        onClick: (event: React.MouseEvent<HTMLElement>) => {
          event.preventDefault();
          if (!busy) onToggle();
        },
        onContextMenu: (event: React.MouseEvent<HTMLElement>) => {
          event.preventDefault();
        },
        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!busy) onToggle();
            return;
          }
          if (
            event.key === "ContextMenu" ||
            (event.shiftKey && event.key === "F10")
          ) {
            event.preventDefault();
          }
        },
      }
    : handlers;

  const rowContent = (
    <>
      <div className="ledger-mobile-row-category">
        <CategoryIcon
          category={
            item.category ?? {
              color: "var(--text-muted)",
              icon: "tag",
            }
          }
          size={14}
          className="ledger-mobile-row-category-icon"
        />
        <span className="ledger-mobile-row-category-copy">
          <strong
            style={{ color: item.category?.color ?? "var(--text-muted)" }}
          >
            {categoryName}
          </strong>
          {item.status === "scheduled" && (
            <small className="ledger-mobile-scheduled-date">
              Ghi nhận {formatLedgerDate(item.date)}
            </small>
          )}
        </span>
      </div>
      <b
        className={`ledger-mobile-row-amount amount-${item.type}`}
        aria-hidden="true"
      >
        {amountPrefix}
        {formatAmount(item.amount)}
      </b>
      {isChangeReview && (
        <div className="ledger-mobile-review-summary">
          <small>
            <b>{item.pendingChangeRequester ?? "Thành viên"}</b>{" "}
            {isDeleteReview
              ? "đề nghị xóa giao dịch"
              : `đề nghị sửa ${item.pendingChangeDetails.length} mục`}
          </small>
          <ChevronRight size={15} aria-hidden="true" />
        </div>
      )}
    </>
  );

  if (isChangeReview) {
    return (
      <Sheet open={reviewSheetOpen} onOpenChange={setReviewSheetOpen}>
        <SheetTrigger
          nativeButton={false}
          render={
            <article
              className={`ledger-mobile-row ledger-mobile-review-row${isDeleteReview ? " pending-delete" : ""}`}
              aria-label={`${categoryName}, ${amountPrefix}${formatAmount(item.amount)} ${currency}. ${isDeleteReview ? "Chờ duyệt xóa." : `Chờ duyệt ${item.pendingChangeDetails.length} thay đổi.`}`}
            />
          }
        >
          {rowContent}
        </SheetTrigger>
        <TransactionReviewSheetContent
          item={item}
          currency={currency}
          busy={busy}
          onClose={() => setReviewSheetOpen(false)}
          onReview={onReviewChange}
        />
      </Sheet>
    );
  }

  return (
    <>
      <DropdownMenu
        open={!selectionMode && menuOpen}
        onOpenChange={(open) => {
          if (!selectionMode) setMenuOpen(open);
        }}
      >
        <SpotlightTrigger
          open={!selectionMode && menuOpen}
          onOpenChange={(open) => {
            if (!selectionMode) setMenuOpen(open);
          }}
          render={
            <article
              className="ledger-mobile-row"
              data-pressing={isPressing || undefined}
              data-selected={selected || undefined}
              data-selection-mode={selectionMode || undefined}
              aria-label={`${categoryName}, ${amountPrefix}${formatAmount(item.amount)} ${currency}. Nhấn giữ để mở thao tác.`}
              {...rowHandlers}
            />
          }
          dismissLabel={`Đóng menu thao tác ${categoryName}`}
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
          sideOffset={4}
          className="ledger-mobile-context-menu"
        >
          {actions.includes("select") && (
            <DropdownMenuItem onClick={() => run(onToggle)} disabled={busy}>
              <Check aria-hidden="true" />
              {selected ? "Bỏ chọn" : "Chọn"}
            </DropdownMenuItem>
          )}
          {actions.includes("approve") && (
            <DropdownMenuItem onClick={() => run(onApprove)} disabled={busy}>
              <CircleCheckBig aria-hidden="true" />
              Duyệt giao dịch
            </DropdownMenuItem>
          )}
          {actions.includes("reject") && (
            <DropdownMenuItem onClick={() => run(onReject)} disabled={busy}>
              <X aria-hidden="true" />
              Từ chối giao dịch
            </DropdownMenuItem>
          )}
          {actions.includes("approve-early") && (
            <DropdownMenuItem onClick={() => run(onApprove)} disabled={busy}>
              <CircleCheckBig aria-hidden="true" />
              Ghi nhận sớm
            </DropdownMenuItem>
          )}
          {actions.includes("edit") && (
            <DropdownMenuItem onClick={() => run(onEdit)} disabled={busy}>
              <Pencil aria-hidden="true" />
              Chỉnh sửa
            </DropdownMenuItem>
          )}
          {actions.includes("delete") && (
            <>
              {actions.some((action) => action !== "delete") && (
                <DropdownMenuSeparator />
              )}
              <DropdownMenuItem
                className="ledger-mobile-context-delete"
                disabled={busy}
                onClick={() => {
                  setMenuOpen(false);
                  setDeleteConfirmOpen(true);
                }}
              >
                <Trash2 aria-hidden="true" />
                Xóa giao dịch
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          setDeleteConfirmOpen(open);
          if (!open) setMobileDeleteReason("");
        }}
      >
        <SheetContent
          side="bottom"
          className="ledger-mobile-review-sheet pending-delete"
          aria-label="Xác nhận xóa giao dịch"
        >
          <SheetHeader className="ledger-mobile-review-header">
            <div className="ledger-mobile-review-heading">
              <span aria-hidden="true">
                <Trash2 size={18} />
              </span>
              <div>
                <SheetTitle>Xóa giao dịch?</SheetTitle>
                <SheetDescription>
                  {isAdmin
                    ? "Số dư ví sẽ được hoàn tác sau khi xóa."
                    : "Yêu cầu sẽ được gửi đến Admin để duyệt."}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="ledger-mobile-review-body">
            <div className="ledger-mobile-review-transaction">
              <div>
                <span>{categoryName}</span>
              </div>
              <strong>
                {amountPrefix}
                {formatAmount(item.amount)} {currency}
              </strong>
            </div>
            {!isAdmin && (
              <label className="ledger-mobile-delete-reason-field">
                <span>Lý do xóa</span>
                <Textarea
                  className="ledger-reason"
                  value={mobileDeleteReason}
                  onChange={(event) =>
                    setMobileDeleteReason(event.target.value)
                  }
                  placeholder="Nhập lý do xóa (bắt buộc)"
                  required
                  maxLength={2000}
                />
              </label>
            )}
          </div>

          <SheetFooter className="ledger-mobile-review-actions">
            <Button
              variant="outline"
              className="ledger-mobile-review-reject"
              data-delete
              disabled={busy}
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Hủy
            </Button>
            <Button
              variant="outline"
              className="ledger-mobile-review-approve"
              data-delete
              disabled={busy || (!isAdmin && !mobileDeleteReason.trim())}
              onClick={() => {
                setDeleteConfirmOpen(false);
                onDelete(mobileDeleteReason);
              }}
            >
              <Trash2 size={16} />
              {isAdmin ? "Xóa giao dịch" : "Gửi yêu cầu"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function DesktopReviewRequestRow({
  item,
  currency,
  columnCount,
  busy,
  onReview,
}: {
  item: LedgerItem;
  currency: string;
  columnCount: number;
  busy: boolean;
  onReview: (approve: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const isDeleteReview = item.pendingChangeAction === "delete";

  return (
    <tr
      className="ledger-pending-change-detail-row"
      data-review-action={isDeleteReview ? "delete" : "update"}
    >
      <td className="ledger-pending-change-detail-cell" colSpan={columnCount}>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            nativeButton
            render={
              <button type="button" className="ledger-pending-change-trigger" />
            }
          >
            <span className="ledger-pending-change-link">
              <strong>{item.pendingChangeRequester ?? "Thành viên"}</strong>{" "}
              {isDeleteReview
                ? "đề nghị xóa giao dịch"
                : `đề nghị sửa ${item.pendingChangeDetails.length} mục`}
              <ChevronRight size={14} aria-hidden="true" />
            </span>
          </SheetTrigger>
          <DesktopTransactionReviewSheet
            item={item}
            currency={currency}
            busy={busy}
            onClose={() => setOpen(false)}
            onReview={onReview}
          />
        </Sheet>
      </td>
    </tr>
  );
}

function defaultDestination(wallets: Option[], sourceId: string) {
  return wallets.find((wallet) => wallet.id !== sourceId)?.id ?? sourceId;
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
  const walletId = wallets[0]?.id ?? "";
  return {
    description: "",
    type: "expense",
    categoryId:
      categoriesForTransactionType(categories, "expense")[0]?.id ?? "none",
    walletId,
    toWalletId: defaultDestination(wallets, walletId),
    date: businessDate,
    amount: "",
  };
}

function draftFromTransaction(
  item: LedgerItem,
  wallets: Option[],
): TransactionDraft {
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
  return (
    item.description !== (draft.description || null) ||
    item.type !== draft.type ||
    item.categoryId !==
      (draft.categoryId === "none" ? null : draft.categoryId) ||
    item.walletId !== draft.walletId ||
    item.toWalletId !== (draft.type === "transfer" ? draft.toWalletId : null) ||
    item.date.slice(0, 10) !== draft.date ||
    item.amount !== draft.amount
  );
}

function requiresReview(item: LedgerItem): boolean {
  return item.status === "pending" || item.pendingChangeRequestId !== null;
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
}) {
  const [query, setQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeValue | null>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteReason, setDeleteReason] = useState("");
  const [createDraft, setCreateDraft] = useState<TransactionDraft | null>(() =>
    startWithNewTransaction && wallets.length
      ? newTransactionDraft(wallets, categories, businessDate)
      : null,
  );
  const [mobileEditTarget, setMobileEditTarget] = useState<LedgerItem | null>(
    null,
  );
  const [mobileEditDraft, setMobileEditDraft] =
    useState<TransactionDraft | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileBulkDeleteOpen, setMobileBulkDeleteOpen] = useState(false);
  const [mobileScheduledOpen, setMobileScheduledOpen] = useState(false);
  const [desktopScheduledOpen, setDesktopScheduledOpen] = useState(false);
  const mobileFilterRef = useRef<HTMLDivElement>(null);
  const [busy, start] = useTransition();
  const hasActiveFilters =
    query.trim().length > 0 || dateRange !== null || filterCategory !== "";
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
          (filterCategory === "" ||
            (item.categoryId !== null &&
              categoryFilterIds.has(item.categoryId))) &&
          `${item.description ?? ""} ${item.category?.name ?? ""} ${item.wallet} ${item.member}`
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase())
        );
      }),
    [transactions, dateRange, filterCategory, categoryFilterIds, query],
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
  const visibleRows = rows;
  const selectableRows = visibleRows.filter((item) => !requiresReview(item));
  const allSelected =
    selectableRows.length > 0 &&
    selectableRows.every((row) => selected.has(row.id));
  const columnCount = canApprove ? 8 : 7;
  const pageStart = latestRows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(page * pageSize, latestRows.length);

  useEffect(() => {
    if (!mobileFilterOpen) return;

    function closeOnOutsidePress(event: PointerEvent) {
      const target = event.target as Element;
      if (!target || !document.contains(target)) return;

      if (
        !mobileFilterRef.current?.contains(target) &&
        !target.closest(
          '[data-radix-popper-content-wrapper], [role="dialog"], .date-range-picker-popover, [data-slot="select-content"], [data-slot="select-positioner"]',
        )
      ) {
        setMobileFilterOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileFilterOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileFilterOpen]);

  function clearFilters() {
    setQuery("");
    setDateRange(null);
    setFilterCategory("");
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
  function setMobileScheduledSheetOpen(open: boolean) {
    if (!open) {
      const scheduledIds = new Set(scheduledRows.map((item) => item.id));
      setSelected(
        (current) =>
          new Set([...current].filter((id) => !scheduledIds.has(id))),
      );
    }
    setMobileScheduledOpen(open);
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
      } else {
        toast.error(result.message ?? "Không thể xử lý yêu cầu.");
      }
    });
  }
  function beginCreate() {
    setMobileEditTarget(null);
    setMobileEditDraft(null);
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
  function beginMobileEdit(item: LedgerItem) {
    setCreateDraft(null);
    setMobileEditTarget(item);
    setMobileEditDraft(draftFromTransaction(item, wallets));
  }
  function cancelMobileEdit() {
    if (busy) return;
    setMobileEditTarget(null);
    setMobileEditDraft(null);
  }
  function saveMobileEdit() {
    if (!mobileEditTarget || !mobileEditDraft) return;
    if (!isChanged(mobileEditTarget, mobileEditDraft)) {
      toast.info("Không có thay đổi để lưu.");
      cancelMobileEdit();
      return;
    }

    const target = mobileEditTarget;
    const draft = mobileEditDraft;
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
      if (result.ok || (result.updated ?? 0) + (result.requested ?? 0) > 0) {
        setMobileEditTarget(null);
        setMobileEditDraft(null);
      }
    });
  }

  function renderMobileTransaction(item: LedgerItem) {
    return (
      <MobileTransactionRow
        key={item.id}
        item={item}
        currency={currency}
        selected={selected.has(item.id)}
        selectionMode={selected.size > 0}
        canApprove={canApprove}
        canEditTransactions={canEditTransactions}
        isAdmin={isAdmin}
        readonly={readonly}
        busy={busy}
        onToggle={() => toggle(item.id)}
        onApprove={() => approveOne(item)}
        onReject={() => rejectOne(item)}
        onReviewChange={(approve) => reviewChange(item, approve)}
        onEdit={() => beginMobileEdit(item)}
        onDelete={(reason) => removeOne(item, reason)}
      />
    );
  }

  function renderDesktopScheduledTransaction(item: LedgerItem) {
    const amountPrefix =
      item.type === "income" ? "+" : item.type === "expense" ? "−" : "↔";
    const [year, month, day] = item.date.slice(0, 10).split("-");

    return (
      <article
        key={item.id}
        className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-stretch gap-5 rounded-xl bg-[var(--surface-secondary)] px-4 py-4"
      >
        <time
          dateTime={item.date}
          className="flex flex-col justify-center pr-4 text-center tabular-nums"
        >
          <span className="text-[0.62rem] font-semibold uppercase tracking-wider text-[var(--primary)]">
            Thg {Number(month)}
          </span>
          <strong className="mt-0.5 text-2xl font-semibold leading-none text-[var(--foreground)]">
            {day}
          </strong>
          <span className="mt-1 text-[0.62rem] text-[var(--text-muted)]">
            {year}
          </span>
        </time>
        <div className="min-w-0 self-center">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-[var(--foreground)]">
              {item.description || "Không có nội dung"}
            </h3>
            <TransactionTypeLabel type={item.type} variant="badge" />
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]">
            <span className="font-medium text-[var(--text-secondary)]">
              {item.wallet}
            </span>
            {item.toWallet && <span>→ {item.toWallet}</span>}
            {item.category && (
              <span className="inline-flex items-center gap-1">
                <CategoryIcon
                  category={item.category}
                  size={12}
                  aria-hidden="true"
                />
                {item.category.name}
              </span>
            )}
            <span>· {item.member}</span>
            {item.hasPendingChange && (
              <span className="text-[var(--warning)]">· Đang chờ duyệt</span>
            )}
          </p>
        </div>
        <div className="flex min-w-44 flex-col items-end justify-center gap-2.5">
          <strong
            className={`text-right text-base font-semibold tabular-nums amount-${item.type}`}
          >
            {amountPrefix}
            {formatAmount(item.amount)} {currency}
          </strong>
          <div className="flex items-center gap-1.5">
            {canApprove && (
              <Button
                variant="success"
                size="sm"
                disabled={busy}
                onClick={() => approveOne(item)}
                aria-label={`Ghi nhận sớm ${item.description || "giao dịch"}`}
                title="Ghi nhận sớm"
              >
                <CircleCheckBig size={14} />
                Ghi nhận
              </Button>
            )}
            {canEditTransactions && !item.hasPendingChange && (
              <Button
                variant="icon"
                size="icon"
                disabled={busy}
                onClick={() => {
                  setDesktopScheduledOpen(false);
                  beginMobileEdit(item);
                }}
                aria-label={`Chỉnh sửa ${item.description || "giao dịch"}`}
                title="Chỉnh sửa"
              >
                <Pencil size={16} />
              </Button>
            )}
            {!readonly && item.canRequestDelete && (
              <ConfirmDeletePopover
                ariaLabel={`Xóa ${item.description || "giao dịch"}`}
                title="Xóa giao dịch đã lên lịch?"
                description={
                  isAdmin
                    ? "Giao dịch sẽ bị xóa khỏi lịch ghi nhận."
                    : "Yêu cầu xóa sẽ được gửi đến Admin phê duyệt."
                }
                content={
                  !isAdmin ? (
                    <Textarea
                      value={deleteReason}
                      onChange={(event) => setDeleteReason(event.target.value)}
                      placeholder="Nhập lý do xóa (bắt buộc)"
                      aria-label="Lý do xóa giao dịch"
                      required
                      maxLength={2000}
                    />
                  ) : undefined
                }
                confirmLabel={isAdmin ? "Xóa" : "Gửi yêu cầu"}
                confirmDisabled={!isAdmin && !deleteReason.trim()}
                disabled={busy || item.hasPendingChange}
                trigger={
                  <Button
                    variant="destructiveIcon"
                    size="icon"
                    disabled={busy || item.hasPendingChange}
                    aria-label={`Xóa ${item.description || "giao dịch"}`}
                  >
                    <Trash2 size={16} />
                  </Button>
                }
                onOpenChange={() => setDeleteReason("")}
                onConfirm={() => removeOne(item, deleteReason)}
              />
            )}
          </div>
        </div>
      </article>
    );
  }

  function renderTableTransaction(item: LedgerItem) {
    return (
      <Fragment key={item.id}>
        <tr
          className={`ledger-transaction-row border-b border-[var(--border)] ${isDesktop ? "transition-colors hover:bg-[var(--surface-hover)]" : ""}`}
          data-pending-change={
            canApprove && item.pendingChangeRequestId
              ? (item.pendingChangeAction ?? "update")
              : undefined
          }
        >
          {canApprove && (
            <td className={isDesktop ? "py-4 pl-5" : undefined}>
              {!requiresReview(item) && (
                <Checkbox
                  checked={selected.has(item.id)}
                  onCheckedChange={() => toggle(item.id)}
                  aria-label={`Chọn giao dịch ${item.description || item.id}`}
                />
              )}
            </td>
          )}
          <td
            className={`ledger-description-column ${isDesktop ? "px-5 py-4" : ""}`}
          >
            <p className="font-medium">
              {item.description || "Không có nội dung"}
            </p>
            <p className="ledger-transaction-meta mt-1 text-xs text-[var(--text-muted)]">
              <span>
                {item.member}
                {item.isRecurring ? " · Tự động" : ""}
              </span>
            </p>
          </td>
          <td className={`ledger-type-column ${isDesktop ? "px-4 py-4" : ""}`}>
            <TransactionTypeLabel type={item.type} variant="badge" />
          </td>
          <td
            className={`ledger-wallet-column ${isDesktop ? "px-4 py-4 text-xs text-[var(--text-secondary)]" : ""}`}
          >
            {item.wallet}
            {item.toWallet ? (
              <small className="ledger-wallet-destination">
                → {item.toWallet}
              </small>
            ) : null}
          </td>
          <td
            className={`ledger-date-column ${isDesktop ? "px-4 py-4 text-xs text-[var(--text-secondary)] tabular-nums" : ""}`}
          >
            {formatLedgerDate(item.date)}
          </td>
          <td
            className={`ledger-category-column ${isDesktop ? "px-4 py-4" : ""}`}
          >
            {item.category ? (
              <span
                className={`category-tag ${isDesktop ? "inline-flex items-center gap-1.5 text-xs font-medium" : ""}`}
                style={{
                  backgroundColor: `${item.category.color}22`,
                  color: item.category.color,
                }}
              >
                <CategoryIcon
                  category={item.category}
                  size={13}
                  className="ledger-category-icon"
                />
                {item.category.name}
              </span>
            ) : (
              "—"
            )}
          </td>
          <td
            className={`ledger-amount ledger-amount-column amount-${item.type} ${isDesktop ? "px-4 py-4 text-right text-sm font-semibold tabular-nums" : ""}`}
          >
            {item.type === "income" ? "+" : item.type === "expense" ? "−" : "↔"}
            {formatAmount(item.amount)} {currency}
          </td>
          <td
            className={`ledger-actions-column ${isDesktop ? "py-4 pl-2 pr-5" : ""}`}
          >
            <div className="ledger-row-actions">
              {canApprove && item.pendingChangeRequestId && (
                <Button
                  variant="icon"
                  size="icon"
                  className="ledger-review-reject-button"
                  disabled={busy}
                  onClick={() => reviewChange(item, false)}
                  title={`Từ chối yêu cầu ${item.pendingChangeAction === "delete" ? "xóa" : "sửa"}`}
                  aria-label={`Từ chối yêu cầu ${item.pendingChangeAction === "delete" ? "xóa" : "sửa"}`}
                >
                  <X size={16} />
                </Button>
              )}
              {canApprove && item.pendingChangeRequestId && (
                <Button
                  variant="icon"
                  size="icon"
                  className="ledger-review-approve-button"
                  disabled={busy}
                  onClick={() => reviewChange(item, true)}
                  title={`Duyệt yêu cầu ${item.pendingChangeAction === "delete" ? "xóa" : "sửa"}`}
                  aria-label={`Duyệt yêu cầu ${item.pendingChangeAction === "delete" ? "xóa" : "sửa"}`}
                >
                  <Check size={16} />
                </Button>
              )}
              {canApprove &&
                !item.pendingChangeRequestId &&
                item.status === "pending" && (
                  <Button
                    variant="icon"
                    size="icon"
                    className="ledger-review-reject-button"
                    disabled={busy}
                    onClick={() => rejectOne(item)}
                    title="Từ chối giao dịch"
                    aria-label={`Từ chối ${item.description || "giao dịch"}`}
                  >
                    <X size={16} />
                  </Button>
                )}
              {canApprove &&
                !item.pendingChangeRequestId &&
                item.status === "pending" && (
                  <Button
                    variant="icon"
                    size="icon"
                    className="ledger-review-approve-button"
                    disabled={busy}
                    onClick={() => approveOne(item)}
                    title="Duyệt giao dịch"
                    aria-label={`Duyệt ${item.description || "giao dịch"}`}
                  >
                    <Check size={16} />
                  </Button>
                )}
              {canApprove && item.status === "scheduled" && (
                <Button
                  variant="icon"
                  size="icon"
                  disabled={busy}
                  onClick={() => approveOne(item)}
                  title="Ghi nhận sớm"
                  aria-label={`Ghi nhận sớm ${item.description || "giao dịch"}`}
                >
                  <CircleCheckBig size={16} />
                </Button>
              )}
              {canEditTransactions && !item.hasPendingChange && (
                <Button
                  variant="icon"
                  size="icon"
                  disabled={busy}
                  onClick={() => beginMobileEdit(item)}
                  title="Chỉnh sửa giao dịch"
                  aria-label={`Chỉnh sửa ${item.description || "giao dịch"}`}
                >
                  <Pencil size={16} />
                </Button>
              )}
              {!readonly && item.canRequestDelete && !requiresReview(item) && (
                <ConfirmDeletePopover
                  ariaLabel={`Xóa ${item.description || "giao dịch"}`}
                  title="Xóa giao dịch?"
                  description={
                    isAdmin
                      ? "Nếu đã ghi nhận, số dư ví sẽ được hoàn tác."
                      : "Giao dịch chỉ bị xóa sau khi Admin duyệt."
                  }
                  content={
                    !isAdmin ? (
                      <Textarea
                        className="ledger-reason"
                        value={deleteReason}
                        onChange={(event) =>
                          setDeleteReason(event.target.value)
                        }
                        placeholder="Nhập lý do xóa (bắt buộc)"
                        aria-label="Lý do xóa giao dịch"
                        required
                        maxLength={2000}
                      />
                    ) : undefined
                  }
                  confirmLabel={isAdmin ? "Xóa" : "Gửi yêu cầu"}
                  confirmDisabled={!isAdmin && !deleteReason.trim()}
                  className="ledger-delete-button"
                  disabled={busy || item.hasPendingChange}
                  onOpenChange={() => setDeleteReason("")}
                  onConfirm={() => removeOne(item, deleteReason)}
                />
              )}
            </div>
          </td>
        </tr>
        {canApprove && item.pendingChangeRequestId && (
          <DesktopReviewRequestRow
            item={item}
            currency={currency}
            columnCount={columnCount}
            busy={busy}
            onReview={(approve) => reviewChange(item, approve)}
          />
        )}
      </Fragment>
    );
  }

  return (
    <div
      className={
        isDesktop ? "flex h-full min-h-0 flex-1 flex-col" : "ledger-shell"
      }
    >
      <div
        className={
          isDesktop
            ? "flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-6 py-4"
            : "ledger-toolbar"
        }
      >
        <Search
          containerClassName={isDesktop ? "w-[22rem]" : ""}
          value={query}
          onChange={(event) => changeFilter(() => setQuery(event.target.value))}
          placeholder="Tìm giao dịch"
          aria-label="Tìm giao dịch hoặc ghi chú"
        />
        {isDesktop ? (
          <Popover open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="info"
                  type="button"
                  aria-label="Mở bộ lọc giao dịch"
                />
              }
            >
              <SlidersHorizontal size={16} />
              Bộ lọc
              {hasActiveFilters && (
                <span className="text-[0.68rem] font-semibold">
                  Đang áp dụng
                </span>
              )}
            </PopoverTrigger>
            <PopoverContent
              align="start"
              sideOffset={8}
              elevation="flat"
              className="w-[30rem] max-w-[calc(100vw-2rem)]"
            >
              <PopoverHeader className="border-b border-[var(--border)] px-1 pb-3 pt-1">
                <PopoverTitle className="font-semibold text-[var(--foreground)]">
                  Lọc sổ giao dịch
                </PopoverTitle>
                <PopoverDescription className="mt-1 text-xs text-[var(--text-muted)]">
                  Thu hẹp danh sách theo thời gian và danh mục trong{" "}
                  {scopeLabel}.
                </PopoverDescription>
              </PopoverHeader>
              <div className="grid grid-cols-2 gap-4 px-1 py-3">
                <div className="space-y-1.5">
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
                    className="w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Danh mục
                  </span>
                  <CategoryTreeSelect
                    value={filterCategory}
                    ariaLabel="Lọc danh mục"
                    placeholder="Tất cả danh mục"
                    categories={categories}
                    emptyOption={{ value: "", label: "Tất cả danh mục" }}
                    onValueChange={(value) =>
                      changeFilter(() => setFilterCategory(value))
                    }
                    className="w-full"
                  />
                </div>
              </div>
              <footer className="flex items-center justify-between gap-4 border-t border-[var(--border)] px-1 pt-3">
                <span className="text-xs text-[var(--text-muted)]">
                  {hasActiveFilters
                    ? `${filteredRows.length} giao dịch phù hợp`
                    : "Đang hiển thị toàn bộ dữ liệu"}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    disabled={!hasActiveFilters}
                    onClick={clearFilters}
                  >
                    <FilterX size={14} />
                    Đặt lại
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    type="button"
                    onClick={() => setMobileFilterOpen(false)}
                  >
                    Xong
                  </Button>
                </div>
              </footer>
            </PopoverContent>
          </Popover>
        ) : (
          <div className="ledger-filter-popover" ref={mobileFilterRef}>
            <Button
              variant="icon"
              size="icon"
              type="button"
              className="ledger-filter-popover-trigger"
              aria-label={`${mobileFilterOpen ? "Đóng bộ lọc" : "Mở bộ lọc"}${hasActiveFilters ? " (đang lọc)" : ""}`}
              aria-haspopup="dialog"
              aria-expanded={mobileFilterOpen}
              onClick={() => setMobileFilterOpen((o) => !o)}
            >
              <SlidersHorizontal size={16} />
              {hasActiveFilters && (
                <span className="ledger-filter-badge" aria-hidden="true" />
              )}
            </Button>
            {mobileFilterOpen && (
              <div
                className="ledger-filter-popover-panel"
                role="dialog"
                aria-label="Bộ lọc giao dịch"
              >
                <div className="ledger-filter-popover-row">
                  <label className="ledger-filter-popover-label">
                    Khoảng thời gian
                  </label>
                  <DateRangePicker
                    value={dateRange}
                    ariaLabel="Lọc theo khoảng thời gian"
                    allowClear
                    onValueChange={(value) =>
                      changeFilter(() => setDateRange(value))
                    }
                    className="ledger-filter-popover-select"
                  />
                </div>
                <div className="ledger-filter-popover-row">
                  <label className="ledger-filter-popover-label">
                    Danh mục
                  </label>
                  <CategoryTreeSelect
                    value={filterCategory}
                    ariaLabel="Lọc danh mục"
                    placeholder="Tất cả danh mục"
                    categories={categories}
                    emptyOption={{ value: "", label: "Tất cả danh mục" }}
                    onValueChange={(value) =>
                      changeFilter(() => setFilterCategory(value))
                    }
                    className="ledger-filter-popover-select"
                  />
                </div>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ledger-filter-popover-clear"
                    onClick={() => {
                      clearFilters();
                      setMobileFilterOpen(false);
                    }}
                  >
                    <FilterX size={14} />
                    Xóa bộ lọc
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
        {!isDesktop && scheduledRows.length > 0 && (
          <div className="order-1 shrink-0">
            <Sheet
              open={mobileScheduledOpen}
              onOpenChange={setMobileScheduledSheetOpen}
            >
              <SheetTrigger
                render={
                  <Button
                    type="button"
                    variant="warning"
                    size="icon"
                    className="w-8 bg-transparent"
                    aria-label={`Xem ${scheduledRows.length} giao dịch đã lên lịch`}
                  />
                }
              >
                <CalendarClock size={16} aria-hidden="true" />
              </SheetTrigger>
              <SheetContent
                side="bottom"
                className="ledger-scheduled-sheet"
                aria-label="Giao dịch đã lên lịch"
              >
                <SheetHeader className="ledger-scheduled-sheet-header">
                  <div className="ledger-scheduled-sheet-heading">
                    <span aria-hidden>
                      <CalendarClock size={18} />
                    </span>
                    <div>
                      <SheetTitle>Giao dịch đã lên lịch</SheetTitle>
                      <SheetDescription>
                        Các khoản sẽ tự động ghi nhận đúng ngày
                      </SheetDescription>
                    </div>
                  </div>
                  <strong className="ledger-scheduled-sheet-count">
                    {scheduledRows.length}
                  </strong>
                </SheetHeader>
                <div className="ledger-scheduled-sheet-body">
                  <div className="ledger-scheduled-sheet-summary">
                    <CalendarDays size={15} aria-hidden />
                    <span>
                      {scheduledRows.length} giao dịch đang chờ ngày thực thi
                    </span>
                  </div>
                  <div className="ledger-mobile-scheduled-rows">
                    {orderedScheduledRows.map(renderMobileTransaction)}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        )}
        {isDesktop && (
          <span className="mr-auto text-xs text-[var(--text-muted)] tabular-nums">
            {filteredRows.length} giao dịch
          </span>
        )}
        {isDesktop && scheduledRows.length > 0 && (
          <Button
            variant="warning"
            type="button"
            disabled={busy}
            onClick={() => setDesktopScheduledOpen(true)}
            aria-label={`Xem ${scheduledRows.length} giao dịch đã lên lịch`}
          >
            <CalendarClock size={16} />
            Đã lên lịch
            <span className="font-semibold tabular-nums">
              {scheduledRows.length}
            </span>
          </Button>
        )}
        {canApprove && selected.size > 0 && (
          <ConfirmDeletePopover
            ariaLabel={`Xóa ${selected.size} giao dịch đã chọn`}
            title={`Xóa ${selected.size} giao dịch?`}
            description="Giao dịch đã ghi nhận sẽ được hoàn tác khỏi số dư ví."
            confirmLabel="Xóa"
            className="ledger-delete-button max-[1023px]:hidden"
            disabled={busy}
            onConfirm={removeBulk}
          />
        )}
        {isDesktop && !readonly && (
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
                  disabled={busy || !wallets.length}
                  aria-label="Tạo giao dịch mới"
                />
              }
            >
              <Plus size={16} />
              Giao dịch mới
            </PopoverTrigger>
            {createDraft && (
              <PopoverContent
                align="end"
                side="bottom"
                sideOffset={8}
                elevation="flat"
                role="dialog"
                aria-label="Tạo giao dịch mới"
                className="w-[42rem] max-w-[calc(100vw-2rem)]"
              >
                <DesktopTransactionCreateDraft
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
              </PopoverContent>
            )}
          </Popover>
        )}
      </div>
      <Sheet
        open={isDesktop && desktopScheduledOpen}
        onOpenChange={setDesktopScheduledOpen}
      >
        <SheetContent
          side="right"
          placement="inset"
          size="wide"
          spacing="flush"
          elevation="flat"
          aria-label="Giao dịch đã lên lịch"
        >
          <SheetHeader className="px-6 py-5">
            <div className="flex items-start gap-5">
              <div className="flex min-w-0 items-start gap-3">
                <CalendarClock
                  className="mt-0.5 size-5 shrink-0 text-[var(--primary)]"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <SheetTitle className="text-lg font-semibold">
                    Giao dịch đã lên lịch
                  </SheetTitle>
                  <SheetDescription className="mt-1 max-w-md text-xs leading-5">
                    Theo dõi các khoản sẽ tự động ghi nhận và xử lý sớm khi cần.
                  </SheetDescription>
                </div>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-6 pl-8">
              <div>
                <dt className="text-[0.68rem] font-medium text-[var(--text-muted)]">
                  Đang chờ ghi nhận
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-[var(--foreground)]">
                  {scheduledRows.length} giao dịch
                </dd>
              </div>
              <div>
                <dt className="text-[0.68rem] font-medium text-[var(--text-muted)]">
                  Lịch gần nhất
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-[var(--foreground)]">
                  {nearestScheduledDate
                    ? formatLedgerDate(nearestScheduledDate)
                    : "—"}
                </dd>
              </div>
            </dl>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 pb-6">
            <div className="flex items-end justify-between gap-5 pb-2 pt-5">
              <div>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">
                  Lịch chờ ghi nhận
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Sắp xếp theo ngày thực hiện gần nhất.
                </p>
              </div>
              <span className="text-xs text-[var(--text-muted)]">
                {canApprove
                  ? "Có thể ghi nhận trước hạn"
                  : "Tự động xử lý đúng ngày"}
              </span>
            </div>
            {scheduledRows.length > 0 ? (
              orderedScheduledRows.map(renderDesktopScheduledTransaction)
            ) : (
              <Empty
                variant="compact"
                title="Không còn giao dịch đã lên lịch"
                description="Các khoản đã xử lý sẽ tự động rời khỏi danh sách này."
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
      <Sheet
        open={!isDesktop && Boolean(createDraft)}
        onOpenChange={(open) => {
          if (!open && !busy) setCreateDraft(null);
        }}
      >
        {!isDesktop && createDraft && (
          <SheetContent
            side="bottom"
            className="quick-transaction-sheet ledger-mobile-edit-sheet ledger-transaction-editor-sheet"
            aria-label="Tạo giao dịch"
          >
            <TransactionDraftSheetHeader mode="create" />
            <MobileTransactionDraft
              mode="create"
              showHeader={false}
              draft={createDraft}
              wallets={wallets}
              categories={categories}
              busy={busy}
              progressiveDetails
              onChange={(patch) =>
                setCreateDraft((current) =>
                  current ? { ...current, ...patch } : current,
                )
              }
              onSave={saveCreate}
              onCancel={() => setCreateDraft(null)}
            />
          </SheetContent>
        )}
      </Sheet>

      <div
        className="ledger-mobile-list"
        data-selection-mode={selected.size > 0 || undefined}
        aria-label="Danh sách giao dịch"
      >
        {canApprove && selected.size > 0 && (
          <>
            <div className="ledger-mobile-selection">
              <span>{selected.size} mục đã chọn</span>
              <div className="ledger-mobile-selection-actions">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                >
                  Bỏ chọn
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() => setMobileBulkDeleteOpen(true)}
                >
                  <Trash2 size={15} />
                  Xóa
                </Button>
              </div>
            </div>

            <Sheet
              open={mobileBulkDeleteOpen}
              onOpenChange={setMobileBulkDeleteOpen}
            >
              <SheetContent
                side="bottom"
                className="ledger-mobile-review-sheet pending-delete"
                aria-label={`Xác nhận xóa ${selected.size} giao dịch`}
              >
                <SheetHeader className="ledger-mobile-review-header">
                  <div className="ledger-mobile-review-heading">
                    <span aria-hidden="true">
                      <Trash2 size={18} />
                    </span>
                    <div>
                      <SheetTitle>Xóa {selected.size} giao dịch?</SheetTitle>
                      <SheetDescription>
                        Các giao dịch đã ghi nhận sẽ được hoàn tác khỏi số dư
                        ví.
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <div className="ledger-mobile-review-body">
                  <p className="ledger-mobile-bulk-delete-warning">
                    Hành động này sẽ xóa toàn bộ giao dịch đang chọn và không
                    thể hoàn tác.
                  </p>
                </div>

                <SheetFooter className="ledger-mobile-review-actions">
                  <Button
                    variant="outline"
                    className="ledger-mobile-review-reject"
                    data-delete
                    disabled={busy}
                    onClick={() => setMobileBulkDeleteOpen(false)}
                  >
                    Hủy
                  </Button>
                  <Button
                    variant="outline"
                    className="ledger-mobile-review-approve"
                    data-delete
                    disabled={busy}
                    onClick={() => {
                      setMobileBulkDeleteOpen(false);
                      removeBulk();
                    }}
                  >
                    <Trash2 size={16} />
                    Xóa giao dịch
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </>
        )}
        {scheduledRows.length > 0 && rows.length > 0 && (
          <LatestTransactionsLabel mobile />
        )}
        {groupTransactionsByDate(rows).map(({ dateKey, label, items }) => {
          const totals = getLedgerDateTotals(items);
          return (
            <section key={dateKey} className="ledger-date-group">
              <header className="ledger-date-group-header">
                <span>{label}</span>
                <strong className="shrink-0 text-[0.68rem] font-semibold tabular-nums text-[var(--expense)]">
                  Chi {totals.expense.isZero() ? "" : "−"}
                  {formatAmount(totals.expense)} {currency}
                </strong>
              </header>
              {items.map(renderMobileTransaction)}
            </section>
          );
        })}
        {!filteredRows.length && (
          <Empty
            variant="compact"
            title="Chưa có giao dịch phù hợp"
            description="Thử thay đổi tìm kiếm hoặc bộ lọc hiện tại."
          />
        )}
      </div>

      <div
        className={
          isDesktop
            ? "min-h-0 flex-1 overflow-auto overscroll-contain"
            : "ledger-scroll-area ledger-desktop-table"
        }
      >
        <table className="ledger-table w-full min-w-[1080px] text-left text-sm">
          <colgroup>
            {canApprove && <col className="ledger-selection-column" />}
            <col className="ledger-description-column" />
            <col className="ledger-type-column" />
            <col className="ledger-wallet-column" />
            <col className="ledger-date-column" />
            <col className="ledger-category-column" />
            <col className="ledger-amount-column" />
            <col className="ledger-actions-column" />
          </colgroup>
          <thead
            className={
              isDesktop ? "sticky top-0 z-20 bg-[var(--surface)]" : undefined
            }
          >
            <tr
              className={
                isDesktop
                  ? "border-b border-[var(--border)] text-[0.68rem] font-medium text-[var(--text-muted)]"
                  : "border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--text-muted)]"
              }
            >
              {canApprove && (
                <th className={isDesktop ? "w-12 py-3 pl-5" : "w-10"}>
                  <Checkbox
                    checked={allSelected}
                    disabled={selectableRows.length === 0}
                    onCheckedChange={toggleAll}
                    aria-label="Chọn tất cả giao dịch đang hiển thị"
                  />
                </th>
              )}
              <th
                className={
                  isDesktop
                    ? "ledger-description-column px-5 py-3"
                    : "ledger-description-column"
                }
              >
                Nội dung
              </th>
              <th
                className={
                  isDesktop
                    ? "ledger-type-column px-4 py-3"
                    : "ledger-type-column"
                }
              >
                Loại
              </th>
              <th
                className={
                  isDesktop
                    ? "ledger-wallet-column px-4 py-3"
                    : "ledger-wallet-column"
                }
              >
                Ví
              </th>
              <th
                className={
                  isDesktop
                    ? "ledger-date-column px-4 py-3"
                    : "ledger-date-column"
                }
              >
                Ngày
              </th>
              <th
                className={
                  isDesktop
                    ? "ledger-category-column px-4 py-3"
                    : "ledger-category-column"
                }
              >
                Danh mục
              </th>
              <th
                className={
                  isDesktop
                    ? "ledger-amount-column px-4 py-3 text-right"
                    : "ledger-amount-column text-right"
                }
              >
                Số tiền
              </th>
              <th
                className={
                  isDesktop
                    ? "ledger-actions-column py-3 pl-2 pr-5"
                    : "ledger-actions-column"
                }
              >
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody>
            {isDesktop
              ? groupTransactionsByDate(rows).map(
                  ({ dateKey, label, items }) => {
                    const totals = getLedgerDateTotals(items);
                    return (
                      <Fragment key={dateKey}>
                        <tr>
                          <td
                            colSpan={columnCount}
                            className="sticky top-[2.55rem] z-10 bg-[var(--surface-secondary)] px-5 py-2.5"
                          >
                            <div className="flex items-center justify-between gap-6">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <CalendarDays
                                  className="size-3.5 shrink-0 text-[var(--primary)]"
                                  aria-hidden="true"
                                />
                                <strong className="truncate text-xs font-semibold text-[var(--foreground)] tabular-nums">
                                  {label}
                                </strong>
                                <span className="shrink-0 text-[0.68rem] text-[var(--text-muted)]">
                                  {items.length} giao dịch
                                </span>
                              </div>
                              <div className="flex shrink-0 items-center gap-5 text-[0.68rem] font-medium tabular-nums">
                                {!totals.income.isZero() && (
                                  <span className="text-[var(--income)]">
                                    Thu +{formatAmount(totals.income)}{" "}
                                    {currency}
                                  </span>
                                )}
                                {!totals.expense.isZero() && (
                                  <span className="text-[var(--expense)]">
                                    Chi −{formatAmount(totals.expense)}{" "}
                                    {currency}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                        {items.map(renderTableTransaction)}
                      </Fragment>
                    );
                  },
                )
              : rows.map(renderTableTransaction)}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="p-4">
                  <Empty
                    variant="compact"
                    title="Chưa có giao dịch hiện tại"
                    description={
                      scheduledRows.length > 0
                        ? "Các giao dịch đang chờ được quản lý trong mục Đã lên lịch."
                        : "Thử thay đổi tìm kiếm hoặc bộ lọc hiện tại."
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer
        className={
          isDesktop
            ? "flex min-h-14 items-center justify-between gap-5 border-t border-[var(--border)] px-6 py-3"
            : "ledger-pagination"
        }
      >
        <p
          className={
            isDesktop
              ? "text-xs text-[var(--text-muted)]"
              : "ledger-record-count"
          }
        >
          {isDesktop ? (
            <span>
              Hiển thị {pageStart}–{pageEnd}/{latestRows.length} giao dịch mới
              nhất
              {scheduledRows.length
                ? ` · ${scheduledRows.length} giao dịch đã lên lịch`
                : ""}
            </span>
          ) : (
            <>
              <span className="ledger-record-count-desktop">
                Hiển thị {pageStart}–{pageEnd}/{latestRows.length} giao dịch mới
                nhất
                {scheduledRows.length
                  ? ` · ${scheduledRows.length} giao dịch đã lên lịch`
                  : ""}
              </span>
              <span className="ledger-record-count-mobile">
                {pageStart}–{pageEnd} / {latestRows.length}
              </span>
            </>
          )}
        </p>
        {pageCount > 1 && (
          <nav
            className={
              isDesktop
                ? "flex items-center gap-2 text-xs text-[var(--text-secondary)]"
                : undefined
            }
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
            <span>
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

      <Sheet
        open={isDesktop && Boolean(mobileEditTarget && mobileEditDraft)}
        onOpenChange={(open) => {
          if (!open) cancelMobileEdit();
        }}
      >
        {mobileEditTarget && mobileEditDraft && (
          <SheetContent
            side="right"
            placement="inset"
            size="wide"
            spacing="flush"
            elevation="flat"
            aria-label="Chỉnh sửa giao dịch"
          >
            <DesktopTransactionEditDraft
              item={mobileEditTarget}
              draft={mobileEditDraft}
              wallets={wallets}
              categories={categories}
              busy={busy}
              requiresApproval={!isAdmin}
              onChange={(patch) =>
                setMobileEditDraft((current) =>
                  current ? { ...current, ...patch } : current,
                )
              }
              onSave={saveMobileEdit}
              onCancel={cancelMobileEdit}
            />
          </SheetContent>
        )}
      </Sheet>

      <Sheet
        open={!isDesktop && Boolean(mobileEditTarget && mobileEditDraft)}
        onOpenChange={(open) => {
          if (!open) cancelMobileEdit();
        }}
      >
        {mobileEditTarget && mobileEditDraft && (
          <SheetContent
            side="bottom"
            className="quick-transaction-sheet ledger-mobile-edit-sheet"
            aria-label="Chỉnh sửa giao dịch"
          >
            <TransactionDraftSheetHeader
              mode="edit"
              title={
                mobileEditTarget.description || "Giao dịch chưa có nội dung"
              }
              disabled={!isAdmin && mobileEditTarget.hasPendingChange}
            />
            <MobileTransactionDraft
              key={mobileEditTarget.id}
              mode="edit"
              progressiveDetails
              title={
                mobileEditTarget.description || "Giao dịch chưa có nội dung"
              }
              draft={mobileEditDraft}
              wallets={wallets}
              categories={categories}
              busy={busy}
              disabled={!isAdmin && mobileEditTarget.hasPendingChange}
              showHeader={false}
              onChange={(patch) =>
                setMobileEditDraft((current) =>
                  current ? { ...current, ...patch } : current,
                )
              }
              onSave={saveMobileEdit}
              onCancel={cancelMobileEdit}
            />
          </SheetContent>
        )}
      </Sheet>

      {/* Floating Create Button for Desktop */}
      {!readonly && !isDesktop && (
        <Popover
          open={isDesktop && Boolean(createDraft)}
          onOpenChange={(open) => {
            if (open) beginCreate();
            else if (isDesktop && !busy) setCreateDraft(null);
          }}
        >
          <PopoverTrigger
            render={
              <Button
                variant="default"
                size="icon"
                className="ledger-floating-create-btn"
                disabled={busy || !wallets.length}
                title={createDraft ? "Đóng form giao dịch" : "Giao dịch mới"}
                aria-label={
                  createDraft ? "Đóng form tạo giao dịch" : "Tạo giao dịch mới"
                }
              />
            }
          >
            <Plus size={20} />
          </PopoverTrigger>
          {isDesktop && createDraft && (
            <PopoverContent
              align="end"
              side="top"
              sideOffset={12}
              role="dialog"
              aria-label="Tạo giao dịch mới"
              className="w-[38rem] max-w-[calc(100vw-2rem)]"
            >
              <MobileTransactionDraft
                mode="create"
                progressiveDetails
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
            </PopoverContent>
          )}
        </Popover>
      )}
    </div>
  );
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

function TransactionDraftSheetHeader({
  mode,
  title,
  disabled = false,
}: {
  mode: "create" | "edit";
  title?: string;
  disabled?: boolean;
}) {
  const Icon = mode === "create" ? Plus : Pencil;

  return (
    <SheetHeader className="wallet-edit-header ledger-transaction-sheet-header">
      <div className="wallet-edit-heading">
        <span aria-hidden="true">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <SheetTitle>
            {mode === "create" ? "Tạo giao dịch" : "Chỉnh sửa giao dịch"}
          </SheetTitle>
          <SheetDescription>
            {disabled
              ? "Giao dịch đang có yêu cầu thay đổi chờ duyệt"
              : mode === "create"
                ? "Nhập số tiền và thông tin giao dịch"
                : title || "Cập nhật thông tin giao dịch"}
          </SheetDescription>
        </div>
      </div>
    </SheetHeader>
  );
}

function DesktopTransactionEditDraft({
  item,
  draft,
  wallets,
  categories,
  busy,
  requiresApproval,
  onChange,
  onSave,
  onCancel,
}: {
  item: LedgerItem;
  draft: TransactionDraft;
  wallets: Option[];
  categories: CategoryOption[];
  busy: boolean;
  requiresApproval: boolean;
  onChange: (patch: Partial<TransactionDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const hasChanges = isChanged(item, draft);

  function changeType(type: TransactionType): void {
    onChange({
      type,
      categoryId: "none",
      toWalletId:
        type === "transfer"
          ? draft.toWalletId || defaultDestination(wallets, draft.walletId)
          : draft.toWalletId,
    });
  }

  return (
    <>
      <SheetHeader className="px-6 py-5">
        <div className="flex items-start gap-3">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--info)_12%,var(--surface))] text-[var(--info)]"
            aria-hidden="true"
          >
            <Pencil size={17} />
          </span>
          <div className="min-w-0 pt-0.5">
            <SheetTitle className="text-lg font-semibold">
              Chỉnh sửa giao dịch
            </SheetTitle>
            <SheetDescription className="mt-1 truncate text-xs">
              {item.description || "Giao dịch chưa có nội dung"} · {item.wallet}
              · {formatLedgerDate(item.date)}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">
        <Tabs
          value={draft.type}
          onValueChange={(value) => changeType(value as TransactionType)}
          className="gap-0"
        >
          <TabsList
            variant="navigation"
            className="grid-cols-3"
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
                    busy || (tab.value === "transfer" && wallets.length < 2)
                  }
                >
                  <Icon aria-hidden="true" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <section
            className="space-y-4 rounded-xl bg-[var(--surface-secondary)] p-5"
            aria-labelledby="edit-transaction-value-title"
          >
            <div>
              <h3
                id="edit-transaction-value-title"
                className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]"
              >
                <ArrowLeftRight
                  className="text-[var(--primary)]"
                  size={15}
                  aria-hidden="true"
                />
                Giá trị giao dịch
              </h3>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                Điều chỉnh số tiền, ví và danh mục liên quan.
              </p>
            </div>
            <MoneyInput
              autoFocus
              required
              disabled={busy}
              value={draft.amount}
              onValueChange={(amount) => onChange({ amount })}
              placeholder="0"
              label="Số tiền"
            />
            <Select
              disabled={busy || !wallets.length}
              value={draft.walletId}
              onValueChange={(walletId) =>
                onChange({
                  walletId,
                  toWalletId:
                    draft.toWalletId === walletId
                      ? defaultDestination(wallets, walletId)
                      : draft.toWalletId,
                })
              }
              label="Ví thực hiện"
              options={wallets.map((wallet) => ({
                value: wallet.id,
                label: wallet.name,
              }))}
            />
            {draft.type === "transfer" ? (
              <Select
                disabled={busy || !wallets.length}
                value={draft.toWalletId}
                onValueChange={(toWalletId) => onChange({ toWalletId })}
                label="Ví nhận"
                options={wallets.map((wallet) => ({
                  value: wallet.id,
                  label: wallet.name,
                  disabled: wallet.id === draft.walletId,
                }))}
              />
            ) : (
              <CategoryTreeSelect
                disabled={
                  busy ||
                  !categoriesForTransactionType(categories, draft.type).length
                }
                value={draft.categoryId}
                onValueChange={(categoryId) => onChange({ categoryId })}
                label="Danh mục"
                categories={categoriesForTransactionType(
                  categories,
                  draft.type,
                )}
                emptyOption={{ value: "none", label: "Không chọn" }}
              />
            )}
          </section>

          <section
            className="space-y-4 rounded-xl bg-[var(--surface-secondary)] p-5"
            aria-labelledby="edit-transaction-detail-title"
          >
            <div>
              <h3
                id="edit-transaction-detail-title"
                className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]"
              >
                <CalendarDays
                  className="text-[var(--primary)]"
                  size={15}
                  aria-hidden="true"
                />
                Thông tin ghi nhận
              </h3>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                Cập nhật ngày phát sinh và nội dung nhận diện.
              </p>
            </div>
            <DatePicker
              disabled={busy}
              label="Ngày giao dịch"
              value={draft.date}
              onValueChange={(date) => onChange({ date })}
              required
            />
            <Input
              disabled={busy}
              value={draft.description}
              onChange={(event) =>
                onChange({ description: event.target.value })
              }
              placeholder="Ăn trưa, nhận lương..."
              label="Nội dung"
            />
          </section>
        </div>
      </div>

      <SheetFooter className="flex-row items-center justify-between px-6 py-5">
        <p className="max-w-sm text-xs leading-5 text-[var(--text-muted)]">
          {requiresApproval
            ? "Thay đổi sẽ được gửi đến Admin để phê duyệt."
            : "Số dư ví sẽ được cập nhật nếu thay đổi ảnh hưởng giao dịch đã ghi nhận."}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
            Hủy
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={busy || !hasChanges}
            onClick={onSave}
          >
            {busy ? "Đang lưu" : "Lưu thay đổi"}
          </Button>
        </div>
      </SheetFooter>
    </>
  );
}

function DesktopTransactionCreateDraft({
  draft,
  wallets,
  categories,
  busy,
  onChange,
  onSave,
  onCancel,
}: {
  draft: TransactionDraft;
  wallets: Option[];
  categories: CategoryOption[];
  busy: boolean;
  onChange: (patch: Partial<TransactionDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  function changeType(type: TransactionType): void {
    onChange({
      type,
      categoryId: "none",
      toWalletId:
        type === "transfer"
          ? draft.toWalletId || defaultDestination(wallets, draft.walletId)
          : draft.toWalletId,
    });
  }

  return (
    <section aria-label="Tạo giao dịch mới">
      <PopoverHeader className="flex-row items-start gap-3 border-b border-[var(--border)] px-2 pb-4 pt-1">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))] text-[var(--primary)]"
          aria-hidden="true"
        >
          <Plus size={17} />
        </span>
        <div className="min-w-0 pt-0.5">
          <PopoverTitle className="text-sm font-semibold text-[var(--foreground)]">
            Tạo giao dịch mới
          </PopoverTitle>
          <PopoverDescription className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            Ghi nhận khoản thu, chi hoặc chuyển tiền vào sổ giao dịch.
          </PopoverDescription>
        </div>
      </PopoverHeader>

      <div className="px-2 py-4">
        <Tabs
          value={draft.type}
          onValueChange={(value) => changeType(value as TransactionType)}
          className="gap-0"
        >
          <TabsList
            variant="navigation"
            className="grid-cols-3 gap-1"
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
                    busy || (tab.value === "transfer" && wallets.length < 2)
                  }
                >
                  <Icon aria-hidden="true" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <div className="mt-6 grid grid-cols-[1.08fr_0.92fr] gap-7">
          <section
            className="space-y-4"
            aria-labelledby="transaction-core-title"
          >
            <div>
              <h3
                id="transaction-core-title"
                className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]"
              >
                <ArrowLeftRight
                  className="text-[var(--primary)]"
                  size={15}
                  aria-hidden="true"
                />
                Giao dịch
              </h3>
              <p className="mt-1 text-[0.68rem] text-[var(--text-muted)]">
                Số tiền và nguồn ví thực hiện.
              </p>
            </div>
            <MoneyInput
              autoFocus
              required
              disabled={busy}
              value={draft.amount}
              onValueChange={(amount) => onChange({ amount })}
              placeholder="0"
              label="Số tiền"
            />
            <Select
              disabled={busy || !wallets.length}
              value={draft.walletId}
              onValueChange={(walletId) =>
                onChange({
                  walletId,
                  toWalletId:
                    draft.toWalletId === walletId
                      ? defaultDestination(wallets, walletId)
                      : draft.toWalletId,
                })
              }
              label="Ví thực hiện"
              options={wallets.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
            {draft.type === "transfer" ? (
              <Select
                disabled={busy || !wallets.length}
                value={draft.toWalletId}
                onValueChange={(toWalletId) => onChange({ toWalletId })}
                label="Ví nhận"
                options={wallets.map((item) => ({
                  value: item.id,
                  label: item.name,
                  disabled: item.id === draft.walletId,
                }))}
              />
            ) : (
              <CategoryTreeSelect
                disabled={
                  busy ||
                  !categoriesForTransactionType(categories, draft.type).length
                }
                value={draft.categoryId}
                onValueChange={(categoryId) => onChange({ categoryId })}
                label="Danh mục"
                categories={categoriesForTransactionType(
                  categories,
                  draft.type,
                )}
                emptyOption={{ value: "none", label: "Không chọn" }}
              />
            )}
          </section>

          <section
            className="space-y-4 border-l border-[var(--border)] pl-7"
            aria-labelledby="transaction-detail-title"
          >
            <div>
              <h3
                id="transaction-detail-title"
                className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]"
              >
                <CalendarDays
                  className="text-[var(--primary)]"
                  size={15}
                  aria-hidden="true"
                />
                Thông tin ghi nhận
              </h3>
              <p className="mt-1 text-[0.68rem] text-[var(--text-muted)]">
                Ngày phát sinh và nội dung nhận diện.
              </p>
            </div>
            <DatePicker
              disabled={busy}
              label="Ngày giao dịch"
              value={draft.date}
              onValueChange={(date) => onChange({ date })}
              required
            />
            <Input
              disabled={busy}
              value={draft.description}
              onChange={(event) =>
                onChange({ description: event.target.value })
              }
              placeholder="Ăn trưa, nhận lương..."
              label="Nội dung"
            />
          </section>
        </div>
      </div>

      <footer className="flex items-center justify-between gap-4 border-t border-[var(--border)] px-2 pt-3">
        <span className="text-xs text-[var(--text-muted)]">
          Thay đổi số dư được xử lý theo trạng thái giao dịch.
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Hủy
          </Button>
          <Button variant="default" disabled={busy} onClick={onSave}>
            {busy ? "Đang lưu" : "Lưu giao dịch"}
          </Button>
        </div>
      </footer>
    </section>
  );
}

function MobileTransactionDraft({
  mode,
  title,
  status,
  draft,
  wallets,
  categories,
  busy,
  disabled = false,
  progressiveDetails = false,
  showHeader = true,
  onChange,
  onSave,
  onCancel,
}: {
  mode: "create" | "edit";
  title?: string;
  status?: React.ReactNode;
  draft: TransactionDraft;
  wallets: Option[];
  categories: CategoryOption[];
  busy: boolean;
  disabled?: boolean;
  progressiveDetails?: boolean;
  showHeader?: boolean;
  onChange: (patch: Partial<TransactionDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const locked = disabled || busy;
  const quickSheetEdit = mode === "edit" && progressiveDetails;
  const [showDetails, setShowDetails] = useState(!progressiveDetails);
  function changeType(type: TransactionType) {
    onChange({
      type,
      categoryId: "none",
      toWalletId:
        type === "transfer"
          ? draft.toWalletId || defaultDestination(wallets, draft.walletId)
          : draft.toWalletId,
    });
  }

  return (
    <section
      className={`ledger-mobile-draft ${quickSheetEdit ? "quick-transaction-form" : ""} ${disabled ? "disabled" : ""}`}
      aria-label={
        mode === "create"
          ? "Tạo giao dịch"
          : `Chỉnh sửa ${title ?? "giao dịch"}`
      }
    >
      {showHeader && (
        <div
          className={`ledger-mobile-draft-heading ${quickSheetEdit ? "quick-transaction-header" : ""}`}
        >
          {quickSheetEdit ? (
            <div className="quick-transaction-heading">
              <span aria-hidden="true">
                <Pencil size={18} />
              </span>
              <div>
                <strong>Chỉnh sửa giao dịch</strong>
                <small>
                  {disabled
                    ? "Giao dịch đang có yêu cầu thay đổi chờ duyệt"
                    : title}
                </small>
              </div>
            </div>
          ) : (
            <div>
              <strong>{mode === "create" ? "Giao dịch mới" : title}</strong>
              <small>
                {disabled
                  ? "Giao dịch đang có yêu cầu thay đổi chờ duyệt"
                  : mode === "create"
                    ? "Điền các thông tin cần thiết"
                    : "Cập nhật thông tin giao dịch"}
              </small>
            </div>
          )}
          {mode === "edit" ? status : null}
        </div>
      )}
      <div
        className={`ledger-mobile-draft-grid ${quickSheetEdit ? "quick-transaction-scroll" : ""} ${
          progressiveDetails ? "ledger-create-progressive-grid" : ""
        }`}
      >
        <Tabs
          value={draft.type}
          onValueChange={(value) => changeType(value as TransactionType)}
          className="ledger-transaction-type-tabs quick-type-tabs gap-0"
        >
          <TabsList
            className="quick-type-switch rounded-2xl"
            aria-label="Loại giao dịch"
          >
            {transactionTypeTabs.map((tab) => {
              const Icon = tab.icon;
              const tabDisabled =
                locked || (tab.value === "transfer" && wallets.length < 2);
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-2xl"
                  data-transaction-type={tab.value}
                  disabled={tabDisabled}
                >
                  <Icon aria-hidden="true" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
        <MoneyInput
          autoFocus={mode === "create"}
          disabled={locked}
          value={draft.amount}
          onValueChange={(amount) => onChange({ amount })}
          placeholder="0"
          label="Số tiền"
          wrapperClassName={
            quickSheetEdit
              ? "quick-amount-field"
              : progressiveDetails
                ? "ledger-create-money-input"
                : undefined
          }
        />
        <Select
          disabled={locked}
          value={draft.walletId}
          onValueChange={(walletId) =>
            onChange({
              walletId,
              toWalletId:
                draft.toWalletId === walletId
                  ? defaultDestination(wallets, walletId)
                  : draft.toWalletId,
            })
          }
          label="Ví thực hiện"
          options={wallets.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />
        {draft.type === "transfer" && (
          <Select
            disabled={locked}
            value={draft.toWalletId}
            onValueChange={(toWalletId) => onChange({ toWalletId })}
            label="Ví nhận"
            options={wallets.map((item) => ({
              value: item.id,
              label: item.name,
              disabled: item.id === draft.walletId,
            }))}
          />
        )}
        {draft.type !== "transfer" && (
          <CategoryTreeSelect
            disabled={locked}
            value={draft.categoryId}
            onValueChange={(categoryId) => onChange({ categoryId })}
            label="Danh mục"
            categories={categoriesForTransactionType(categories, draft.type)}
            emptyOption={{ value: "none", label: "Không chọn" }}
          />
        )}
        {progressiveDetails ? (
          <>
            <Button
              type="button"
              variant="unstyled"
              size="auto"
              className={
                quickSheetEdit
                  ? "quick-details-toggle"
                  : "ledger-create-details-toggle"
              }
              disabled={locked}
              aria-expanded={showDetails}
              onClick={() => setShowDetails((current) => !current)}
            >
              <CalendarDays aria-hidden="true" />
              {showDetails
                ? "Ẩn thông tin bổ sung"
                : "Thêm nội dung hoặc đổi ngày"}
            </Button>
            {showDetails && (
              <div
                className={
                  quickSheetEdit
                    ? "quick-details"
                    : "ledger-create-progressive-details"
                }
              >
                <DatePicker
                  disabled={locked}
                  label="Ngày giao dịch"
                  value={draft.date}
                  onValueChange={(date) => onChange({ date })}
                />
                <Input
                  disabled={locked}
                  value={draft.description}
                  onChange={(event) =>
                    onChange({ description: event.target.value })
                  }
                  placeholder="Ăn trưa, nhận lương"
                  label="Nội dung"
                />
              </div>
            )}
          </>
        ) : (
          <>
            <DatePicker
              disabled={locked}
              label="Ngày giao dịch"
              value={draft.date}
              onValueChange={(date) => onChange({ date })}
            />
            <Input
              disabled={locked}
              value={draft.description}
              onChange={(event) =>
                onChange({ description: event.target.value })
              }
              placeholder="Ăn trưa, nhận lương"
              label="Nội dung"
              wrapperClassName="ledger-mobile-draft-wide"
            />
          </>
        )}
      </div>
      <div
        className={`ledger-mobile-draft-actions${quickSheetEdit ? " quick-transaction-footer" : ""}${mode === "edit" && progressiveDetails ? " single-action" : ""}`}
      >
        {(mode !== "edit" || !progressiveDetails) && (
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            Hủy
          </Button>
        )}
        <Button
          variant="default"
          className={quickSheetEdit ? "quick-submit" : undefined}
          disabled={locked}
          onClick={onSave}
        >
          {busy
            ? "Đang lưu"
            : mode === "create"
              ? "Lưu giao dịch"
              : "Lưu thay đổi"}
        </Button>
      </div>
    </section>
  );
}
