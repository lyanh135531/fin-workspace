"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { idSchema } from "@/domain/common/schemas";
import { workspaceRoleCodeSchema } from "@/domain/role-policy";
import { AppError } from "@/lib/errors";
import { toActionFailure } from "@/lib/server-error";
import { requireAcceptedLegalSession } from "@/lib/legal-access";
import { changeWorkspaceMemberRole, deactivateWorkspaceMember } from "@/services/member-management-service";
import { createWorkspaceForUser, deleteWorkspaceForUser, regenerateWorkspaceInviteCode, updateWorkspaceSettings } from "@/services/workspace-service";
import { activeWorkspaceCookie, resolveActiveWorkspaceId } from "@/services/active-workspace";
import { requireWorkspaceMember } from "@/services/workspace-access";

const roleSchema = z.object({ memberId: idSchema, roleCode: workspaceRoleCodeSchema });
const workspaceSchema = z.object({ name: z.string().trim().min(3).max(120), description: z.string().trim().max(500).optional(), baseCurrency: z.literal("VND"), timeZone: z.literal("Asia/Ho_Chi_Minh"), status: z.enum(["active", "deactive"]) });

async function adminActor() { const session = await requireAcceptedLegalSession(); const workspaceId = await resolveActiveWorkspaceId(session.user.id); if (!workspaceId) throw new AppError("FORBIDDEN", "Chỉ quản trị viên nhóm mới có thể quản lý thành viên."); const member = await requireWorkspaceMember(session.user.id, workspaceId, true); return { userId: session.user.id, workspaceId: member.workspaceId }; }
function fail(error: unknown, event: string, fallback = "Không thể lưu thay đổi.") { return toActionFailure(error, fallback, { event }); }

export async function changeMemberRoleAction(input: unknown) { try { const actor = await adminActor(); const data = roleSchema.parse(input); await changeWorkspaceMemberRole(actor.userId, actor.workspaceId, data.memberId, data.roleCode); revalidatePath("/dashboard/settings"); revalidatePath("/dashboard"); return { ok: true, message: null }; } catch (error) { return fail(error, "workspace.member_role_update_failed"); } }
export async function removeMemberAction(input: unknown) { try { const actor = await adminActor(); const memberId = idSchema.parse(input); await deactivateWorkspaceMember(actor.userId, actor.workspaceId, memberId); revalidatePath("/dashboard/settings"); revalidatePath("/dashboard"); return { ok: true, message: null }; } catch (error) { return fail(error, "workspace.member_remove_failed"); } }

export async function createWorkspaceAction(input: unknown) {
  try {
    const session = await requireAcceptedLegalSession();
    const data = workspaceSchema.omit({ status: true }).parse(input);
    const workspace = await createWorkspaceForUser(session.user.id, { ...data, description: data.description || undefined });
    
    const store = await cookies();
    store.set(activeWorkspaceCookie, workspace.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    revalidatePath("/dashboard");
    revalidatePath("/overview");
    revalidatePath("/settings/workspace");
    return { ok: true, message: null, workspaceId: workspace.id };
  } catch (error) {
    return fail(error, "workspace.create_failed", "Không thể tạo nhóm tài chính.");
  }
}

import argon2 from "argon2";
import { prisma } from "@/lib/prisma";

export async function updateWorkspaceSettingsAction(input: unknown) { try { const actor = await adminActor(); const data = workspaceSchema.parse(input); await updateWorkspaceSettings(actor.userId, actor.workspaceId, { ...data, description: data.description || undefined }); revalidatePath("/dashboard/settings"); revalidatePath("/dashboard"); return { ok: true, message: null }; } catch (error) { return fail(error, "workspace.settings_update_failed"); } }
export async function deleteWorkspaceAction(password: string) {
  try {
    const actor = await adminActor();
    if (!password || typeof password !== "string" || !password.trim()) {
      throw new AppError("VALIDATION_ERROR", "Vui lòng nhập mật khẩu xác nhận.");
    }
    const user = await prisma.user.findFirst({ where: { id: actor.userId, status: "active", deletedAt: null } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, password))) {
      throw new AppError("FORBIDDEN", "Mật khẩu xác nhận không chính xác.");
    }
    await deleteWorkspaceForUser(actor.userId, actor.workspaceId);
    revalidatePath("/overview");
    revalidatePath("/settings/workspace");
    return { ok: true, message: null };
  } catch (error) {
    return fail(error, "workspace.delete_failed", "Không thể xóa nhóm tài chính.");
  }
}

export async function regenerateInviteCodeAction() {
  try {
    const actor = await adminActor();
    const newCode = await regenerateWorkspaceInviteCode(actor.userId, actor.workspaceId);
    revalidatePath("/settings/workspace");
    revalidatePath("/dashboard/settings");
    return { ok: true, inviteCode: newCode, message: null };
  } catch (error) {
    return fail(error, "workspace.invite_code_regenerate_failed", "Không thể đổi mã mời.");
  }
}

