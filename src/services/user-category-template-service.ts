import type { CreateCategoryInput, UpdateCategoryInput } from "@/domain";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/** Validate parent template category belongs to the same user and type. */
async function validateParent(userId: string, parentId: string | undefined, type: "income" | "expense", categoryId?: string) {
  if (!parentId) return;
  if (parentId === categoryId) throw new AppError("VALIDATION_ERROR", "Danh mục không thể là cha của chính nó.");
  const item = await prisma.category.findFirst({ where: { id: parentId, workspaceId: null, userId, status: "active", deletedAt: null } });
  if (!item) throw new AppError("FORBIDDEN", "Danh mục cha không hợp lệ.");
  if (item.type !== type) throw new AppError("VALIDATION_ERROR", "Danh mục con phải cùng loại Thu hoặc Chi.");
  let ancestorId = item.parentId;
  while (ancestorId) {
    if (ancestorId === categoryId) throw new AppError("VALIDATION_ERROR", "Không thể tạo vòng lặp danh mục.");
    const ancestor = await prisma.category.findUnique({ where: { id: ancestorId }, select: { parentId: true } });
    ancestorId = ancestor?.parentId ?? null;
  }
}

export async function createUserCategoryTemplate(userId: string, input: CreateCategoryInput) {
  await validateParent(userId, input.parentId, input.type);
  if (await prisma.category.findFirst({ where: { workspaceId: null, userId, code: input.code, deletedAt: null } })) {
    throw new AppError("CONFLICT", "Mã danh mục mẫu đã tồn tại.");
  }
  return prisma.category.create({ data: { ...input, workspaceId: null, userId } });
}

export async function updateUserCategoryTemplate(userId: string, input: UpdateCategoryInput) {
  const item = await prisma.category.findFirst({ where: { id: input.categoryId, workspaceId: null, userId, deletedAt: null } });
  if (!item) throw new AppError("NOT_FOUND", "Danh mục mẫu không tồn tại.");
  await validateParent(userId, input.parentId, input.type, item.id);
  const duplicate = await prisma.category.findFirst({ where: { workspaceId: null, userId, code: input.code, id: { not: item.id }, deletedAt: null } });
  if (duplicate) throw new AppError("CONFLICT", "Mã danh mục mẫu đã tồn tại.");
  return prisma.category.update({ where: { id: item.id }, data: { name: input.name, code: input.code, color: input.color, type: input.type, icon: input.icon, parentId: input.parentId ?? null, sortOrder: input.sortOrder } });
}

export async function setUserCategoryTemplateStatus(userId: string, categoryId: string, status: "active" | "deactive") {
  const item = await prisma.category.findFirst({ where: { id: categoryId, workspaceId: null, userId, deletedAt: null } });
  if (!item) throw new AppError("NOT_FOUND", "Danh mục mẫu không tồn tại.");
  if (status === "deactive" && await prisma.category.count({ where: { workspaceId: null, userId, parentId: item.id, status: "active", deletedAt: null } })) {
    throw new AppError("VALIDATION_ERROR", "Hãy xử lý danh mục con đang hoạt động trước.");
  }
  return prisma.category.update({ where: { id: item.id }, data: { status } });
}

export async function reorderUserCategoryTemplates(userId: string, orderedIds: string[]) {
  return prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.category.updateMany({
        where: { id, workspaceId: null, userId },
        data: { sortOrder: index },
      })
    )
  );
}

export async function deleteUserCategoryTemplate(userId: string, categoryId: string) {
  const item = await prisma.category.findFirst({ where: { id: categoryId, workspaceId: null, userId, deletedAt: null } });
  if (!item) throw new AppError("NOT_FOUND", "Danh mục mẫu không tồn tại.");
  if (await prisma.category.count({ where: { workspaceId: null, userId, parentId: item.id, deletedAt: null } })) {
    throw new AppError("VALIDATION_ERROR", "Hãy xử lý/xóa các danh mục con trước.");
  }
  return prisma.category.update({ where: { id: item.id }, data: { deletedAt: new Date() } });
}

