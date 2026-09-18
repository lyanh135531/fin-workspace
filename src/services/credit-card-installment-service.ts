import Decimal from "decimal.js";
import { Prisma } from "@/generated/prisma/client";
import type { ImportCreditCardInstallmentInput, InstallmentInput, RegisterCreditCardInstallmentInput } from "@/domain";
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
  if (!original) throw new AppError("CONFLICT", "Kế hoạch trả góp giao dịch bị thiếu giao dịch gốc.");
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

function assertValidImportedStatementDate(
  firstStatementDate: string,
  effectiveDate: string,
  closingDay: number,
  latestClosed: string | null,
) {
  let candidate = firstStatementOnOrAfter(effectiveDate, closingDay);
  if (latestClosed && candidate <= latestClosed) {
    candidate = nextStatementDate(latestClosed, closingDay);
  }
  for (let index = 0; index < 60; index += 1) {
    if (candidate === firstStatementDate) return;
    if (candidate > firstStatementDate) break;
    candidate = nextStatementDate(candidate, closingDay);
  }
  throw new AppError("VALIDATION_ERROR", "Kỳ sao kê bắt đầu không khớp lịch chốt của thẻ.");
}

export async function importCreditCardInstallment(
  userId: string,
  workspaceId: string,
  input: ImportCreditCardInstallmentInput,
  now = new Date(),
) {
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  const effectiveDate = getBusinessDateInTimeZone(member.workspace.timeZone, now);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT "wallet_id" FROM "CREDIT_CARD_PROFILE" WHERE "wallet_id" = CAST(${input.cardWalletId} AS uuid) FOR UPDATE`,
    );
    const card = await tx.workspaceWallet.findFirst({
      where: {
        workspaceId,
        walletId: input.cardWalletId,
        wallet: { kind: "credit_card", status: "active", deletedAt: null },
      },
      select: {
        wallet: {
          select: {
            currentBalance: true,
            creditCardProfile: {
              select: {
                creditLimit: true,
                statementClosingDay: true,
                paymentDueDay: true,
                statements: { orderBy: { cycleEndDate: "desc" }, take: 1, select: { cycleEndDate: true } },
              },
            },
          },
        },
      },
    });
    const profile = card?.wallet.creditCardProfile;
    if (!card || !profile) {
      throw new AppError("WORKSPACE_ISOLATION_VIOLATION", "Thẻ không khả dụng trong nhóm tài chính này.");
    }
    const fundingWalletIds = input.allocations.map((allocation) => allocation.walletId);
    const fundingWallets = await tx.workspaceWallet.findMany({
      where: {
        workspaceId,
        walletId: { in: fundingWalletIds },
        wallet: { kind: "asset", status: "active", deletedAt: null },
      },
      select: { walletId: true },
    });
    if (new Set(fundingWallets.map((item) => item.walletId)).size !== new Set(fundingWalletIds).size) {
      throw new AppError("WORKSPACE_ISOLATION_VIOLATION", "Ví trả thẻ phải là ví tài sản đang hoạt động trong nhóm này.");
    }
    const latestClosed = profile.statements[0]?.cycleEndDate
      ? isoDate(profile.statements[0].cycleEndDate)
      : null;
    assertValidImportedStatementDate(
      input.firstStatementDate,
      effectiveDate,
      profile.statementClosingDay,
      latestClosed,
    );
    if (
      input.balanceMode === "add_to_balance"
      && new Decimal(card.wallet.currentBalance.toString()).plus(input.remainingAmount).gt(profile.creditLimit.toString())
    ) {
      throw new AppError("VALIDATION_ERROR", "Khoản trả góp nhập vào làm vượt hạn mức thẻ tín dụng.");
    }

    const plan = await tx.creditCardInstallmentPlan.create({
      data: {
        workspaceId,
        cardWalletId: input.cardWalletId,
        transactionId: null,
        createdByMemberId: member.id,
        origin: "imported",
        description: input.description,
        termCount: input.termCount,
        paidTermCount: input.paidTermCount,
        feeAmount: ZERO,
        importBalanceMode: input.balanceMode,
        effectiveDate: dbDate(effectiveDate),
        status: "active",
        activatedAt: new Date(),
      },
    });

    if (input.balanceMode === "included_opening_debt") {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "CREDIT_CARD_OBLIGATION_ENTRY" WHERE "card_wallet_id" = CAST(${input.cardWalletId} AS uuid) FOR UPDATE`,
      );
      for (const allocation of input.allocations) {
        const candidates = await tx.creditCardObligationEntry.findMany({
          where: {
            workspaceId,
            cardWalletId: input.cardWalletId,
            fundingWalletId: allocation.walletId,
            source: "opening_balance",
            installmentPlanId: null,
            amount: { gt: 0 },
            paymentAllocations: { none: {} },
            statementItems: { none: {} },
          },
          orderBy: [{ postedDate: "asc" }, { id: "asc" }],
        });
        let remaining = new Decimal(allocation.amount);
        for (const candidate of candidates) {
          if (!remaining.gt(0)) break;
          const candidateAmount = new Decimal(candidate.amount.toString());
          const moved = Decimal.min(remaining, candidateAmount);
          if (moved.eq(candidateAmount)) {
            await tx.creditCardObligationEntry.update({
              where: { id: candidate.id },
              data: { installmentPlanId: plan.id },
            });
          } else {
            await tx.creditCardObligationEntry.update({
              where: { id: candidate.id },
              data: { amount: candidateAmount.minus(moved) },
            });
            await tx.creditCardObligationEntry.create({
              data: {
                workspaceId,
                cardWalletId: input.cardWalletId,
                fundingWalletId: allocation.walletId,
                installmentPlanId: plan.id,
                kind: candidate.kind,
                source: candidate.source,
                effectiveDate: candidate.effectiveDate,
                postedDate: candidate.postedDate,
                amount: moved,
                idempotencyKey: `installment-import:${plan.id}:${candidate.id}`,
                metadata: { importedFromObligationId: candidate.id },
              },
            });
          }
          remaining = remaining.minus(moved);
        }
        if (remaining.gt(0)) {
          throw new AppError(
            "VALIDATION_ERROR",
            "Dư nợ ban đầu chưa vào sao kê của ví đã chọn không đủ để phân loại thành trả góp.",
          );
        }
      }
    } else {
      await tx.creditCardObligationEntry.createMany({
        data: input.allocations.map((allocation) => ({
          workspaceId,
          cardWalletId: input.cardWalletId,
          fundingWalletId: allocation.walletId,
          installmentPlanId: plan.id,
          kind: "opening_debt" as const,
          source: "adjustment" as const,
          effectiveDate: dbDate(effectiveDate),
          postedDate: dbDate(effectiveDate),
          amount: allocation.amount,
          idempotencyKey: `installment-import:${plan.id}:${allocation.walletId}`,
          metadata: { importBalanceMode: input.balanceMode },
        })),
      });
      await tx.wallet.update({
        where: { id: input.cardWalletId },
        data: { currentBalance: { increment: input.remainingAmount } },
      });
    }

    const remainingTermCount = input.termCount - input.paidTermCount;
    const amounts = installmentAmounts(input.remainingAmount, remainingTermCount);
    let statementDate = input.firstStatementDate;
    await tx.creditCardInstallment.createMany({
      data: amounts.map((principalAmount, index) => {
        const currentStatementDate = statementDate;
        statementDate = nextStatementDate(statementDate, profile.statementClosingDay);
        return {
          planId: plan.id,
          installmentNo: input.paidTermCount + index + 1,
          statementDate: dbDate(currentStatementDate),
          dueDate: dbDate(dueDateAfterStatement(currentStatementDate, profile.paymentDueDay)),
          principalAmount,
          feeAmount: ZERO,
        };
      }),
    });
    await assertCardBalanceReconciled(tx, input.cardWalletId);
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "credit_card.installment_imported",
        entityType: "credit_card_installment_plan",
        entityId: plan.id,
        metadata: {
          termCount: input.termCount,
          paidTermCount: input.paidTermCount,
          remainingAmount: input.remainingAmount.toString(),
          balanceMode: input.balanceMode,
          firstStatementDate: input.firstStatementDate,
        },
      },
    });
    return plan;
  });
}

export async function deleteCreditCardInstallmentPlan(
  userId: string,
  workspaceId: string,
  planId: string,
) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "CREDIT_CARD_EQUAL_INSTALLMENT_PLAN" WHERE "id" = CAST(${planId} AS uuid) FOR UPDATE`,
    );
    const plan = await tx.creditCardInstallmentPlan.findFirst({
      where: { id: planId, workspaceId },
      include: {
        importedObligations: {
          include: { paymentAllocations: { select: { id: true } }, statementItems: { select: { id: true } } },
        },
        installments: { include: { statementItems: { select: { id: true } } } },
        feeTransaction: {
          include: {
            creditCardObligationEntries: {
              include: { paymentAllocations: { select: { id: true } }, statementItems: { select: { id: true } } },
            },
          },
        },
      },
    });
    if (!plan) throw new AppError("NOT_FOUND", "Không tìm thấy khoản trả góp.");
    const locked =
      plan.importedObligations.some(
        (entry) => entry.paymentAllocations.length > 0 || entry.statementItems.length > 0,
      ) ||
      plan.installments.some((installment) => installment.statementItems.length > 0) ||
      Boolean(
        plan.feeTransaction?.creditCardObligationEntries.some(
          (entry) => entry.paymentAllocations.length > 0 || entry.statementItems.length > 0,
        ),
      );
    if (locked) {
      throw new AppError("CONFLICT", "Khoản trả góp đã vào sao kê hoặc được thanh toán nên không thể xóa.");
    }

    if (plan.origin === "imported" || plan.importBalanceMode || !plan.transactionId) {
      const importedAmount = plan.importedObligations.reduce(
        (sum, entry) => sum.plus(entry.amount.toString()),
        ZERO,
      );
      if (plan.importBalanceMode === "add_to_balance") {
        await tx.wallet.update({
          where: { id: plan.cardWalletId },
          data: { currentBalance: { decrement: importedAmount } },
        });
        await tx.creditCardObligationEntry.deleteMany({ where: { installmentPlanId: plan.id } });
      } else {
        await tx.creditCardObligationEntry.updateMany({
          where: { installmentPlanId: plan.id },
          data: { installmentPlanId: null },
        });
      }
      await tx.creditCardInstallment.deleteMany({ where: { planId: plan.id } });
      await tx.creditCardInstallmentPlan.delete({ where: { id: plan.id } });
      await assertCardBalanceReconciled(tx, plan.cardWalletId);
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "credit_card.installment_import_deleted",
          entityType: "credit_card_installment_plan",
          entityId: plan.id,
          metadata: { importedAmount: importedAmount.toString(), balanceMode: plan.importBalanceMode },
        },
      });
      return { id: plan.id };
    }

    // origin === "transaction"
    const feeId = plan.feeTransactionId;
    if (feeId) {
      const feeAmount = new Decimal(plan.feeAmount.toString());
      // Disconnect fee foreign key from plan first
      await tx.creditCardInstallmentPlan.update({
        where: { id: plan.id },
        data: { feeTransactionId: null },
      });
      // Decrement currentBalance on wallet by feeAmount
      await tx.wallet.update({
        where: { id: plan.cardWalletId },
        data: { currentBalance: { decrement: feeAmount } },
      });
      // Delete obligations, allocations, and transaction of the fee
      await tx.creditCardObligationEntry.deleteMany({ where: { transactionId: feeId } });
      await tx.creditCardAllocation.deleteMany({ where: { transactionId: feeId } });
      await tx.transaction.delete({ where: { id: feeId } });
    }

    await tx.creditCardInstallment.deleteMany({ where: { planId: plan.id } });
    await tx.creditCardInstallmentPlan.delete({ where: { id: plan.id } });
    await assertCardBalanceReconciled(tx, plan.cardWalletId);
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "credit_card.installment_deleted",
        entityType: "credit_card_installment_plan",
        entityId: plan.id,
        metadata: { transactionId: plan.transactionId },
      },
    });
    return { id: plan.id };
  });
}

export const deleteImportedCreditCardInstallment = deleteCreditCardInstallmentPlan;
