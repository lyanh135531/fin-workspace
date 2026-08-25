"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/auth";
import { createCategorySchema, idSchema, updateCategorySchema } from "@/domain";
import { createWorkspaceCategory, deleteWorkspaceCategory, reorderWorkspaceCategories, setWorkspaceCategoryStatus, updateWorkspaceCategory } from "@/services/category-service";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { AppError } from "@/lib/errors";
import { toActionFailure } from "@/lib/server-error";

async function actor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new AppError("AUTHENTICATION_REQUIRED", "Cần đăng nhập.");
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) throw new AppError("FORBIDDEN", "Không có nhóm tài chính đang hoạt động.");
  return { userId: session.user.id, workspaceId };
}
function fail(error: unknown, event: string) { return toActionFailure(error, "Không thể lưu thay đổi danh mục.", { event }); }
function done() {
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath("/financial-plans");
  revalidatePath("/dashboard/financial-plans");
  return { ok: true, message: null };
}

export async function createCategoryAction(input: unknown) {
  try { const a = await actor(); await createWorkspaceCategory(a.userId, a.workspaceId, createCategorySchema.parse(input)); return done(); } catch (error) { return fail(error, "category.create_failed"); }
}
export async function updateCategoryAction(input: unknown) {
  try { const a = await actor(); await updateWorkspaceCategory(a.userId, a.workspaceId, updateCategorySchema.parse(input)); return done(); } catch (error) { return fail(error, "category.update_failed"); }
}
export async function setCategoryStatusAction(categoryId: string, status: "active" | "deactive") {
  try { const a = await actor(); await setWorkspaceCategoryStatus(a.userId, a.workspaceId, idSchema.parse(categoryId), status); return done(); } catch (error) { return fail(error, "category.status_update_failed"); }
}
export async function deleteCategoryAction(categoryId: string) {
  try { const a = await actor(); await deleteWorkspaceCategory(a.userId, a.workspaceId, idSchema.parse(categoryId)); return done(); } catch (error) { return fail(error, "category.delete_failed"); }
}
export async function reorderCategoriesAction(orderedIds: string[]) {
  try {
    const ids = z.array(idSchema).min(1).refine(
      (categoryIds) => new Set(categoryIds).size === categoryIds.length,
      { message: "Thứ tự danh mục không được chứa mục trùng lặp." },
    ).parse(orderedIds);
    const a = await actor();
    await reorderWorkspaceCategories(a.userId, a.workspaceId, ids);
    revalidatePath("/dashboard/settings");
    return { ok: true, message: null };
  } catch (error) { return fail(error, "category.reorder_failed"); }
}
