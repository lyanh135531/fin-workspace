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
  allocateOldestObligations,
  assertCardBalanceReconciled,
  cardOutstanding,
  getCardObligationBalances,
  normalizeApprovedRefundAllocations,
  syncCreditCardObligationsForTransaction,
} from "@/services/credit-card-ledger";
import {
  completeFullyPaidInstallmentPlansForCard,
  generateCardStatementsInTransaction,
  refreshHistoricalCardStatements,
  settleStatementAndPriorRolloversInTransaction,
  statementPaymentDetails,
} from "@/services/credit-card-statement-service";
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

    const isPayingCurrentDebt = input.target === "current_debt" || !input.statementId;

    let statementIdToLink: string | null = null;
    let isFullPayment = false;
    let defaultDescription = "";
    let total = ZERO;
    let allocationsToCreate: Array<{ obligationEntryId: string; amount: Decimal }> = [];
    let statementToComplete: string | null = null;

    if (!isPayingCurrentDebt) {
      const oldest = await tx.creditCardStatement.findFirst({
        where: { workspaceId, cardWalletId: input.cardWalletId, status: "issued" },
        orderBy: [{ cycleEndDate: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      if (!oldest || oldest.id !== input.statementId) throw new AppError("CONFLICT", "Hãy thanh toán sao kê cũ nhất trước.");
      const { statement, dueByWallet, totalRemaining, allocations } = await statementPaymentDetails(tx, input.statementId!, input.sources);
      if (statement.status !== "issued" || statement.cardWalletId !== input.cardWalletId || statement.workspaceId !== workspaceId) {
        throw new AppError("CONFLICT", "Sao kê không còn khả dụng để thanh toán.");
      }
      const pendingPayment = await tx.transaction.findFirst({
        where: { creditCardStatementId: statement.id, workflowStatus: { in: ["pending", "scheduled"] }, deletedAt: null },
        select: { id: true },
      });
      if (pendingPayment) throw new AppError("CONFLICT", "Sao kê đang có giao dịch thanh toán chờ duyệt.");
      if (!totalRemaining.gt(0)) {
        throw new AppError("CONFLICT", "Sao kê đã được thanh toán đầy đủ.");
      }
      const supplied = new Map(input.sources.map((source) => [source.walletId, new Decimal(source.amount)]));
      for (const [walletId, amount] of supplied) {
        if (!amount.gt(0)) {
          throw new AppError("VALIDATION_ERROR", "Số tiền thanh toán từ mỗi ví phải lớn hơn 0.");
        }
        const maxDue = dueByWallet.get(walletId) ?? ZERO;
        if (amount.gt(maxDue)) {
          throw new AppError("VALIDATION_ERROR", `Số tiền trích từ ví vượt quá số còn thiếu của ví (${maxDue.toString()}).`);
        }
      }
      total = [...supplied.values()].reduce((sum, amount) => sum.plus(amount), ZERO);
      if (!total.gt(0) || total.gt(totalRemaining)) {
        throw new AppError("VALIDATION_ERROR", "Tổng số tiền thanh toán không hợp lệ.");
      }
      isFullPayment = total.gte(totalRemaining);
      defaultDescription = isFullPayment ? "Thanh toán sao kê thẻ tín dụng" : "Thanh toán trước một phần sao kê";
      statementIdToLink = statement.id;
      if (isFullPayment) {
        statementToComplete = statement.id;
      }
      allocationsToCreate = [...allocations].map(([obligationEntryId, amount]) => ({ obligationEntryId, amount }));
    } else {
      const pendingPayment = await tx.transaction.findFirst({
        where: {
          walletId: input.cardWalletId,
          purpose: "credit_card_payment",
          workflowStatus: { in: ["pending", "scheduled"] },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (pendingPayment) throw new AppError("CONFLICT", "Thẻ đang có giao dịch thanh toán chờ duyệt.");

      const totalOutstanding = await cardOutstanding(tx, input.cardWalletId);
      if (!totalOutstanding.gt(0)) {
        throw new AppError("CONFLICT", "Thẻ không có dư nợ cần thanh toán.");
      }

      const rawObligations = await tx.creditCardObligationEntry.findMany({
        where: { cardWalletId: input.cardWalletId },
        include: {
          paymentAllocations: { select: { amount: true } },
          statementItems: { select: { id: true } },
          transaction: {
            select: {
              installmentPlan: { select: { id: true, status: true } },
              installmentFeePlan: { select: { id: true, status: true } },
            },
          },
        },
        orderBy: [{ postedDate: "asc" }, { id: "asc" }],
      });
      const unbilledInstallmentIds = new Set(
        rawObligations
          .filter((entry) => {
            const isInstallment =
              Boolean((entry as { installmentPlanId?: string | null }).installmentPlanId) ||
              entry.transaction?.installmentPlan?.status === "active" ||
              entry.transaction?.installmentFeePlan?.status === "active";
            const isBilled = (entry.statementItems?.length ?? 0) > 0;
            return isInstallment && !isBilled;
          })
          .map((entry) => entry.id),
      );

      const entries = await getCardObligationBalances(tx, input.cardWalletId);
      const supplied = new Map(input.sources.map((source) => [source.walletId, new Decimal(source.amount)]));
      for (const [, amount] of supplied) {
        if (!amount.gt(0)) {
          throw new AppError("VALIDATION_ERROR", "Số tiền thanh toán từ mỗi ví phải lớn hơn 0.");
        }
      }
      total = [...supplied.values()].reduce((sum, amount) => sum.plus(amount), ZERO);
      if (!total.gt(0) || total.gt(totalOutstanding)) {
        throw new AppError("VALIDATION_ERROR", "Tổng số tiền thanh toán không hợp lệ.");
      }

      const paymentSources = input.sources.map((source) => ({ walletId: source.walletId, amount: new Decimal(source.amount) }));
      if (unbilledInstallmentIds.size === 0) {
        allocationsToCreate = allocateOldestObligations(entries, paymentSources);
      } else {
        const priorityEntries = entries.filter((entry) => !unbilledInstallmentIds.has(entry.id));
        const deferredEntries = entries.filter((entry) => unbilledInstallmentIds.has(entry.id));
        const combinedAllocations: Array<{ obligationEntryId: string; amount: Decimal }> = [];
        for (const source of paymentSources) {
          const totalWalletNet = entries
            .filter((entry) => entry.fundingWalletId === source.walletId)
            .reduce((sum, entry) => sum.plus(entry.amount.toString()).minus(entry.paid.toString()), ZERO);
          if (source.amount.gt(Decimal.max(totalWalletNet, ZERO))) {
            throw new AppError("VALIDATION_ERROR", "Số tiền trích từ ví vượt quá nghĩa vụ của ví đối với thẻ này.");
          }
          const priorityNet = Decimal.max(
            priorityEntries
              .filter((entry) => entry.fundingWalletId === source.walletId)
              .reduce((sum, entry) => sum.plus(entry.amount.toString()).minus(entry.paid.toString()), ZERO),
            ZERO,
          );
          const priorityPart = Decimal.min(source.amount, priorityNet);
          const deferredPart = source.amount.minus(priorityPart);
          if (priorityPart.gt(0)) {
            combinedAllocations.push(
              ...allocateOldestObligations(priorityEntries, [{ walletId: source.walletId, amount: priorityPart }]),
            );
          }
          if (deferredPart.gt(0)) {
            combinedAllocations.push(
              ...allocateOldestObligations(deferredEntries, [{ walletId: source.walletId, amount: deferredPart }]),
            );
          }
        }
        allocationsToCreate = combinedAllocations;
      }

      const oldestStatement = await tx.creditCardStatement.findFirst({
        where: { workspaceId, cardWalletId: input.cardWalletId, status: "issued" },
        orderBy: [{ cycleEndDate: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      statementIdToLink = oldestStatement?.id ?? null;
      if (oldestStatement) {
        const { totalRemaining: statementRemaining } = await statementPaymentDetails(tx, oldestStatement.id);
        if (total.gte(statementRemaining)) {
          statementToComplete = oldestStatement.id;
        }
      }

      isFullPayment = total.gte(totalOutstanding);
      defaultDescription = isFullPayment ? "Thanh toán toàn bộ dư nợ hiện tại" : "Thanh toán một phần dư nợ thẻ";
    }

    const record = await tx.transaction.create({
      data: {
        memberId: member.id,
        walletId: input.cardWalletId,
        type: "transfer",
        purpose: "credit_card_payment",
        amount: total,
        description: input.description ?? defaultDescription,
        date: databaseDate(input.date),
        postedDate: databaseDate(input.date),
        workflowStatus,
        creditCardStatementId: statementIdToLink,
        creditCardPaymentSources: {
          create: input.sources.map((source) => ({ sourceWalletId: source.walletId, amount: source.amount })),
        },
      },
    });
    if (workflowStatus === "approved") {
      await tx.creditCardPaymentAllocation.createMany({
        data: allocationsToCreate.map((allocation) => ({ paymentTransactionId: record.id, ...allocation })),
      });
      await applyBalance(tx, record);
      if (statementToComplete) {
        await settleStatementAndPriorRolloversInTransaction(tx, statementToComplete);
      } else if (statementIdToLink) {
        const { totalRemaining } = await statementPaymentDetails(tx, statementIdToLink);
        if (totalRemaining.lte(0)) {
          await settleStatementAndPriorRolloversInTransaction(tx, statementIdToLink);
        }
      }
      await completeFullyPaidInstallmentPlansForCard(tx, input.cardWalletId);
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
  const businessDate = getBusinessDateInTimeZone(member.workspace.timeZone, now);
  const timing = transactionTimingForDate(input.date, businessDate);
  const workflowStatus = workflowStatusForCreation(member.role.code, timing);

  return prisma.$transaction(async (tx) => {
    await lockWallets(tx, [input.cardWalletId]);
    await lockCardObligations(tx, input.cardWalletId);
    if (input.originalTransactionId) {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "TRANSACTION" WHERE "id" = CAST(${input.originalTransactionId} AS uuid) FOR UPDATE`,
      );
    }
    const card = await tx.workspaceWallet.findFirst({
      where: {
        workspaceId,
        walletId: input.cardWalletId,
        wallet: { kind: "credit_card", status: "active", deletedAt: null },
      },
      select: { walletId: true },
    });
    if (!card) throw new AppError("WORKSPACE_ISOLATION_VIOLATION", "Thẻ không thuộc nhóm này hoặc không còn hoạt động.");

    const original = input.originalTransactionId
      ? await tx.transaction.findFirst({
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
        })
      : null;

    if (input.originalTransactionId && !original) {
      throw new AppError("VALIDATION_ERROR", "Hãy chọn một giao dịch thẻ đã duyệt để hoàn tiền.");
    }

    if (original) {
      const alreadyRefunded = original.refundTransactions.reduce(
        (sum, refund) => sum.plus(refund.amount.toString()),
        ZERO,
      );
      const refundable = new Decimal(original.amount.toString()).minus(alreadyRefunded);
      if (input.amount.gt(refundable)) {
        throw new AppError("VALIDATION_ERROR", `Giao dịch này chỉ còn có thể hoàn ${refundable.toString()}.`);
      }
    }

    const record = await tx.transaction.create({
      data: {
        memberId: member.id,
        walletId: input.cardWalletId,
        categoryId: original?.categoryId ?? null,
        jarCode: original?.jarCode ?? null,
        type: "income",
        purpose: "credit_card_refund",
        amount: input.amount,
        description: input.description ?? (original ? "Hoàn tiền vào thẻ tín dụng" : "Hoàn tiền chi tiêu / Cashback"),
        date: databaseDate(input.date),
        postedDate: databaseDate(input.postedDate ?? input.date),
        workflowStatus,
        originalTransactionId: original?.id ?? null,
      },
    });
    if (workflowStatus === "approved") {
      await applyBalance(tx, record);
      await normalizeApprovedRefundAllocations(tx, record.id);
      await syncCreditCardObligationsForTransaction(tx, workspaceId, record.id);
      await refreshHistoricalCardStatements(tx, workspaceId, input.cardWalletId, businessDate);
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

function netObligationsByCard<
  T extends {
    cardWalletId: string;
    fundingWalletId: string;
    amount: Decimal.Value;
    paymentAllocations: Array<{ amount: Decimal.Value }>;
  },
>(obligations: T[]) {
  const byCard = new Map<string, T[]>();
  for (const entry of obligations) {
    const cardKey = entry.cardWalletId ?? "default-card";
    const list = byCard.get(cardKey) ?? [];
    list.push(entry);
    byCard.set(cardKey, list);
  }

  const netted: Array<{
    entry: T;
    original: Decimal;
    paid: Decimal;
    remaining: Decimal;
  }> = [];

  for (const cardEntries of byCard.values()) {
    const creditByWallet = new Map<string, Decimal>();
    const positiveEntries: Array<{
      entry: T;
      original: Decimal;
      paid: Decimal;
      remaining: Decimal;
    }> = [];

    for (const entry of cardEntries) {
      const original = new Decimal(entry.amount.toString());
      const paid = entry.paymentAllocations.reduce(
        (sum, allocation) => sum.plus(allocation.amount.toString()),
        ZERO,
      );
      const rawRemaining = original.minus(paid);
      if (rawRemaining.lt(0)) {
        creditByWallet.set(
          entry.fundingWalletId,
          (creditByWallet.get(entry.fundingWalletId) ?? ZERO).plus(rawRemaining.abs()),
        );
      } else if (rawRemaining.gt(0)) {
        positiveEntries.push({
          entry,
          original,
          paid,
          remaining: rawRemaining,
        });
      }
    }

    // Pass 1: Same-wallet FIFO offset
    for (const item of positiveEntries) {
      const sameWalletCredit = creditByWallet.get(item.entry.fundingWalletId) ?? ZERO;
      if (sameWalletCredit.gt(0) && item.remaining.gt(0)) {
        const used = Decimal.min(item.remaining, sameWalletCredit);
        item.remaining = item.remaining.minus(used);
        item.paid = item.paid.plus(used);
        creditByWallet.set(item.entry.fundingWalletId, sameWalletCredit.minus(used));
      }
    }

    // Pass 2: Cross-wallet FIFO offset on the same card
    let leftoverCardCredit = [...creditByWallet.values()].reduce(
      (sum, credit) => sum.plus(credit),
      ZERO,
    );
    if (leftoverCardCredit.gt(0)) {
      for (const item of positiveEntries) {
        if (!leftoverCardCredit.gt(0)) break;
        if (!item.remaining.gt(0)) continue;
        const used = Decimal.min(item.remaining, leftoverCardCredit);
        item.remaining = item.remaining.minus(used);
        item.paid = item.paid.plus(used);
        leftoverCardCredit = leftoverCardCredit.minus(used);
      }
    }

    for (const item of positiveEntries) {
      if (item.remaining.gt(0)) {
        netted.push(item);
      }
    }
  }

  return netted;
}

export async function getWorkspaceCreditCardCommitments(workspaceId: string) {
  const obligations = await prisma.creditCardObligationEntry.findMany({
    where: {
      workspaceId,
      card: { wallet: { deletedAt: null, status: "active" } },
    },
    select: {
      cardWalletId: true,
      fundingWalletId: true,
      amount: true,
      paymentAllocations: { select: { amount: true } },
    },
    orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
  });
  const netted = netObligationsByCard(obligations);
  const totals = new Map<string, Decimal>();
  for (const item of netted) {
    totals.set(
      item.entry.fundingWalletId,
      (totals.get(item.entry.fundingWalletId) ?? ZERO).plus(item.remaining),
    );
  }
  return new Map([...totals.entries()].map(([walletId, amount]) => [walletId, Decimal.max(amount, ZERO)]));
}

export type CreditCardCommitmentDetailItem = {
  id: string;
  cardWalletId: string;
  cardName: string;
  cardStatus: "active" | "deactive";
  cardDeleted: boolean;
  fundingWalletId: string;
  fundingWalletName: string;
  kind: "purchase" | "opening_debt" | "refund" | "adjustment";
  source: "transaction" | "opening_balance" | "adjustment";
  effectiveDate: string;
  postedDate: string;
  originalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  transactionId: string | null;
  transactionDescription: string | null;
  transactionType: "income" | "expense" | "transfer" | null;
  transactionPurpose:
    | "standard"
    | "credit_card_payment"
    | "credit_card_refund"
    | "credit_card_installment_fee"
    | "investment_contribution"
    | "investment_settlement"
    | null;
  categoryName: string | null;
  installmentPlan: {
    id: string;
    description: string | null;
    origin: "transaction" | "imported";
    termCount: number;
    paidTermCount: number;
    status: "pending" | "active" | "completed";
  } | null;
  statement: {
    id: string;
    cycleEndDate: string;
    dueDate: string;
    status: "issued" | "paid";
    paidAt: string | null;
  } | null;
};

export async function getWorkspaceCreditCardCommitmentDetails(
  workspaceId: string,
): Promise<CreditCardCommitmentDetailItem[]> {
  const obligations = await prisma.creditCardObligationEntry.findMany({
    where: {
      workspaceId,
      card: { wallet: { deletedAt: null, status: "active" } },
    },
    select: {
      id: true,
      cardWalletId: true,
      fundingWalletId: true,
      kind: true,
      source: true,
      effectiveDate: true,
      postedDate: true,
      amount: true,
      createdAt: true,
      card: {
        select: {
          wallet: {
            select: {
              name: true,
              status: true,
              deletedAt: true,
            },
          },
        },
      },
      fundingWallet: {
        select: {
          name: true,
        },
      },
      paymentAllocations: {
        select: {
          amount: true,
        },
      },
      transaction: {
        select: {
          id: true,
          description: true,
          type: true,
          purpose: true,
          category: {
            select: {
              name: true,
            },
          },
        },
      },
      installmentPlan: {
        select: {
          id: true,
          description: true,
          origin: true,
          termCount: true,
          paidTermCount: true,
          status: true,
        },
      },
      statementItems: {
        select: {
          statement: {
            select: {
              id: true,
              cycleEndDate: true,
              dueDate: true,
              status: true,
              paidAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
  });

  const netted = netObligationsByCard(obligations);
  netted.sort((a, b) => {
    const effDiff = b.entry.effectiveDate.getTime() - a.entry.effectiveDate.getTime();
    if (effDiff !== 0) return effDiff;
    return b.entry.createdAt.getTime() - a.entry.createdAt.getTime();
  });

  return netted.map(({ entry, original, paid, remaining }) => {
    const latestStatement = entry.statementItems[0]?.statement ?? null;
    return {
      id: entry.id,
      cardWalletId: entry.cardWalletId,
      cardName: entry.card.wallet.name,
      cardStatus: entry.card.wallet.status,
      cardDeleted: Boolean(entry.card.wallet.deletedAt),
      fundingWalletId: entry.fundingWalletId,
      fundingWalletName: entry.fundingWallet.name,
      kind: entry.kind,
      source: entry.source,
      effectiveDate: entry.effectiveDate.toISOString().slice(0, 10),
      postedDate: entry.postedDate.toISOString().slice(0, 10),
      originalAmount: original.toString(),
      paidAmount: paid.toString(),
      remainingAmount: remaining.toString(),
      transactionId: entry.transaction?.id ?? null,
      transactionDescription: entry.transaction?.description ?? null,
      transactionType: entry.transaction?.type ?? null,
      transactionPurpose: entry.transaction?.purpose ?? null,
      categoryName: entry.transaction?.category?.name ?? null,
      installmentPlan: entry.installmentPlan
        ? {
            id: entry.installmentPlan.id,
            description: entry.installmentPlan.description,
            origin: entry.installmentPlan.origin,
            termCount: entry.installmentPlan.termCount,
            paidTermCount: entry.installmentPlan.paidTermCount,
            status: entry.installmentPlan.status,
          }
        : null,
      statement: latestStatement
        ? {
            id: latestStatement.id,
            cycleEndDate: latestStatement.cycleEndDate.toISOString().slice(0, 10),
            dueDate: latestStatement.dueDate.toISOString().slice(0, 10),
            status: latestStatement.status,
            paidAt: latestStatement.paidAt ? latestStatement.paidAt.toISOString() : null,
          }
        : null,
    };
  });
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
  confirmLoss?: boolean,
) {
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  const businessDate = getBusinessDateInTimeZone(member.workspace?.timeZone ?? "Asia/Ho_Chi_Minh");

  const isVoidingAll = Boolean(confirmLoss || resolution?.action === "void_transactions");

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

    const approvedTransactionCount = await tx.transaction.count({
      where: {
        workflowStatus: "approved",
        member: { workspaceId },
        deletedAt: null,
        OR: [{ walletId: cardWalletId }, { toWalletId: cardWalletId }],
      },
    });
    const balance = new Decimal(link.wallet.currentBalance.toString());

    if (!isVoidingAll && resolution?.action !== "migrate_transactions") {
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
          totalAmount: { gt: 0 },
          paidAt: { not: null },
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

      await tx.creditCardStatementItem?.deleteMany?.({
        where: {
          OR: [
            { statement: { cardWalletId } },
            { obligationEntry: { cardWalletId } },
            { installment: { plan: { cardWalletId } } },
          ],
        },
      });
      await tx.creditCardStatement?.deleteMany?.({
        where: { cardWalletId },
      });
      await tx.creditCardInstallment?.deleteMany?.({
        where: { plan: { cardWalletId } },
      });
      await tx.creditCardInstallmentPlan?.deleteMany?.({
        where: { cardWalletId },
      });
      await tx.creditCardPaymentAllocation?.deleteMany?.({
        where: { obligationEntry: { cardWalletId } },
      });
      await tx.creditCardObligationEntry?.deleteMany?.({
        where: { cardWalletId },
      });
      await tx.creditCardOpeningAllocation?.deleteMany?.({
        where: { cardWalletId },
      });
    } else if (isVoidingAll) {
      const cardStatements = (await tx.creditCardStatement.findMany?.({
        where: { cardWalletId },
        select: { id: true },
      })) ?? [];
      const cardStatementIds = cardStatements.map((s) => s.id);

      const cardPlans = (await tx.creditCardInstallmentPlan.findMany?.({
        where: { cardWalletId },
        select: { id: true },
      })) ?? [];
      const cardPlanIds = cardPlans.map((p) => p.id);

      const cardTransactions = await tx.transaction.findMany({
        where: {
          deletedAt: null,
          member: { workspaceId },
          OR: [
            { walletId: cardWalletId },
            { toWalletId: cardWalletId },
            ...(cardStatementIds.length > 0
              ? [{ creditCardStatementId: { in: cardStatementIds } }]
              : []),
          ],
        },
        select: {
          id: true,
          type: true,
          purpose: true,
          amount: true,
          walletId: true,
          toWalletId: true,
          workflowStatus: true,
          creditCardPaymentSources: {
            select: { sourceWalletId: true, amount: true },
          },
        },
      });
      const cardTransactionIds = cardTransactions.map((t) => t.id);

      const netDeltaByWallet = new Map<string, Decimal>();
      const addWalletDelta = (targetId: string, delta: Decimal) => {
        if (!targetId || targetId === cardWalletId || delta.isZero()) return;
        netDeltaByWallet.set(targetId, (netDeltaByWallet.get(targetId) ?? ZERO).plus(delta));
      };

      for (const t of cardTransactions) {
        if (t.workflowStatus !== "approved") continue;
        if (t.purpose === "credit_card_payment") {
          const sources =
            t.creditCardPaymentSources ??
            (await tx.creditCardPaymentSource?.findMany?.({
              where: { paymentTransactionId: t.id },
            })) ??
            [];
          for (const source of sources) {
            addWalletDelta(source.sourceWalletId, new Decimal(source.amount.toString()));
          }
        } else if (t.type === "transfer") {
          const txAmount = new Decimal(t.amount.toString());
          if (t.walletId === cardWalletId && t.toWalletId) {
            addWalletDelta(t.toWalletId, txAmount.negated());
          } else if (t.toWalletId === cardWalletId && t.walletId && t.walletId !== cardWalletId) {
            addWalletDelta(t.walletId, txAmount);
          }
        }
      }

      for (const [assetWalletId, netDelta] of netDeltaByWallet.entries()) {
        if (netDelta.isZero()) continue;
        await lockWallets(tx, [assetWalletId]);
        if (typeof tx.wallet.findFirst === "function") {
          const assetWallet = await tx.wallet.findFirst({
            where: { id: assetWalletId, deletedAt: null },
            select: { id: true, currentBalance: true },
          });
          if (!assetWallet) continue;
          const nextAssetBalance = new Decimal(assetWallet.currentBalance.toString()).plus(netDelta);
          if (nextAssetBalance.lt(0)) {
            throw new AppError(
              "CONFLICT",
              "Không thể hủy toàn bộ giao dịch thẻ vì ví liên kết không còn đủ số dư để hoàn trả giao dịch rút/chuyển tiền từ thẻ.",
            );
          }
        }
        await tx.wallet.update({
          where: { id: assetWalletId },
          data: {
            currentBalance: netDelta.gt(0)
              ? { increment: netDelta }
              : { decrement: netDelta.abs() },
          },
        });
      }

      if (cardTransactionIds.length > 0) {
        await tx.creditCardPaymentReservation?.deleteMany?.({
          where: { paymentTransactionId: { in: cardTransactionIds } },
        });
      }
      await tx.creditCardPaymentReservation?.deleteMany?.({
        where: { sourceWalletId: cardWalletId },
      });

      if (cardTransactionIds.length > 0) {
        await tx.creditCardPaymentAllocation?.deleteMany?.({
          where: { paymentTransactionId: { in: cardTransactionIds } },
        });
        await tx.creditCardPaymentSource?.deleteMany?.({
          where: { paymentTransactionId: { in: cardTransactionIds } },
        });
      }
      await tx.creditCardPaymentAllocation?.deleteMany?.({
        where: { obligationEntry: { cardWalletId } },
      });
      await tx.creditCardPaymentSource?.deleteMany?.({
        where: { sourceWalletId: cardWalletId },
      });

      await tx.creditCardStatementItem?.deleteMany?.({
        where: {
          OR: [
            { statement: { cardWalletId } },
            { obligationEntry: { cardWalletId } },
            ...(cardPlanIds.length > 0
              ? [{ installment: { planId: { in: cardPlanIds } } }]
              : []),
          ],
        },
      });

      await tx.creditCardObligationEntry?.deleteMany?.({
        where: {
          OR: [
            { cardWalletId },
            ...(cardTransactionIds.length > 0
              ? [{ transactionId: { in: cardTransactionIds } }]
              : []),
            ...(cardPlanIds.length > 0
              ? [{ installmentPlanId: { in: cardPlanIds } }]
              : []),
          ],
        },
      });

      if (cardPlanIds.length > 0) {
        await tx.creditCardInstallment?.deleteMany?.({
          where: { planId: { in: cardPlanIds } },
        });
      }
      await tx.creditCardInstallmentPlan?.deleteMany?.({
        where: { cardWalletId },
      });

      if (cardStatementIds.length > 0) {
        await tx.transaction.updateMany?.({
          where: { creditCardStatementId: { in: cardStatementIds } },
          data: { creditCardStatementId: null },
        });
      }
      await tx.creditCardStatement?.deleteMany?.({
        where: { cardWalletId },
      });

      if (cardTransactionIds.length > 0) {
        await tx.creditCardAllocation?.deleteMany?.({
          where: { transactionId: { in: cardTransactionIds } },
        });
      }
      await tx.creditCardOpeningAllocation?.deleteMany?.({
        where: { cardWalletId },
      });

      if (cardTransactionIds.length > 0) {
        if (tx.transaction.updateMany) {
          await tx.transaction.updateMany({
            where: { id: { in: cardTransactionIds } },
            data: { deletedAt: new Date() },
          });
        } else {
          for (const t of cardTransactions) {
            await tx.transaction.update({
              where: { id: t.id },
              data: { deletedAt: new Date() },
            });
          }
        }
      }

      await tx.recurringTransaction?.updateMany?.({
        where: {
          workspaceId,
          deletedAt: null,
          OR: [{ walletId: cardWalletId }, { toWalletId: cardWalletId }],
        },
        data: { deletedAt: new Date() },
      });
    } else if (resolution && resolution.action === "migrate_transactions") {
      if (resolution.targetWalletId === cardWalletId) {
        throw new AppError("VALIDATION_ERROR", "Ví đích phải khác thẻ đang xóa.");
      }
      const recurringCount =
        (await tx.recurringTransaction?.count?.({
          where: {
            workspaceId,
            deletedAt: null,
            OR: [{ walletId: cardWalletId }, { toWalletId: cardWalletId }],
          },
        })) ?? 0;
      if (recurringCount > 0) {
        throw new AppError(
          "CONFLICT",
          `Thẻ còn ${recurringCount} giao dịch định kỳ liên kết. Vui lòng hủy giao dịch định kỳ trước khi xóa thẻ.`,
        );
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
      if (targetLink.wallet.status && targetLink.wallet.status !== "active") {
        throw new AppError("CONFLICT", "Ví đích phải đang hoạt động.");
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

      for (const t of cardTransactions) {
        if (t.installmentPlan?.status === "pending") {
          await tx.creditCardInstallmentPlan.delete({ where: { id: t.installmentPlan.id } });
        }
        if (targetLink.wallet.kind === "asset" && t.walletId === cardWalletId && t.purpose === "credit_card_payment") {
          await tx.transaction.update({
            where: { id: t.id },
            data: { deletedAt: new Date() },
          });
          continue;
        }
        if (
          targetLink.wallet.kind === "asset" &&
          t.type === "transfer" &&
          ((t.walletId === cardWalletId && t.toWalletId === resolution.targetWalletId) ||
            (t.toWalletId === cardWalletId && t.walletId === resolution.targetWalletId))
        ) {
          await tx.transaction.update({
            where: { id: t.id },
            data: { deletedAt: new Date() },
          });
          if (t.walletId === cardWalletId) {
            await tx.creditCardObligationEntry.deleteMany({ where: { transactionId: t.id } });
            await tx.creditCardAllocation.deleteMany({ where: { transactionId: t.id } });
          }
          continue;
        }
        if (
          t.walletId === cardWalletId &&
          (t.type === "expense" || t.type === "transfer" || t.purpose === "credit_card_refund")
        ) {
          await tx.transaction.update({
            where: { id: t.id },
            data: { walletId: resolution.targetWalletId },
          });
          if (targetLink.wallet.kind === "asset") {
            await tx.creditCardObligationEntry.deleteMany({ where: { transactionId: t.id } });
            await tx.creditCardAllocation.deleteMany({ where: { transactionId: t.id } });
          }
        } else if (t.toWalletId === cardWalletId) {
          await tx.transaction.update({
            where: { id: t.id },
            data: { toWalletId: resolution.targetWalletId },
          });
        }
      }

      const cardTransactionIds = cardTransactions.map((t) => t.id);
      if (cardTransactionIds.length > 0) {
        await tx.creditCardPaymentReservation.updateMany({
          where: { paymentTransactionId: { in: cardTransactionIds }, releasedAt: null },
          data: { releasedAt: new Date() },
        });
      }
      await tx.transaction.updateMany({
        where: { creditCardStatement: { cardWalletId } },
        data: { creditCardStatementId: null },
      });
      await tx.creditCardStatementItem.deleteMany({
        where: { statement: { cardWalletId } },
      });
      await tx.creditCardStatement.deleteMany({
        where: { cardWalletId },
      });

      if (targetLink.wallet.kind === "asset") {
        if (!balance.isZero()) {
          const newTargetBalance = new Decimal(targetLink.wallet.currentBalance.toString()).minus(balance);
          await tx.wallet.update({
            where: { id: resolution.targetWalletId },
            data: { currentBalance: newTargetBalance },
          });
        }
        await tx.creditCardPaymentAllocation?.deleteMany?.({
          where: { obligationEntry: { cardWalletId } },
        });
        await tx.creditCardObligationEntry?.deleteMany?.({
          where: { cardWalletId },
        });
        await tx.creditCardOpeningAllocation?.deleteMany?.({
          where: { cardWalletId },
        });
        await tx.creditCardInstallment?.deleteMany?.({
          where: { plan: { cardWalletId } },
        });
        await tx.creditCardInstallmentPlan.deleteMany({
          where: { cardWalletId },
        });
      } else if (targetLink.wallet.kind === "credit_card") {
        if (!balance.isZero()) {
          const newTargetBalance = new Decimal(targetLink.wallet.currentBalance.toString()).plus(balance);
          await tx.wallet.update({
            where: { id: resolution.targetWalletId },
            data: { currentBalance: newTargetBalance },
          });
        }
        await tx.creditCardObligationEntry?.updateMany?.({
          where: { cardWalletId },
          data: { cardWalletId: resolution.targetWalletId },
        });
        const openingAllocations =
          (await tx.creditCardOpeningAllocation?.findMany?.({
            where: { cardWalletId },
          })) ?? [];
        for (const row of openingAllocations) {
          await tx.creditCardOpeningAllocation.upsert({
            where: {
              cardWalletId_fundingWalletId: {
                cardWalletId: resolution.targetWalletId,
                fundingWalletId: row.fundingWalletId,
              },
            },
            update: {
              amount: { increment: row.amount },
            },
            create: {
              cardWalletId: resolution.targetWalletId,
              fundingWalletId: row.fundingWalletId,
              amount: row.amount,
            },
          });
        }
        await tx.creditCardOpeningAllocation?.deleteMany?.({
          where: { cardWalletId },
        });
        await tx.creditCardInstallmentPlan?.updateMany?.({
          where: { cardWalletId, status: { in: ["active", "completed"] } },
          data: { cardWalletId: resolution.targetWalletId },
        });
        await tx.creditCardInstallmentPlan.deleteMany({
          where: { cardWalletId, status: "pending" },
        });
        if (
          typeof tx.creditCardProfile?.findUnique === "function" &&
          typeof tx.creditCardStatement?.findMany === "function"
        ) {
          await refreshHistoricalCardStatements(
            tx,
            workspaceId,
            resolution.targetWalletId,
            businessDate,
          );
        }
        if (
          typeof tx.wallet?.findUniqueOrThrow === "function" &&
          typeof tx.creditCardObligationEntry?.findMany === "function"
        ) {
          await assertCardBalanceReconciled(tx, resolution.targetWalletId);
        }
      }
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
          confirmLoss: isVoidingAll,
          resolution: resolution?.action ?? (isVoidingAll ? "void_transactions" : null),
          targetWalletId: resolution?.action === "migrate_transactions" ? resolution.targetWalletId : null,
          discardedOpeningBalance:
            approvedTransactionCount === 0 ? balance.toString() : null,
        },
      },
    });

    return { ok: true as const };
  });
}
