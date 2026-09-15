"use client";

import Decimal from "decimal.js";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Info,
  MoreHorizontal,
  RotateCcw,
  Sparkles,
  Split,
  Trash2,
  Wallet,
  WalletCards,
} from "lucide-react";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import {
  addCreditCardRefundAction,
  deleteCreditCardAction,
  payCreditCardAction,
  registerCreditCardInstallmentAction,
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
  description: string | null;
  principal: string;
  fee: string;
  termCount: number;
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
  debt: string;
  creditBalance: string;
  limit: string;
  availableCredit: string;
  pendingPayment: string;
  defaultFundingWalletId: string;
  statementClosingDay: number;
  paymentDueDay: number;
  fundingShares: FundingShare[];
  statement:
    | (Statement & {
        overdue: boolean;
        paymentPending: boolean;
        sources: Array<{ walletId: string; amount: string }>;
      })
    | null;
  statements: Statement[];
  installmentPlans: InstallmentPlan[];
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

function CreditCardPanel({
  workspaceId,
  currency,
  businessDate,
  card,
}: {
  workspaceId: string;
  currency: string;
  businessDate: string;
  card: CreditCardOverviewItem;
}) {
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    desktopSnapshot,
    serverDesktopSnapshot,
  );
  const [pending, startTransition] = useTransition();
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [installmentTarget, setInstallmentTarget] = useState<CardActivity | null>(null);
  const [termCount, setTermCount] = useState("3");
  const [feeAmount, setFeeAmount] = useState("");
  const [menuActivityId, setMenuActivityId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    });
  }

  function handleDeleteCard() {
    startTransition(async () => {
      const result = await deleteCreditCardAction(workspaceId, {
        cardWalletId: card.id,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Không thể xóa thẻ tín dụng.");
        return;
      }
      toast.success(`Đã xóa thẻ “${card.name}”.`);
      setConfirmDelete(false);
    });
  }

  return (
    <>
      <Card as="article" className="gap-0 p-4 sm:p-5 md:p-6 overflow-hidden">
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
                          type="button"
                          aria-label={`Tùy chọn thẻ ${card.name}`}
                          className="grid size-7 place-items-center rounded-full text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)]/80 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                      <DropdownMenuItem
                        onClick={() => setRefundOpen(true)}
                        className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium !rounded-lg cursor-pointer text-[var(--foreground)]"
                      >
                        <RotateCcw className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                        <span>Ghi nhận hoàn tiền</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1 -mx-1 bg-[var(--border)]" />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setConfirmDelete(true)}
                        className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium !rounded-lg cursor-pointer"
                      >
                        <Trash2 className="size-4 shrink-0" aria-hidden="true" />
                        <span>Xóa thẻ</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Card Name & Masked numbers */}
              <div className="relative z-10 my-3">
                <h3 className="truncate text-base font-semibold tracking-wide text-[var(--foreground)]">
                  {card.name}
                </h3>
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
                            ? "bg-amber-500"
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
          <h4
            id={`statement-${card.id}`}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
          >
            <WalletCards size={14} className="text-[var(--primary)]" aria-hidden="true" />
            Sao kê cần thanh toán
          </h4>

          {card.statement && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                card.statement.overdue
                  ? "bg-red-500/15 text-red-500"
                  : card.statement.paymentPending
                    ? "bg-amber-500/15 text-amber-500"
                    : "bg-blue-500/15 text-blue-500"
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
                  Chốt: {card.statement.cycleEndDate} · Hạn: {card.statement.dueDate}
                  {card.statement.overdue && " (Đã quá hạn)"}
                </p>
              </div>

              <Button
                type="button"
                disabled={
                  pending ||
                  card.statement.paymentPending ||
                  !new Decimal(card.statement.amount || 0).gt(0)
                }
                onClick={payStatement}
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
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" aria-hidden="true" />
              Chưa có sao kê cần thanh toán
            </span>
            <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
              Kỳ tới: Ngày {card.statementClosingDay}
            </span>
          </div>
        )}
      </section>

      {/* 3. Kế hoạch trả góp (Installment Plans) */}
      {card.installmentPlans.length > 0 && (
        <section
          className="mt-5 border-t border-[var(--border)] pt-4"
          aria-labelledby={`plans-${card.id}`}
        >
          <h4
            id={`plans-${card.id}`}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2.5"
          >
            <CalendarClock size={14} className="text-amber-500" aria-hidden="true" />
            Kế hoạch trả góp ({card.installmentPlans.length})
          </h4>
          <div className="space-y-2.5">
            {card.installmentPlans.map((plan) => {
              const paid = plan.installments.filter((item) => item.paid).length;
              const next = plan.installments.find((item) => !item.paid);
              return (
                <div
                  key={plan.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/20 p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm text-[var(--foreground)] truncate">
                      {plan.description ?? "Giao dịch trả góp"}
                    </p>
                    <span className="text-sm font-semibold tabular-nums text-[var(--foreground)] shrink-0">
                      {formatAmount(plan.principal)} {currency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>
                      Tiến độ: {paid}/{plan.termCount} kỳ · Phí {formatAmount(plan.fee)} {currency}
                    </span>
                    <span className="tabular-nums">
                      {next
                        ? `Kỳ tới: ${formatAmount(next.amount)} ${currency} (${next.dueDate})`
                        : "Đã tất toán"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. Hoạt động gần đây (Recent Activities) */}
      <section
        className="mt-5 border-t border-[var(--border)] pt-4"
        aria-labelledby={`activities-${card.id}`}
      >
        <div className="flex items-center justify-between mb-2.5">
          <h4
            id={`activities-${card.id}`}
            className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
          >
            Hoạt động gần đây
          </h4>
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
                          ? "bg-emerald-500/15 text-emerald-500"
                          : activity.purpose === "credit_card_payment"
                            ? "bg-blue-500/15 text-blue-500"
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
                          ? `${activity.date} · ${activityLabel(activity)}`
                          : activity.date}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0">
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        activity.purpose === "credit_card_refund"
                          ? "text-emerald-500"
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
              <div
                key={statement.id}
                className="flex items-center justify-between gap-4 py-2 text-xs"
              >
                <span className="text-[var(--text-secondary)]">
                  Chốt {statement.cycleEndDate} · Hạn {statement.dueDate}
                </span>
                <span className="tabular-nums font-medium text-[var(--foreground)]">
                  {formatAmount(statement.amount)} {currency} ·{" "}
                  <span
                    className={
                      statement.status === "paid" ? "text-emerald-500" : "text-amber-500"
                    }
                  >
                    {statement.status === "paid" ? "Đã trả" : "Chưa trả"}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  </div>

      {/* Ghi nhận hoàn tiền - Bottom Sheet trên Mobile, Drawer trên Desktop */}
      <Sheet
        open={refundOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setRefundOpen(false);
            setRefundAmount("");
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
              description={`Nhập số tiền hoàn trực tiếp vào thẻ ${card.name}.`}
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
                <MoneyInput
                  autoFocus
                  label={`Số tiền hoàn (${currency})`}
                  value={refundAmount}
                  onValueChange={setRefundAmount}
                  placeholder="0"
                  required
                />

                <Input
                  label="Ngày ghi nhận hoàn"
                  type="date"
                  value={businessDate}
                  readOnly
                />
              </div>

              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                Khoản tiền này sẽ trực tiếp giảm dư nợ thẻ {card.name}. Nếu số tiền hoàn lớn hơn dư nợ hiện tại, phần chênh lệch sẽ trở thành số dư có (trả trước) cho các chi tiêu tiếp theo.
              </p>
            </div>

            <SheetFooter
              className="pb-[max(1.25rem,env(safe-area-inset-bottom))] px-4 sm:px-6 py-3 sm:py-3.5"
              onCancel={() => {
                setRefundOpen(false);
                setRefundAmount("");
              }}
              cancelLabel="Hủy"
              submitLabel={pending ? "Đang ghi nhận..." : "Xác nhận hoàn tiền"}
              isSubmitting={pending}
              submitDisabled={
                pending || !refundAmount || !new Decimal(refundAmount || 0).gt(0)
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
                    Ngày giao dịch: {installmentTarget.date}
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
      </Card>

      <ConfirmDelete
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        trigger={null}
        ariaLabel={`Xóa thẻ ${card.name}`}
        title={`Xóa thẻ “${card.name}”?`}
        description={
          hasDebt ? (
            <span className="text-destructive block">
              Thẻ vẫn còn dư nợ {formatAmount(card.debt)} {currency}. Bạn cần thanh toán hết toàn bộ dư nợ trước khi xóa thẻ.
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
        confirmDisabled={hasDebt || pendingDecimal.gt(0) || pending}
        disabled={pending}
        presentation={isDesktop ? "popover" : "sheet"}
        onConfirm={handleDeleteCard}
      />
    </>
  );
}

export function CreditCardOverview(props: {
  workspaceId: string;
  currency: string;
  businessDate: string;
  cards: CreditCardOverviewItem[];
}) {
  return (
    <section className="space-y-4" aria-label="Danh sách thẻ tín dụng">
      {props.cards.length ? (
        props.cards.map((card) => <CreditCardPanel key={card.id} {...props} card={card} />)
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
