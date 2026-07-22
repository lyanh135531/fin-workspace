import argon2 from "argon2";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export async function registerAccount(username: string, password: string, workspaceName: string) {
  return prisma.$transaction(async (tx) => {
    const role = await tx.role.findUnique({ where: { code: "OWNER" } });
    if (!role) {
      throw new AppError("NOT_FOUND", "Vai trò OWNER không tồn tại trong hệ thống.");
    }
    const existingUser = await tx.user.findUnique({ where: { username } });
    if (existingUser) {
      throw new AppError("CONFLICT", "Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên đăng nhập khác.");
    }
    const user = await tx.user.create({ data: { username, passwordHash: await argon2.hash(password) } });
    const workspace = await tx.workspace.create({ data: { name: workspaceName } });
    await tx.workspaceMember.create({ data: { userId: user.id, workspaceId: workspace.id, roleId: role.id } });
    return { userId: user.id, workspaceId: workspace.id };
  });
}

