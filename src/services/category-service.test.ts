import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  mergeWorkspaceCategory,
  updateWorkspaceCategory,
} from "@/services/category-service";
import { requireWorkspaceMember } from "@/services/workspace-access";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    category: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    transaction: { count: vi.fn() },
    recurringTransaction: { count: vi.fn() },
  },
}));

vi.mock("@/services/workspace-access", () => ({
  requireWorkspaceMember: vi.fn(),
}));

describe("workspace category changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireWorkspaceMember as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "member-1",
      role: { code: "OWNER" },
    });
  });

  it("changes the type of a compatible category subtree", async () => {
    (prisma.category.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        id: "category-parent",
        type: "expense",
        mergedIntoId: null,
      })
      .mockResolvedValueOnce(null);
    (prisma.category.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "category-parent", parentId: null },
      { id: "category-child", parentId: "category-parent" },
    ]);
    (prisma.transaction.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.recurringTransaction.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const tx = {
      category: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        update: vi.fn().mockResolvedValue({
          id: "category-parent",
          name: "Thu khác",
          code: "OTHER_INCOME",
          type: "income",
        }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await updateWorkspaceCategory("user-1", "workspace-1", {
      categoryId: "category-parent",
      name: "Thu khác",
      code: "OTHER_INCOME",
      color: "#2F9E76",
      type: "income",
      icon: "tag",
      sortOrder: 0,
    });

    expect(tx.category.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["category-parent", "category-child"] },
        workspaceId: "workspace-1",
      },
      data: { type: "income" },
    });
  });

  it("merges transaction and recurring references without touching balances", async () => {
    const categories = [
      {
        id: "source-category",
        name: "Coffee",
        code: "COFFEE_OLD",
        parentId: null,
        type: "expense" as const,
        status: "active" as const,
        mergedIntoId: null,
      },
      {
        id: "target-category",
        name: "Cà phê",
        code: "COFFEE",
        parentId: null,
        type: "expense" as const,
        status: "active" as const,
        mergedIntoId: null,
      },
    ];
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      category: {
        findMany: vi.fn().mockResolvedValue(categories),
        count: vi.fn().mockResolvedValue(0),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        update: vi.fn().mockResolvedValue({
          ...categories[0],
          status: "deactive",
          mergedIntoId: "target-category",
        }),
      },
      transaction: {
        count: vi.fn().mockResolvedValue(4),
        updateMany: vi.fn().mockResolvedValue({ count: 4 }),
      },
      recurringTransaction: {
        count: vi.fn().mockResolvedValue(2),
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      categoryAlias: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    const result = await mergeWorkspaceCategory("user-1", "workspace-1", {
      sourceCategoryId: "source-category",
      targetCategoryId: "target-category",
    });

    expect(result).toMatchObject({ transactionCount: 4, recurringCount: 2 });
    expect(tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { categoryId: "source-category" },
      data: { categoryId: "target-category" },
    });
    expect(tx.recurringTransaction.updateMany).toHaveBeenCalledWith({
      where: { categoryId: "source-category" },
      data: { categoryId: "target-category" },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CATEGORY_MERGED",
        metadata: expect.objectContaining({
          sourceCategoryId: "source-category",
          targetCategoryId: "target-category",
        }),
      }),
    });
  });
});
