import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAN_JAR_PERCENTAGES,
  allocateJarBudgets,
  calculateLiveRequiredAmount,
  calculateMonthlyPlanBudget,
  decimalMap,
  deriveFinancialPlanHealth,
  firstMonthRawGrossBudget,
  splitVndAcrossMonths,
  validateJarPercentages,
} from "@/domain/financial-plan/calculator";
import {
  crossJarVector,
  firstMonthBudgetVectors,
  jarAllocationVectors,
  monthlyBudgetVectors,
  monthlySplitVectors,
} from "@/domain/financial-plan/calculator-test-vectors";
import { addMonths, monthDateRange, monthsInclusive } from "@/domain/financial-plan/month";

describe("financial plan calculator", () => {
  it.each(monthlyBudgetVectors)("implements monthly vector: $name", (vector) => {
    const result = calculateMonthlyPlanBudget({
      rawGrossBudget: new Decimal(vector.grossResources).minus(vector.requiredGoalAmount),
      requiredGoalAmount: vector.requiredGoalAmount,
      eligibleExpensesByJar: { ...decimalMap(), ESSENTIAL: new Decimal(vector.eligibleExpense) },
      percentages: DEFAULT_PLAN_JAR_PERCENTAGES,
    });
    expect(result.rawGrossBudget.toFixed(0)).toBe(vector.expected.rawGrossBudget);
    expect(result.allocatableGrossBudget.toFixed(0)).toBe(vector.expected.allocatableGrossBudget);
    expect(result.resourceShortfall.toFixed(0)).toBe(vector.expected.resourceShortfall);
    expect(result.budgetVariance.toFixed(0)).toBe(vector.expected.budgetVariance);
    expect(result.actualGoalAmountForMonth.toFixed(0)).toBe(vector.expected.actualGoalAmountForMonth);
  });

  it.each(firstMonthBudgetVectors)("implements first-month vector: $name", (vector) => {
    const rawGrossBudget = firstMonthRawGrossBudget(vector);
    const result = calculateMonthlyPlanBudget({
      rawGrossBudget,
      requiredGoalAmount: vector.requiredGoalAmount,
      eligibleExpensesByJar: { ...decimalMap(), ESSENTIAL: new Decimal(vector.totalEligibleExpense) },
      percentages: DEFAULT_PLAN_JAR_PERCENTAGES,
    });
    expect(result.rawGrossBudget.toFixed(0)).toBe(vector.expected.rawGrossBudget);
    expect(result.actualGoalAmountForMonth.toFixed(0)).toBe(vector.expected.actualGoalAmountForMonth);
    expect(new Decimal(vector.existingGoalAmount).plus(result.actualGoalAmountForMonth).toFixed(0))
      .toBe(vector.expected.totalProgressAfterClose);
  });

  it.each(monthlySplitVectors)("puts month division remainder in final month: $name", (vector) => {
    const result = splitVndAcrossMonths(
      new Decimal(vector.targetAmount).minus(vector.existingGoalAmount),
      vector.monthCount,
    );
    expect(result.map((value) => value.toFixed(0))).toEqual(vector.expectedContributions);
  });

  it("reforecasts remaining open months immediately from current projected progress", () => {
    expect(calculateLiveRequiredAmount({
      targetAmount: "100000000",
      projectedProgress: "0",
      remainingOpenMonths: 10,
    }).toFixed(0)).toBe("10000000");
    expect(calculateLiveRequiredAmount({
      targetAmount: "100000000",
      projectedProgress: "8000000",
      remainingOpenMonths: 9,
    }).toFixed(0)).toBe("10222222");
  });

  it.each(jarAllocationVectors)("puts jar rounding remainder in ESSENTIAL: $name", (vector) => {
    const result = allocateJarBudgets(vector.allocatableGrossBudget, vector.percentages);
    expect(Object.fromEntries(Object.entries(result).map(([key, value]) => [key, value.toFixed(0)])))
      .toEqual(vector.expectedAllocations);
  });

  it("keeps jar overspend separate from total plan overspend", () => {
    const result = calculateMonthlyPlanBudget({
      rawGrossBudget: "20000000",
      requiredGoalAmount: "10000000",
      eligibleExpensesByJar: crossJarVector.expenses,
      percentages: DEFAULT_PLAN_JAR_PERCENTAGES,
    });
    expect(result.remainingByJar.ESSENTIAL.toFixed(0)).toBe(crossJarVector.expectedEssentialRemaining);
    expect(result.totalRemaining.toFixed(0)).toBe(crossJarVector.expectedTotalRemaining);
    expect(result.totalOverspend.toFixed(0)).toBe(crossJarVector.expectedPlanCarry);
  });

  it("requires exactly six percentages totaling 100 with at most two decimals", () => {
    expect(() => validateJarPercentages({ ...DEFAULT_PLAN_JAR_PERCENTAGES, GIVING: new Decimal(4.99) }))
      .toThrow("chính xác 100%");
    expect(() => validateJarPercentages({ ...DEFAULT_PLAN_JAR_PERCENTAGES, GIVING: new Decimal(5.001) }))
      .toThrow("tối đa hai");
  });

  it("derives lifecycle health without storing it", () => {
    const base = {
      currentMonth: "2026-08", targetMonth: "2027-05", targetAmount: "100000000",
      realizedProgress: "20000000", requiredProgressThroughClosedMonths: "20000000",
      projectedEndOfPlanProgress: "100000000",
    };
    expect(deriveFinancialPlanHealth(base)).toBe("on_track");
    expect(deriveFinancialPlanHealth({ ...base, realizedProgress: "21000000" })).toBe("ahead");
    expect(deriveFinancialPlanHealth({ ...base, realizedProgress: "19000000" })).toBe("behind");
    expect(deriveFinancialPlanHealth({ ...base, projectedEndOfPlanProgress: "99000000" })).toBe("at_risk");
    expect(deriveFinancialPlanHealth({ ...base, realizedProgress: "100000000" })).toBe("goal_reached");
    expect(deriveFinancialPlanHealth({ ...base, currentMonth: "2027-06" })).toBe("overdue");
  });
});

describe("financial plan month arithmetic", () => {
  it("handles year boundaries deterministically", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(monthsInclusive("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(monthDateRange("2026-12").end.toISOString().slice(0, 10)).toBe("2027-01-01");
  });
});
