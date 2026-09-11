"use client";

import Decimal from "decimal.js";
import { CalendarClock, CreditCard, RotateCcw, Split, WalletCards } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { addCreditCardRefundAction, payCreditCardAction, registerCreditCardInstallmentAction } from "@/app/dashboard/actions";
import { Button, Card, Input, MoneyInput, Select } from "@/components/base";
import { formatAmount } from "@/lib/format";

type FundingShare = { walletId: string; walletName: string; outstanding: string };
type CardActivity = {
  id: string;
  purpose: "standard" | "credit_card_payment" | "credit_card_refund" | "credit_card_installment_fee";
  description: string | null; amount: string; date: string;
  status: "pending" | "scheduled" | "approved" | "rejected";
  installmentEligible: boolean; installmentPlanId: string | null;
};
type Statement = { id: string; cycleEndDate: string; dueDate: string; amount: string; status: "issued" | "paid" };
type InstallmentPlan = {
  id: string; description: string | null; principal: string; fee: string; termCount: number;
  status: "pending" | "active" | "completed";
  installments: Array<{ number: number; dueDate: string; amount: string; paid: boolean }>;
};
export type CreditCardOverviewItem = {
  id: string; name: string; debt: string; creditBalance: string; limit: string; availableCredit: string;
  pendingPayment: string; defaultFundingWalletId: string; statementClosingDay: number; paymentDueDay: number;
  fundingShares: FundingShare[];
  statement: (Statement & { overdue: boolean; paymentPending: boolean; sources: Array<{ walletId: string; amount: string }> }) | null;
  statements: Statement[]; installmentPlans: InstallmentPlan[]; activities: CardActivity[];
};

function activityLabel(activity: CardActivity) {
  if (activity.purpose === "credit_card_payment") return "Thanh toán sao kê";
  if (activity.purpose === "credit_card_refund") return "Hoàn tiền";
  if (activity.purpose === "credit_card_installment_fee") return "Phí trả góp";
  return activity.installmentPlanId ? "Chi tiêu trả góp" : "Chi tiêu";
}

function CreditCardPanel({ workspaceId, currency, businessDate, card }: { workspaceId: string; currency: string; businessDate: string; card: CreditCardOverviewItem }) {
  const [pending, startTransition] = useTransition();
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [installmentTarget, setInstallmentTarget] = useState<CardActivity | null>(null);
  const [termCount, setTermCount] = useState("3");
  const [feeAmount, setFeeAmount] = useState("0");
  const walletNames = useMemo(() => new Map(card.fundingShares.map((share) => [share.walletId, share.walletName])), [card.fundingShares]);

  function payStatement() {
    if (!card.statement) return;
    startTransition(async () => {
      const result = await payCreditCardAction(workspaceId, { cardWalletId: card.id, statementId: card.statement!.id, date: businessDate, sources: card.statement!.sources });
      if (!result.ok) { toast.error(result.message ?? "Không thể thanh toán sao kê."); return; }
      toast.success(result.status === "approved" ? "Đã thanh toán sao kê." : "Đã tạo thanh toán chờ xử lý.");
    });
  }
  function registerInstallment() {
    if (!installmentTarget) return;
    startTransition(async () => {
      const result = await registerCreditCardInstallmentAction(workspaceId, { transactionId: installmentTarget.id, termCount: Number(termCount), feeAmount });
      if (!result.ok) { toast.error(result.message ?? "Không thể đăng ký trả góp."); return; }
      toast.success("Đã đăng ký trả góp."); setInstallmentTarget(null); setFeeAmount("0");
    });
  }
  function submitRefund() {
    if (!new Decimal(refundAmount || 0).gt(0)) return;
    startTransition(async () => {
      const result = await addCreditCardRefundAction(workspaceId, { cardWalletId: card.id, amount: refundAmount, date: businessDate });
      if (!result.ok) { toast.error(result.message ?? "Không thể hoàn tiền."); return; }
      toast.success(result.status === "approved" ? "Đã ghi nhận hoàn tiền vào thẻ." : "Đã tạo khoản hoàn tiền chờ duyệt."); setRefundOpen(false); setRefundAmount("");
    });
  }

  return <Card as="article" className="gap-0 p-5 md:p-6">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0"><div className="flex items-center gap-3"><CreditCard size={20} className="text-[var(--primary)]" aria-hidden="true" /><h3 className="truncate text-base font-semibold text-[var(--foreground)]">{card.name}</h3></div><p className="mt-4 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{new Decimal(card.creditBalance).gt(0) ? "Dư có" : "Tổng dư nợ"}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--foreground)]">{formatAmount(new Decimal(card.creditBalance).gt(0) ? card.creditBalance : card.debt)} {currency}</p><p className="mt-2 text-xs text-[var(--text-muted)]">Chốt ngày {card.statementClosingDay} · Thanh toán ngày {card.paymentDueDay}</p><div className="mt-4"><Button type="button" variant="outline" onClick={() => setRefundOpen(true)}><RotateCcw size={16} aria-hidden="true" />Ghi nhận hoàn tiền</Button></div></div>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm lg:min-w-96"><div><dt className="text-[var(--text-muted)]">Hạn mức</dt><dd className="mt-1 font-medium tabular-nums text-[var(--foreground)]">{formatAmount(card.limit)} {currency}</dd></div><div><dt className="text-[var(--text-muted)]">Khả dụng</dt><dd className="mt-1 font-medium tabular-nums text-[var(--foreground)]">{formatAmount(card.availableCredit)} {currency}</dd></div><div className="col-span-2 border-t border-[var(--border)] pt-3"><dt className="text-[var(--text-muted)]">Thanh toán đang chờ</dt><dd className="mt-1 font-medium tabular-nums text-[var(--foreground)]">{formatAmount(card.pendingPayment)} {currency}</dd></div></dl>
    </div>

    <section className="mt-5 border-t border-[var(--border)] pt-5" aria-labelledby={`statement-${card.id}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h4 id={`statement-${card.id}`} className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]"><WalletCards size={16} aria-hidden="true" />Sao kê cần thanh toán</h4>{card.statement ? <><p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--foreground)]">{formatAmount(card.statement.amount)} {currency}</p><p className={`mt-1 text-sm ${card.statement.overdue ? "text-[var(--destructive)]" : "text-[var(--text-secondary)]"}`}>Chốt {card.statement.cycleEndDate} · Hạn {card.statement.dueDate}{card.statement.overdue ? " · Quá hạn" : ""}</p></> : <p className="mt-2 text-sm text-[var(--text-muted)]">Chưa có sao kê đã chốt.</p>}</div><Button type="button" disabled={pending || !card.statement || card.statement.paymentPending || !new Decimal(card.statement?.amount ?? 0).gt(0)} onClick={payStatement}><WalletCards size={16} aria-hidden="true" />{card.statement?.paymentPending ? "Đang chờ xử lý" : "Thanh toán sao kê"}</Button></div>
      {card.statement?.sources.length ? <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">{card.statement.sources.map((source) => <div key={source.walletId} className="flex justify-between gap-4 border-t border-[var(--border)] pt-2"><dt className="text-[var(--text-muted)]">{walletNames.get(source.walletId) ?? "Ví nguồn"}</dt><dd className="font-medium tabular-nums text-[var(--foreground)]">{formatAmount(source.amount)} {currency}</dd></div>)}</dl> : null}
    </section>

    {card.installmentPlans.length > 0 && <section className="mt-6 border-t border-[var(--border)] pt-5" aria-labelledby={`plans-${card.id}`}><h4 id={`plans-${card.id}`} className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]"><CalendarClock size={16} aria-hidden="true" />Kế hoạch trả góp</h4><div className="mt-3 space-y-3">{card.installmentPlans.map((plan) => { const paid = plan.installments.filter((item) => item.paid).length; const next = plan.installments.find((item) => !item.paid); return <div key={plan.id} className="border-t border-[var(--border)] pt-3"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><p className="font-medium text-[var(--foreground)]">{plan.description ?? "Giao dịch trả góp"}</p><p className="text-sm tabular-nums text-[var(--foreground)]">{formatAmount(plan.principal)} {currency}</p></div><p className="mt-1 text-xs text-[var(--text-muted)]">Đã trả {paid}/{plan.termCount} kỳ · Phí {formatAmount(plan.fee)} {currency}{next ? ` · Kỳ tiếp theo ${formatAmount(next.amount)} ${currency} hạn ${next.dueDate}` : " · Hoàn tất"}</p></div>; })}</div></section>}

    <section className="mt-6 border-t border-[var(--border)] pt-5" aria-labelledby={`activities-${card.id}`}><h4 id={`activities-${card.id}`} className="text-sm font-semibold text-[var(--foreground)]">Hoạt động gần đây</h4><div className="mt-3 divide-y divide-[var(--border)]">{card.activities.length ? card.activities.map((activity) => <div key={activity.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-medium text-[var(--foreground)]">{activity.description ?? activityLabel(activity)}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{activityLabel(activity)} · {activity.date} · {activity.status}</p></div><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium tabular-nums text-[var(--foreground)]">{activity.purpose === "credit_card_refund" || activity.purpose === "credit_card_payment" ? "−" : "+"}{formatAmount(activity.amount)} {currency}</span>{activity.installmentEligible && <Button type="button" variant="ghost" size="sm" onClick={() => setInstallmentTarget(activity)}><Split size={14} aria-hidden="true" />Chuyển trả góp</Button>}</div></div>) : <p className="py-6 text-sm text-[var(--text-muted)]">Chưa có giao dịch thẻ.</p>}</div></section>

    {installmentTarget && <section className="mt-5 space-y-4 border-t border-[var(--border)] pt-5" aria-label="Đăng ký trả góp"><p className="text-sm text-[var(--text-secondary)]">Chuyển “{installmentTarget.description ?? "giao dịch thẻ"}” thành trả góp. Sau khi xác nhận không thể hủy trực tiếp.</p><div className="grid gap-3 md:grid-cols-2"><Select label="Số kỳ" value={termCount} onValueChange={setTermCount} options={[3, 6, 9, 12, 18, 24].map((value) => ({ value: String(value), label: `${value} tháng` }))} /><MoneyInput label={`Phí một lần (${currency})`} value={feeAmount} onValueChange={setFeeAmount} required /></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setInstallmentTarget(null)}>Hủy</Button><Button type="button" disabled={pending || new Decimal(feeAmount || 0).lt(0)} onClick={registerInstallment}>Xác nhận trả góp</Button></div></section>}
    {refundOpen && <section className="mt-5 space-y-4 border-t border-[var(--border)] pt-5" aria-label="Ghi nhận hoàn tiền vào thẻ"><p className="text-sm text-[var(--text-secondary)]">Nhập khoản tiền đã được hoàn trực tiếp vào {card.name}. Khoản này sẽ giảm dư nợ hoặc tạo dư có nếu lớn hơn dư nợ hiện tại.</p><div className="grid gap-3 md:grid-cols-2"><MoneyInput label={`Số tiền hoàn (${currency})`} value={refundAmount} onValueChange={setRefundAmount} required /><Input label="Ngày hoàn" type="date" value={businessDate} readOnly /></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => { setRefundOpen(false); setRefundAmount(""); }}>Hủy</Button><Button type="button" disabled={pending || !new Decimal(refundAmount || 0).gt(0)} onClick={submitRefund}>Xác nhận hoàn tiền</Button></div></section>}
    {card.statements.length > 0 && <details className="mt-6 border-t border-[var(--border)] pt-5"><summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)]">Lịch sử sao kê</summary><div className="mt-3 divide-y divide-[var(--border)]">{card.statements.map((statement) => <div key={statement.id} className="flex items-center justify-between gap-4 py-2 text-sm"><span className="text-[var(--text-secondary)]">Chốt {statement.cycleEndDate} · hạn {statement.dueDate}</span><span className="tabular-nums text-[var(--foreground)]">{formatAmount(statement.amount)} {currency} · {statement.status === "paid" ? "Đã trả" : "Chưa trả"}</span></div>)}</div></details>}
  </Card>;
}

export function CreditCardOverview(props: { workspaceId: string; currency: string; businessDate: string; cards: CreditCardOverviewItem[] }) {
  return <section className="space-y-4" aria-label="Danh sách thẻ tín dụng">{props.cards.length ? props.cards.map((card) => <CreditCardPanel key={card.id} {...props} card={card} />) : <Card as="div" className="gap-2 p-5"><p className="text-sm font-medium text-[var(--foreground)]">Chưa có thẻ tín dụng</p><p className="text-sm text-[var(--text-secondary)]">Quản trị viên có thể tạo thẻ ngay trên trang này sau khi nhóm có ít nhất một ví tài sản đang hoạt động.</p></Card>}</section>;
}
