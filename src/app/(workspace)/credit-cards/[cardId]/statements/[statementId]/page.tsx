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
                select: { id: true, description: true, date: true, purpose: true },
              },
            },
          },
          installment: { select: { installmentNo: true, plan: { select: { termCount: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
      payments: {
        where: { deletedAt: null, workflowStatus: { not: "rejected" } },
        select: { id: true, amount: true, date: true, workflowStatus: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!statement) notFound();

  const currency = membership.workspace.baseCurrency;
  const byWallet = new Map<string, Decimal>();
  for (const item of statement.items) {
    byWallet.set(
      item.obligationEntry.fundingWallet.name,
      (byWallet.get(item.obligationEntry.fundingWallet.name) ?? new Decimal(0)).plus(
        item.amount.toString(),
      ),
    );
  }

  const approvedPayments = statement.payments.filter((p) => p.workflowStatus === "approved");
  const totalPaid = approvedPayments.reduce(
    (sum, p) => sum.plus(p.amount.toString()),
    new Decimal(0),
  );
  const remainingDebt = Decimal.max(
    new Decimal(statement.totalAmount.toString()).minus(totalPaid),
    0,
  );
  const isPartiallyPaid =
    statement.status !== "paid" && totalPaid.gt(0) && remainingDebt.gt(0);

  return (
    <PageContainer>
      <div className="space-y-4 lg:mx-auto lg:max-w-[76rem]">
        {/* Header & Back Navigation */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Button
              variant="outline"
              size="icon"
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
              <div className="flex flex-wrap items-center gap-2">
                <p className="break-words text-xs font-medium leading-snug text-[var(--text-muted)]">
                  {statement.card.wallet.name}
                </p>
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                  {statement.status === "paid" ? (
                    <CheckCircle2 className="size-3.5 text-[var(--success)]" aria-hidden="true" />
                  ) : isPartiallyPaid ? (
                    <Clock3 className="size-3.5 text-[var(--primary)]" aria-hidden="true" />
                  ) : (
                    <Clock3 className="size-3.5 text-[var(--warning)]" aria-hidden="true" />
                  )}
                  <span>
                    {statement.status === "paid"
                      ? "Đã thanh toán"
                      : isPartiallyPaid
                        ? "Đã trả một phần"
                        : "Chưa thanh toán"}
                  </span>
                </span>
              </div>
              <h1 className="mt-0.5 break-words text-xl font-semibold leading-snug text-[var(--foreground)]">
                Chi tiết sao kê kỳ này
              </h1>
              <p className="mt-0.5 break-words text-xs leading-snug text-[var(--text-secondary)] md:text-sm">
                Kỳ sao kê {formatDate(statement.cycleStartDate)} – {formatDate(statement.cycleEndDate)} · Hạn thanh toán {formatDate(statement.dueDate)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              render={
                <Link
                  href="/credit-cards"
                  aria-label="Danh sách thẻ"
                  title="Danh sách thẻ"
                />
              }
            >
              <WalletCards size={16} aria-hidden="true" />
            </Button>
            <Button
              variant="default"
              size="icon"
              render={
                <Link
                  href={`/credit-cards/${cardId}`}
                  aria-label="Quản lý & Thanh toán thẻ"
                  title="Quản lý & Thanh toán thẻ"
                />
              }
            >
              <CreditCard size={16} aria-hidden="true" />
            </Button>
          </div>
        </header>

        {/* 1 Clean Top Summary Strip */}
        <Card
          as="section"
          className="p-4 md:p-5"
          aria-labelledby="statement-summary"
        >
          <h2 id="statement-summary" className="sr-only">
            Tóm tắt sao kê kỳ này
          </h2>
          <div className="divide-y divide-[var(--border)] md:grid md:grid-cols-3 md:divide-x md:divide-y-0">
            <div className="flex items-center justify-between pb-3 md:flex-col md:items-start md:justify-center md:pb-0 md:pr-5">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Tổng sao kê kỳ này
              </span>
              <p className="text-base font-bold tabular-nums tracking-tight text-[var(--foreground)] md:mt-1 md:text-2xl">
                {formatAmount(statement.totalAmount)}{" "}
                <span className="text-xs font-semibold text-[var(--text-secondary)]">{currency}</span>
              </p>
              <span className="mt-1 hidden text-[11px] text-[var(--text-muted)] md:block">
                Chốt ngày {formatDate(statement.cycleEndDate)}
              </span>
            </div>

            <div className="flex items-center justify-between py-3 md:flex-col md:items-start md:justify-center md:px-5 md:py-0">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Đã thanh toán
              </span>
              <p className="text-base font-bold tabular-nums tracking-tight text-[var(--success)] md:mt-1 md:text-2xl">
                {formatAmount(totalPaid)}{" "}
                <span className="text-xs font-semibold text-[var(--text-secondary)]">{currency}</span>
              </p>
              <span className="mt-1 hidden text-[11px] text-[var(--text-muted)] md:block">
                {approvedPayments.length > 0
                  ? `${approvedPayments.length} lần thanh toán đã duyệt`
                  : "Chưa phát sinh thanh toán"}
              </span>
            </div>

            <div className="flex items-center justify-between pt-3 md:flex-col md:items-start md:justify-center md:pl-5 md:pt-0">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Còn cần thanh toán
              </span>
              <p
                className={cn(
                  "text-base font-bold tabular-nums tracking-tight md:mt-1 md:text-2xl",
                  remainingDebt.gt(0) ? "text-[var(--warning)]" : "text-[var(--success)]",
                )}
              >
                {formatAmount(remainingDebt)}{" "}
                <span className="text-xs font-semibold text-[var(--text-secondary)]">{currency}</span>
              </p>
              <span className="mt-1 hidden text-[11px] text-[var(--text-muted)] md:block">
                Hạn thanh toán {formatDate(statement.dueDate)}
              </span>
            </div>
          </div>

          {byWallet.size > 0 && (
            <div className="mt-4 space-y-2.5 border-t border-[var(--border)] pt-4">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">
                Tiền chờ thanh toán thẻ theo ví nguồn
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {[...byWallet].map(([name, amount]) => (
                  <div
                    key={name}
                    className="flex flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3.5 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <Wallet className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
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
        <Card as="section" className="gap-4 p-4 md:p-5" aria-labelledby="statement-items">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ReceiptText className="size-4 text-[var(--primary)]" aria-hidden="true" />
              <h2 id="statement-items" className="text-sm font-semibold text-[var(--foreground)] md:text-base">
                Giao dịch trong kỳ sao kê ({statement.items.length})
              </h2>
            </div>
          </div>

          {/* Mobile Stacked List (<768px) */}
          <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)] md:hidden">
            {statement.items.map((item) => {
              const transaction = item.obligationEntry.transaction;
              const label =
                transaction?.description ??
                (item.isCarry ? "Dư nợ chuyển từ kỳ trước" : "Điều chỉnh dư nợ thẻ");

              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-1.5 p-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
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
                    (item.isCarry ? "Dư nợ chuyển từ kỳ trước" : "Điều chỉnh dư nợ thẻ");

                  return (
                    <tr key={item.id} className="transition-colors hover:bg-[var(--surface-secondary)]/50">
                      <td className="px-4 py-3">
                        <p className="break-words font-semibold leading-snug text-[var(--foreground)]">{label}</p>
                        {item.installment && (
                          <span className="mt-0.5 inline-block text-xs text-[var(--text-muted)]">
                            Trả góp kỳ {item.installment.installmentNo}/{item.installment.plan.termCount}
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
          <Card as="section" className="gap-3 p-4 md:p-5" aria-labelledby="statement-payments">
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
                  className="flex flex-col gap-1.5 p-3.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
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
