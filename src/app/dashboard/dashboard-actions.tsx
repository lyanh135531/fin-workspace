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
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
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

function ScheduledTransactionsToggle({
  count,
  expanded,
  onToggle,
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant="unstyled"
      size="auto"
      className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-1 text-left transition-colors hover:bg-[var(--surface-hover)]"
      aria-expanded={expanded}
      onClick={onToggle}
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-[var(--surface)] text-[var(--warning)]">
        <CalendarClock size={14} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-xs font-semibold text-[var(--foreground)]">
          Giao dịch đã lên lịch
        </strong>
      </span>
      <span className="rounded-full bg-[var(--surface)] px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
        {count}
      </span>
      <ChevronDown
        className={`shrink-0 text-[var(--text-muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
        size={16}
        aria-hidden="true"
      />
    </Button>
  );
}

function LatestTransactionsLabel() {
  return (
    <div className="flex items-center gap-3 px-1 text-xs font-semibold text-[var(--text-muted)]">
      <span className="h-px flex-1 bg-[var(--border)]" />
      <span>Giao dịch mới nhất</span>
      <span className="h-px flex-1 bg-[var(--border)]" />
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
        <strong style={{ color: item.category?.color ?? "var(--text-muted)" }}>
          {categoryName}
        </strong>
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
  const [editMode, setEditMode] = useState(false);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<
    Record<string, TransactionDraft>
  >({});
  const [mobileEditTarget, setMobileEditTarget] = useState<LedgerItem | null>(
    null,
  );
  const [mobileEditDraft, setMobileEditDraft] =
    useState<TransactionDraft | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileBulkDeleteOpen, setMobileBulkDeleteOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [scheduledExpanded, setScheduledExpanded] = useState(false);
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
  const latestRows = filteredRows.filter((item) => item.status !== "scheduled");
  const pageCount = Math.max(1, Math.ceil(latestRows.length / pageSize));
  const page = Math.min(currentPage, pageCount);
  const rows = latestRows.slice((page - 1) * pageSize, page * pageSize);
  const visibleRows = scheduledExpanded ? [...scheduledRows, ...rows] : rows;
  const selectableRows = visibleRows.filter((item) => !requiresReview(item));
  const allSelected =
    selectableRows.length > 0 &&
    selectableRows.every((row) => selected.has(row.id));
  const columnCount = canApprove ? 8 : 7;
  const pageStart = latestRows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(page * pageSize, latestRows.length);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const updateViewport = () => {
      const desktop = mediaQuery.matches;
      setIsDesktop(desktop);
      if (desktop) {
        setMobileEditTarget(null);
        setMobileEditDraft(null);
      }
    };
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

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
    setScheduledExpanded(false);
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
  function toggleScheduledGroup() {
    if (scheduledExpanded) {
      const scheduledIds = new Set(scheduledRows.map((item) => item.id));
      setSelected(
        (current) =>
          new Set([...current].filter((id) => !scheduledIds.has(id))),
      );
    }
    setScheduledExpanded(!scheduledExpanded);
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
    setEditMode(false);
    setEditDrafts({});
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
  function beginEdit(transactionId?: string) {
    setMobileEditTarget(null);
    setMobileEditDraft(null);
    setCreateDraft(null);
    const editableTransactions = transactionId
      ? transactions.filter((item) => item.id === transactionId)
      : visibleRows;
    setEditDrafts(
      Object.fromEntries(
        editableTransactions.map((item) => [
          item.id,
          draftFromTransaction(item, wallets),
        ]),
      ),
    );
    setEditTargetId(transactionId ?? null);
    setEditMode(true);
  }
  function cancelEdit() {
    setEditMode(false);
    setEditTargetId(null);
    setEditDrafts({});
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
  function updateDraft(id: string, patch: Partial<TransactionDraft>) {
    setEditDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }
  function saveEdits() {
    const changes = transactions.flatMap((item) => {
      const draft = editDrafts[item.id];
      return draft && isChanged(item, draft)
        ? [{ transactionId: item.id, input: transactionInput(draft) }]
        : [];
    });
    if (!changes.length) {
      toast.info("Không có thay đổi để lưu.");
      cancelEdit();
      return;
    }
    start(async () => {
      const result = await updateTransactionsAction(workspaceId, changes);
      if (result.ok) {
        toast.success(
          result.requested
            ? `Đã gửi ${result.requested} yêu cầu sửa đến Admin.`
            : `Đã lưu ${result.updated} giao dịch.`,
        );
      } else {
        toast.error(result.message ?? "Không thể lưu các thay đổi.");
      }
      if (result.ok || (result.updated ?? 0) + (result.requested ?? 0) > 0)
        cancelEdit();
    });
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

  function renderTableTransaction(item: LedgerItem) {
    if (editMode && (!editTargetId || item.id === editTargetId)) {
      return (
        <EditDraftRow
          key={item.id}
          draft={editDrafts[item.id] ?? draftFromTransaction(item, wallets)}
          wallets={wallets}
          categories={categories}
          canApprove={canApprove}
          busy={busy}
          disabled={!isAdmin && item.hasPendingChange}
          autoFocus={visibleRows[0]?.id === item.id}
          onChange={(patch) => updateDraft(item.id, patch)}
          onSave={saveEdits}
          onCancel={cancelEdit}
        />
      );
    }

    return (
      <Fragment key={item.id}>
        <tr
          className="ledger-transaction-row border-b border-[var(--border)]"
          data-pending-change={
            canApprove && item.pendingChangeRequestId
              ? (item.pendingChangeAction ?? "update")
              : undefined
          }
        >
          {canApprove && (
            <td>
              {!requiresReview(item) && (
                <Checkbox
                  checked={selected.has(item.id)}
                  onCheckedChange={() => toggle(item.id)}
                  aria-label={`Chọn giao dịch ${item.description || item.id}`}
                />
              )}
            </td>
          )}
          <td className="ledger-description-column">
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
          <td className="ledger-type-column">
            <TransactionTypeLabel type={item.type} variant="badge" />
          </td>
          <td className="ledger-wallet-column">
            {item.wallet}
            {item.toWallet ? (
              <small className="ledger-wallet-destination">
                → {item.toWallet}
              </small>
            ) : null}
          </td>
          <td className="ledger-date-column">{formatLedgerDate(item.date)}</td>
          <td className="ledger-category-column">
            {item.category ? (
              <span
                className="category-tag"
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
            className={`ledger-amount ledger-amount-column amount-${item.type}`}
          >
            {item.type === "income" ? "+" : item.type === "expense" ? "−" : "↔"}
            {formatAmount(item.amount)} {currency}
          </td>
          <td className="ledger-actions-column">
            <div className="ledger-row-actions">
              {canApprove && item.pendingChangeRequestId && (
                <Button
                  variant="icon"
                  size="icon"
                  className="ledger-review-reject-button"
                  disabled={busy || editMode}
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
                  disabled={busy || editMode}
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
                    disabled={busy || editMode}
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
                    disabled={busy || editMode}
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
                  disabled={busy || editMode}
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
                  disabled={busy || editMode}
                  onClick={() => beginEdit(item.id)}
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
                  disabled={busy || editMode || item.hasPendingChange}
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
    <div className="ledger-shell">
      <div className="ledger-toolbar">
        <Search
          containerClassName=""
          value={query}
          onChange={(event) => changeFilter(() => setQuery(event.target.value))}
          disabled={editMode}
          placeholder="Tìm giao dịch"
          aria-label="Tìm giao dịch hoặc ghi chú"
        />
        {/* Filter popover (both Desktop and Mobile) */}
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
                  spotlight
                  value={dateRange}
                  ariaLabel="Lọc theo khoảng thời gian"
                  allowClear
                  onValueChange={(value) =>
                    changeFilter(() => setDateRange(value))
                  }
                  disabled={editMode}
                  className="ledger-filter-popover-select"
                />
              </div>
              <div className="ledger-filter-popover-row">
                <label className="ledger-filter-popover-label">Danh mục</label>
                <CategoryTreeSelect
                  spotlight
                  value={filterCategory}
                  ariaLabel="Lọc danh mục"
                  placeholder="Tất cả danh mục"
                  categories={categories}
                  emptyOption={{ value: "", label: "Tất cả danh mục" }}
                  onValueChange={(value) =>
                    changeFilter(() => setFilterCategory(value))
                  }
                  disabled={editMode}
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
        {canApprove && selected.size > 0 && (
          <ConfirmDeletePopover
            ariaLabel={`Xóa ${selected.size} giao dịch đã chọn`}
            title={`Xóa ${selected.size} giao dịch?`}
            description="Giao dịch đã ghi nhận sẽ được hoàn tác khỏi số dư ví."
            confirmLabel="Xóa"
            className="ledger-delete-button max-[1023px]:hidden"
            disabled={editMode || busy}
            onConfirm={removeBulk}
          />
        )}
      </div>
      {createDraft && (
        <div className="ledger-mobile-create-draft">
          <MobileTransactionDraft
            mode="create"
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
        </div>
      )}

      {editMode && (
        <div
          className="ledger-mobile-edit-list"
          aria-label="Chỉnh sửa giao dịch"
        >
          {visibleRows
            .filter((item) => !editTargetId || item.id === editTargetId)
            .map((item) => {
              const draft =
                editDrafts[item.id] ?? draftFromTransaction(item, wallets);
              return (
                <MobileTransactionDraft
                  key={item.id}
                  mode="edit"
                  title={item.description || "Giao dịch chưa có nội dung"}
                  status={<Status value={item.status} />}
                  draft={draft}
                  wallets={wallets}
                  categories={categories}
                  busy={busy}
                  disabled={!isAdmin && item.hasPendingChange}
                  onChange={(patch) => updateDraft(item.id, patch)}
                  onSave={saveEdits}
                  onCancel={cancelEdit}
                />
              );
            })}
        </div>
      )}

      {!createDraft && !editMode && (
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
          {scheduledRows.length > 0 && (
            <ScheduledTransactionsToggle
              count={scheduledRows.length}
              expanded={scheduledExpanded}
              onToggle={toggleScheduledGroup}
            />
          )}
          {scheduledExpanded && scheduledRows.map(renderMobileTransaction)}
          {scheduledRows.length > 0 && rows.length > 0 && (
            <LatestTransactionsLabel />
          )}
          {groupTransactionsByDate(rows).map(({ dateKey, label, items }) => (
            <section key={dateKey} className="ledger-date-group">
              <header className="ledger-date-group-header">
                <span>{label}</span>
              </header>
              {items.map(renderMobileTransaction)}
            </section>
          ))}
          {!filteredRows.length && (
            <Empty
              variant="compact"
              title="Chưa có giao dịch phù hợp"
              description="Thử thay đổi tìm kiếm hoặc bộ lọc hiện tại."
            />
          )}
        </div>
      )}

      <div className="ledger-scroll-area ledger-desktop-table">
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
          <thead>
            <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
              {canApprove && (
                <th className="w-10">
                  <Checkbox
                    checked={allSelected}
                    disabled={editMode || selectableRows.length === 0}
                    onCheckedChange={toggleAll}
                    aria-label="Chọn tất cả giao dịch đang hiển thị"
                  />
                </th>
              )}
              <th className="ledger-description-column">Nội dung</th>
              <th className="ledger-type-column">Loại</th>
              <th className="ledger-wallet-column">Ví</th>
              <th className="ledger-date-column">Ngày</th>
              <th className="ledger-category-column">Danh mục</th>
              <th className="ledger-amount-column text-right">Số tiền</th>
              <th className="ledger-actions-column">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {editMode ? (
              visibleRows.map(renderTableTransaction)
            ) : (
              <>
                {scheduledRows.length > 0 && (
                  <tr>
                    <td colSpan={columnCount} className="p-2">
                      <ScheduledTransactionsToggle
                        count={scheduledRows.length}
                        expanded={scheduledExpanded}
                        onToggle={toggleScheduledGroup}
                      />
                    </td>
                  </tr>
                )}
                {scheduledExpanded && scheduledRows.map(renderTableTransaction)}
                {scheduledRows.length > 0 && rows.length > 0 && (
                  <tr>
                    <td colSpan={columnCount} className="divider-transaction">
                      <LatestTransactionsLabel />
                    </td>
                  </tr>
                )}
                {rows.map(renderTableTransaction)}
              </>
            )}
            {filteredRows.length === 0 && (
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
          </tbody>
        </table>
      </div>
      <footer className="ledger-pagination">
        <p className="ledger-record-count">
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
        </p>
        {pageCount > 1 && (
          <nav aria-label="Phân trang sổ giao dịch">
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
      {!readonly && (
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
                disabled={busy || editMode || !wallets.length}
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
              className="ledger-create-popover-content"
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

function EditDraftRow({
  draft,
  wallets,
  categories,
  canApprove,
  busy,
  disabled = false,
  autoFocus = false,
  onChange,
  onSave,
  onCancel,
}: {
  draft: TransactionDraft;
  wallets: Option[];
  categories: CategoryOption[];
  canApprove: boolean;
  busy: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  onChange: (patch: Partial<TransactionDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <tr
      className={`ledger-draft-row border-b border-[var(--border)] ${disabled ? "disabled" : ""}`}
    >
      {canApprove && <td aria-hidden="true" />}
      <td className="ledger-description-column">
        <Input
          disabled={disabled || busy}
          className="ledger-cell-input"
          value={draft.description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="Nội dung"
          aria-label="Nội dung giao dịch"
        />
      </td>
      <td className="ledger-type-column">
        <Select
          disabled={disabled || busy}
          value={draft.type}
          onValueChange={(value) => {
            const type = value as TransactionType;
            onChange({
              type,
              categoryId: "none",
              toWalletId:
                type === "transfer"
                  ? draft.toWalletId ||
                    defaultDestination(wallets, draft.walletId)
                  : draft.toWalletId,
            });
          }}
          ariaLabel="Loại giao dịch"
          options={typeOptions.map((option) => ({
            value: option.value,
            label: option.label,
            content: (
              <TransactionTypeLabel type={option.value} variant="option" />
            ),
            selectedContent: (
              <TransactionTypeLabel type={option.value} variant="badge" />
            ),
            disabled: option.value === "transfer" && wallets.length < 2,
          }))}
        />
      </td>
      <td className="ledger-wallet-column">
        <div className="ledger-wallet-fields">
          <Select
            disabled={disabled || busy || !wallets.length}
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
            ariaLabel="Ví thực hiện"
            options={wallets.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
          />
          {draft.type === "transfer" && (
            <Select
              disabled={disabled || busy || !wallets.length}
              value={draft.toWalletId}
              onValueChange={(toWalletId) => onChange({ toWalletId })}
              ariaLabel="Ví nhận"
              options={wallets.map((item) => ({
                value: item.id,
                label: item.name,
                disabled: item.id === draft.walletId,
              }))}
            />
          )}
        </div>
      </td>
      <td className="ledger-date-column">
        <DatePicker
          disabled={disabled || busy}
          className="ledger-date-input"
          ariaLabel="Ngày giao dịch"
          value={draft.date}
          onValueChange={(date) => onChange({ date })}
        />
      </td>
      <td className="ledger-category-column">
        <CategoryTreeSelect
          disabled={
            disabled ||
            busy ||
            draft.type === "transfer" ||
            !categoriesForTransactionType(categories, draft.type).length
          }
          value={draft.categoryId}
          onValueChange={(categoryId) => onChange({ categoryId })}
          ariaLabel="Danh mục"
          categories={categoriesForTransactionType(categories, draft.type)}
          emptyOption={{ value: "none", label: "Không chọn" }}
        />
      </td>
      <td className="ledger-amount-column">
        <MoneyInput
          autoFocus={autoFocus}
          disabled={disabled || busy}
          className="ledger-amount-input"
          value={draft.amount}
          onValueChange={(amount) => onChange({ amount })}
          placeholder="0"
          aria-label="Số tiền"
        />
      </td>
      <td className="ledger-actions-column">
        <div className="ledger-row-actions">
          <Button
            variant="icon"
            size="icon"
            disabled={busy}
            onClick={onCancel}
            title="Hủy chỉnh sửa"
            aria-label="Hủy chỉnh sửa"
          >
            <X size={16} />
          </Button>
          <Button
            variant="icon"
            size="icon"
            disabled={disabled || busy}
            onClick={onSave}
            title={busy ? "Đang lưu" : "Lưu thay đổi"}
            aria-label={busy ? "Đang lưu" : "Lưu thay đổi"}
          >
            <Check size={16} />
          </Button>
        </div>
      </td>
    </tr>
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
          spotlight
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
            spotlight
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
            spotlight
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
                  spotlight
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
              spotlight
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

function Status({ value }: { value: LedgerItem["status"] }) {
  const label = {
    approved: "Đã ghi nhận",
    pending: "Chờ xác nhận",
    scheduled: "Đã lên lịch",
    rejected: "Đã từ chối",
  }[value];
  return <span className={`status status-${value}`}>{label}</span>;
}
