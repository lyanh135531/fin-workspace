"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { idSchema } from "@/domain";
import { toActionFailure } from "@/lib/server-error";
import { requireAcceptedLegalSession } from "@/lib/legal-access";
import { createMemberAccount } from "@/services/member-management-service";

const schema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Tên đăng nhập phải có từ 3 đến 80 ký tự.")
    .max(80, "Tên đăng nhập phải có từ 3 đến 80 ký tự."),
  password: z
    .string()
    .min(8, "Mật khẩu phải có ít nhất 8 ký tự.")
    .max(128, "Mật khẩu không được vượt quá 128 ký tự."),
  workspaceIds: z
    .array(idSchema)
    .min(1, "Vui lòng chọn ít nhất một nhóm tài chính.")
    .max(50, "Chỉ được chọn tối đa 50 nhóm tài chính."),
});
export async function createMemberAccountAction(input: unknown) { try { const session = await requireAcceptedLegalSession(); const data = schema.parse(input); await createMemberAccount(session.user.id, [...new Set(data.workspaceIds)], data); revalidatePath("/dashboard/users"); revalidatePath("/dashboard/settings"); revalidatePath("/settings/workspace"); revalidatePath("/members"); return { ok: true, message: null }; } catch (error) { return toActionFailure(error, "Không thể tạo tài khoản.", { event: "account.member_create_failed" }); } }
