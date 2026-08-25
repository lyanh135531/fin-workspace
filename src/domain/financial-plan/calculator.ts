import Decimal from "decimal.js";
import { FINANCIAL_JAR_CODES, type FinancialJarCode } from "@/domain/financial-jar/jars";

export const FINANCIAL_PLAN_CALCULATOR_VERSION = "1.0.0";

export type DecimalValue = Decimal.Value;
export type JarDecimalMap = Record<FinancialJarCode, Decimal>;
export type FinancialPlanHealth = "ahead" | "on_track" | "behind" | "at_risk" | "goal_reached" | "overdue";

export const DEFAULT_PLAN_JAR_PERCENTAGES: JarDecimalMap = {
  ESSENTIAL: new Decimal(55),
  RESPONSIBILITY: new Decimal(10),
  DEVELOPMENT: new Decimal(10),
  ENJOYMENT: new Decimal(10),
  INVESTMENT: new Decimal(10),
  GIVING: new Decimal(5),
};

const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);

export function decimalMap(value: DecimalValue = 0): JarDecimalMap {
  return Object.fromEntries(FINANCIAL_JAR_CODES.map((jarCode) => [jarCode, new Decimal(value)])) as JarDecimalMap;
}

export function floorVnd(value: DecimalValue) {
  return new Decimal(value).toDecimalPlaces(0, Decimal.ROUND_FLOOR);
}

export function assertVnd(value: DecimalValue, label = "Số tiền") {
  const amount = new Decimal(value);
  if (!amount.isFinite() || amount.isNegative() || !amount.isInteger()) {
    throw new Error(`${label} phải là số nguyên VND không âm.`);
  }
  return amount;
}

export function validateJarPercentages(percentages: Record<FinancialJarCode, DecimalValue>): JarDecimalMap {
  const result = decimalMap();
  for (const jarCode of FINANCIAL_JAR_CODES) {
    const value = new Decimal(percentages[jarCode]);
    if (!value.isFinite() || value.isNegative() || value.greaterThan(HUNDRED)) {
      throw new Error(`Tỷ lệ hũ ${jarCode} phải nằm trong khoảng 0–100%.`);
    }
    if (!value.equals(value.toDecimalPlaces(2))) {
      throw new Error(`Tỷ lệ hũ ${jarCode} chỉ được có tối đa hai chữ số thập phân.`);
    }
    result[jarCode] = value;
  }
  const total = FINANCIAL_JAR_CODES.reduce((sum, jarCode) => sum.plus(result[jarCode]), ZERO);
  if (!total.equals(HUNDRED)) throw new Error("Tổng tỷ lệ sáu hũ phải bằng chính xác 100%.");
  return result;
}

export function splitVndAcrossMonths(total: DecimalValue, monthCount: number) {
  const amount = assertVnd(total);
  if (!Number.isInteger(monthCount) || monthCount <= 0) throw new Error("Số tháng phải là số nguyên dương.");
  const base = floorVnd(amount.dividedBy(monthCount));
  return Array.from({ length: monthCount }, (_, index) =>
    index === monthCount - 1 ? amount.minus(base.times(monthCount - 1)) : base,
  );
}

export function calculateLiveRequiredAmount(input: {
  targetAmount: DecimalValue;
  projectedProgress: DecimalValue;
  remainingOpenMonths: number;
}) {
  const remainingTarget = Decimal.max(
    assertVnd(input.targetAmount, "Số tiền mục tiêu").minus(
      assertVnd(input.projectedProgress, "Tiến độ dự kiến"),
    ),
    ZERO,
  );
  return splitVndAcrossMonths(remainingTarget, input.remainingOpenMonths)[0];
}

export function allocateJarBudgets(
  allocatableGrossBudget: DecimalValue,
  percentages: Record<FinancialJarCode, DecimalValue>,
) {
  const total = assertVnd(allocatableGrossBudget, "Hạn mức có thể phân bổ");
  const validPercentages = validateJarPercentages(percentages);
  const allocations = decimalMap();
  for (const jarCode of FINANCIAL_JAR_CODES) {
    allocations[jarCode] = floorVnd(total.times(validPercentages[jarCode]).dividedBy(HUNDRED));
  }
  const allocated = FINANCIAL_JAR_CODES.reduce((sum, jarCode) => sum.plus(allocations[jarCode]), ZERO);
  allocations.ESSENTIAL = allocations.ESSENTIAL.plus(total.minus(allocated));
  return allocations;
}

export function firstMonthRawGrossBudget(input: {
  currentWorkspaceBalance: DecimalValue;
  existingGoalAmount: DecimalValue;
  approvedExpenseFromMonthStart: DecimalValue;
  remainingForecastIncome: DecimalValue;
  requiredGoalAmount: DecimalValue;
}) {
  return new Decimal(input.currentWorkspaceBalance)
    .minus(input.existingGoalAmount)
    .plus(input.approvedExpenseFromMonthStart)
    .plus(input.remainingForecastIncome)
    .minus(input.requiredGoalAmount);
}

export function laterMonthRawGrossBudget(input: { forecastIncome: DecimalValue; requiredGoalAmount: DecimalValue }) {
  return new Decimal(input.forecastIncome).minus(input.requiredGoalAmount);
}

export function calculateMonthlyPlanBudget(input: {
  rawGrossBudget: DecimalValue;
  requiredGoalAmount: DecimalValue;
  eligibleExpensesByJar: Record<FinancialJarCode, DecimalValue>;
  percentages: Record<FinancialJarCode, DecimalValue>;
}) {
  const rawGrossBudget = new Decimal(input.rawGrossBudget);
  const requiredGoalAmount = assertVnd(input.requiredGoalAmount, "Khoản phải dành");
  const allocatableGrossBudget = Decimal.max(rawGrossBudget, ZERO);
  const resourceShortfall = Decimal.max(rawGrossBudget.negated(), ZERO);
  const allocatedByJar = allocateJarBudgets(allocatableGrossBudget, input.percentages);
  const expenseByJar = decimalMap();
  const remainingByJar = decimalMap();
  const overspendByJar = decimalMap();
  for (const jarCode of FINANCIAL_JAR_CODES) {
    expenseByJar[jarCode] = assertVnd(input.eligibleExpensesByJar[jarCode], `Chi phí hũ ${jarCode}`);
    remainingByJar[jarCode] = allocatedByJar[jarCode].minus(expenseByJar[jarCode]);
    overspendByJar[jarCode] = Decimal.max(remainingByJar[jarCode].negated(), ZERO);
  }
  const eligibleExpense = FINANCIAL_JAR_CODES.reduce((sum, jarCode) => sum.plus(expenseByJar[jarCode]), ZERO);
  const totalRemaining = allocatableGrossBudget.minus(eligibleExpense);
  const totalOverspend = Decimal.max(totalRemaining.negated(), ZERO);
  const budgetVariance = totalRemaining.minus(resourceShortfall);
  const actualGoalAmountForMonth = Decimal.max(requiredGoalAmount.plus(budgetVariance), ZERO);
  return {
    rawGrossBudget, allocatableGrossBudget, resourceShortfall, eligibleExpense,
    allocatedByJar, expenseByJar, remainingByJar, overspendByJar,
    totalRemaining, totalOverspend, budgetVariance, actualGoalAmountForMonth,
  };
}

export function deriveFinancialPlanHealth(input: {
  currentMonth: string;
  targetMonth: string;
  targetAmount: DecimalValue;
  realizedProgress: DecimalValue;
  requiredProgressThroughClosedMonths: DecimalValue;
  projectedEndOfPlanProgress: DecimalValue;
}): FinancialPlanHealth {
  const target = new Decimal(input.targetAmount);
  const realized = new Decimal(input.realizedProgress);
  if (realized.greaterThanOrEqualTo(target)) return "goal_reached";
  if (input.currentMonth > input.targetMonth) return "overdue";
  if (new Decimal(input.projectedEndOfPlanProgress).lessThan(target)) return "at_risk";
  const required = new Decimal(input.requiredProgressThroughClosedMonths);
  if (realized.greaterThan(required)) return "ahead";
  if (realized.lessThan(required)) return "behind";
  return "on_track";
}
