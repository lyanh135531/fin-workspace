import type { CreateCategoryInput, MergeCategoryInput, UpdateCategoryInput } from "@/domain";
import { buildCategoryPaths, normalizeCategoryKey } from "@/lib/category-path";
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

async function ensureUniqueCode(workspaceId: string, code: string, categoryId?: string) {
  const duplicate = await prisma.category.findFirst({
    where: {
      workspaceId,
      code: { equals: code, mode: "insensitive" },
      deletedAt: null,
      ...(categoryId ? { id: { not: categoryId } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) throw new AppError("CONFLICT", "Mã hạng mục đã tồn tại trong workspace.");
}

function collectSubtreeIds(
  categories: Array<{ id: string; parentId: string | null }>,
  rootId: string,
) {
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) {
      if (category.parentId && ids.has(category.parentId) && !ids.has(category.id)) {
        ids.add(category.id);
        changed = true;
      }
    }
  }
  return [...ids];
}

async function validateTypeChange(
  workspaceId: string,
  categoryId: string,
  nextType: "income" | "expense",
) {
  const categories = await prisma.category.findMany({
    where: { workspaceId, deletedAt: null },
    select: { id: true, parentId: true },
  });
  const subtreeIds = collectSubtreeIds(categories, categoryId);
  const [transactionConflict, recurringConflict] = await Promise.all([
    prisma.transaction.count({
      where: {
        categoryId: { in: subtreeIds },
        type: { not: nextType },
      },
    }),
    prisma.recurringTransaction.count({
      where: {
        categoryId: { in: subtreeIds },
        type: { not: nextType },
      },
    }),
  ]);
  if (transactionConflict || recurringConflict) {
    throw new AppError(
      "CONFLICT",
      `Không thể đổi loại: cây hạng mục đang có ${transactionConflict} giao dịch và ${recurringConflict} lịch định kỳ không tương thích.`,
    );
  }
  return subtreeIds;
}

export async function createWorkspaceCategory(userId: string, workspaceId: string, input: CategoryInput) {
  await requireWorkspaceMember(userId, workspaceId, true);
  await ensureUniqueCode(workspaceId, input.code);
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
  if (category.mergedIntoId) throw new AppError("CONFLICT", "Hạng mục đã được hợp nhất và không thể chỉnh sửa.");
  await ensureUniqueCode(workspaceId, input.code, category.id);
  await validateParent(workspaceId, input.parentId, input.type, category.id);
  const subtreeIds = category.type === input.type
    ? [category.id]
    : await validateTypeChange(workspaceId, category.id, input.type);
  return prisma.$transaction(async (tx) => {
    if (category.type !== input.type) {
      await tx.category.updateMany({
        where: { id: { in: subtreeIds }, workspaceId },
        data: { type: input.type },
      });
    }
    const updated = await tx.category.update({ where: { id: category.id }, data: { name: input.name, code: input.code, color: input.color, type: input.type, icon: input.icon, parentId: input.parentId ?? null, sortOrder: input.sortOrder } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "CATEGORY_UPDATED", entityType: "CATEGORY", entityId: category.id, metadata: { name: updated.name, code: updated.code, previousType: category.type, type: updated.type, affectedSubtreeCount: subtreeIds.length } } });
    return updated;
  });
}

export async function mergeWorkspaceCategory(
  userId: string,
  workspaceId: string,
  input: MergeCategoryInput,
) {
  await requireWorkspaceMember(userId, workspaceId, true);
  if (input.sourceCategoryId === input.targetCategoryId) {
    throw new AppError("VALIDATION_ERROR", "Hạng mục nguồn và đích phải khác nhau.");
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id" FROM "CATEGORY"
      WHERE "id" IN (${input.sourceCategoryId}::uuid, ${input.targetCategoryId}::uuid)
      FOR UPDATE
    `;
    const categories = await tx.category.findMany({
      where: { workspaceId, deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        parentId: true,
        type: true,
        status: true,
        mergedIntoId: true,
      },
    });
    const source = categories.find((category) => category.id === input.sourceCategoryId);
    const target = categories.find((category) => category.id === input.targetCategoryId);
    if (!source || !target) throw new AppError("NOT_FOUND", "Hạng mục nguồn hoặc đích không tồn tại trong workspace.");
    if (source.mergedIntoId) throw new AppError("CONFLICT", "Hạng mục nguồn đã được hợp nhất trước đó.");
    if (target.status !== "active" || target.mergedIntoId) {
      throw new AppError("VALIDATION_ERROR", "Hạng mục đích phải đang hoạt động.");
    }
    if (source.type !== target.type) {
      throw new AppError("VALIDATION_ERROR", "Chỉ có thể hợp nhất hai hạng mục cùng loại Thu hoặc Chi.");
    }

    const sourceSubtreeIds = collectSubtreeIds(categories, source.id);
    if (sourceSubtreeIds.includes(target.id)) {
      throw new AppError("VALIDATION_ERROR", "Không thể hợp nhất hạng mục vào một hạng mục con của chính nó.");
    }

    const paths = buildCategoryPaths(categories);
    const sourcePath = paths.get(source.id);
    const [transactionCount, recurringCount, childCount] = await Promise.all([
      tx.transaction.count({ where: { categoryId: source.id } }),
      tx.recurringTransaction.count({ where: { categoryId: source.id } }),
      tx.category.count({ where: { workspaceId, parentId: source.id, deletedAt: null } }),
    ]);

    await tx.transaction.updateMany({
      where: { categoryId: source.id },
      data: { categoryId: target.id },
    });
    await tx.recurringTransaction.updateMany({
      where: { categoryId: source.id },
      data: { categoryId: target.id },
    });
    await tx.category.updateMany({
      where: { workspaceId, parentId: source.id, deletedAt: null },
      data: { parentId: target.id },
    });
    await tx.categoryAlias.updateMany({
      where: { workspaceId, categoryId: source.id },
      data: { categoryId: target.id },
    });

    const aliases = [
      { kind: "name", value: source.name },
      { kind: "code", value: source.code },
      ...(sourcePath?.names.length ? [{ kind: "path", value: sourcePath.names.join(" > ") }] : []),
      ...(sourcePath?.codes.length ? [{ kind: "code_path", value: sourcePath.codes.join(" > ") }] : []),
    ];
    for (const alias of aliases) {
      const normalizedValue = normalizeCategoryKey(alias.value);
      const existing = await tx.categoryAlias.findUnique({
        where: {
          workspaceId_kind_normalizedValue: {
            workspaceId,
            kind: alias.kind,
            normalizedValue,
          },
        },
      });
      if (existing && existing.categoryId !== source.id && existing.categoryId !== target.id) {
        throw new AppError("CONFLICT", `Alias “${alias.value}” đang thuộc về một hạng mục khác.`);
      }
      if (!existing) {
        await tx.categoryAlias.create({
          data: {
            workspaceId,
            categoryId: target.id,
            kind: alias.kind,
            value: alias.value,
            normalizedValue,
          },
        });
      }
    }

    const merged = await tx.category.update({
      where: { id: source.id },
      data: {
        status: "deactive",
        mergedIntoId: target.id,
        mergedAt: new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "CATEGORY_MERGED",
        entityType: "CATEGORY",
        entityId: source.id,
        metadata: {
          sourceCategoryId: source.id,
          sourceName: source.name,
          targetCategoryId: target.id,
          targetName: target.name,
          transactionCount,
          recurringCount,
          childCount,
        },
      },
    });
    return { merged, target, transactionCount, recurringCount, childCount };
  });
}

export async function setWorkspaceCategoryStatus(userId: string, workspaceId: string, categoryId: string, status: "active" | "deactive") {
  await requireWorkspaceMember(userId, workspaceId, true);
  const category = await prisma.category.findFirst({ where: { id: categoryId, workspaceId, deletedAt: null } });
  if (!category) throw new AppError("NOT_FOUND", "Category riêng của workspace không tồn tại.");
  if (category.mergedIntoId) throw new AppError("CONFLICT", "Hạng mục đã hợp nhất không thể thay đổi trạng thái.");
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
