import { describe, expect, it } from "vitest";
import { allocateGoalFundingByPriority, deriveGoalHealth, simulateGoalFunding } from "@/domain/financial-plan/goal-calculator";

describe("financial goal calculator", () => {
  it("uses user priority before deadline when capacity is insufficient", () => {
    const result = allocateGoalFundingByPriority([
      { id: "later-first", targetAmount: "600", actualProgress: "0", targetMonth: "2026-12", sortOrder: 0 },
      { id: "near-second", targetAmount: "300", actualProgress: "0", targetMonth: "2026-10", sortOrder: 1 },
    ], "100", "2026-09");
    expect(result.map((item) => [item.goalId, item.allocatedAmount.toString()])).toEqual([
      ["later-first", "100"],
      ["near-second", "0"],
    ]);
  });

  it("uses deadline as the deterministic tie-break", () => {
    const result = allocateGoalFundingByPriority([
      { id: "later", targetAmount: "200", actualProgress: "0", targetMonth: "2026-12", sortOrder: 0 },
      { id: "near", targetAmount: "200", actualProgress: "0", targetMonth: "2026-10", sortOrder: 0 },
    ], "100", "2026-09");
    expect(result[0].goalId).toBe("near");
  });

  it("simulates without allocating more than the monthly requirement", () => {
    const result = simulateGoalFunding({
      goals: [{ id: "g", targetAmount: "300", actualProgress: "0", targetMonth: "2026-11", sortOrder: 0 }],
      monthlyFundingCapacity: "500",
      startMonth: "2026-09",
    });
    expect(result.projectedByGoal.get("g")?.toString()).toBe("300");
  });

  it("derives actionable health states", () => {
    expect(deriveGoalHealth({ currentMonth: "2026-09", targetMonth: "2026-10", targetAmount: "100", actualProgress: "20", projectedAtDeadline: "70", expectedProgressNow: "50" })).toBe("at_risk");
    expect(deriveGoalHealth({ currentMonth: "2026-11", targetMonth: "2026-10", targetAmount: "100", actualProgress: "80", projectedAtDeadline: "80", expectedProgressNow: "100" })).toBe("overdue");
    expect(deriveGoalHealth({ currentMonth: "2026-09", targetMonth: "2026-10", targetAmount: "100", actualProgress: "100", projectedAtDeadline: "100", expectedProgressNow: "50" })).toBe("goal_reached");
  });
});
