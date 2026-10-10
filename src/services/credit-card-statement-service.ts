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

export function shareForImportedInstallment(
  amount: Decimal.Value,
  termCount: number,
  paidTermCount: number,
  installmentNo: number,
) {
  return shareForInstallment(amount, termCount - paidTermCount, installmentNo - paidTermCount);
}

export async function createStatementForCycle(
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
      installmentPlanId: null,
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
          importedObligations: true,
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
    if (balance.isZero()) continue;
    if (balance.lt(0)) {
      const credit = await tx.creditCardObligationEntry.findFirst({
        where: { cardWalletId, fundingWalletId, amount: { lt: 0 } },
        orderBy: { postedDate: "asc" },
        select: { id: true },
      });
      if (credit) items.push({ obligationEntryId: credit.id, fundingWalletId, amount: balance, isCarry: true });
    } else {
      const obligation = await tx.creditCardObligationEntry.findFirst({
        where: { cardWalletId, fundingWalletId, amount: { gt: 0 } },
        orderBy: [{ postedDate: "asc" }, { id: "asc" }],
        select: { id: true },
      });
      if (obligation) {
        items.push({ obligationEntryId: obligation.id, fundingWalletId, amount: balance, isCarry: true });
      }
    }
  }
  for (const entry of regular) {
    const paid = entry.paymentAllocations.reduce((sum, allocation) => sum.plus(allocation.amount.toString()), ZERO);
    const remaining = new Decimal(entry.amount.toString()).minus(paid);
    if (!remaining.isZero()) items.push({ obligationEntryId: entry.id, fundingWalletId: entry.fundingWalletId, amount: remaining });
  }
  for (const installment of installments) {
    if (installment.plan.origin === "imported") {
      for (const obligation of installment.plan.importedObligations) {
        items.push({
          obligationEntryId: obligation.id,
          installmentId: installment.id,
          fundingWalletId: obligation.fundingWalletId,
          amount: shareForImportedInstallment(
            obligation.amount.toString(),
            installment.plan.termCount,
            installment.plan.paidTermCount,
            installment.installmentNo,
          ),
        });
      }
      continue;
    }
    const original = installment.plan.transaction;
    if (!original) throw new AppError("CONFLICT", "Kế hoạch trả góp bị thiếu giao dịch gốc.");
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
  const created = await tx.creditCardStatement.create({
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

  const rolledOverStatements = await tx.creditCardStatement.findMany({
    where: {
      workspaceId,
      cardWalletId,
      status: "issued",
      cycleEndDate: { lt: dbDate(cycleEnd) },
    },
    select: { id: true },
  });
  if (rolledOverStatements.length > 0) {
    await tx.creditCardStatement.updateMany({
      where: { id: { in: rolledOverStatements.map((s) => s.id) } },
      data: { status: "paid", paidAt: new Date() },
    });
    for (const rolled of rolledOverStatements) {
      await completePaidInstallmentPlansInTransaction(tx, rolled.id);
    }
  }

  return created;
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

/** Rebuild billing snapshots after a historical purchase changes; actual payments stay intact. */
export async function refreshHistoricalCardStatements(tx: Tx, workspaceId: string, cardWalletId: string, today: string) {
  await generateCardStatementsInTransaction(tx, workspaceId, cardWalletId, today);
  const obligations = await tx.creditCardObligationEntry.findMany({
    where: {
      workspaceId, cardWalletId, source: "transaction",
      transaction: { installmentPlan: null, installmentFeePlan: null },
    },
    orderBy: [{ postedDate: "asc" }, { id: "asc" }],
  });
  const profile = await tx.creditCardProfile.findUniqueOrThrow({ where: { walletId: cardWalletId } });
  const first = await tx.creditCardStatement.findFirst({
    where: { workspaceId, cardWalletId }, orderBy: { cycleEndDate: "asc" },
  });
  // A newly entered purchase can predate the first statement already on file.
  if (first && obligations[0]) {
    let cycleStart = isoDate(obligations[0].postedDate);
    let cycleEnd = firstStatementOnOrAfter(cycleStart, profile.statementClosingDay);
    while (cycleEnd < isoDate(first.cycleEndDate)) {
      await tx.creditCardStatement.create({ data: {
        workspaceId, cardWalletId, cycleStartDate: dbDate(cycleStart), cycleEndDate: dbDate(cycleEnd),
        dueDate: dbDate(dueDateAfterStatement(cycleEnd, profile.paymentDueDay)), totalAmount: ZERO,
        status: "issued",
      } });
      cycleStart = nextDay(cycleEnd);
      cycleEnd = nextStatementDate(cycleEnd, profile.statementClosingDay);
    }
    if (cycleStart < isoDate(first.cycleStartDate)) {
      await tx.creditCardStatement.update({ where: { id: first.id }, data: { cycleStartDate: dbDate(cycleStart) } });
    }
  }
  const statements = await tx.creditCardStatement.findMany({
    where: { workspaceId, cardWalletId }, orderBy: { cycleEndDate: "asc" },
    include: {
      items: { where: { isCarry: false }, orderBy: { createdAt: "asc" } },
      payments: {
        where: { workflowStatus: "approved", deletedAt: null },
        include: { creditCardPaymentSources: true },
      },
    },
  });
  if (!statements.length) return;
  const regularIds = obligations.map((entry) => entry.id);
  const regularIdSet = new Set(regularIds);
  await tx.creditCardStatementItem.deleteMany({ where: {
    statement: { workspaceId, cardWalletId },
    OR: [{ isCarry: true }, { obligationEntryId: { in: regularIds }, installmentId: null }],
  } });
  const itemsByStatement = new Map(statements.map((statement) => [
    statement.id, statement.items.filter((item) => !regularIdSet.has(item.obligationEntryId) || item.installmentId !== null),
  ]));
  for (const obligation of obligations) {
    const target = statements.find((statement) => statement.cycleEndDate >= obligation.postedDate);
    if (!target) continue; // An open cycle is billed when its closing date arrives.
    const item = await tx.creditCardStatementItem.create({ data: {
      statementId: target.id, obligationEntryId: obligation.id,
      fundingWalletId: obligation.fundingWalletId, amount: obligation.amount,
    } });
    itemsByStatement.get(target.id)!.push(item);
  }
  const carried = new Map<string, Decimal>();
  const representative = new Map<string, string>();
  for (const statement of statements) {
    const totals = new Map(carried);
    for (const [fundingWalletId, amount] of carried) {
      if (amount.isZero()) continue;
      await tx.creditCardStatementItem.create({ data: {
        statementId: statement.id, obligationEntryId: representative.get(fundingWalletId)!,
        fundingWalletId, amount, isCarry: true,
      } });
    }
    for (const item of itemsByStatement.get(statement.id)!) {
      totals.set(item.fundingWalletId, (totals.get(item.fundingWalletId) ?? ZERO).plus(item.amount.toString()));
      representative.set(item.fundingWalletId, item.obligationEntryId);
    }
    const totalAmount = [...totals.values()].reduce((sum, amount) => sum.plus(Decimal.max(amount, ZERO)), ZERO);
    for (const payment of statement.payments) for (const source of payment.creditCardPaymentSources) {
      totals.set(source.sourceWalletId, (totals.get(source.sourceWalletId) ?? ZERO).minus(source.amount.toString()));
    }
    const remaining = [...totals.values()].reduce((sum, amount) => sum.plus(Decimal.max(amount, ZERO)), ZERO);
    const rolledOver = statement.id !== statements[statements.length - 1].id;
    const status = rolledOver || remaining.isZero() ? "paid" : "issued";
    await tx.creditCardStatement.update({ where: { id: statement.id }, data: {
      totalAmount, status, paidAt: status === "paid" ? (statement.paidAt ?? new Date()) : null,
    } });
    if (status === "issued") await reopenUnpaidInstallmentPlansInTransaction(tx, statement.id);
    else await completePaidInstallmentPlansInTransaction(tx, statement.id);
    carried.clear();
    for (const [walletId, amount] of totals) carried.set(walletId, amount);
  }
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

export function allocateStatementPaymentSources(
  items: Array<{ obligationEntryId: string; fundingWalletId: string; amount: Decimal | Decimal.Value }>,
  existingAllocations: Map<string, Decimal>,
  sources: Array<{ walletId: string; amount: Decimal | Decimal.Value }>,
) {
  const allocations = new Map<string, Decimal>();
  for (const source of sources) {
    let paymentRemaining = new Decimal(source.amount.toString());
    if (!paymentRemaining.gt(0)) continue;
    const walletItems = items.filter((item) => item.fundingWalletId === source.walletId);
    let credit = walletItems.reduce(
      (sum, item) => new Decimal(item.amount.toString()).isNegative() ? sum.plus(new Decimal(item.amount.toString()).abs()) : sum,
      ZERO,
    );
    for (const item of walletItems) {
      let itemGross = new Decimal(item.amount.toString());
      if (!itemGross.gt(0)) continue;
      const offset = Decimal.min(credit, itemGross);
      itemGross = itemGross.minus(offset);
      credit = credit.minus(offset);
      if (!itemGross.gt(0)) continue;

      const alreadyAllocated = existingAllocations.get(item.obligationEntryId) ?? ZERO;
      const itemRemaining = Decimal.max(itemGross.minus(alreadyAllocated), ZERO);
      if (!itemRemaining.gt(0)) continue;

      const toAllocate = Decimal.min(paymentRemaining, itemRemaining);
      allocations.set(
        item.obligationEntryId,
        (allocations.get(item.obligationEntryId) ?? ZERO).plus(toAllocate),
      );
      paymentRemaining = paymentRemaining.minus(toAllocate);
      if (paymentRemaining.isZero()) break;
    }
  }
  return allocations;
}

export async function statementPaymentDetails(
  tx: Tx,
  statementId: string,
  sources?: Array<{ walletId: string; amount: Decimal | Decimal.Value }>,
) {
  const statement = await tx.creditCardStatement.findUnique({
    where: { id: statementId },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      payments: {
        where: { workflowStatus: "approved", deletedAt: null },
        include: { creditCardPaymentSources: true, creditCardPaymentAllocations: true },
      },
    },
  });
  if (!statement) throw new AppError("NOT_FOUND", "Không tìm thấy sao kê.");

  const paidByWallet = new Map<string, Decimal>();
  const existingAllocations = new Map<string, Decimal>();
  for (const payment of statement.payments ?? []) {
    for (const source of payment.creditCardPaymentSources ?? []) {
      paidByWallet.set(
        source.sourceWalletId,
        (paidByWallet.get(source.sourceWalletId) ?? ZERO).plus(source.amount.toString()),
      );
    }
    for (const alloc of payment.creditCardPaymentAllocations ?? []) {
      existingAllocations.set(
        alloc.obligationEntryId,
        (existingAllocations.get(alloc.obligationEntryId) ?? ZERO).plus(alloc.amount.toString()),
      );
    }
  }

  const dueByWallet = new Map<string, Decimal>();
  for (const item of statement.items) {
    dueByWallet.set(
      item.fundingWalletId,
      (dueByWallet.get(item.fundingWalletId) ?? ZERO).plus(item.amount.toString()),
    );
  }

  const remainingByWallet = new Map<string, Decimal>();
  for (const [walletId, due] of dueByWallet) {
    const paid = paidByWallet.get(walletId) ?? ZERO;
    const remaining = Decimal.max(due.minus(paid), ZERO);
    if (remaining.gt(0)) {
      remainingByWallet.set(walletId, remaining);
    }
  }

  const totalRemaining = [...remainingByWallet.values()].reduce(
    (sum, amount) => sum.plus(amount),
    ZERO,
  );

  const effectiveSources = sources ?? [...remainingByWallet.entries()].map(([walletId, amount]) => ({ walletId, amount }));
  const allocations = allocateStatementPaymentSources(
    statement.items,
    existingAllocations,
    effectiveSources,
  );

  return {
    statement,
    dueByWallet: remainingByWallet,
    totalRemaining,
    paidByWallet,
    allocations,
  };
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

export async function reopenUnpaidInstallmentPlansInTransaction(tx: Tx, statementId: string) {
  await tx.creditCardInstallmentPlan.updateMany({
    where: {
      status: "completed",
      installments: { some: { statementItems: { some: { statementId, statement: { status: "issued" } } } } },
    },
    data: { status: "active", completedAt: null },
  });
}

export async function recalculateUnpaidStatementTotal(tx: Tx, statementId: string) {
  const statement = await tx.creditCardStatement.findUnique({
    where: { id: statementId },
    include: {
      items: true,
      payments: {
        where: { deletedAt: null, workflowStatus: { not: "rejected" } },
        select: { id: true, amount: true },
      },
    },
  });
  if (!statement || statement.status !== "issued") return;

  const totalsByWallet = new Map<string, Decimal>();
  for (const item of statement.items) {
    totalsByWallet.set(
      item.fundingWalletId,
      (totalsByWallet.get(item.fundingWalletId) ?? ZERO).plus(item.amount.toString()),
    );
  }
  const totalItemsAmount = [...totalsByWallet.values()].reduce(
    (sum, amount) => sum.plus(Decimal.max(amount, ZERO)),
    ZERO,
  );
  const totalPaid = statement.payments.reduce(
    (sum, payment) => sum.plus(payment.amount.toString()),
    ZERO,
  );
  const remaining = totalItemsAmount.minus(totalPaid);
  const isPaid = remaining.lte(0);
  await tx.creditCardStatement.update({
    where: { id: statementId },
    data: {
      totalAmount: Decimal.max(totalItemsAmount, ZERO),
      status: isPaid ? "paid" : "issued",
      paidAt: isPaid ? (statement.paidAt ?? new Date()) : null,
    },
  });
}
