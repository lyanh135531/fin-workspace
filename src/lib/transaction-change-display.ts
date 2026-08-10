import { formatAmount } from "@/lib/format";

export type ComparableTransaction = {
  walletId: string;
  toWalletId: string | null;
  categoryId: string | null;
  type: string;
  amount: string;
  description: string | null;
  date: string;
};

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
  key: keyof ComparableTransaction,
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

export function getTransactionChangeAction(
  value: unknown,
): "update" | "delete" | null {
  const request = jsonRecord(value);
  const action = request?.action;
  return action === "update" || action === "delete" ? action : null;
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

  const fields: { key: keyof ComparableTransaction; label: string }[] = [
    { key: "amount", label: "Số tiền" },
    { key: "categoryId", label: "Danh mục" },
    { key: "walletId", label: "Ví" },
    { key: "toWalletId", label: "Ví nhận" },
    { key: "type", label: "Loại" },
    { key: "date", label: "Ngày" },
    { key: "description", label: "Nội dung" },
  ];

  return fields
    .filter(({ key }) => proposed[key] !== current[key])
    .map(({ key, label }) => ({
      label,
      previous: formatChangeValue(key, current[key], lookups),
      proposed: formatChangeValue(key, proposed[key], lookups),
    }));
}
