"use client";

import Decimal from "decimal.js";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  History,
  Info,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Split,
  Trash2,
  Wallet,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import type { DeleteCreditCardResolution } from "@/domain/credit-card/schemas";

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
  CategoryTreeSelect,
  Checkbox,
  ConfirmDelete,
  DatePicker,
  Input,
  MoneyInput,
  Select,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
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
import { firstStatementOnOrAfter, nextStatementDate } from "@/domain/credit-card/installments";

function subscribeDesktop(callback: () => void) {
  const query = window.matchMedia("(min-width: 901px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function desktopSnapshot() {
  return window.matchMedia("(min-width: 901px)").matches;
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
        <span className="size-3.5 rounded-full bg-[#F79E1B] opacity-90 mix-blend-screen" />
      </div>
    );
  }

  if (brand === "JCB") {
    return (
      <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-blue-500 select-none">
        JCB
      </span>
    );
  }

  if (brand === "AMEX") {
    return (
      <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-sky-500 select-none">
        AMEX
      </span>
    );
  }

  if (brand === "NAPAS") {
    return (
      <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-sky-600 dark:text-sky-400 select-none">
        NAPAS
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)]/60 bg-[var(--surface)]/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] select-none">
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
          <span className="size-3.5 rounded-full bg-[#F79E1B] opacity-95 mix-blend-screen" />
        </div>
      </div>
    );
  }

  if (brand === "JCB") {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] select-none">
        <span className="text-[10px] font-bold tracking-tight text-blue-500">
          JCB
        </span>
      </div>
    );
  }

  if (brand === "AMEX") {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] select-none">
        <span className="text-[9px] font-extrabold tracking-tight text-sky-500">
          AMEX
        </span>
      </div>
    );
  }

  if (brand === "NAPAS") {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] select-none">
        <span className="text-[9px] font-bold tracking-tight text-sky-600 dark:text-sky-400">
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
  isInteractive = false,
  className,
}: {
  card: CreditCardOverviewItem;
  currency: string;
  onClick?: () => void;
  isInteractive?: boolean;
  className?: string;
}) {
  const brand = detectCardBrand(card.name);
  const debtDecimal = new Decimal(card.debt || 0);
  const creditBalanceDecimal = new Decimal(card.creditBalance || 0);
  const hasCredit = creditBalanceDecimal.gt(0);
  const hasDebt = debtDecimal.gt(0);
  const limitDecimal = new Decimal(card.limit || 0);
  const utilizationPercent = limitDecimal.gt(0)
    ? Math.min(100, Math.max(0, debtDecimal.div(limitDecimal).mul(100).toNumber()))
    : 0;

  const cardTailDigits = useMemo(() => {
    const alphanumeric = card.id.replace(/[^0-9a-zA-Z]/g, "");
    return alphanumeric.slice(-4).toUpperCase() || "8824";
  }, [card.id]);

  return (
    <div
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? onClick : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "relative isolate flex flex-col justify-between gap-3 overflow-hidden rounded-xl sm:rounded-2xl p-3.5 sm:p-4 text-[var(--foreground)] select-none outline-none w-full min-h-[155px] sm:min-h-[165px] border border-[var(--border)] bg-gradient-to-br from-[var(--surface-secondary)] via-[var(--surface)] to-[var(--surface-secondary)]",
        isInteractive &&
          "cursor-pointer transition-all duration-200 hover:border-[var(--primary)] hover:scale-[1.01] active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40",
        className,
      )}
      aria-label={`Thẻ ${card.name}, ${hasCredit ? `Dư có ${formatAmount(card.creditBalance)}` : `Dư nợ ${formatAmount(card.debt)}`} ${currency}`}
    >
      {/* Top row: Chip EMV & Contactless waves (left) + Brand Emblem / Cycle (right) */}
      <div className="relative z-[1] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Micro Chip EMV */}
          <div className="flex h-4.5 w-6.5 items-center justify-center rounded-[3px] border border-[var(--border)] bg-[var(--surface-secondary)]">
            <div className="grid h-2.5 w-4 grid-cols-2 grid-rows-2 gap-[1px] opacity-60">
              <span className="rounded-tl-[1px] border-b border-r border-[var(--border)]" />
              <span className="rounded-tr-[1px] border-b border-l border-[var(--border)]" />
              <span className="rounded-bl-[1px] border-t border-r border-[var(--border)]" />
              <span className="rounded-br-[1px] border-t border-l border-[var(--border)]" />
            </div>
          </div>

          {/* Contactless waves */}
          <svg
            className="size-3 text-[var(--text-muted)] opacity-60"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M8.5 16.5a5 5 0 0 1 0-9" />
            <path d="M12 19a8.5 8.5 0 0 0 0-14" />
          </svg>
        </div>

        <div className="flex items-center gap-1.5">
          {card.statement?.overdue ? (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold bg-[color-mix(in_srgb,var(--destructive)_15%,transparent)] text-[var(--destructive)]">
              Quá hạn
            </span>
          ) : card.statement ? (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold bg-[color-mix(in_srgb,var(--warning)_15%,transparent)] text-[var(--warning)]">
              Đến hạn {formatShortDate(card.statement.dueDate)}
            </span>
          ) : (
            <span className="text-[10px] sm:text-[11px] text-[var(--text-muted)] font-medium">
              Chốt {card.statementClosingDay} · Hạn {card.paymentDueDay}
            </span>
          )}

          <CardBrandBadge brand={brand} />
        </div>
      </div>

      {/* Middle row: Card Name + Clean Masked Number */}
      <div className="relative z-[1] my-auto py-0.5">
        <p
          className="truncate text-sm sm:text-base font-bold tracking-tight text-[var(--foreground)]"
          title={card.name}
        >
          {card.name}
        </p>
        <p className="mt-0.5 font-mono text-[11px] sm:text-xs tracking-widest text-[var(--text-muted)]">
          •••• •••• •••• <span className="font-semibold text-[var(--text-secondary)]">{cardTailDigits}</span>
        </p>
      </div>

      {/* Bottom row: 2 Clean Balanced Columns (Dư nợ & Khả dụng) + Sleek Progress line */}
      <div className="relative z-[1] border-t border-[var(--border)]/70 pt-2">
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <span className="block text-[8px] sm:text-[9px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              {hasCredit ? "Dư có" : "Dư nợ"}
            </span>
            <span
              className={cn(
                "block truncate text-xs sm:text-sm font-bold tabular-nums tracking-tight",
                hasCredit
                  ? "text-[var(--success)]"
                  : hasDebt
                    ? "text-[var(--destructive)]"
                    : "text-[var(--foreground)]",
              )}
            >
              {formatAmount(hasCredit ? card.creditBalance : card.debt)}{" "}
              <span className="text-[9px] sm:text-[10px] font-normal uppercase text-[var(--text-muted)]">
                {currency}
              </span>
            </span>
          </div>

          <div className="text-right shrink-0">
            <span className="block text-[8px] sm:text-[9px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Khả dụng
            </span>
            <span className="block text-[11px] sm:text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
              {formatAmount(card.availableCredit, { maximumFractionDigits: 0 })}{" "}
              <span className="text-[9px] sm:text-[10px] font-normal uppercase text-[var(--text-muted)]">
                {currency}
              </span>
            </span>
          </div>
        </div>

        {/* Mini utilization bar */}
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)]">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              utilizationPercent > 80
                ? "bg-[var(--destructive)]"
                : utilizationPercent > 50
                  ? "bg-[var(--warning)]"
                  : "bg-[var(--primary)]",
            )}
            style={{ width: `${utilizationPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function CreditCardPanel({
  workspaceId,
  currency,
  businessDate,
  card,
  canManage,
  canApprove,
  fundingWallets,
  wallets,
  categories,
}: {
  workspaceId: string;
  currency: string;
  businessDate: string;
  card: CreditCardOverviewItem;
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
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    desktopSnapshot,
    serverDesktopSnapshot,
  );
  const [pending, startTransition] = useTransition();
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
  const [menuActivityId, setMenuActivityId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLossChecked, setConfirmLossChecked] = useState(false);

  const [paymentConfirmOpen, setPaymentConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(card.name);
  const [editDescription, setEditDescription] = useState(card.description ?? "");
  const [editLimit, setEditLimit] = useState(card.limit);
  const [editFundingWalletId, setEditFundingWalletId] = useState(card.defaultFundingWalletId);
  const [editClosingDay, setEditClosingDay] = useState(String(card.statementClosingDay));
  const [editDueDay, setEditDueDay] = useState(String(card.paymentDueDay));
  const [allPlansOpen, setAllPlansOpen] = useState(false);
  const [allActivitiesOpen, setAllActivitiesOpen] = useState(false);
  const [menuPlanId, setMenuPlanId] = useState<string | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<InstallmentPlan | null>(null);
  const [deletingActivity, setDeletingActivity] = useState<CardActivity | null>(null);
  const [editingActivity, setEditingActivity] = useState<CardActivity | null>(null);
  const [editWalletId, setEditWalletId] = useState<string>("");
  const [editAmount, setEditAmount] = useState<string>("");
  const [editDate, setEditDate] = useState<string>("");
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [editActivityDescription, setEditActivityDescription] = useState<string>("");
  const [showEditDetails, setShowEditDetails] = useState(false);
  const cardMenuTriggerRef = useRef<HTMLButtonElement>(null);

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
    startTransition(async () => {
      const res = await updateTransactionAction(
        workspaceId,
        editingActivity.id,
        {
          walletId: editWalletId,
          amount: new Decimal(editAmount),
          date: editDate,
          type: "expense",
          categoryId: editCategoryId || undefined,
          description: editActivityDescription.trim() || undefined,
          allocations: isCreditCard
            ? [
              {
                walletId:
                  card.defaultFundingWalletId ??
                  fundingWallets[0]?.id ??
                  wallets?.find((w) => w.kind === "asset")?.id ??
                  "",
                amount: new Decimal(editAmount),
              },
            ]
            : undefined,
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

  const walletNames = useMemo(
    () => new Map(card.fundingShares.map((share) => [share.walletId, share.walletName])),
    [card.fundingShares],
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
  const cardTailDigits = useMemo(() => {
    const alphanumeric = card.id.replace(/[^0-9a-zA-Z]/g, "");
    return alphanumeric.slice(-4).toUpperCase() || "8824";
  }, [card.id]);
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
    if (!Number.isInteger(totalTerms) || !Number.isInteger(paidTerms) || totalTerms < 2 || totalTerms > 60 || paidTerms < 0 || paidTerms >= totalTerms) {
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
  const selectedImportableOpeningDebt = importableOpeningDebtByWallet.get(importFundingWalletId) ?? new Decimal(0);
  const exceedsImportableOpeningDebt = importBalanceMode === "included_opening_debt"
    && Boolean(importPreview)
    && new Decimal(importRemainingAmount || 0).gt(selectedImportableOpeningDebt);

  const installmentCalc = useMemo(() => {
    if (!installmentTarget) return null;
    const targetAmount = new Decimal(installmentTarget.amount || 0);
    const feeDecimal =
      feeAmount.trim() !== "" && !isNaN(Number(feeAmount)) && Number(feeAmount) > 0
        ? new Decimal(feeAmount)
        : new Decimal(0);
    const total = targetAmount.plus(feeDecimal);
    const count = Number(termCount) || 1;
    // Phí chuyển đổi tính toàn bộ vào kỳ đầu tiên; tiền gốc chia đều các kỳ
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

  // Credit limit utilization percentage (0 - 100%)
  const utilizationPercent = useMemo(() => {
    if (!limitDecimal.gt(0) || !debtDecimal.gt(0)) return 0;
    const pct = debtDecimal.div(limitDecimal).mul(100).toNumber();
    return Math.min(100, Math.max(0, Math.round(pct)));
  }, [limitDecimal, debtDecimal]);

  function payStatement() {
    if (!card.statement) return;
    startTransition(async () => {
      const result = await payCreditCardAction(workspaceId, {
        cardWalletId: card.id,
        statementId: card.statement!.id,
        date: businessDate,
        sources: card.statement!.sources,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Không thể thanh toán sao kê.");
        return;
      }
      toast.success(
        result.status === "approved"
          ? "Đã thanh toán sao kê."
          : "Đã tạo thanh toán chờ xử lý.",
      );
      setPaymentConfirmOpen(false);
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
      toast.success("Đã đăng ký trả góp.");
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
            ? "Đã ghi nhận hoàn tiền giao dịch."
            : "Đã ghi nhận hoàn tiền vào thẻ."
          : "Đã tạo khoản hoàn tiền chờ duyệt.",
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
      toast.success("Đã cập nhật thẻ tín dụng.");
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
    return true;
  }

  function renderInstallmentCard(plan: InstallmentPlan) {
    const paid = plan.paidTermCount + plan.installments.filter((item) => item.paid).length;
    const next = plan.installments.find((item) => !item.paid);
    const hasFee = new Decimal(plan.fee || 0).gt(0);
    const progressPct =
      plan.termCount > 0 ? Math.round((paid / plan.termCount) * 100) : 0;
    const remainingTerms = Math.max(0, plan.termCount - paid);

    const isMenuOpen = menuPlanId === plan.id;

    const cardContent = (
      <>
        {/* Hàng 1: Tên khoản trả góp + Tag/Phí + Tổng giá trị */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <h4
              className="font-semibold text-sm text-[var(--foreground)] truncate"
              title={plan.description || "Giao dịch trả góp"}
            >
              {plan.description || "Giao dịch trả góp"}
            </h4>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-[var(--surface-secondary)] text-[var(--text-secondary)] shrink-0 border border-[var(--border)]/60">
                {plan.origin === "imported" ? "Khoản có sẵn" : `${plan.termCount} tháng`}
              </span>
              {hasFee && (
                <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                  · Phí {formatAmount(plan.fee, { maximumFractionDigits: 0 })} {currency}
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <span className="text-sm font-bold tabular-nums text-[var(--foreground)] block">
              {formatAmount(plan.principal, { maximumFractionDigits: 0 })} {currency}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] font-normal">Tổng giá trị</span>
          </div>
        </div>

        {/* Hàng 2: Tiến độ trả góp */}
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-secondary)]">
              Đã trả:{" "}
              <strong className="font-semibold text-[var(--foreground)]">
                {paid}/{plan.termCount} kỳ
              </strong>{" "}
              <span className="text-[11px] text-[var(--text-muted)]">({progressPct}%)</span>
            </span>
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              {remainingTerms > 0 ? `Còn ${remainingTerms} kỳ` : "Đã hoàn thành"}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)] border border-[var(--border)]/40">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                paid === plan.termCount ? "bg-[var(--success)]" : "bg-[var(--primary)]",
              )}
              style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
            />
          </div>
        </div>

        {/* Hàng 3: Kỳ tới / Đã tất toán */}
        <div className="pt-0.5">
          {next ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-secondary)]/50 px-3 py-2 text-xs border border-[var(--border)]/40">
              <div className="flex items-center gap-1.5 min-w-0 text-[var(--text-secondary)]">
                <CalendarClock className="size-3.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                <span className="truncate">Kỳ tới ({formatShortDate(next.dueDate)})</span>
              </div>
              <span className="shrink-0 font-semibold tabular-nums text-[var(--foreground)]">
                {formatAmount(next.amount, { maximumFractionDigits: 0 })} {currency}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-xl bg-[color-mix(in_srgb,var(--success)_10%,transparent)] px-3 py-2 text-xs text-[var(--success)] border border-[var(--success)]/20">
              <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="font-medium">Đã tất toán toàn bộ kỳ trả góp</span>
            </div>
          )}
        </div>
      </>
    );

    if (canManage && plan.canDelete) {
      return (
        <DropdownMenu
          key={plan.id}
          open={isMenuOpen}
          onOpenChange={(open) => setMenuPlanId(open ? plan.id : null)}
        >
          <SpotlightTrigger
            open={isMenuOpen}
            onOpenChange={(open) => setMenuPlanId(open ? plan.id : null)}
            render={
              <div
                role="button"
                tabIndex={0}
                className={cn(
                  "rounded-2xl border border-[var(--border)] p-3.5 space-y-2.5 cursor-pointer select-none outline-none transition-all",
                  isMenuOpen
                    ? "bg-[var(--surface)]"
                    : "bg-[var(--surface-secondary)]/25 hover:bg-[var(--surface-secondary)]/45 active:bg-[var(--surface-secondary)]/60 focus-visible:ring-1 focus-visible:ring-ring",
                )}
                aria-label={`Khoản trả góp ${plan.description || "Giao dịch trả góp"}, ${formatAmount(plan.principal)} ${currency}. Bấm để mở menu context.`}
              />
            }
            dismissLabel={`Đóng menu tùy chọn ${plan.description || "khoản trả góp"}`}
          >
            {(spotlightTrigger) => (
              <DropdownMenuTrigger nativeButton={false} render={spotlightTrigger}>
                {cardContent}
              </DropdownMenuTrigger>
            )}
          </SpotlightTrigger>
          <DropdownMenuContent
            align="end"
            side="bottom"
            sideOffset={6}
            className="w-52 !rounded-xl p-1.5 border border-[var(--border)] bg-[var(--surface)] shadow-none"
          >
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                setMenuPlanId(null);
                setDeletingPlan(plan);
              }}
              className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium !rounded-lg cursor-pointer text-[var(--destructive)]"
            >
              <Trash2 className="size-4 shrink-0" aria-hidden="true" />
              <span>Hủy trả góp</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <div
        key={plan.id}
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/25 p-3.5 space-y-2.5"
      >
        {cardContent}
      </div>
    );
  }

  function renderActivityRow(activity: CardActivity) {
    const rowContent = (
      <>
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`grid size-8 shrink-0 place-items-center rounded-lg ${activity.purpose === "credit_card_refund"
                ? "bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] text-[var(--success)]"
                : activity.purpose === "credit_card_payment"
                  ? "bg-[color-mix(in_srgb,var(--info)_12%,var(--surface))] text-[var(--info)]"
                  : "bg-[var(--surface-secondary)] text-[var(--text-secondary)]"
              }`}
          >
            {activity.purpose === "credit_card_refund" ? (
              <RotateCcw size={14} />
            ) : activity.purpose === "credit_card_payment" ? (
              <CheckCircle2 size={14} />
            ) : (
              <CreditCard size={14} />
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-[var(--foreground)]">
              {activity.description || activityLabel(activity)}
            </p>
            <p className="truncate text-[11px] text-[var(--text-muted)]">
              {activity.description && activity.description !== activityLabel(activity)
                ? `${formatIsoDate(activity.date)} · ${activityLabel(activity)}`
                : formatIsoDate(activity.date)}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0">
          <span
            className={`text-xs font-semibold tabular-nums ${activity.purpose === "credit_card_refund"
                ? "text-[var(--success)]"
                : "text-[var(--foreground)]"
              }`}
          >
            {activity.purpose === "credit_card_refund" ||
              activity.purpose === "credit_card_payment"
              ? "−"
              : "+"}
            {formatAmount(activity.amount, { maximumFractionDigits: 0 })} {currency}
          </span>
          {activity.installmentPlanId && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--primary)]">
              <Split size={9} aria-hidden="true" />
              <span>Đang trả góp</span>
            </span>
          )}
        </div>
      </>
    );

    const isMenuOpen = menuActivityId === activity.id;
    const canDeleteActivity = canManage && Boolean(activity.canDelete);
    const canEditActivity = canManage && Boolean(activity.canEdit);
    const refundCandidate = card.refundCandidates.find((c) => c.id === activity.id);
    const canRefundActivity = canManage && Boolean(refundCandidate && new Decimal(refundCandidate.refundableAmount).gt(0));
    const hasActivityMenu = activity.installmentEligible || canEditActivity || canRefundActivity || canDeleteActivity;

    if (hasActivityMenu) {
      return (
        <DropdownMenu
          key={activity.id}
          open={isMenuOpen}
          onOpenChange={(open) => setMenuActivityId(open ? activity.id : null)}
        >
          <SpotlightTrigger
            open={isMenuOpen}
            onOpenChange={(open) => setMenuActivityId(open ? activity.id : null)}
            render={
              <div
                role="button"
                tabIndex={0}
                className={cn(
                  "group/activity flex items-center justify-between gap-3 py-2.5 px-2 -mx-2 rounded-xl cursor-pointer select-none outline-none transition-all border",
                  isMenuOpen
                    ? "bg-[var(--surface)] border-[var(--border)]"
                    : "border-transparent hover:bg-[var(--surface-secondary)]/50 active:bg-[var(--surface-secondary)]/70 focus-visible:ring-1 focus-visible:ring-ring",
                )}
                aria-label={`Giao dịch ${activity.description || activityLabel(activity)}, ${formatAmount(activity.amount)} ${currency}. Bấm để mở tùy chọn.`}
              />
            }
            dismissLabel={`Đóng menu giao dịch ${activity.description || activityLabel(activity)}`}
          >
            {(spotlightTrigger) => (
              <DropdownMenuTrigger nativeButton={false} render={spotlightTrigger}>
                {rowContent}
              </DropdownMenuTrigger>
            )}
          </SpotlightTrigger>
          <DropdownMenuContent
            align="end"
            side="bottom"
            sideOffset={6}
            className="w-52 !rounded-xl p-1.5 border border-[var(--border)] bg-[var(--surface)] shadow-none"
          >
            {activity.installmentEligible && (
              <DropdownMenuItem
                onClick={() => {
                  setMenuActivityId(null);
                  setInstallmentTarget(activity);
                }}
                className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium !rounded-lg cursor-pointer text-[var(--foreground)]"
              >
                <Split className="size-4 text-[var(--primary)]" aria-hidden="true" />
                <span>Đăng ký trả góp</span>
              </DropdownMenuItem>
            )}
            {canEditActivity && (
              <>
                {activity.installmentEligible && (
                  <DropdownMenuSeparator className="-mx-1 my-1 h-px bg-[var(--border)]" />
                )}
                <DropdownMenuItem
                  onClick={() => {
                    setMenuActivityId(null);
                    startEditingActivity(activity);
                  }}
                  className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium !rounded-lg cursor-pointer text-[var(--foreground)]"
                >
                  <Pencil className="size-4 text-[var(--primary)]" aria-hidden="true" />
                  <span>Chỉnh sửa giao dịch</span>
                </DropdownMenuItem>
              </>
            )}
            {canRefundActivity && (
              <>
                {(activity.installmentEligible || canEditActivity) && (
                  <DropdownMenuSeparator className="-mx-1 my-1 h-px bg-[var(--border)]" />
                )}
                <DropdownMenuItem
                  onClick={() => {
                    setMenuActivityId(null);
                    setRefundTransactionId(activity.id);
                    setRefundDescription(`Hoàn tiền cho ${activity.description || "giao dịch"}`);
                    setRefundAmount(refundCandidate?.refundableAmount ?? "");
                    setRefundOpen(true);
                  }}
                  className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium !rounded-lg cursor-pointer text-[var(--foreground)]"
                >
                  <RotateCcw className="size-4 text-[var(--primary)]" aria-hidden="true" />
                  <span>Hoàn tiền giao dịch</span>
                </DropdownMenuItem>
              </>
            )}
            {canDeleteActivity && (
              <>
                {(activity.installmentEligible || canEditActivity || canRefundActivity) && (
                  <DropdownMenuSeparator className="-mx-1 my-1 h-px bg-[var(--border)]" />
                )}
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    setMenuActivityId(null);
                    setDeletingActivity(activity);
                  }}
                  className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium !rounded-lg cursor-pointer text-[var(--destructive)]"
                >
                  <Trash2 className="size-4 shrink-0" aria-hidden="true" />
                  <span>Xóa giao dịch</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <div
        key={activity.id}
        className="flex items-center justify-between gap-3 py-2.5 px-2 -mx-2 rounded-xl border border-transparent"
      >
        {rowContent}
      </div>
    );
  }

  return (
    <>
      <div id={`credit-card-details-${card.id}`} className="space-y-5 sm:space-y-6">
          {/* Active Card Header: Tên thẻ + Số đuôi + Thương hiệu + Chu kỳ & Menu */}
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-bold text-[var(--foreground)] tracking-tight truncate">
                  {card.name}
                </h2>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-[var(--text-muted)] tracking-wider">
                    •••• {cardTailDigits}
                  </span>
                  <CardBrandBadge brand={brand} />
                </div>
                {card.statement?.overdue ? (
                  <span className="inline-flex items-center rounded-md bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)] px-2 py-0.5 text-xs font-semibold text-[var(--destructive)] shrink-0 border border-[var(--destructive)]/20">
                    Quá hạn
                  </span>
                ) : card.statement ? (
                  <span className="inline-flex items-center rounded-md bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] px-2 py-0.5 text-xs font-semibold text-[var(--warning)] shrink-0 border border-[var(--warning)]/20">
                    Đến hạn {formatShortDate(card.statement.dueDate)}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Chốt ngày {card.statementClosingDay} · Hạn thanh toán ngày {card.paymentDueDay} hàng tháng
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        ref={cardMenuTriggerRef}
                        type="button"
                        aria-label={`Tùy chọn thẻ ${card.name}`}
                        className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)]/50 px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer outline-none"
                      />
                    }
                  >
                    <MoreHorizontal size={15} aria-hidden="true" />
                    <span className="hidden sm:inline">Tùy chọn</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    side="bottom"
                    sideOffset={6}
                    className="w-52 !rounded-xl p-1.5 border border-[var(--border)] bg-[var(--surface)] shadow-none"
                  >
                    <DropdownMenuItem
                      onClick={() => setEditOpen(true)}
                      className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium !rounded-lg cursor-pointer text-[var(--foreground)]"
                    >
                      <Pencil className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                      <span>Chỉnh sửa thẻ</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={openImportInstallment}
                      onClick={openImportInstallment}
                      className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium !rounded-lg cursor-pointer text-[var(--foreground)]"
                    >
                      <History className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                      <span>Nhập trả góp có sẵn</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setRefundTransactionId("");
                        setRefundDescription("");
                        setRefundAmount("");
                        setRefundOpen(true);
                      }}
                      className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium !rounded-lg cursor-pointer text-[var(--foreground)]"
                    >
                      <RotateCcw className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                      <span>Ghi nhận hoàn tiền</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1 -mx-1 bg-[var(--border)]" />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        setConfirmLossChecked(false);
                        setConfirmDelete(true);
                      }}
                      className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium !rounded-lg cursor-pointer"
                    >
                      <Trash2 className="size-4 shrink-0" aria-hidden="true" />
                      <span>Xóa thẻ</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* 2-Column Responsive Layout: stacked on mobile, 12-col grid on desktop */}
          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
            {/* CỘT TRÁI (Col 5): Hero Dashboard Tài chính (Dư nợ, Hạn mức, Khả dụng) */}
            <div className="flex flex-col gap-3.5 lg:col-span-5">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 p-4 sm:p-5 space-y-4">
                {/* Hero Balance */}
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    {hasCredit ? "Dư có hiện tại" : "Dư nợ hiện tại"}
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span
                      className={cn(
                        "text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums",
                        hasCredit
                          ? "text-[var(--success)]"
                          : hasDebt
                            ? "text-[var(--destructive)]"
                            : "text-[var(--foreground)]",
                      )}
                    >
                      {formatAmount(hasCredit ? card.creditBalance : card.debt)}
                    </span>
                    <span className="text-xs sm:text-sm font-semibold uppercase text-[var(--text-muted)]">
                      {currency}
                    </span>
                  </div>
                </div>

                {/* Progress bar sử dụng hạn mức */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--text-secondary)]">
                      Đã dùng <span className="font-bold text-[var(--foreground)]">{utilizationPercent}%</span> hạn mức
                    </span>
                    <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
                      Khả dụng: <span className="font-semibold text-[var(--foreground)]">{formatAmount(card.availableCredit)} {currency}</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)] border border-[var(--border)]/40">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        utilizationPercent > 80
                          ? "bg-[var(--destructive)]"
                          : utilizationPercent > 50
                            ? "bg-[var(--warning)]"
                            : "bg-[var(--primary)]",
                      )}
                      style={{ width: `${utilizationPercent}%` }}
                    />
                  </div>
                </div>

                {/* 3 chỉ số tài chính cơ sở */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[var(--border)]/60 text-xs">
                  <div>
                    <span className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Hạn mức</span>
                    <span className="block text-xs sm:text-sm font-semibold tabular-nums text-[var(--foreground)] truncate mt-0.5" title={formatAmount(card.limit)}>
                      {formatAmount(card.limit)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Khả dụng</span>
                    <span className="block text-xs sm:text-sm font-semibold tabular-nums text-[var(--foreground)] truncate mt-0.5" title={formatAmount(card.availableCredit)}>
                      {formatAmount(card.availableCredit)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Chờ duyệt</span>
                    <span className="block text-xs sm:text-sm font-semibold tabular-nums text-[var(--foreground)] truncate mt-0.5" title={formatAmount(card.pendingPayment)}>
                      {formatAmount(card.pendingPayment)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

              {/* CỘT PHẢI (Col 7): Sao kê, Trả góp, Hoạt động & Lịch sử */}
              <div className="flex flex-col gap-4 sm:gap-5 lg:col-span-7">
                {/* 2. Sao kê cần thanh toán (Statement Section) */}
                {card.statement ? (
                  <section
                    className="border-t border-[var(--border)] pt-4 lg:border-t-0 lg:pt-0"
                    aria-labelledby={`statement-${card.id}`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <h3
                        id={`statement-${card.id}`}
                        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                      >
                        <WalletCards size={14} className="text-[var(--primary)]" aria-hidden="true" />
                        Sao kê cần thanh toán
                      </h3>

                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${card.statement.overdue
                            ? "bg-[color-mix(in_srgb,var(--destructive)_12%,var(--surface))] text-[var(--destructive)]"
                            : card.statement.paymentPending
                              ? "bg-[color-mix(in_srgb,var(--warning)_12%,var(--surface))] text-[var(--warning)]"
                              : "bg-[color-mix(in_srgb,var(--info)_12%,var(--surface))] text-[var(--info)]"
                          }`}
                      >
                        {card.statement.overdue
                          ? "Quá hạn"
                          : card.statement.paymentPending
                            ? "Đang chờ duyệt"
                            : "Cần thanh toán"}
                      </span>
                    </div>

                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 p-3.5 space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xl font-bold tabular-nums text-[var(--foreground)]">
                            {formatAmount(card.statement.amount, { maximumFractionDigits: 0 })} {currency}
                          </p>
                          <p
                            className={`mt-0.5 text-xs ${card.statement.overdue
                                ? "font-medium text-[var(--destructive)]"
                                : "text-[var(--text-secondary)]"
                              }`}
                          >
                            Chốt: {formatIsoDate(card.statement.cycleEndDate)} · Hạn: {formatIsoDate(card.statement.dueDate)}
                            {card.statement.overdue && " (Đã quá hạn)"}
                          </p>
                          <Link
                            href={`/credit-cards/${card.id}/statements/${card.statement.id}`}
                            className="mt-1 inline-flex min-h-8 items-center text-xs font-medium text-[var(--primary)] hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]"
                          >
                            Xem chi tiết sao kê
                          </Link>
                        </div>

                        <Button
                          type="button"
                          disabled={
                            pending ||
                            card.statement.paymentPending ||
                            !new Decimal(card.statement.amount || 0).gt(0)
                          }
                          onClick={() => setPaymentConfirmOpen(true)}
                          className="gap-1.5 w-full sm:w-auto"
                        >
                          <WalletCards size={16} aria-hidden="true" />
                          {card.statement.paymentPending ? "Đang chờ xử lý" : "Thanh toán sao kê"}
                        </Button>
                      </div>

                      {card.statement.sources.length > 0 && (
                        <div className="border-t border-[var(--border)] pt-2.5 space-y-1.5">
                          <span className="block text-[11px] font-medium text-[var(--text-muted)]">
                            Phân bổ ví thanh toán:
                          </span>
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {card.statement.sources.map((source) => (
                              <div
                                key={source.walletId}
                                className="flex items-center justify-between text-xs text-[var(--text-secondary)]"
                              >
                                <span className="truncate">
                                  {walletNames.get(source.walletId) ?? "Ví nguồn"}
                                </span>
                                <span className="font-semibold tabular-nums text-[var(--foreground)]">
                                  {formatAmount(source.amount, { maximumFractionDigits: 0 })} {currency}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                ) : (
                  <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/15 px-3.5 py-2.5 text-xs">
                    <span className="flex items-center gap-2 font-medium text-[var(--text-secondary)]">
                      <CheckCircle2 className="size-4 text-[var(--success)] shrink-0" aria-hidden="true" />
                      Chưa có sao kê đến hạn
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                      Chốt ngày {card.statementClosingDay}
                    </span>
                  </div>
                )}

                {/* 3. Kế hoạch trả góp (Installment Plans) */}
                {card.installmentPlans.length > 0 && (
                  <section
                    className="border-t border-[var(--border)] pt-3.5"
                    aria-labelledby={`plans-${card.id}`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3
                        id={`plans-${card.id}`}
                        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                      >
                        <CalendarClock size={14} className="text-[var(--warning)]" aria-hidden="true" />
                        Khoản trả góp ({card.installmentPlans.length})
                      </h3>
                      {card.installmentPlans.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setAllPlansOpen(true)}
                          className="flex items-center gap-0.5 text-xs font-medium text-[var(--primary)] hover:underline focus-visible:outline-none"
                        >
                          <span>Xem tất cả</span>
                          <ChevronRight size={13} aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      {card.installmentPlans.slice(0, 2).map(renderInstallmentCard)}
                    </div>
                  </section>
                )}

                {/* 4. Hoạt động gần đây (Recent Activities) */}
                <section
                  className="border-t border-[var(--border)] pt-3.5"
                  aria-labelledby={`activities-${card.id}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3
                      id={`activities-${card.id}`}
                      className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                    >
                      Giao dịch gần đây
                    </h3>
                    {card.activities.length > 4 && (
                      <button
                        type="button"
                        onClick={() => setAllActivitiesOpen(true)}
                        className="flex items-center gap-0.5 text-xs font-medium text-[var(--primary)] hover:underline focus-visible:outline-none"
                      >
                        <span>Xem tất cả ({card.activities.length})</span>
                        <ChevronRight size={13} aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {card.activities.length ? (
                    <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/15 px-3">
                      {card.activities.slice(0, 4).map(renderActivityRow)}
                    </div>
                  ) : (
                    <p className="py-3 text-center text-xs text-[var(--text-muted)]">
                      Chưa có giao dịch thẻ phát sinh.
                    </p>
                  )}
                </section>

                {/* 5. Lịch sử sao kê (Collapsible) */}
                {card.statements.length > 0 && (
                  <details className="group border-t border-[var(--border)] pt-3">
                    <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--foreground)] select-none">
                      <span>Lịch sử sao kê ({card.statements.length})</span>
                      <ChevronDown
                        size={14}
                        className="transition-transform duration-200 group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <div className="mt-2.5 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/15 px-3">
                      {card.statements.map((statement) => (
                        <Link
                          key={statement.id}
                          href={`/credit-cards/${card.id}/statements/${statement.id}`}
                          className="flex items-center justify-between gap-4 py-2 text-xs"
                        >
                          <span className="text-[var(--text-secondary)]">
                            Chốt {formatIsoDate(statement.cycleEndDate)} · Hạn {formatIsoDate(statement.dueDate)}
                          </span>
                          <span className="tabular-nums font-medium text-[var(--foreground)]">
                            {formatAmount(statement.amount)} {currency} ·{" "}
                            <span
                              className={
                                statement.status === "paid" ? "text-[var(--success)]" : "text-[var(--warning)]"
                              }
                            >
                              {statement.status === "paid" ? "Đã trả" : "Chưa trả"}
                            </span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>

        <Sheet
          open={paymentConfirmOpen}
          onOpenChange={(nextOpen) => !pending && setPaymentConfirmOpen(nextOpen)}
        >
          <SheetContent
            side={isDesktop ? "right" : "bottom"}
            placement={isDesktop ? "inset" : "edge"}
            size={isDesktop ? "sm" : "default"}
            spacing="flush"
            elevation="flat"
            className={isDesktop ? undefined : "quick-transaction-sheet"}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <SheetHeader
                icon={WalletCards}
                title={canApprove ? "Xác nhận thanh toán" : "Gửi yêu cầu thanh toán"}
                description={canApprove
                  ? `Kiểm tra các ví sẽ bị trừ trước khi thanh toán ${card.name}.`
                  : "Giao dịch sẽ chờ quản trị viên duyệt trước khi thay đổi số dư."}
              />
              <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 p-4 text-center">
                  <p className="text-xs text-[var(--text-muted)]">Tổng thanh toán sao kê</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--foreground)]">
                    {formatAmount(card.statement?.amount ?? 0)} {currency}
                  </p>
                  {card.statement && (
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      Hạn {formatIsoDate(card.statement.dueDate)}
                    </p>
                  )}
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Ví sẽ bị trừ
                  </h3>
                  <div className="mt-2 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] px-3">
                    {card.statement?.sources.map((source) => (
                      <div key={source.walletId} className="flex items-center justify-between gap-3 py-3 text-sm">
                        <span className="min-w-0 truncate text-[var(--text-secondary)]">
                          {walletNames.get(source.walletId) ?? "Ví nguồn"}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-[var(--foreground)]">
                          {formatAmount(source.amount)} {currency}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <SheetFooter
                onCancel={() => setPaymentConfirmOpen(false)}
                cancelLabel="Hủy"
                submitLabel={canApprove ? "Xác nhận thanh toán" : "Gửi yêu cầu"}
                isSubmitting={pending}
                submittingLabel="Đang xử lý..."
                submitDisabled={pending || !card.statement}
                onSubmit={payStatement}
                submitType="button"
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Ghi nhận hoàn tiền - Bottom Sheet trên Mobile, Drawer trên Desktop */}
        {/* Ghi nhận hoàn tiền - Bottom Sheet trên Mobile, Drawer trên Desktop */}
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
            spacing={isDesktop ? "flush" : "default"}
            elevation={isDesktop ? "flat" : "raised"}
            className={isDesktop ? undefined : "quick-transaction-sheet"}
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
                    ? `Hoàn tiền chi tiêu vào thẻ ${card.name}`
                    : `Cộng tiền hoàn hoặc cashback vào thẻ ${card.name}`
                }
              />

              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain pb-2">
                {/* Compact Card Pill */}
                <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 px-3.5 py-2.5 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[var(--primary)]/10 text-[var(--primary)]">
                      <CreditCard size={13} />
                    </span>
                    <span className="font-semibold text-[var(--foreground)] truncate">{card.name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] text-[var(--text-muted)]">Dư nợ: </span>
                    <strong className="font-semibold tabular-nums text-[var(--foreground)]">
                      {formatAmount(hasCredit ? card.creditBalance : card.debt)} {currency}
                    </strong>
                    {hasCredit && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium ml-1">(Dư có)</span>}
                  </div>
                </div>

                {/* If linked to a specific transaction, show original transaction box */}
                {selectedRefundActivity && (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <span className="font-medium">Giao dịch gốc</span>
                      <span>{formatIsoDate(selectedRefundActivity.date)}</span>
                    </div>
                    <p className="font-semibold text-[var(--foreground)]">
                      {selectedRefundActivity.description || "Chi tiêu thẻ"}
                    </p>
                    <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]/50 text-[11px]">
                      <span className="text-[var(--text-muted)]">Số tiền có thể hoàn:</span>
                      <strong className="font-semibold tabular-nums text-[var(--primary)]">
                        {formatAmount(selectedRefundActivity.refundableAmount)} {currency}
                      </strong>
                    </div>
                  </div>
                )}

                {/* Amount input */}
                <div>
                  <MoneyInput
                    label="Số tiền hoàn"
                    value={refundAmount}
                    onValueChange={setRefundAmount}
                    placeholder="0"
                    required
                    autoFocus
                  />
                  {selectedRefundActivity && refundAmount && new Decimal(refundAmount || 0).gt(selectedRefundActivity.refundableAmount) && (
                    <p role="alert" className="mt-1 flex items-center gap-1.5 text-xs text-[var(--destructive)]">
                      <AlertCircle className="size-3.5" aria-hidden="true" />
                      Chỉ còn có thể hoàn tối đa {formatAmount(selectedRefundActivity.refundableAmount)} {currency}.
                    </p>
                  )}
                </div>

                {/* Reason / Description */}
                <div>
                  <Input
                    label="Nội dung"
                    value={refundDescription}
                    onChange={(e) => setRefundDescription(e.target.value)}
                    placeholder={
                      refundTransactionId
                        ? "Lý do hoàn tiền (hủy đơn, trả hàng...)"
                        : "Cashback chi tiêu, Hoàn phí thường niên..."
                    }
                    maxLength={120}
                  />
                </div>

                {/* Date note */}
                <div className="flex items-center justify-between rounded-xl bg-[var(--surface-secondary)]/30 px-3.5 py-2 text-xs text-[var(--text-muted)] border border-[var(--border)]/60">
                  <span>Ngày ghi nhận</span>
                  <span className="font-medium text-[var(--foreground)] tabular-nums">
                    {formatIsoDate(businessDate)}
                  </span>
                </div>

                {/* Friendly explanation note */}
                <div className="flex items-start gap-2 rounded-xl bg-[var(--surface-secondary)]/40 p-2.5 text-[11px] text-[var(--text-muted)] leading-relaxed border border-[var(--border)]/40">
                  <Info className="size-3.5 shrink-0 text-[var(--primary)] mt-0.5" aria-hidden="true" />
                  <span>
                    {refundTransactionId
                      ? "Tiền hoàn sẽ giảm dư nợ thẻ và đảo lại phần tiền phân bổ từ ví bảo lãnh của giao dịch gốc."
                      : "Tiền hoàn sẽ tự động cấn trừ vào dư nợ thẻ hoặc cộng vào hạn mức khả dụng của bạn."}
                  </span>
                </div>
              </div>

              <SheetFooter
                className="pb-[max(1.5rem,env(safe-area-inset-bottom))] px-4 sm:px-6 py-3 sm:py-3.5"
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
                  Boolean(selectedRefundActivity && new Decimal(refundAmount || 0).gt(selectedRefundActivity.refundableAmount))
                }
              />
            </form>
          </SheetContent>
        </Sheet>

        {/* Đăng ký trả góp - Bottom Sheet trên Mobile, Drawer trên Desktop */}
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
            spacing={isDesktop ? "flush" : "default"}
            elevation={isDesktop ? "flat" : "raised"}
            className={isDesktop ? undefined : "quick-transaction-sheet"}
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
                description="Chia nhỏ khoản chi tiêu thành các kỳ thanh toán linh hoạt."
              />

              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain pb-2">
                {installmentTarget && (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/40 p-3.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <span>Khoản chi tiêu chuyển đổi</span>
                      <span>Ngày: {formatIsoDate(installmentTarget.date)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-[var(--foreground)] truncate">
                        {installmentTarget.description || "Chi tiêu thẻ"}
                      </p>
                      <span className="font-bold tabular-nums text-[var(--foreground)] shrink-0">
                        {formatAmount(installmentTarget.amount)} {currency}
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
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
                  <div>
                    <MoneyInput
                      label={`Phí chuyển đổi (${currency})`}
                      value={feeAmount}
                      onValueChange={setFeeAmount}
                      placeholder="0"
                    />
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                      Để trống hoặc nhập 0 nếu là chương trình ưu đãi phí 0%.
                    </p>
                  </div>
                </div>

                {installmentCalc && (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/35 p-3 text-xs divide-y divide-[var(--border)]/40">
                    <div className="flex items-center justify-between pb-2">
                      <span className="text-[var(--text-muted)]">
                        {installmentCalc.hasFee ? "Mỗi tháng (từ kỳ 2)" : "Ước tính mỗi tháng"}
                      </span>
                      <span className="font-semibold tabular-nums text-[var(--foreground)]">
                        ~{formatAmount(installmentCalc.regularPrincipal, { maximumFractionDigits: 0 })} {currency}/tháng
                      </span>
                    </div>

                    {installmentCalc.hasFee && (
                      <div className="flex items-center justify-between py-2">
                        <span className="text-[var(--text-muted)]">Kỳ đầu (gốc + phí)</span>
                        <span className="font-semibold tabular-nums text-[var(--primary)]">
                          ~{formatAmount(installmentCalc.firstTermAmount, { maximumFractionDigits: 0 })} {currency}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 text-[11px]">
                      <span className="text-[var(--text-muted)]">
                        Tổng thanh toán ({installmentCalc.count} kỳ)
                      </span>
                      <span className="font-medium tabular-nums text-[var(--foreground)]">
                        {formatAmount(installmentCalc.total, { maximumFractionDigits: 0 })} {currency}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2 rounded-xl bg-[var(--surface-secondary)]/30 p-2.5 text-[11px] text-[var(--text-muted)] leading-relaxed border border-[var(--border)]/40">
                  <Info className="size-3.5 shrink-0 text-[var(--primary)] mt-0.5" aria-hidden="true" />
                  <span>
                    Tiền gốc chia đều các kỳ. Phí chuyển đổi (nếu có) tính vào kỳ đầu tiên. Không thể hoàn tác sau khi đăng ký.
                  </span>
                </div>
              </div>

              <SheetFooter
                className="pb-[max(1.5rem,env(safe-area-inset-bottom))] px-4 sm:px-6 py-3 sm:py-3.5"
                onCancel={() => setInstallmentTarget(null)}
                cancelLabel="Hủy"
                submitLabel={pending ? "Đang xử lý..." : "Xác nhận trả góp"}
                isSubmitting={pending}
                submitDisabled={
                  pending ||
                  (feeAmount.trim() !== "" && new Decimal(feeAmount).lt(0))
                }
              />
            </form>
          </SheetContent>
        </Sheet>

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
            spacing={isDesktop ? "flush" : "default"}
            elevation={isDesktop ? "flat" : "raised"}
            className={isDesktop ? undefined : "quick-transaction-sheet"}
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
                title={importStep === 1 ? "Thêm khoản trả góp đã có" : "Thanh toán & Dư nợ thẻ"}
                description={
                  importStep === 1
                    ? "Bước 1/2 · Thông tin khoản trả góp"
                    : "Bước 2/2 · Nguồn tiền và tính nợ thẻ"
                }
              >
                <div className="mt-2.5 flex w-full items-center gap-1.5" aria-hidden="true">
                  <div className="h-1 flex-1 rounded-full bg-[var(--primary)]" />
                  <div
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors duration-200",
                      importStep === 2 ? "bg-[var(--primary)]" : "bg-[var(--border)]",
                    )}
                  />
                </div>
              </SheetHeader>

              {importStep === 1 ? (
                <div className="flex-1 space-y-3.5 overflow-y-auto p-4 pb-2 overscroll-contain sm:p-5">
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
                      aria-invalid={importTermCount !== "" && (Number(importTermCount) < 2 || Number(importTermCount) > 60)}
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
                      aria-invalid={
                        importPaidTermCount !== "" &&
                        (Number(importPaidTermCount) < 0 ||
                          (importTermCount !== "" && Number(importPaidTermCount) >= Number(importTermCount)))
                      }
                    />
                  </div>
                  <div>
                    <MoneyInput
                      label={`Số tiền còn phải trả (${currency})`}
                      value={importRemainingAmount}
                      onValueChange={setImportRemainingAmount}
                      placeholder="0"
                      required
                    />
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
                      Gồm cả phí chuyển đổi trả góp (nếu ngân hàng tính gộp vào nợ).
                    </p>
                  </div>
                  {importPreview && (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 p-3 text-xs text-[var(--text-secondary)]" aria-live="polite">
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Còn lại {importPreview.remainingTerms} tháng · Đã trả {importPaidTermCount || "0"}/{importTermCount} tháng
                      </p>
                      <p className="mt-1 font-semibold text-sm text-[var(--foreground)] tabular-nums">
                        Mỗi tháng trả: {formatAmount(importPreview.monthlyAmount, { maximumFractionDigits: 0 })} {currency}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 space-y-3.5 overflow-y-auto p-4 pb-2 overscroll-contain sm:p-5">
                  <div>
                    <Select
                      label="Dư nợ thẻ hiện tại đã gồm khoản này chưa?"
                      value={importBalanceMode}
                      onValueChange={(value) => setImportBalanceMode(value as typeof importBalanceMode)}
                      options={[
                        { value: "included_opening_debt", label: "Đã tính trong nợ ban đầu" },
                        { value: "add_to_balance", label: "Chưa tính (cộng thêm vào nợ thẻ)" },
                      ]}
                      required
                    />
                    <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
                      {importBalanceMode === "included_opening_debt"
                        ? "Dư nợ thẻ giữ nguyên, chỉ tách khoản này ra để theo dõi lịch trả hàng tháng."
                        : "Tăng dư nợ thẻ tương ứng, không tính là khoản chi tiêu mới trong tháng."}
                    </p>
                  </div>
                  <div>
                    <Select
                      label="Ví dùng để thanh toán"
                      value={importFundingWalletId}
                      onValueChange={setImportFundingWalletId}
                      options={fundingWallets.map((wallet) => ({ value: wallet.id, label: wallet.name }))}
                      required
                    />
                    {importBalanceMode === "included_opening_debt" && (
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                        Nợ ban đầu còn khả dụng: {formatAmount(selectedImportableOpeningDebt)} {currency}
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
                  {importBalanceMode === "included_opening_debt" && (
                    <p className={`flex gap-2 text-[11px] leading-relaxed ${exceedsImportableOpeningDebt ? "text-[var(--destructive)]" : "text-[var(--warning)]"}`} role={exceedsImportableOpeningDebt ? "alert" : undefined}>
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      {exceedsImportableOpeningDebt
                        ? "Số tiền vượt quá phần nợ ban đầu còn lại của thẻ. Bạn hãy giảm số tiền hoặc chọn 'Chưa tính (cộng thêm vào nợ thẻ)'."
                        : "Nếu nợ ban đầu đã lên sao kê hoặc đã thanh toán, app sẽ chặn để đảm bảo sổ sách chính xác."}
                    </p>
                  )}
                </div>
              )}

              {importStep === 1 ? (
                <SheetFooter
                  className="px-4 py-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-3.5"
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
                  className="px-4 py-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-3.5"
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

        <Sheet open={editOpen} onOpenChange={(nextOpen) => !pending && setEditOpen(nextOpen)}>
          <SheetContent
            side={isDesktop ? "right" : "bottom"}
            placement={isDesktop ? "inset" : "edge"}
            size={isDesktop ? "wide" : "default"}
            spacing="flush"
            elevation="flat"
            className={isDesktop ? undefined : "quick-transaction-sheet"}
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
                description="Thông tin mới chỉ áp dụng cho các kỳ sao kê phát sinh sau khi cập nhật."
              />
              <div className="grid flex-1 gap-4 overflow-y-auto p-4 sm:p-6 md:grid-cols-2 md:gap-6">
                <div className="space-y-4">
                  <Input
                    label="Tên thẻ"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    maxLength={120}
                    required
                  />
                  <Textarea
                    label="Ghi chú"
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    maxLength={2000}
                    rows={3}
                  />
                  <MoneyInput
                    label={`Hạn mức tín dụng (${currency})`}
                    value={editLimit}
                    onValueChange={setEditLimit}
                    required
                  />
                  {editLimit && new Decimal(editLimit || 0).lt(card.debt) && (
                    <p role="alert" className="flex items-center gap-1.5 text-xs text-[var(--destructive)]">
                      <AlertCircle className="size-3.5" aria-hidden="true" />
                      Hạn mức không được thấp hơn dư nợ {formatAmount(card.debt)} {currency}.
                    </p>
                  )}
                </div>
                <div className="space-y-4 md:border-l md:border-[var(--border)] md:pl-6">
                  <Select
                    label="Ví thanh toán mặc định"
                    value={editFundingWalletId}
                    onValueChange={setEditFundingWalletId}
                    options={fundingWallets.map((wallet) => ({ value: wallet.id, label: wallet.name }))}
                    required
                  />
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
                  {card.installmentPlans.some((plan) => plan.status === "pending" || plan.status === "active") && editClosingDay !== String(card.statementClosingDay) && (
                    <p role="alert" className="flex items-start gap-1.5 text-xs text-[var(--warning)]">
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      Không thể đổi ngày chốt khi thẻ còn kế hoạch trả góp đang hoạt động.
                    </p>
                  )}
                </div>
              </div>
              <SheetFooter
                onCancel={() => setEditOpen(false)}
                submitLabel="Lưu thay đổi"
                isSubmitting={pending}
                submitDisabled={
                  pending ||
                  !editName.trim() ||
                  !editFundingWalletId ||
                  !editLimit ||
                  !new Decimal(editLimit || 0).gt(0) ||
                  new Decimal(editLimit || 0).lt(card.debt) ||
                  (card.installmentPlans.some((plan) => plan.status === "pending" || plan.status === "active") && editClosingDay !== String(card.statementClosingDay))
                }
              />
            </form>
          </SheetContent>
        </Sheet>

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
          contentClassName="w-80 sm:w-96"
          content={
            <div className="space-y-3 pt-1">
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive space-y-1.5">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                  <span>Dữ liệu sẽ bị xóa vĩnh viễn:</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-[var(--foreground)]">
                  <li>Toàn bộ {card.activities.length} giao dịch trên thẻ</li>
                  {card.installmentPlans.length > 0 && (
                    <li>{card.installmentPlans.length} kế hoạch trả góp liên quan</li>
                  )}
                  {card.statements && card.statements.length > 0 && (
                    <li>{card.statements.length} kỳ sao kê đã tạo</li>
                  )}
                  {hasDebt && (
                    <li>Khoản dư nợ {formatAmount(card.debt)} {currency}</li>
                  )}
                  {hasCredit && (
                    <li>Số dư có {formatAmount(card.creditBalance)} {currency}</li>
                  )}
                  <li>Các liên kết nghĩa vụ tài chính và hạn mức của thẻ</li>
                </ul>
              </div>

              <label
                htmlFor={`confirm-loss-${card.id}`}
                className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 cursor-pointer select-none transition-colors hover:bg-[var(--surface-hover)]"
              >
                <Checkbox
                  id={`confirm-loss-${card.id}`}
                  checked={confirmLossChecked}
                  onCheckedChange={(checked) => setConfirmLossChecked(Boolean(checked))}
                  className="mt-0.5 shrink-0"
                />
                <span className="text-xs font-medium text-[var(--foreground)] leading-snug">
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

      {/* Sheet xem toàn bộ Kế hoạch trả góp */}
      <Sheet open={allPlansOpen} onOpenChange={setAllPlansOpen}>
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          placement={isDesktop ? "inset" : "edge"}
          size={isDesktop ? "wide" : "default"}
          spacing="flush"
          elevation="flat"
          className={isDesktop ? undefined : "quick-transaction-sheet"}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <SheetHeader
              icon={CalendarClock}
              title="Khoản trả góp"
              description={`Tất cả ${card.installmentPlans.length} khoản trả góp của thẻ ${card.name}.`}
            />
            <div className="flex-1 space-y-2.5 overflow-y-auto p-4 sm:p-6 overscroll-contain">
              {card.installmentPlans.map(renderInstallmentCard)}
            </div>
            <SheetFooter
              className="px-4 py-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-3.5"
              onSubmit={() => setAllPlansOpen(false)}
              submitLabel="Đóng"
              submitType="button"
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet xem toàn bộ Giao dịch gần đây */}
      <Sheet open={allActivitiesOpen} onOpenChange={setAllActivitiesOpen}>
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          placement={isDesktop ? "inset" : "edge"}
          size={isDesktop ? "wide" : "default"}
          spacing="flush"
          elevation="flat"
          className={isDesktop ? undefined : "quick-transaction-sheet"}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <SheetHeader
              icon={History}
              title="Giao dịch gần đây"
              description={`Tất cả ${card.activities.length} giao dịch phát sinh trên thẻ ${card.name}.`}
            />
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 overscroll-contain">
              <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/15 px-3">
                {card.activities.map(renderActivityRow)}
              </div>
            </div>
            <SheetFooter
              className="px-4 py-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-3.5"
              onSubmit={() => setAllActivitiesOpen(false)}
              submitLabel="Đóng"
              submitType="button"
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Xác nhận xóa khoản trả góp */}
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
                : `Khoản ${formatAmount(deletingPlan.principal, { maximumFractionDigits: 0 })} ${currency} sẽ quay lại dư nợ thẻ thông thường.`
              : `Giao dịch sẽ quay lại chi tiêu thẻ bình thường. Phí chuyển đổi (nếu có) sẽ được hoàn lại.`
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

      {/* Xác nhận xóa giao dịch thẻ ghi nhầm */}
      {deletingActivity && (
        <ConfirmDelete
          open={Boolean(deletingActivity)}
          onOpenChange={(open) => !open && setDeletingActivity(null)}
          trigger={null}
          ariaLabel={`Xóa giao dịch ${deletingActivity.description || "chi tiêu thẻ"}`}
          title={
            deletingActivity.description
              ? `Xóa giao dịch “${deletingActivity.description}”?`
              : "Xóa giao dịch chi tiêu này?"
          }
          description={`Giao dịch ${formatAmount(deletingActivity.amount)} ${currency} sẽ bị xóa và dư nợ thẻ sẽ được giảm trừ số tiền tương ứng.`}
          confirmLabel="Xóa giao dịch"
          presentation={isDesktop ? "popover" : "sheet"}
          disabled={pending}
          onConfirm={async () => {
            const res = await deleteTransactionAction(workspaceId, deletingActivity.id, "Xóa giao dịch nhầm trên thẻ tín dụng");
            if (res.ok) {
              toast.success(`Đã xóa giao dịch${deletingActivity.description ? ` “${deletingActivity.description}”` : ""}.`);
              setDeletingActivity(null);
            } else {
              toast.error(res.message ?? "Không thể xóa giao dịch.");
            }
          }}
        />
      )}

      {/* Sửa giao dịch / Đổi ví - Sheet inset, quick-amount-field & collapsible details */}
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
          className={cn(
            "ledger-mobile-edit-sheet",
            isDesktop ? "sm:max-w-md" : "max-h-[92vh]",
          )}
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
              <SheetHeader className="wallet-edit-header ledger-transaction-sheet-header">
                <div className="wallet-edit-heading">
                  <span aria-hidden="true">
                    <Pencil size={18} />
                  </span>
                  <div className="min-w-0">
                    <SheetTitle>Chỉnh sửa giao dịch</SheetTitle>
                    <SheetDescription>
                      {editingActivity.description || "Cập nhật thông tin giao dịch"}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6 overscroll-contain">
                {/* Số tiền: quick-amount-field */}
                <MoneyInput
                  wrapperClassName="quick-amount-field mt-3 mb-2"
                  autoFocus
                  value={editAmount}
                  onValueChange={setEditAmount}
                  placeholder="0"
                  aria-label="Số tiền giao dịch"
                  required
                />

                {/* Ví và Danh mục chuẩn form giao dịch */}
                <div className="quick-transaction-grid">
                  <Select
                    label="Ví"
                    value={editWalletId}
                    onValueChange={setEditWalletId}
                    placeholder="Chọn ví"
                    options={(wallets ?? []).map((w) => {
                      const isCard = w.kind === "credit_card";
                      return {
                        value: w.id,
                        label: w.name,
                        content: (
                          <div className="flex w-full items-center justify-between gap-2">
                            <span className="flex items-center gap-2 min-w-0">
                              {isCard ? (
                                <CreditCard className="size-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                              ) : (
                                <Wallet className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                              )}
                              <span className="truncate">{w.name}</span>
                            </span>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                isCard
                                  ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                                  : "bg-[var(--surface-secondary)] text-[var(--text-muted)]",
                              )}
                            >
                              {isCard ? "Thẻ tín dụng" : "Ví tài sản"}
                            </span>
                          </div>
                        ),
                        selectedContent: (
                          <span className="flex items-center gap-2 min-w-0">
                            {isCard ? (
                              <CreditCard className="size-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                            ) : (
                              <Wallet className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                            )}
                            <span className="truncate">{w.name}</span>
                            {isCard && (
                              <span className="shrink-0 rounded-full bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)]">
                                Thẻ tín dụng
                              </span>
                            )}
                          </span>
                        ),
                      };
                    })}
                    required
                  />

                  {categories && categories.length > 0 && (
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

                {/* Chi tiết bổ sung (giống tạo/sửa giao dịch: ẩn mặc định, mở ra khi cần) */}
                <Button
                  variant="unstyled"
                  size="auto"
                  type="button"
                  className="quick-details-toggle"
                  onClick={() => setShowEditDetails((prev) => !prev)}
                  aria-expanded={showEditDetails}
                >
                  <CalendarDays size={16} />
                  {showEditDetails
                    ? "Ẩn thông tin bổ sung"
                    : "Thêm nội dung hoặc đổi ngày"}
                </Button>

                {showEditDetails && (
                  <div className="quick-details">
                    <DatePicker
                      label="Ngày giao dịch"
                      value={editDate}
                      onValueChange={setEditDate}
                      required
                    />
                    <Input
                      label="Nội dung"
                      placeholder="Ăn trưa, nhận lương..."
                      value={editActivityDescription}
                      onChange={(e) => setEditActivityDescription(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <SheetFooter
                onCancel={() => {
                  setEditingActivity(null);
                  setShowEditDetails(false);
                }}
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
    </>
  );
}

export function CreditCardOverview(props: {
  workspaceId: string;
  currency: string;
  businessDate: string;
  cards: CreditCardOverviewItem[];
  initialCardId?: string | null;
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
  const [selectedCardId, setSelectedCardId] = useState<string | null>(
    () => props.initialCardId ?? null,
  );

  useEffect(() => {
    if (props.initialCardId !== undefined) {
      setSelectedCardId(props.initialCardId);
    }
  }, [props.initialCardId]);

  useEffect(() => {
    const onPopState = () => {
      const match = window.location.pathname.match(/\/credit-cards\/([^/]+)/);
      setSelectedCardId(match ? match[1] : null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleSelectCard = (id: string) => {
    setSelectedCardId(id);
    window.history.pushState(null, "", `/credit-cards/${id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackToList = () => {
    setSelectedCardId(null);
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

  const totalLimit = useMemo(() => {
    return props.cards.reduce(
      (sum, c) => sum.plus(new Decimal(c.limit || 0)),
      new Decimal(0),
    );
  }, [props.cards]);

  const totalAvailable = useMemo(() => {
    return props.cards.reduce(
      (sum, c) => sum.plus(new Decimal(c.availableCredit || 0)),
      new Decimal(0),
    );
  }, [props.cards]);

  return (
    <section className="space-y-4" aria-label="Quản lý thẻ tín dụng">
      {/* Khi ở trang danh sách thẻ (chưa chọn thẻ nào) */}
      {!activeCard ? (
        <>
          {/* 1. Tổng quan số liệu toàn bộ thẻ */}
          {props.cards.length > 0 && (
            <Card as="div" className="p-3 sm:p-4 rounded-2xl">
              <div className="divide-y divide-[var(--border)]/40 sm:grid sm:grid-cols-3 sm:divide-y-0 sm:divide-x sm:text-center">
                {/* 1. Tổng dư nợ */}
                <div className="flex items-center justify-between pb-2.5 sm:pb-0 sm:px-3 sm:flex-col sm:justify-center">
                  <span className="text-[11px] font-medium text-[var(--text-muted)]">
                    Tổng dư nợ
                  </span>
                  <p
                    className={cn(
                      "font-bold tabular-nums text-sm sm:text-base tracking-tight sm:mt-1",
                      totalDebt.gt(0)
                        ? "text-[var(--destructive)]"
                        : "text-[var(--foreground)]",
                    )}
                  >
                    {formatAmount(totalDebt.toString())}{" "}
                    <span className="text-[10px] font-normal uppercase text-[var(--text-muted)]">
                      {props.currency}
                    </span>
                  </p>
                </div>

                {/* 2. Tổng khả dụng */}
                <div className="flex items-center justify-between py-2.5 sm:py-0 sm:px-3 sm:flex-col sm:justify-center">
                  <span className="text-[11px] font-medium text-[var(--text-muted)]">
                    Tổng khả dụng
                  </span>
                  <p className="font-bold tabular-nums text-sm sm:text-base tracking-tight text-[var(--success)] sm:mt-1">
                    {formatAmount(totalAvailable.toString())}{" "}
                    <span className="text-[10px] font-normal uppercase text-[var(--text-muted)]">
                      {props.currency}
                    </span>
                  </p>
                </div>

                {/* 3. Tổng hạn mức */}
                <div className="flex items-center justify-between pt-2.5 sm:pt-0 sm:px-3 sm:flex-col sm:justify-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-[var(--text-muted)]">
                      Tổng hạn mức
                    </span>
                    <span className="text-[10px] font-medium text-[var(--text-secondary)] bg-[var(--surface-secondary)] px-1.5 py-0.5 rounded border border-[var(--border)]/50">
                      {props.cards.length} thẻ
                    </span>
                  </div>
                  <p className="font-bold tabular-nums text-sm sm:text-base tracking-tight text-[var(--foreground)] sm:mt-1">
                    {formatAmount(totalLimit.toString())}{" "}
                    <span className="text-[10px] font-normal uppercase text-[var(--text-muted)]">
                      {props.currency}
                    </span>
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* 2. Danh sách/Lưới các thẻ tín dụng */}
          {props.cards.length ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Danh sách thẻ ({props.cards.length})
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Bấm vào thẻ để xem chi tiết
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {props.cards.map((card) => (
                  <CreditCardVirtualCard
                    key={card.id}
                    card={card}
                    currency={props.currency}
                    isInteractive
                    onClick={() => handleSelectCard(card.id)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <Card as="div" className="gap-2 p-6 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--surface-secondary)] text-[var(--text-muted)]">
                <CreditCard size={24} aria-hidden="true" />
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                Chưa có thẻ tín dụng
              </p>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                Quản trị viên có thể thêm thẻ tín dụng để theo dõi chu kỳ sao kê, hạn mức và phân bổ ví trích nợ.
              </p>
            </Card>
          )}
        </>
      ) : (
        /* Khi ở trang chi tiết thẻ đã chọn */
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBackToList}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors py-1.5 px-2.5 -ml-2 rounded-lg hover:bg-[var(--surface-secondary)] cursor-pointer"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span>Tất cả thẻ tín dụng</span>
            </button>
          </div>

          <CreditCardPanel
            key={activeCard.id}
            {...props}
            card={activeCard}
          />
        </div>
      )}
    </section>
  );
}
