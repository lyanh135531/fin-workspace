import {
  CATEGORY_PATH_SEPARATOR,
  categoryPathKey,
  normalizeCategoryKey,
  splitCategoryPath,
} from "@/lib/category-path";

export const TRANSACTION_CSV_HEADERS = [
  "Ngày",
  "Loại",
  "Danh mục",
  "Mã danh mục",
  "Đường dẫn danh mục",
  "Đường dẫn mã danh mục",
  "Loại hạng mục",
  "Ví",
  "Số tiền",
  "Trạng thái",
  "Ghi chú",
] as const;
export const TRANSACTION_CSV_MAX_ROWS = 50_000;

type NamedResource = { id: string; name: string };
export type TransactionCsvCategory = NamedResource & {
  code?: string;
  parentId?: string | null;
  type?: "income" | "expense";
  namePath?: string[];
  codePath?: string[];
  aliases?: Array<{ kind: string; value: string }>;
};

export type TransactionCsvCategoryReference = {
  name: string;
  code?: string;
  namePath: string[];
  codePath: string[];
  type: "income" | "expense";
};

export type TransactionCsvInput = {
  walletId: string;
  toWalletId?: string;
  categoryId?: string;
  categoryName?: string;
  categoryCode?: string;
  categoryPath?: string;
  categoryCodePath?: string;
  type: "income" | "expense" | "transfer";
  amount: string;
  description?: string;
  date: string;
};

export type TransactionCsvExportRow = {
  date: string;
  type: string;
  category: string;
  categoryCode?: string;
  categoryPath?: string;
  categoryCodePath?: string;
  categoryType?: "income" | "expense" | "";
  wallet: string;
  toWallet?: string | null;
  amount: string;
  status: string;
  description: string;
};

export type TransactionCsvParseResult = {
  transactions: TransactionCsvInput[];
  missingCategories: TransactionCsvCategoryReference[];
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
      row.categoryCode ?? "",
      row.categoryPath ?? row.category,
      row.categoryCodePath ?? row.categoryCode ?? "",
      row.categoryType ?? "",
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

function uniqueResourceMap<T extends NamedResource>(resources: T[]) {
  const map = new Map<string, T | null>();
  for (const resource of resources) {
    const key = normalizeCategoryKey(resource.name);
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
  categories: TransactionCsvCategory[],
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
  const categoryNameMap = uniqueResourceMap(categories);
  const categoryCodeMap = new Map<string, TransactionCsvCategory | null>();
  const categoryNamePathMap = new Map<string, TransactionCsvCategory | null>();
  const categoryCodePathMap = new Map<string, TransactionCsvCategory | null>();
  for (const category of categories) {
    if (category.code) {
      const key = normalizeCategoryKey(category.code);
      categoryCodeMap.set(key, categoryCodeMap.has(key) ? null : category);
    }
    if (category.namePath?.length) {
      const key = categoryPathKey(category.namePath);
      categoryNamePathMap.set(key, categoryNamePathMap.has(key) ? null : category);
    }
    if (category.codePath?.length) {
      const key = categoryPathKey(category.codePath);
      categoryCodePathMap.set(key, categoryCodePathMap.has(key) ? null : category);
    }
    for (const alias of category.aliases ?? []) {
      const key = alias.kind === "path" || alias.kind === "code_path"
        ? categoryPathKey(splitCategoryPath(alias.value))
        : normalizeCategoryKey(alias.value);
      const targetMap = alias.kind === "code"
        ? categoryCodeMap
        : alias.kind === "path"
          ? categoryNamePathMap
          : alias.kind === "code_path"
            ? categoryCodePathMap
            : categoryNameMap;
      targetMap.set(key, targetMap.has(key) ? null : category);
    }
  }
  const transactions: TransactionCsvInput[] = [];
  const missingCategoryMap = new Map<string, TransactionCsvCategoryReference>();
  const errors: string[] = [];
  const valueAt = (row: string[], header: string) => row[headerIndexes.get(header) ?? -1] ?? "";

  dataRows.forEach((row, rowIndex) => {
    const line = rowIndex + 2;
    const rowErrors: string[] = [];
    const date = parseDate(valueAt(row, "ngay"));
    const type = parseType(valueAt(row, "loai"));
    const amount = normalizeAmount(valueAt(row, "so tien"));
    const walletNames = splitWallets(valueAt(row, "vi"));
    const sourceWallet = walletMap.get(normalizeCategoryKey(walletNames[0] ?? ""));
    const categoryName = valueAt(row, "danh muc").trim();
    const categoryCode = valueAt(row, "ma danh muc").trim();
    const categoryNamePath = splitCategoryPath(valueAt(row, "duong dan danh muc").trim());
    const categoryCodePath = splitCategoryPath(valueAt(row, "duong dan ma danh muc").trim());
    const effectiveNamePath = categoryNamePath.length ? categoryNamePath : categoryName ? [categoryName] : [];
    const effectiveCodePath = categoryCodePath.length ? categoryCodePath : categoryCode ? [categoryCode] : [];
    const categoryCandidates = effectiveCodePath.length
      ? [
          categoryCodePathMap.get(categoryPathKey(effectiveCodePath)),
          effectiveCodePath.length === 1 ? categoryCodeMap.get(normalizeCategoryKey(effectiveCodePath[0])) : undefined,
        ]
      : effectiveNamePath.length > 1
        ? [categoryNamePathMap.get(categoryPathKey(effectiveNamePath))]
        : categoryName
          ? [categoryNameMap.get(normalizeCategoryKey(categoryName))]
          : [];
    const category = categoryCandidates.find((candidate) => candidate !== undefined);
    const description = valueAt(row, "ghi chu").trim();

    if (!date) rowErrors.push("ngày không hợp lệ");
    if (!type) rowErrors.push("loại giao dịch không hợp lệ");
    if (!amount) rowErrors.push("số tiền không hợp lệ");
    if (sourceWallet === undefined) rowErrors.push(`không tìm thấy ví “${walletNames[0] ?? ""}”`);
    if (sourceWallet === null) rowErrors.push(`tên ví “${walletNames[0]}” đang bị trùng`);
    if ((effectiveNamePath.length || effectiveCodePath.length) && category === null) {
      rowErrors.push(`hạng mục “${effectiveNamePath.join(CATEGORY_PATH_SEPARATOR) || effectiveCodePath.join(CATEGORY_PATH_SEPARATOR)}” đang bị trùng`);
    }
    if (category && type !== "transfer" && category.type && category.type !== type) {
      rowErrors.push(`hạng mục “${category.name}” không thuộc loại giao dịch này`);
    }
    if (type === "transfer" && (effectiveNamePath.length || effectiveCodePath.length)) {
      rowErrors.push("giao dịch chuyển khoản không được gán hạng mục Thu/Chi");
    }
    if (description.length > 2_000) rowErrors.push("ghi chú vượt quá 2.000 ký tự");

    let destinationWallet: NamedResource | null | undefined;
    if (type === "transfer") {
      if (walletNames.length !== 2 || !walletNames[1]) rowErrors.push("chuyển khoản phải có dạng “Ví nguồn → Ví nhận”");
      else {
        destinationWallet = walletMap.get(normalizeCategoryKey(walletNames[1]));
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

    if (effectiveNamePath.length && category === undefined && type !== "transfer") {
      const key = effectiveCodePath.length
        ? `code:${categoryPathKey(effectiveCodePath)}`
        : `name:${categoryPathKey(effectiveNamePath)}`;
      const inferredType = type === "income" ? "income" : "expense";
      const existing = missingCategoryMap.get(key);
      if (!existing) {
        missingCategoryMap.set(key, {
          name: effectiveNamePath.at(-1) ?? categoryName,
          ...(categoryCode ? { code: categoryCode } : {}),
          namePath: effectiveNamePath,
          codePath: effectiveCodePath,
          type: inferredType,
        });
      } else if (existing.type !== inferredType) {
        rowErrors.push(`hạng mục “${existing.name}” được dùng cho cả Thu và Chi`);
        errors.push(`Dòng ${line}: ${rowErrors.join("; ")}.`);
        return;
      }
    }

    transactions.push({
      walletId: sourceWallet.id,
      ...(destinationWallet ? { toWalletId: destinationWallet.id } : {}),
      ...(category ? { categoryId: category.id } : {}),
      ...(effectiveNamePath.length && category === undefined ? {
        categoryName: effectiveNamePath.at(-1) ?? categoryName,
        ...(categoryCode ? { categoryCode } : {}),
        categoryPath: effectiveNamePath.join(CATEGORY_PATH_SEPARATOR),
        ...(effectiveCodePath.length ? { categoryCodePath: effectiveCodePath.join(CATEGORY_PATH_SEPARATOR) } : {}),
      } : {}),
      type,
      amount,
      ...(description ? { description } : {}),
      date,
    });
  });

  return { transactions, missingCategories: [...missingCategoryMap.values()], errors, totalRows: dataRows.length };
}
