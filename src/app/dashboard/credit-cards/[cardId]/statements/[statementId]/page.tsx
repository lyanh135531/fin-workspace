import Decimal from "decimal.js";
import { ArrowLeft, CheckCircle2, Clock3, ReceiptText, WalletCards } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button, Card, PageContainer } from "@/components/base";
import { formatAmount } from "@/lib/format";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { prisma } from "@/lib/prisma";
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
      (byWallet.get(item.obligationEntry.fundingWallet.name) ?? new Decimal(0)).plus(item.amount.toString()),
    );
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="flex items-start gap-3">
          <Button
            variant="outline"
            size="icon"
            render={<Link href="/credit-cards" aria-label="Quay lại danh sách thẻ" />}
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[var(--text-muted)]">{statement.card.wallet.name}</p>
            <h1 className="text-xl font-semibold text-[var(--foreground)]">Chi tiết sao kê</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Kỳ {formatDate(statement.cycleStartDate)} – {formatDate(statement.cycleEndDate)}
            </p>
          </div>
        </header>

        <Card as="section" className="gap-4 p-4 sm:p-6" aria-labelledby="statement-summary">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="statement-summary" className="text-sm font-semibold text-[var(--text-secondary)]">
                Tổng sao kê
              </h2>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--foreground)]">
                {formatAmount(statement.totalAmount)} {currency}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Hạn thanh toán {formatDate(statement.dueDate)}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-[var(--surface-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
              {statement.status === "paid" ? (
                <CheckCircle2 className="size-3.5 text-[var(--success)]" aria-hidden="true" />
              ) : (
                <Clock3 className="size-3.5 text-[var(--warning)]" aria-hidden="true" />
              )}
              {statement.status === "paid" ? "Đã thanh toán" : "Chưa thanh toán"}
            </span>
          </div>

          <div className="grid gap-2 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
            {[...byWallet].map(([name, amount]) => (
              <div key={name} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-[var(--text-secondary)]">{name}</span>
                <span className="shrink-0 font-semibold tabular-nums text-[var(--foreground)]">
                  {formatAmount(Decimal.max(amount, 0))} {currency}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card as="section" className="gap-0 p-4 sm:p-6" aria-labelledby="statement-items">
          <div className="mb-3 flex items-center gap-2">
            <ReceiptText className="size-4 text-[var(--primary)]" aria-hidden="true" />
            <h2 id="statement-items" className="text-sm font-semibold text-[var(--foreground)]">
              Giao dịch trong kỳ ({statement.items.length})
            </h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {statement.items.map((item) => {
              const transaction = item.obligationEntry.transaction;
              return (
                <div key={item.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--foreground)]">
                      {transaction?.description ?? (item.isCarry ? "Dư chuyển kỳ trước" : "Điều chỉnh thẻ")}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {transaction ? formatDate(transaction.date) : formatDate(statement.cycleStartDate)} · {item.obligationEntry.fundingWallet.name}
                      {item.installment ? ` · Kỳ ${item.installment.installmentNo}/${item.installment.plan.termCount}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--foreground)]">
                    {item.amount.isNegative() ? "−" : "+"}{formatAmount(item.amount.abs())} {currency}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {statement.payments.length > 0 && (
          <Card as="section" className="gap-3 p-4 sm:p-6" aria-labelledby="statement-payments">
            <div className="flex items-center gap-2">
              <WalletCards className="size-4 text-[var(--primary)]" aria-hidden="true" />
              <h2 id="statement-payments" className="text-sm font-semibold text-[var(--foreground)]">
                Thanh toán
              </h2>
            </div>
            {statement.payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--text-secondary)]">
                  {formatDate(payment.date)} · {payment.workflowStatus === "approved" ? "Đã duyệt" : "Đang chờ duyệt"}
                </span>
                <span className="font-semibold tabular-nums text-[var(--foreground)]">
                  {formatAmount(payment.amount)} {currency}
                </span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
