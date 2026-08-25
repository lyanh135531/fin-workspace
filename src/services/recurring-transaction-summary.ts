import Decimal from "decimal.js";

type RecurringMonthlySummaryItem = {
  type: "income" | "expense" | "transfer";
  amount: Decimal.Value;
  status: "active" | "deactive";
  completedAt: Date | string | null;
};

export function calculateActiveRecurringMonthlyNetAmount(
  items: RecurringMonthlySummaryItem[],
): Decimal {
  return items.reduce((total, item) => {
    if (item.status !== "active" || item.completedAt) return total;

    const amount = new Decimal(item.amount);
    if (item.type === "income") return total.plus(amount);
    if (item.type === "expense") return total.minus(amount);
    return total;
  }, new Decimal(0));
}
