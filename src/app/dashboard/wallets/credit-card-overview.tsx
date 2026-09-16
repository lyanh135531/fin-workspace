"use client";

import Decimal from "decimal.js";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  History,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Split,
  Trash2,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import {
  addCreditCardRefundAction,
  deleteCreditCardAction,
  deleteImportedCreditCardInstallmentAction,
  importCreditCardInstallmentAction,
  payCreditCardAction,
  registerCreditCardInstallmentAction,
  updateCreditCardAction,
} from "@/app/dashboard/actions";
import {
  Button,
  Card,
  ConfirmDelete,
  Input,
  MoneyInput,
  Select,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
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
import { firstStatementOnOrAfter, installmentAmounts, nextStatementDate } from "@/domain/credit-card/installments";

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

type FundingWallet = { id: string; name: string };

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

const DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => ({
  value: String(index + 1),
  label: `Ngày ${index + 1}`,
}));

function CreditCardPanel({
  workspaceId,
  currency,
  businessDate,
  card,
  canManage,
  canApprove,
  fundingWallets,
  expanded,
  onToggle,
}: {
  workspaceId: string;
  currency: string;
  businessDate: string;
  card: CreditCardOverviewItem;
  canManage: boolean;
  canApprove: boolean;
  fundingWallets: FundingWallet[];
  expanded: boolean;
  onToggle: () => void;
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
  const [installmentTarget, setInstallmentTarget] = useState<CardActivity | null>(null);
  const [termCount, setTermCount] = useState("3");
  const [feeAmount, setFeeAmount] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importDescription, setImportDescription] = useState("");
  const [importTermCount, setImportTermCount] = useState("12");
  const [importPaidTermCount, setImportPaidTermCount] = useState("0");
  const [importRemainingAmount, setImportRemainingAmount] = useState("");
  const [importBalanceMode, setImportBalanceMode] = useState<"included_opening_debt" | "add_to_balance">("included_opening_debt");
  const [importFundingWalletId, setImportFundingWalletId] = useState(card.defaultFundingWalletId);
  const [importFirstStatementDate, setImportFirstStatementDate] = useState("");
  const [menuActivityId, setMenuActivityId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [paymentConfirmOpen, setPaymentConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(card.name);
  const [editDescription, setEditDescription] = useState(card.description ?? "");
  const [editLimit, setEditLimit] = useState(card.limit);
  const [editFundingWalletId, setEditFundingWalletId] = useState(card.defaultFundingWalletId);
  const [editClosingDay, setEditClosingDay] = useState(String(card.statementClosingDay));
  const [editDueDay, setEditDueDay] = useState(String(card.paymentDueDay));
  const cardMenuTriggerRef = useRef<HTMLButtonElement>(null);

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
    const totalTerms = Number(importTermCount);
    const paidTerms = Number(importPaidTermCount);
    if (!Number.isInteger(totalTerms) || !Number.isInteger(paidTerms) || totalTerms < 2 || totalTerms > 60 || paidTerms < 0 || paidTerms >= totalTerms) {
      return null;
    }
    try {
      const remaining = new Decimal(importRemainingAmount || 0);
      if (!remaining.gt(0)) return null;
      const amounts = installmentAmounts(remaining, totalTerms - paidTerms);
      return {
        remainingTerms: amounts.length,
        regularAmount: amounts[0].toString(),
        finalAmount: amounts[amounts.length - 1].toString(),
      };
    } catch {
      return null;
    }
  }, [importPaidTermCount, importRemainingAmount, importTermCount]);
  const selectedImportableOpeningDebt = importableOpeningDebtByWallet.get(importFundingWalletId) ?? new Decimal(0);
  const exceedsImportableOpeningDebt = importBalanceMode === "included_opening_debt"
    && Boolean(importPreview)
    && new Decimal(importRemainingAmount || 0).gt(selectedImportableOpeningDebt);

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
    if (!refundTransactionId || !new Decimal(refundAmount || 0).gt(0)) return;
    startTransition(async () => {
      const result = await addCreditCardRefundAction(workspaceId, {
        cardWalletId: card.id,
        originalTransactionId: refundTransactionId,
        amount: refundAmount,
        date: businessDate,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Không thể hoàn tiền.");
        return;
      }
      toast.success(
        result.status === "approved"
          ? "Đã ghi nhận hoàn tiền vào thẻ."
          : "Đã tạo khoản hoàn tiền chờ duyệt.",
      );
      setRefundOpen(false);
      setRefundAmount("");
      setRefundTransactionId("");
    });
  }

  function openImportInstallment() {
    setImportDescription("");
    setImportTermCount("12");
    setImportPaidTermCount("0");
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
        paidTermCount: Number(importPaidTermCount),
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
    });
  }

  async function handleDeleteImportedPlan(plan: InstallmentPlan) {
    const result = await deleteImportedCreditCardInstallmentAction(workspaceId, { planId: plan.id });
    if (!result.ok) {
      toast.error(result.message ?? "Không thể xóa khoản trả góp đã nhập.");
      return false;
    }
    toast.success("Đã xóa khoản trả góp đã nhập.");
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
    });
    if (!result.ok) {
      toast.error(result.message ?? "Không thể xóa thẻ tín dụng.");
      return false;
    }
    toast.success(`Đã xóa thẻ “${card.name}”.`);
    return true;
  }

  return (
    <>
      <Card as="article" className="gap-0 p-4 sm:p-5 md:p-6 overflow-hidden">
        <Button
          type="button"
          variant="unstyled"
          className="flex min-h-11 w-full items-center justify-between gap-4 text-left"
          aria-expanded={expanded}
          aria-controls={`credit-card-details-${card.id}`}
          onClick={onToggle}
        >
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-[var(--foreground)]">{card.name}</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {card.statement
                ? `Hạn thanh toán ${formatIsoDate(card.statement.dueDate)}`
                : `Chốt sao kê ngày ${card.statementClosingDay}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                {formatAmount(hasCredit ? card.creditBalance : card.debt)} {currency}
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">{hasCredit ? "Dư có" : "Dư nợ"}</p>
            </div>
            <ChevronDown
              className={cn("size-4 text-[var(--text-muted)] transition-transform", expanded && "rotate-180")}
              aria-hidden="true"
            />
          </div>
        </Button>
        {expanded && (
        <div id={`credit-card-details-${card.id}`} className="mt-5 border-t border-[var(--border)] pt-5">
        {/* 2-Column Responsive Layout: stacked on mobile, 12-col grid on desktop */}
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
          {/* CỘT TRÁI (Col 5): Thẻ ảo & Chỉ số */}
          <div className="flex flex-col gap-3.5 lg:col-span-5">
            {/* Virtual Card Graphic */}
            <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface-secondary)] via-[var(--surface)] to-[var(--surface-secondary)] p-4 sm:p-5 text-[var(--foreground)] transition-all select-none">
              {/* Subtle ambient lighting */}
              <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-[var(--primary)]/10 blur-xl" />
              <div className="pointer-events-none absolute -left-6 -bottom-6 h-28 w-28 rounded-full bg-[var(--primary)]/5 blur-xl" />

              {/* Top row: Chip + Waves + Brand Pill */}
              <div className="relative z-10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* EMV Chip */}
                  <div className="grid h-5 w-7 place-items-center rounded border border-[var(--border)] bg-amber-500/15">
                    <div className="grid h-3 w-4.5 grid-cols-2 grid-rows-2 gap-0.5 opacity-70">
                      <span className="rounded-tl border-b border-r border-amber-600/50" />
                      <span className="rounded-tr border-b border-l border-amber-600/50" />
                      <span className="rounded-bl border-t border-r border-amber-600/50" />
                      <span className="rounded-br border-t border-l border-amber-600/50" />
                    </div>
                  </div>
                  {/* Contactless waves */}
                  <svg
                    className="h-3.5 w-3.5 text-[var(--text-muted)]"
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
                    <path d="M15.5 21.5a12 12 0 0 0 0-19" />
                  </svg>
                </div>

                <div className="flex items-center gap-1.5">
                  <CardBrandBadge brand={brand} />

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <button
                          ref={cardMenuTriggerRef}
                          type="button"
                          aria-label={`Tùy chọn thẻ ${card.name}`}
                          className="grid size-11 place-items-center rounded-full text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)]/80 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring md:size-8"
                        />
                      }
                    >
                      <MoreHorizontal size={16} aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      side="bottom"
                      sideOffset={6}
                      className="w-52 !rounded-xl p-1.5 border border-[var(--border)] bg-[var(--surface)] shadow-none"
                    >
                      {canManage && (
                        <DropdownMenuItem
                          onClick={() => setEditOpen(true)}
                          className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium !rounded-lg cursor-pointer text-[var(--foreground)]"
                        >
                          <Pencil className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                          <span>Chỉnh sửa thẻ</span>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        disabled={card.refundCandidates.length === 0}
                        onClick={() => {
                          setRefundTransactionId(card.refundCandidates[0]?.id ?? "");
                          setRefundOpen(true);
                        }}
                        className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium !rounded-lg cursor-pointer text-[var(--foreground)]"
                      >
                        <RotateCcw className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                        <span>Ghi nhận hoàn tiền</span>
                      </DropdownMenuItem>
                      {canManage && (
                        <>
                          <DropdownMenuSeparator className="my-1 -mx-1 bg-[var(--border)]" />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setConfirmDelete(true)}
                            className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium !rounded-lg cursor-pointer"
                          >
                            <Trash2 className="size-4 shrink-0" aria-hidden="true" />
                            <span>Xóa thẻ</span>
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Card Name & Masked numbers */}
              <div className="relative z-10 my-3">
                <p className="truncate text-base font-semibold tracking-wide text-[var(--foreground)]">
                  {card.name}
                </p>
                <p className="mt-0.5 font-mono text-[11px] tracking-widest text-[var(--text-muted)]">
                  ••••  ••••  ••••  ••••
                </p>
              </div>

              {/* Main Debt / Balance */}
              <div className="relative z-10 border-t border-[var(--border)] pt-2.5">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                      {hasCredit ? "Dư có (trả trước)" : "Tổng dư nợ hiện tại"}
                    </span>
                    <span className="text-xl font-bold tabular-nums text-[var(--foreground)]">
                      {formatAmount(hasCredit ? card.creditBalance : card.debt)} {currency}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                      Chu kỳ
                    </span>
                    <span className="text-xs font-medium text-[var(--text-secondary)] tabular-nums">
                      Chốt {card.statementClosingDay} · Hạn {card.paymentDueDay}
                    </span>
                  </div>
                </div>

                {/* Credit Limit Utilization Progress Bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mb-1">
                    <span>Đã dùng {utilizationPercent}% hạn mức</span>
                    <span className="tabular-nums font-medium text-[var(--foreground)]">
                      Khả dụng: {formatAmount(card.availableCredit)} {currency}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        utilizationPercent > 80
                          ? "bg-[var(--destructive)]"
                          : utilizationPercent > 50
                            ? "bg-[var(--warning)]"
                            : "bg-[var(--primary)]"
                      }`}
                      style={{ width: `${utilizationPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 p-2.5 sm:p-3">
                <span className="block text-[11px] text-[var(--text-muted)]">Hạn mức thẻ</span>
                <p className="mt-0.5 text-xs sm:text-sm font-semibold tabular-nums text-[var(--foreground)] truncate">
                  {formatAmount(card.limit)} {currency}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 p-2.5 sm:p-3">
                <span className="block text-[11px] text-[var(--text-muted)]">Khả dụng</span>
                <p className="mt-0.5 text-xs sm:text-sm font-semibold tabular-nums text-[var(--success)] truncate">
                  {formatAmount(card.availableCredit)} {currency}
                </p>
              </div>

              <div className="col-span-2 sm:col-span-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 p-2.5 sm:p-3">
                <span className="block text-[11px] text-[var(--text-muted)]">Chờ thanh toán</span>
                <p className="mt-0.5 text-xs sm:text-sm font-semibold tabular-nums text-[var(--foreground)] truncate">
                  {formatAmount(card.pendingPayment)} {currency}
                </p>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI (Col 7): Sao kê, Trả góp, Hoạt động & Lịch sử */}
          <div className="flex flex-col gap-4 sm:gap-5 lg:col-span-7">
            {/* 2. Sao kê cần thanh toán (Statement Section) */}
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

          {card.statement && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                card.statement.overdue
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
          )}
        </div>

        {card.statement ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 p-3.5 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xl font-bold tabular-nums text-[var(--foreground)]">
                  {formatAmount(card.statement.amount)} {currency}
                </p>
                <p
                  className={`mt-0.5 text-xs ${
                    card.statement.overdue
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
                        {formatAmount(source.amount)} {currency}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Compact and clean empty state for statement (no disabled full-width button) */
          <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/20 px-3.5 py-2.5 text-xs">
            <span className="flex items-center gap-2 font-medium text-[var(--text-secondary)]">
              <CheckCircle2 className="size-4 text-[var(--success)] shrink-0" aria-hidden="true" />
              Chưa có sao kê cần thanh toán
            </span>
            <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
              Kỳ tới: Ngày {card.statementClosingDay}
            </span>
          </div>
        )}
      </section>

      {/* 3. Kế hoạch trả góp (Installment Plans) */}
      {(canManage || card.installmentPlans.length > 0) && (
        <section
          className="mt-5 border-t border-[var(--border)] pt-4"
          aria-labelledby={`plans-${card.id}`}
        >
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <h3
              id={`plans-${card.id}`}
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
            >
              <CalendarClock size={14} className="text-[var(--warning)]" aria-hidden="true" />
              Kế hoạch trả góp ({card.installmentPlans.length})
            </h3>
            {canManage && (
              <Button type="button" variant="outline" size="sm" onClick={openImportInstallment}>
                <History aria-hidden="true" />
                Nhập khoản cũ
              </Button>
            )}
          </div>
          {card.installmentPlans.length > 0 ? <div className="space-y-2.5">
            {card.installmentPlans.map((plan) => {
              const paid = plan.paidTermCount + plan.installments.filter((item) => item.paid).length;
              const next = plan.installments.find((item) => !item.paid);
              return (
                <div
                  key={plan.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/20 p-3 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-[var(--foreground)] truncate">
                        {plan.description ?? "Giao dịch trả góp"}
                      </p>
                      {plan.origin === "imported" && (
                        <span className="text-[10px] font-medium text-[var(--primary)]">Khoản đã có trước khi dùng app</span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                        {formatAmount(plan.principal)} {currency}
                      </span>
                      {canManage && plan.canDelete && (
                        <ConfirmDelete
                          ariaLabel={`Xóa khoản trả góp ${plan.description ?? "đã nhập"}`}
                          title="Xóa khoản trả góp đã nhập?"
                          description={
                            plan.importBalanceMode === "add_to_balance"
                              ? "Dư nợ đã cộng khi nhập khoản này sẽ được trừ lại. Thao tác chỉ thực hiện được khi chưa có kỳ nào vào sao kê."
                              : "Khoản này sẽ trở lại dư nợ thông thường. Thao tác chỉ thực hiện được khi chưa có kỳ nào vào sao kê."
                          }
                          confirmLabel="Xóa khoản đã nhập"
                          presentation={isDesktop ? "popover" : "sheet"}
                          trigger={
                            <Button
                              type="button"
                              variant="destructiveIcon"
                              size="icon"
                              aria-label={`Xóa khoản trả góp ${plan.description ?? "đã nhập"}`}
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          }
                          onConfirm={() => handleDeleteImportedPlan(plan)}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>
                      Tiến độ: {paid}/{plan.termCount} kỳ · Phí {formatAmount(plan.fee)} {currency}
                    </span>
                    <span className="tabular-nums">
                      {next
                        ? `Kỳ tới: ${formatAmount(next.amount)} ${currency} (${formatIsoDate(next.dueDate)})`
                        : "Đã tất toán"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div> : (
            <p className="py-2 text-xs text-[var(--text-muted)]">
              Chưa có kế hoạch trả góp. Nếu đã trả góp trước khi dùng app, hãy nhập phần còn lại tại đây.
            </p>
          )}
        </section>
      )}

      {/* 4. Hoạt động gần đây (Recent Activities) */}
      <section
        className="mt-5 border-t border-[var(--border)] pt-4"
        aria-labelledby={`activities-${card.id}`}
      >
        <div className="flex items-center justify-between mb-2.5">
          <h3
            id={`activities-${card.id}`}
            className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
          >
            Hoạt động gần đây
          </h3>
          {card.activities.some((a) => a.installmentEligible) && (
            <span className="text-[11px] text-[var(--text-muted)]">
              Chạm để quản lý
            </span>
          )}
        </div>

        {card.activities.length ? (
          <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/15 px-3">
            {card.activities.map((activity) => {
              const rowContent = (
                <>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`grid size-8 shrink-0 place-items-center rounded-lg ${
                        activity.purpose === "credit_card_refund"
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
                      className={`text-xs font-semibold tabular-nums ${
                        activity.purpose === "credit_card_refund"
                          ? "text-[var(--success)]"
                          : "text-[var(--foreground)]"
                      }`}
                    >
                      {activity.purpose === "credit_card_refund" ||
                      activity.purpose === "credit_card_payment"
                        ? "−"
                        : "+"}
                      {formatAmount(activity.amount)} {currency}
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

              if (activity.installmentEligible) {
                return (
                  <DropdownMenu
                    key={activity.id}
                    open={isMenuOpen}
                    onOpenChange={(open) =>
                      setMenuActivityId(open ? activity.id : null)
                    }
                  >
                    <SpotlightTrigger
                      open={isMenuOpen}
                      onOpenChange={(open) =>
                        setMenuActivityId(open ? activity.id : null)
                      }
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
                      className="w-52 !rounded-xl p-1.5 border border-[var(--border)] bg-[var(--surface)] shadow-none"
                    >
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
            })}
          </div>
        ) : (
          <p className="py-4 text-center text-xs text-[var(--text-muted)]">
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
        )}

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
      <Sheet
        open={refundOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setRefundOpen(false);
            setRefundAmount("");
            setRefundTransactionId("");
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
              title="Ghi nhận hoàn tiền"
              description={`Chọn giao dịch gốc và nhập số tiền được hoàn vào thẻ ${card.name}.`}
            />

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain pb-2">
              {/* Context info card */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 p-3 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <span className="text-[var(--text-muted)]">Thẻ tín dụng</span>
                  <p className="font-semibold text-[var(--foreground)]">{card.name}</p>
                </div>
                <div className="text-right space-y-0.5">
                  <span className="text-[var(--text-muted)]">Dư nợ hiện tại</span>
                  <p className="font-semibold tabular-nums text-[var(--foreground)]">
                    {formatAmount(hasCredit ? card.creditBalance : card.debt)} {currency}
                    {hasCredit ? " (Dư có)" : ""}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Select
                  label="Giao dịch gốc"
                  value={refundTransactionId}
                  onValueChange={(value) => {
                    setRefundTransactionId(value);
                    setRefundAmount("");
                  }}
                  options={card.refundCandidates.map((activity) => ({
                    value: activity.id,
                    label: `${activity.description ?? "Chi tiêu thẻ"} · ${formatIsoDate(activity.date)} · còn ${formatAmount(activity.refundableAmount)} ${currency}`,
                  }))}
                  required
                />
                <MoneyInput
                  label={`Số tiền hoàn (${currency})`}
                  value={refundAmount}
                  onValueChange={setRefundAmount}
                  placeholder="0"
                  required
                />
                {selectedRefundActivity && refundAmount && new Decimal(refundAmount || 0).gt(selectedRefundActivity.refundableAmount) && (
                  <p role="alert" className="flex items-center gap-1.5 text-xs text-[var(--destructive)]">
                    <AlertCircle className="size-3.5" aria-hidden="true" />
                    Chỉ còn có thể hoàn {formatAmount(selectedRefundActivity.refundableAmount)} {currency}.
                  </p>
                )}

                <Input
                  label="Ngày ghi nhận hoàn"
                  type="date"
                  value={businessDate}
                  readOnly
                />
              </div>

              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                Khoản hoàn sẽ giảm dư nợ và đảo đúng phần phân bổ ví của giao dịch gốc. Nếu thẻ đã được thanh toán, khoản hoàn có thể tạo số dư có.
              </p>
            </div>

            <SheetFooter
              className="pb-[max(1.25rem,env(safe-area-inset-bottom))] px-4 sm:px-6 py-3 sm:py-3.5"
              onCancel={() => {
                setRefundOpen(false);
                setRefundAmount("");
                setRefundTransactionId("");
              }}
              cancelLabel="Hủy"
              submitLabel={pending ? "Đang ghi nhận..." : "Xác nhận hoàn tiền"}
              isSubmitting={pending}
              submitDisabled={
                pending ||
                !refundTransactionId ||
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
              description="Chuyển giao dịch thẻ thành trả góp nhiều kỳ."
            />

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain pb-2">
              {installmentTarget && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 p-3 space-y-1 text-xs">
                  <span className="text-[var(--text-muted)]">Giao dịch gốc</span>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-[var(--foreground)] truncate">
                      {installmentTarget.description ?? "Chi tiêu thẻ"}
                    </p>
                    <span className="font-bold tabular-nums text-[var(--foreground)]">
                      {formatAmount(installmentTarget.amount)} {currency}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Ngày giao dịch: {formatIsoDate(installmentTarget.date)}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <Select
                  label="Số kỳ trả góp"
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
                    label={`Phí chuyển đổi trả góp (${currency})`}
                    value={feeAmount}
                    onValueChange={setFeeAmount}
                    placeholder="0"
                  />
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    Tùy chọn. Để trống hoặc nhập 0 nếu là trả góp 0% phí.
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                Sau khi đăng ký trả góp thành công, số tiền gốc và phí sẽ được phân bổ đều vào các kỳ sao kê tiếp theo. Giao dịch trả góp không thể hủy trực tiếp.
              </p>
            </div>

            <SheetFooter
              className="pb-[max(1.25rem,env(safe-area-inset-bottom))] px-4 sm:px-6 py-3 sm:py-3.5"
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

      <Sheet open={importOpen} onOpenChange={(nextOpen) => !pending && setImportOpen(nextOpen)}>
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
              importOngoingInstallment();
            }}
          >
            <SheetHeader
              icon={History}
              title="Nhập khoản trả góp đang có"
              description="Ghi nhận phần còn lại mà không tạo chi tiêu giả trong quá khứ."
            />
            <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-2 overscroll-contain sm:p-5">
              <Input
                label="Tên khoản trả góp"
                value={importDescription}
                onChange={(event) => setImportDescription(event.target.value)}
                placeholder="Ví dụ: Điện thoại"
                maxLength={120}
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Tổng số kỳ"
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={60}
                  value={importTermCount}
                  onChange={(event) => setImportTermCount(event.target.value)}
                  required
                  aria-invalid={Number(importTermCount) < 2 || Number(importTermCount) > 60}
                />
                <Input
                  label="Số kỳ đã trả"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={Math.max(Number(importTermCount) - 1, 0)}
                  value={importPaidTermCount}
                  onChange={(event) => setImportPaidTermCount(event.target.value)}
                  required
                  aria-invalid={Number(importPaidTermCount) < 0 || Number(importPaidTermCount) >= Number(importTermCount)}
                />
              </div>
              <div>
                <MoneyInput
                  label={`Dư nợ trả góp còn lại (${currency})`}
                  value={importRemainingAmount}
                  onValueChange={setImportRemainingAmount}
                  placeholder="0"
                  required
                />
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
                  Nhập cả phần phí còn lại nếu ngân hàng đã tính phí vào dư nợ của gói.
                </p>
              </div>
              <Select
                label="Khoản này đã được ghi vào dư nợ thẻ chưa?"
                value={importBalanceMode}
                onValueChange={(value) => setImportBalanceMode(value as typeof importBalanceMode)}
                options={[
                  { value: "included_opening_debt", label: "Đã nằm trong dư nợ ban đầu" },
                  { value: "add_to_balance", label: "Chưa ghi nhận — cộng thêm vào dư nợ" },
                ]}
                required
              />
              <p className="-mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
                {importBalanceMode === "included_opening_debt"
                  ? "App chỉ phân loại lại phần dư nợ ban đầu chưa thanh toán và chưa vào sao kê; tổng dư nợ không đổi."
                  : "App tăng dư nợ thẻ nhưng không tính khoản này thành chi tiêu mới trong báo cáo."}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Select
                    label="Ví chịu trách nhiệm thanh toán"
                    value={importFundingWalletId}
                    onValueChange={setImportFundingWalletId}
                    options={fundingWallets.map((wallet) => ({ value: wallet.id, label: wallet.name }))}
                    required
                  />
                  {importBalanceMode === "included_opening_debt" && (
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                      Có thể phân loại: {formatAmount(selectedImportableOpeningDebt)} {currency}
                    </p>
                  )}
                </div>
                <Select
                  label="Bắt đầu từ sao kê"
                  value={importFirstStatementDate}
                  onValueChange={setImportFirstStatementDate}
                  options={importStatementOptions}
                  required
                />
              </div>
              {importPreview && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 p-3 text-xs text-[var(--text-secondary)]" aria-live="polite">
                  <p className="font-medium text-[var(--foreground)]">
                    Còn {importPreview.remainingTerms} kỳ · đã trả {importPaidTermCount}/{importTermCount} kỳ
                  </p>
                  <p className="mt-1 tabular-nums">
                    Kỳ thường {formatAmount(importPreview.regularAmount)} {currency}
                    {importPreview.finalAmount !== importPreview.regularAmount
                      ? ` · Kỳ cuối ${formatAmount(importPreview.finalAmount)} ${currency}`
                      : ""}
                  </p>
                </div>
              )}
              {importBalanceMode === "included_opening_debt" && (
                <p className={`flex gap-2 text-[11px] leading-relaxed ${exceedsImportableOpeningDebt ? "text-[var(--destructive)]" : "text-[var(--warning)]"}`} role={exceedsImportableOpeningDebt ? "alert" : undefined}>
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {exceedsImportableOpeningDebt
                    ? "Dư nợ ban đầu chưa vào sao kê của ví này không đủ. Hãy giảm số tiền, chọn ví khác hoặc chọn cộng thêm vào dư nợ."
                    : "Nếu dư nợ ban đầu đã lên sao kê hoặc được thanh toán, app sẽ chặn để tránh sửa lịch sử tài chính."}
                </p>
              )}
            </div>
            <SheetFooter
              className="px-4 py-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-3.5"
              onCancel={() => setImportOpen(false)}
              cancelLabel="Hủy"
              submitLabel={pending ? "Đang xử lý..." : "Nhập khoản trả góp"}
              isSubmitting={pending}
              submitDisabled={
                pending ||
                !importDescription.trim() ||
                !importPreview ||
                !importFundingWalletId ||
                !importFirstStatementDate ||
                exceedsImportableOpeningDebt
              }
            />
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
      </Card>

      {canManage && <ConfirmDelete
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        trigger={null}
        ariaLabel={`Xóa thẻ ${card.name}`}
        title={`Xóa thẻ “${card.name}”?`}
        description={
          !card.hasApprovedTransactions ? (
            hasDebt ? (
              `Thẻ chưa có giao dịch nào. Khoản dư nợ ban đầu (${formatAmount(card.debt)} ${currency}) sẽ bị hủy cùng với thẻ.`
            ) : (
              "Thẻ chưa có giao dịch nào. Bạn có chắc chắn muốn xóa thẻ này không?"
            )
          ) : hasDebt ? (
            <span className="text-destructive block">
              Thẻ vẫn còn dư nợ {formatAmount(card.debt)} {currency}. Bạn cần thanh toán hết toàn bộ dư nợ trước khi xóa thẻ.
            </span>
          ) : hasCredit ? (
            <span className="text-destructive block">
              Thẻ còn số dư có {formatAmount(card.creditBalance)} {currency}. Bạn cần sử dụng hết số dư trước khi xóa thẻ.
            </span>
          ) : pendingDecimal.gt(0) ? (
            <span className="text-destructive block">
              Thẻ còn khoản thanh toán đang chờ xử lý ({formatAmount(card.pendingPayment)} {currency}). Vui lòng chờ thanh toán hoàn tất trước khi xóa.
            </span>
          ) : (
            "Thẻ sẽ bị xóa khỏi danh sách hoạt động. Toàn bộ lịch sử giao dịch đã phát sinh trước đây vẫn được bảo lưu nguyên vẹn."
          )
        }
        confirmLabel="Xóa thẻ"
        confirmDisabled={
          (card.hasApprovedTransactions && (hasDebt || hasCredit)) ||
          pendingDecimal.gt(0) ||
          pending
        }
        disabled={pending}
        presentation={isDesktop ? "popover" : "sheet"}
        anchor={cardMenuTriggerRef}
        onConfirm={handleDeleteCard}
      />}
    </>
  );
}

export function CreditCardOverview(props: {
  workspaceId: string;
  currency: string;
  businessDate: string;
  cards: CreditCardOverviewItem[];
  canManage: boolean;
  canApprove: boolean;
  fundingWallets: FundingWallet[];
}) {
  const [expandedCardId, setExpandedCardId] = useState<string | null>(() => {
    const priority = props.cards.find((card) => card.statement?.overdue)
      ?? props.cards.find((card) => card.statement)
      ?? props.cards[0];
    return priority?.id ?? null;
  });

  return (
    <section className="space-y-4" aria-label="Danh sách thẻ tín dụng">
      {props.cards.length ? (
        props.cards.map((card) => (
          <CreditCardPanel
            key={card.id}
            {...props}
            card={card}
            expanded={expandedCardId === card.id}
            onToggle={() => setExpandedCardId((current) => current === card.id ? null : card.id)}
          />
        ))
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
    </section>
  );
}
