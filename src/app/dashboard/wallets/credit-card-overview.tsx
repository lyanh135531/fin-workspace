"use client";

import Decimal from "decimal.js";
import { CreditCard, RotateCcw, WalletCards } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { payCreditCardAction, refundCreditCardExpenseAction } from "@/app/dashboard/actions";
import { Button, Card, Input, MoneyInput, Select } from "@/components/base";
import { formatAmount } from "@/lib/format";

type FundingShare = { walletId: string; walletName: string; outstanding: string };
type CardActivity = {
  id: string;
  originalTransactionId: string | null;
  purpose: "standard" | "credit_card_payment" | "credit_card_refund";
  description: string | null;
  amount: string;
  date: string;
  status: "pending" | "scheduled" | "approved" | "rejected";
  refundableAmount?: string;
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
  fundingShares: FundingShare[];
  activities: CardActivity[];
};

function activityLabel(activity: CardActivity) {
  if (activity.purpose === "credit_card_payment") return "Thanh toán";
  if (activity.purpose === "credit_card_refund") return "Hoàn tiền";
  return "Chi tiêu";
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
  const [pending, startTransition] = useTransition();
  const [paymentMode, setPaymentMode] = useState<"closed" | "custom">("closed");
  const [customAmount, setCustomAmount] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [sources, setSources] = useState([{ walletId: card.defaultFundingWalletId, amount: "" }]);
  const [refundTarget, setRefundTarget] = useState<CardActivity | null>(null);
  const [refundAmount, setRefundAmount] = useState("");

  const walletOptions = useMemo(
    () => card.fundingShares.map((share) => ({ value: share.walletId, label: `${share.walletName} · còn ${formatAmount(share.outstanding)} ${currency}` })),
    [card.fundingShares, currency],
  );

  function runPayment(paymentSources: Array<{ walletId: string; amount: string }>) {
    startTransition(async () => {
      const result = await payCreditCardAction(workspaceId, {
        cardWalletId: card.id,
        date: businessDate,
        sources: paymentSources,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Không thể thanh toán thẻ.");
        return;
      }
      toast.success(result.status === "approved" ? "Đã thanh toán thẻ." : "Đã tạo thanh toán chờ xử lý.");
      setPaymentMode("closed");
      setCustomAmount("");
    });
  }

  function submitCustomPayment() {
    const paymentSources = advanced
      ? sources.filter((source) => source.walletId && new Decimal(source.amount || 0).gt(0))
      : [{ walletId: card.defaultFundingWalletId, amount: customAmount }];
    if (!paymentSources.length) return toast.error("Nhập ít nhất một nguồn thanh toán.");
    runPayment(paymentSources);
  }

  function submitRefund() {
    if (!refundTarget || !new Decimal(refundAmount || 0).gt(0)) return;
    startTransition(async () => {
      const result = await refundCreditCardExpenseAction(workspaceId, {
        originalTransactionId: refundTarget.id,
        amount: refundAmount,
        date: businessDate,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Không thể hoàn tiền.");
        return;
      }
      toast.success(result.status === "approved" ? "Đã ghi nhận hoàn tiền." : "Đã tạo hoàn tiền chờ duyệt.");
      setRefundTarget(null);
      setRefundAmount("");
    });
  }

  const fullPaymentSources = card.fundingShares
    .filter((share) => new Decimal(share.outstanding).gt(0))
    .map((share) => ({ walletId: share.walletId, amount: share.outstanding }));
  const payableDebt = Decimal.max(new Decimal(card.debt).minus(card.pendingPayment), 0);

  return (
    <Card as="article" className="gap-0 p-5 md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <CreditCard size={20} className="text-[var(--primary)]" aria-hidden="true" />
            <h3 className="truncate text-base font-semibold text-[var(--foreground)]">{card.name}</h3>
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            {new Decimal(card.creditBalance).gt(0) ? "Dư có" : "Dư nợ"}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--foreground)]">
            {formatAmount(new Decimal(card.creditBalance).gt(0) ? card.creditBalance : card.debt)} {currency}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm lg:min-w-96">
          <div><dt className="text-[var(--text-muted)]">Hạn mức</dt><dd className="mt-1 font-medium tabular-nums text-[var(--foreground)]">{formatAmount(card.limit)} {currency}</dd></div>
          <div><dt className="text-[var(--text-muted)]">Khả dụng</dt><dd className="mt-1 font-medium tabular-nums text-[var(--foreground)]">{formatAmount(card.availableCredit)} {currency}</dd></div>
          <div className="col-span-2 border-t border-[var(--border)] pt-3"><dt className="text-[var(--text-muted)]">Thanh toán đang chờ</dt><dd className="mt-1 font-medium tabular-nums text-[var(--foreground)]">{formatAmount(card.pendingPayment)} {currency}</dd></div>
        </dl>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border)] pt-5">
        <Button type="button" disabled={pending || !payableDebt.gt(0) || !fullPaymentSources.length} onClick={() => runPayment(fullPaymentSources)}>
          <WalletCards size={16} aria-hidden="true" /> Thanh toán toàn bộ
        </Button>
        <Button type="button" variant="outline" disabled={pending || !payableDebt.gt(0)} onClick={() => setPaymentMode(paymentMode === "custom" ? "closed" : "custom")}>
          Số tiền tùy chỉnh
        </Button>
      </div>

      {paymentMode === "custom" && (
        <div className="mt-5 space-y-4 border-t border-[var(--border)] pt-5">
          {!advanced ? (
            <MoneyInput label={`Số tiền (${currency})`} value={customAmount} onValueChange={setCustomAmount} required />
          ) : (
            <div className="space-y-3">
              {sources.map((source, index) => (
                <div key={index} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <Select label={`Ví nguồn ${index + 1}`} value={source.walletId} onValueChange={(walletId) => setSources((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, walletId } : item))} options={walletOptions} />
                  <MoneyInput label={`Số tiền (${currency})`} value={source.amount} onValueChange={(amount) => setSources((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, amount } : item))} />
                  {sources.length > 1 && <Button type="button" variant="ghost" onClick={() => setSources((items) => items.filter((_, itemIndex) => itemIndex !== index))}>Bỏ</Button>}
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => setSources((items) => [...items, { walletId: "", amount: "" }])}>Thêm ví nguồn</Button>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="link" onClick={() => setAdvanced((value) => !value)} aria-expanded={advanced}>{advanced ? "Dùng ví mặc định" : "Chia từ nhiều ví"}</Button>
            <Button type="button" disabled={pending || (!advanced && !new Decimal(customAmount || 0).gt(0))} onClick={submitCustomPayment}>Xác nhận thanh toán</Button>
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-[var(--border)] pt-5">
        <h4 className="text-sm font-semibold text-[var(--foreground)]">Hoạt động gần đây</h4>
        <div className="mt-3 divide-y divide-[var(--border)]">
          {card.activities.length ? card.activities.map((activity) => (
            <div key={activity.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--foreground)]">{activity.description ?? activityLabel(activity)}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{activityLabel(activity)} · {activity.date} · {activity.status}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium tabular-nums text-[var(--foreground)]">{activity.purpose === "credit_card_refund" || activity.purpose === "credit_card_payment" ? "−" : "+"}{formatAmount(activity.amount)} {currency}</span>
                {activity.purpose === "standard" && activity.status === "approved" && new Decimal(activity.refundableAmount ?? 0).gt(0) && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setRefundTarget(activity); setRefundAmount(activity.refundableAmount ?? ""); }}>
                    <RotateCcw size={14} aria-hidden="true" /> Hoàn tiền
                  </Button>
                )}
              </div>
            </div>
          )) : <p className="py-6 text-sm text-[var(--text-muted)]">Chưa có giao dịch thẻ.</p>}
        </div>
      </div>

      {refundTarget && (
        <div className="mt-5 space-y-4 border-t border-[var(--border)] pt-5">
          <p className="text-sm text-[var(--text-secondary)]">Hoàn tiền từ “{refundTarget.description ?? "giao dịch thẻ"}”.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <MoneyInput label={`Số tiền hoàn (${currency})`} value={refundAmount} onValueChange={setRefundAmount} required />
            <Input label="Ngày hoàn" type="date" value={businessDate} readOnly />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRefundTarget(null)}>Hủy</Button>
            <Button type="button" disabled={pending || !new Decimal(refundAmount || 0).gt(0)} onClick={submitRefund}>Xác nhận hoàn tiền</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function CreditCardOverview(props: {
  workspaceId: string;
  currency: string;
  businessDate: string;
  cards: CreditCardOverviewItem[];
}) {
  if (!props.cards.length) return null;
  return (
    <section className="mt-8 space-y-4" aria-labelledby="credit-card-overview-heading">
      <div>
        <h2 id="credit-card-overview-heading" className="text-lg font-semibold text-[var(--foreground)]">Thẻ tín dụng</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Theo dõi chi tiêu trả sau, dư nợ và các khoản thanh toán.</p>
      </div>
      {props.cards.map((card) => <CreditCardPanel key={card.id} {...props} card={card} />)}
    </section>
  );
}
