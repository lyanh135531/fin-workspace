import { describe, expect, it } from "vitest";
import { recurringTransactionSchema } from "@/domain/recurring-transaction/schemas";

const base = {
  walletId: "00000000-0000-0000-0000-000000000001",
  type: "income",
  amount: "15000000",
  startDate: "2026-07-25",
};

describe("recurringTransactionSchema", () => {
  it("accepts an open-ended effective range", () => {
    const parsed = recurringTransactionSchema.parse({ ...base, endDate: "" });
    expect(parsed.endDate).toBeUndefined();
  });

  it("accepts an inclusive end date", () => {
    const parsed = recurringTransactionSchema.parse({ ...base, endDate: "2026-12-25" });
    expect(parsed.endDate).toBe("2026-12-25");
  });

  it("rejects an end date before the start date", () => {
    const result = recurringTransactionSchema.safeParse({
      ...base,
      endDate: "2026-06-30",
    });
    expect(result.success).toBe(false);
  });

  it("requires a category for a recurring expense", () => {
    const result = recurringTransactionSchema.safeParse({ ...base, type: "expense" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["categoryId"] }));
  });
});
