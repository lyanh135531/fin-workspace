"use server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/auth";
import { idSchema } from "@/domain";
import { AppError } from "@/lib/errors";
import { createMemberAccount } from "@/services/member-management-service";

const schema = z.object({ username: z.string().trim().min(3).max(80), password: z.string().min(12).max(128), workspaceIds: z.array(idSchema).min(1).max(50) });
export async function createMemberAccountAction(input: unknown) { try { const session = await getServerSession(authOptions); if (!session?.user?.id) throw new AppError("AUTHENTICATION_REQUIRED", "Cần đăng nhập."); const data = schema.parse(input); await createMemberAccount(session.user.id, [...new Set(data.workspaceIds)], data); revalidatePath("/dashboard/users"); revalidatePath("/dashboard/settings"); return { ok: true, message: null }; } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Không thể tạo tài khoản." }; } }
