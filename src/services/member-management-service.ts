import argon2 from "argon2";
import { isWorkspaceRoleCode } from "@/domain/role-policy";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/services/workspace-access";

export async function createWorkspaceUser(actorUserId: string, workspaceId: string, input: { username: string; password: string; roleCode: string }) {
  await requireWorkspaceMember(actorUserId, workspaceId, true);
  if (!isWorkspaceRoleCode(input.roleCode)) throw new AppError("VALIDATION_ERROR", "Vai trò chỉ có thể là ADMIN hoặc MEMBER.");
  const passwordHash = await argon2.hash(input.password);
  return prisma.$transaction(async (tx) => {
    const role = await tx.role.findUnique({ where: { code: input.roleCode } });
    if (!role) throw new AppError("NOT_FOUND", "The selected role does not exist.");
    if (await tx.user.findUnique({ where: { username: input.username } })) throw new AppError("CONFLICT", "Username is already in use.");
    const user = await tx.user.create({ data: { username: input.username, passwordHash } });
    await tx.workspaceMember.create({ data: { userId: user.id, workspaceId, roleId: role.id } });
    return user;
  });
}

export async function createMemberAccount(actorUserId: string, workspaceIds: string[], input: { username: string; password: string }) {
  if (workspaceIds.length === 0) throw new AppError("VALIDATION_ERROR", "Chọn ít nhất một workspace.");
  await Promise.all(workspaceIds.map((workspaceId) => requireWorkspaceMember(actorUserId, workspaceId, true)));
  const passwordHash = await argon2.hash(input.password);
  return prisma.$transaction(async (tx) => {
    if (await tx.user.findUnique({ where: { username: input.username } })) throw new AppError("CONFLICT", "Username is already in use.");
    const role = await tx.role.findUnique({ where: { code: "MEMBER" } });
    if (!role) throw new AppError("NOT_FOUND", "Vai trò MEMBER không tồn tại.");
    const user = await tx.user.create({ data: { username: input.username, passwordHash } });
    await tx.workspaceMember.createMany({ data: workspaceIds.map((workspaceId) => ({ userId: user.id, workspaceId, roleId: role.id })) });
    await tx.auditLog.createMany({ data: workspaceIds.map((workspaceId) => ({ workspaceId, actorUserId, action: "workspace.member_account_created", entityType: "user", entityId: user.id, metadata: { username: user.username, roleCode: "MEMBER" } })) });
    return user;
  });
}

export async function changeWorkspaceMemberRole(actorUserId: string, workspaceId: string, memberId: string, roleCode: string) {
  await requireWorkspaceMember(actorUserId, workspaceId, true);
  if (!isWorkspaceRoleCode(roleCode)) throw new AppError("VALIDATION_ERROR", "Vai trò chỉ có thể là ADMIN hoặc MEMBER.");
  const member = await prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId, status: "active", deletedAt: null } });
  if (!member) throw new AppError("NOT_FOUND", "Member was not found in this workspace.");
  if (member.userId === actorUserId) throw new AppError("FORBIDDEN", "You cannot change your own role.");
  const role = await prisma.role.findUnique({ where: { code: roleCode } });
  if (!role) throw new AppError("NOT_FOUND", "The selected role does not exist.");
  return prisma.workspaceMember.update({ where: { id: member.id }, data: { roleId: role.id } });
}

export async function deactivateWorkspaceMember(actorUserId: string, workspaceId: string, memberId: string) {
  await requireWorkspaceMember(actorUserId, workspaceId, true);
  const member = await prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId, status: "active", deletedAt: null } });
  if (!member) throw new AppError("NOT_FOUND", "Active member was not found in this workspace.");
  if (member.userId === actorUserId) throw new AppError("FORBIDDEN", "You cannot remove yourself from this workspace.");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.workspaceMember.update({ where: { id: member.id }, data: { status: "deactive" } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId, action: "workspace.member_deactivated", entityType: "workspace_member", entityId: member.id, metadata: { userId: member.userId } } });
    return updated;
  });
}
