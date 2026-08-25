"use server";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/auth";
import { changeOwnPassword } from "@/services/user-profile-service";

async function actor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Cần đăng nhập.");
  return session.user.id;
}

function failure(error: unknown) {
  return {
    ok: false,
    message: error instanceof Error ? error.message : "Không thể lưu thay đổi.",
  };
}

export async function changePasswordAction(input: unknown) {
  try {
    const data = z.object({
      currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại."),
      newPassword: z.string().min(8, "Mật khẩu mới phải có tối thiểu 8 ký tự.").max(128),
    }).parse(input);
    await changeOwnPassword(await actor(), data.currentPassword, data.newPassword);
    return { ok: true, message: null };
  } catch (error) {
    return failure(error);
  }
}
