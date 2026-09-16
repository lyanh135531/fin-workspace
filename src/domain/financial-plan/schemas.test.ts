import { describe, expect, it } from "vitest";
import { createFinancialPlanSchema, createFinancialPlanWithGoalsSchema, financialPlanGoalInputSchema, planJarPercentagesSchema } from "@/domain/financial-plan/schemas";

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

  it("requires exactly one valid progress source for each goal", () => {
    const manual = financialPlanGoalInputSchema.safeParse({
      name: "Quỹ khẩn cấp", targetAmount: "50000000", existingAmount: "5000000",
      targetMonth: "2027-06", trackingMode: "manual",
    });
    expect(manual.success).toBe(true);
    expect(financialPlanGoalInputSchema.safeParse({
      name: "Du lịch", targetAmount: "20000000", existingAmount: "0",
      targetMonth: "2027-03", trackingMode: "linked_wallet",
    }).success).toBe(false);
    expect(financialPlanGoalInputSchema.safeParse({
      name: "Sai nguồn", targetAmount: "20000000", existingAmount: "0",
      targetMonth: "2027-03", trackingMode: "manual",
      linkedWalletId: "30000000-0000-0000-0000-000000000003",
    }).success).toBe(false);
  });

  it("accepts a multi-goal draft with shared jar allocation", () => {
    const parsed = createFinancialPlanWithGoalsSchema.parse({
      name: "Kế hoạch gia đình",
      goals: [
        { name: "Quỹ khẩn cấp", targetAmount: "50000000", existingAmount: "5000000", targetMonth: "2027-06", trackingMode: "manual" },
        { name: "Du lịch", targetAmount: "20000000", existingAmount: "0", targetMonth: "2027-03", trackingMode: "linked_wallet", linkedWalletId: "30000000-0000-0000-0000-000000000003" },
      ],
      percentages,
    });
    expect(parsed.goals).toHaveLength(2);
    expect(parsed.goals[0].targetAmount.toFixed(0)).toBe("50000000");
  });
});
