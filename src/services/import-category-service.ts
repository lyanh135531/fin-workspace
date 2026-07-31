import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/services/workspace-access";

/**
 * Import (copy) user's personal category templates into a workspace.
 * Creates independent copies — editing templates later won't affect imported workspace categories.
 *
 * Handles the case where a child is imported after its parent was already imported
 * in a previous batch: resolves the parent by template code → existing workspace category.
 */
export async function importCategoriesToWorkspace(userId: string, workspaceId: string, categoryIds: string[]) {
  await requireWorkspaceMember(userId, workspaceId, true);

  // Fetch selected template categories belonging to this user
  const templates = await prisma.category.findMany({
    where: { id: { in: categoryIds }, workspaceId: null, userId, deletedAt: null, status: "active" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  if (templates.length === 0) throw new AppError("VALIDATION_ERROR", "Không tìm thấy danh mục mẫu hợp lệ để import.");

  // Fetch ALL user templates to resolve parent template code (even if parent is not in this batch)
  const allUserTemplates = await prisma.category.findMany({
    where: { workspaceId: null, userId, deletedAt: null },
    select: { id: true, code: true },
  });
  const templateIdToCode = new Map(allUserTemplates.map((t) => [t.id, t.code]));

  // Fetch existing workspace categories (to find already-imported parents by code)
  const existingWorkspaceCategories = await prisma.category.findMany({
    where: { workspaceId, deletedAt: null },
    select: { id: true, code: true },
  });
  const existingCodeToId = new Map(existingWorkspaceCategories.map((c) => [c.code, c.id]));
  const existingCodes = new Set(existingWorkspaceCategories.map((c) => c.code));

  // Separate: roots = no parent, OR parent is in this batch (will be created first)
  // Children = parent is in this batch
  // Orphans = has parent, but parent is NOT in this batch (may exist in workspace already)
  const selectedIds = new Set(categoryIds);
  const rootTemplates = templates.filter((t) => !t.parentId);
  const childWithParentInBatch = templates.filter((t) => t.parentId && selectedIds.has(t.parentId));
  const childWithParentOutsideBatch = templates.filter((t) => t.parentId && !selectedIds.has(t.parentId));

  const idMap = new Map<string, string>(); // old template ID → new workspace category ID
  let importedCount = 0;
  let skippedCount = 0;

  return prisma.$transaction(async (tx) => {
    // 1. Import root categories first
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

    // 2. Import children whose parent is in this batch
    for (const template of childWithParentInBatch) {
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

    // 3. Import children whose parent was already imported in a previous batch
    for (const template of childWithParentOutsideBatch) {
      if (existingCodes.has(template.code)) { skippedCount++; continue; }

      // Resolve parent: find the template parent's code, then find the workspace category with that code
      const parentTemplateCode = templateIdToCode.get(template.parentId!);
      const existingParentId = parentTemplateCode ? existingCodeToId.get(parentTemplateCode) : undefined;

      if (!existingParentId) {
        // Parent doesn't exist in workspace — import as root (graceful fallback)
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
      } else {
        // Parent exists in workspace — link as child
        const created = await tx.category.create({
          data: {
            workspaceId,
            userId: null,
            name: template.name,
            code: template.code,
            color: template.color,
            type: template.type,
            icon: template.icon,
            parentId: existingParentId,
            sortOrder: template.sortOrder,
          },
        });
        idMap.set(template.id, created.id);
        importedCount++;
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
