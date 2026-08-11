import type { CreateCategoryInput, UpdateCategoryInput } from "@/domain";
import { scopeCategoryCode } from "@/domain/category/category-code";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

async function hasTemplateCategoryConflict(
  userId: string,
  input: Pick<CreateCategoryInput, "name" | "code" | "parentId">,
  categoryId?: string,
): Promise<boolean> {
  const category = await prisma.category.findFirst({
    where: {
      workspaceId: null,
      userId,
      deletedAt: null,
      ...(categoryId ? { id: { not: categoryId } } : {}),
      OR: [
        { code: input.code },
        {
          name: { equals: input.name, mode: "insensitive" },
          parentId: input.parentId ?? null,
        },
      ],
    },
    select: { id: true },
  });
  return category !== null;
}

/** Validate parent template category belongs to the same user and type. */
async function validateParent(userId: string, parentId: string | undefined, type: "income" | "expense", categoryId?: string) {
  if (!parentId) return;
  if (parentId === categoryId) throw new AppError("VALIDATION_ERROR", "Danh mục không thể là cha của chính nó.");
  const item = await prisma.category.findFirst({ where: { id: parentId, workspaceId: null, userId, status: "active", deletedAt: null } });
  if (!item) throw new AppError("FORBIDDEN", "Danh mục cha không hợp lệ.");
  if (item.type !== type) throw new AppError("VALIDATION_ERROR", "Danh mục con phải cùng loại Thu hoặc Chi.");
  if (item.parentId) throw new AppError("VALIDATION_ERROR", "Chỉ được tạo tối đa 1 cấp con. Không thể chọn danh mục đã là con của danh mục khác làm cha.");
  let ancestorId = item.parentId;
  while (ancestorId) {
    if (ancestorId === categoryId) throw new AppError("VALIDATION_ERROR", "Không thể tạo vòng lặp danh mục.");
    const ancestor = await prisma.category.findUnique({ where: { id: ancestorId }, select: { parentId: true } });
    ancestorId = ancestor?.parentId ?? null;
  }
}

export async function createUserCategoryTemplate(userId: string, input: CreateCategoryInput) {
  await validateParent(userId, input.parentId, input.type);
  const scopedInput = {
    ...input,
    code: scopeCategoryCode(input.code, input.parentId),
  };
  if (await hasTemplateCategoryConflict(userId, scopedInput)) {
    throw new AppError("CONFLICT", "Tên danh mục này đã tồn tại.");
  }
  return prisma.category.create({ data: { ...scopedInput, workspaceId: null, userId } });
}

export async function updateUserCategoryTemplate(userId: string, input: UpdateCategoryInput) {
  const item = await prisma.category.findFirst({ where: { id: input.categoryId, workspaceId: null, userId, deletedAt: null } });
  if (!item) throw new AppError("NOT_FOUND", "Danh mục mẫu không tồn tại.");
  await validateParent(userId, input.parentId, input.type, item.id);
  if (await hasTemplateCategoryConflict(userId, input, item.id)) {
    throw new AppError("CONFLICT", "Tên danh mục này đã tồn tại.");
  }
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
  return prisma.$transaction(async (tx) => {
    const categories = await tx.category.findMany({
      where: { workspaceId: null, userId, deletedAt: null },
      select: { id: true },
    });
    const categoryIds = new Set(categories.map(({ id }) => id));
    const hasExactCategorySet =
      categoryIds.size === orderedIds.length &&
      orderedIds.every((categoryId) => categoryIds.has(categoryId));

    if (!hasExactCategorySet) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Danh sách sắp xếp không khớp với các danh mục mẫu hiện có. Hãy tải lại trang và thử lại.",
      );
    }

    await Promise.all(
      orderedIds.map((id, sortOrder) =>
        tx.category.update({
          where: { id },
          data: { sortOrder },
        }),
      ),
    );
  });
}

export async function deleteUserCategoryTemplate(userId: string, categoryId: string) {
  const item = await prisma.category.findFirst({ where: { id: categoryId, workspaceId: null, userId, deletedAt: null } });
  if (!item) throw new AppError("NOT_FOUND", "Danh mục mẫu không tồn tại.");
  
  const children = await prisma.category.findMany({ where: { workspaceId: null, userId, parentId: item.id, deletedAt: null } });
  
  return prisma.$transaction(async (tx) => {
    if (children.length > 0) {
      await tx.category.updateMany({
        where: { id: { in: children.map((c) => c.id) } },
        data: { deletedAt: new Date() }
      });
    }
    return tx.category.update({ where: { id: item.id }, data: { deletedAt: new Date() } });
  });
}

