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

  // Fetch selected template categories belonging to this user
  const templates = await prisma.category.findMany({
    where: { id: { in: categoryIds }, workspaceId: null, userId, deletedAt: null, status: "active" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  if (templates.length === 0) throw new AppError("VALIDATION_ERROR", "Không tìm thấy danh mục mẫu hợp lệ để import.");

  // Check which codes already exist in the workspace
  const existingCodes = new Set(
    (await prisma.category.findMany({ where: { workspaceId, deletedAt: null }, select: { code: true } }))
      .map((c) => c.code)
  );

  // Separate root categories and children, preserving hierarchy
  const rootTemplates = templates.filter((t) => !t.parentId || !categoryIds.includes(t.parentId));
  const childTemplates = templates.filter((t) => t.parentId && categoryIds.includes(t.parentId));

  const idMap = new Map<string, string>(); // old template ID → new workspace category ID
  let importedCount = 0;
  let skippedCount = 0;

  return prisma.$transaction(async (tx) => {
    // Import root categories first
    for (const template of rootTemplates) {
      if (existingCodes.has(template.code)) { skippedCount++; continue; }
      const created = await tx.category.create({
        data: {
          workspaceId,
          userId: null,
          name: template.name,
          code: template.code,
          color: template.color,
          type: template.type,
          icon: template.icon,
          parentId: null,
          sortOrder: template.sortOrder,
        },
      });
      idMap.set(template.id, created.id);
      importedCount++;
    }

    // Import child categories, mapping parentId to new IDs
    for (const template of childTemplates) {
      if (existingCodes.has(template.code)) { skippedCount++; continue; }
      const newParentId = idMap.get(template.parentId!);
      if (!newParentId) { skippedCount++; continue; } // Parent was skipped (duplicate code)
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
      importedCount++;
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
