import Decimal from "decimal.js";
import { ArrowLeft, CheckCircle2, Clock3, CreditCard, ReceiptText, Wallet, WalletCards } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button, Card, PageContainer } from "@/components/base";
import { formatAmount } from "@/lib/format";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

export default async function CreditCardStatementPage({
  params,
}: {
  params: Promise<{ cardId: string; statementId: string }>;
}) {
  const { cardId, statementId } = await params;
  const session = await requireAcceptedLegalPageSession();
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) redirect("/overview");

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id, workspaceId, status: "active", deletedAt: null },
    select: { workspace: { select: { baseCurrency: true } } },
  });
  if (!membership) redirect("/overview");

  const statement = await prisma.creditCardStatement.findFirst({
    where: {
      id: statementId,
      cardWalletId: cardId,
      workspaceId,
      card: { wallet: { deletedAt: null } },
    },
    include: {
      card: { select: { wallet: { select: { name: true } } } },
      items: {
        include: {
          obligationEntry: {
            include: {
              fundingWallet: { select: { name: true } },
              transaction: {
                select: { id: true, description: true, date: true, purpose: true, type: true },
              },
            },
          },
          installment: {
            select: {
              installmentNo: true,
              plan: { select: { termCount: true, description: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      payments: {
        where: { deletedAt: null, workflowStatus: { not: "rejected" } },
        select: {
          id: true,
          amount: true,
          date: true,
          workflowStatus: true,
          creditCardPaymentSources: {
            select: { sourceWalletId: true, amount: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!statement) notFound();

  const currency = membership.workspace.baseCurrency;
  const approvedPayments = statement.payments.filter((p) => p.workflowStatus === "approved");
  const totalPaid = approvedPayments.reduce(
    (sum, p) => sum.plus(p.amount.toString()),
    new Decimal(0),
  );
  const remainingDebt =
    statement.status === "paid"
      ? new Decimal(0)
      : Decimal.max(
          new Decimal(statement.totalAmount.toString()).minus(totalPaid),
          0,
        );
  const isTrulyPaid = statement.status === "paid" && statement.paidAt !== null;
  const isRolledOver = statement.status === "paid" && statement.paidAt === null;
  const isPartiallyPaid =
    !isTrulyPaid && !isRolledOver && totalPaid.gt(0) && remainingDebt.gt(0);

  const grossByWalletId = new Map<string, { name: string; amount: Decimal }>();
  for (const item of statement.items) {
    const walletId = item.obligationEntry.fundingWalletId;
    const walletName = item.obligationEntry.fundingWallet.name;
    const current = grossByWalletId.get(walletId);
    grossByWalletId.set(walletId, {
      name: walletName,
      amount: (current?.amount ?? new Decimal(0)).plus(item.amount.toString()),
    });
  }

  const paidByWalletId = new Map<string, Decimal>();
  let unattributedPaid = new Decimal(0);
  for (const payment of approvedPayments) {
    let sourcesSum = new Decimal(0);
    for (const source of payment.creditCardPaymentSources) {
      const amt = new Decimal(source.amount.toString());
      sourcesSum = sourcesSum.plus(amt);
      if (grossByWalletId.has(source.sourceWalletId)) {
        paidByWalletId.set(
          source.sourceWalletId,
          (paidByWalletId.get(source.sourceWalletId) ?? new Decimal(0)).plus(amt),
        );
      } else {
        unattributedPaid = unattributedPaid.plus(amt);
      }
    }
    const paymentAmt = new Decimal(payment.amount.toString());
    if (paymentAmt.gt(sourcesSum)) {
      unattributedPaid = unattributedPaid.plus(paymentAmt.minus(sourcesSum));
    }
  }

  let excessPaidPool = unattributedPaid;
  const netByWalletId = new Map<string, { name: string; amount: Decimal }>();
  for (const [walletId, entry] of grossByWalletId) {
    const paidForWallet = paidByWalletId.get(walletId) ?? new Decimal(0);
    const walletNet = entry.amount.minus(paidForWallet);
    if (walletNet.lt(0)) {
      excessPaidPool = excessPaidPool.plus(walletNet.abs());
      netByWalletId.set(walletId, { name: entry.name, amount: new Decimal(0) });
    } else {
      netByWalletId.set(walletId, {
        name: entry.name,
        amount: walletNet,
      });
    }
  }

  const byWallet = new Map<string, Decimal>();
  for (const [, entry] of netByWalletId) {
    if (statement.status === "paid") {
      byWallet.set(entry.name, new Decimal(0));
      continue;
    }
    let netAmount = entry.amount;
    if (excessPaidPool.gt(0) && netAmount.gt(0)) {
      const deduct = Decimal.min(netAmount, excessPaidPool);
      netAmount = netAmount.minus(deduct);
      excessPaidPool = excessPaidPool.minus(deduct);
    }
    byWallet.set(
      entry.name,
      (byWallet.get(entry.name) ?? new Decimal(0)).plus(netAmount),
    );
  }

  return (
    <PageContainer>
      <div className="space-y-3.5 md:space-y-4">
        {/* Header & Back Navigation */}
        <header className="flex items-start justify-between gap-2.5 md:items-center">
          <div className="flex min-w-0 items-start gap-2.5 md:gap-3">
            <Button
              variant="outline"
              size="icon"
              className="size-8 shrink-0 md:size-9"
              render={
                <Link
                  href={`/credit-cards/${cardId}`}
                  aria-label="Quay lại chi tiết thẻ"
                  title="Quay lại chi tiết thẻ"
                />
              }
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                <p className="break-words text-xs font-medium leading-snug text-[var(--text-muted)]">
                  {statement.card.wallet.name}
                </p>
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)] md:px-2.5 md:text-[11px]">
                  {isTrulyPaid ? (
                    <CheckCircle2 className="size-3 text-[var(--success)]" aria-hidden="true" />
                  ) : isPartiallyPaid ? (
                    <Clock3 className="size-3 text-[var(--primary)]" aria-hidden="true" />
                  ) : (
                    <Clock3 className="size-3 text-[var(--warning)]" aria-hidden="true" />
                  )}
                  <span>
                    {isTrulyPaid
                      ? "Đã thanh toán"
                      : isRolledOver
                        ? "Đã gộp sang kỳ sau"
                        : isPartiallyPaid
                          ? "Đã trả một phần"
                          : "Chưa thanh toán"}
                  </span>
                </span>
              </div>
              <h1 className="mt-0.5 break-words text-base font-semibold leading-snug text-[var(--foreground)] md:text-xl">
                Chi tiết sao kê kỳ này
              </h1>
              <p className="mt-0.5 break-words text-[11px] leading-snug text-[var(--text-secondary)] md:text-sm">
                Kỳ {formatDate(statement.cycleStartDate)} – {formatDate(statement.cycleEndDate)} · Hạn {formatDate(statement.dueDate)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="size-8 md:size-9"
              render={
                <Link
                  href="/credit-cards"
                  aria-label="Danh sách thẻ"
                  title="Danh sách thẻ"
                />
              }
            >
              <WalletCards size={15} aria-hidden="true" />
            </Button>
            <Button
              variant="default"
              size="icon"
              className="size-8 md:size-9"
              render={
                <Link
                  href={`/credit-cards/${cardId}`}
                  aria-label="Quản lý & Thanh toán thẻ"
                  title="Quản lý & Thanh toán thẻ"
                />
              }
            >
              <CreditCard size={15} aria-hidden="true" />
            </Button>
          </div>
        </header>

        {/* 1 Clean Top Summary Strip */}
        <Card
          as="section"
          className="p-3.5 md:p-5"
          aria-labelledby="statement-summary"
        >
          <h2 id="statement-summary" className="sr-only">
            Tóm tắt sao kê kỳ này
          </h2>

          {/* Mobile Hero Metric (<768px): Còn cần thanh toán */}
          <div className="flex items-baseline justify-between gap-2 md:hidden">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Còn cần thanh toán
            </span>
            <p
              className={cn(
                "text-xl font-bold tabular-nums tracking-tight",
                remainingDebt.gt(0) ? "text-[var(--warning)]" : "text-[var(--success)]",
              )}
            >
              {formatAmount(remainingDebt)}{" "}
              <span className="text-xs font-semibold text-[var(--text-secondary)]">{currency}</span>
            </p>
          </div>

          {/* Mobile 2-Col Secondary Strip (<768px) & Desktop 3-Col Summary Strip (md:grid) */}
          <div className="mt-2.5 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-2.5 md:mt-0 md:grid-cols-3 md:gap-0 md:divide-x md:divide-[var(--border)] md:border-t-0 md:pt-0">
            <div className="min-w-0 md:flex md:flex-col md:items-start md:justify-center md:pr-5">
              <span className="block text-[11px] font-medium text-[var(--text-muted)] md:text-xs md:text-[var(--text-secondary)]">
                Tổng sao kê kỳ này
              </span>
              <p className="mt-0.5 text-sm font-bold tabular-nums tracking-tight text-[var(--foreground)] md:mt-1 md:text-2xl">
                {formatAmount(statement.totalAmount)}{" "}
                <span className="text-[11px] font-semibold text-[var(--text-secondary)] md:text-xs">{currency}</span>
              </p>
              <span className="mt-1 hidden text-[11px] text-[var(--text-muted)] md:block">
                Chốt ngày {formatDate(statement.cycleEndDate)}
              </span>
            </div>

            <div className="min-w-0 border-l border-[var(--border)] pl-3 md:flex md:flex-col md:items-start md:justify-center md:border-l-0 md:px-5">
              <span className="block text-[11px] font-medium text-[var(--text-muted)] md:text-xs md:text-[var(--text-secondary)]">
                Đã thanh toán
              </span>
              <p className="mt-0.5 text-sm font-bold tabular-nums tracking-tight text-[var(--success)] md:mt-1 md:text-2xl">
                {formatAmount(totalPaid)}{" "}
                <span className="text-[11px] font-semibold text-[var(--text-secondary)] md:text-xs">{currency}</span>
              </p>
              <span className="mt-1 hidden text-[11px] text-[var(--text-muted)] md:block">
                {approvedPayments.length > 0
                  ? `${approvedPayments.length} lần thanh toán đã duyệt`
                  : "Chưa phát sinh thanh toán"}
              </span>
            </div>

            <div className="hidden md:flex md:flex-col md:items-start md:justify-center md:pl-5">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Còn cần thanh toán
              </span>
              <p
                className={cn(
                  "mt-1 text-2xl font-bold tabular-nums tracking-tight",
                  remainingDebt.gt(0) ? "text-[var(--warning)]" : "text-[var(--success)]",
                )}
              >
                {formatAmount(remainingDebt)}{" "}
                <span className="text-xs font-semibold text-[var(--text-secondary)]">{currency}</span>
              </p>
              <span className="mt-1 text-[11px] text-[var(--text-muted)]">
                Hạn thanh toán {formatDate(statement.dueDate)}
              </span>
            </div>
          </div>

          {byWallet.size > 0 && (
            <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3 md:mt-4 md:space-y-2.5 md:pt-4">
              <p className="text-[11px] font-semibold text-[var(--text-secondary)] md:text-xs">
                Phân bổ dư nợ sao kê theo ví nguồn
              </p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3 lg:grid-cols-3">
                {[...byWallet].map(([name, amount]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-xs md:px-3.5 md:py-2.5 md:text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Wallet className="size-3.5 shrink-0 text-[var(--primary)] md:size-4" aria-hidden="true" />
                      <span className="break-words font-medium leading-snug text-[var(--foreground)]">{name}</span>
                    </div>
                    <span className="shrink-0 font-bold tabular-nums text-[var(--foreground)]">
                      {formatAmount(Decimal.max(amount, 0))} {currency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Giao dịch trong kỳ sao kê */}
        <Card as="section" className="gap-3.5 p-3.5 md:gap-4 md:p-5" aria-labelledby="statement-items">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ReceiptText className="size-4 text-[var(--primary)]" aria-hidden="true" />
              <h2 id="statement-items" className="text-sm font-semibold text-[var(--foreground)] md:text-base">
                Giao dịch trong kỳ sao kê ({statement.items.length})
              </h2>
            </div>
          </div>

          {/* Mobile List (<768px) */}
          <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)] md:hidden">
            {statement.items.map((item) => {
              const transaction = item.obligationEntry.transaction;
              const label =
                transaction?.description ??
                item.installment?.plan.description ??
                (transaction?.type === "transfer"
                  ? "Chuyển tiền từ thẻ"
                  : item.isCarry
                    ? "Dư nợ chuyển từ kỳ trước"
                    : "Điều chỉnh dư nợ thẻ");

              return (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 p-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                      {label}
                    </p>
                    <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-muted)]">
                      {transaction ? formatDate(transaction.date) : formatDate(statement.cycleStartDate)} ·{" "}
                      {item.obligationEntry.fundingWallet.name}
                      {item.installment
                        ? ` · Trả góp kỳ ${item.installment.installmentNo}/${item.installment.plan.termCount}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-bold tabular-nums",
                      item.amount.isNegative() ? "text-[var(--success)]" : "text-[var(--foreground)]",
                    )}
                  >
                    {item.amount.isNegative() ? "−" : "+"}
                    {formatAmount(item.amount.abs())} {currency}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Tablet & Desktop Table (md:block) */}
          <div className="hidden overflow-hidden rounded-xl border border-[var(--border)] md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--surface-secondary)] text-xs font-semibold text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-2.5">Nội dung giao dịch</th>
                  <th className="px-4 py-2.5">Ví nguồn trích trả</th>
                  <th className="px-4 py-2.5">Ngày ghi nhận</th>
                  <th className="px-4 py-2.5 text-right">Số tiền sao kê</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
                {statement.items.map((item) => {
                  const transaction = item.obligationEntry.transaction;
                  const label =
                    transaction?.description ??
                    item.installment?.plan.description ??
                    (transaction?.type === "transfer"
                      ? "Chuyển tiền từ thẻ"
                      : item.isCarry
                        ? "Dư nợ chuyển từ kỳ trước"
                        : "Điều chỉnh dư nợ thẻ");

                  return (
                    <tr key={item.id} className="transition-colors hover:bg-[var(--surface-secondary)]/50">
                      <td className="px-4 py-3">
                        <p className="break-words font-semibold leading-snug text-[var(--foreground)]">{label}</p>
                        {item.installment && (
                          <span className="mt-0.5 inline-block text-xs text-[var(--text-muted)]">
                            Trả góp kỳ {item.installment.installmentNo}/${item.installment.plan.termCount}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] px-2 py-0.5 font-medium text-[var(--foreground)]">
                          <Wallet className="size-3 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                          <span className="break-words">{item.obligationEntry.fundingWallet.name}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-[var(--text-secondary)]">
                        {transaction ? formatDate(transaction.date) : formatDate(statement.cycleStartDate)}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right font-bold tabular-nums",
                          item.amount.isNegative() ? "text-[var(--success)]" : "text-[var(--foreground)]",
                        )}
                      >
                        {item.amount.isNegative() ? "−" : "+"}
                        {formatAmount(item.amount.abs())} {currency}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Lịch sử thanh toán sao kê */}
        {statement.payments.length > 0 && (
          <Card as="section" className="gap-3 p-3.5 md:p-5" aria-labelledby="statement-payments">
            <div className="flex items-center gap-2">
              <WalletCards className="size-4 text-[var(--primary)]" aria-hidden="true" />
              <h2 id="statement-payments" className="text-sm font-semibold text-[var(--foreground)] md:text-base">
                Lịch sử thanh toán sao kê ({statement.payments.length})
              </h2>
            </div>
            <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              {statement.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-3 p-3.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium leading-snug text-[var(--foreground)]">
                      Thanh toán sao kê ngày {formatDate(payment.date)}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {payment.workflowStatus === "approved" ? "Đã duyệt" : "Đang chờ duyệt"}
                    </p>
                  </div>
                  <span className="shrink-0 font-bold tabular-nums text-[var(--success)]">
                    {formatAmount(payment.amount)} {currency}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
