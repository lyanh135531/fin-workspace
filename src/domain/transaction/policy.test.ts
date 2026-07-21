import { describe, expect, it } from "vitest";
import { transactionTimingForDate, validateTransactionDate, workflowStatusForAppliedDate, workflowStatusForCreation } from "@/domain/transaction/policy";

describe("transaction time policy", () => {
  const today = "2026-07-21";

  it("derives timing directly from the selected business date", () => {
    expect(transactionTimingForDate("2026-07-20", today)).toBe("past");
    expect(transactionTimingForDate(today, today)).toBe("now");
    expect(transactionTimingForDate("2026-07-22", today)).toBe("future");
  });

  it("keeps monthly workspace transactions inside their period", () => {
    expect(validateTransactionDate("2026-07-30", "2026-07")).toBe("2026-07-30");
    expect(() => validateTransactionDate("2026-08-01", "2026-07")).toThrow();
  });

  it("maps role and derived time to the expected initial workflow", () => {
    expect(workflowStatusForCreation("ADMIN", "past")).toBe("approved");
    expect(workflowStatusForCreation("MEMBER", "past")).toBe("pending");
    expect(workflowStatusForCreation("MEMBER", "now")).toBe("approved");
    expect(workflowStatusForCreation("ADMIN", "future")).toBe("scheduled");
    expect(workflowStatusForAppliedDate("2026-07-22", today)).toBe("scheduled");
    expect(workflowStatusForAppliedDate(today, today)).toBe("approved");
  });
});
