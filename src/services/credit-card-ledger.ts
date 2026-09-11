import Decimal from "decimal.js";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";

type TransactionClient = Prisma.TransactionClient;
const ZERO = new Decimal(0);

export type ObligationBalance = {
  id: string;
  fundingWalletId: string;
  amount: Decimal.Value;
  paid: Decimal.Value;
  effectiveDate?: Date;
  postedDate: Date;
};

/** Applies signed credits first, then allocates a payment to oldest positive debt. */
export function allocateOldestObligations(
  entries: ObligationBalance[],
  sources: Array<{ walletId: string; amount: Decimal }>,
) {
  const allocations: Array<{ obligationEntryId: string; amount: Decimal }> = [];
  for (const source of sources) {
    const walletEntries = entries
      .filter((entry) => entry.fundingWalletId === source.walletId)
      .sort((left, right) => {
        return left.postedDate.getTime() - right.postedDate.getTime()
          || left.id.localeCompare(right.id);
      });
    let credit = walletEntries.reduce((sum, entry) => {
      const remaining = new Decimal(entry.amount).minus(entry.paid);
      return remaining.lt(0) ? sum.plus(remaining.abs()) : sum;
    }, ZERO);
    let payment = source.amount;
    for (const entry of walletEntries) {
      let remaining = new Decimal(entry.amount).minus(entry.paid);
      if (!remaining.gt(0)) continue;
      const creditApplied = Decimal.min(remaining, credit);
      remaining = remaining.minus(creditApplied);
      credit = credit.minus(creditApplied);
      if (!payment.gt(0) || !remaining.gt(0)) continue;
      const amount = Decimal.min(payment, remaining).toDecimalPlaces(4);
      allocations.push({ obligationEntryId: entry.id, amount });
      payment = payment.minus(amount);
    }
    if (payment.gt(0)) {
      throw new AppError("VALIDATION_ERROR", "Số tiền thanh toán vượt quá nghĩa vụ của ví nguồn.");
    }
  }
  return allocations;
}

export async function getCardObligationBalances(tx: TransactionClient, cardWalletId: string) {
  const entries = await tx.creditCardObligationEntry.findMany({
    where: { cardWalletId },
    include: { paymentAllocations: { select: { amount: true } } },
    orderBy: [{ postedDate: "asc" }, { id: "asc" }],
  });
  return entries.map((entry) => ({
    id: entry.id,
    fundingWalletId: entry.fundingWalletId,
    amount: entry.amount,
    paid: entry.paymentAllocations.reduce((sum, item) => sum.plus(item.amount.toString()), ZERO),
    effectiveDate: entry.effectiveDate,
    postedDate: entry.postedDate,
  }));
}

export async function cardOutstanding(tx: TransactionClient, cardWalletId: string) {
  const balances = await getCardObligationBalances(tx, cardWalletId);
  return balances.reduce(
    (sum, entry) => sum.plus(entry.amount).minus(entry.paid),
    ZERO,
  ).toDecimalPlaces(4);
}

export async function assertCardBalanceReconciled(tx: TransactionClient, cardWalletId: string) {
  const [wallet, outstanding] = await Promise.all([
    tx.wallet.findUniqueOrThrow({ where: { id: cardWalletId }, select: { currentBalance: true } }),
    cardOutstanding(tx, cardWalletId),
  ]);
  if (!new Decimal(wallet.currentBalance.toString()).eq(outstanding)) {
    throw new AppError("CONFLICT", "Dư nợ cache của thẻ lệch obligation ledger; giao dịch đã bị hủy.");
  }
}

export async function syncCreditCardObligationsForTransaction(
  tx: TransactionClient,
  workspaceId: string,
  transactionId: string,
) {
  const transaction = await tx.transaction.findFirst({
    where: {
      id: transactionId,
      workflowStatus: "approved",
      deletedAt: null,
      member: { workspaceId },
      wallet: { kind: "credit_card", workspaceLinks: { some: { workspaceId } } },
      purpose: { in: ["standard", "credit_card_refund", "credit_card_installment_fee"] },
    },
    include: { creditCardAllocations: true },
  });
  if (!transaction) return;
  const sign = transaction.purpose === "credit_card_refund" ? new Decimal(-1) : new Decimal(1);
  const kind = transaction.purpose === "credit_card_refund" ? "refund" as const : "purchase" as const;
  for (const allocation of transaction.creditCardAllocations) {
    await tx.creditCardObligationEntry.upsert({
      where: { idempotencyKey: `transaction:${transaction.id}:${allocation.fundingWalletId}` },
      update: {},
      create: {
        workspaceId,
        cardWalletId: transaction.walletId,
        fundingWalletId: allocation.fundingWalletId,
        transactionId: transaction.id,
        kind,
        source: "transaction",
        effectiveDate: transaction.date,
        postedDate: transaction.postedDate ?? transaction.date,
        amount: new Decimal(allocation.amount.toString()).times(sign),
        idempotencyKey: `transaction:${transaction.id}:${allocation.fundingWalletId}`,
      },
    });
  }
}

export async function normalizeApprovedRefundAllocations(
  tx: TransactionClient,
  refundTransactionId: string,
) {
  const refund = await tx.transaction.findUnique({
    where: { id: refundTransactionId },
    select: { originalTransactionId: true, amount: true, purpose: true, workflowStatus: true },
  });
  if (refund?.purpose !== "credit_card_refund" || refund.workflowStatus !== "approved" || !refund.originalTransactionId) return;
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "TRANSACTION" WHERE "id" = CAST(${refund.originalTransactionId} AS uuid) FOR UPDATE`,
  );
  const original = await tx.transaction.findUniqueOrThrow({
    where: { id: refund.originalTransactionId },
    include: {
      creditCardAllocations: true,
      refundTransactions: {
        where: { id: { not: refundTransactionId }, workflowStatus: "approved", deletedAt: null },
        include: { creditCardAllocations: true },
      },
    },
  });
  const approvedBefore = original.refundTransactions.reduce(
    (sum, item) => sum.plus(item.amount.toString()),
    ZERO,
  );
  const isFinalRefund = approvedBefore.plus(refund.amount.toString()).eq(original.amount.toString());
  let remainder = new Decimal(refund.amount.toString());
  const allocations = original.creditCardAllocations.map((allocation, index) => {
    const previouslyRefunded = original.refundTransactions.reduce(
      (sum, item) => sum.plus(
        item.creditCardAllocations.find(({ fundingWalletId }) => fundingWalletId === allocation.fundingWalletId)?.amount.toString() ?? 0,
      ),
      ZERO,
    );
    const amount = index === original.creditCardAllocations.length - 1
      ? remainder
      : isFinalRefund
        ? new Decimal(allocation.amount.toString()).minus(previouslyRefunded)
        : new Decimal(refund.amount.toString())
            .times(allocation.amount.toString())
            .div(original.amount.toString())
            .toDecimalPlaces(4, Decimal.ROUND_DOWN);
    remainder = remainder.minus(amount);
    return { transactionId: refundTransactionId, fundingWalletId: allocation.fundingWalletId, amount };
  });
  await tx.creditCardAllocation.deleteMany({ where: { transactionId: refundTransactionId } });
  await tx.creditCardAllocation.createMany({ data: allocations });
}
