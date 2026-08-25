import Decimal from "decimal.js";
import { describe, expect, it, vi } from "vitest";
import {
  createApprovedTransactionInTransaction,
  requireTransactionResources,
} from "@/services/transaction-service";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/services/workspace-access", () => ({ requireWorkspaceMember: vi.fn() }));
vi.mock("@/lib/date", () => ({ getBusinessDateInTimeZone: vi.fn(() => "2026-08-24") }));

function transactionClient(category: {
  id: string;
  type: "income" | "expense";
  jarCode: "ESSENTIAL" | "RESPONSIBILITY" | "DEVELOPMENT" | "ENJOYMENT" | "INVESTMENT" | "GIVING" | null;
} | null) {
  return {
    workspaceWallet: {
      findMany: vi.fn().mockResolvedValue([{ walletId: "wallet-1" }]),
    },
    category: {
      findFirst: vi.fn().mockResolvedValue(category),
    },
    transaction: {
      create: vi.fn().mockImplementation(({ data }) => ({ id: "transaction-1", ...data })),
    },
    wallet: {
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("transaction jar snapshot", () => {
  it("takes the jar from the selected expense category", async () => {
    const tx = transactionClient({ id: "category-1", type: "expense", jarCode: "DEVELOPMENT" });

    const resources = await requireTransactionResources(tx as never, "workspace-1", {
      walletId: "wallet-1",
      categoryId: "category-1",
      type: "expense",
    });

    expect(resources).toEqual({ jarCode: "DEVELOPMENT" });
  });

  it("rejects an expense without category after enforcement", async () => {
    const tx = transactionClient(null);

    await expect(requireTransactionResources(tx as never, "workspace-1", {
      walletId: "wallet-1",
      type: "expense",
    })).rejects.toThrow("Cần chọn danh mục cho giao dịch chi tiêu.");
  });

  it("rejects an expense category without a jar", async () => {
    const tx = transactionClient({ id: "category-1", type: "expense", jarCode: null });

    await expect(requireTransactionResources(tx as never, "workspace-1", {
      walletId: "wallet-1",
      categoryId: "category-1",
      type: "expense",
    })).rejects.toThrow("Danh mục chi tiêu chưa có hũ tài chính hợp lệ.");
  });

  it("rejects a category whose type differs from the transaction", async () => {
    const tx = transactionClient({ id: "category-1", type: "income", jarCode: null });

    await expect(requireTransactionResources(tx as never, "workspace-1", {
      walletId: "wallet-1",
      categoryId: "category-1",
      type: "expense",
    })).rejects.toThrow("Loại danh mục không khớp với loại giao dịch.");
  });

  it("persists the snapshot for recurring and other approved write paths", async () => {
    const tx = transactionClient({ id: "category-1", type: "expense", jarCode: "GIVING" });

    await createApprovedTransactionInTransaction(
      tx as never,
      "workspace-1",
      "member-1",
      {
        walletId: "wallet-1",
        categoryId: "category-1",
        type: "expense",
        amount: new Decimal("250000"),
        description: "Quà tặng",
        date: "2026-08-24",
      },
      { id: "recurring-1", period: "2026-08" },
    );

    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        categoryId: "category-1",
        jarCode: "GIVING",
        recurringTransactionId: "recurring-1",
        recurringPeriod: "2026-08",
      }),
    });
  });
});
