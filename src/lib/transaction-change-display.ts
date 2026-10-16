import { formatAmount } from "@/lib/format";

export type ComparableTransaction = {
  walletId: string;
  toWalletId: string | null;
  categoryId: string | null;
  type: string;
  amount: string;
  description: string | null;
  date: string;
  allocations?: Array<{ walletId: string; amount: string }>;
};

type ComparableTransactionScalarKey = Exclude<
  keyof ComparableTransaction,
  "allocations"
>;

export type TransactionChangeDetail = {
  label: string;
  previous: string;
  proposed: string;
};

export type TransactionChangeLookups = {
  wallets: ReadonlyMap<string, string>;
  categories: ReadonlyMap<string, string>;
};

function jsonRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function formatChangeDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatChangeValue(
  key: ComparableTransactionScalarKey,
  value: unknown,
  lookups: TransactionChangeLookups,
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value !== "string") return "Dữ liệu không hợp lệ";

  if (key === "amount") {
    return /^\d+(\.\d+)?$/.test(value) ? formatAmount(value) : value;
  }
  if (key === "walletId" || key === "toWalletId") {
    return lookups.wallets.get(value) ?? "Ví không còn khả dụng";
  }
  if (key === "categoryId") {
    return lookups.categories.get(value) ?? "Danh mục không còn khả dụng";
  }
  if (key === "type") {
    const labels: Record<string, string> = {
      expense: "Chi tiêu",
      income: "Thu nhập",
      transfer: "Chuyển khoản",
    };
    return labels[value] ?? value;
  }
  if (key === "date") return formatChangeDate(value);
  return value;
}

function normalizeAllocations(
  value: unknown,
): Array<{ walletId: string; amount: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const rec = jsonRecord(item);
      const walletId = typeof rec?.walletId === "string" ? rec.walletId : "";
      const rawAmount =
        typeof rec?.amount === "string" || typeof rec?.amount === "number"
          ? String(rec.amount)
          : "";
      return { walletId, amount: rawAmount };
    })
    .filter((item) => item.walletId && item.amount);
}

function formatAllocationsValue(
  allocations: Array<{ walletId: string; amount: string }>,
  lookups: TransactionChangeLookups,
): string {
  if (allocations.length === 0) return "—";
  return allocations
    .map(({ walletId, amount }) => {
      const walletName = lookups.wallets.get(walletId) ?? "Ví không còn khả dụng";
      const formattedAmount = /^\d+(\.\d+)?$/.test(amount)
        ? formatAmount(amount)
        : amount;
      return `${walletName}: ${formattedAmount}`;
    })
    .join(", ");
}

export function getTransactionChangeAction(
  value: unknown,
): "update" | "delete" | null {
  const request = jsonRecord(value);
  const action = request?.action;
  return action === "update" || action === "delete" ? action : null;
}

export function getTransactionChangeReason(value: unknown): string | null {
  const request = jsonRecord(value);
  const reason = request?.reason;
  return typeof reason === "string" && reason.trim() ? reason.trim() : null;
}

export function getTransactionChangeDetails(
  value: unknown,
  current: ComparableTransaction,
  lookups: TransactionChangeLookups,
): TransactionChangeDetail[] {
  const request = jsonRecord(value);
  if (request?.action !== "update") return [];
  const proposed = jsonRecord(request.transaction);
  if (!proposed) return [];

  const fields: { key: ComparableTransactionScalarKey; label: string }[] = [
    { key: "amount", label: "Số tiền" },
    { key: "categoryId", label: "Danh mục" },
    { key: "walletId", label: "Ví" },
    { key: "toWalletId", label: "Ví nhận" },
    { key: "type", label: "Loại" },
    { key: "date", label: "Ngày" },
    { key: "description", label: "Nội dung" },
  ];

  const details: TransactionChangeDetail[] = fields
    .filter(({ key }) => proposed[key] !== current[key])
    .map(({ key, label }) => ({
      label,
      previous: formatChangeValue(key, current[key], lookups),
      proposed: formatChangeValue(key, proposed[key], lookups),
    }));

  if (proposed.allocations !== undefined) {
    const currentAllocs = normalizeAllocations(current.allocations);
    const proposedAllocs = normalizeAllocations(proposed.allocations);
    const canonical = (items: Array<{ walletId: string; amount: string }>) =>
      items
        .map(
          ({ walletId, amount }) =>
            `${walletId}:${/^\d+(\.\d+)?$/.test(amount) ? formatAmount(amount) : amount}`,
        )
        .sort()
        .join("|");
    if (canonical(currentAllocs) !== canonical(proposedAllocs)) {
      details.push({
        label: "Nguồn trả thẻ",
        previous: formatAllocationsValue(currentAllocs, lookups),
        proposed: formatAllocationsValue(proposedAllocs, lookups),
      });
    }
  }

  return details;
}
