import Decimal from "decimal.js";
import { Prisma } from "@/generated/prisma/client";
import { dueDateAfterStatement, firstStatementOnOrAfter, installmentAmounts, nextStatementDate } from "@/domain";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;
const ZERO = new Decimal(0);

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function nextDay(value: string) {
  const date = dbDate(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return isoDate(date);
}

function shareForInstallment(amount: Decimal.Value, termCount: number, installmentNo: number) {
  return installmentAmounts(amount, termCount)[installmentNo - 1];
}

async function createStatementForCycle(
  tx: Tx,
  workspaceId: string,
  cardWalletId: string,
  cycleStart: string,
  cycleEnd: string,
  dueDay: number,
) {
  const regular = await tx.creditCardObligationEntry.findMany({
    where: {
      workspaceId,
      cardWalletId,
      postedDate: { lte: dbDate(cycleEnd) },
      statementItems: { none: {} },
      OR: [
        { transactionId: null },
        { transaction: { installmentPlan: null, installmentFeePlan: null } },
      ],
    },
    include: { paymentAllocations: { select: { amount: true } } },
    orderBy: [{ postedDate: "asc" }, { id: "asc" }],
  });
  const installments = await tx.creditCardInstallment.findMany({
    where: { statementDate: dbDate(cycleEnd), plan: { workspaceId, cardWalletId, status: "active" } },
    include: {
      plan: {
        include: {
          transaction: { include: { creditCardAllocations: true, creditCardObligationEntries: true } },
          feeTransaction: { include: { creditCardAllocations: true, creditCardObligationEntries: true } },
        },
      },
    },
    orderBy: [{ planId: "asc" }, { installmentNo: "asc" }],
  });

  const items: Array<{ obligationEntryId: string; installmentId?: string; fundingWalletId: string; amount: Decimal; isCarry?: boolean }> = [];
  const [priorItems, priorPayments] = await Promise.all([
    tx.creditCardStatementItem.findMany({
      where: { isCarry: false, statement: { workspaceId, cardWalletId } },
      select: { fundingWalletId: true, amount: true },
    }),
    tx.transaction.findMany({
      where: { creditCardStatement: { workspaceId, cardWalletId }, purpose: "credit_card_payment", workflowStatus: "approved", deletedAt: null },
      select: { creditCardPaymentSources: { select: { sourceWalletId: true, amount: true } } },
    }),
  ]);
  const carriedByWallet = new Map<string, Decimal>();
  for (const item of priorItems) carriedByWallet.set(item.fundingWalletId, (carriedByWallet.get(item.fundingWalletId) ?? ZERO).plus(item.amount.toString()));
  for (const payment of priorPayments) for (const source of payment.creditCardPaymentSources) {
    carriedByWallet.set(source.sourceWalletId, (carriedByWallet.get(source.sourceWalletId) ?? ZERO).minus(source.amount.toString()));
  }
  for (const [fundingWalletId, balance] of carriedByWallet) {
    if (!balance.lt(0)) continue;
    const credit = await tx.creditCardObligationEntry.findFirst({ where: { cardWalletId, fundingWalletId, amount: { lt: 0 } }, orderBy: { postedDate: "asc" }, select: { id: true } });
    if (credit) items.push({ obligationEntryId: credit.id, fundingWalletId, amount: balance, isCarry: true });
  }
  for (const entry of regular) {
    const paid = entry.paymentAllocations.reduce((sum, allocation) => sum.plus(allocation.amount.toString()), ZERO);
    const remaining = new Decimal(entry.amount.toString()).minus(paid);
    if (!remaining.isZero()) items.push({ obligationEntryId: entry.id, fundingWalletId: entry.fundingWalletId, amount: remaining });
  }
  for (const installment of installments) {
    const original = installment.plan.transaction;
    for (const allocation of original.creditCardAllocations) {
      const obligation = original.creditCardObligationEntries.find((entry) => entry.fundingWalletId === allocation.fundingWalletId);
      if (!obligation) throw new AppError("CONFLICT", "Thiếu nghĩa vụ gốc của giao dịch trả góp.");
      items.push({
        obligationEntryId: obligation.id,
        installmentId: installment.id,
        fundingWalletId: allocation.fundingWalletId,
        amount: shareForInstallment(allocation.amount.toString(), installment.plan.termCount, installment.installmentNo),
      });
    }
    if (installment.installmentNo === 1 && installment.plan.feeTransaction) {
      const fee = installment.plan.feeTransaction;
      for (const allocation of fee.creditCardAllocations) {
        const obligation = fee.creditCardObligationEntries.find((entry) => entry.fundingWalletId === allocation.fundingWalletId);
        if (!obligation) throw new AppError("CONFLICT", "Thiếu nghĩa vụ phí trả góp.");
        items.push({ obligationEntryId: obligation.id, installmentId: installment.id, fundingWalletId: allocation.fundingWalletId, amount: new Decimal(allocation.amount.toString()) });
      }
    }
  }
  const totalsByWallet = new Map<string, Decimal>();
  for (const item of items) totalsByWallet.set(item.fundingWalletId, (totalsByWallet.get(item.fundingWalletId) ?? ZERO).plus(item.amount));
  const totalAmount = [...totalsByWallet.values()].reduce((sum, amount) => sum.plus(Decimal.max(amount, ZERO)), ZERO);
  const status = totalAmount.gt(0) ? "issued" as const : "paid" as const;
  return tx.creditCardStatement.create({
    data: {
      workspaceId,
      cardWalletId,
      cycleStartDate: dbDate(cycleStart),
      cycleEndDate: dbDate(cycleEnd),
      dueDate: dbDate(dueDateAfterStatement(cycleEnd, dueDay)),
      totalAmount,
      status,
      paidAt: status === "paid" ? new Date() : null,
      items: items.length ? { create: items } : undefined,
    },
  });
}

export async function generateCardStatementsInTransaction(tx: Tx, workspaceId: string, cardWalletId: string, today: string) {
  await tx.$queryRaw(Prisma.sql`SELECT "wallet_id" FROM "CREDIT_CARD_PROFILE" WHERE "wallet_id" = CAST(${cardWalletId} AS uuid) FOR UPDATE`);
  const profile = await tx.creditCardProfile.findFirst({
    where: { walletId: cardWalletId, wallet: { workspaceLinks: { some: { workspaceId } }, deletedAt: null } },
    include: {
      statements: { orderBy: { cycleEndDate: "desc" }, take: 1 },
      obligations: { orderBy: { postedDate: "asc" }, take: 1, select: { postedDate: true } },
      installmentPlans: { where: { status: "active" }, include: { installments: { orderBy: { statementDate: "asc" }, take: 1 } } },
    },
  });
  if (!profile) throw new AppError("WORKSPACE_ISOLATION_VIOLATION", "Thẻ không thuộc nhóm này.");
  const earliestDates = [
    profile.obligations[0]?.postedDate,
    ...profile.installmentPlans.map((plan) => plan.installments[0]?.statementDate),
  ].filter((value): value is Date => Boolean(value)).sort((a, b) => a.getTime() - b.getTime());
  if (!earliestDates.length) return 0;
  let cycleEnd = profile.statements[0]
    ? nextStatementDate(isoDate(profile.statements[0].cycleEndDate), profile.statementClosingDay)
    : firstStatementOnOrAfter(isoDate(earliestDates[0]), profile.statementClosingDay);
  let cycleStart = profile.statements[0] ? nextDay(isoDate(profile.statements[0].cycleEndDate)) : isoDate(earliestDates[0]);
  let generated = 0;
  while (cycleEnd <= today && generated < 240) {
    await createStatementForCycle(tx, workspaceId, cardWalletId, cycleStart, cycleEnd, profile.paymentDueDay);
    cycleStart = nextDay(cycleEnd);
    cycleEnd = nextStatementDate(cycleEnd, profile.statementClosingDay);
    generated += 1;
  }
  return generated;
}

export async function generateDueCreditCardStatements(now = new Date()) {
  const cards = await prisma.workspaceWallet.findMany({
    where: { wallet: { kind: "credit_card", status: "active", deletedAt: null } },
    select: { workspaceId: true, walletId: true, workspace: { select: { timeZone: true } } },
  });
  let generated = 0;
  for (const card of cards) {
    generated += await prisma.$transaction((tx) => generateCardStatementsInTransaction(
      tx,
      card.workspaceId,
      card.walletId,
      getBusinessDateInTimeZone(card.workspace.timeZone, now),
    ));
  }
  return { cards: cards.length, generated };
}

export async function generateWorkspaceCreditCardStatements(workspaceId: string, timeZone: string, now = new Date()) {
  const cards = await prisma.workspaceWallet.findMany({
    where: { workspaceId, wallet: { kind: "credit_card", status: "active", deletedAt: null } },
    select: { walletId: true },
  });
  let generated = 0;
  const today = getBusinessDateInTimeZone(timeZone, now);
  for (const card of cards) {
    generated += await prisma.$transaction((tx) => generateCardStatementsInTransaction(tx, workspaceId, card.walletId, today));
  }
  return generated;
}

export async function statementPaymentDetails(tx: Tx, statementId: string) {
  const statement = await tx.creditCardStatement.findUnique({
    where: { id: statementId },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  if (!statement) throw new AppError("NOT_FOUND", "Không tìm thấy sao kê.");
  const dueByWallet = new Map<string, Decimal>();
  for (const item of statement.items) dueByWallet.set(item.fundingWalletId, (dueByWallet.get(item.fundingWalletId) ?? ZERO).plus(item.amount.toString()));
  const normalizedDue = new Map([...dueByWallet].map(([walletId, amount]) => [walletId, Decimal.max(amount, ZERO)]));

  const allocations = new Map<string, Decimal>();
  for (const [walletId] of normalizedDue) {
    const walletItems = statement.items.filter((item) => item.fundingWalletId === walletId);
    let credit = walletItems.reduce((sum, item) => item.amount.isNegative() ? sum.plus(item.amount.abs()) : sum, ZERO);
    for (const item of walletItems) {
      let amount = new Decimal(item.amount.toString());
      if (!amount.gt(0)) continue;
      const offset = Decimal.min(credit, amount);
      amount = amount.minus(offset);
      credit = credit.minus(offset);
      if (amount.gt(0)) allocations.set(item.obligationEntryId, (allocations.get(item.obligationEntryId) ?? ZERO).plus(amount));
    }
  }
  return { statement, dueByWallet: normalizedDue, allocations };
}

export async function completePaidInstallmentPlansInTransaction(tx: Tx, statementId: string) {
  const items = await tx.creditCardStatementItem.findMany({
    where: { statementId, installmentId: { not: null } },
    select: { installment: { select: { planId: true } } },
  });
  const planIds = [...new Set(items.flatMap((item) => item.installment ? [item.installment.planId] : []))];
  for (const planId of planIds) {
    const unpaid = await tx.creditCardInstallment.count({
      where: { planId, statementItems: { none: { statement: { status: "paid" } } } },
    });
    if (unpaid === 0) {
      await tx.creditCardInstallmentPlan.updateMany({
        where: { id: planId, status: "active" },
        data: { status: "completed", completedAt: new Date() },
      });
    }
  }
}
