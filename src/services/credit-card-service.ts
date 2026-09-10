import Decimal from "decimal.js";

import type { CreateCreditCardPaymentInput, CreateCreditCardRefundInput } from "@/domain";
import { transactionTimingForDate, workflowStatusForCreation } from "@/domain/transaction/policy";
import { Prisma } from "@/generated/prisma/client";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  allocateOldestObligations,
  assertCardBalanceReconciled,
  getCardObligationBalances,
  normalizeApprovedRefundAllocations,
  syncCreditCardObligationsForTransaction,
} from "@/services/credit-card-ledger";
import { applyBalance } from "@/services/transaction-service";
import { requireWorkspaceMember } from "@/services/workspace-access";

const ZERO = new Decimal(0);

function databaseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function lockWallets(tx: Prisma.TransactionClient, walletIds: string[]) {
  for (const walletId of [...new Set(walletIds)].sort()) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "WALLETS" WHERE "id" = CAST(${walletId} AS uuid) FOR UPDATE`,
    );
  }
}

async function lockCardObligations(tx: Prisma.TransactionClient, cardWalletId: string) {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "CREDIT_CARD_OBLIGATION_ENTRY" WHERE "card_wallet_id" = CAST(${cardWalletId} AS uuid) FOR UPDATE`,
  );
}

export async function createCreditCardPayment(
  userId: string,
  workspaceId: string,
  input: CreateCreditCardPaymentInput,
  now = new Date(),
) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  const timing = transactionTimingForDate(input.date, getBusinessDateInTimeZone(member.workspace.timeZone, now));
  const workflowStatus = workflowStatusForCreation(member.role.code, timing);

  return prisma.$transaction(async (tx) => {
    await lockWallets(tx, [input.cardWalletId, ...input.sources.map(({ walletId }) => walletId)]);
    await lockCardObligations(tx, input.cardWalletId);
    const card = await tx.workspaceWallet.findFirst({
      where: {
        workspaceId,
        walletId: input.cardWalletId,
        wallet: { kind: "credit_card", status: "active", deletedAt: null },
      },
      select: { wallet: { select: { currentBalance: true } } },
    });
    if (!card) throw new AppError("WORKSPACE_ISOLATION_VIOLATION", "Thẻ không thuộc nhóm này hoặc không còn hoạt động.");

    const sourceWalletIds = input.sources.map(({ walletId }) => walletId);
    const sourceWallets = await tx.workspaceWallet.findMany({
      where: {
        workspaceId,
        walletId: { in: sourceWalletIds },
        wallet: { kind: "asset", status: "active", deletedAt: null },
      },
      select: { walletId: true },
    });
    if (sourceWallets.length !== new Set(sourceWalletIds).size) {
      throw new AppError("WORKSPACE_ISOLATION_VIOLATION", "Nguồn thanh toán phải là ví tài sản đang hoạt động trong nhóm này.");
    }

    const total = input.sources.reduce((sum, source) => sum.plus(source.amount), ZERO);
    const reservations = await tx.creditCardPaymentReservation.groupBy({
      by: ["sourceWalletId"],
      where: {
        releasedAt: null,
        paymentTransaction: {
          walletId: input.cardWalletId,
          workflowStatus: { in: ["pending", "scheduled"] },
          deletedAt: null,
        },
      },
      _sum: { amount: true },
    });
    const reservedTotal = reservations.reduce(
      (sum, reservation) => sum.plus(reservation._sum.amount?.toString() ?? 0),
      ZERO,
    );
    const payable = Decimal.max(new Decimal(card.wallet.currentBalance.toString()).minus(reservedTotal), ZERO);
    if (total.gt(payable)) {
      throw new AppError("VALIDATION_ERROR", "Số tiền thanh toán vượt dư nợ còn lại sau các thanh toán đang chờ.");
    }

    const balances = await getCardObligationBalances(tx, input.cardWalletId);
    const reservedByWallet = new Map(
      reservations.map((reservation) => [
        reservation.sourceWalletId,
        new Decimal(reservation._sum.amount?.toString() ?? 0),
      ]),
    );
    const availableBalances = balances.map((entry) => ({ ...entry }));
    for (const [walletId, reserved] of reservedByWallet) {
      let remainder = reserved;
      for (const entry of availableBalances.filter((item) => item.fundingWalletId === walletId)) {
        if (!remainder.gt(0)) break;
        const open = Decimal.max(new Decimal(entry.amount).minus(entry.paid), ZERO);
        const applied = Decimal.min(open, remainder);
        entry.paid = new Decimal(entry.paid).plus(applied);
        remainder = remainder.minus(applied);
      }
    }
    // Dry run: every source can only settle obligations assigned to that source wallet.
    allocateOldestObligations(availableBalances, input.sources);

    const record = await tx.transaction.create({
      data: {
        memberId: member.id,
        walletId: input.cardWalletId,
        type: "transfer",
        purpose: "credit_card_payment",
        amount: total,
        description: input.description ?? "Thanh toán dư nợ thẻ tín dụng",
        date: databaseDate(input.date),
        postedDate: databaseDate(input.date),
        workflowStatus,
        creditCardPaymentSources: {
          create: input.sources.map((source) => ({ sourceWalletId: source.walletId, amount: source.amount })),
        },
      },
    });
    if (workflowStatus === "approved") {
      const allocations = allocateOldestObligations(balances, input.sources);
      await tx.creditCardPaymentAllocation.createMany({
        data: allocations.map((allocation) => ({ paymentTransactionId: record.id, ...allocation })),
      });
      await applyBalance(tx, record);
      await assertCardBalanceReconciled(tx, input.cardWalletId);
    } else {
      await tx.creditCardPaymentReservation.createMany({
        data: input.sources.map((source) => ({
          paymentTransactionId: record.id,
          sourceWalletId: source.walletId,
          amount: source.amount,
        })),
      });
    }
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "credit_card.payment_created",
        entityType: "transaction",
        entityId: record.id,
        metadata: { workflowStatus, sourceCount: input.sources.length },
      },
    });
    return record;
  });
}

export async function createCreditCardRefund(
  userId: string,
  workspaceId: string,
  input: CreateCreditCardRefundInput,
  now = new Date(),
) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  const timing = transactionTimingForDate(input.date, getBusinessDateInTimeZone(member.workspace.timeZone, now));
  const workflowStatus = workflowStatusForCreation(member.role.code, timing);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "TRANSACTION" WHERE "id" = CAST(${input.originalTransactionId} AS uuid) FOR UPDATE`,
    );
    const original = await tx.transaction.findFirst({
      where: {
        id: input.originalTransactionId,
        type: "expense",
        purpose: "standard",
        workflowStatus: "approved",
        deletedAt: null,
        member: { workspaceId },
        wallet: { kind: "credit_card", workspaceLinks: { some: { workspaceId } } },
      },
      include: {
        creditCardAllocations: true,
        refundTransactions: {
          where: { deletedAt: null, workflowStatus: { not: "rejected" } },
          select: { amount: true, creditCardAllocations: true },
        },
      },
    });
    if (!original) throw new AppError("NOT_FOUND", "Không tìm thấy giao dịch thẻ có thể hoàn tiền.");

    await lockWallets(tx, [original.walletId]);
    await lockCardObligations(tx, original.walletId);
    const alreadyRefunded = original.refundTransactions.reduce(
      (sum, refund) => sum.plus(refund.amount.toString()),
      ZERO,
    );
    if (alreadyRefunded.plus(input.amount).gt(original.amount.toString())) {
      throw new AppError("VALIDATION_ERROR", "Tổng hoàn tiền vượt quá giao dịch gốc.");
    }

    let remainder = input.amount;
    const isFinalRefund = alreadyRefunded.plus(input.amount).eq(original.amount.toString());
    const allocations = original.creditCardAllocations.map((allocation, index) => {
      const refundedForWallet = original.refundTransactions.reduce(
        (sum, refund) => sum.plus(
          refund.creditCardAllocations.find((item) => item.fundingWalletId === allocation.fundingWalletId)?.amount.toString() ?? 0,
        ),
        ZERO,
      );
      const amount = index === original.creditCardAllocations.length - 1
        ? remainder
        : isFinalRefund
          ? new Decimal(allocation.amount.toString()).minus(refundedForWallet)
          : input.amount.times(allocation.amount.toString()).div(original.amount.toString()).toDecimalPlaces(4, Decimal.ROUND_DOWN);
      remainder = remainder.minus(amount);
      return { fundingWalletId: allocation.fundingWalletId, amount };
    });

    const record = await tx.transaction.create({
      data: {
        memberId: member.id,
        walletId: original.walletId,
        categoryId: original.categoryId,
        type: "income",
        purpose: "credit_card_refund",
        amount: input.amount,
        description: input.description ?? `Hoàn tiền: ${original.description ?? "giao dịch thẻ"}`,
        date: databaseDate(input.date),
        postedDate: databaseDate(input.postedDate ?? input.date),
        workflowStatus,
        originalTransactionId: original.id,
        jarCode: original.jarCode,
        creditCardAllocations: { create: allocations },
      },
    });
    if (workflowStatus === "approved") {
      await applyBalance(tx, record);
      await normalizeApprovedRefundAllocations(tx, record.id);
      await syncCreditCardObligationsForTransaction(tx, workspaceId, record.id);
      await assertCardBalanceReconciled(tx, record.walletId);
    }
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "credit_card.refund_created",
        entityType: "transaction",
        entityId: record.id,
        metadata: { originalTransactionId: original.id, workflowStatus },
      },
    });
    return record;
  });
}

export async function getWorkspaceCreditCardCommitments(workspaceId: string) {
  const obligations = await prisma.creditCardObligationEntry.findMany({
    where: { workspaceId },
    select: { fundingWalletId: true, amount: true, paymentAllocations: { select: { amount: true } } },
  });
  const totals = new Map<string, Decimal>();
  for (const obligation of obligations) {
    const paid = obligation.paymentAllocations.reduce(
      (sum, allocation) => sum.plus(allocation.amount.toString()),
      ZERO,
    );
    totals.set(
      obligation.fundingWalletId,
      (totals.get(obligation.fundingWalletId) ?? ZERO).plus(obligation.amount.toString()).minus(paid),
    );
  }
  return new Map([...totals.entries()].map(([walletId, amount]) => [walletId, Decimal.max(amount, ZERO)]));
}

export async function getCreditCardSummary(workspaceId: string, cardWalletId: string) {
  const card = await prisma.workspaceWallet.findFirst({
    where: { workspaceId, walletId: cardWalletId, wallet: { kind: "credit_card", deletedAt: null } },
    select: {
      wallet: {
        select: {
          currentBalance: true,
          creditCardProfile: { select: { creditLimit: true, defaultFundingWalletId: true } },
        },
      },
    },
  });
  if (!card?.wallet.creditCardProfile) {
    throw new AppError("WORKSPACE_ISOLATION_VIOLATION", "Thẻ không thuộc nhóm này.");
  }
  const reservations = await prisma.creditCardPaymentReservation.aggregate({
    where: {
      releasedAt: null,
      paymentTransaction: {
        walletId: cardWalletId,
        workflowStatus: { in: ["pending", "scheduled"] },
        deletedAt: null,
        member: { workspaceId },
      },
    },
    _sum: { amount: true },
  });
  const balance = new Decimal(card.wallet.currentBalance.toString());
  const creditLimit = new Decimal(card.wallet.creditCardProfile.creditLimit.toString());
  return {
    balance,
    debt: Decimal.max(balance, ZERO),
    creditBalance: Decimal.max(balance.negated(), ZERO),
    creditLimit,
    availableCredit: creditLimit.minus(balance),
    pendingPayment: new Decimal(reservations._sum.amount?.toString() ?? 0),
    defaultFundingWalletId: card.wallet.creditCardProfile.defaultFundingWalletId,
  };
}

export async function getCreditCardAvailableCredit(workspaceId: string, cardWalletId: string) {
  return (await getCreditCardSummary(workspaceId, cardWalletId)).availableCredit;
}
