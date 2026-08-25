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
    if (!role) throw new AppError("NOT_FOUND", "Vai trò được chọn không tồn tại trong dữ liệu hệ thống.", { expose: false });
    if (await tx.user.findUnique({ where: { username: input.username } })) throw new AppError("CONFLICT", "Tên đăng nhập này đã được sử dụng.");
    const user = await tx.user.create({ data: { username: input.username, passwordHash } });
    await tx.workspaceMember.create({ data: { userId: user.id, workspaceId, roleId: role.id } });
    return user;
  });
}

export async function createMemberAccount(actorUserId: string, workspaceIds: string[], input: { username: string; password: string }) {
  if (workspaceIds.length === 0) throw new AppError("VALIDATION_ERROR", "Chọn ít nhất một nhóm tài chính.");
  await Promise.all(workspaceIds.map((workspaceId) => requireWorkspaceMember(actorUserId, workspaceId, true)));
  const passwordHash = await argon2.hash(input.password);
  return prisma.$transaction(async (tx) => {
    if (await tx.user.findUnique({ where: { username: input.username } })) throw new AppError("CONFLICT", "Tên đăng nhập này đã được sử dụng.");
    const role = await tx.role.findUnique({ where: { code: "MEMBER" } });
    if (!role) throw new AppError("NOT_FOUND", "Thiếu vai trò MEMBER trong dữ liệu hệ thống.", { expose: false });
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
  if (!member) throw new AppError("NOT_FOUND", "Không tìm thấy thành viên trong nhóm này.");
  if (member.userId === actorUserId) throw new AppError("FORBIDDEN", "Bạn không thể tự thay đổi vai trò của mình.");
  const role = await prisma.role.findUnique({ where: { code: roleCode } });
  if (!role) throw new AppError("NOT_FOUND", "Vai trò được chọn không tồn tại trong dữ liệu hệ thống.", { expose: false });
  return prisma.workspaceMember.update({ where: { id: member.id }, data: { roleId: role.id } });
}

export async function deactivateWorkspaceMember(actorUserId: string, workspaceId: string, memberId: string) {
  await requireWorkspaceMember(actorUserId, workspaceId, true);
  const member = await prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId, status: "active", deletedAt: null } });
  if (!member) throw new AppError("NOT_FOUND", "Không tìm thấy thành viên đang hoạt động trong nhóm này.");
  if (member.userId === actorUserId) throw new AppError("FORBIDDEN", "Bạn không thể tự gỡ mình khỏi nhóm.");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.workspaceMember.update({ where: { id: member.id }, data: { status: "deactive" } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId, action: "workspace.member_deactivated", entityType: "workspace_member", entityId: member.id, metadata: { userId: member.userId } } });
    return updated;
  });
}
