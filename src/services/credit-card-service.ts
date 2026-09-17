import Decimal from "decimal.js";

import type {
  CreateCreditCardPaymentInput,
  CreateCreditCardRefundInput,
  DeleteCreditCardResolution,
  UpdateCreditCardInput,
} from "@/domain";
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
import { assertWalletHasNoOpenDependencies, ensureWalletNameAvailable } from "@/services/wallet-service";
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
    await lockWallets(tx, [input.cardWalletId]);
    await lockCardObligations(tx, input.cardWalletId);
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "TRANSACTION" WHERE "id" = CAST(${input.originalTransactionId} AS uuid) FOR UPDATE`,
    );
    const card = await tx.workspaceWallet.findFirst({
      where: {
        workspaceId,
        walletId: input.cardWalletId,
        wallet: { kind: "credit_card", status: "active", deletedAt: null },
      },
      select: { walletId: true },
    });
    if (!card) throw new AppError("WORKSPACE_ISOLATION_VIOLATION", "Thẻ không thuộc nhóm này hoặc không còn hoạt động.");

    const original = await tx.transaction.findFirst({
      where: {
        id: input.originalTransactionId,
        walletId: input.cardWalletId,
        type: "expense",
        purpose: "standard",
        workflowStatus: "approved",
        deletedAt: null,
        member: { workspaceId },
      },
      include: {
        refundTransactions: {
          where: { workflowStatus: { not: "rejected" }, deletedAt: null },
          select: { amount: true },
        },
      },
    });
    if (!original) {
      throw new AppError("VALIDATION_ERROR", "Hãy chọn một giao dịch thẻ đã duyệt để hoàn tiền.");
    }
    const alreadyRefunded = original.refundTransactions.reduce(
      (sum, refund) => sum.plus(refund.amount.toString()),
      ZERO,
    );
    const refundable = new Decimal(original.amount.toString()).minus(alreadyRefunded);
    if (input.amount.gt(refundable)) {
      throw new AppError("VALIDATION_ERROR", `Giao dịch này chỉ còn có thể hoàn ${refundable.toString()}.`);
    }

    const record = await tx.transaction.create({
      data: {
        memberId: member.id,
        walletId: input.cardWalletId,
        type: "income",
        purpose: "credit_card_refund",
        amount: input.amount,
        description: input.description ?? "Hoàn tiền vào thẻ tín dụng",
        date: databaseDate(input.date),
        postedDate: databaseDate(input.postedDate ?? input.date),
        workflowStatus,
        originalTransactionId: original.id,
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
        metadata: { cardWalletId: input.cardWalletId, workflowStatus },
      },
    });
    return record;
  });
}

export async function updateCreditCard(
  userId: string,
  workspaceId: string,
  input: UpdateCreditCardInput,
) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    await ensureWalletNameAvailable(tx, workspaceId, input.name, input.cardWalletId);
    await lockWallets(tx, [input.cardWalletId, input.defaultFundingWalletId]);
    const card = await tx.workspaceWallet.findFirst({
      where: {
        workspaceId,
        walletId: input.cardWalletId,
        wallet: { kind: "credit_card", status: "active", deletedAt: null },
      },
      include: { wallet: { include: { creditCardProfile: true } } },
    });
    if (!card?.wallet.creditCardProfile) {
      throw new AppError("WORKSPACE_ISOLATION_VIOLATION", "Thẻ không thuộc nhóm này hoặc không còn hoạt động.");
    }
    const fundingWallet = await tx.workspaceWallet.findFirst({
      where: {
        workspaceId,
        walletId: input.defaultFundingWalletId,
        wallet: { kind: "asset", status: "active", deletedAt: null },
      },
      select: { walletId: true },
    });
    if (!fundingWallet) {
      throw new AppError("WORKSPACE_ISOLATION_VIOLATION", "Ví thanh toán mặc định không khả dụng trong nhóm này.");
    }
    const balance = Decimal.max(card.wallet.currentBalance.toString(), ZERO);
    if (input.creditLimit.lt(balance)) {
      throw new AppError("VALIDATION_ERROR", "Hạn mức mới không được thấp hơn dư nợ hiện tại.");
    }
    if (input.statementClosingDay !== card.wallet.creditCardProfile.statementClosingDay) {
      const activeInstallments = await tx.creditCardInstallmentPlan.count({
        where: { cardWalletId: input.cardWalletId, status: { in: ["pending", "active"] } },
      });
      if (activeInstallments > 0) {
        throw new AppError("CONFLICT", "Không thể đổi ngày chốt khi thẻ còn kế hoạch trả góp đang hoạt động.");
      }
    }

    await tx.wallet.update({
      where: { id: input.cardWalletId },
      data: { name: input.name, description: input.description || null },
    });
    await tx.creditCardProfile.update({
      where: { walletId: input.cardWalletId },
      data: {
        creditLimit: input.creditLimit,
        defaultFundingWalletId: input.defaultFundingWalletId,
        statementClosingDay: input.statementClosingDay,
        paymentDueDay: input.paymentDueDay,
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "workspace.credit_card_updated",
        entityType: "wallet",
        entityId: input.cardWalletId,
        metadata: {
          creditLimit: input.creditLimit.toString(),
          defaultFundingWalletId: input.defaultFundingWalletId,
          statementClosingDay: input.statementClosingDay,
          paymentDueDay: input.paymentDueDay,
        },
      },
    });
    return { ok: true as const };
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

export async function deleteCreditCard(
  userId: string,
  workspaceId: string,
  cardWalletId: string,
  resolution?: DeleteCreditCardResolution,
) {
  await requireWorkspaceMember(userId, workspaceId, true);

  return prisma.$transaction(async (tx) => {
    await lockWallets(tx, [cardWalletId]);
    const link = await tx.workspaceWallet.findFirst({
      where: {
        workspaceId,
        walletId: cardWalletId,
        wallet: { kind: "credit_card", deletedAt: null },
      },
      include: { wallet: true },
    });
    if (!link) {
      throw new AppError(
        "WORKSPACE_ISOLATION_VIOLATION",
        "Thẻ tín dụng không tồn tại trong nhóm này.",
      );
    }

    const activeInstallmentPlans = await tx.creditCardInstallmentPlan.count({
      where: {
        cardWalletId,
        status: { in: ["active", "completed"] },
      },
    });
    if (activeInstallmentPlans > 0) {
      throw new AppError(
        "CONFLICT",
        `Thẻ có ${activeInstallmentPlans} gói trả góp đang hoạt động. Vui lòng tất toán hoặc hủy gói trả góp trước khi xóa thẻ.`,
      );
    }

    const paidStatements = await tx.creditCardStatement.count({
      where: {
        cardWalletId,
        status: "paid",
      },
    });
    if (paidStatements > 0) {
      throw new AppError(
        "CONFLICT",
        "Thẻ đã có sao kê đã hoàn tất thanh toán. Không thể xóa thẻ để bảo toàn dữ liệu tài chính.",
      );
    }

    const recurringCount = await tx.recurringTransaction.count({
      where: {
        workspaceId,
        deletedAt: null,
        OR: [{ walletId: cardWalletId }, { toWalletId: cardWalletId }],
      },
    });
    if (recurringCount > 0) {
      throw new AppError(
        "CONFLICT",
        `Thẻ còn ${recurringCount} giao dịch định kỳ liên kết. Vui lòng hủy giao dịch định kỳ trước khi xóa thẻ.`,
      );
    }

    const approvedTransactionCount = await tx.transaction.count({
      where: {
        workflowStatus: "approved",
        member: { workspaceId },
        deletedAt: null,
        OR: [{ walletId: cardWalletId }, { toWalletId: cardWalletId }],
      },
    });
    const balance = new Decimal(link.wallet.currentBalance.toString());

    if (!resolution) {
      await assertWalletHasNoOpenDependencies(tx, workspaceId, cardWalletId);
      if (approvedTransactionCount > 0 && !balance.isZero()) {
        if (balance.gt(0)) {
          throw new AppError(
            "CONFLICT",
            `Thẻ vẫn còn dư nợ (${balance.toString()} VND). Vui lòng chọn cách xử lý giao dịch hoặc thanh toán hết dư nợ trước khi xóa thẻ.`,
          );
        }
        throw new AppError(
          "CONFLICT",
          `Thẻ đang có số dư có (${balance.abs().toString()} VND). Vui lòng sử dụng hết số dư trước khi xóa thẻ.`,
        );
      }
    } else if (resolution.action === "void_transactions") {
      const cardTransactions = await tx.transaction.findMany({
        where: {
          deletedAt: null,
          member: { workspaceId },
          OR: [{ walletId: cardWalletId }, { toWalletId: cardWalletId }],
        },
        include: {
          installmentPlan: true,
        },
      });

      for (const t of cardTransactions) {
        if (t.installmentPlan?.status === "pending") {
          await tx.creditCardInstallmentPlan.delete({ where: { id: t.installmentPlan.id } });
        }
        await tx.transaction.update({
          where: { id: t.id },
          data: { deletedAt: new Date() },
        });
        await tx.creditCardObligationEntry.deleteMany({ where: { transactionId: t.id } });
        await tx.creditCardAllocation.deleteMany({ where: { transactionId: t.id } });
      }

      const cardTransactionIds = cardTransactions.map((t) => t.id);
      if (cardTransactionIds.length > 0) {
        await tx.creditCardPaymentReservation.updateMany({
          where: { paymentTransactionId: { in: cardTransactionIds }, releasedAt: null },
          data: { releasedAt: new Date() },
        });
      }
      await tx.creditCardStatementItem.deleteMany({
        where: { statement: { cardWalletId } },
      });
      await tx.creditCardStatement.deleteMany({
        where: { cardWalletId },
      });
      await tx.creditCardInstallmentPlan.deleteMany({
        where: { cardWalletId, status: "pending" },
      });
    } else if (resolution.action === "migrate_transactions") {
      if (resolution.targetWalletId === cardWalletId) {
        throw new AppError("VALIDATION_ERROR", "Ví đích phải khác thẻ đang xóa.");
      }
      await lockWallets(tx, [resolution.targetWalletId]);
      const targetLink = await tx.workspaceWallet.findFirst({
        where: {
          workspaceId,
          walletId: resolution.targetWalletId,
          wallet: { deletedAt: null },
        },
        include: { wallet: true },
      });
      if (!targetLink) {
        throw new AppError("NOT_FOUND", "Ví đích không tồn tại hoặc đã bị xóa.");
      }

      const cardTransactions = await tx.transaction.findMany({
        where: {
          deletedAt: null,
          member: { workspaceId },
          OR: [{ walletId: cardWalletId }, { toWalletId: cardWalletId }],
        },
        include: {
          installmentPlan: true,
        },
      });

      let totalMigratedExpense = new Decimal(0);
      for (const t of cardTransactions) {
        if (t.installmentPlan?.status === "pending") {
          await tx.creditCardInstallmentPlan.delete({ where: { id: t.installmentPlan.id } });
        }
        if (t.walletId === cardWalletId && t.type === "expense") {
          if (t.workflowStatus === "approved") {
            totalMigratedExpense = totalMigratedExpense.plus(t.amount.toString());
          }
          await tx.transaction.update({
            where: { id: t.id },
            data: { walletId: resolution.targetWalletId },
          });
          await tx.creditCardObligationEntry.deleteMany({ where: { transactionId: t.id } });
          await tx.creditCardAllocation.deleteMany({ where: { transactionId: t.id } });
        } else if (t.toWalletId === cardWalletId) {
          await tx.transaction.update({
            where: { id: t.id },
            data: { toWalletId: resolution.targetWalletId },
          });
        }
      }

      if (targetLink.wallet.kind === "asset" && totalMigratedExpense.gt(0)) {
        const newTargetBalance = new Decimal(targetLink.wallet.currentBalance.toString()).minus(totalMigratedExpense);
        await tx.wallet.update({
          where: { id: resolution.targetWalletId },
          data: { currentBalance: newTargetBalance },
        });
      } else if (targetLink.wallet.kind === "credit_card" && totalMigratedExpense.gt(0)) {
        const newTargetBalance = new Decimal(targetLink.wallet.currentBalance.toString()).plus(totalMigratedExpense);
        await tx.wallet.update({
          where: { id: resolution.targetWalletId },
          data: { currentBalance: newTargetBalance },
        });
      }

      const cardTransactionIds = cardTransactions.map((t) => t.id);
      if (cardTransactionIds.length > 0) {
        await tx.creditCardPaymentReservation.updateMany({
          where: { paymentTransactionId: { in: cardTransactionIds }, releasedAt: null },
          data: { releasedAt: new Date() },
        });
      }
      await tx.creditCardStatementItem.deleteMany({
        where: { statement: { cardWalletId } },
      });
      await tx.creditCardStatement.deleteMany({
        where: { cardWalletId },
      });
      await tx.creditCardInstallmentPlan.deleteMany({
        where: { cardWalletId, status: "pending" },
      });
    }

    const deletedAt = new Date();
    await tx.wallet.update({
      where: { id: cardWalletId },
      data: {
        status: "deactive",
        deletedAt,
        currentBalance: new Decimal(0),
      },
    });

    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "workspace.credit_card_deleted",
        entityType: "wallet",
        entityId: cardWalletId,
        metadata: {
          softDeleted: true,
          deletedAt: deletedAt.toISOString(),
          approvedTransactionCount,
          resolution: resolution?.action ?? null,
          targetWalletId: resolution?.action === "migrate_transactions" ? resolution.targetWalletId : null,
          discardedOpeningBalance:
            approvedTransactionCount === 0 ? balance.toString() : null,
        },
      },
    });

    return { ok: true as const };
  });
}
