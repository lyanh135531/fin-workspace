import { describe, expect, it } from "vitest";
import { buildTransactionCsv, parseTransactionCsv } from "@/lib/transaction-csv";

const wallets = [
  { id: "00000000-0000-0000-0000-000000000101", name: "Ví chính" },
  { id: "00000000-0000-0000-0000-000000000102", name: "Ví phụ" },
];
const categories = [{ id: "00000000-0000-0000-0000-000000000201", name: "Ăn uống" }];

describe("transaction CSV", () => {
  it("round-trips the exported format including quoted notes", () => {
    const csv = buildTransactionCsv([{
      date: "2026-07-28",
      type: "expense",
      category: "Ăn uống",
      wallet: "Ví chính",
      amount: "125000",
      status: "approved",
      description: "Bữa tối, có khách",
    }]);

    expect(parseTransactionCsv(csv, wallets, categories)).toEqual({
      transactions: [{
        walletId: wallets[0].id,
        categoryId: categories[0].id,
        type: "expense",
        amount: "125000",
        description: "Bữa tối, có khách",
        date: "2026-07-28",
      }],
      missingCategories: [],
      errors: [],
      totalRows: 1,
    });
  });

  it("imports Vietnamese labels, formatted amounts, and transfers", () => {
    const csv = [
      "Ngày,Loại,Danh mục,Ví,Số tiền,Trạng thái,Ghi chú",
      '"28/07/2026","Thu nhập","","Ví chính","18.000.000","","Lương"',
      '"2026-07-29","Chuyển khoản","","Ví chính → Ví phụ","1.250.000","","Điều chuyển"',
    ].join("\n");

    const result = parseTransactionCsv(csv, wallets, categories);
    expect(result.errors).toEqual([]);
    expect(result.transactions).toMatchObject([
      { type: "income", amount: "18000000", walletId: wallets[0].id },
      { type: "transfer", amount: "1250000", walletId: wallets[0].id, toWalletId: wallets[1].id },
    ]);
  });

  it("reports all invalid resource mappings without returning them as importable rows", () => {
    const csv = [
      "Ngày,Loại,Danh mục,Ví,Số tiền,Trạng thái,Ghi chú",
      '"31/02/2026","Chi tiêu","Không tồn tại","Ví lạ","-10","",""',
    ].join("\n");

    const result = parseTransactionCsv(csv, wallets, categories);
    expect(result.transactions).toEqual([]);
    expect(result.errors[0]).toContain("Dòng 2");
    expect(result.errors[0]).toContain("ngày không hợp lệ");
    expect(result.errors[0]).toContain("không tìm thấy ví");
  });

  it("records categories that need to be created in the workspace", () => {
    const csv = [
      "Ngày,Loại,Danh mục,Ví,Số tiền,Trạng thái,Ghi chú",
      '"28/07/2026","Chi tiêu","Chăm sóc thú cưng","Ví chính","250000","","Thức ăn"',
    ].join("\n");

    const result = parseTransactionCsv(csv, wallets, categories);
    expect(result.errors).toEqual([]);
    expect(result.missingCategories).toEqual([{
      name: "Chăm sóc thú cưng",
      namePath: ["Chăm sóc thú cưng"],
      codePath: [],
      type: "expense",
    }]);
    expect(result.transactions[0]).toMatchObject({
      categoryName: "Chăm sóc thú cưng",
      type: "expense",
    });
  });

  it("preserves and resolves a multi-level category path", () => {
    const hierarchicalCategories = [
      {
        id: "00000000-0000-0000-0000-000000000210",
        name: "Sinh hoạt",
        code: "LIVING",
        type: "expense" as const,
        namePath: ["Sinh hoạt"],
        codePath: ["LIVING"],
      },
      {
        id: "00000000-0000-0000-0000-000000000211",
        name: "Cà phê",
        code: "COFFEE",
        type: "expense" as const,
        namePath: ["Sinh hoạt", "Cà phê"],
        codePath: ["LIVING", "COFFEE"],
      },
    ];
    const csv = buildTransactionCsv([{
      date: "2026-07-28",
      type: "expense",
      category: "Cà phê",
      categoryCode: "COFFEE",
      categoryPath: "Sinh hoạt > Cà phê",
      categoryCodePath: "LIVING > COFFEE",
      categoryType: "expense",
      wallet: "Ví chính",
      amount: "50000",
      status: "approved",
      description: "",
    }]);

    const result = parseTransactionCsv(csv, wallets, hierarchicalCategories);
    expect(result.errors).toEqual([]);
    expect(result.transactions[0]).toMatchObject({
      categoryId: hierarchicalCategories[1].id,
      type: "expense",
    });
  });

  it("accepts CSV files with more than one hundred transactions", () => {
    const rows = Array.from({ length: 1_001 }, () => '"28/07/2026","income","","Ví chính","1","",""');
    const result = parseTransactionCsv(["Ngày,Loại,Danh mục,Ví,Số tiền,Trạng thái,Ghi chú", ...rows].join("\n"), wallets, categories);
    expect(result.errors).toEqual([]);
    expect(result.transactions).toHaveLength(1_001);
  });

  it("supports a configurable safety limit", () => {
    const rows = Array.from({ length: 101 }, () => '"28/07/2026","income","","Ví chính","1","",""');
    const result = parseTransactionCsv(["Ngày,Loại,Danh mục,Ví,Số tiền,Trạng thái,Ghi chú", ...rows].join("\n"), wallets, categories, 100);
    expect(result.errors).toEqual(["Mỗi lần chỉ được import tối đa 100 giao dịch."]);
  });
});
