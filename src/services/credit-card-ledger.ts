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

export function allocateRefundByFundingWallet(
  entries: ObligationBalance[],
  defaultFundingWalletId: string,
  refundAmount: Decimal,
) {
  const outstandingByWallet = new Map<string, Decimal>();
  const walletOrder: string[] = [];
  for (const entry of entries) {
    if (!outstandingByWallet.has(entry.fundingWalletId)) walletOrder.push(entry.fundingWalletId);
    outstandingByWallet.set(
      entry.fundingWalletId,
      (outstandingByWallet.get(entry.fundingWalletId) ?? ZERO)
        .plus(entry.amount)
        .minus(entry.paid),
    );
  }

  let remainder = refundAmount;
  const allocations = new Map<string, Decimal>();
  for (const fundingWalletId of walletOrder) {
    const amount = Decimal.min(
      remainder,
      Decimal.max(outstandingByWallet.get(fundingWalletId) ?? ZERO, ZERO),
    ).toDecimalPlaces(4);
    if (amount.gt(0)) allocations.set(fundingWalletId, amount);
    remainder = remainder.minus(amount);
    if (!remainder.gt(0)) break;
  }
  if (remainder.gt(0)) {
    allocations.set(
      defaultFundingWalletId,
      (allocations.get(defaultFundingWalletId) ?? ZERO).plus(remainder),
    );
  }
  return allocations;
}

export async function normalizeApprovedRefundAllocations(
  tx: TransactionClient,
  refundTransactionId: string,
) {
  const refund = await tx.transaction.findUnique({
    where: { id: refundTransactionId },
    select: { walletId: true, amount: true, purpose: true, workflowStatus: true },
  });
  if (refund?.purpose !== "credit_card_refund" || refund.workflowStatus !== "approved") return;
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "CREDIT_CARD_OBLIGATION_ENTRY" WHERE "card_wallet_id" = CAST(${refund.walletId} AS uuid) FOR UPDATE`,
  );
  const [profile, obligations] = await Promise.all([
    tx.creditCardProfile.findUnique({
      where: { walletId: refund.walletId },
      select: { defaultFundingWalletId: true },
    }),
    tx.creditCardObligationEntry.findMany({
      where: { cardWalletId: refund.walletId, transactionId: { not: refundTransactionId } },
      include: { paymentAllocations: { select: { amount: true } } },
      orderBy: [{ postedDate: "asc" }, { id: "asc" }],
    }),
  ]);
  if (!profile) throw new AppError("CONFLICT", "Thẻ thiếu cấu hình ví thanh toán mặc định.");

  const allocationByWallet = allocateRefundByFundingWallet(
    obligations.map((obligation) => ({
      id: obligation.id,
      fundingWalletId: obligation.fundingWalletId,
      amount: obligation.amount,
      paid: obligation.paymentAllocations.reduce(
        (sum, allocation) => sum.plus(allocation.amount.toString()),
        ZERO,
      ),
      effectiveDate: obligation.effectiveDate,
      postedDate: obligation.postedDate,
    })),
    profile.defaultFundingWalletId,
    new Decimal(refund.amount.toString()),
  );

  await tx.creditCardObligationEntry.deleteMany({
    where: { transactionId: refundTransactionId },
  });
  await tx.creditCardAllocation.deleteMany({ where: { transactionId: refundTransactionId } });
  await tx.creditCardAllocation.createMany({
    data: [...allocationByWallet].map(([fundingWalletId, amount]) => ({
      transactionId: refundTransactionId,
      fundingWalletId,
      amount,
    })),
  });
}
