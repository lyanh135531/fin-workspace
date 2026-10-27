import Decimal from "decimal.js";
import { monthsInclusive } from "@/domain/financial-plan/month";

const ZERO = new Decimal(0);

export type GoalFundingCandidate = {
  id: string;
  targetAmount: Decimal.Value;
  actualProgress: Decimal.Value;
  targetMonth: string;
  sortOrder: number;
  createdAt?: Date | string;
};

export type GoalFundingAllocation = {
  goalId: string;
  requiredAmount: Decimal;
  allocatedAmount: Decimal;
  shortfall: Decimal;
};

export type FinancialGoalHealth =
  | "ahead"
  | "on_track"
  | "behind"
  | "at_risk"
  | "goal_reached"
  | "overdue";

function compareGoals(a: GoalFundingCandidate, b: GoalFundingCandidate) {
  return a.sortOrder - b.sortOrder
    || a.targetMonth.localeCompare(b.targetMonth)
    || String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""))
    || a.id.localeCompare(b.id);
}

export function requiredGoalAmountForMonth(
  targetAmount: Decimal.Value,
  actualProgress: Decimal.Value,
  currentMonth: string,
  targetMonth: string,
) {
  const remaining = Decimal.max(new Decimal(targetAmount).minus(actualProgress), ZERO);
  if (remaining.isZero()) return ZERO;
  if (targetMonth < currentMonth) return remaining;
  const monthCount = monthsInclusive(currentMonth, targetMonth).length;
  return remaining.dividedToIntegerBy(monthCount);
}

export function allocateGoalFundingByPriority(
  goals: GoalFundingCandidate[],
  monthlyFundingCapacity: Decimal.Value,
  currentMonth: string,
  roundingTolerance: Decimal.Value = ZERO,
): GoalFundingAllocation[] {
  let capacity = Decimal.max(monthlyFundingCapacity, ZERO);
  const tolerance = Decimal.max(roundingTolerance, ZERO);
  return [...goals].sort(compareGoals).map((goal) => {
    const requiredAmount = requiredGoalAmountForMonth(
      goal.targetAmount,
      goal.actualProgress,
      currentMonth,
      goal.targetMonth,
    );
    const monthsLeft =
      goal.targetMonth < currentMonth
        ? 1
        : monthsInclusive(currentMonth, goal.targetMonth).length;
    const isRoundingRemainder =
      monthsLeft === 1 &&
      capacity.greaterThan(ZERO) &&
      requiredAmount.greaterThan(capacity) &&
      requiredAmount.minus(capacity).lessThanOrEqualTo(tolerance);
    const allocatedAmount = isRoundingRemainder
      ? requiredAmount
      : Decimal.min(requiredAmount, capacity);
    capacity = isRoundingRemainder ? ZERO : capacity.minus(allocatedAmount);
    return {
      goalId: goal.id,
      requiredAmount,
      allocatedAmount,
      shortfall: requiredAmount.minus(allocatedAmount),
    };
  });
}

export function deriveGoalHealth(input: {
  currentMonth: string;
  targetMonth: string;
  targetAmount: Decimal.Value;
  actualProgress: Decimal.Value;
  projectedAtDeadline: Decimal.Value;
  expectedProgressNow: Decimal.Value;
}): FinancialGoalHealth {
  const target = new Decimal(input.targetAmount);
  const actual = new Decimal(input.actualProgress);
  const projected = new Decimal(input.projectedAtDeadline);
  const expected = new Decimal(input.expectedProgressNow);
  if (actual.greaterThanOrEqualTo(target)) return "goal_reached";
  if (input.currentMonth > input.targetMonth) return "overdue";
  if (projected.lessThan(target)) return "at_risk";
  if (actual.greaterThan(expected)) return "ahead";
  if (actual.lessThan(expected)) return "behind";
  return "on_track";
}

export function simulateGoalFunding(input: {
  goals: GoalFundingCandidate[];
  monthlyFundingCapacity: Decimal.Value;
  startMonth: string;
}) {
  const progress = new Map(input.goals.map((goal) => [goal.id, new Decimal(goal.actualProgress)]));
  const lastMonth = [...input.goals].sort((a, b) => b.targetMonth.localeCompare(a.targetMonth))[0]?.targetMonth;
  if (!lastMonth || lastMonth < input.startMonth) return { months: [], projectedByGoal: progress };
  const allMonths = monthsInclusive(input.startMonth, lastMonth);
  const roundingTolerance = new Decimal(allMonths.length * Math.max(1, input.goals.length));
  const months = allMonths.map((month) => {
    const active = input.goals
      .filter((goal) => month <= goal.targetMonth && (progress.get(goal.id) ?? ZERO).lessThan(goal.targetAmount))
      .map((goal) => ({ ...goal, actualProgress: progress.get(goal.id) ?? ZERO }));
    const allocations = allocateGoalFundingByPriority(
      active,
      input.monthlyFundingCapacity,
      month,
      roundingTolerance,
    );
    for (const allocation of allocations) {
      progress.set(allocation.goalId, (progress.get(allocation.goalId) ?? ZERO).plus(allocation.allocatedAmount));
    }
    return { month, allocations };
  });
  return { months, projectedByGoal: progress };
}
