"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { idSchema } from "@/domain";
import { toActionFailure } from "@/lib/server-error";
import { requireAcceptedLegalSession } from "@/lib/legal-access";
import { createMemberAccount } from "@/services/member-management-service";

const schema = z.object({ username: z.string().trim().min(3).max(80), password: z.string().min(6).max(128), workspaceIds: z.array(idSchema).min(1).max(50) });
export async function createMemberAccountAction(input: unknown) { try { const session = await requireAcceptedLegalSession(); const data = schema.parse(input); await createMemberAccount(session.user.id, [...new Set(data.workspaceIds)], data); revalidatePath("/dashboard/users"); revalidatePath("/dashboard/settings"); return { ok: true, message: null }; } catch (error) { return toActionFailure(error, "Không thể tạo tài khoản.", { event: "account.member_create_failed" }); } }
