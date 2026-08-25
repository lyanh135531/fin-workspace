import { describe, expect, it } from "vitest";
import {
  FINANCIAL_JAR_CODES,
  FINANCIAL_JAR_LABELS,
} from "@/domain/financial-jar/jars";

describe("financial jars", () => {
  it("keeps the six system jar codes fixed", () => {
    expect(FINANCIAL_JAR_CODES).toEqual([
      "ESSENTIAL",
      "RESPONSIBILITY",
      "DEVELOPMENT",
      "ENJOYMENT",
      "INVESTMENT",
      "GIVING",
    ]);
  });

  it("has a stable Vietnamese label for every fixed jar", () => {
    expect(FINANCIAL_JAR_CODES.map((code) => FINANCIAL_JAR_LABELS[code])).toEqual([
      "Thiết yếu",
      "Trách nhiệm",
      "Phát triển",
      "Hưởng thụ",
      "Đầu tư",
      "Cho đi",
    ]);
  });
});
