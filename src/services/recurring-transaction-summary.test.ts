import { describe, expect, it } from "vitest";

import { calculateActiveRecurringMonthlyNetAmount } from "@/services/recurring-transaction-summary";

describe("calculateActiveRecurringMonthlyNetAmount", () => {
  it("calculates income minus expense and ignores internal transfers", () => {
    const result = calculateActiveRecurringMonthlyNetAmount([
      {
        type: "expense",
        amount: "50000000",
        status: "active",
        completedAt: null,
      },
      {
        type: "income",
        amount: "31000000",
        status: "active",
        completedAt: null,
      },
      {
        type: "transfer",
        amount: "12000000",
        status: "active",
        completedAt: null,
      },
    ]);

    expect(result.toString()).toBe("-19000000");
  });

  it("excludes paused and completed schedules", () => {
    const result = calculateActiveRecurringMonthlyNetAmount([
      {
        type: "income",
        amount: "100.1",
        status: "active",
        completedAt: null,
      },
      {
        type: "expense",
        amount: "0.1",
        status: "active",
        completedAt: null,
      },
      {
        type: "income",
        amount: "999999",
        status: "deactive",
        completedAt: null,
      },
      {
        type: "expense",
        amount: "999999",
        status: "active",
        completedAt: "2026-08-25T00:00:00.000Z",
      },
    ]);

    expect(result.toString()).toBe("100");
  });
});
