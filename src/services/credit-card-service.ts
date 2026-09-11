import Decimal from "decimal.js";

import type { CreateCreditCardPaymentInput, CreateCreditCardRefundInput } from "@/domain";
import { transactionTimingForDate, workflowStatusForCreation } from "@/domain/transaction/policy";
import { Prisma } from "@/generated/prisma/client";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  assertCardBalanceReconciled,
  normalizeApprovedRefundAllocations,
  syncCreditCardObligationsForTransaction,
} from "@/services/credit-card-ledger";
import { completePaidInstallmentPlansInTransaction, generateCardStatementsInTransaction, statementPaymentDetails } from "@/services/credit-card-statement-service";
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
    const today = getBusinessDateInTimeZone(member.workspace.timeZone, now);
    await generateCardStatementsInTransaction(tx, workspaceId, input.cardWalletId, today);
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

    const oldest = await tx.creditCardStatement.findFirst({
      where: { workspaceId, cardWalletId: input.cardWalletId, status: "issued" },
      orderBy: [{ cycleEndDate: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (!oldest || oldest.id !== input.statementId) throw new AppError("CONFLICT", "Hãy thanh toán sao kê cũ nhất trước.");
    const { statement, dueByWallet, allocations } = await statementPaymentDetails(tx, input.statementId);
    if (statement.status !== "issued" || statement.cardWalletId !== input.cardWalletId || statement.workspaceId !== workspaceId) {
      throw new AppError("CONFLICT", "Sao kê không còn khả dụng để thanh toán.");
    }
    const pendingPayment = await tx.transaction.findFirst({
      where: { creditCardStatementId: statement.id, workflowStatus: { in: ["pending", "scheduled", "approved"] }, deletedAt: null },
      select: { id: true },
    });
    if (pendingPayment) throw new AppError("CONFLICT", "Sao kê đã có thanh toán đang chờ hoặc đã hoàn tất.");
    const supplied = new Map(input.sources.map((source) => [source.walletId, new Decimal(source.amount)]));
    const expected = [...dueByWallet].filter(([, amount]) => amount.gt(0));
    if (supplied.size !== expected.length || expected.some(([walletId, amount]) => !supplied.get(walletId)?.eq(amount))) {
      throw new AppError("VALIDATION_ERROR", "Nguồn thanh toán phải khớp chính xác số còn thiếu của sao kê.");
    }
    const total = expected.reduce((sum, [, amount]) => sum.plus(amount), ZERO);
    if (!total.eq(statement.totalAmount)) throw new AppError("CONFLICT", "Tổng sao kê không khớp chi tiết nghĩa vụ.");

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
        creditCardStatementId: statement.id,
        creditCardPaymentSources: {
          create: input.sources.map((source) => ({ sourceWalletId: source.walletId, amount: source.amount })),
        },
      },
    });
    if (workflowStatus === "approved") {
      await tx.creditCardPaymentAllocation.createMany({
        data: [...allocations].map(([obligationEntryId, amount]) => ({ paymentTransactionId: record.id, obligationEntryId, amount })),
      });
      await applyBalance(tx, record);
      await tx.creditCardStatement.update({ where: { id: statement.id }, data: { status: "paid", paidAt: new Date() } });
      await completePaidInstallmentPlansInTransaction(tx, statement.id);
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
        installmentPlan: null,
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
