"use client";

import Decimal from "decimal.js";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  History,
  Info,
  MoreHorizontal,
  Pencil,
  ReceiptText,
  RotateCcw,
  Split,
  Trash2,
  Wallet,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { usePrivacyMask } from "@/lib/privacy-mask";

import {
  addCreditCardRefundAction,
  deleteCreditCardAction,
  deleteImportedCreditCardInstallmentAction,
  deleteTransactionAction,
  importCreditCardInstallmentAction,
  payCreditCardAction,
  registerCreditCardInstallmentAction,
  updateCreditCardAction,
  updateTransactionAction,
} from "@/app/dashboard/actions";
import {
  Button,
  Card,
  CategoryIcon,
  CategoryTreeSelect,
  Checkbox,
  ConfirmDelete,
  DatePicker,
  Input,
  MoneyInput,
  Select,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  Tabs,
  TabsContent,
  TabsCount,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/base";
import { SpotlightTrigger } from "@/components/ui/spotlight-trigger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { firstStatementOnOrAfter, nextStatementDate } from "@/domain/credit-card/installments";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

function subscribeDesktop(callback: () => void) {
  const query = window.matchMedia("(min-width: 768px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function desktopSnapshot() {
  return window.matchMedia("(min-width: 768px)").matches;
}

function serverDesktopSnapshot() {
  return false;
}

type FundingShare = {
  walletId: string;
  walletName: string;
  outstanding: string;
};

export type FundingWallet = { id: string; name: string };

type CardActivity = {
  id: string;
  type?: "income" | "expense" | "transfer";
  toWalletId?: string | null;
  purpose:
    | "standard"
    | "credit_card_payment"
    | "credit_card_refund"
    | "credit_card_installment_fee";
  description: string | null;
  amount: string;
  date: string;
  status: "pending" | "scheduled" | "approved" | "rejected";
  installmentEligible: boolean;
  installmentPlanId: string | null;
  refundableAmount: string;
  canDelete?: boolean;
  canEdit?: boolean;
  categoryId?: string | null;
  category?: string | null;
  walletId?: string;
  allocations?: Array<{ walletId: string; amount: string }>;
};

type RefundCandidate = {
  id: string;
  description: string | null;
  date: string;
  refundableAmount: string;
};

type Statement = {
  id: string;
  cycleEndDate: string;
  dueDate: string;
  amount: string;
  paidAmount?: string;
  remainingAmount?: string;
  isPartiallyPaid?: boolean;
  status: "issued" | "paid";
};

type InstallmentPlan = {
  id: string;
  origin: "transaction" | "imported";
  description: string | null;
  principal: string;
  fee: string;
  termCount: number;
  paidTermCount: number;
  importBalanceMode: "included_opening_debt" | "add_to_balance" | null;
  canDelete: boolean;
  status: "pending" | "active" | "completed";
  installments: Array<{
    number: number;
    dueDate: string;
    amount: string;
    paid: boolean;
  }>;
};

export type CreditCardOverviewItem = {
  id: string;
  name: string;
  description: string | null;
  debt: string;
  creditBalance: string;
  limit: string;
  availableCredit: string;
  isOverLimit?: boolean;
  pendingPayment: string;
  hasApprovedTransactions: boolean;
  defaultFundingWalletId: string;
  statementClosingDay: number;
  paymentDueDay: number;
  fundingShares: FundingShare[];
  importableOpeningDebt: Array<{ walletId: string; amount: string }>;
  statement:
    | (Statement & {
        overdue: boolean;
        paymentPending: boolean;
        sources: Array<{ walletId: string; amount: string }>;
        hasCarriedBalance?: boolean;
        carriedAmount?: string;
      })
    | null;
  statements: Statement[];
  installmentPlans: InstallmentPlan[];
  refundCandidates: RefundCandidate[];
  activities: CardActivity[];
};

export function detectCardBrand(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("visa")) return "VISA";
  if (lower.includes("master")) return "MASTERCARD";
  if (lower.includes("jcb")) return "JCB";
  if (lower.includes("amex") || lower.includes("american express")) return "AMEX";
  if (lower.includes("napas")) return "NAPAS";
  return "CREDIT";
}

export function CardBrandBadge({ brand }: { brand: string }) {
  if (brand === "VISA") {
    return (
      <span className="px-1 text-xs font-black italic tracking-widest text-[var(--foreground)] select-none">
        VISA
      </span>
    );
  }

  if (brand === "MASTERCARD") {
    return (
      <div className="flex items-center -space-x-1.5 px-0.5" title="Mastercard" aria-label="Mastercard">
        <span className="size-3.5 rounded-full bg-[#EB001B] opacity-90" />
        <span className="size-3.5 rounded-full bg-[#F79E1B] opacity-90" />
      </div>
    );
  }

  if (brand === "JCB") {
    return (
      <span className="rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-2 py-0.5 text-[10px] font-bold tracking-wider text-[var(--primary)] select-none">
        JCB
      </span>
    );
  }

  if (brand === "AMEX") {
    return (
      <span className="rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-[var(--primary)] select-none">
        AMEX
      </span>
    );
  }

  if (brand === "NAPAS") {
    return (
      <span className="rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-2 py-0.5 text-[10px] font-bold tracking-wider text-[var(--primary)] select-none">
        NAPAS
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] select-none">
      <CreditCard className="size-3 text-[var(--primary)]" aria-hidden="true" />
      <span>Credit</span>
    </span>
  );
}

export function MiniVirtualCardVisual({ brand }: { brand: string }) {
  if (brand === "VISA") {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] select-none">
        <span className="text-xs font-black italic tracking-wider text-[var(--foreground)]">
          VISA
        </span>
      </div>
    );
  }

  if (brand === "MASTERCARD") {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] select-none">
        <div className="flex items-center -space-x-1.5">
          <span className="size-3.5 rounded-full bg-[#EB001B] opacity-95" />
          <span className="size-3.5 rounded-full bg-[#F79E1B] opacity-95" />
        </div>
      </div>
    );
  }

  if (brand === "JCB") {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] select-none">
        <span className="text-[10px] font-bold tracking-tight text-[var(--primary)]">
          JCB
        </span>
      </div>
    );
  }

  if (brand === "AMEX") {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] select-none">
        <span className="text-[9px] font-extrabold tracking-tight text-[var(--primary)]">
          AMEX
        </span>
      </div>
    );
  }

  if (brand === "NAPAS") {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] select-none">
        <span className="text-[9px] font-bold tracking-tight text-[var(--primary)]">
          NAPAS
        </span>
      </div>
    );
  }

  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--primary)] select-none">
      <CreditCard className="size-5" aria-hidden="true" />
    </div>
  );
}

function CardEmvChipAndWave() {
  return (
    <div className="flex items-center gap-2 select-none" aria-hidden="true">
      <div className="grid h-5 w-7 shrink-0 place-items-center rounded border border-[var(--border)] bg-amber-500/15">
        <div className="grid h-3 w-4.5 grid-cols-2 grid-rows-2 gap-0.5 opacity-75">
          <span className="rounded-tl border-b border-r border-amber-600/50" />
          <span className="rounded-tr border-b border-l border-amber-600/50" />
          <span className="rounded-bl border-t border-r border-amber-600/50" />
          <span className="rounded-br border-t border-l border-amber-600/50" />
        </div>
      </div>
      <svg
        className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8.5 16.5a5 5 0 0 1 0-9" />
        <path d="M12 19a8.5 8.5 0 0 0 0-14" />
        <path d="M15.5 21.5a12 12 0 0 0 0-19" />
      </svg>
    </div>
  );
}

function activityLabel(activity: CardActivity) {
  if (activity.purpose === "credit_card_payment") return "Thanh toán sao kê";
  if (activity.purpose === "credit_card_refund") return "Hoàn tiền";
  if (activity.purpose === "credit_card_installment_fee") return "Phí trả góp";
  return activity.installmentPlanId ? "Chi tiêu trả góp" : "Chi tiêu";
}

function formatIsoDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatShortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

const DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => ({
  value: String(index + 1),
  label: `Ngày ${index + 1}`,
}));

export function CreditCardVirtualCard({
  card,
  currency,
  onClick,
  onPayClick,
  isInteractive = false,
  className,
}: {
  card: CreditCardOverviewItem;
  currency: string;
  onClick?: () => void;
  onPayClick?: () => void;
  isInteractive?: boolean;
  className?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const brand = detectCardBrand(card.name);
  const debtDecimal = new Decimal(card.debt || 0);
  const creditBalanceDecimal = new Decimal(card.creditBalance || 0);
  const hasCredit = creditBalanceDecimal.gt(0);
  const hasDebt = debtDecimal.gt(0);
  const limitDecimal = new Decimal(card.limit || 0);
  const isOverLimit = card.isOverLimit ?? (limitDecimal.gt(0) && debtDecimal.gt(limitDecimal));
  const utilizationPercent = limitDecimal.gt(0)
    ? Math.min(100, Math.max(0, Math.round(debtDecimal.div(limitDecimal).mul(100).toNumber())))
    : 0;

  const reservedAmount = card.fundingShares.reduce(
    (sum, s) => sum.plus(new Decimal(s.outstanding || 0)),
    new Decimal(card.pendingPayment || 0),
  );

  function handleMenuOpenChange(nextOpen: boolean) {
    if (
      nextOpen &&
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(min-width: 1024px)").matches
    ) {
      return;
    }
    setMenuOpen(nextOpen);
  }

  const cardInnerContent = (
    <>
      {/* Desktop Top Plate Strip (hidden on mobile) */}
      <div className="hidden items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/60 px-3.5 py-2.5 md:flex">
        <div className="flex min-w-0 items-center gap-3">
          <CardEmvChipAndWave />
          <div className="h-4 w-px bg-[var(--border)]" aria-hidden="true" />
          <span className="text-[11px] font-medium text-[var(--text-secondary)]">
            Chốt ngày {card.statementClosingDay} · Hạn ngày {card.paymentDueDay}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CardBrandBadge brand={brand} />
        </div>
      </div>

      {/* Row 1: Card Name + Brand/Cycle + Statement/Due Date Badge */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="md:hidden">
            <MiniVirtualCardVisual brand={brand} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-sm font-semibold leading-snug text-[var(--foreground)] md:text-lg">
              {card.name}
            </h3>
            <p className="mt-0.5 break-words text-[11px] leading-snug text-[var(--text-muted)] md:hidden">
              {brand} · Chốt ngày {card.statementClosingDay} · Hạn ngày {card.paymentDueDay}
            </p>
            {card.description && (
              <p className="mt-0.5 hidden break-words text-xs leading-snug text-[var(--text-muted)] md:block">
                {card.description}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0">
          {card.statement?.overdue ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--destructive)] md:px-2.5 md:py-1 md:text-xs">
              Quá hạn · {formatShortDate(card.statement.dueDate)}
            </span>
          ) : card.statement && card.statement.status !== "paid" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--warning)] md:px-2.5 md:py-1 md:text-xs">
              Hạn {formatShortDate(card.statement.dueDate)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)] md:px-2.5 md:py-1 md:text-xs">
              Hạn ngày {card.paymentDueDay}
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Side-by-side Dư nợ hiện tại & Hạn mức còn lại + Sleek Progress Bar */}
      <div className="space-y-2.5 border-t border-[var(--border)] pt-3 md:space-y-3 md:pt-3.5">
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[var(--text-secondary)] md:text-xs">
              {hasCredit ? "Số dư nộp thừa" : "Dư nợ hiện tại"}
            </p>
            <p
              className={cn(
                "mt-0.5 break-words text-base font-bold tabular-nums tracking-tight md:mt-1 md:text-xl",
                hasCredit
                  ? "text-[var(--success)]"
                  : hasDebt
                    ? "text-[var(--destructive)]"
                    : "text-[var(--foreground)]",
              )}
            >
              {formatAmount(hasCredit ? card.creditBalance : card.debt)}{" "}
              <span className="text-[11px] font-medium text-[var(--text-secondary)] md:text-xs">{currency}</span>
            </p>
          </div>

          <div className="min-w-0 text-right">
            <p className="text-[11px] font-medium text-[var(--text-secondary)] md:text-xs">
              {isOverLimit ? "Vượt hạn mức" : "Hạn mức còn lại"}
            </p>
            <p
              className={cn(
                "mt-0.5 break-words text-sm font-semibold tabular-nums md:mt-1 md:text-lg md:font-bold",
                isOverLimit ? "text-[var(--destructive)]" : "text-[var(--foreground)]",
              )}
            >
              {formatAmount(card.availableCredit, { maximumFractionDigits: 0 })}{" "}
              <span className="text-[11px] font-normal text-[var(--text-muted)] md:text-xs">{currency}</span>
            </p>
          </div>
        </div>

        {/* Clean Progress Bar + 1-line Meta */}
        <div className="space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)] md:h-2">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                isOverLimit || utilizationPercent > 80
                  ? "bg-[var(--destructive)]"
                  : utilizationPercent > 50
                    ? "bg-[var(--warning)]"
                    : "bg-[var(--primary)]",
              )}
              style={{ width: `${utilizationPercent}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[11px] leading-snug text-[var(--text-muted)] md:text-xs">
            <span className="break-words">
              Đã dùng <strong className="font-semibold tabular-nums text-[var(--foreground)]">{utilizationPercent}%</strong> / {formatAmount(card.limit, { maximumFractionDigits: 0 })} {currency}
            </span>
            {reservedAmount.gt(0) && (
              <span className="break-words tabular-nums">
                Tiền chờ thanh toán thẻ: <strong className="font-semibold text-[var(--primary)]">{formatAmount(reservedAmount.toString(), { maximumFractionDigits: 0 })} {currency}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Sleek Footer Info & Quick Actions */}
      {isInteractive && (
        <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5 md:pt-3">
          <span className="min-w-0 break-words text-[11px] leading-snug text-[var(--text-muted)] md:text-xs">
            {card.activities.length} giao dịch · {card.installmentPlans.length} trả góp
          </span>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-[var(--text-secondary)] lg:hidden">
            <span>Thao tác</span>
            <ChevronRight size={13} className="text-[var(--text-muted)]" aria-hidden="true" />
          </span>
          <div
            className="hidden shrink-0 items-center gap-2 lg:flex"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {onPayClick && (
              <Button
                type="button"
                variant={hasDebt ? "default" : "outline"}
                size="sm"
                className="h-8 gap-1.5 px-3 text-xs"
                disabled={!hasDebt || Boolean(card.statement?.paymentPending)}
                onClick={onPayClick}
                aria-label={
                  card.statement?.paymentPending
                    ? "Đang chờ duyệt thanh toán"
                    : `Thanh toán sao kê ${card.name}`
                }
                title={
                  card.statement?.paymentPending
                    ? "Đang chờ duyệt thanh toán"
                    : "Thanh toán sao kê"
                }
              >
                <CheckCircle2 size={14} aria-hidden="true" />
                <span>{card.statement?.paymentPending ? "Chờ duyệt" : "Thanh toán"}</span>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-3 text-xs"
              onClick={onClick}
              aria-label={`Xem chi tiết thẻ ${card.name}`}
              title="Xem chi tiết thẻ"
            >
              <span>Chi tiết</span>
              <ChevronRight size={14} aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </>
  );

  if (!isInteractive) {
    return (
      <Card
        as="article"
        className={cn(
          "gap-3 p-3.5 md:gap-4 md:p-5 transition-colors hover:border-[var(--border-hover)]",
          className,
        )}
        aria-label={`Thẻ ${card.name}, ${hasCredit ? `Số dư thừa ${formatAmount(card.creditBalance)}` : `Dư nợ hiện tại ${formatAmount(card.debt)}`} ${currency}`}
      >
        {cardInnerContent}
      </Card>
    );
  }

  return (
    <DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
      <SpotlightTrigger
        open={menuOpen}
        onOpenChange={handleMenuOpenChange}
        mobileOnly
        dismissLabel={`Đóng menu thao tác thẻ ${card.name}`}
        render={
          <Card
            as="article"
            role="button"
            tabIndex={0}
            aria-label={`Thẻ ${card.name}, ${hasCredit ? `Số dư thừa ${formatAmount(card.creditBalance)}` : `Dư nợ hiện tại ${formatAmount(card.debt)}`} ${currency}. Chạm để mở menu thao tác.`}
            className={cn(
              "cursor-pointer select-none gap-3 p-3.5 text-left transition-all duration-150 hover:border-[var(--border-hover)] active:scale-[0.99] active:bg-[var(--surface-hover)] md:gap-4 md:p-5 lg:cursor-default lg:select-auto lg:active:scale-100 lg:active:bg-[var(--surface)]",
              className,
            )}
          />
        }
      >
        {(spotlightTrigger) => (
          <DropdownMenuTrigger nativeButton={false} render={spotlightTrigger}>
            {cardInnerContent}
          </DropdownMenuTrigger>
        )}
      </SpotlightTrigger>

      <DropdownMenuContent
        align="center"
        side="bottom"
        sideOffset={6}
        className="w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 lg:hidden"
      >
        {onClick && (
          <DropdownMenuItem
            onClick={() => {
              setMenuOpen(false);
              onClick();
            }}
          >
            <CreditCard
              className="size-4 text-[var(--primary)]"
              aria-hidden="true"
            />
            <span>Xem chi tiết thẻ</span>
          </DropdownMenuItem>
        )}
        {onPayClick && (
          <DropdownMenuItem
            disabled={!hasDebt || Boolean(card.statement?.paymentPending)}
            onClick={() => {
              setMenuOpen(false);
              onPayClick();
            }}
          >
            <CheckCircle2
              className="size-4 text-[var(--success)]"
              aria-hidden="true"
            />
            <span>
              {card.statement?.paymentPending
                ? "Đang chờ duyệt thanh toán"
                : "Thanh toán sao kê"}
            </span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const ACTIVITIES_PAGE_SIZE = 8;
const INSTALLMENTS_PAGE_SIZE = 4;
const STATEMENTS_PAGE_SIZE = 6;

type TabPaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel: string;
};

function getPageNumbers(current: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < totalPages - 2) pages.push("...");
  pages.push(totalPages);
  return pages;
}

function TabPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel,
}: TabPaginationProps) {
  if (totalItems === 0) return null;

  const pageStart = (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="mt-3 flex flex-col justify-between gap-3 border-t border-[var(--border)] pt-3 text-xs text-[var(--text-muted)] md:flex-row md:items-center">
      <div>
        <span>
          Hiển thị{" "}
          <strong className="font-semibold tabular-nums text-[var(--foreground)]">
            {pageStart}–{pageEnd}
          </strong>{" "}
          trên{" "}
          <strong className="font-semibold tabular-nums text-[var(--foreground)]">
            {totalItems}
          </strong>{" "}
          {itemLabel}
        </span>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1.5 self-end md:self-auto">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-7"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label="Trang trước"
            title="Trang trước"
          >
            <ChevronLeft size={14} />
          </Button>

          <div className="flex items-center gap-1">
            {getPageNumbers(currentPage, totalPages).map((p, idx) =>
              p === "..." ? (
                <span key={`ellipsis-${idx}`} className="px-1 text-xs text-[var(--text-muted)] select-none">
                  ...
                </span>
              ) : (
                <Button
                  key={p}
                  type="button"
                  variant={p === currentPage ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "size-7 p-0 text-xs font-medium tabular-nums",
                    p === currentPage && "font-bold",
                  )}
                  onClick={() => onPageChange(p)}
                  aria-label={`Trang ${p}`}
                  aria-current={p === currentPage ? "page" : undefined}
                >
                  {p}
                </Button>
              ),
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-7"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label="Trang sau"
            title="Trang sau"
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}

function CreditCardPanel({
  workspaceId,
  currency,
  businessDate,
  card,
  allCards,
  canManage,
  canApprove,
  fundingWallets,
  wallets,
  categories,
  autoOpenPayment = false,
  onAutoPaymentHandled,
  onSelectCard,
  onBack,
}: {
  workspaceId: string;
  currency: string;
  businessDate: string;
  card: CreditCardOverviewItem;
  allCards?: CreditCardOverviewItem[];
  canManage: boolean;
  canApprove: boolean;
  fundingWallets: FundingWallet[];
  wallets?: Array<{ id: string; name: string; kind: string }>;
  categories?: Array<{
    id: string;
    name: string;
    icon?: string | null;
    color?: string | null;
    parentId?: string | null;
  }>;
  autoOpenPayment?: boolean;
  onAutoPaymentHandled?: () => void;
  onSelectCard?: (id: string) => void;
  onBack?: () => void;
}) {
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    desktopSnapshot,
    serverDesktopSnapshot,
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundTransactionId, setRefundTransactionId] = useState("");
  const [refundDescription, setRefundDescription] = useState("");
  const [installmentTarget, setInstallmentTarget] = useState<CardActivity | null>(null);
  const [termCount, setTermCount] = useState("3");
  const [feeAmount, setFeeAmount] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2>(1);
  const [importDescription, setImportDescription] = useState("");
  const [importTermCount, setImportTermCount] = useState("");
  const [importPaidTermCount, setImportPaidTermCount] = useState("");
  const [importRemainingAmount, setImportRemainingAmount] = useState("");
  const [importBalanceMode, setImportBalanceMode] = useState<"included_opening_debt" | "add_to_balance">("included_opening_debt");
  const [importFundingWalletId, setImportFundingWalletId] = useState(card.defaultFundingWalletId);
  const [importFirstStatementDate, setImportFirstStatementDate] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLossChecked, setConfirmLossChecked] = useState(false);

  const [paymentConfirmOpen, setPaymentConfirmOpen] = useState(false);
  const [paymentTargetMode, setPaymentTargetMode] = useState<"statement" | "current_debt" | "custom">("statement");
  const [partialPaymentAmount, setPartialPaymentAmount] = useState<string>("");
  const [customSourcesMode, setCustomSourcesMode] = useState(false);
  const [customSourcesMap, setCustomSourcesMap] = useState<Record<string, string>>({});
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(card.name);
  const [editDescription, setEditDescription] = useState(card.description ?? "");
  const [editLimit, setEditLimit] = useState(card.limit);
  const [editFundingWalletId, setEditFundingWalletId] = useState(card.defaultFundingWalletId);
  const [editClosingDay, setEditClosingDay] = useState(String(card.statementClosingDay));
  const [editDueDay, setEditDueDay] = useState(String(card.paymentDueDay));

  function openEditCard() {
    setEditName(card.name);
    setEditDescription(card.description ?? "");
    setEditLimit(card.limit);
    setEditFundingWalletId(card.defaultFundingWalletId);
    setEditClosingDay(String(card.statementClosingDay));
    setEditDueDay(String(card.paymentDueDay));
    setEditOpen(true);
  }
  const [statementDetailOpen, setStatementDetailOpen] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [installmentPage, setInstallmentPage] = useState(1);
  const [statementPage, setStatementPage] = useState(1);

  const totalActivityPages = Math.max(1, Math.ceil(card.activities.length / ACTIVITIES_PAGE_SIZE));
  const currentActivityPage = Math.min(activityPage, totalActivityPages);
  const paginatedActivities = card.activities.slice(
    (currentActivityPage - 1) * ACTIVITIES_PAGE_SIZE,
    currentActivityPage * ACTIVITIES_PAGE_SIZE,
  );

  const totalInstallmentPages = Math.max(1, Math.ceil(card.installmentPlans.length / INSTALLMENTS_PAGE_SIZE));
  const currentInstallmentPage = Math.min(installmentPage, totalInstallmentPages);
  const paginatedInstallmentPlans = card.installmentPlans.slice(
    (currentInstallmentPage - 1) * INSTALLMENTS_PAGE_SIZE,
    currentInstallmentPage * INSTALLMENTS_PAGE_SIZE,
  );

  const totalStatementPages = Math.max(1, Math.ceil(card.statements.length / STATEMENTS_PAGE_SIZE));
  const currentStatementPage = Math.min(statementPage, totalStatementPages);
  const paginatedStatements = card.statements.slice(
    (currentStatementPage - 1) * STATEMENTS_PAGE_SIZE,
    currentStatementPage * STATEMENTS_PAGE_SIZE,
  );

  const [deletingPlan, setDeletingPlan] = useState<InstallmentPlan | null>(null);
  const [deletingActivity, setDeletingActivity] = useState<CardActivity | null>(null);
  const [editingActivity, setEditingActivity] = useState<CardActivity | null>(null);
  const [menuInstallmentId, setMenuInstallmentId] = useState<string | null>(null);
  const [menuActivityId, setMenuActivityId] = useState<string | null>(null);
  const [editWalletId, setEditWalletId] = useState<string>("");
  const [editAmount, setEditAmount] = useState<string>("");
  const [editDate, setEditDate] = useState<string>("");
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [editActivityDescription, setEditActivityDescription] = useState<string>("");
  const [showEditDetails, setShowEditDetails] = useState(false);
  const cardMenuTriggerRef = useRef<HTMLButtonElement>(null);

  const walletNames = useMemo(
    () => new Map(card.fundingShares.map((share) => [share.walletId, share.walletName])),
    [card.fundingShares],
  );

  const categoriesById = useMemo(
    () => new Map((categories ?? []).map((cat) => [cat.id, cat])),
    [categories],
  );

  const categoriesByName = useMemo(
    () => new Map((categories ?? []).map((cat) => [cat.name, cat])),
    [categories],
  );

  const limitDecimal = useMemo(() => new Decimal(card.limit || 0), [card.limit]);
  const debtDecimal = useMemo(() => new Decimal(card.debt || 0), [card.debt]);
  const creditBalanceDecimal = useMemo(
    () => new Decimal(card.creditBalance || 0),
    [card.creditBalance],
  );
  const pendingDecimal = useMemo(
    () => new Decimal(card.pendingPayment || 0),
    [card.pendingPayment],
  );

  const hasCredit = creditBalanceDecimal.gt(0);
  const hasDebt = debtDecimal.gt(0);
  const brand = useMemo(() => detectCardBrand(card.name), [card.name]);

  const statementRemaining = useMemo(() => {
    if (!card.statement) return new Decimal(0);
    return new Decimal(card.statement.remainingAmount ?? card.statement.amount ?? 0);
  }, [card.statement]);

  const hasStatementDebt = useMemo(() => {
    return Boolean(card.statement && card.statement.status !== "paid" && statementRemaining.gt(0));
  }, [card.statement, statementRemaining]);

  useEffect(() => {
    if (autoOpenPayment) {
      setPaymentTargetMode(hasStatementDebt ? "statement" : "current_debt");
      setPartialPaymentAmount("");
      setCustomSourcesMode(false);
      setCustomSourcesMap({});
      setPaymentConfirmOpen(true);
      onAutoPaymentHandled?.();
    }
  }, [autoOpenPayment, hasStatementDebt, onAutoPaymentHandled]);

  function openPaymentSheet(defaultMode?: "statement" | "current_debt") {
    const mode = defaultMode ?? (hasStatementDebt ? "statement" : "current_debt");
    setPaymentTargetMode(mode);
    setPartialPaymentAmount("");
    setCustomSourcesMode(false);
    setCustomSourcesMap({});
    setPaymentConfirmOpen(true);
  }

  function startEditingActivity(activity: CardActivity) {
    setEditingActivity(activity);
    setEditWalletId(activity.walletId || card.id);
    setEditAmount(activity.amount);
    setEditDate(activity.date);
    setEditCategoryId(activity.categoryId || (categories?.[0]?.id ?? ""));
    setEditActivityDescription(activity.description ?? "");
    setShowEditDetails(false);
  }

  function handleSaveEdit() {
    if (!editingActivity || !editWalletId || !editAmount || !editDate) return;
    const selectedWallet = wallets?.find((w) => w.id === editWalletId);
    const isCreditCard = selectedWallet?.kind === "credit_card";
    const txType = editingActivity.type ?? "expense";
    const buildAllocations = () => {
      if (!isCreditCard) return undefined;
      const originalWalletId = editingActivity.walletId || card.id;
      const existingAllocations = editingActivity.allocations ?? [];
      const nextTotal = new Decimal(editAmount);
      if (editWalletId === originalWalletId && existingAllocations.length > 0) {
        const oldTotal = existingAllocations.reduce(
          (sum, item) => sum.plus(item.amount),
          new Decimal(0),
        );
        if (oldTotal.eq(nextTotal)) {
          return existingAllocations.map((item) => ({
            walletId: item.walletId,
            amount: item.amount,
          }));
        }
        if (oldTotal.gt(0)) {
          let remaining = nextTotal;
          return existingAllocations.map((item, idx) => {
            const share =
              idx === existingAllocations.length - 1
                ? remaining
                : nextTotal
                    .mul(item.amount)
                    .div(oldTotal)
                    .toDecimalPlaces(0, Decimal.ROUND_FLOOR);
            remaining = remaining.minus(share);
            return {
              walletId: item.walletId,
              amount: Decimal.max(share, 0).toString(),
            };
          });
        }
      }
      const targetCard = allCards?.find((c) => c.id === editWalletId);
      const fallbackFundingWalletId =
        targetCard?.defaultFundingWalletId ??
        card.defaultFundingWalletId ??
        fundingWallets[0]?.id ??
        wallets?.find((w) => w.kind === "asset")?.id ??
        "";
      return [
        {
          walletId: fallbackFundingWalletId,
          amount: editAmount,
        },
      ];
    };
    startTransition(async () => {
      const res = await updateTransactionAction(
        workspaceId,
        editingActivity.id,
        {
          walletId: editWalletId,
          toWalletId: txType === "transfer" ? (editingActivity.toWalletId ?? undefined) : undefined,
          amount: editAmount,
          date: editDate,
          type: txType,
          categoryId: txType === "expense" ? (editCategoryId || undefined) : undefined,
          description: editActivityDescription.trim() || undefined,
          allocations: buildAllocations(),
        },
        "Sửa giao dịch từ trang Thẻ tín dụng",
      );
      if (res.ok) {
        toast.success("Đã cập nhật giao dịch thành công.");
        setEditingActivity(null);
        setShowEditDetails(false);
      } else {
        toast.error(res.message ?? "Không thể cập nhật giao dịch.");
      }
    });
  }

  const selectedRefundActivity = card.refundCandidates.find(
    (activity) => activity.id === refundTransactionId,
  );
  const importableOpeningDebtByWallet = useMemo(
    () => new Map(card.importableOpeningDebt.map((item) => [item.walletId, new Decimal(item.amount)])),
    [card.importableOpeningDebt],
  );

  const importStatementOptions = useMemo(() => {
    let statementDate = firstStatementOnOrAfter(businessDate, card.statementClosingDay);
    const latestStatementDate = card.statements[0]?.cycleEndDate ?? null;
    if (latestStatementDate && statementDate <= latestStatementDate) {
      statementDate = nextStatementDate(latestStatementDate, card.statementClosingDay);
    }
    return Array.from({ length: 24 }, () => {
      const value = statementDate;
      statementDate = nextStatementDate(statementDate, card.statementClosingDay);
      return { value, label: formatIsoDate(value) };
    });
  }, [businessDate, card.statementClosingDay, card.statements]);

  const importPreview = useMemo(() => {
    if (!importTermCount.trim()) return null;
    const totalTerms = Number(importTermCount);
    const paidTerms = importPaidTermCount.trim() === "" ? 0 : Number(importPaidTermCount);
    if (
      !Number.isInteger(totalTerms) ||
      !Number.isInteger(paidTerms) ||
      totalTerms < 2 ||
      totalTerms > 60 ||
      paidTerms < 0 ||
      paidTerms >= totalTerms
    ) {
      return null;
    }
    try {
      const remaining = new Decimal(importRemainingAmount || 0);
      if (!remaining.gt(0)) return null;
      const remainingTerms = totalTerms - paidTerms;
      const monthlyAmount = remaining.dividedBy(remainingTerms).ceil().toFixed(0);
      return {
        remainingTerms,
        monthlyAmount,
      };
    } catch {
      return null;
    }
  }, [importPaidTermCount, importRemainingAmount, importTermCount]);

  const canProceedToStep2 = Boolean(importDescription.trim() && importPreview);
  const selectedImportableOpeningDebt =
    importableOpeningDebtByWallet.get(importFundingWalletId) ?? new Decimal(0);
  const exceedsImportableOpeningDebt =
    importBalanceMode === "included_opening_debt" &&
    Boolean(importPreview) &&
    new Decimal(importRemainingAmount || 0).gt(selectedImportableOpeningDebt);

  const installmentCalc = useMemo(() => {
    if (!installmentTarget) return null;
    const targetAmount = new Decimal(installmentTarget.amount || 0);
    const feeDecimal =
      feeAmount.trim() !== "" && !isNaN(Number(feeAmount)) && Number(feeAmount) > 0
        ? new Decimal(feeAmount)
        : new Decimal(0);
    const total = targetAmount.plus(feeDecimal);
    const count = Number(termCount) || 1;
    const regularPrincipal = targetAmount.div(count).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    const firstTermAmount = regularPrincipal.plus(feeDecimal);
    const hasFee = feeDecimal.gt(0);
    return {
      targetAmount,
      feeDecimal,
      total,
      count,
      regularPrincipal,
      firstTermAmount,
      hasFee,
    };
  }, [installmentTarget, feeAmount, termCount]);

  const isOverLimit = card.isOverLimit ?? (limitDecimal.gt(0) && debtDecimal.gt(limitDecimal));
  const utilizationPercent = useMemo(() => {
    if (!limitDecimal.gt(0) || !debtDecimal.gt(0)) return 0;
    const pct = debtDecimal.div(limitDecimal).mul(100).toNumber();
    return Math.min(100, Math.max(0, Math.round(pct)));
  }, [limitDecimal, debtDecimal]);

  const totalReservedForCard = useMemo(() => {
    return card.fundingShares.reduce(
      (sum, share) => sum.plus(new Decimal(share.outstanding || 0)),
      pendingDecimal,
    );
  }, [card.fundingShares, pendingDecimal]);

  const activeInstallmentPlans = useMemo(() => {
    return card.installmentPlans.filter((p) => {
      const paid = p.paidTermCount + p.installments.filter((item) => item.paid).length;
      return paid < p.termCount && p.status !== "completed";
    });
  }, [card.installmentPlans]);

  const monthlyInstallmentTotal = useMemo(() => {
    return activeInstallmentPlans.reduce((sum, p) => {
      const next = p.installments.find((item) => !item.paid);
      const amount = next ? new Decimal(next.amount) : new Decimal(0);
      return sum.plus(amount);
    }, new Decimal(0));
  }, [activeInstallmentPlans]);

  const remainingInstallmentPrincipal = useMemo(() => {
    return activeInstallmentPlans.reduce((sum, p) => {
      const remainingForPlan = p.installments
        .filter((i) => !i.paid)
        .reduce((planSum, i) => planSum.plus(new Decimal(i.amount)), new Decimal(0));
      return sum.plus(remainingForPlan);
    }, new Decimal(0));
  }, [activeInstallmentPlans]);

  const targetMaxAmount = useMemo(() => {
    if (paymentTargetMode === "statement") return statementRemaining;
    return debtDecimal.gt(0) ? debtDecimal : statementRemaining;
  }, [paymentTargetMode, statementRemaining, debtDecimal]);

  const unbilledAmount = useMemo(() => {
    return Decimal.max(debtDecimal.minus(statementRemaining), 0);
  }, [debtDecimal, statementRemaining]);

  const basePaymentSources = useMemo(() => {
    if (paymentTargetMode === "statement") {
      return card.statement?.sources ?? [];
    }
    const shares = card.fundingShares
      .map((s) => ({ walletId: s.walletId, amount: s.outstanding }))
      .filter((s) => new Decimal(s.amount).gt(0));
    if (shares.length > 0) return shares;
    return card.statement?.sources ?? [];
  }, [paymentTargetMode, card.statement, card.fundingShares]);

  const hasMultipleSources = basePaymentSources.length > 1;

  const customSourcesTotal = useMemo(() => {
    if (!customSourcesMode) return new Decimal(0);
    let sum = new Decimal(0);
    for (const val of Object.values(customSourcesMap)) {
      try {
        const d = new Decimal(val || 0);
        if (d.gt(0)) sum = sum.plus(d);
      } catch {
        // ignore invalid
      }
    }
    return sum;
  }, [customSourcesMode, customSourcesMap]);

  const effectivePaymentAmount = useMemo(() => {
    if (customSourcesMode) return customSourcesTotal;
    if (paymentTargetMode === "statement") return statementRemaining;
    if (paymentTargetMode === "current_debt") return debtDecimal;
    try {
      const val = new Decimal(partialPaymentAmount || 0);
      return val.gt(0) ? val : new Decimal(0);
    } catch {
      return new Decimal(0);
    }
  }, [
    customSourcesMode,
    customSourcesTotal,
    paymentTargetMode,
    statementRemaining,
    debtDecimal,
    partialPaymentAmount,
  ]);

  const isCustomSourcesValid = useMemo(() => {
    if (!customSourcesMode) return true;
    if (basePaymentSources.length === 0) return false;
    let anyPositive = false;
    for (const src of basePaymentSources) {
      const valStr = customSourcesMap[src.walletId] ?? "";
      if (!valStr || valStr === "0") continue;
      try {
        const d = new Decimal(valStr);
        if (d.lt(0)) return false;
        if (d.gt(new Decimal(src.amount))) return false;
        if (d.gt(0)) anyPositive = true;
      } catch {
        return false;
      }
    }
    return anyPositive && customSourcesTotal.gt(0) && customSourcesTotal.lte(targetMaxAmount);
  }, [customSourcesMode, basePaymentSources, customSourcesMap, customSourcesTotal, targetMaxAmount]);

  const isPaymentValid = useMemo(() => {
    if (customSourcesMode) return isCustomSourcesValid;
    if (paymentTargetMode === "statement") return statementRemaining.gt(0);
    if (paymentTargetMode === "current_debt") return debtDecimal.gt(0);
    return effectivePaymentAmount.gt(0) && effectivePaymentAmount.lte(targetMaxAmount);
  }, [
    customSourcesMode,
    isCustomSourcesValid,
    paymentTargetMode,
    statementRemaining,
    debtDecimal,
    effectivePaymentAmount,
    targetMaxAmount,
  ]);

  const remainingAfterPayment = useMemo(() => {
    return Decimal.max(targetMaxAmount.minus(effectivePaymentAmount), 0);
  }, [targetMaxAmount, effectivePaymentAmount]);

  const computedPaymentSources = useMemo(() => {
    if (basePaymentSources.length === 0) return [];
    if (customSourcesMode) {
      const result: Array<{ walletId: string; amount: string }> = [];
      for (const src of basePaymentSources) {
        const valStr = customSourcesMap[src.walletId] ?? "";
        try {
          const d = new Decimal(valStr || 0);
          if (d.gt(0)) {
            result.push({ walletId: src.walletId, amount: d.toFixed(0) });
          }
        } catch {
          // ignore
        }
      }
      return result;
    }
    if (paymentTargetMode === "statement") {
      return card.statement?.sources ?? [];
    }
    if (paymentTargetMode === "current_debt" || effectivePaymentAmount.gte(targetMaxAmount)) {
      return basePaymentSources;
    }
    if (!effectivePaymentAmount.gt(0)) return [];
    const useStatementSources =
      paymentTargetMode === "custom" &&
      hasStatementDebt &&
      Boolean(card.statement?.sources?.length) &&
      effectivePaymentAmount.lte(statementRemaining);
    const activeSources = useStatementSources
      ? (card.statement?.sources ?? [])
      : basePaymentSources;
    const activeMax = useStatementSources ? statementRemaining : targetMaxAmount;
    let allocated = new Decimal(0);
    const result: Array<{ walletId: string; amount: string }> = [];
    const validSources = activeSources.filter((s) => new Decimal(s.amount).gt(0));
    for (let i = 0; i < validSources.length; i++) {
      const src = validSources[i];
      if (i === validSources.length - 1) {
        const finalAmt = effectivePaymentAmount.minus(allocated);
        if (finalAmt.gt(0)) {
          result.push({ walletId: src.walletId, amount: finalAmt.toFixed(0) });
        }
      } else {
        const share = effectivePaymentAmount
          .mul(new Decimal(src.amount))
          .div(activeMax)
          .floor();
        allocated = allocated.plus(share);
        if (share.gt(0)) {
          result.push({ walletId: src.walletId, amount: share.toFixed(0) });
        }
      }
    }
    return result;
  }, [
    basePaymentSources,
    customSourcesMode,
    paymentTargetMode,
    effectivePaymentAmount,
    targetMaxAmount,
    hasStatementDebt,
    statementRemaining,
    card.statement,
    customSourcesMap,
  ]);

  function enableCustomSources() {
    const initialMap: Record<string, string> = {};
    for (const src of computedPaymentSources) {
      initialMap[src.walletId] = src.amount;
    }
    setCustomSourcesMap(initialMap);
    setCustomSourcesMode(true);
  }

  function disableCustomSources() {
    setCustomSourcesMode(false);
    if (customSourcesTotal.gt(0)) {
      setPartialPaymentAmount(customSourcesTotal.toString());
    }
  }

  function applyQuickChip(fraction: number) {
    const amt = targetMaxAmount.mul(fraction).floor();
    setPartialPaymentAmount(amt.toString());
    if (customSourcesMode) {
      let allocated = new Decimal(0);
      const newMap: Record<string, string> = {};
      const validSources = basePaymentSources.filter((s) => new Decimal(s.amount).gt(0));
      for (let i = 0; i < validSources.length; i++) {
        const src = validSources[i];
        if (i === validSources.length - 1) {
          const finalAmt = amt.minus(allocated);
          newMap[src.walletId] = Decimal.max(finalAmt, 0).toFixed(0);
        } else {
          const share = amt.mul(new Decimal(src.amount)).div(targetMaxAmount).floor();
          allocated = allocated.plus(share);
          newMap[src.walletId] = share.toFixed(0);
        }
      }
      setCustomSourcesMap(newMap);
    }
  }

  function payStatement() {
    if (!isPaymentValid) return;
    const sourcesToPay = computedPaymentSources;
    if (sourcesToPay.length === 0) return;
    const statementMaxByWallet = new Map(
      (card.statement?.sources ?? []).map((s) => [s.walletId, new Decimal(s.amount)]),
    );
    const canApplyCustomToStatement =
      paymentTargetMode === "custom" &&
      hasStatementDebt &&
      Boolean(card.statement?.id) &&
      effectivePaymentAmount.lte(statementRemaining) &&
      sourcesToPay.every((s) =>
        new Decimal(s.amount).lte(statementMaxByWallet.get(s.walletId) ?? new Decimal(0)),
      );
    const target =
      paymentTargetMode === "statement" || canApplyCustomToStatement
        ? "statement"
        : "current_debt";
    const isFull =
      (target === "statement" && effectivePaymentAmount.gte(statementRemaining)) ||
      (target === "current_debt" && effectivePaymentAmount.gte(debtDecimal));
    const description =
      target === "statement"
        ? isFull
          ? "Thanh toán toàn bộ sao kê kỳ này"
          : `Thanh toán một phần sao kê (${formatAmount(effectivePaymentAmount)} ${currency})`
        : isFull
          ? "Thanh toán toàn bộ dư nợ hiện tại"
          : `Thanh toán một phần dư nợ thẻ (${formatAmount(effectivePaymentAmount)} ${currency})`;

    startTransition(async () => {
      const result = await payCreditCardAction(workspaceId, {
        cardWalletId: card.id,
        statementId: target === "statement" && card.statement ? card.statement.id : undefined,
        target,
        date: businessDate,
        sources: sourcesToPay,
        description,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Không thể thanh toán nợ thẻ.");
        return;
      }
      toast.success(
        result.status === "approved"
          ? isFull
            ? target === "statement"
              ? "Thanh toán sao kê thành công."
              : "Thanh toán toàn bộ dư nợ thẻ thành công."
            : "Thanh toán một phần thành công."
          : "Đã gửi yêu cầu thanh toán thẻ chờ duyệt.",
      );
      setPaymentConfirmOpen(false);
      setPaymentTargetMode(hasStatementDebt ? "statement" : "current_debt");
      setPartialPaymentAmount("");
      setCustomSourcesMode(false);
      setCustomSourcesMap({});
    });
  }

  function registerInstallment() {
    if (!installmentTarget) return;
    startTransition(async () => {
      const result = await registerCreditCardInstallmentAction(workspaceId, {
        transactionId: installmentTarget.id,
        termCount: Number(termCount),
        feeAmount: feeAmount.trim() || "0",
      });
      if (!result.ok) {
        toast.error(result.message ?? "Không thể đăng ký trả góp.");
        return;
      }
      toast.success("Chuyển đổi trả góp thành công.");
      setInstallmentTarget(null);
      setFeeAmount("");
    });
  }

  function submitRefund() {
    if (!new Decimal(refundAmount || 0).gt(0)) return;
    startTransition(async () => {
      const result = await addCreditCardRefundAction(workspaceId, {
        cardWalletId: card.id,
        originalTransactionId: refundTransactionId || undefined,
        amount: refundAmount,
        date: businessDate,
        description: refundDescription.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Không thể hoàn tiền.");
        return;
      }
      toast.success(
        result.status === "approved"
          ? refundTransactionId
            ? "Đã ghi nhận hoàn tiền cho giao dịch."
            : "Đã ghi nhận hoàn tiền vào thẻ."
          : "Đã gửi yêu cầu hoàn tiền chờ duyệt.",
      );
      setRefundOpen(false);
      setRefundAmount("");
      setRefundTransactionId("");
      setRefundDescription("");
    });
  }

  function openImportInstallment() {
    setImportStep(1);
    setImportDescription("");
    setImportTermCount("");
    setImportPaidTermCount("");
    setImportRemainingAmount("");
    setImportBalanceMode("included_opening_debt");
    setImportFundingWalletId(card.defaultFundingWalletId);
    setImportFirstStatementDate(importStatementOptions[0]?.value ?? "");
    setImportOpen(true);
  }

  function importOngoingInstallment() {
    if (!importPreview || !importFundingWalletId || !importFirstStatementDate) return;
    startTransition(async () => {
      const result = await importCreditCardInstallmentAction(workspaceId, {
        cardWalletId: card.id,
        description: importDescription,
        termCount: Number(importTermCount),
        paidTermCount: Number(importPaidTermCount || "0"),
        remainingAmount: importRemainingAmount,
        firstStatementDate: importFirstStatementDate,
        balanceMode: importBalanceMode,
        allocations: [{ walletId: importFundingWalletId, amount: importRemainingAmount }],
      });
      if (!result.ok) {
        toast.error(result.message ?? "Không thể nhập khoản trả góp đang có.");
        return;
      }
      toast.success("Đã nhập khoản trả góp đang có.");
      setImportOpen(false);
      setImportStep(1);
    });
  }

  async function handleDeleteImportedPlan(plan: InstallmentPlan) {
    const result = await deleteImportedCreditCardInstallmentAction(workspaceId, { planId: plan.id });
    if (!result.ok) {
      toast.error(result.message ?? "Không thể xóa khoản trả góp.");
      return false;
    }
    toast.success(`Đã hủy khoản trả góp${plan.description ? ` “${plan.description}”` : ""}.`);
    return true;
  }

  function submitEdit() {
    startTransition(async () => {
      const result = await updateCreditCardAction(workspaceId, {
        cardWalletId: card.id,
        name: editName,
        description: editDescription,
        creditLimit: editLimit,
        defaultFundingWalletId: editFundingWalletId,
        statementClosingDay: Number(editClosingDay),
        paymentDueDay: Number(editDueDay),
      });
      if (!result.ok) {
        toast.error(result.message ?? "Không thể cập nhật thẻ tín dụng.");
        return;
      }
      toast.success("Đã cập nhật thông tin thẻ tín dụng.");
      setEditOpen(false);
    });
  }

  async function handleDeleteCard() {
    const result = await deleteCreditCardAction(workspaceId, {
      cardWalletId: card.id,
      confirmLoss: true,
      resolution: { action: "void_transactions" },
    });
    if (!result.ok) {
      toast.error(result.message ?? "Không thể xóa thẻ tín dụng.");
      return false;
    }
    toast.success(`Đã xóa thẻ “${card.name}”.`);
    setConfirmDelete(false);
    setConfirmLossChecked(false);
    if (onBack) {
      onBack();
    } else {
      router.push("/credit-cards");
    }
    return true;
  }

  function renderInstallmentCard(plan: InstallmentPlan) {
    const paid = plan.paidTermCount + plan.installments.filter((item) => item.paid).length;
    const next = plan.installments.find((item) => !item.paid);
    const hasFee = new Decimal(plan.fee || 0).gt(0);
    const progressPct = plan.termCount > 0 ? Math.round((paid / plan.termCount) * 100) : 0;
    const remainingTerms = Math.max(0, plan.termCount - paid);
    const hasDeleteAction = canManage && plan.canDelete;
    const isMenuOpen = menuInstallmentId === plan.id;

    const installmentInner = (
      <>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <h4 className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
              {plan.description || "Giao dịch trả góp"}
            </h4>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex shrink-0 items-center rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                {plan.origin === "imported" ? `${plan.termCount} tháng · Đã có sẵn` : `${plan.termCount} tháng`}
              </span>
              {hasFee && (
                <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                  · Phí {formatAmount(plan.fee, { maximumFractionDigits: 0 })} {currency}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-start gap-2">
            <div className="text-right">
              <span className="block text-sm font-bold tabular-nums text-[var(--foreground)]">
                {formatAmount(plan.principal, { maximumFractionDigits: 0 })} {currency}
              </span>
              <span className="text-[10px] font-normal text-[var(--text-muted)]">Tổng giá trị</span>
            </div>
            {hasDeleteAction && (
              <div
                className="hidden shrink-0 lg:block"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-[var(--text-muted)] hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
                  onClick={() => setDeletingPlan(plan)}
                  title="Hủy khoản trả góp này"
                  aria-label="Hủy khoản trả góp này"
                >
                  <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-secondary)]">
              Đã trả:{" "}
              <strong className="font-semibold tabular-nums text-[var(--foreground)]">
                {paid}/{plan.termCount} kỳ
              </strong>{" "}
              <span className="text-[11px] text-[var(--text-muted)]">({progressPct}%)</span>
            </span>
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              {remainingTerms > 0 ? `Còn ${remainingTerms} kỳ` : "Đã hoàn thành"}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-secondary)]">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                paid === plan.termCount ? "bg-[var(--success)]" : "bg-[var(--primary)]",
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5 text-xs">
          {next ? (
            <>
              <span className="break-words leading-snug text-[var(--text-muted)]">
                Kỳ tiếp ({formatShortDate(next.dueDate)})
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-[var(--primary)]">
                {formatAmount(next.amount, { maximumFractionDigits: 0 })} {currency}/kỳ
              </span>
            </>
          ) : (
            <span className="font-medium text-[var(--success)]">Đã tất toán toàn bộ các kỳ</span>
          )}
        </div>
      </>
    );

    if (!hasDeleteAction) {
      return (
        <div
          key={plan.id}
          className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          {installmentInner}
        </div>
      );
    }

    function handleInstallmentMenuOpenChange(nextOpen: boolean) {
      if (
        nextOpen &&
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(min-width: 1024px)").matches
      ) {
        return;
      }
      setMenuInstallmentId(nextOpen ? plan.id : null);
    }

    return (
      <DropdownMenu
        key={plan.id}
        open={isMenuOpen}
        onOpenChange={handleInstallmentMenuOpenChange}
      >
        <SpotlightTrigger
          open={isMenuOpen}
          onOpenChange={handleInstallmentMenuOpenChange}
          mobileOnly
          dismissLabel={`Đóng menu thao tác trả góp ${plan.description || ""}`}
          render={
            <div
              role="button"
              tabIndex={0}
              aria-label={`Khoản trả góp ${plan.description || "Giao dịch trả góp"}. Chạm để mở menu thao tác.`}
              className="flex cursor-pointer select-none flex-col justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition-all duration-150 active:scale-[0.99] active:bg-[var(--surface-hover)] lg:cursor-default lg:select-auto lg:active:scale-100 lg:active:bg-[var(--surface)]"
            />
          }
        >
          {(spotlightTrigger) => (
            <DropdownMenuTrigger nativeButton={false} render={spotlightTrigger}>
              {installmentInner}
            </DropdownMenuTrigger>
          )}
        </SpotlightTrigger>

        <DropdownMenuContent
          align="center"
          side="bottom"
          sideOffset={6}
          className="w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 lg:hidden"
        >
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setMenuInstallmentId(null);
              setDeletingPlan(plan);
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            <span>Hủy khoản trả góp này</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="space-y-4">
      {/* Switcher bar when multiple cards exist */}
      {allCards && allCards.length > 1 && onSelectCard && (
        <div className="flex flex-wrap items-center gap-2 pb-1">
          {allCards.map((item) => {
            const isSelected = item.id === card.id;
            const itemBrand = detectCardBrand(item.name);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectCard(item.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                  isSelected
                    ? "border-[var(--primary)] bg-[var(--surface-secondary)] font-semibold text-[var(--foreground)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]",
                )}
              >
                <span className="break-words">{item.name}</span>
                <span className="text-[10px] uppercase text-[var(--text-muted)]">{itemBrand}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail Header Bar */}
      <div className="flex items-start justify-between gap-2.5 md:items-center">
        <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
          {onBack ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 shrink-0 md:size-9"
              onClick={onBack}
              aria-label="Quay lại danh sách thẻ"
              title="Quay lại danh sách thẻ"
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="icon"
              className="size-8 shrink-0 md:size-9"
              render={<Link href="/credit-cards" aria-label="Quay lại danh sách thẻ" />}
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </Button>
          )}
          <div className="hidden sm:block md:hidden">
            <MiniVirtualCardVisual brand={brand} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 md:gap-2.5">
              <h2 className="break-words text-base font-semibold leading-snug text-[var(--foreground)] md:text-xl">
                {card.name}
              </h2>
              <CardBrandBadge brand={brand} />
            </div>
            <p className="mt-0.5 break-words text-[11px] leading-snug text-[var(--text-secondary)] md:text-xs">
              Chốt ngày {card.statementClosingDay} · Hạn ngày {card.paymentDueDay}
              {card.description ? ` · ${card.description}` : ""}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          <Button
            type="button"
            variant="default"
            size="icon"
            className="size-8 md:h-9 md:w-auto md:gap-1.5 md:px-3.5"
            disabled={pending || Boolean(card.statement?.paymentPending) || !hasDebt}
            onClick={() => openPaymentSheet()}
            aria-label={
              card.statement?.paymentPending
                ? "Đang chờ duyệt"
                : hasStatementDebt
                  ? "Thanh toán sao kê"
                  : "Thanh toán dư nợ"
            }
            title={
              card.statement?.paymentPending
                ? "Đang chờ duyệt"
                : hasStatementDebt
                  ? "Thanh toán sao kê"
                  : "Thanh toán dư nợ"
            }
          >
            <CheckCircle2 size={15} aria-hidden="true" />
            <span className="hidden text-xs font-semibold md:inline">
              {card.statement?.paymentPending
                ? "Đang chờ duyệt"
                : hasStatementDebt
                  ? "Thanh toán sao kê"
                  : "Thanh toán dư nợ"}
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 md:h-9 md:w-auto md:gap-1.5 md:px-3"
            onClick={() => {
              setRefundTransactionId("");
              setRefundAmount("");
              setRefundDescription("");
              setRefundOpen(true);
            }}
            aria-label="Ghi nhận hoàn tiền"
            title="Ghi nhận hoàn tiền"
          >
            <RotateCcw size={15} aria-hidden="true" />
            <span className="hidden text-xs font-medium md:inline">Hoàn tiền</span>
          </Button>

          {canManage && (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="hidden size-9 md:inline-flex md:h-9 md:w-auto md:gap-1.5 md:px-3"
                onClick={openImportInstallment}
                aria-label="Thêm trả góp có sẵn"
                title="Thêm trả góp có sẵn"
              >
                <CalendarClock size={15} aria-hidden="true" />
                <span className="text-xs font-medium">Trả góp có sẵn</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  ref={cardMenuTriggerRef}
                  className="inline-flex size-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] cursor-pointer md:size-9"
                  aria-label="Tùy chọn quản lý thẻ"
                  title="Tùy chọn quản lý thẻ"
                >
                  <MoreHorizontal size={16} aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={openImportInstallment}>
                    <CalendarClock className="size-4" aria-hidden="true" />
                    <span>Thêm trả góp có sẵn</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openEditCard}>
                    <Pencil className="size-4" aria-hidden="true" />
                    <span>Chỉnh sửa thẻ</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      setConfirmLossChecked(false);
                      setConfirmDelete(true);
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    <span>Xóa thẻ tín dụng</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Mobile Compact Summary Strip (<768px) — Kept 100% Intact */}
      <Card
        as="section"
        className="p-3.5 md:hidden"
        aria-label="Tóm tắt hạn mức và sao kê thẻ"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                {hasCredit ? "Số dư nộp thừa" : "Dư nợ hiện tại"}
              </span>
              <p
                className={cn(
                  "mt-0.5 break-words text-lg font-bold tabular-nums tracking-tight",
                  hasCredit
                    ? "text-[var(--success)]"
                    : hasDebt
                      ? "text-[var(--destructive)]"
                      : "text-[var(--foreground)]",
                )}
              >
                {formatAmount(hasCredit ? card.creditBalance : card.debt)}{" "}
                <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{currency}</span>
              </p>
            </div>

            <div className="min-w-0 text-right">
              <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                {isOverLimit ? "Vượt hạn mức" : "Hạn mức còn lại"}
              </span>
              <p
                className={cn(
                  "mt-0.5 break-words text-base font-bold tabular-nums tracking-tight",
                  isOverLimit ? "text-[var(--destructive)]" : "text-[var(--foreground)]",
                )}
              >
                {formatAmount(card.availableCredit, { maximumFractionDigits: 0 })}{" "}
                <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{currency}</span>
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)]">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  isOverLimit || utilizationPercent > 80
                    ? "bg-[var(--destructive)]"
                    : utilizationPercent > 50
                      ? "bg-[var(--warning)]"
                      : "bg-[var(--primary)]",
                )}
                style={{ width: `${utilizationPercent}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[11px] text-[var(--text-muted)]">
              <span>
                Đã dùng <strong className="font-semibold tabular-nums text-[var(--foreground)]">{utilizationPercent}%</strong> / {formatAmount(card.limit, { maximumFractionDigits: 0 })} {currency}
              </span>
              <span>
                Tiền chờ thanh toán thẻ: <strong className="font-semibold tabular-nums text-[var(--primary)]">{formatAmount(totalReservedForCard.toString(), { maximumFractionDigits: 0 })} {currency}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5">
            <div className="min-w-0 flex-1">
              {card.statement ? (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="font-medium text-[var(--text-secondary)]">Sao kê kỳ này:</span>
                  <strong className="font-bold tabular-nums text-[var(--foreground)]">
                    {formatAmount(statementRemaining.toString())} {currency}
                  </strong>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      card.statement.overdue
                        ? "bg-[var(--destructive)]/10 text-[var(--destructive)]"
                        : card.statement.status === "paid"
                          ? "bg-[var(--success)]/10 text-[var(--success)]"
                          : "bg-[var(--warning)]/10 text-[var(--warning)]",
                    )}
                  >
                    {card.statement.overdue
                      ? "Quá hạn"
                      : card.statement.status === "paid"
                        ? "Đã thanh toán"
                        : `Hạn ${formatShortDate(card.statement.dueDate)}`}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-[var(--text-muted)]">
                  Sao kê kỳ này: Chốt ngày {card.statementClosingDay} hàng tháng
                </span>
              )}
            </div>

            {card.statement && (
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 text-[var(--text-secondary)] hover:text-[var(--primary)]"
                  onClick={() => setStatementDetailOpen(true)}
                  aria-label="Tóm tắt kỳ sao kê"
                  title="Tóm tắt kỳ sao kê"
                >
                  <Info size={13} aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-[var(--text-secondary)] hover:text-[var(--primary)]"
                  render={
                    <Link
                      href={`/credit-cards/${card.id}/statements/${card.statement.id}`}
                      aria-label="Chi tiết sao kê"
                      title="Chi tiết sao kê"
                    />
                  }
                >
                  <ReceiptText size={13} aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Tablet & Desktop Executive 12-Column Credit Card Showcase (hidden on mobile) */}
      <div
        className="hidden md:grid md:grid-cols-12 md:gap-4 lg:gap-5"
        aria-label="Tóm tắt hạn mức và sao kê thẻ"
      >
        {/* Left Column (5/12 on md, 4/12 on lg): Luxury Visual Credit Card Plate */}
        <Card
          as="section"
          className="flex flex-col justify-between gap-4 border-[var(--border)] bg-[var(--surface)] p-5 md:col-span-5 lg:col-span-4"
        >
          <div className="flex items-center justify-between gap-3">
            <CardEmvChipAndWave />
            <CardBrandBadge brand={brand} />
          </div>

          <div className="space-y-3">
            <div className="min-w-0">
              <p className="break-words text-base font-semibold leading-snug text-[var(--foreground)]">
                {card.name}
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Chu kỳ sao kê: Ngày {card.statementClosingDay} · Hạn trả: Ngày {card.paymentDueDay}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/65 p-3.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                {hasCredit ? "Số dư nộp thừa" : "Dư nợ hiện tại"}
              </span>
              <p
                className={cn(
                  "mt-1 break-words text-2xl font-bold tabular-nums tracking-tight",
                  hasCredit
                    ? "text-[var(--success)]"
                    : hasDebt
                      ? "text-[var(--destructive)]"
                      : "text-[var(--foreground)]",
                )}
              >
                {formatAmount(hasCredit ? card.creditBalance : card.debt)}{" "}
                <span className="text-xs font-semibold text-[var(--text-secondary)]">{currency}</span>
              </p>
            </div>
          </div>

          <div className="space-y-2 border-t border-[var(--border)] pt-3.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)]">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  isOverLimit || utilizationPercent > 80
                    ? "bg-[var(--destructive)]"
                    : utilizationPercent > 50
                      ? "bg-[var(--warning)]"
                      : "bg-[var(--primary)]",
                )}
                style={{ width: `${utilizationPercent}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
              <span>
                Đã dùng <strong className="font-semibold tabular-nums text-[var(--foreground)]">{utilizationPercent}%</strong>
              </span>
              <span className="tabular-nums">
                Hạn mức: <strong className="font-semibold text-[var(--foreground)]">{formatAmount(card.limit, { maximumFractionDigits: 0 })} {currency}</strong>
              </span>
            </div>
          </div>
        </Card>

        {/* Right Column (7/12 on md, 8/12 on lg): Executive Metrics & Statement Bento */}
        <Card
          as="section"
          className="flex flex-col justify-between gap-4 p-5 md:col-span-7 lg:col-span-8"
        >
          <div className="grid grid-cols-2 gap-5 divide-x divide-[var(--border)]">
            {/* Metric 1: Hạn mức còn lại & Tiền chờ thanh toán thẻ */}
            <div className="min-w-0 pr-1">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                  <WalletCards className="size-3.5 text-[var(--primary)]" aria-hidden="true" />
                  <span>{isOverLimit ? "Vượt hạn mức tín dụng" : "Hạn mức còn lại"}</span>
                </span>
                <span className="rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--text-secondary)]">
                  Khả dụng {Math.max(0, 100 - utilizationPercent)}%
                </span>
              </div>

              <p
                className={cn(
                  "mt-1.5 break-words text-2xl font-bold tabular-nums tracking-tight",
                  isOverLimit ? "text-[var(--destructive)]" : "text-[var(--foreground)]",
                )}
              >
                {formatAmount(card.availableCredit, { maximumFractionDigits: 0 })}{" "}
                <span className="text-xs font-semibold text-[var(--text-secondary)]">{currency}</span>
              </p>

              <div className="mt-3.5 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--text-secondary)]">Chi tiêu chưa chốt sao kê</span>
                  <strong className="font-semibold tabular-nums text-[var(--foreground)]">
                    {formatAmount(unbilledAmount, { maximumFractionDigits: 0 })} {currency}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
                  <span className="text-[var(--text-secondary)]">Tiền chờ thanh toán thẻ</span>
                  <strong className="font-semibold tabular-nums text-[var(--primary)]">
                    {formatAmount(totalReservedForCard.toString(), { maximumFractionDigits: 0 })} {currency}
                  </strong>
                </div>
              </div>
            </div>

            {/* Metric 2: Sao kê kỳ này */}
            <div className="min-w-0 pl-5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                  <ReceiptText className="size-3.5 text-[var(--primary)]" aria-hidden="true" />
                  <span>Sao kê kỳ này</span>
                </span>
                {card.statement ? (
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        card.statement.overdue
                          ? "bg-[var(--destructive)]/10 text-[var(--destructive)]"
                          : card.statement.status === "paid"
                            ? "bg-[var(--success)]/10 text-[var(--success)]"
                            : "bg-[var(--warning)]/10 text-[var(--warning)]",
                      )}
                    >
                      {card.statement.overdue
                        ? "Quá hạn"
                        : card.statement.status === "paid"
                          ? "Đã thanh toán"
                          : `Hạn ${formatShortDate(card.statement.dueDate)}`}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 text-[var(--text-secondary)] hover:text-[var(--primary)]"
                      onClick={() => setStatementDetailOpen(true)}
                      aria-label="Tóm tắt kỳ sao kê"
                      title="Tóm tắt kỳ sao kê"
                    >
                      <Info size={13} aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-[var(--text-secondary)] hover:text-[var(--primary)]"
                      render={
                        <Link
                          href={`/credit-cards/${card.id}/statements/${card.statement.id}`}
                          aria-label="Chi tiết sao kê"
                          title="Chi tiết sao kê"
                        />
                      }
                    >
                      <ReceiptText size={13} aria-hidden="true" />
                    </Button>
                  </div>
                ) : (
                  <span className="rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                    Chốt ngày {card.statementClosingDay}
                  </span>
                )}
              </div>

              {card.statement ? (
                <>
                  <p className="mt-1.5 break-words text-2xl font-bold tabular-nums tracking-tight text-[var(--foreground)]">
                    {formatAmount(statementRemaining.toString())}{" "}
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">{currency}</span>
                  </p>
                  <div className="mt-3.5 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--text-secondary)]">Ngày chốt sao kê</span>
                      <strong className="font-semibold tabular-nums text-[var(--foreground)]">
                        {formatIsoDate(card.statement.cycleEndDate)}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
                      <span className="text-[var(--text-secondary)]">Hạn thanh toán</span>
                      <strong className="font-semibold tabular-nums text-[var(--foreground)]">
                        {formatIsoDate(card.statement.dueDate)}
                      </strong>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-1.5 text-lg font-semibold text-[var(--foreground)]">
                    Chưa đến kỳ chốt sao kê
                  </p>
                  <div className="mt-3.5 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--text-secondary)]">Kỳ chốt sao kê định kỳ</span>
                      <strong className="font-semibold text-[var(--foreground)]">
                        Ngày {card.statementClosingDay} hàng tháng
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
                      <span className="text-[var(--text-secondary)]">Hạn thanh toán định kỳ</span>
                      <strong className="font-semibold text-[var(--foreground)]">
                        Ngày {card.paymentDueDay} hàng tháng
                      </strong>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Bottom Funding Wallet Breakdown Bar inside Right Card */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-secondary)]">
                <Wallet className="size-3.5 text-[var(--primary)]" aria-hidden="true" />
                <span>Ví chuẩn bị trả thẻ:</span>
              </span>
              {card.fundingShares.some((s) => new Decimal(s.outstanding || 0).gt(0)) ? (
                card.fundingShares
                  .filter((share) => new Decimal(share.outstanding || 0).gt(0))
                  .map((share) => (
                    <span
                      key={share.walletId}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1 text-xs"
                    >
                      <span className="break-words font-medium text-[var(--text-secondary)]">
                        {share.walletName}
                      </span>
                      <span className="text-[var(--border)]">·</span>
                      <strong className="font-semibold tabular-nums text-[var(--foreground)]">
                        {formatAmount(share.outstanding, { maximumFractionDigits: 0 })} {currency}
                      </strong>
                    </span>
                  ))
              ) : (
                <span className="text-[var(--text-muted)]">
                  Chưa có khoản chờ thanh toán trên ví nguồn
                </span>
              )}
            </div>

            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              {card.activities.length} giao dịch · {activeInstallmentPlans.length} khoản trả góp đang chạy
            </span>
          </div>
        </Card>
      </div>

      {/* Main Progressive Disclosure Tabs: Giao dịch gần đây | Sao kê kỳ này & Lịch sử | Khoản trả góp */}
      <Card as="section" className="gap-3.5 p-3.5 md:gap-4 md:p-5">
        <Tabs defaultValue="activities" className="w-full space-y-3.5 md:space-y-4">
          <div className="flex flex-col gap-2.5 border-b border-[var(--border)] pb-3 md:flex-row md:items-center md:justify-between">
            <TabsList className="grid w-full grid-cols-3 md:inline-flex md:w-auto">
              <TabsTrigger value="activities" className="px-2 text-xs md:px-3 md:text-sm">
                <span className="md:hidden">Giao dịch</span>
                <span className="hidden md:inline">Giao dịch gần đây</span>
                <TabsCount>{card.activities.length}</TabsCount>
              </TabsTrigger>
              <TabsTrigger value="statements" className="px-2 text-xs md:px-3 md:text-sm">
                <span className="md:hidden">Sao kê</span>
                <span className="hidden md:inline">Sao kê kỳ này & Lịch sử</span>
                <TabsCount>{card.statements.length}</TabsCount>
              </TabsTrigger>
              <TabsTrigger value="installments" className="px-2 text-xs md:px-3 md:text-sm">
                <span className="md:hidden">Trả góp</span>
                <span className="hidden md:inline">Khoản trả góp</span>
                <TabsCount>{activeInstallmentPlans.length}</TabsCount>
              </TabsTrigger>
            </TabsList>

            {card.fundingShares.some((s) => new Decimal(s.outstanding || 0).gt(0)) && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)] md:hidden">
                <span className="text-[11px] text-[var(--text-muted)]">Ví chờ trả:</span>
                {card.fundingShares
                  .filter((share) => new Decimal(share.outstanding || 0).gt(0))
                  .map((share) => (
                    <span
                      key={share.walletId}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2 py-0.5 text-[11px]"
                    >
                      <span className="break-words">{share.walletName}:</span>
                      <strong className="font-semibold tabular-nums text-[var(--foreground)]">
                        {formatAmount(share.outstanding, { maximumFractionDigits: 0 })} {currency}
                      </strong>
                    </span>
                  ))}
              </div>
            )}
          </div>

          {/* TAB 1: GIAO DỊCH GẦN ĐÂY */}
          <TabsContent value="activities" className="space-y-3">
            {card.activities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Chưa có giao dịch nào trên thẻ
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Các khoản chi tiêu, hoàn tiền và thanh toán sao kê sẽ hiển thị tại đây.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile & Tablet Touch List (<1024px) with Spotlight Context Highlight Menu */}
                <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)] lg:hidden">
                  {paginatedActivities.map((activity) => {
                    const isCredit =
                      activity.purpose === "credit_card_payment" ||
                      activity.purpose === "credit_card_refund";
                    const canRefund = new Decimal(activity.refundableAmount || 0).gt(0);
                    const hasActivityActions = Boolean(
                      activity.installmentEligible ||
                        canRefund ||
                        activity.canEdit ||
                        activity.canDelete,
                    );
                    const isMenuOpen = menuActivityId === activity.id;

                    const rowInner = (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                            {activity.description || activityLabel(activity)}
                          </p>
                          <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-muted)]">
                            {formatIsoDate(activity.date)} · {activity.category || activityLabel(activity)}
                            {activity.status !== "approved" ? " · Chờ duyệt" : ""}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-sm font-bold tabular-nums",
                            isCredit ? "text-[var(--success)]" : "text-[var(--foreground)]",
                          )}
                        >
                          {isCredit ? "−" : "+"}
                          {formatAmount(activity.amount)} {currency}
                        </span>
                      </div>
                    );

                    if (!hasActivityActions) {
                      return (
                        <div key={activity.id} className="p-3.5">
                          {rowInner}
                        </div>
                      );
                    }

                    return (
                      <DropdownMenu
                        key={activity.id}
                        open={isMenuOpen}
                        onOpenChange={(open) => setMenuActivityId(open ? activity.id : null)}
                      >
                        <SpotlightTrigger
                          open={isMenuOpen}
                          onOpenChange={(open) => setMenuActivityId(open ? activity.id : null)}
                          mobileOnly
                          dismissLabel={`Đóng menu thao tác giao dịch ${activity.description || activityLabel(activity)}`}
                          render={
                            <div
                              role="button"
                              tabIndex={0}
                              aria-label={`${activity.description || activityLabel(activity)}, ${isCredit ? "−" : "+"}${formatAmount(activity.amount)} ${currency}. Chạm để mở menu thao tác.`}
                              className="cursor-pointer select-none p-3.5 text-left transition-all duration-150 active:scale-[0.99] active:bg-[var(--surface-hover)]"
                            />
                          }
                        >
                          {(spotlightTrigger) => (
                            <DropdownMenuTrigger nativeButton={false} render={spotlightTrigger}>
                              {rowInner}
                            </DropdownMenuTrigger>
                          )}
                        </SpotlightTrigger>

                        <DropdownMenuContent
                          align="center"
                          side="bottom"
                          sideOffset={6}
                          className="w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 lg:hidden"
                        >
                          {activity.installmentEligible && (
                            <DropdownMenuItem
                              onClick={() => {
                                setMenuActivityId(null);
                                setInstallmentTarget(activity);
                                setTermCount("3");
                                setFeeAmount("");
                              }}
                            >
                              <Split className="size-4 text-[var(--primary)]" aria-hidden="true" />
                              <span>Chuyển đổi trả góp</span>
                            </DropdownMenuItem>
                          )}
                          {canRefund && (
                            <DropdownMenuItem
                              onClick={() => {
                                setMenuActivityId(null);
                                setRefundTransactionId(activity.id);
                                setRefundAmount(activity.refundableAmount);
                                setRefundDescription("");
                                setRefundOpen(true);
                              }}
                            >
                              <RotateCcw className="size-4 text-[var(--text-secondary)]" aria-hidden="true" />
                              <span>Hoàn tiền giao dịch</span>
                            </DropdownMenuItem>
                          )}
                          {activity.canEdit && (
                            <DropdownMenuItem
                              onClick={() => {
                                setMenuActivityId(null);
                                startEditingActivity(activity);
                              }}
                            >
                              <Pencil className="size-4 text-[var(--text-secondary)]" aria-hidden="true" />
                              <span>Chỉnh sửa giao dịch</span>
                            </DropdownMenuItem>
                          )}
                          {activity.canDelete && (
                            <>
                              {(activity.installmentEligible || canRefund || activity.canEdit) && (
                                <DropdownMenuSeparator />
                              )}
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => {
                                  setMenuActivityId(null);
                                  setDeletingActivity(activity);
                                }}
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                                <span>Xóa giao dịch</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  })}
                </div>

                {/* Desktop Table (lg:block) */}
                <div className="hidden overflow-hidden rounded-xl border border-[var(--border)] lg:block">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-[var(--border)] bg-[var(--surface-secondary)] text-xs font-semibold text-[var(--text-secondary)]">
                      <tr>
                        <th className="px-4 py-3">Giao dịch</th>
                        <th className="px-4 py-3">Phân loại</th>
                        <th className="px-4 py-3">Ngày giao dịch</th>
                        <th className="px-4 py-3 text-right">Dư nợ thay đổi</th>
                        <th className="px-4 py-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
                      {paginatedActivities.map((activity) => {
                        const isCredit =
                          activity.purpose === "credit_card_payment" ||
                          activity.purpose === "credit_card_refund";
                        const canRefund = new Decimal(activity.refundableAmount || 0).gt(0);
                        const matchedCategory =
                          (activity.categoryId ? categoriesById.get(activity.categoryId) : undefined) ??
                          (activity.category ? categoriesByName.get(activity.category) : undefined);

                        return (
                          <tr key={activity.id} className="transition-colors hover:bg-[var(--surface-secondary)]/50">
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                {activity.purpose === "credit_card_payment" ? (
                                  <span className="inline-grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--success)]/25 bg-[var(--success)]/10 text-[var(--success)]">
                                    <CheckCircle2 size={16} aria-hidden="true" />
                                  </span>
                                ) : activity.purpose === "credit_card_refund" ? (
                                  <span className="inline-grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--primary)]/25 bg-[var(--primary)]/10 text-[var(--primary)]">
                                    <RotateCcw size={16} aria-hidden="true" />
                                  </span>
                                ) : activity.purpose === "credit_card_installment_fee" ? (
                                  <span className="inline-grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--warning)]/25 bg-[var(--warning)]/10 text-[var(--warning)]">
                                    <Split size={16} aria-hidden="true" />
                                  </span>
                                ) : matchedCategory ? (
                                  <CategoryIcon
                                    category={{
                                      color: matchedCategory.color ?? undefined,
                                      icon: matchedCategory.icon,
                                    }}
                                    size={16}
                                    className="size-9 rounded-xl"
                                  />
                                ) : (
                                  <span className="inline-grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--primary)]">
                                    <CreditCard size={16} aria-hidden="true" />
                                  </span>
                                )}

                                <div className="min-w-0">
                                  <p className="break-words font-semibold leading-snug text-[var(--foreground)]">
                                    {activity.description || activityLabel(activity)}
                                  </p>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)]">
                                    <span>{activityLabel(activity)}</span>
                                    {activity.installmentPlanId && (
                                      <>
                                        <span>·</span>
                                        <span className="font-medium text-[var(--primary)]">Đang trả góp</span>
                                      </>
                                    )}
                                    {activity.status !== "approved" && (
                                      <>
                                        <span>·</span>
                                        <span className="font-medium text-[var(--warning)]">
                                          Đang chờ duyệt
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-xs text-[var(--text-secondary)]">
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1 font-medium text-[var(--foreground)]">
                                {matchedCategory?.color && (
                                  <span
                                    className="size-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: matchedCategory.color }}
                                    aria-hidden="true"
                                  />
                                )}
                                <span className="break-words">
                                  {activity.category || activityLabel(activity)}
                                </span>
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-xs font-medium tabular-nums text-[var(--text-secondary)]">
                              {formatIsoDate(activity.date)}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className={cn(
                                  "block font-bold tabular-nums",
                                  isCredit ? "text-[var(--success)]" : "text-[var(--foreground)]",
                                )}
                              >
                                {isCredit ? "−" : "+"}
                                {formatAmount(activity.amount)} {currency}
                              </span>
                              <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">
                                {isCredit ? "Giảm dư nợ thẻ" : "Tăng dư nợ thẻ"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {activity.installmentEligible && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="size-7"
                                    onClick={() => {
                                      setInstallmentTarget(activity);
                                      setTermCount("3");
                                      setFeeAmount("");
                                    }}
                                    aria-label="Chuyển đổi trả góp"
                                    title="Chuyển đổi trả góp"
                                  >
                                    <Split size={13} aria-hidden="true" />
                                  </Button>
                                )}
                                {canRefund && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="size-7"
                                    onClick={() => {
                                      setRefundTransactionId(activity.id);
                                      setRefundAmount(activity.refundableAmount);
                                      setRefundDescription("");
                                      setRefundOpen(true);
                                    }}
                                    aria-label="Hoàn tiền giao dịch"
                                    title="Hoàn tiền giao dịch"
                                  >
                                    <RotateCcw size={13} aria-hidden="true" />
                                  </Button>
                                )}
                                {activity.canEdit && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-7"
                                    onClick={() => startEditingActivity(activity)}
                                    aria-label="Chỉnh sửa giao dịch"
                                    title="Chỉnh sửa giao dịch"
                                  >
                                    <Pencil size={13} aria-hidden="true" />
                                  </Button>
                                )}
                                {activity.canDelete && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-[var(--text-muted)] hover:text-[var(--destructive)]"
                                    onClick={() => setDeletingActivity(activity)}
                                    aria-label="Xóa giao dịch"
                                    title="Xóa giao dịch"
                                  >
                                    <Trash2 size={13} aria-hidden="true" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <TabPagination
                  currentPage={currentActivityPage}
                  totalPages={totalActivityPages}
                  totalItems={card.activities.length}
                  pageSize={ACTIVITIES_PAGE_SIZE}
                  onPageChange={setActivityPage}
                  itemLabel="giao dịch"
                />
              </>
            )}
          </TabsContent>

          {/* TAB 2: SAO KÊ KỲ NÀY & LỊCH SỬ */}
          <TabsContent value="statements" className="space-y-4">
            {card.statement && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      Sao kê kỳ này · Chốt {formatIsoDate(card.statement.cycleEndDate)}
                    </span>
                    {card.statement.overdue && (
                      <span className="rounded-full bg-[var(--destructive)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--destructive)]">
                        Quá hạn
                      </span>
                    )}
                  </div>
                  <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">
                    Cần thanh toán: {formatAmount(statementRemaining.toString())} {currency}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Hạn thanh toán: {formatIsoDate(card.statement.dueDate)} · Tổng phát sinh kỳ này:{" "}
                    {formatAmount(card.statement.amount)} {currency}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    render={
                      <Link
                        href={`/credit-cards/${card.id}/statements/${card.statement.id}`}
                        aria-label="Chi tiết sao kê"
                        title="Chi tiết sao kê"
                      />
                    }
                  >
                    <ReceiptText size={15} aria-hidden="true" />
                  </Button>
                  {hasStatementDebt && (
                    <Button
                      type="button"
                      variant="default"
                      size="icon"
                      disabled={pending || card.statement.paymentPending}
                      onClick={() => openPaymentSheet("statement")}
                      aria-label={card.statement.paymentPending ? "Đang chờ duyệt" : "Thanh toán sao kê"}
                      title={card.statement.paymentPending ? "Đang chờ duyệt" : "Thanh toán sao kê"}
                    >
                      <CheckCircle2 size={15} aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {card.statements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Chưa có kỳ sao kê nào được chốt
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Sao kê sẽ tự động được tổng hợp vào ngày {card.statementClosingDay} hàng tháng.
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                  {paginatedStatements.map((statement) => (
                    <Link
                      key={statement.id}
                      href={`/credit-cards/${card.id}/statements/${statement.id}`}
                      className="flex items-center justify-between gap-4 p-3.5 text-sm transition-colors hover:bg-[var(--surface-secondary)]"
                    >
                      <div className="min-w-0">
                        <p className="break-words font-semibold leading-snug text-[var(--foreground)]">
                          Sao kê chốt ngày {formatIsoDate(statement.cycleEndDate)}
                        </p>
                        <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-muted)]">
                          Hạn thanh toán: {formatIsoDate(statement.dueDate)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-bold tabular-nums text-[var(--foreground)]">
                          {formatAmount(statement.amount)} {currency}
                        </p>
                        <span
                          className={cn(
                            "text-[11px] font-semibold",
                            statement.status === "paid"
                              ? "text-[var(--success)]"
                              : statement.isPartiallyPaid
                                ? "text-[var(--primary)]"
                                : "text-[var(--warning)]",
                          )}
                        >
                          {statement.status === "paid"
                            ? "Đã thanh toán"
                            : statement.isPartiallyPaid
                              ? `Còn ${formatAmount(statement.remainingAmount ?? statement.amount)} ${currency}`
                              : "Chưa thanh toán"}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>

                <TabPagination
                  currentPage={currentStatementPage}
                  totalPages={totalStatementPages}
                  totalItems={card.statements.length}
                  pageSize={STATEMENTS_PAGE_SIZE}
                  onPageChange={setStatementPage}
                  itemLabel="kỳ sao kê"
                />
              </>
            )}
          </TabsContent>

          {/* TAB 3: KHOẢN TRẢ GÓP */}
          <TabsContent value="installments" className="space-y-3.5 md:space-y-4">
            <div className="flex items-center justify-between gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 md:p-3.5">
              <div className="grid min-w-0 flex-1 grid-cols-3 gap-2 text-xs md:flex md:flex-wrap md:items-center md:gap-4">
                <div className="min-w-0">
                  <span className="block text-[10px] text-[var(--text-muted)] md:inline md:text-xs">Đang trả góp: </span>
                  <strong className="block font-semibold tabular-nums text-[var(--foreground)] md:inline">
                    {activeInstallmentPlans.length} khoản
                  </strong>
                </div>
                <div className="min-w-0 border-l border-[var(--border)] pl-2 md:border-l-0 md:pl-0">
                  <span className="block text-[10px] text-[var(--text-muted)] md:inline md:text-xs">Kỳ tiếp theo: </span>
                  <strong className="block font-semibold tabular-nums text-[var(--primary)] md:inline">
                    {formatAmount(monthlyInstallmentTotal.toString(), { maximumFractionDigits: 0 })} {currency}
                  </strong>
                </div>
                <div className="min-w-0 border-l border-[var(--border)] pl-2 md:border-l-0 md:pl-0">
                  <span className="block text-[10px] text-[var(--text-muted)] md:inline md:text-xs">Còn lại: </span>
                  <strong className="block font-semibold tabular-nums text-[var(--foreground)] md:inline">
                    {formatAmount(remainingInstallmentPrincipal.toString(), { maximumFractionDigits: 0 })} {currency}
                  </strong>
                </div>
              </div>
              {canManage && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={openImportInstallment}
                  aria-label="Thêm trả góp có sẵn"
                  title="Thêm trả góp có sẵn"
                >
                  <CalendarClock size={15} aria-hidden="true" />
                </Button>
              )}
            </div>

            {card.installmentPlans.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Chưa có kế hoạch trả góp nào
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Bạn có thể chuyển đổi giao dịch chi tiêu sang trả góp hoặc nhập khoản trả góp đã có sẵn.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {paginatedInstallmentPlans.map(renderInstallmentCard)}
                </div>
                <TabPagination
                  currentPage={currentInstallmentPage}
                  totalPages={totalInstallmentPages}
                  totalItems={card.installmentPlans.length}
                  pageSize={INSTALLMENTS_PAGE_SIZE}
                  onPageChange={setInstallmentPage}
                  itemLabel="khoản trả góp"
                />
              </>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* SHEET 1: Thanh toán sao kê / dư nợ thẻ */}
      <Sheet open={paymentConfirmOpen} onOpenChange={(nextOpen) => !pending && setPaymentConfirmOpen(nextOpen)}>
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          placement={isDesktop ? "inset" : "edge"}
          size={isDesktop ? "wide" : "default"}
          spacing="flush"
          elevation="flat"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <SheetHeader
              icon={WalletCards}
              title="Thanh toán sao kê & dư nợ thẻ"
              description={`Thẻ ${card.name} · Trích từ tiền chờ thanh toán thẻ trên ví nguồn`}
            />

            <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-5 overscroll-contain">
              {/* Chọn phương thức thanh toán */}
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-1">
                {hasStatementDebt && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentTargetMode("statement");
                      setCustomSourcesMode(false);
                    }}
                    className={cn(
                      "rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer",
                      paymentTargetMode === "statement"
                        ? "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--foreground)]",
                    )}
                  >
                    Sao kê kỳ này
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPaymentTargetMode("current_debt");
                    setCustomSourcesMode(false);
                  }}
                  className={cn(
                    "rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer",
                    paymentTargetMode === "current_debt"
                      ? "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--foreground)]",
                  )}
                >
                  Toàn bộ dư nợ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentTargetMode("custom");
                    if (!partialPaymentAmount && targetMaxAmount.gt(0)) {
                      setPartialPaymentAmount(targetMaxAmount.toFixed(0));
                    }
                  }}
                  className={cn(
                    "rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer",
                    paymentTargetMode === "custom"
                      ? "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--foreground)]",
                  )}
                >
                  Tùy chọn số tiền
                </button>
              </div>

              {/* Số tiền thanh toán */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4 text-center">
                <p className="text-xs font-medium text-[var(--text-secondary)]">
                  {paymentTargetMode === "statement"
                    ? "Số tiền thanh toán sao kê kỳ này"
                    : paymentTargetMode === "current_debt"
                      ? "Tổng dư nợ hiện tại cần tất toán"
                      : "Số tiền thanh toán tùy chọn"}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--foreground)]">
                  {formatAmount(effectivePaymentAmount.toString())}{" "}
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">{currency}</span>
                </p>
                {paymentTargetMode === "current_debt" && hasStatementDebt && unbilledAmount.gt(0) && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Gồm sao kê kỳ này {formatAmount(statementRemaining)} {currency} + chi tiêu mới {formatAmount(unbilledAmount)} {currency}
                  </p>
                )}
              </div>

              {/* Nhập số tiền tùy chọn */}
              {paymentTargetMode === "custom" && !customSourcesMode && (
                <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--foreground)]">Nhập số tiền muốn trả</span>
                    <span className="tabular-nums text-[var(--text-muted)]">
                      Tối đa: {formatAmount(targetMaxAmount)} {currency}
                    </span>
                  </div>
                  <MoneyInput
                    value={partialPaymentAmount}
                    onValueChange={setPartialPaymentAmount}
                    placeholder="0"
                    aria-label="Số tiền muốn trả"
                  />
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { fraction: 0.25, label: "25%" },
                      { fraction: 0.5, label: "50%" },
                      { fraction: 0.75, label: "75%" },
                      { fraction: 1.0, label: "Tất cả" },
                    ].map(({ fraction, label }) => (
                      <Button
                        key={fraction}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => applyQuickChip(fraction)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Dư nợ còn lại sau thanh toán:{" "}
                    <strong className="font-semibold tabular-nums text-[var(--foreground)]">
                      {formatAmount(remainingAfterPayment)} {currency}
                    </strong>
                  </p>
                </div>
              )}

              {/* Chỉnh từng ví nguồn */}
              {customSourcesMode ? (
                <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--foreground)]">
                      Phân bổ theo từng ví nguồn
                    </span>
                    <button
                      type="button"
                      onClick={disableCustomSources}
                      className="font-semibold text-[var(--primary)] hover:underline cursor-pointer"
                    >
                      Chia tự động
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {basePaymentSources.map((source) => {
                      const wName = walletNames.get(source.walletId) ?? "Ví nguồn";
                      const maxDue = new Decimal(source.amount);
                      const currentVal = customSourcesMap[source.walletId] ?? "";
                      return (
                        <div
                          key={source.walletId}
                          className="space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3"
                        >
                          <div className="flex items-start justify-between gap-2 text-xs">
                            <span className="break-words font-semibold leading-snug text-[var(--foreground)]">{wName}</span>
                            <span className="shrink-0 tabular-nums text-[var(--text-muted)]">
                              Tối đa: {formatAmount(maxDue)} {currency}
                            </span>
                          </div>
                          <MoneyInput
                            value={currentVal}
                            onValueChange={(val) =>
                              setCustomSourcesMap((prev) => ({ ...prev, [source.walletId]: val }))
                            }
                            placeholder="0"
                            aria-label={`Số tiền trích từ ${wName}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--foreground)]">
                      Ví nguồn trích thanh toán ({computedPaymentSources.length})
                    </span>
                    {hasMultipleSources && (
                      <button
                        type="button"
                        onClick={enableCustomSources}
                        className="font-semibold text-[var(--primary)] hover:underline cursor-pointer"
                      >
                        Chỉnh từng ví
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                    {computedPaymentSources.length > 0 ? (
                      computedPaymentSources.map((source) => {
                        const wName = walletNames.get(source.walletId) ?? "Ví nguồn";
                        return (
                          <div
                            key={source.walletId}
                            className="flex items-center justify-between gap-3 p-3 text-sm"
                          >
                            <div className="flex min-w-0 items-start gap-2.5">
                              <Wallet size={15} className="mt-0.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                              <span className="break-words font-medium leading-snug text-[var(--foreground)]">{wName}</span>
                            </div>
                            <span className="shrink-0 font-bold tabular-nums text-[var(--foreground)]">
                              {formatAmount(source.amount)} {currency}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                        Nhập số tiền hợp lệ để phân bổ nguồn trích thanh toán.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <SheetFooter
              className="border-t border-[var(--border)] bg-[var(--surface)] p-4 md:px-5"
              onCancel={() => setPaymentConfirmOpen(false)}
              cancelLabel="Hủy"
              submitLabel={
                canApprove
                  ? `Thanh toán · ${formatAmount(effectivePaymentAmount)} ${currency}`
                  : `Gửi yêu cầu (${formatAmount(effectivePaymentAmount)} ${currency})`
              }
              isSubmitting={pending}
              submittingLabel="Đang xử lý..."
              submitDisabled={pending || !isPaymentValid || effectivePaymentAmount.lte(0)}
              onSubmit={payStatement}
              submitType="button"
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* SHEET 2: Ghi nhận hoàn tiền */}
      <Sheet
        open={refundOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setRefundOpen(false);
            setRefundAmount("");
            setRefundTransactionId("");
            setRefundDescription("");
          }
        }}
      >
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          placement={isDesktop ? "inset" : "edge"}
          size={isDesktop ? "wide" : "default"}
          spacing="flush"
          elevation="flat"
        >
          <form
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onSubmit={(e) => {
              e.preventDefault();
              submitRefund();
            }}
          >
            <SheetHeader
              icon={RotateCcw}
              title={refundTransactionId ? "Hoàn tiền giao dịch" : "Ghi nhận hoàn tiền"}
              description={
                refundTransactionId
                  ? `Hoàn lại tiền chi tiêu vào thẻ ${card.name}`
                  : `Ghi nhận tiền hoàn hoặc cashback vào thẻ ${card.name}`
              }
            />

            <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-5 overscroll-contain">
              {selectedRefundActivity && (
                <div className="space-y-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-xs">
                  <div className="flex items-center justify-between text-[var(--text-muted)]">
                    <span>Giao dịch gốc</span>
                    <span>{formatIsoDate(selectedRefundActivity.date)}</span>
                  </div>
                  <p className="break-words font-semibold leading-snug text-[var(--foreground)]">
                    {selectedRefundActivity.description || "Chi tiêu thẻ"}
                  </p>
                  <p className="text-[var(--text-secondary)]">
                    Tối đa có thể hoàn:{" "}
                    <strong className="font-semibold tabular-nums text-[var(--primary)]">
                      {formatAmount(selectedRefundActivity.refundableAmount)} {currency}
                    </strong>
                  </p>
                </div>
              )}

              <div>
                <MoneyInput
                  label="Số tiền hoàn"
                  value={refundAmount}
                  onValueChange={setRefundAmount}
                  placeholder="0"
                  required
                  autoFocus
                />
                {selectedRefundActivity &&
                  refundAmount &&
                  new Decimal(refundAmount || 0).gt(selectedRefundActivity.refundableAmount) && (
                    <p role="alert" className="mt-1 flex items-center gap-1.5 text-xs text-[var(--destructive)]">
                      <AlertCircle className="size-3.5" aria-hidden="true" />
                      Số tiền hoàn không được vượt quá {formatAmount(selectedRefundActivity.refundableAmount)} {currency}.
                    </p>
                  )}
              </div>

              <Input
                label="Nội dung"
                value={refundDescription}
                onChange={(e) => setRefundDescription(e.target.value)}
                placeholder="Hoàn tiền đơn hàng, Cashback..."
                maxLength={120}
              />
            </div>

            <SheetFooter
              className="border-t border-[var(--border)] p-4 md:px-5"
              onCancel={() => {
                setRefundOpen(false);
                setRefundAmount("");
                setRefundTransactionId("");
                setRefundDescription("");
              }}
              cancelLabel="Hủy"
              submitLabel={pending ? "Đang ghi nhận..." : "Ghi nhận hoàn tiền"}
              isSubmitting={pending}
              submitDisabled={
                pending ||
                !refundAmount ||
                !new Decimal(refundAmount || 0).gt(0) ||
                Boolean(
                  selectedRefundActivity &&
                    new Decimal(refundAmount || 0).gt(selectedRefundActivity.refundableAmount),
                )
              }
            />
          </form>
        </SheetContent>
      </Sheet>

      {/* SHEET 3: Đăng ký trả góp từ giao dịch */}
      <Sheet
        open={Boolean(installmentTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setInstallmentTarget(null);
        }}
      >
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          placement={isDesktop ? "inset" : "edge"}
          size={isDesktop ? "wide" : "default"}
          spacing="flush"
          elevation="flat"
        >
          <form
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onSubmit={(e) => {
              e.preventDefault();
              registerInstallment();
            }}
          >
            <SheetHeader
              icon={Split}
              title="Đăng ký trả góp"
              description="Chia nhỏ khoản chi tiêu thành các kỳ thanh toán hàng tháng."
            />

            <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-5 overscroll-contain">
              {installmentTarget && (
                <div className="space-y-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5 text-xs">
                  <div className="flex items-center justify-between text-[var(--text-muted)]">
                    <span>Khoản chi tiêu chuyển đổi</span>
                    <span>{formatIsoDate(installmentTarget.date)}</span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="break-words font-semibold leading-snug text-[var(--foreground)]">
                      {installmentTarget.description || "Chi tiêu thẻ"}
                    </p>
                    <span className="shrink-0 font-bold tabular-nums text-[var(--foreground)]">
                      {formatAmount(installmentTarget.amount)} {currency}
                    </span>
                  </div>
                </div>
              )}

              <Select
                label="Kỳ hạn trả góp"
                value={termCount}
                onValueChange={setTermCount}
                options={[3, 6, 9, 12, 18, 24].map((value) => ({
                  value: String(value),
                  label: `${value} tháng`,
                }))}
                required
              />

              <MoneyInput
                label={`Phí chuyển đổi (${currency})`}
                value={feeAmount}
                onValueChange={setFeeAmount}
                placeholder="0"
              />

              {installmentCalc && (
                <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-xs">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-[var(--text-secondary)]">
                      {installmentCalc.hasFee ? "Mỗi tháng (từ kỳ 2)" : "Ước tính mỗi tháng"}
                    </span>
                    <span className="font-semibold tabular-nums text-[var(--foreground)]">
                      ~{formatAmount(installmentCalc.regularPrincipal, { maximumFractionDigits: 0 })} {currency}/tháng
                    </span>
                  </div>
                  {installmentCalc.hasFee && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-[var(--text-secondary)]">Kỳ đầu (gốc + phí)</span>
                      <span className="font-semibold tabular-nums text-[var(--primary)]">
                        ~{formatAmount(installmentCalc.firstTermAmount, { maximumFractionDigits: 0 })} {currency}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[var(--text-secondary)]">
                      Tổng thanh toán ({installmentCalc.count} kỳ)
                    </span>
                    <span className="font-bold tabular-nums text-[var(--foreground)]">
                      {formatAmount(installmentCalc.total, { maximumFractionDigits: 0 })} {currency}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <SheetFooter
              className="border-t border-[var(--border)] p-4 md:px-5"
              onCancel={() => setInstallmentTarget(null)}
              cancelLabel="Hủy"
              submitLabel={pending ? "Đang xử lý..." : "Xác nhận trả góp"}
              isSubmitting={pending}
              submitDisabled={pending || (feeAmount.trim() !== "" && new Decimal(feeAmount).lt(0))}
            />
          </form>
        </SheetContent>
      </Sheet>

      {/* SHEET 4: Thêm khoản trả góp đã có sẵn */}
      <Sheet
        open={importOpen}
        onOpenChange={(nextOpen) => {
          if (!pending) {
            setImportOpen(nextOpen);
            if (!nextOpen) setImportStep(1);
          }
        }}
      >
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          placement={isDesktop ? "inset" : "edge"}
          size={isDesktop ? "wide" : "default"}
          spacing="flush"
          elevation="flat"
        >
          <form
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onSubmit={(event) => {
              event.preventDefault();
              if (importStep === 1) {
                if (canProceedToStep2) setImportStep(2);
              } else {
                importOngoingInstallment();
              }
            }}
          >
            <SheetHeader
              icon={History}
              title={importStep === 1 ? "Thêm khoản trả góp đã có" : "Nguồn tiền & Dư nợ ban đầu"}
              description={
                importStep === 1
                  ? "Bước 1/2 · Thông tin khoản trả góp"
                  : "Bước 2/2 · Nguồn tiền và tính vào dư nợ thẻ"
              }
            />

            {importStep === 1 ? (
              <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-5 overscroll-contain">
                <Input
                  label="Tên khoản trả góp"
                  value={importDescription}
                  onChange={(event) => setImportDescription(event.target.value)}
                  placeholder="Điện thoại, Học phí..."
                  maxLength={120}
                  required
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Tổng số tháng"
                    type="number"
                    inputMode="numeric"
                    placeholder="12"
                    min={2}
                    max={60}
                    value={importTermCount}
                    onChange={(event) => setImportTermCount(event.target.value)}
                    required
                  />
                  <Input
                    label="Đã trả (tháng)"
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    min={0}
                    max={importTermCount ? Math.max(Number(importTermCount) - 1, 0) : undefined}
                    value={importPaidTermCount}
                    onChange={(event) => setImportPaidTermCount(event.target.value)}
                  />
                </div>
                <MoneyInput
                  label={`Số tiền còn phải trả (${currency})`}
                  value={importRemainingAmount}
                  onValueChange={setImportRemainingAmount}
                  placeholder="0"
                  required
                />
                {importPreview && (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-xs">
                    <p className="text-[var(--text-muted)]">
                      Còn lại {importPreview.remainingTerms} tháng · Đã trả {importPaidTermCount || "0"}/{importTermCount} tháng
                    </p>
                    <p className="mt-1 text-sm font-bold tabular-nums text-[var(--foreground)]">
                      Mỗi tháng trả: {formatAmount(importPreview.monthlyAmount, { maximumFractionDigits: 0 })} {currency}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-5 overscroll-contain">
                <div>
                  <Select
                    label="Dư nợ thẻ hiện tại đã gồm khoản này chưa?"
                    value={importBalanceMode}
                    onValueChange={(value) => setImportBalanceMode(value as typeof importBalanceMode)}
                    options={[
                      { value: "included_opening_debt", label: "Đã tính trong dư nợ ban đầu" },
                      { value: "add_to_balance", label: "Chưa tính (cộng thêm vào dư nợ thẻ)" },
                    ]}
                    required
                  />
                </div>
                <div>
                  <Select
                    label="Ví trích tiền chờ thanh toán thẻ"
                    value={importFundingWalletId}
                    onValueChange={setImportFundingWalletId}
                    options={fundingWallets.map((wallet) => ({ value: wallet.id, label: wallet.name }))}
                    required
                  />
                  {importBalanceMode === "included_opening_debt" && (
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Dư nợ ban đầu còn có thể phân bổ: {formatAmount(selectedImportableOpeningDebt)} {currency}
                    </p>
                  )}
                </div>
                <Select
                  label="Bắt đầu từ kỳ sao kê"
                  value={importFirstStatementDate}
                  onValueChange={setImportFirstStatementDate}
                  options={importStatementOptions}
                  required
                />
                {importBalanceMode === "included_opening_debt" && exceedsImportableOpeningDebt && (
                  <p role="alert" className="flex items-start gap-2 text-xs text-[var(--destructive)]">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>
                      Số tiền vượt quá phần dư nợ ban đầu còn lại của thẻ. Hãy giảm số tiền hoặc chọn cộng thêm vào dư nợ thẻ.
                    </span>
                  </p>
                )}
              </div>
            )}

            {importStep === 1 ? (
              <SheetFooter
                className="border-t border-[var(--border)] p-4 md:px-5"
                onCancel={() => setImportOpen(false)}
                cancelLabel="Hủy"
                submitLabel="Tiếp tục"
                submitType="button"
                onSubmit={(e) => {
                  e?.preventDefault();
                  if (canProceedToStep2) setImportStep(2);
                }}
                submitDisabled={!canProceedToStep2}
              />
            ) : (
              <SheetFooter
                className="border-t border-[var(--border)] p-4 md:px-5"
                onCancel={() => setImportStep(1)}
                cancelLabel="Quay lại"
                submitLabel={pending ? "Đang xử lý..." : "Nhập khoản trả góp"}
                submitType="submit"
                isSubmitting={pending}
                submitDisabled={
                  pending ||
                  !canProceedToStep2 ||
                  !importFundingWalletId ||
                  !importFirstStatementDate ||
                  exceedsImportableOpeningDebt
                }
              />
            )}
          </form>
        </SheetContent>
      </Sheet>

      {/* SHEET 5: Chỉnh sửa thẻ tín dụng */}
      <Sheet open={editOpen} onOpenChange={(nextOpen) => !pending && setEditOpen(nextOpen)}>
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          placement={isDesktop ? "inset" : "edge"}
          size={isDesktop ? "wide" : "default"}
          spacing="flush"
          elevation="flat"
        >
          <form
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onSubmit={(event) => {
              event.preventDefault();
              submitEdit();
            }}
          >
            <SheetHeader
              icon={Pencil}
              title="Chỉnh sửa thẻ tín dụng"
              description="Thông tin mới áp dụng cho các kỳ sao kê phát sinh sau khi cập nhật."
            />
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
              <div className="space-y-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/35 p-3.5">
                <Input
                  label="Tên thẻ"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  maxLength={120}
                  required
                />
                <MoneyInput
                  label={`Hạn mức tín dụng (${currency})`}
                  value={editLimit}
                  onValueChange={setEditLimit}
                  required
                />
              </div>

              <div className="space-y-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/35 p-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Ngày chốt sao kê"
                    value={editClosingDay}
                    onValueChange={setEditClosingDay}
                    options={DAY_OPTIONS}
                    required
                  />
                  <Select
                    label="Hạn thanh toán"
                    value={editDueDay}
                    onValueChange={setEditDueDay}
                    options={DAY_OPTIONS}
                    required
                  />
                </div>
                <Select
                  label="Ví thanh toán mặc định"
                  value={editFundingWalletId}
                  onValueChange={setEditFundingWalletId}
                  options={fundingWallets.map((wallet) => ({ value: wallet.id, label: wallet.name }))}
                  required
                />
              </div>

              <Textarea
                label="Ghi chú (tuỳ chọn)"
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                maxLength={2000}
                rows={2}
                className="min-h-[4rem] resize-none"
              />
            </div>
            <SheetFooter
              className="border-t border-[var(--border)] p-4 md:px-5"
              onCancel={() => setEditOpen(false)}
              cancelLabel="Hủy"
              submitLabel="Lưu thay đổi"
              isSubmitting={pending}
              submitDisabled={
                pending ||
                !editName.trim() ||
                !editFundingWalletId ||
                !editLimit ||
                !new Decimal(editLimit || 0).gt(0) ||
                (card.installmentPlans.some(
                  (plan) => plan.status === "pending" || plan.status === "active",
                ) &&
                  editClosingDay !== String(card.statementClosingDay))
              }
            />
          </form>
        </SheetContent>
      </Sheet>

      {/* SHEET 6: Tóm tắt nhanh Sao kê kỳ này */}
      {card.statement && (
        <Sheet open={statementDetailOpen} onOpenChange={setStatementDetailOpen}>
          <SheetContent
            side={isDesktop ? "right" : "bottom"}
            placement={isDesktop ? "inset" : "edge"}
            size={isDesktop ? "wide" : "default"}
            spacing="flush"
            elevation="flat"
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <SheetHeader
                icon={ReceiptText}
                title={`Sao kê kỳ này (${formatShortDate(card.statement.cycleEndDate)})`}
                description={`Thẻ ${card.name} · Hạn thanh toán ${formatIsoDate(card.statement.dueDate)}`}
              />
              <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-5 overscroll-contain">
                <div className="space-y-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Số tiền cần thanh toán
                  </span>
                  <p className="text-2xl font-bold tabular-nums text-[var(--foreground)]">
                    {formatAmount(card.statement.remainingAmount ?? card.statement.amount)} {currency}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    Tiền chờ thanh toán thẻ theo ví nguồn
                  </h4>
                  {card.statement.sources.length > 0 ? (
                    <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                      {card.statement.sources.map((source, idx) => {
                        const wName = walletNames.get(source.walletId) ?? "Ví thanh toán";
                        return (
                          <div key={idx} className="flex items-start justify-between gap-2 p-3 text-xs">
                            <span className="break-words font-semibold leading-snug text-[var(--foreground)]">{wName}</span>
                            <span className="shrink-0 font-bold tabular-nums text-[var(--foreground)]">
                              {formatAmount(source.amount)} {currency}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">Chưa có phân bổ ví thanh toán.</p>
                  )}
                </div>
              </div>
              <SheetFooter
                className="border-t border-[var(--border)] p-4 md:px-5"
                onCancel={() => setStatementDetailOpen(false)}
                cancelLabel="Đóng"
                submitLabel="Thanh toán sao kê"
                submitType="button"
                submitDisabled={
                  pending ||
                  card.statement.paymentPending ||
                  !new Decimal(card.statement.amount || 0).gt(0)
                }
                onSubmit={() => {
                  setPaymentTargetMode("statement");
                  setStatementDetailOpen(false);
                  setPaymentConfirmOpen(true);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* SHEET 7: Chỉnh sửa giao dịch */}
      <Sheet
        open={Boolean(editingActivity)}
        onOpenChange={(open) => {
          if (!pending && !open) {
            setEditingActivity(null);
            setShowEditDetails(false);
          }
        }}
      >
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          placement="inset"
          elevation="flat"
          spacing="flush"
          aria-label="Chỉnh sửa giao dịch"
        >
          {editingActivity && (
            <form
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEdit();
              }}
            >
              <SheetHeader
                icon={Pencil}
                title="Chỉnh sửa giao dịch"
                description={editingActivity.description || "Cập nhật thông tin giao dịch"}
              />

              <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-5 overscroll-contain">
                <MoneyInput
                  label="Số tiền giao dịch"
                  autoFocus
                  value={editAmount}
                  onValueChange={setEditAmount}
                  placeholder="0"
                  aria-label="Số tiền giao dịch"
                  required
                />

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Select
                    label="Ví"
                    value={editWalletId}
                    onValueChange={setEditWalletId}
                    placeholder="Chọn ví"
                    options={(wallets ?? []).map((w) => ({
                      value: w.id,
                      label: w.name,
                    }))}
                    required
                  />

                  {(editingActivity?.type ?? "expense") === "expense" &&
                    categories &&
                    categories.length > 0 && (
                      <CategoryTreeSelect
                        label="Danh mục"
                        value={editCategoryId}
                        onValueChange={setEditCategoryId}
                        placeholder="Chọn danh mục"
                        categories={categories.map((c) => ({
                          id: c.id,
                          name: c.name,
                          icon: c.icon ?? undefined,
                          color: c.color ?? undefined,
                          parentId: c.parentId ?? undefined,
                        }))}
                        required
                      />
                    )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setShowEditDetails((prev) => !prev)}
                  aria-expanded={showEditDetails}
                >
                  <CalendarDays size={15} />
                  <span>
                    {showEditDetails ? "Ẩn thông tin bổ sung" : "Thêm nội dung hoặc đổi ngày"}
                  </span>
                </Button>

                {showEditDetails && (
                  <div className="space-y-3">
                    <DatePicker
                      label="Ngày giao dịch"
                      value={editDate}
                      onValueChange={setEditDate}
                      required
                    />
                    <Input
                      label="Nội dung"
                      placeholder="Ăn uống, mua sắm, hóa đơn..."
                      value={editActivityDescription}
                      onChange={(e) => setEditActivityDescription(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <SheetFooter
                className="border-t border-[var(--border)] p-4 md:px-5"
                onCancel={() => {
                  setEditingActivity(null);
                  setShowEditDetails(false);
                }}
                cancelLabel="Hủy"
                submitLabel="Lưu thay đổi"
                isSubmitting={pending}
                submitDisabled={
                  pending ||
                  !editWalletId ||
                  !editAmount ||
                  new Decimal(editAmount || 0).lte(0) ||
                  !editDate
                }
              />
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* ConfirmDelete: Xóa thẻ tín dụng */}
      {canManage && (
        <ConfirmDelete
          open={confirmDelete}
          onOpenChange={(nextOpen) => {
            setConfirmDelete(nextOpen);
            if (!nextOpen) setConfirmLossChecked(false);
          }}
          trigger={null}
          ariaLabel={`Xóa thẻ ${card.name}`}
          title={`Xóa thẻ “${card.name}”?`}
          description="Hành động này sẽ xóa vĩnh viễn thẻ tín dụng khỏi hệ thống và không thể hoàn tác."
          contentClassName="w-80 md:w-96"
          content={
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                  <span>Dữ liệu sẽ bị xóa vĩnh viễn:</span>
                </div>
                <ul className="list-disc space-y-1 pl-4 text-[11px] text-[var(--foreground)]">
                  <li>Toàn bộ {card.activities.length} giao dịch trên thẻ</li>
                  {card.installmentPlans.length > 0 && (
                    <li>{card.installmentPlans.length} kế hoạch trả góp liên quan</li>
                  )}
                  {card.statements && card.statements.length > 0 && (
                    <li>{card.statements.length} kỳ sao kê đã tạo</li>
                  )}
                </ul>
              </div>

              <label
                htmlFor={`confirm-loss-${card.id}`}
                className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 cursor-pointer select-none"
              >
                <Checkbox
                  id={`confirm-loss-${card.id}`}
                  checked={confirmLossChecked}
                  onCheckedChange={(checked) => setConfirmLossChecked(Boolean(checked))}
                  className="mt-0.5 shrink-0"
                />
                <span className="text-xs font-medium leading-snug text-[var(--foreground)]">
                  Tôi hiểu và xác nhận rằng sẽ mất tất cả dữ liệu liên quan đến thẻ tín dụng này.
                </span>
              </label>
            </div>
          }
          confirmLabel="Xóa thẻ"
          confirmDisabled={!confirmLossChecked}
          presentation={isDesktop ? "popover" : "sheet"}
          anchor={cardMenuTriggerRef}
          onConfirm={handleDeleteCard}
        />
      )}

      {/* ConfirmDelete: Xóa khoản trả góp */}
      {deletingPlan && (
        <ConfirmDelete
          open={Boolean(deletingPlan)}
          onOpenChange={(open) => !open && setDeletingPlan(null)}
          trigger={null}
          ariaLabel={`Hủy khoản trả góp ${deletingPlan.description || ""}`}
          title={
            deletingPlan.description && deletingPlan.description !== "Giao dịch trả góp"
              ? `Hủy trả góp “${deletingPlan.description}”?`
              : "Hủy khoản trả góp này?"
          }
          description={
            deletingPlan.origin === "imported"
              ? deletingPlan.importBalanceMode === "add_to_balance"
                ? `Dư nợ thẻ sẽ giảm ${formatAmount(deletingPlan.principal, { maximumFractionDigits: 0 })} ${currency}.`
                : `Khoản ${formatAmount(deletingPlan.principal, { maximumFractionDigits: 0 })} ${currency} sẽ quay lại dư nợ ban đầu của thẻ.`
              : "Giao dịch sẽ quay lại chi tiêu thẻ bình thường. Phí chuyển đổi (nếu có) sẽ được hoàn lại."
          }
          cancelLabel="Giữ lại"
          confirmLabel="Hủy trả góp"
          presentation={isDesktop ? "popover" : "sheet"}
          disabled={pending}
          onConfirm={async () => {
            const ok = await handleDeleteImportedPlan(deletingPlan);
            if (ok) setDeletingPlan(null);
          }}
        />
      )}

      {/* ConfirmDelete: Xóa giao dịch */}
      {deletingActivity && (
        <ConfirmDelete
          open={Boolean(deletingActivity)}
          onOpenChange={(open) => !open && setDeletingActivity(null)}
          trigger={null}
          ariaLabel={`Xóa giao dịch ${deletingActivity.description || "chi tiêu thẻ"}`}
          title={
            deletingActivity.purpose === "credit_card_payment"
              ? "Xóa giao dịch thanh toán thẻ?"
              : deletingActivity.purpose === "credit_card_refund"
                ? "Xóa khoản hoàn tiền này?"
                : "Xóa giao dịch chi tiêu này?"
          }
          description={
            deletingActivity.purpose === "credit_card_payment" && deletingActivity.status !== "approved"
              ? "Giao dịch sẽ bị xóa và phần tiền chờ thanh toán thẻ sẽ được giải phóng."
              : `Giao dịch ${formatAmount(deletingActivity.amount)} ${currency} sẽ bị xóa và dư nợ thẻ sẽ được cập nhật tương ứng.`
          }
          confirmLabel="Xóa giao dịch"
          presentation={isDesktop ? "popover" : "sheet"}
          disabled={pending}
          onConfirm={async () => {
            const res = await deleteTransactionAction(
              workspaceId,
              deletingActivity.id,
              "Xóa giao dịch nhầm trên thẻ tín dụng",
            );
            if (res.ok) {
              toast.success(
                `Đã xóa giao dịch${deletingActivity.description ? ` “${deletingActivity.description}”` : ""}.`,
              );
              setDeletingActivity(null);
            } else {
              toast.error(res.message ?? "Không thể xóa giao dịch.");
              return false;
            }
          }}
        />
      )}
    </div>
  );
}

export function CreditCardOverview(props: {
  workspaceId: string;
  currency: string;
  businessDate: string;
  cards: CreditCardOverviewItem[];
  initialCardId?: string | null;
  isDetailPage?: boolean;
  createCardAction?: React.ReactNode;
  canManage: boolean;
  canApprove: boolean;
  fundingWallets: FundingWallet[];
  wallets?: Array<{ id: string; name: string; kind: string }>;
  categories?: Array<{
    id: string;
    name: string;
    icon?: string | null;
    color?: string | null;
    parentId?: string | null;
  }>;
}) {
  usePrivacyMask();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(
    () => props.initialCardId ?? null,
  );
  const [prevInitialCardId, setPrevInitialCardId] = useState(() => props.initialCardId);
  const [autoOpenPaymentCardId, setAutoOpenPaymentCardId] = useState<string | null>(null);

  if (props.initialCardId !== prevInitialCardId) {
    setPrevInitialCardId(props.initialCardId);
    setSelectedCardId(props.initialCardId ?? null);
  }

  useEffect(() => {
    const onPopState = () => {
      const match = window.location.pathname.match(/\/credit-cards\/([^/]+)/);
      setSelectedCardId(match ? match[1] : null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleSelectCard = (id: string, openPayment = false) => {
    setSelectedCardId(id);
    if (openPayment) {
      setAutoOpenPaymentCardId(id);
    }
    window.history.pushState(null, "", `/credit-cards/${id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackToList = () => {
    setSelectedCardId(null);
    setAutoOpenPaymentCardId(null);
    window.history.pushState(null, "", "/credit-cards");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const activeCard = useMemo(() => {
    if (!selectedCardId) return null;
    return props.cards.find((c) => c.id === selectedCardId) ?? null;
  }, [props.cards, selectedCardId]);

  const totalDebt = useMemo(() => {
    return props.cards.reduce(
      (sum, c) => sum.plus(new Decimal(c.debt || 0)),
      new Decimal(0),
    );
  }, [props.cards]);

  const totalPrepared = useMemo(() => {
    return props.cards.reduce((sum, c) => {
      const cardReserved = c.fundingShares.reduce(
        (s, share) => s.plus(new Decimal(share.outstanding || 0)),
        new Decimal(c.pendingPayment || 0),
      );
      return sum.plus(cardReserved);
    }, new Decimal(0));
  }, [props.cards]);

  const totalAdditionalNeeded = useMemo(() => {
    return Decimal.max(totalDebt.minus(totalPrepared), 0);
  }, [totalDebt, totalPrepared]);

  const overdueCount = useMemo(() => {
    return props.cards.filter((c) => c.statement?.overdue).length;
  }, [props.cards]);

  const dueStatementCount = useMemo(() => {
    return props.cards.filter((c) => c.statement && c.statement.status !== "paid").length;
  }, [props.cards]);

  return (
    <section className="space-y-3.5 md:space-y-4" aria-label="Quản lý thẻ tín dụng">
      {/* Overview Header when empty list */}
      {!activeCard && !props.isDetailPage && props.cards.length === 0 && (
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-xl font-semibold leading-snug text-[var(--foreground)]">
              Thẻ tín dụng
            </h1>
            <p className="mt-1 hidden text-sm text-[var(--text-secondary)] md:block">
              Theo dõi dư nợ, hạn mức còn lại và tiền chờ thanh toán thẻ đúng hạn.
            </p>
          </div>
          {props.createCardAction && (
            <div className="shrink-0">{props.createCardAction}</div>
          )}
        </header>
      )}

      {!activeCard ? (
        <>
          {/* Unified Header + Top Summary Strip when cards exist */}
          {props.cards.length > 0 && (
            <Card
              as="section"
              className="p-3.5 md:p-5"
              aria-label="Tổng quan dư nợ thẻ tín dụng"
            >
              {/* Top Bar: Mobile shows Primary Debt + Create Button; Desktop shows Title/Subtitle + Create Button */}
              <div className="flex items-start justify-between gap-3 md:items-center md:border-b md:border-[var(--border)] md:pb-4">
                <div className="min-w-0">
                  <h1 className="break-words text-xs font-medium text-[var(--text-secondary)] md:text-lg md:font-semibold md:text-[var(--foreground)]">
                    <span className="md:hidden">Tổng dư nợ thẻ ({props.cards.length} thẻ)</span>
                    <span className="hidden md:inline">Thẻ tín dụng</span>
                  </h1>
                  <p className="mt-0.5 hidden text-xs text-[var(--text-secondary)] md:block">
                    Theo dõi dư nợ, hạn mức còn lại và tiền chờ thanh toán thẻ đúng hạn.
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-xl font-bold tabular-nums tracking-tight md:hidden",
                      totalDebt.gt(0) ? "text-[var(--destructive)]" : "text-[var(--foreground)]",
                    )}
                  >
                    {formatAmount(totalDebt.toString())}{" "}
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">
                      {props.currency}
                    </span>
                  </p>
                </div>
                {!props.isDetailPage && props.createCardAction && (
                  <div className="shrink-0">{props.createCardAction}</div>
                )}
              </div>

              {/* Mobile 2-Col Secondary Strip (<768px) & Desktop 3-Col Summary Strip (md:grid) */}
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-2.5 md:mt-4 md:grid-cols-3 md:gap-0 md:divide-x md:divide-[var(--border)] md:border-t-0 md:pt-0">
                <div className="hidden md:flex md:flex-col md:items-start md:justify-center md:pr-5">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Tổng dư nợ thẻ
                  </span>
                  <p
                    className={cn(
                      "mt-1 text-2xl font-bold tabular-nums tracking-tight",
                      totalDebt.gt(0) ? "text-[var(--destructive)]" : "text-[var(--foreground)]",
                    )}
                  >
                    {formatAmount(totalDebt.toString())}{" "}
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">
                      {props.currency}
                    </span>
                  </p>
                  <span className="mt-1 text-[11px] text-[var(--text-muted)]">
                    Trên tổng số {props.cards.length} thẻ tín dụng
                  </span>
                </div>

                <div className="min-w-0 md:flex md:flex-col md:items-start md:justify-center md:px-5">
                  <span className="block text-[11px] font-medium text-[var(--text-muted)] md:text-xs md:text-[var(--text-secondary)]">
                    Tiền đã chuẩn bị trả thẻ
                  </span>
                  <p className="mt-0.5 text-sm font-bold tabular-nums tracking-tight text-[var(--primary)] md:mt-1 md:text-2xl">
                    {formatAmount(totalPrepared.toString())}{" "}
                    <span className="text-[11px] font-semibold text-[var(--text-secondary)] md:text-xs">
                      {props.currency}
                    </span>
                  </p>
                  <span className="mt-1 hidden text-[11px] text-[var(--text-muted)] md:block">
                    Tiền chờ thanh toán thẻ trên các ví nguồn
                  </span>
                </div>

                <div className="min-w-0 border-l border-[var(--border)] pl-3 md:flex md:flex-col md:items-start md:justify-center md:border-l-0 md:pl-5">
                  <span className="block text-[11px] font-medium text-[var(--text-muted)] md:text-xs md:text-[var(--text-secondary)]">
                    Cần thanh toán thêm
                  </span>
                  <p
                    className={cn(
                      "mt-0.5 text-sm font-bold tabular-nums tracking-tight md:mt-1 md:text-2xl",
                      totalAdditionalNeeded.gt(0)
                        ? "text-[var(--warning)]"
                        : "text-[var(--success)]",
                    )}
                  >
                    {formatAmount(totalAdditionalNeeded.toString())}{" "}
                    <span className="text-[11px] font-semibold text-[var(--text-secondary)] md:text-xs">
                      {props.currency}
                    </span>
                  </p>
                  <span className="mt-1 hidden text-[11px] text-[var(--text-muted)] md:block">
                    {overdueCount > 0
                      ? `${overdueCount} thẻ có sao kê quá hạn`
                      : dueStatementCount > 0
                        ? `${dueStatementCount} kỳ sao kê chờ thanh toán`
                        : "Đã chuẩn bị đủ nguồn thanh toán"}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Credit Cards Grid (grid-cols-1 md:grid-cols-2 gap-4) */}
          {props.cards.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {props.cards.map((card) => (
                <CreditCardVirtualCard
                  key={card.id}
                  card={card}
                  currency={props.currency}
                  isInteractive
                  onClick={() => handleSelectCard(card.id, false)}
                  onPayClick={() => handleSelectCard(card.id, true)}
                />
              ))}
            </div>
          ) : (
            <Card as="div" className="gap-2 p-6 text-center md:p-8">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-muted)]">
                <CreditCard size={24} aria-hidden="true" />
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--foreground)] md:text-base">
                Chưa có thẻ tín dụng nào
              </p>
              <p className="mx-auto max-w-sm text-xs text-[var(--text-secondary)] md:text-sm">
                Thêm thẻ tín dụng để theo dõi hạn mức chi tiêu, sao kê kỳ này và quản lý các khoản trả góp.
              </p>
            </Card>
          )}
        </>
      ) : (
        <CreditCardPanel
          key={activeCard.id}
          {...props}
          card={activeCard}
          allCards={props.cards}
          autoOpenPayment={autoOpenPaymentCardId === activeCard.id}
          onAutoPaymentHandled={() => setAutoOpenPaymentCardId(null)}
          onSelectCard={(id) => handleSelectCard(id, false)}
          onBack={handleBackToList}
        />
      )}
    </section>
  );
}
