import {
  type CreateCategoryInput,
  type FinancialJarCode,
  type UpdateCategoryInput,
} from "@/domain";
import { scopeCategoryCode } from "@/domain/category/category-code";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { availableCategoryWhere } from "@/services/category-visibility";
import { requireWorkspaceMember } from "@/services/workspace-access";

type CategoryInput = Omit<CreateCategoryInput, "parentId"> & { parentId?: string };

function resolveCategoryJarCode(
  input: Pick<CategoryInput, "type" | "parentId" | "jarCode">,
  parent: { jarCode: FinancialJarCode | null } | null,
): FinancialJarCode | null {
  if (input.type === "income") {
    if (input.jarCode) {
      throw new AppError("VALIDATION_ERROR", "Danh mục thu nhập không được gắn hũ tài chính.");
    }
    return null;
  }
  if (input.parentId) {
    if (!parent?.jarCode) {
      throw new AppError("VALIDATION_ERROR", "Danh mục cha chưa có hũ tài chính hợp lệ.");
    }
    return parent.jarCode;
  }
  if (!input.jarCode) {
    throw new AppError("VALIDATION_ERROR", "Danh mục chi cấp gốc bắt buộc chọn hũ tài chính.");
  }
  return input.jarCode;
}

async function hasWorkspaceCategoryConflict(
  workspaceId: string,
  input: Pick<CategoryInput, "name" | "code" | "parentId">,
  categoryId?: string,
): Promise<boolean> {
  const category = await prisma.category.findFirst({
    where: {
      workspaceId,
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

async function validateParent(workspaceId: string, parentId: string | undefined, type: "income" | "expense", categoryId?: string) {
  if (!parentId) return null;
  if (parentId === categoryId) throw new AppError("VALIDATION_ERROR", "Danh mục không thể là danh mục cha của chính nó.");
  const parent = await prisma.category.findFirst({ where: { id: parentId, workspaceId, status: "active", deletedAt: null } });
  if (!parent) throw new AppError("FORBIDDEN", "Danh mục cha không hợp lệ trong nhóm này.");
  if (parent.type !== type) throw new AppError("VALIDATION_ERROR", "Danh mục con phải cùng loại Thu hoặc Chi với danh mục cha.");
  if (parent.parentId) throw new AppError("VALIDATION_ERROR", "Chỉ được tạo tối đa 1 cấp con. Không thể chọn danh mục đã là con của danh mục khác làm cha.");
  let ancestorId: string | null = parent.parentId;
  while (ancestorId) {
    if (ancestorId === categoryId) throw new AppError("VALIDATION_ERROR", "Không thể tạo vòng lặp danh mục cha/con.");
    const ancestor = await prisma.category.findUnique({ where: { id: ancestorId }, select: { parentId: true } });
    ancestorId = ancestor?.parentId ?? null;
  }
  return parent;
}

export async function createWorkspaceCategory(userId: string, workspaceId: string, input: CategoryInput) {
  await requireWorkspaceMember(userId, workspaceId, true);
  const parent = await validateParent(workspaceId, input.parentId, input.type);
  const scopedInput = {
    ...input,
    code: scopeCategoryCode(input.code, input.parentId),
    jarCode: resolveCategoryJarCode(input, parent),
  };
  if (await hasWorkspaceCategoryConflict(workspaceId, scopedInput)) {
    throw new AppError("CONFLICT", "Tên danh mục này đã tồn tại.");
  }
  return prisma.$transaction(async (tx) => {
    const category = await tx.category.create({ data: { workspaceId, ...scopedInput } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "CATEGORY_CREATED", entityType: "CATEGORY", entityId: category.id, metadata: { name: category.name, code: category.code, jarCode: category.jarCode } } });
    return category;
  });
}

export async function updateWorkspaceCategory(userId: string, workspaceId: string, input: UpdateCategoryInput) {
  await requireWorkspaceMember(userId, workspaceId, true);
  const category = await prisma.category.findFirst({ where: { id: input.categoryId, workspaceId, deletedAt: null } });
  if (!category) throw new AppError("NOT_FOUND", "Danh mục của nhóm không tồn tại.");
  if (category.type !== input.type) throw new AppError("VALIDATION_ERROR", "Không thể đổi loại Thu/Chi sau khi tạo danh mục.");
  const parent = await validateParent(workspaceId, input.parentId, input.type, category.id);
  if (input.parentId) {
    const childCount = await prisma.category.count({ where: { workspaceId, parentId: category.id, deletedAt: null } });
    if (childCount > 0) throw new AppError("VALIDATION_ERROR", "Danh mục đang có danh mục con nên không thể chuyển thành danh mục con.");
  }
  if (await hasWorkspaceCategoryConflict(workspaceId, input, category.id)) {
    throw new AppError("CONFLICT", "Tên danh mục này đã tồn tại.");
  }
  return prisma.$transaction(async (tx) => {
    const jarCode = resolveCategoryJarCode(input, parent);
    const updated = await tx.category.update({ where: { id: category.id }, data: { name: input.name, code: input.code, color: input.color, icon: input.icon, parentId: input.parentId ?? null, jarCode, sortOrder: input.sortOrder } });
    if (!input.parentId && category.jarCode !== jarCode) {
      await tx.category.updateMany({
        where: { workspaceId, parentId: category.id, deletedAt: null },
        data: { jarCode },
      });
    }
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "CATEGORY_UPDATED", entityType: "CATEGORY", entityId: category.id, metadata: { name: updated.name, code: updated.code, previousJarCode: category.jarCode, jarCode } } });
    return updated;
  });
}

export async function setWorkspaceCategoryStatus(userId: string, workspaceId: string, categoryId: string, status: "active" | "deactive") {
  await requireWorkspaceMember(userId, workspaceId, true);
  const category = await prisma.category.findFirst({ where: { id: categoryId, workspaceId, deletedAt: null } });
  if (!category) throw new AppError("NOT_FOUND", "Danh mục của nhóm không tồn tại.");
  if (status === "deactive") {
    const children = await prisma.category.findMany({
      where: { workspaceId, parentId: category.id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (children.some((child) => child.status === "active")) throw new AppError("VALIDATION_ERROR", "Hãy xử lý các danh mục con đang hoạt động trước khi vô hiệu hóa danh mục cha.");
    const activeRecurring = await prisma.recurringTransaction.count({ where: { workspaceId, categoryId: { in: [category.id, ...children.map((child) => child.id)] }, status: "active", deletedAt: null } });
    if (activeRecurring) throw new AppError("VALIDATION_ERROR", "Danh mục đang được giao dịch định kỳ hoạt động sử dụng nên không thể vô hiệu hóa.");
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.category.update({ where: { id: category.id }, data: { status } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: status === "active" ? "CATEGORY_ACTIVATED" : "CATEGORY_DEACTIVATED", entityType: "CATEGORY", entityId: category.id, metadata: { name: category.name } } });
    return updated;
  });
}

export async function reorderWorkspaceCategories(userId: string, workspaceId: string, orderedIds: string[]) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    const categories = await tx.category.findMany({
      where: { workspaceId, deletedAt: null },
      select: { id: true },
    });
    const categoryIds = new Set(categories.map(({ id }) => id));
    const hasExactCategorySet =
      categoryIds.size === orderedIds.length &&
      orderedIds.every((categoryId) => categoryIds.has(categoryId));

    if (!hasExactCategorySet) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Danh sách sắp xếp không khớp với các danh mục hiện có. Hãy tải lại trang và thử lại.",
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

export async function getAvailableCategories(userId: string, workspaceId: string) {
  await requireWorkspaceMember(userId, workspaceId);
  return prisma.category.findMany({ where: availableCategoryWhere(workspaceId), orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export async function deleteWorkspaceCategory(userId: string, workspaceId: string, categoryId: string) {
  await requireWorkspaceMember(userId, workspaceId, true);
  const category = await prisma.category.findFirst({ where: { id: categoryId, workspaceId, deletedAt: null } });
  if (!category) throw new AppError("NOT_FOUND", "Danh mục của nhóm không tồn tại.");

  const children = await prisma.category.findMany({ where: { workspaceId, parentId: category.id, deletedAt: null } });
  const idsToCheck = [category.id, ...children.map((c) => c.id)];

  const [txCount, recurringCount] = await Promise.all([
    prisma.transaction.count({ where: { categoryId: { in: idsToCheck }, deletedAt: null } }),
    prisma.recurringTransaction.count({ where: { workspaceId, categoryId: { in: idsToCheck }, deletedAt: null } }),
  ]);
  if (txCount > 0) {
    throw new AppError("VALIDATION_ERROR", "Danh mục này (hoặc danh mục con) đã có giao dịch phát sinh. Bạn chỉ có thể vô hiệu hóa danh mục để ẩn đi thay vì xóa.");
  }
  if (recurringCount > 0) {
    throw new AppError("VALIDATION_ERROR", "Danh mục này (hoặc danh mục con) đang được giao dịch định kỳ tham chiếu nên không thể xóa.");
  }

  return prisma.$transaction(async (tx) => {
    if (children.length > 0) {
      await tx.category.updateMany({
        where: { id: { in: children.map((c) => c.id) } },
        data: { deletedAt: new Date() },
      });
      for (const child of children) {
        await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "CATEGORY_DELETED", entityType: "CATEGORY", entityId: child.id, metadata: { name: child.name, code: child.code } } });
      }
    }

    const updated = await tx.category.update({ where: { id: category.id }, data: { deletedAt: new Date() } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "CATEGORY_DELETED", entityType: "CATEGORY", entityId: category.id, metadata: { name: category.name, code: category.code } } });
    return updated;
  });
}
