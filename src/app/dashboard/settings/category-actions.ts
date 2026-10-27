"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCategorySchema, idSchema, updateCategorySchema } from "@/domain";
import { createWorkspaceCategory, deleteWorkspaceCategory, reorderWorkspaceCategories, setWorkspaceCategoryStatus, updateWorkspaceCategory } from "@/services/category-service";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { AppError } from "@/lib/errors";
import { toActionFailure } from "@/lib/server-error";
import { requireAcceptedLegalSession } from "@/lib/legal-access";

async function actor(explicitWorkspaceId?: string) {
  const session = await requireAcceptedLegalSession();
  const workspaceId = explicitWorkspaceId
    ? idSchema.parse(explicitWorkspaceId)
    : await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) {
    throw new AppError("FORBIDDEN", "Không có nhóm tài chính đang hoạt động.");
  }
  return { userId: session.user.id, workspaceId };
}
function fail(error: unknown, event: string) {
  return toActionFailure(error, "Không thể lưu thay đổi danh mục.", { event });
}
function done() {
  revalidatePath("/settings/workspace");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath("/financial-plans");
  revalidatePath("/dashboard/financial-plans");
  return { ok: true, message: null };
}

export async function createCategoryAction(
  input: unknown,
  explicitWorkspaceId?: string,
) {
  try {
    const a = await actor(explicitWorkspaceId);
    await createWorkspaceCategory(
      a.userId,
      a.workspaceId,
      createCategorySchema.parse(input),
    );
    return done();
  } catch (error) {
    return fail(error, "category.create_failed");
  }
}
export async function updateCategoryAction(
  input: unknown,
  explicitWorkspaceId?: string,
) {
  try {
    const a = await actor(explicitWorkspaceId);
    await updateWorkspaceCategory(
      a.userId,
      a.workspaceId,
      updateCategorySchema.parse(input),
    );
    return done();
  } catch (error) {
    return fail(error, "category.update_failed");
  }
}
export async function setCategoryStatusAction(
  categoryId: string,
  status: "active" | "deactive",
  explicitWorkspaceId?: string,
) {
  try {
    const a = await actor(explicitWorkspaceId);
    await setWorkspaceCategoryStatus(
      a.userId,
      a.workspaceId,
      idSchema.parse(categoryId),
      status,
    );
    return done();
  } catch (error) {
    return fail(error, "category.status_update_failed");
  }
}
export async function deleteCategoryAction(
  categoryId: string,
  explicitWorkspaceId?: string,
) {
  try {
    const a = await actor(explicitWorkspaceId);
    await deleteWorkspaceCategory(
      a.userId,
      a.workspaceId,
      idSchema.parse(categoryId),
    );
    return done();
  } catch (error) {
    return fail(error, "category.delete_failed");
  }
}
export async function reorderCategoriesAction(
  orderedIds: string[],
  explicitWorkspaceId?: string,
) {
  try {
    const ids = z
      .array(idSchema)
      .min(1)
      .refine((categoryIds) => new Set(categoryIds).size === categoryIds.length, {
        message: "Thứ tự danh mục không được chứa mục trùng lặp.",
      })
      .parse(orderedIds);
    const a = await actor(explicitWorkspaceId);
    await reorderWorkspaceCategories(a.userId, a.workspaceId, ids);
    return done();
  } catch (error) {
    return fail(error, "category.reorder_failed");
  }
}
