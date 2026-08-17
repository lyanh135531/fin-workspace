import { describe, expect, it } from "vitest";
import { formatAmount, formatCompactAmount } from "@/lib/format";

describe("amount formatting", () => {
  it("uses the tỷ unit from one billion", () => {
    expect(formatAmount("1000000000")).toBe("1 tỷ");
    expect(formatAmount("1250000000")).toBe("1,25 tỷ");
    expect(formatAmount("-1500000000")).toBe("-1,5 tỷ");
  });

  it("keeps values below one billion fully formatted", () => {
    expect(formatAmount("999999999")).toBe("999.999.999");
  });
});

describe("compact amount formatting", () => {
  it("shortens chart-scale values using Vietnamese units", () => {
    expect(formatCompactAmount("5000000")).toBe("5 triệu");
    expect(formatCompactAmount("1250000")).toBe("1,3 triệu");
    expect(formatCompactAmount("850000")).toBe("850 nghìn");
    expect(formatCompactAmount("1500000000")).toBe("1,5 tỷ");
  });

  it("keeps small and negative values readable", () => {
    expect(formatCompactAmount("950")).toBe("950");
    expect(formatCompactAmount("-2500000")).toBe("-2,5 triệu");
  });
});
