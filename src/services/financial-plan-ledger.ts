import Decimal from "decimal.js";
import { Prisma, type JarCode } from "@/generated/prisma/client";
import { FINANCIAL_JAR_CODES, type FinancialJarCode } from "@/domain/financial-jar/jars";
import { decimalMap, type JarDecimalMap } from "@/domain/financial-plan/calculator";
import { monthDateRange } from "@/domain/financial-plan/month";

type TransactionClient = Prisma.TransactionClient;
const ZERO = new Decimal(0);

function asIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function occurrenceDate(month: string, dayOfMonth: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(Math.min(dayOfMonth, lastDay)).padStart(2, "0")}`;
}

export async function getWorkspaceBalance(
  tx: TransactionClient,
  workspaceId: string,
  before?: Date,
) {
  const links = await tx.workspaceWallet.findMany({
    where: {
      workspaceId,
      wallet: { deletedAt: null, ...(before ? { createdAt: { lt: before } } : {}) },
    },
    select: { walletId: true, wallet: { select: { currentBalance: true } } },
  });
  let balance = links.reduce((sum, link) => sum.plus(link.wallet.currentBalance.toString()), ZERO);
  if (!before || links.length === 0) return balance;

  const walletIds = links.map((link) => link.walletId);
  const laterTransactions = await tx.transaction.findMany({
    where: {
      deletedAt: null,
      workflowStatus: "approved",
      date: { gte: before },
      member: { workspaceId },
      OR: [{ walletId: { in: walletIds } }, { toWalletId: { in: walletIds } }],
    },
    select: { type: true, amount: true, walletId: true, toWalletId: true },
  });
  for (const record of laterTransactions) {
    const amount = new Decimal(record.amount.toString());
    if (record.type === "income" && walletIds.includes(record.walletId)) balance = balance.minus(amount);
    if (record.type === "expense" && walletIds.includes(record.walletId)) balance = balance.plus(amount);
    if (record.type === "transfer") {
      if (walletIds.includes(record.walletId)) balance = balance.plus(amount);
      if (record.toWalletId && walletIds.includes(record.toWalletId)) balance = balance.minus(amount);
    }
  }
  return balance;
}

export type FinancialPlanMonthLedger = {
  approvedIncome: Decimal;
  forecastIncome: Decimal;
  approvedExpenseByJar: JarDecimalMap;
  forecastExpenseByJar: JarDecimalMap;
  pendingIncome: Decimal;
  pendingExpense: Decimal;
};

function addExpense(target: JarDecimalMap, jarCode: JarCode | null, amount: Decimal.Value) {
  if (!jarCode || !FINANCIAL_JAR_CODES.includes(jarCode as FinancialJarCode)) return;
  target[jarCode as FinancialJarCode] = target[jarCode as FinancialJarCode].plus(amount);
}

export async function getFinancialPlanMonthLedger(
  tx: TransactionClient,
  workspaceId: string,
  month: string,
  includeForecast: boolean,
): Promise<FinancialPlanMonthLedger> {
  const { start, end } = monthDateRange(month);
  const records = await tx.transaction.findMany({
    where: { member: { workspaceId }, deletedAt: null, date: { gte: start, lt: end } },
    select: { type: true, workflowStatus: true, amount: true, jarCode: true },
  });
  const result: FinancialPlanMonthLedger = {
    approvedIncome: new Decimal(0), forecastIncome: new Decimal(0),
    approvedExpenseByJar: decimalMap(), forecastExpenseByJar: decimalMap(),
    pendingIncome: new Decimal(0), pendingExpense: new Decimal(0),
  };
  for (const record of records) {
    if (record.type === "transfer" || record.workflowStatus === "rejected") continue;
    const amount = new Decimal(record.amount.toString());
    if (record.workflowStatus === "approved") {
      if (record.type === "income") result.approvedIncome = result.approvedIncome.plus(amount);
      else addExpense(result.approvedExpenseByJar, record.jarCode, amount);
    } else if (record.workflowStatus === "scheduled" && includeForecast) {
      if (record.type === "income") result.forecastIncome = result.forecastIncome.plus(amount);
      else addExpense(result.forecastExpenseByJar, record.jarCode, amount);
    } else if (record.workflowStatus === "pending") {
      if (record.type === "income") result.pendingIncome = result.pendingIncome.plus(amount);
      else result.pendingExpense = result.pendingExpense.plus(amount);
    }
  }

  if (!includeForecast) return result;
  const rules = await tx.recurringTransaction.findMany({
    where: {
      workspaceId, status: "active", deletedAt: null,
      startDate: { lt: end },
      OR: [{ endDate: null }, { endDate: { gte: start } }],
    },
    select: {
      id: true, type: true, amount: true, dayOfMonth: true, startDate: true, endDate: true,
      category: { select: { jarCode: true } },
    },
  });
  if (rules.length === 0) return result;
  const materialized = await tx.transaction.findMany({
    where: { recurringTransactionId: { in: rules.map((rule) => rule.id) }, recurringPeriod: month },
    select: { recurringTransactionId: true },
  });
  const materializedIds = new Set(materialized.map((record) => record.recurringTransactionId));
  for (const rule of rules) {
    if (materializedIds.has(rule.id) || rule.type === "transfer") continue;
    const date = occurrenceDate(month, rule.dayOfMonth);
    if (date < asIsoDate(rule.startDate) || (rule.endDate && date > asIsoDate(rule.endDate))) continue;
    if (rule.type === "income") result.forecastIncome = result.forecastIncome.plus(rule.amount.toString());
    else addExpense(result.forecastExpenseByJar, rule.category?.jarCode ?? null, rule.amount.toString());
  }
  return result;
}

export function combinedExpenseByJar(ledger: FinancialPlanMonthLedger, includeForecast: boolean) {
  return Object.fromEntries(FINANCIAL_JAR_CODES.map((jarCode) => [
    jarCode,
    ledger.approvedExpenseByJar[jarCode].plus(includeForecast ? ledger.forecastExpenseByJar[jarCode] : 0),
  ])) as JarDecimalMap;
}
