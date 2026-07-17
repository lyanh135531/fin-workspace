import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/services/workspace-access";

export async function inviteUserToWorkspace(actorUserId: string, workspaceId: string, username: string, roleCode: string) {
  await requireWorkspaceMember(actorUserId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    const invitee = await tx.user.findFirst({ where: { username, status: "active", deletedAt: null } });
    if (!invitee) throw new AppError("NOT_FOUND", "No active account matches this username.");
    if (invitee.id === actorUserId) throw new AppError("FORBIDDEN", "You cannot invite yourself.");
    if (await tx.workspaceMember.findFirst({ where: { workspaceId, userId: invitee.id, status: "active", deletedAt: null } })) throw new AppError("CONFLICT", "This user is already a workspace member.");
    if (await tx.workspaceInvitation.findFirst({ where: { workspaceId, inviteeId: invitee.id, status: "pending" } })) throw new AppError("CONFLICT", "A pending invitation already exists for this user.");
    const role = await tx.role.findUnique({ where: { code: roleCode } });
    if (!role) throw new AppError("NOT_FOUND", "The selected role does not exist.");
    const invitation = await tx.workspaceInvitation.create({ data: { workspaceId, inviteeId: invitee.id, inviterId: actorUserId, roleId: role.id } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId, action: "workspace.invitation_created", entityType: "workspace_invitation", entityId: invitation.id, metadata: { inviteeUsername: username, roleCode } } });
    return invitation;
  });
}

export async function respondToWorkspaceInvitation(userId: string, invitationId: string, accept: boolean) {
  return prisma.$transaction(async (tx) => {
    const invitation = await tx.workspaceInvitation.findFirst({ where: { id: invitationId, inviteeId: userId, status: "pending", workspace: { status: "active", deletedAt: null } }, include: { role: true } });
    if (!invitation) throw new AppError("NOT_FOUND", "Pending invitation was not found.");
    if (accept) {
      if (await tx.workspaceMember.findFirst({ where: { workspaceId: invitation.workspaceId, userId, status: "active", deletedAt: null } })) throw new AppError("CONFLICT", "You are already a workspace member.");
      const existing = await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } } });
      if (existing) await tx.workspaceMember.update({ where: { id: existing.id }, data: { status: "active", deletedAt: null, roleId: invitation.roleId } });
      else await tx.workspaceMember.create({ data: { workspaceId: invitation.workspaceId, userId, roleId: invitation.roleId } });
    }
    const result = await tx.workspaceInvitation.update({ where: { id: invitation.id }, data: { status: accept ? "accepted" : "rejected", respondedAt: new Date() } });
    await tx.auditLog.create({ data: { workspaceId: invitation.workspaceId, actorUserId: userId, action: accept ? "workspace.invitation_accepted" : "workspace.invitation_rejected", entityType: "workspace_invitation", entityId: invitation.id, metadata: { roleCode: invitation.role.code } } });
    return result;
  });
}
