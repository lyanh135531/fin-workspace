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
});
