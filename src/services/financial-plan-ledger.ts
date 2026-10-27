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
      wallet: before
        ? {
            createdAt: { lt: before },
            OR: [{ deletedAt: null }, { deletedAt: { gte: before } }],
          }
        : { deletedAt: null },
    },
    select: { walletId: true, wallet: { select: { currentBalance: true, kind: true } } },
  });
  let balance = ZERO;
  for (const link of links) {
    const amount = new Decimal(link.wallet.currentBalance.toString());
    balance = link.wallet.kind === "credit_card"
      ? balance.minus(Decimal.max(amount, ZERO))
      : balance.plus(amount);
  }
  const activePlans =
    (await tx.creditCardInstallmentPlan?.findMany?.({
      where: {
        workspaceId,
        status: "active",
        card: { wallet: { deletedAt: null } },
      },
      select: {
        createdAt: true,
        transaction: {
          select: {
            date: true,
            creditCardObligationEntries: {
              select: {
                amount: true,
                paymentAllocations: {
                  select: {
                    amount: true,
                    paymentTransaction: { select: { date: true } },
                  },
                },
              },
            },
          },
        },
        importedObligations: {
          select: {
            amount: true,
            paymentAllocations: {
              select: {
                amount: true,
                paymentTransaction: { select: { date: true } },
              },
            },
          },
        },
        installments: {
          select: {
            dueDate: true,
            principalAmount: true,
            statementItems: {
              select: {
                id: true,
                statement: { select: { cycleEndDate: true } },
              },
            },
          },
        },
      },
    })) ?? [];

  const referenceMonth = before
    ? asIsoDate(new Date(before.getTime() - 86400000)).slice(0, 7)
    : new Date().toISOString().slice(0, 7);
  for (const plan of activePlans) {
    if (before) {
      const planDate = plan.transaction?.date ?? plan.createdAt;
      if (planDate && planDate >= before) continue;
    }
    const obligations = [
      ...(plan.transaction?.creditCardObligationEntries ?? []),
      ...(plan.importedObligations ?? []),
    ];
    const obligationRemaining = obligations.reduce((sum, entry) => {
      const paid = entry.paymentAllocations.reduce((pSum, alloc) => {
        if (before && alloc.paymentTransaction?.date && alloc.paymentTransaction.date >= before) {
          return pSum;
        }
        return pSum.plus(alloc.amount.toString());
      }, ZERO);
      return sum.plus(
        Decimal.max(new Decimal(entry.amount.toString()).minus(paid), ZERO),
      );
    }, ZERO);

    const isBilled = (inst: (typeof plan.installments)[number]) =>
      inst.statementItems.some(
        (item) =>
          !before ||
          !item.statement?.cycleEndDate ||
          item.statement.cycleEndDate < before,
      );

    const sortedInstallments = [...plan.installments].sort((a, b) =>
      asIsoDate(a.dueDate).localeCompare(asIsoDate(b.dueDate)),
    );
    const unbilled = sortedInstallments.filter((inst) => !isBilled(inst));
    if (unbilled.length === 0) continue;

    const billedInReferenceOrLater = sortedInstallments.find(
      (inst) =>
        isBilled(inst) &&
        asIsoDate(inst.dueDate).slice(0, 7) >= referenceMonth,
    );
    const baselineMonth = billedInReferenceOrLater
      ? asIsoDate(billedInReferenceOrLater.dueDate).slice(0, 7)
      : asIsoDate(unbilled[0].dueDate).slice(0, 7);

    const futureUnbilledPrincipal = unbilled
      .filter((inst) => asIsoDate(inst.dueDate).slice(0, 7) > baselineMonth)
      .reduce(
        (sum, inst) => sum.plus(inst.principalAmount.toString()),
        ZERO,
      );

    const deferredPrincipal = Decimal.max(
      Decimal.min(futureUnbilledPrincipal, obligationRemaining),
      ZERO,
    );
    balance = balance.plus(deferredPrincipal);
  }
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
    select: { type: true, purpose: true, amount: true, walletId: true, toWalletId: true },
  });
  for (const record of laterTransactions) {
    const amount = new Decimal(record.amount.toString());
    if (record.purpose === "credit_card_payment") continue;
    if (record.purpose === "credit_card_refund") {
      if (walletIds.includes(record.walletId)) balance = balance.minus(amount);
      continue;
    }
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
  netInvestmentOutflow: Decimal;
};

export type MonthLedgerResult = FinancialPlanMonthLedger;

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
    select: {
      type: true,
      purpose: true,
      workflowStatus: true,
      amount: true,
      jarCode: true,
      category: { select: { jarCode: true } },
      installmentPlan: { select: { id: true, status: true } },
      installmentFeePlan: { select: { id: true, status: true } },
      goldSaleRecord: {
        select: {
          deletedAt: true,
          costMode: true,
          costBasisAllocatedAmount: true,
          realizedProfitAmount: true,
          saleDate: true,
          purchaseLot: { select: { purchaseDate: true, fundingMode: true } },
          holding: {
            select: {
              purchaseLots: {
                where: { deletedAt: null },
                select: {
                  purchaseDate: true,
                  fundingMode: true,
                  totalCostAmount: true,
                },
              },
            },
          },
        },
      },
      savingsDepositSettlement: {
        select: {
          principalWithdrawnAmount: true,
          interestReceivedAmount: true,
          deposit: {
            select: {
              startDate: true,
              fundingMode: true,
              openTransaction: { select: { date: true, deletedAt: true } },
            },
          },
        },
      },
    },
  });
  const result: FinancialPlanMonthLedger = {
    approvedIncome: new Decimal(0), forecastIncome: new Decimal(0),
    approvedExpenseByJar: decimalMap(), forecastExpenseByJar: decimalMap(),
    pendingIncome: new Decimal(0), pendingExpense: new Decimal(0),
    netInvestmentOutflow: ZERO,
  };
  for (const record of records) {
    const amount = new Decimal(record.amount.toString());
    if (record.workflowStatus === "approved") {
      if (record.purpose === "investment_contribution") {
        result.netInvestmentOutflow = result.netInvestmentOutflow.plus(amount);
      } else if (record.purpose === "investment_settlement") {
        if (record.savingsDepositSettlement) {
          const settlement = record.savingsDepositSettlement;
          const interest = Decimal.max(
            new Decimal(settlement.interestReceivedAmount.toString()),
            ZERO,
          );
          result.approvedIncome = result.approvedIncome.plus(interest);
          const principalSettled = Decimal.max(
            new Decimal(settlement.principalWithdrawnAmount.toString()),
            ZERO,
          );
          const fundedDate =
            settlement.deposit.openTransaction &&
            !settlement.deposit.openTransaction.deletedAt
              ? settlement.deposit.openTransaction.date
              : settlement.deposit.startDate;
          if (
            settlement.deposit.fundingMode === "from_wallet" &&
            fundedDate >= start &&
            fundedDate < end
          ) {
            result.netInvestmentOutflow =
              result.netInvestmentOutflow.minus(principalSettled);
          }
        } else if (
          record.goldSaleRecord &&
          record.goldSaleRecord.deletedAt === null
        ) {
          const sale = record.goldSaleRecord;
          const realizedYield = Decimal.max(
            new Decimal(sale.realizedProfitAmount.toString()),
            ZERO,
          );
          result.approvedIncome = result.approvedIncome.plus(realizedYield);
          const costBasis = Decimal.max(
            new Decimal(sale.costBasisAllocatedAmount.toString()),
            ZERO,
          );
          if (sale.costMode === "specific_lot" && sale.purchaseLot) {
            if (
              sale.purchaseLot.fundingMode === "from_wallet" &&
              sale.purchaseLot.purchaseDate >= start &&
              sale.purchaseLot.purchaseDate < end
            ) {
              result.netInvestmentOutflow =
                result.netInvestmentOutflow.minus(costBasis);
            }
          } else {
            const eligibleLots = (sale.holding?.purchaseLots ?? []).filter(
              (lot) => lot.purchaseDate <= sale.saleDate,
            );
            const totalEligibleCost = eligibleLots.reduce(
              (sum, lot) => sum.plus(lot.totalCostAmount.toString()),
              ZERO,
            );
            if (totalEligibleCost.gt(ZERO)) {
              const inMonthWalletCost = eligibleLots
                .filter(
                  (lot) =>
                    lot.fundingMode === "from_wallet" &&
                    lot.purchaseDate >= start &&
                    lot.purchaseDate < end,
                )
                .reduce(
                  (sum, lot) => sum.plus(lot.totalCostAmount.toString()),
                  ZERO,
                );
              const settledInMonthPrincipal = costBasis
                .mul(inMonthWalletCost)
                .div(totalEligibleCost)
                .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
              result.netInvestmentOutflow = result.netInvestmentOutflow.minus(
                settledInMonthPrincipal,
              );
            }
          }
        } else {
          result.netInvestmentOutflow =
            result.netInvestmentOutflow.minus(amount);
        }
      }
    }
    if (
      record.purpose === "credit_card_payment" ||
      record.purpose === "investment_contribution" ||
      record.purpose === "investment_settlement" ||
      record.purpose === "balance_reconciliation" ||
      record.type === "transfer" ||
      record.workflowStatus === "rejected"
    ) {
      continue;
    }
    if (record.installmentPlan && record.installmentPlan.status !== "pending") continue;
    if (
      record.purpose === "credit_card_installment_fee" &&
      record.installmentFeePlan &&
      record.installmentFeePlan.status !== "pending"
    ) {
      continue;
    }
    const refundJar = record.jarCode ?? record.category?.jarCode ?? null;
    if (record.workflowStatus === "approved") {
      if (record.purpose === "credit_card_refund") addExpense(result.approvedExpenseByJar, refundJar, amount.negated());
      else if (record.type === "income") result.approvedIncome = result.approvedIncome.plus(amount);
      else addExpense(result.approvedExpenseByJar, refundJar, amount);
    } else if (record.workflowStatus === "scheduled" && includeForecast) {
      if (record.purpose === "credit_card_refund") addExpense(result.forecastExpenseByJar, refundJar, amount.negated());
      else if (record.type === "income") result.forecastIncome = result.forecastIncome.plus(amount);
      else addExpense(result.forecastExpenseByJar, refundJar, amount);
    } else if (record.workflowStatus === "pending") {
      if (record.purpose === "credit_card_refund") result.pendingExpense = result.pendingExpense.minus(amount);
      else if (record.type === "income") result.pendingIncome = result.pendingIncome.plus(amount);
      else result.pendingExpense = result.pendingExpense.plus(amount);
    }
  }

  const installments =
    (await tx.creditCardInstallment?.findMany?.({
      where: {
        dueDate: { gte: start, lt: end },
        plan: {
          workspaceId,
          status: { in: ["active", "completed"] },
          card: { wallet: { deletedAt: null } },
        },
      },
      select: {
        dueDate: true,
        principalAmount: true,
        feeAmount: true,
        statementItems: { select: { id: true } },
        plan: {
          select: {
            status: true,
            transaction: {
              select: {
                jarCode: true,
                category: { select: { jarCode: true } },
              },
            },
          },
        },
      },
    })) ?? [];

  const currentUtcMonth = new Date().toISOString().slice(0, 7);
  for (const inst of installments) {
    const instJar =
      inst.plan.transaction?.jarCode ??
      inst.plan.transaction?.category?.jarCode ??
      ("RESPONSIBILITY" as JarCode);
    const instAmount = new Decimal(inst.principalAmount.toString()).plus(
      inst.feeAmount.toString(),
    );
    if (
      inst.statementItems.length > 0 ||
      !includeForecast ||
      inst.plan.status === "completed" ||
      asIsoDate(inst.dueDate).slice(0, 7) <= currentUtcMonth
    ) {
      addExpense(result.approvedExpenseByJar, instJar, instAmount);
    } else {
      addExpense(result.forecastExpenseByJar, instJar, instAmount);
    }
  }

  for (const jarCode of FINANCIAL_JAR_CODES) {
    result.approvedExpenseByJar[jarCode] = Decimal.max(ZERO, result.approvedExpenseByJar[jarCode]);
  }
  result.pendingExpense = Decimal.max(ZERO, result.pendingExpense);

  if (!includeForecast) return result;
  const rules = await tx.recurringTransaction.findMany({
    where: {
      workspaceId,
      status: "active",
      approvalStatus: "approved",
      deletedAt: null,
      completedAt: null,
      startDate: { lt: end },
      OR: [{ endDate: null }, { endDate: { gte: start } }],
    },
    select: {
      id: true,
      type: true,
      amount: true,
      dayOfMonth: true,
      startDate: true,
      endDate: true,
      nextExecutionDate: true,
      category: { select: { jarCode: true } },
    },
  });
  if (rules.length > 0) {
    const materialized = await tx.transaction.findMany({
      where: {
        recurringTransactionId: { in: rules.map((rule) => rule.id) },
        recurringPeriod: month,
        deletedAt: null,
      },
      select: { recurringTransactionId: true },
    });
    const materializedIds = new Set(materialized.map((record) => record.recurringTransactionId));
    for (const rule of rules) {
      if (materializedIds.has(rule.id) || rule.type === "transfer") continue;
      const dueDate = occurrenceDate(month, rule.dayOfMonth);
      if (dueDate < asIsoDate(rule.startDate) || (rule.endDate && dueDate > asIsoDate(rule.endDate))) continue;
      if (rule.nextExecutionDate && dueDate < asIsoDate(rule.nextExecutionDate)) continue;
      if (rule.type === "income") result.forecastIncome = result.forecastIncome.plus(rule.amount.toString());
      else addExpense(result.forecastExpenseByJar, rule.category?.jarCode ?? null, rule.amount.toString());
    }
  }
  for (const jarCode of FINANCIAL_JAR_CODES) {
    result.forecastExpenseByJar[jarCode] = Decimal.max(ZERO, result.forecastExpenseByJar[jarCode]);
  }
  return result;
}

export function combinedExpenseByJar(ledger: FinancialPlanMonthLedger, includeForecast: boolean) {
  return Object.fromEntries(FINANCIAL_JAR_CODES.map((jarCode) => [
    jarCode,
    Decimal.max(
      ZERO,
      ledger.approvedExpenseByJar[jarCode].plus(includeForecast ? ledger.forecastExpenseByJar[jarCode] : 0),
    ),
  ])) as JarDecimalMap;
}
