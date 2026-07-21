import { AppError } from "@/lib/errors";

export type TransactionTiming = "past" | "now" | "future";

export function transactionTimingForDate(date: string, today: string): TransactionTiming {
  return date < today ? "past" : date > today ? "future" : "now";
}

export function validateTransactionDate(date: string, monthlyPeriod?: string) {
  if (monthlyPeriod && date.slice(0, 7) !== monthlyPeriod) {
    throw new AppError("VALIDATION_ERROR", `Ngày giao dịch phải thuộc kỳ ${monthlyPeriod} của workspace này.`);
  }
  return date;
}

export function workflowStatusForCreation(roleCode: string, timing: TransactionTiming) {
  if (timing === "future") return "scheduled" as const;
  if (timing === "past" && roleCode !== "ADMIN") return "pending" as const;
  return "approved" as const;
}

export function workflowStatusForAppliedDate(date: string, today: string) {
  return date > today ? "scheduled" as const : "approved" as const;
}
