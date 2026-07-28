"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/auth";
import { createCategorySchema, idSchema, mergeCategorySchema, updateCategorySchema } from "@/domain";
import { createWorkspaceCategory, mergeWorkspaceCategory, reorderWorkspaceCategories, setWorkspaceCategoryStatus, updateWorkspaceCategory } from "@/services/category-service";
import { importCategoriesToWorkspace } from "@/services/import-category-service";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";

async function actor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Cần đăng nhập.");
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) throw new Error("Không có workspace.");
  return { userId: session.user.id, workspaceId };
}
function fail(error: unknown) { return { ok: false as const, message: error instanceof Error ? error.message : "Có lỗi xảy ra.", importedCount: 0, skippedCount: 0 }; }
function done() { revalidatePath("/dashboard/settings"); revalidatePath("/dashboard"); return { ok: true as const, message: null, importedCount: 0, skippedCount: 0 }; }

export async function createCategoryAction(input: unknown) {
  try { const a = await actor(); await createWorkspaceCategory(a.userId, a.workspaceId, createCategorySchema.parse(input)); return done(); } catch (error) { return fail(error); }
}
export async function updateCategoryAction(input: unknown) {
  try { const a = await actor(); await updateWorkspaceCategory(a.userId, a.workspaceId, updateCategorySchema.parse(input)); return done(); } catch (error) { return fail(error); }
}
export async function mergeCategoryAction(input: unknown) {
  try {
    const a = await actor();
    const result = await mergeWorkspaceCategory(a.userId, a.workspaceId, mergeCategorySchema.parse(input));
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    revalidatePath("/overview");
    return {
      ok: true as const,
      message: null,
      importedCount: 0,
      skippedCount: 0,
      transactionCount: result.transactionCount,
      recurringCount: result.recurringCount,
      childCount: result.childCount,
    };
  } catch (error) {
    return fail(error);
  }
}
export async function setCategoryStatusAction(categoryId: string, status: "active" | "deactive") {
  try { const a = await actor(); await setWorkspaceCategoryStatus(a.userId, a.workspaceId, idSchema.parse(categoryId), status); return done(); } catch (error) { return fail(error); }
}

export async function reorderCategoriesAction(orderedIds: string[]) {
  try {
    const ids = z.array(idSchema).parse(orderedIds);
    const a = await actor();
    await reorderWorkspaceCategories(a.userId, a.workspaceId, ids);
    revalidatePath("/dashboard/settings");
    return { ok: true, message: null, importedCount: 0, skippedCount: 0 };
  } catch (error) { return fail(error); }
}

export async function importCategoriesAction(categoryIds: string[]) {
  try {
    const parsed = z.array(idSchema).min(1).parse(categoryIds);
    const a = await actor();
    const result = await importCategoriesToWorkspace(a.userId, a.workspaceId, parsed);
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { ok: true, message: null, importedCount: result.importedCount, skippedCount: result.skippedCount };
  } catch (error) { return fail(error); }
}
