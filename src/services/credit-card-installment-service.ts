import Decimal from "decimal.js";
import { Prisma } from "@/generated/prisma/client";
import type { InstallmentInput, RegisterCreditCardInstallmentInput } from "@/domain";
import { dueDateAfterStatement, firstStatementOnOrAfter, installmentAmounts, nextStatementDate } from "@/domain";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { assertCardBalanceReconciled, syncCreditCardObligationsForTransaction } from "@/services/credit-card-ledger";
import { requireWorkspaceMember } from "@/services/workspace-access";
import { generateCardStatementsInTransaction } from "@/services/credit-card-statement-service";

type Tx = Prisma.TransactionClient;
const ZERO = new Decimal(0);

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function proportionalAmounts(total: Decimal, shares: Array<{ amount: { toString(): string } }>) {
  const base = shares.reduce((sum, share) => sum.plus(share.amount.toString()), ZERO);
  let remaining = total;
  return shares.map((share, index) => {
    const amount = index === shares.length - 1
      ? remaining
      : total.times(share.amount.toString()).div(base).toDecimalPlaces(4, Decimal.ROUND_DOWN);
    remaining = remaining.minus(amount);
    return amount;
  });
}

export async function activateInstallmentPlanInTransaction(tx: Tx, workspaceId: string, planId: string) {
  const plan = await tx.creditCardInstallmentPlan.findFirst({
    where: { id: planId, workspaceId },
    include: {
      card: { include: { wallet: { select: { currentBalance: true } }, statements: { orderBy: { cycleEndDate: "desc" }, take: 1 } } },
      transaction: {
        include: {
          creditCardAllocations: true,
          refundTransactions: { where: { deletedAt: null, workflowStatus: { not: "rejected" } }, select: { id: true } },
          creditCardObligationEntries: { include: { paymentAllocations: { select: { id: true } }, statementItems: { select: { id: true } } } },
        },
      },
    },
  });
  if (!plan) throw new AppError("NOT_FOUND", "Không tìm thấy kế hoạch trả góp.");
  if (plan.status === "active" || plan.status === "completed") return plan;
  const original = plan.transaction;
  if (original.workflowStatus !== "approved" || original.deletedAt || original.type !== "expense" || original.purpose !== "standard") {
    throw new AppError("CONFLICT", "Giao dịch chưa đủ điều kiện kích hoạt trả góp.");
  }
  if (!original.creditCardAllocations.length || original.refundTransactions.length) {
    throw new AppError("CONFLICT", "Giao dịch đã hoàn tiền hoặc thiếu phân bổ nguồn trả thẻ.");
  }
  if (original.creditCardObligationEntries.some((entry) => entry.paymentAllocations.length || entry.statementItems.length)) {
    throw new AppError("CONFLICT", "Giao dịch đã được thanh toán hoặc đã vào sao kê.");
  }

  let feeTransactionId: string | null = null;
  if (new Decimal(plan.feeAmount.toString()).gt(0)) {
    if (new Decimal(plan.card.wallet.currentBalance.toString()).plus(plan.feeAmount.toString()).gt(plan.card.creditLimit.toString())) {
      throw new AppError("VALIDATION_ERROR", "Phí trả góp làm vượt hạn mức thẻ tín dụng.");
    }
    const feeCategory = await tx.category.findFirst({
      where: { workspaceId, code: "EXPENSE_INSTALLMENT_FEE", status: "active", deletedAt: null },
      select: { id: true, jarCode: true },
    });
    if (!feeCategory?.jarCode) throw new AppError("CONFLICT", "Thiếu danh mục Phí tài chính trong nhóm.");
    const feeShares = proportionalAmounts(new Decimal(plan.feeAmount.toString()), original.creditCardAllocations);
    const fee = await tx.transaction.create({
      data: {
        memberId: plan.createdByMemberId,
        walletId: original.walletId,
        categoryId: feeCategory.id,
        type: "expense",
        purpose: "credit_card_installment_fee",
        workflowStatus: "approved",
        amount: plan.feeAmount,
        description: `Phí trả góp: ${original.description ?? "giao dịch thẻ"}`,
        date: plan.effectiveDate,
        postedDate: plan.effectiveDate,
        jarCode: feeCategory.jarCode,
        creditCardAllocations: {
          create: original.creditCardAllocations.map((allocation, index) => ({
            fundingWalletId: allocation.fundingWalletId,
            amount: feeShares[index],
          })),
        },
      },
    });
    await tx.wallet.update({ where: { id: original.walletId }, data: { currentBalance: { increment: plan.feeAmount } } });
    await syncCreditCardObligationsForTransaction(tx, workspaceId, fee.id);
    feeTransactionId = fee.id;
  }

  const principalParts = installmentAmounts(original.amount.toString(), plan.termCount);
  let statementDate = firstStatementOnOrAfter(isoDate(plan.effectiveDate), plan.card.statementClosingDay);
  const latestClosed = plan.card.statements[0]?.cycleEndDate ? isoDate(plan.card.statements[0].cycleEndDate) : null;
  if (latestClosed && statementDate <= latestClosed) statementDate = nextStatementDate(latestClosed, plan.card.statementClosingDay);
  await tx.creditCardInstallment.createMany({
    data: principalParts.map((principalAmount, index) => {
      const currentStatementDate = statementDate;
      statementDate = nextStatementDate(statementDate, plan.card.statementClosingDay);
      return {
        planId: plan.id,
        installmentNo: index + 1,
        statementDate: dbDate(currentStatementDate),
        dueDate: dbDate(dueDateAfterStatement(currentStatementDate, plan.card.paymentDueDay)),
        principalAmount,
        feeAmount: index === 0 ? plan.feeAmount : ZERO,
      };
    }),
  });
  const activated = await tx.creditCardInstallmentPlan.update({
    where: { id: plan.id },
    data: { status: "active", feeTransactionId, activatedAt: new Date() },
  });
  await assertCardBalanceReconciled(tx, original.walletId);
  return activated;
}

export async function createInstallmentPlanInTransaction(
  tx: Tx,
  workspaceId: string,
  memberId: string,
  transactionId: string,
  effectiveDate: string,
  input: InstallmentInput,
  activate: boolean,
) {
  const transaction = await tx.transaction.findFirst({
    where: { id: transactionId, member: { workspaceId }, wallet: { kind: "credit_card", workspaceLinks: { some: { workspaceId } } } },
    select: { walletId: true },
  });
  if (!transaction) throw new AppError("VALIDATION_ERROR", "Trả góp chỉ áp dụng cho giao dịch chi tiêu thẻ.");
  const plan = await tx.creditCardInstallmentPlan.create({
    data: {
      workspaceId,
      cardWalletId: transaction.walletId,
      transactionId,
      createdByMemberId: memberId,
      termCount: input.termCount,
      feeAmount: input.feeAmount,
      effectiveDate: dbDate(effectiveDate),
      status: "pending",
    },
  });
  return activate ? activateInstallmentPlanInTransaction(tx, workspaceId, plan.id) : plan;
}

export async function registerCreditCardInstallment(
  userId: string,
  workspaceId: string,
  input: RegisterCreditCardInstallmentInput,
  now = new Date(),
) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  const effectiveDate = getBusinessDateInTimeZone(member.workspace.timeZone, now);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "TRANSACTION" WHERE "id" = CAST(${input.transactionId} AS uuid) FOR UPDATE`);
    const original = await tx.transaction.findFirst({
      where: {
        id: input.transactionId,
        member: { workspaceId },
        wallet: { kind: "credit_card", workspaceLinks: { some: { workspaceId } } },
        type: "expense",
        purpose: "standard",
        workflowStatus: "approved",
        deletedAt: null,
        installmentPlan: null,
      },
      include: {
        creditCardObligationEntries: { include: { paymentAllocations: true, statementItems: true } },
        refundTransactions: { where: { deletedAt: null, workflowStatus: { not: "rejected" } }, select: { id: true } },
      },
    });
    if (!original) throw new AppError("NOT_FOUND", "Không tìm thấy giao dịch thẻ có thể chuyển trả góp.");
    await generateCardStatementsInTransaction(tx, workspaceId, original.walletId, getBusinessDateInTimeZone(member.workspace.timeZone, now));
    const newlyStatemented = await tx.creditCardStatementItem.count({ where: { obligationEntry: { transactionId: original.id } } });
    if (newlyStatemented || original.refundTransactions.length || original.creditCardObligationEntries.some((entry) => entry.paymentAllocations.length || entry.statementItems.length)) {
      throw new AppError("CONFLICT", "Chỉ giao dịch chưa thanh toán, chưa hoàn tiền và chưa vào sao kê mới được chuyển trả góp.");
    }
    const plan = await createInstallmentPlanInTransaction(tx, workspaceId, member.id, original.id, effectiveDate, input, true);
    await tx.auditLog.create({
      data: { workspaceId, actorUserId: userId, action: "credit_card.installment_registered", entityType: "credit_card_installment_plan", entityId: plan.id, metadata: { transactionId: original.id, termCount: input.termCount, feeAmount: input.feeAmount.toString() } },
    });
    return plan;
  });
}
