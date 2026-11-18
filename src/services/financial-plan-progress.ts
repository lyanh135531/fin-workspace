import Decimal from "decimal.js";
import type { Prisma } from "@/generated/prisma/client";

// Read-only source for planning. Unlike the spending forecast, this includes
// the entire unpaid card debt, including unbilled installment principal.
export async function getFinancialPlanNetBalance(
  tx: Prisma.TransactionClient, workspaceId: string, before?: Date,
) {
  const links = await tx.workspaceWallet.findMany({
    where: {
      workspaceId,
      wallet: before
        ? { createdAt: { lt: before }, OR: [{ deletedAt: null }, { deletedAt: { gte: before } }] }
        : { deletedAt: null },
    },
    select: { walletId: true, wallet: { select: { kind: true, currentBalance: true } } },
  });
  const assets = new Map(links.filter(link => link.wallet.kind === "asset")
    .map(link => [link.walletId, new Decimal(link.wallet.currentBalance.toString())]));
  const cardIds = links.filter(link => link.wallet.kind === "credit_card").map(link => link.walletId);
  if (!before) {
    const debt = links.filter(link => link.wallet.kind === "credit_card")
      .reduce((sum, link) => sum.plus(Decimal.max(link.wallet.currentBalance.toString(), 0)), new Decimal(0));
    return [...assets.values()].reduce((sum, amount) => sum.plus(amount), new Decimal(0))
      .minus(debt).toDecimalPlaces(0, Decimal.ROUND_FLOOR);
  }

  const later = await tx.transaction.findMany({
    where: {
      member: { workspaceId }, deletedAt: null, workflowStatus: "approved",
      date: { gte: before },
      OR: [
        { walletId: { in: [...assets.keys()] } }, { toWalletId: { in: [...assets.keys()] } },
        { creditCardPaymentSources: { some: { sourceWalletId: { in: [...assets.keys()] } } } },
      ],
    },
    select: {
      type: true, purpose: true, amount: true, walletId: true, toWalletId: true,
      creditCardPaymentSources: { select: { sourceWalletId: true, amount: true } },
    },
  });
  const adjust = (id: string | null, delta: Decimal) => {
    if (id && assets.has(id)) assets.set(id, assets.get(id)!.plus(delta));
  };
  for (const record of later) {
    const amount = new Decimal(record.amount.toString());
    if (record.purpose === "credit_card_payment") {
      for (const source of record.creditCardPaymentSources) {
        adjust(source.sourceWalletId, new Decimal(source.amount.toString()));
      }
    } else if (record.type === "transfer") {
      adjust(record.walletId, amount);
      adjust(record.toWalletId, amount.negated());
    } else {
      adjust(record.walletId, record.type === "income" ? amount.negated() : amount);
    }
  }
  // Reconstruct debt from its ledger at the same date boundary as asset balances.
  const entries = await tx.creditCardObligationEntry.findMany({
    where: { workspaceId, cardWalletId: { in: cardIds }, effectiveDate: { lt: before } },
    select: {
      cardWalletId: true, amount: true,
      paymentAllocations: {
        where: { paymentTransaction: { date: { lt: before }, workflowStatus: "approved", deletedAt: null } },
        select: { amount: true },
      },
    },
  });
  const debtByCard = new Map<string, Decimal>();
  for (const entry of entries) {
    const remaining = new Decimal(entry.amount.toString())
      .minus(entry.paymentAllocations.reduce((sum, payment) => sum.plus(payment.amount.toString()), new Decimal(0)));
    debtByCard.set(entry.cardWalletId, (debtByCard.get(entry.cardWalletId) ?? new Decimal(0)).plus(remaining));
  }
  const debt = [...debtByCard.values()].reduce((sum, amount) => sum.plus(Decimal.max(amount, 0)), new Decimal(0));
  return [...assets.values()].reduce((sum, amount) => sum.plus(amount), new Decimal(0))
    .minus(debt).toDecimalPlaces(0, Decimal.ROUND_FLOOR);
}

