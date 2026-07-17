"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/auth";
import { createCategorySchema, idSchema, updateCategorySchema } from "@/domain";
import { createWorkspaceCategory, setWorkspaceCategoryStatus, updateWorkspaceCategory } from "@/services/category-service";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";

async function actor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Cần đăng nhập.");
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) throw new Error("Không có workspace.");
  return { userId: session.user.id, workspaceId };
}
function fail(error: unknown) { return { ok: false, message: error instanceof Error ? error.message : "Có lỗi xảy ra." }; }
function done() { revalidatePath("/dashboard/settings"); revalidatePath("/dashboard"); return { ok: true, message: null }; }

export async function createCategoryAction(input: unknown) {
  try { const a = await actor(); await createWorkspaceCategory(a.userId, a.workspaceId, createCategorySchema.parse(input)); return done(); } catch (error) { return fail(error); }
}
export async function updateCategoryAction(input: unknown) {
  try { const a = await actor(); await updateWorkspaceCategory(a.userId, a.workspaceId, updateCategorySchema.parse(input)); return done(); } catch (error) { return fail(error); }
}
export async function setCategoryStatusAction(categoryId: string, status: "active" | "deactive") {
  try { const a = await actor(); await setWorkspaceCategoryStatus(a.userId, a.workspaceId, idSchema.parse(categoryId), status); return done(); } catch (error) { return fail(error); }
}
