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

const roleSchema = z.object({
  workspaceId: idSchema.optional(),
  memberId: idSchema,
  roleCode: workspaceRoleCodeSchema,
});
const workspaceSchema = z.object({
  workspaceId: idSchema.optional(),
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).optional(),
  baseCurrency: z.literal("VND"),
  timeZone: z.literal("Asia/Ho_Chi_Minh"),
  status: z.enum(["active", "deactive"]),
});

async function adminActor(explicitWorkspaceId?: string) {
  const session = await requireAcceptedLegalSession();
  const workspaceId = explicitWorkspaceId
    ? idSchema.parse(explicitWorkspaceId)
    : await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) {
    throw new AppError(
      "FORBIDDEN",
      "Chỉ quản trị viên nhóm mới có thể quản lý thành viên.",
    );
  }
  const member = await requireWorkspaceMember(session.user.id, workspaceId, true);
  return { userId: session.user.id, workspaceId: member.workspaceId };
}
function fail(error: unknown, event: string, fallback = "Không thể lưu thay đổi.") {
  return toActionFailure(error, fallback, { event });
}

export async function changeMemberRoleAction(
  input: unknown,
  explicitWorkspaceId?: string,
) {
  try {
    const data = roleSchema.parse(input);
    const actor = await adminActor(explicitWorkspaceId ?? data.workspaceId);
    await changeWorkspaceMemberRole(
      actor.userId,
      actor.workspaceId,
      data.memberId,
      data.roleCode,
    );
    revalidatePath("/settings/workspace");
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { ok: true, message: null };
  } catch (error) {
    return fail(error, "workspace.member_role_update_failed");
  }
}

export async function removeMemberAction(
  input: unknown,
  explicitWorkspaceId?: string,
) {
  try {
    const parsed =
      typeof input === "object" && input !== null && "memberId" in input
        ? z
            .object({ workspaceId: idSchema.optional(), memberId: idSchema })
            .parse(input)
        : { workspaceId: undefined, memberId: idSchema.parse(input) };
    const actor = await adminActor(explicitWorkspaceId ?? parsed.workspaceId);
    await deactivateWorkspaceMember(
      actor.userId,
      actor.workspaceId,
      parsed.memberId,
    );
    revalidatePath("/settings/workspace");
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { ok: true, message: null };
  } catch (error) {
    return fail(error, "workspace.member_remove_failed");
  }
}

export async function createWorkspaceAction(input: unknown) {
  try {
    const session = await requireAcceptedLegalSession();
    const data = workspaceSchema
      .omit({ workspaceId: true, status: true })
      .parse(input);
    const workspace = await createWorkspaceForUser(session.user.id, {
      ...data,
      description: data.description || undefined,
    });

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
    return fail(
      error,
      "workspace.create_failed",
      "Không thể tạo nhóm tài chính.",
    );
  }
}

import argon2 from "argon2";
import { prisma } from "@/lib/prisma";

export async function updateWorkspaceSettingsAction(
  input: unknown,
  explicitWorkspaceId?: string,
) {
  try {
    const { workspaceId: inputWorkspaceId, ...data } =
      workspaceSchema.parse(input);
    const actor = await adminActor(explicitWorkspaceId ?? inputWorkspaceId);
    await updateWorkspaceSettings(actor.userId, actor.workspaceId, {
      ...data,
      description: data.description || undefined,
    });
    revalidatePath("/settings/workspace");
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { ok: true, message: null };
  } catch (error) {
    return fail(error, "workspace.settings_update_failed");
  }
}

export async function deleteWorkspaceAction(
  password: string,
  explicitWorkspaceId?: string,
) {
  try {
    const actor = await adminActor(explicitWorkspaceId);
    if (!password || typeof password !== "string" || !password.trim()) {
      throw new AppError("VALIDATION_ERROR", "Vui lòng nhập mật khẩu xác nhận.");
    }
    const user = await prisma.user.findFirst({
      where: { id: actor.userId, status: "active", deletedAt: null },
    });
    if (!user?.passwordHash) {
      throw new AppError(
        "FORBIDDEN",
        "Tài khoản của bạn chưa thiết lập mật khẩu. Vui lòng tạo mật khẩu tại mục Tài khoản trước khi xóa nhóm.",
      );
    }
    if (!(await argon2.verify(user.passwordHash, password))) {
      throw new AppError("FORBIDDEN", "Mật khẩu xác nhận không chính xác.");
    }
    await deleteWorkspaceForUser(actor.userId, actor.workspaceId);
    const store = await cookies();
    if (
      typeof store.get !== "function" ||
      store.get(activeWorkspaceCookie)?.value === actor.workspaceId
    ) {
      store.delete(activeWorkspaceCookie);
    }
    revalidatePath("/dashboard", "layout");
    revalidatePath("/overview");
    revalidatePath("/settings/workspace");
    return { ok: true, message: null };
  } catch (error) {
    return fail(
      error,
      "workspace.delete_failed",
      "Không thể xóa nhóm tài chính.",
    );
  }
}

export async function regenerateInviteCodeAction(explicitWorkspaceId?: string) {
  try {
    const actor = await adminActor(explicitWorkspaceId);
    const newCode = await regenerateWorkspaceInviteCode(
      actor.userId,
      actor.workspaceId,
    );
    revalidatePath("/settings/workspace");
    revalidatePath("/dashboard/settings");
    return { ok: true, inviteCode: newCode, message: null };
  } catch (error) {
    return fail(
      error,
      "workspace.invite_code_regenerate_failed",
      "Không thể đổi mã mời.",
    );
  }
}

