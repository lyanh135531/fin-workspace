import { describe, expect, it } from "vitest";
import {
  executionDateForMonth,
  firstExecutionOnOrAfter,
  nextMonthlyExecution,
} from "@/domain/recurring-transaction/schedule-date";

describe("recurring transaction schedule dates", () => {
  it("uses the final day when a month does not contain the configured day", () => {
    expect(executionDateForMonth(2026, 2, 31)).toBe("2026-02-28");
    expect(executionDateForMonth(2028, 2, 31)).toBe("2028-02-29");
    expect(executionDateForMonth(2026, 4, 31)).toBe("2026-04-30");
  });

  it("uses today when a schedule is registered on its execution day", () => {
    expect(firstExecutionOnOrAfter("2026-07-23", 23)).toBe("2026-07-23");
  });

  it("moves a past day to the following month", () => {
    expect(firstExecutionOnOrAfter("2026-07-23", 5)).toBe("2026-08-05");
  });

  it("keeps the configured day while advancing through short months", () => {
    expect(nextMonthlyExecution("2026-01-31", 31)).toBe("2026-02-28");
    expect(nextMonthlyExecution("2026-02-28", 31)).toBe("2026-03-31");
  });
});
