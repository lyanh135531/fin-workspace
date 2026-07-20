import argon2 from "argon2";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string) { const user = await prisma.user.findFirst({ where: { id: userId, status: "active", deletedAt: null } }); if (!user || !(await argon2.verify(user.passwordHash, currentPassword))) throw new AppError("FORBIDDEN", "Mật khẩu hiện tại không đúng."); await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await argon2.hash(newPassword) } }); }
