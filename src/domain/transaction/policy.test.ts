import { describe, expect, it } from "vitest";
import { transactionTimingForDate, workflowStatusForAppliedDate, workflowStatusForCreation } from "@/domain/transaction/policy";

describe("transaction time policy", () => {
  const today = "2026-07-21";

  it("derives timing directly from the selected business date", () => {
    expect(transactionTimingForDate("2026-07-20", today)).toBe("past");
    expect(transactionTimingForDate(today, today)).toBe("now");
    expect(transactionTimingForDate("2026-07-22", today)).toBe("future");
  });

  it("maps role and derived time to the expected initial workflow", () => {
    expect(workflowStatusForCreation("ADMIN", "past")).toBe("approved");
    expect(workflowStatusForCreation("MEMBER", "past")).toBe("pending");
    expect(workflowStatusForCreation("MEMBER", "now")).toBe("approved");
    expect(workflowStatusForCreation("MEMBER", "future")).toBe("scheduled");
    expect(workflowStatusForCreation("ADMIN", "future")).toBe("scheduled");
    expect(workflowStatusForAppliedDate("2026-07-22", today)).toBe("scheduled");
    expect(workflowStatusForAppliedDate(today, today)).toBe("approved");
  });
});
