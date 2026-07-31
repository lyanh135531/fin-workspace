import argon2 from "argon2";
import { DEFAULT_CATEGORY_TEMPLATES } from "@/domain";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export async function registerAccount(username: string, password: string) {
  const existingUser = await prisma.user.findUnique({ where: { username } });
  if (existingUser) {
    throw new AppError("CONFLICT", "Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên đăng nhập khác.");
  }

  const passwordHash = await argon2.hash(password);
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      categoryTemplates: { create: [...DEFAULT_CATEGORY_TEMPLATES] },
    },
  });

  return { userId: user.id };
}

