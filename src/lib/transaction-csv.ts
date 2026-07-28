export const TRANSACTION_CSV_HEADERS = ["Ngày", "Loại", "Danh mục", "Ví", "Số tiền", "Trạng thái", "Ghi chú"] as const;
export const TRANSACTION_CSV_MAX_ROWS = 50_000;

type NamedResource = { id: string; name: string };

export type TransactionCsvInput = {
  walletId: string;
  toWalletId?: string;
  categoryId?: string;
  categoryName?: string;
  type: "income" | "expense" | "transfer";
  amount: string;
  description?: string;
  date: string;
};

export type TransactionCsvExportRow = {
  date: string;
  type: string;
  category: string;
  wallet: string;
  toWallet?: string | null;
  amount: string;
  status: string;
  description: string;
};

export type TransactionCsvParseResult = {
  transactions: TransactionCsvInput[];
  missingCategories: Array<{ name: string; type: "income" | "expense" }>;
  errors: string[];
  totalRows: number;
};

function quoteCsv(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function formatCsvDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function buildTransactionCsv(rows: TransactionCsvExportRow[]) {
  return [
    TRANSACTION_CSV_HEADERS.join(","),
    ...rows.map((row) => [
      formatCsvDate(row.date),
      row.type,
      row.category,
      row.toWallet ? `${row.wallet} → ${row.toWallet}` : row.wallet,
      row.amount,
      row.status,
      row.description,
    ].map(quoteCsv).join(",")),
  ].join("\n");
}

function readCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (character !== "\r") {
      cell += character;
    }
  }

  row.push(cell);
  if (row.some((value) => value.length > 0) || rows.length === 0) rows.push(row);
  return { rows, quoted };
}

function normalizeLabel(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "D")
    .trim()
    .toLocaleLowerCase("vi-VN");
}

function normalizeResourceName(value: string) {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi-VN");
}

function uniqueResourceMap(resources: NamedResource[]) {
  const map = new Map<string, NamedResource | null>();
  for (const resource of resources) {
    const key = normalizeResourceName(resource.name);
    map.set(key, map.has(key) ? null : resource);
  }
  return map;
}

function parseDate(value: string) {
  const trimmed = value.trim();
  const vietnamese = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const parts = vietnamese
    ? { year: vietnamese[3], month: vietnamese[2], day: vietnamese[1] }
    : iso
      ? { year: iso[1], month: iso[2], day: iso[3] }
      : null;
  if (!parts) return null;

  const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const normalized = `${parts.year}-${parts.month}-${parts.day}`;
  return date.toISOString().slice(0, 10) === normalized ? normalized : null;
}

function parseType(value: string): TransactionCsvInput["type"] | null {
  const normalized = normalizeLabel(value);
  if (["income", "thu", "thu nhap"].includes(normalized)) return "income";
  if (["expense", "chi", "chi tieu"].includes(normalized)) return "expense";
  if (["transfer", "chuyen khoan"].includes(normalized)) return "transfer";
  return null;
}

function normalizeAmount(value: string) {
  let amount = value.trim().replace(/[₫đ\s]/giu, "").replace(/^\+/, "");
  if (!amount || amount.startsWith("-")) return null;

  const commaIndex = amount.lastIndexOf(",");
  const dotIndex = amount.lastIndexOf(".");
  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalSeparator = commaIndex > dotIndex ? "," : ".";
    const groupingSeparator = decimalSeparator === "," ? "." : ",";
    amount = amount.replaceAll(groupingSeparator, "").replace(decimalSeparator, ".");
  } else {
    const separator = commaIndex >= 0 ? "," : dotIndex >= 0 ? "." : null;
    if (separator) {
      const groupingPattern = new RegExp(`^\\d{1,3}(?:\\${separator}\\d{3})+$`);
      if (groupingPattern.test(amount)) amount = amount.replaceAll(separator, "");
      else amount = amount.replace(separator, ".");
    }
  }

  if (!/^\d+(?:\.\d{1,4})?$/.test(amount)) return null;
  const [integer, decimals = ""] = amount.split(".");
  if (integer.length > 16 || decimals.length > 4 || Number(amount) <= 0) return null;
  return amount;
}

function splitWallets(value: string) {
  return value.split(/\s*(?:→|->)\s*/).map((name) => name.trim());
}

export function parseTransactionCsv(
  text: string,
  wallets: NamedResource[],
  categories: NamedResource[],
  maximumRows = TRANSACTION_CSV_MAX_ROWS,
): TransactionCsvParseResult {
  const parsed = readCsv(text);
  if (parsed.quoted) return { transactions: [], missingCategories: [], errors: ["File CSV có dấu ngoặc kép chưa được đóng."], totalRows: 0 };
  if (parsed.rows.length === 0) return { transactions: [], missingCategories: [], errors: ["File CSV không có dữ liệu."], totalRows: 0 };

  const headerIndexes = new Map(parsed.rows[0].map((header, index) => [normalizeLabel(header), index]));
  const requiredHeaders = ["ngay", "loai", "vi", "so tien"];
  const missingHeaders = requiredHeaders.filter((header) => !headerIndexes.has(header));
  if (missingHeaders.length) {
    return {
      transactions: [],
      missingCategories: [],
      errors: [`Thiếu cột bắt buộc: ${missingHeaders.join(", ")}.`],
      totalRows: 0,
    };
  }

  const dataRows = parsed.rows.slice(1).filter((row) => row.some((cell) => cell.trim().length > 0));
  if (dataRows.length === 0) return { transactions: [], missingCategories: [], errors: ["File CSV chưa có giao dịch nào."], totalRows: 0 };
  if (dataRows.length > maximumRows) {
    return {
      transactions: [],
      missingCategories: [],
      errors: [`Mỗi lần chỉ được import tối đa ${maximumRows} giao dịch.`],
      totalRows: dataRows.length,
    };
  }

  const walletMap = uniqueResourceMap(wallets);
  const categoryMap = uniqueResourceMap(categories);
  const transactions: TransactionCsvInput[] = [];
  const missingCategoryMap = new Map<string, { name: string; type: "income" | "expense" }>();
  const errors: string[] = [];
  const valueAt = (row: string[], header: string) => row[headerIndexes.get(header) ?? -1] ?? "";

  dataRows.forEach((row, rowIndex) => {
    const line = rowIndex + 2;
    const rowErrors: string[] = [];
    const date = parseDate(valueAt(row, "ngay"));
    const type = parseType(valueAt(row, "loai"));
    const amount = normalizeAmount(valueAt(row, "so tien"));
    const walletNames = splitWallets(valueAt(row, "vi"));
    const sourceWallet = walletMap.get(normalizeResourceName(walletNames[0] ?? ""));
    const categoryName = valueAt(row, "danh muc").trim();
    const category = categoryName ? categoryMap.get(normalizeResourceName(categoryName)) : undefined;
    const description = valueAt(row, "ghi chu").trim();

    if (!date) rowErrors.push("ngày không hợp lệ");
    if (!type) rowErrors.push("loại giao dịch không hợp lệ");
    if (!amount) rowErrors.push("số tiền không hợp lệ");
    if (sourceWallet === undefined) rowErrors.push(`không tìm thấy ví “${walletNames[0] ?? ""}”`);
    if (sourceWallet === null) rowErrors.push(`tên ví “${walletNames[0]}” đang bị trùng`);
    if (categoryName && category === null) rowErrors.push(`tên danh mục “${categoryName}” đang bị trùng`);
    if (description.length > 2_000) rowErrors.push("ghi chú vượt quá 2.000 ký tự");

    let destinationWallet: NamedResource | null | undefined;
    if (type === "transfer") {
      if (walletNames.length !== 2 || !walletNames[1]) rowErrors.push("chuyển khoản phải có dạng “Ví nguồn → Ví nhận”");
      else {
        destinationWallet = walletMap.get(normalizeResourceName(walletNames[1]));
        if (destinationWallet === undefined) rowErrors.push(`không tìm thấy ví nhận “${walletNames[1]}”`);
        if (destinationWallet === null) rowErrors.push(`tên ví nhận “${walletNames[1]}” đang bị trùng`);
        if (sourceWallet && destinationWallet && sourceWallet.id === destinationWallet.id) rowErrors.push("ví nguồn và ví nhận phải khác nhau");
      }
    } else if (walletNames.length !== 1) {
      rowErrors.push("chỉ giao dịch chuyển khoản mới được có ví nhận");
    }

    if (rowErrors.length || !date || !type || !amount || !sourceWallet) {
      errors.push(`Dòng ${line}: ${rowErrors.join("; ")}.`);
      return;
    }

    if (categoryName && category === undefined) {
      const key = normalizeResourceName(categoryName);
      const inferredType = type === "income" ? "income" : "expense";
      const existing = missingCategoryMap.get(key);
      if (!existing) missingCategoryMap.set(key, { name: categoryName, type: inferredType });
      else if (existing.type !== inferredType) existing.type = "expense";
    }

    transactions.push({
      walletId: sourceWallet.id,
      ...(destinationWallet ? { toWalletId: destinationWallet.id } : {}),
      ...(category ? { categoryId: category.id } : {}),
      ...(categoryName && category === undefined ? { categoryName } : {}),
      type,
      amount,
      ...(description ? { description } : {}),
      date,
    });
  });

  return { transactions, missingCategories: [...missingCategoryMap.values()], errors, totalRows: dataRows.length };
}
