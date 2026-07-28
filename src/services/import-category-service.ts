import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/services/workspace-access";
import { isOwnerRole } from "@/domain/role-policy";

/**
 * Import (copy) user's personal category templates into a workspace.
 * Creates independent copies — editing templates later won't affect imported workspace categories.
 */
export async function importCategoriesToWorkspace(userId: string, workspaceId: string, categoryIds: string[]) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  if (!isOwnerRole(member.role.code)) throw new AppError("FORBIDDEN", "Chỉ Owner workspace mới được import danh mục.");

  // Fetch the full active template tree so selected children can bring their ancestors.
  const availableTemplates = await prisma.category.findMany({
    where: { workspaceId: null, userId, deletedAt: null, status: "active" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const availableById = new Map(availableTemplates.map((template) => [template.id, template]));
  const selectedIds = new Set(categoryIds.filter((id) => availableById.has(id)));
  for (const selectedId of [...selectedIds]) {
    let parentId = availableById.get(selectedId)?.parentId;
    while (parentId) {
      const parent = availableById.get(parentId);
      if (!parent) break;
      selectedIds.add(parent.id);
      parentId = parent.parentId;
    }
  }
  const templates = availableTemplates.filter((template) => selectedIds.has(template.id));
  if (templates.length === 0) throw new AppError("VALIDATION_ERROR", "Không tìm thấy danh mục mẫu hợp lệ để import.");

  const existingCategories = await prisma.category.findMany({
    where: { workspaceId, deletedAt: null },
    select: { id: true, code: true, type: true },
  });
  const existingByCode = new Map(
    existingCategories.map((category) => [category.code.toLocaleUpperCase("vi-VN"), category]),
  );

  const idMap = new Map<string, string>(); // old template ID → new workspace category ID
  let importedCount = 0;
  let skippedCount = 0;

  return prisma.$transaction(async (tx) => {
    const pending = [...templates];
    while (pending.length) {
      let progressed = false;
      for (let index = pending.length - 1; index >= 0; index -= 1) {
        const template = pending[index];
        const existing = existingByCode.get(template.code.toLocaleUpperCase("vi-VN"));
        if (existing) {
          if (existing.type !== template.type) {
            throw new AppError("CONFLICT", `Mã hạng mục “${template.code}” đã tồn tại với loại giao dịch khác.`);
          }
          idMap.set(template.id, existing.id);
          skippedCount += 1;
          pending.splice(index, 1);
          progressed = true;
          continue;
        }
        const newParentId = template.parentId ? idMap.get(template.parentId) : null;
        if (template.parentId && !newParentId) continue;
        const created = await tx.category.create({
          data: {
            workspaceId,
            userId: null,
            name: template.name,
            code: template.code,
            color: template.color,
            type: template.type,
            icon: template.icon,
            parentId: newParentId,
            sortOrder: template.sortOrder,
          },
        });
        idMap.set(template.id, created.id);
        existingByCode.set(template.code.toLocaleUpperCase("vi-VN"), created);
        importedCount += 1;
        pending.splice(index, 1);
        progressed = true;
      }
      if (!progressed) {
        throw new AppError("VALIDATION_ERROR", "Cây danh mục mẫu có quan hệ cha/con không hợp lệ.");
      }
    }

    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "category.imported_from_template",
        entityType: "CATEGORY",
        metadata: { importedCount, skippedCount, totalRequested: categoryIds.length },
      },
    });

    return { importedCount, skippedCount };
  });
}

/** Get user's template categories that can be imported (for the UI panel). */
export async function getUserTemplatesForImport(userId: string) {
  return prisma.category.findMany({
    where: { workspaceId: null, userId, status: "active", deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, code: true, color: true, type: true, icon: true, parentId: true },
  });
}
