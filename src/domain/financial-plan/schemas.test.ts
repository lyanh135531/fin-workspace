import { describe, expect, it } from "vitest";
import { createFinancialPlanSchema, planJarPercentagesSchema } from "@/domain/financial-plan/schemas";

const percentages = {
  ESSENTIAL: "55", RESPONSIBILITY: "10", DEVELOPMENT: "10",
  ENJOYMENT: "10", INVESTMENT: "10", GIVING: "5",
};

describe("financial plan schemas", () => {
  it("accepts integer VND and the fixed six-jar ratio", () => {
    const parsed = createFinancialPlanSchema.parse({ name: "Tết", targetAmount: "100000000", targetMonth: "2027-05", percentages });
    expect(parsed.existingGoalAmount.toFixed(0)).toBe("0");
    expect(parsed.targetAmount.toFixed(0)).toBe("100000000");
  });

  it("rejects fractional VND and existing money above target", () => {
    expect(createFinancialPlanSchema.safeParse({ name: "Tết", targetAmount: "100.5", targetMonth: "2027-05", percentages }).success).toBe(false);
    expect(createFinancialPlanSchema.safeParse({ name: "Tết", targetAmount: "100", existingGoalAmount: "101", targetMonth: "2027-05", percentages }).success).toBe(false);
  });

  it("requires all six jars and an exact 100 percent total", () => {
    expect(planJarPercentagesSchema.safeParse({ ...percentages, GIVING: "4.99" }).success).toBe(false);
    const missing: Partial<typeof percentages> = { ...percentages };
    delete missing.GIVING;
    expect(planJarPercentagesSchema.safeParse(missing).success).toBe(false);
  });
});
