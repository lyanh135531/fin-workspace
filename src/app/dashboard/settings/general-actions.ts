"use server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/auth";
import { createCategorySchema, idSchema, updateCategorySchema } from "@/domain";
import { createUserCategoryTemplate, deleteUserCategoryTemplate, reorderUserCategoryTemplates, setUserCategoryTemplateStatus, updateUserCategoryTemplate } from "@/services/user-category-template-service";
import { changeOwnPassword } from "@/services/user-profile-service";

async function actor() { const session = await getServerSession(authOptions); if (!session?.user?.id) throw new Error("Cần đăng nhập."); return session.user.id; }
function result(error: unknown) { return { ok: false, message: error instanceof Error ? error.message : "Không thể lưu thay đổi." }; }

export async function deleteTemplateCategoryAction(categoryId: string) {
  try {
    const id = idSchema.parse(categoryId);
    await deleteUserCategoryTemplate(await actor(), id);
    revalidatePath("/dashboard/settings/general");
    revalidatePath("/dashboard");
    return { ok: true, message: null };
  } catch (error) { return result(error); }
}


export async function createTemplateCategoryAction(input: unknown) {
  try {
    const category = createCategorySchema.parse(input);
    await createUserCategoryTemplate(await actor(), category);
    revalidatePath("/dashboard/settings/general");
    revalidatePath("/dashboard");
    return { ok: true, message: null };
  } catch (error) { return result(error); }
}

export async function updateTemplateCategoryAction(input: unknown) {
  try {
    const category = updateCategorySchema.parse(input);
    await updateUserCategoryTemplate(await actor(), category);
    revalidatePath("/dashboard/settings/general");
    revalidatePath("/dashboard");
    return { ok: true, message: null };
  } catch (error) { return result(error); }
}

export async function setTemplateCategoryStatusAction(input: unknown) {
  try {
    const data = z.object({ categoryId: idSchema, status: z.enum(["active", "deactive"]) }).parse(input);
    await setUserCategoryTemplateStatus(await actor(), data.categoryId, data.status);
    revalidatePath("/dashboard/settings/general");
    revalidatePath("/dashboard");
    return { ok: true, message: null };
  } catch (error) { return result(error); }
}

export async function reorderTemplateCategoriesAction(orderedIds: string[]) {
  try {
    const ids = z.array(idSchema).min(1).refine(
      (categoryIds) => new Set(categoryIds).size === categoryIds.length,
      { message: "Thứ tự danh mục mẫu không được chứa mục trùng lặp." },
    ).parse(orderedIds);
    await reorderUserCategoryTemplates(await actor(), ids);
    revalidatePath("/dashboard/settings/general");
    return { ok: true, message: null };
  } catch (error) { return result(error); }
}

export async function changePasswordAction(input: unknown) {
  try {
    const data = z.object({ currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại."), newPassword: z.string().min(8, "Mật khẩu mới phải có tối thiểu 8 ký tự.").max(128) }).parse(input);
    await changeOwnPassword(await actor(), data.currentPassword, data.newPassword);
    return { ok: true, message: null };
  } catch (error) { return result(error); }
}
