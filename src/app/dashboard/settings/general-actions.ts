"use server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/auth";
import { createCategorySchema, idSchema, updateCategorySchema } from "@/domain";
import { assertGlobalCategoryConfirmation, createGlobalCategory, setGlobalCategoryStatus, updateGlobalCategory } from "@/services/global-category-service";
import { changeOwnPassword } from "@/services/user-profile-service";
async function actor() { const session = await getServerSession(authOptions); if (!session?.user?.id) throw new Error("Cần đăng nhập."); return session.user.id; }
function result(error: unknown) { return { ok: false, message: error instanceof Error ? error.message : "Không thể lưu thay đổi." }; }
export async function verifyGlobalCategoryPasswordAction(password: unknown) { try { await actor(); assertGlobalCategoryConfirmation(z.string().min(1).parse(password)); return { ok: true, message: null }; } catch (error) { return result(error); } }
export async function createGlobalCategoryAction(input: unknown) { try { const data = z.object({ password: z.string().min(1), category: createCategorySchema }).parse(input); await createGlobalCategory(await actor(), data.password, data.category); revalidatePath("/dashboard/settings/general"); revalidatePath("/dashboard"); return { ok: true, message: null }; } catch (error) { return result(error); } }
export async function updateGlobalCategoryAction(input: unknown) { try { const data = z.object({ password: z.string().min(1), category: updateCategorySchema }).parse(input); await updateGlobalCategory(await actor(), data.password, data.category); revalidatePath("/dashboard/settings/general"); revalidatePath("/dashboard"); return { ok: true, message: null }; } catch (error) { return result(error); } }
export async function setGlobalCategoryStatusAction(input: unknown) { try { const data = z.object({ password: z.string().min(1), categoryId: idSchema, status: z.enum(["active", "deactive"]) }).parse(input); await setGlobalCategoryStatus(await actor(), data.password, data.categoryId, data.status); revalidatePath("/dashboard/settings/general"); revalidatePath("/dashboard"); return { ok: true, message: null }; } catch (error) { return result(error); } }
export async function changePasswordAction(input: unknown) { try { const data = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12).max(128) }).parse(input); await changeOwnPassword(await actor(), data.currentPassword, data.newPassword); return { ok: true, message: null }; } catch (error) { return result(error); } }
