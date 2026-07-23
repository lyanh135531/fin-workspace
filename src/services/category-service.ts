import type { CreateCategoryInput, UpdateCategoryInput } from "@/domain";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { availableCategoryWhere } from "@/services/category-visibility";
import { requireWorkspaceMember } from "@/services/workspace-access";

type CategoryInput = Omit<CreateCategoryInput, "parentId"> & { parentId?: string };

async function validateParent(workspaceId: string, parentId: string | undefined, type: "income" | "expense", categoryId?: string) {
  if (!parentId) return;
  if (parentId === categoryId) throw new AppError("VALIDATION_ERROR", "Danh mục không thể là danh mục cha của chính nó.");
  const parent = await prisma.category.findFirst({ where: { id: parentId, workspaceId, status: "active", deletedAt: null } });
  if (!parent) throw new AppError("FORBIDDEN", "Danh mục cha không hợp lệ trong workspace này.");
  if (parent.type !== type) throw new AppError("VALIDATION_ERROR", "Danh mục con phải cùng loại Thu hoặc Chi với danh mục cha.");
  let ancestorId: string | null = parent.parentId;
  while (ancestorId) {
    if (ancestorId === categoryId) throw new AppError("VALIDATION_ERROR", "Không thể tạo vòng lặp danh mục cha/con.");
    const ancestor = await prisma.category.findUnique({ where: { id: ancestorId }, select: { parentId: true } });
    ancestorId = ancestor?.parentId ?? null;
  }
}

export async function createWorkspaceCategory(userId: string, workspaceId: string, input: CategoryInput) {
  await requireWorkspaceMember(userId, workspaceId, true);
  await validateParent(workspaceId, input.parentId, input.type);
  return prisma.$transaction(async (tx) => {
    const category = await tx.category.create({ data: { workspaceId, ...input } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "CATEGORY_CREATED", entityType: "CATEGORY", entityId: category.id, metadata: { name: category.name, code: category.code } } });
    return category;
  });
}

export async function updateWorkspaceCategory(userId: string, workspaceId: string, input: UpdateCategoryInput) {
  await requireWorkspaceMember(userId, workspaceId, true);
  const category = await prisma.category.findFirst({ where: { id: input.categoryId, workspaceId, deletedAt: null } });
  if (!category) throw new AppError("NOT_FOUND", "Category riêng của workspace không tồn tại.");
  await validateParent(workspaceId, input.parentId, input.type, category.id);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.category.update({ where: { id: category.id }, data: { name: input.name, code: input.code, color: input.color, type: input.type, icon: input.icon, parentId: input.parentId ?? null, sortOrder: input.sortOrder } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "CATEGORY_UPDATED", entityType: "CATEGORY", entityId: category.id, metadata: { name: updated.name, code: updated.code } } });
    return updated;
  });
}

export async function setWorkspaceCategoryStatus(userId: string, workspaceId: string, categoryId: string, status: "active" | "deactive") {
  await requireWorkspaceMember(userId, workspaceId, true);
  const category = await prisma.category.findFirst({ where: { id: categoryId, workspaceId, deletedAt: null } });
  if (!category) throw new AppError("NOT_FOUND", "Category riêng của workspace không tồn tại.");
  if (status === "deactive") {
    const activeChildren = await prisma.category.count({ where: { workspaceId, parentId: category.id, status: "active", deletedAt: null } });
    if (activeChildren) throw new AppError("VALIDATION_ERROR", "Hãy xử lý các danh mục con đang hoạt động trước khi vô hiệu hóa danh mục cha.");
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.category.update({ where: { id: category.id }, data: { status } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: status === "active" ? "CATEGORY_ACTIVATED" : "CATEGORY_DEACTIVATED", entityType: "CATEGORY", entityId: category.id, metadata: { name: category.name } } });
    return updated;
  });
}

export async function reorderWorkspaceCategories(userId: string, workspaceId: string, orderedIds: string[]) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.category.updateMany({
        where: { id, workspaceId },
        data: { sortOrder: index },
      })
    )
  );
}

export async function getAvailableCategories(userId: string, workspaceId: string) {
  await requireWorkspaceMember(userId, workspaceId);
  return prisma.category.findMany({ where: availableCategoryWhere(workspaceId), orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}
