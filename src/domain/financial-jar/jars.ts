import { z } from "zod";

export const FINANCIAL_JAR_CODES = [
  "ESSENTIAL",
  "RESPONSIBILITY",
  "DEVELOPMENT",
  "ENJOYMENT",
  "INVESTMENT",
  "GIVING",
] as const;

export const financialJarCodeSchema = z.enum(FINANCIAL_JAR_CODES);
export type FinancialJarCode = z.output<typeof financialJarCodeSchema>;

export const FINANCIAL_JAR_LABELS: Readonly<Record<FinancialJarCode, string>> = {
  ESSENTIAL: "Thiết yếu",
  RESPONSIBILITY: "Trách nhiệm",
  DEVELOPMENT: "Phát triển",
  ENJOYMENT: "Hưởng thụ",
  INVESTMENT: "Đầu tư",
  GIVING: "Cho đi",
};

export const FINANCIAL_JAR_OPTIONS = FINANCIAL_JAR_CODES.map((value) => ({
  value,
  label: FINANCIAL_JAR_LABELS[value],
}));
