import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createWorkspaceCategory,
  deleteWorkspaceCategory,
  setWorkspaceCategoryStatus,
  updateWorkspaceCategory,
} from "@/services/category-service";
import { requireWorkspaceMember } from "@/services/workspace-access";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    category: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    transaction: {
      count: vi.fn(),
    },
    recurringTransaction: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@/services/workspace-access", () => ({
  requireWorkspaceMember: vi.fn(),
}));

const baseInput = {
  name: "Danh mục custom",
  code: "CUSTOM_EXPENSE",
  color: "#123456",
  type: "expense" as const,
  icon: "tag",
  sortOrder: 10,
};

describe("workspace category jar enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireWorkspaceMember as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "member-1" });
  });

  it("rejects a root expense without an explicitly selected jar", async () => {
    await expect(createWorkspaceCategory("user-1", "workspace-1", baseInput))
      .rejects.toThrow("Danh mục chi cấp gốc bắt buộc chọn hũ tài chính.");

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("forces a child to inherit the parent jar instead of trusting client input", async () => {
    const parent = {
      id: "00000000-0000-4000-8000-000000000001",
      type: "expense",
      parentId: null,
      jarCode: "DEVELOPMENT",
    };
    const tx = {
      category: {
        create: vi.fn().mockImplementation(({ data }) => ({ id: "category-2", ...data })),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    (prisma.category.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce(null);
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await createWorkspaceCategory("user-1", "workspace-1", {
      ...baseInput,
      parentId: parent.id,
      jarCode: "GIVING",
    });

    expect(tx.category.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ jarCode: "DEVELOPMENT", parentId: parent.id }),
    });
  });

  it("never allows changing category type after creation", async () => {
    (prisma.category.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "category-1",
      workspaceId: "workspace-1",
      type: "income",
    });

    await expect(updateWorkspaceCategory("user-1", "workspace-1", {
      ...baseInput,
      jarCode: "ESSENTIAL",
      categoryId: "00000000-0000-4000-8000-000000000002",
    })).rejects.toThrow("Không thể đổi loại Thu/Chi sau khi tạo danh mục.");

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("blocks deactivation while an active recurring transaction references the category", async () => {
    (prisma.category.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "category-1",
      workspaceId: "workspace-1",
      type: "expense",
    });
    (prisma.category.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.recurringTransaction.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    await expect(setWorkspaceCategoryStatus(
      "user-1",
      "workspace-1",
      "category-1",
      "deactive",
    )).rejects.toThrow("Danh mục đang được giao dịch định kỳ hoạt động sử dụng");

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("blocks deletion when any recurring transaction references the category", async () => {
    (prisma.category.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "category-1",
      workspaceId: "workspace-1",
      type: "expense",
    });
    (prisma.category.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.transaction.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.recurringTransaction.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    await expect(deleteWorkspaceCategory(
      "user-1",
      "workspace-1",
      "category-1",
    )).rejects.toThrow("đang được giao dịch định kỳ tham chiếu");

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("disambiguates category code when Vietnamese diacritics differ on slugified code", async () => {
    const tx = {
      category: {
        create: vi.fn().mockImplementation(({ data }) => ({ id: "category-ca-2", ...data })),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    (prisma.category.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        id: "category-ca-1",
        name: "Cá",
        type: "expense",
        parentId: null,
        deletedAt: null,
      })
      .mockResolvedValueOnce(null);
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    const created = await createWorkspaceCategory("user-1", "workspace-1", {
      ...baseInput,
      name: "Cà",
      code: "CA",
      jarCode: "ESSENTIAL",
    });

    expect(created.code).toBe("CA_EXP");
  });

  it("retains an unchanged deactivated parent when editing a deactivated child category", async () => {
    const parentId = "00000000-0000-4000-8000-000000000010";
    const childId = "00000000-0000-4000-8000-000000000011";
    const tx = {
      category: {
        update: vi.fn().mockImplementation(({ data }) => ({ id: childId, ...data })),
        updateMany: vi.fn(),
      },
      transaction: { updateMany: vi.fn() },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    (prisma.category.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        id: childId,
        workspaceId: "workspace-1",
        type: "expense",
        status: "deactive",
        parentId,
        jarCode: "ESSENTIAL",
        deletedAt: null,
      })
      .mockResolvedValueOnce({
        id: parentId,
        workspaceId: "workspace-1",
        type: "expense",
        status: "deactive",
        parentId: null,
        jarCode: "ESSENTIAL",
        deletedAt: null,
      })
      .mockResolvedValueOnce(null);
    (prisma.category.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await updateWorkspaceCategory("user-1", "workspace-1", {
      ...baseInput,
      categoryId: childId,
      parentId,
      jarCode: "ESSENTIAL",
    });

    expect(prisma.category.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: parentId, workspaceId: "workspace-1", deletedAt: null },
      }),
    );
    expect(tx.category.update).toHaveBeenCalled();
  });

  it("generates distinct deleted codes for parent and long-coded children on delete", async () => {
    const parent = {
      id: "11111111-1111-4111-8111-111111111111",
      code: "VERY_LONG_SHARED_CATEGORY_CODE_PREFIX_ROOT",
      name: "Root",
    };
    const childA = {
      id: "22222222-2222-4222-8222-222222222222",
      code: "VERY_LONG_SHARED_CATEGORY_CODE_PREFIX_CHILD_A",
      name: "Child A",
    };
    const childB = {
      id: "33333333-3333-4333-8333-333333333333",
      code: "VERY_LONG_SHARED_CATEGORY_CODE_PREFIX_CHILD_B",
      name: "Child B",
    };
    const updatedCodes: string[] = [];
    const tx = {
      category: {
        update: vi.fn().mockImplementation(({ data }) => {
          updatedCodes.push(data.code);
          return { ...parent, ...data };
        }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    (prisma.category.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(parent);
    (prisma.category.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([childA, childB]);
    (prisma.transaction.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.recurringTransaction.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await deleteWorkspaceCategory("user-1", "workspace-1", parent.id);

    expect(new Set(updatedCodes).size).toBe(3);
  });
});
