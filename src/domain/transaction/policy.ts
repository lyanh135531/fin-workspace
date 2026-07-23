import { isAdminRole } from "@/domain/role-policy";

export type TransactionTiming = "past" | "now" | "future";

export function transactionTimingForDate(date: string, today: string): TransactionTiming {
  return date < today ? "past" : date > today ? "future" : "now";
}

export function workflowStatusForCreation(roleCode: string, timing: TransactionTiming) {
  if (timing === "future") return "scheduled" as const;
  if (timing === "past" && !isAdminRole(roleCode)) return "pending" as const;
  return "approved" as const;
}

export function workflowStatusForAppliedDate(date: string, today: string) {
  return date > today ? "scheduled" as const : "approved" as const;
}
