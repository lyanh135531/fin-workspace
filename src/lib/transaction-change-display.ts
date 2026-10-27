import Decimal from "decimal.js";
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

function parseDecimalAmount(value: unknown): Decimal | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? new Decimal(value) : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  try {
    const parsed = new Decimal(trimmed);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

function formatReviewAmount(value: string): string {
  const parsed = parseDecimalAmount(value);
  if (!parsed) return value;

  const sample = formatAmount("100");
  if (!/\d/.test(sample)) {
    return formatAmount(parsed.toFixed());
  }

  const sign = parsed.isNegative() && !parsed.isZero() ? "-" : "";
  const [integerPart, fractionPart] = parsed.abs().toFixed().split(".");
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const trimmedFraction = fractionPart ? fractionPart.replace(/0+$/, "") : "";
  return trimmedFraction
    ? `${sign}${groupedInteger},${trimmedFraction}`
    : `${sign}${groupedInteger}`;
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
  if (key === "amount" && typeof value === "number" && Number.isFinite(value)) {
    return formatReviewAmount(String(value));
  }
  if (typeof value !== "string") return "Dữ liệu không hợp lệ";

  if (key === "amount") {
    return formatReviewAmount(value);
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

function areSameAllocations(
  left: Array<{ walletId: string; amount: string }>,
  right: Array<{ walletId: string; amount: string }>,
): boolean {
  if (left.length !== right.length) return false;
  const compareItems = (
    a: { walletId: string; amount: string },
    b: { walletId: string; amount: string },
  ) => {
    const walletDiff = a.walletId.localeCompare(b.walletId);
    if (walletDiff !== 0) return walletDiff;
    const aDec = parseDecimalAmount(a.amount);
    const bDec = parseDecimalAmount(b.amount);
    if (aDec && bDec) return aDec.cmp(bDec);
    return a.amount.localeCompare(b.amount);
  };
  const sortedLeft = [...left].sort(compareItems);
  const sortedRight = [...right].sort(compareItems);
  return sortedLeft.every((item, index) => {
    const other = sortedRight[index];
    if (!other || item.walletId !== other.walletId) return false;
    const leftDec = parseDecimalAmount(item.amount);
    const rightDec = parseDecimalAmount(other.amount);
    if (leftDec && rightDec) return leftDec.eq(rightDec);
    return item.amount === other.amount;
  });
}

function formatAllocationsValue(
  allocations: Array<{ walletId: string; amount: string }>,
  lookups: TransactionChangeLookups,
): string {
  if (allocations.length === 0) return "—";
  return allocations
    .map(({ walletId, amount }) => {
      const walletName = lookups.wallets.get(walletId) ?? "Ví không còn khả dụng";
      const formattedAmount = formatReviewAmount(amount);
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
    .filter(({ key }) => {
      if (key === "amount") {
        const currentDec = parseDecimalAmount(current[key]);
        const proposedDec = parseDecimalAmount(proposed[key]);
        if (currentDec && proposedDec) {
          return !currentDec.eq(proposedDec);
        }
      }
      return proposed[key] !== current[key];
    })
    .map(({ key, label }) => ({
      label,
      previous: formatChangeValue(key, current[key], lookups),
      proposed: formatChangeValue(key, proposed[key], lookups),
    }));

  if (proposed.allocations !== undefined) {
    const currentAllocs = normalizeAllocations(current.allocations);
    const proposedAllocs = normalizeAllocations(proposed.allocations);
    if (!areSameAllocations(currentAllocs, proposedAllocs)) {
      details.push({
        label: "Nguồn trả thẻ",
        previous: formatAllocationsValue(currentAllocs, lookups),
        proposed: formatAllocationsValue(proposedAllocs, lookups),
      });
    }
  }

  return details;
}
