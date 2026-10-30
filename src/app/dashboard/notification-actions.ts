"use server";

import { idSchema } from "@/domain";
import { workspaceCapabilities } from "@/domain/role-policy";
import { AppError } from "@/lib/errors";
import { requireAcceptedLegalSession } from "@/lib/legal-access";
import { prisma } from "@/lib/prisma";
import { toActionFailure } from "@/lib/server-error";
import { accessibleWorkspaceMemberWhere } from "@/services/active-workspace";
import { getWorkspaceNotificationFeed } from "@/services/workspace-notification-query";

export async function getWorkspaceNotificationsAction(workspaceId: unknown) {
  try {
    const session = await requireAcceptedLegalSession();
    const parsedWorkspaceId = idSchema.parse(workspaceId);
    const membership = await prisma.workspaceMember.findFirst({
      where: accessibleWorkspaceMemberWhere(session.user.id, parsedWorkspaceId),
      include: {
        workspace: { select: { timeZone: true } },
        role: { select: { code: true } },
      },
    });
    if (!membership) {
      throw new AppError("FORBIDDEN", "Bạn không có quyền xem thông báo nhóm này.");
    }

    const isAdmin = workspaceCapabilities(membership.role.code).canManageWorkspace;
    const data = await getWorkspaceNotificationFeed({
      workspaceId: parsedWorkspaceId,
      memberId: membership.id,
      userId: session.user.id,
      timeZone: membership.workspace.timeZone,
      isAdmin,
    });

    return {
      ok: true as const,
      data,
    };
  } catch (error) {
    return toActionFailure(error, "Không thể tải danh sách thông báo.", {
      event: "notifications.feed_failed",
    });
  }
}
