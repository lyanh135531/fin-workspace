import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  crossJarVector,
  firstMonthBudgetVectors,
  jarAllocationVectors,
  monthlyBudgetVectors,
  monthlySplitVectors,
} from "@/domain/financial-plan/calculator-test-vectors";

const zero = new Decimal(0);
const floorVnd = (value: Decimal) => value.toDecimalPlaces(0, Decimal.ROUND_FLOOR);

describe("financial plan calculator contract vectors", () => {
  it.each(monthlyBudgetVectors)("locks monthly budget formula: $name", (vector) => {
    const grossResources = new Decimal(vector.grossResources);
    const required = new Decimal(vector.requiredGoalAmount);
    const expense = new Decimal(vector.eligibleExpense);
    const rawGross = grossResources.minus(required);
    const allocatable = Decimal.max(rawGross, zero);
    const shortfall = Decimal.max(rawGross.negated(), zero);
    const variance = allocatable.minus(expense).minus(shortfall);
    const actualGoal = Decimal.max(required.plus(variance), zero);

    expect(rawGross.toFixed(0)).toBe(vector.expected.rawGrossBudget);
    expect(allocatable.toFixed(0)).toBe(vector.expected.allocatableGrossBudget);
    expect(shortfall.toFixed(0)).toBe(vector.expected.resourceShortfall);
    expect(variance.toFixed(0)).toBe(vector.expected.budgetVariance);
    expect(actualGoal.toFixed(0)).toBe(vector.expected.actualGoalAmountForMonth);
  });

  it.each(firstMonthBudgetVectors)("locks first-month formula: $name", (vector) => {
    const existingGoal = new Decimal(vector.existingGoalAmount);
    const required = new Decimal(vector.requiredGoalAmount);
    const expense = new Decimal(vector.totalEligibleExpense);
    const rawGross = new Decimal(vector.currentWorkspaceBalance)
      .minus(existingGoal)
      .plus(vector.approvedExpenseFromMonthStart)
      .plus(vector.remainingForecastIncome)
      .minus(required);
    const allocatable = Decimal.max(rawGross, zero);
    const shortfall = Decimal.max(rawGross.negated(), zero);
    const actualGoal = Decimal.max(
      required.plus(allocatable.minus(expense).minus(shortfall)),
      zero,
    );

    expect(rawGross.toFixed(0)).toBe(vector.expected.rawGrossBudget);
    expect(allocatable.toFixed(0)).toBe(vector.expected.allocatableGrossBudget);
    expect(shortfall.toFixed(0)).toBe(vector.expected.resourceShortfall);
    expect(actualGoal.toFixed(0)).toBe(vector.expected.actualGoalAmountForMonth);
    expect(existingGoal.plus(actualGoal).toFixed(0)).toBe(
      vector.expected.totalProgressAfterClose,
    );
  });

  it.each(monthlySplitVectors)("locks monthly contribution rounding: $name", (vector) => {
    const remaining = new Decimal(vector.targetAmount).minus(vector.existingGoalAmount);
    const base = floorVnd(remaining.dividedBy(vector.monthCount));
    const actual = Array.from({ length: vector.monthCount }, (_, index) =>
      index === vector.monthCount - 1
        ? remaining.minus(base.times(vector.monthCount - 1)).toFixed(0)
        : base.toFixed(0),
    );

    expect(actual).toEqual(vector.expectedContributions);
    expect(actual.reduce((sum, amount) => sum.plus(amount), zero).toFixed(0)).toBe(
      remaining.toFixed(0),
    );
  });

  it.each(jarAllocationVectors)("locks jar allocation rounding: $name", (vector) => {
    const total = new Decimal(vector.allocatableGrossBudget);
    const entries = Object.entries(vector.percentages);
    const allocations = Object.fromEntries(
      entries.map(([jarCode, percentage]) => [
        jarCode,
        floorVnd(total.times(percentage).dividedBy(100)),
      ]),
    );
    const allocated = Object.values(allocations).reduce((sum, amount) => sum.plus(amount), zero);
    allocations.ESSENTIAL = allocations.ESSENTIAL.plus(total.minus(allocated));

    expect(
      Object.fromEntries(
        Object.entries(allocations).map(([jarCode, amount]) => [jarCode, amount.toFixed(0)]),
      ),
    ).toEqual(vector.expectedAllocations);
  });

  it("keeps jar overspend separate from total plan overspend", () => {
    const allocations = Object.values(crossJarVector.allocations).reduce(
      (sum, amount) => sum.plus(amount),
      zero,
    );
    const expenses = Object.values(crossJarVector.expenses).reduce(
      (sum, amount) => sum.plus(amount),
      zero,
    );
    const essentialRemaining = new Decimal(crossJarVector.allocations.ESSENTIAL).minus(
      crossJarVector.expenses.ESSENTIAL,
    );
    const totalRemaining = allocations.minus(expenses);
    const carry = Decimal.max(totalRemaining.negated(), zero);

    expect(essentialRemaining.toFixed(0)).toBe(crossJarVector.expectedEssentialRemaining);
    expect(totalRemaining.toFixed(0)).toBe(crossJarVector.expectedTotalRemaining);
    expect(carry.toFixed(0)).toBe(crossJarVector.expectedPlanCarry);
  });
});
