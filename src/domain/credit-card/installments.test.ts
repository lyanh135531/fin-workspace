import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { dueDateAfterStatement, firstStatementOnOrAfter, installmentAmounts, nextStatementDate } from "@/domain/credit-card/installments";
import { installmentInputSchema } from "@/domain/credit-card/schemas";

describe("credit card installment schedule", () => {
  it("clamps statement and due days to the end of short months", () => {
    expect(firstStatementOnOrAfter("2027-02-10", 31)).toBe("2027-02-28");
    expect(nextStatementDate("2027-02-28", 31)).toBe("2027-03-31");
    expect(dueDateAfterStatement("2027-01-31", 31)).toBe("2027-02-28");
  });

  it("uses a due day later in the same month when possible", () => {
    expect(dueDateAfterStatement("2026-09-05", 20)).toBe("2026-09-20");
    expect(dueDateAfterStatement("2026-09-25", 10)).toBe("2026-10-10");
  });

  it("puts rounding remainder in the final installment", () => {
    const parts = installmentAmounts("100", 3);
    expect(parts.map((part) => part.toFixed(4))).toEqual(["33.3333", "33.3333", "33.3334"]);
    expect(parts.reduce((sum, part) => sum.plus(part), new Decimal(0)).eq(100)).toBe(true);
  });

  it("only accepts supported terms and a non-negative fee", () => {
    expect(installmentInputSchema.parse({ termCount: 12, feeAmount: "0" }).termCount).toBe(12);
    expect(installmentInputSchema.safeParse({ termCount: 5, feeAmount: "0" }).success).toBe(false);
    expect(installmentInputSchema.safeParse({ termCount: 3, feeAmount: "-1" }).success).toBe(false);
  });
});
