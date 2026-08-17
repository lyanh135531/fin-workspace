import { AppError } from "@/lib/errors";
import { isWorkspaceRoleCode } from "@/domain/role-policy";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/services/workspace-access";

export async function requestWorkspaceJoin(userId: string, inviteCode: string) {
  const cleanCode = inviteCode.trim();
  const digitsOnly = cleanCode.replace(/\D/g, "");
  const formattedCode = digitsOnly.length === 6 ? `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3)}` : cleanCode;

  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.findFirst({
      where: {
        OR: [
          { inviteCode: cleanCode },
          { inviteCode: formattedCode },
          { inviteCode: digitsOnly },
        ],
        status: "active",
        deletedAt: null,
      },
    });
    if (!workspace) throw new AppError("NOT_FOUND", "Mã mời không hợp lệ hoặc nhóm không hoạt động.");
    if (await tx.workspaceMember.findFirst({ where: { workspaceId: workspace.id, userId, status: "active", deletedAt: null } })) throw new AppError("CONFLICT", "Bạn đã là thành viên của nhóm này.");
    if (await tx.workspaceJoinRequest.findFirst({ where: { workspaceId: workspace.id, requesterId: userId, status: "pending" } })) throw new AppError("CONFLICT", "Bạn đã có yêu cầu đang chờ duyệt.");
    const request = await tx.workspaceJoinRequest.create({ data: { workspaceId: workspace.id, requesterId: userId } });
    await tx.auditLog.create({ data: { workspaceId: workspace.id, actorUserId: userId, action: "workspace.join_requested", entityType: "workspace_join_request", entityId: request.id } });
    return request;
  });
}

export async function reviewWorkspaceJoinRequest(
  adminId: string,
  workspaceId: string,
  requestId: string,
  approve: boolean,
  roleCode?: string,
) {
  await requireWorkspaceMember(adminId, workspaceId, true);

  return prisma.$transaction(async (tx) => {
    const request = await tx.workspaceJoinRequest.findFirst({
      where: { id: requestId, workspaceId, status: "pending" },
    });
    if (!request) throw new AppError("NOT_FOUND", "Yêu cầu đang chờ không tồn tại.");

    const selectedRoleCode = roleCode ?? "MEMBER";
    let roleId: string | undefined;

    if (approve) {
      if (!isWorkspaceRoleCode(selectedRoleCode)) throw new AppError("VALIDATION_ERROR", "Vai trò chỉ có thể là ADMIN hoặc MEMBER.");
      const role = await tx.role.findUnique({ where: { code: selectedRoleCode } });
      if (!role) throw new AppError("NOT_FOUND", "Vai trò được chọn không tồn tại.");
      roleId = role.id;

      const existing = await tx.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: request.requesterId } },
      });
      if (existing) {
        if (existing.status === "active" && existing.deletedAt === null) {
          throw new AppError("CONFLICT", "User đã là thành viên.");
        }
        await tx.workspaceMember.update({
          where: { id: existing.id },
          data: { status: "active", deletedAt: null, roleId },
        });
      } else {
        await tx.workspaceMember.create({
          data: { workspaceId, userId: request.requesterId, roleId },
        });
      }
    }

    const updated = await tx.workspaceJoinRequest.update({
      where: { id: request.id },
      data: {
        status: approve ? "approved" : "rejected",
        reviewerId: adminId,
        roleId,
        respondedAt: new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: adminId,
        action: approve ? "workspace.join_approved" : "workspace.join_rejected",
        entityType: "workspace_join_request",
        entityId: request.id,
        metadata: { roleCode: approve ? selectedRoleCode : null },
      },
    });
    return updated;
  });
}
