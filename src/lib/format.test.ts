import { describe, expect, it } from "vitest";
import { formatCompactAmount } from "@/lib/format";

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
