"use server";

import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { z } from "zod";

import { authOptions } from "@/auth";
import { AppError } from "@/lib/errors";
import { toActionFailure } from "@/lib/server-error";
import {
  GOOGLE_INTENT_COOKIE,
  setPasswordAfterGoogleVerification,
} from "@/services/google-auth-service";

export async function setGoogleVerifiedPasswordAction(input: unknown) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new AppError("AUTHENTICATION_REQUIRED", "Cần đăng nhập.");
    const { password } = z.object({
      password: z.string().min(8, "Mật khẩu phải có tối thiểu 8 ký tự.").max(128),
    }).parse(input);
    const cookieStore = await cookies();
    const token = cookieStore.get(GOOGLE_INTENT_COOKIE)?.value;
    if (!token) throw new AppError("FORBIDDEN", "Phiên xác minh Google đã hết hạn.");
    await setPasswordAfterGoogleVerification(session.user.id, token, password);
    cookieStore.delete(GOOGLE_INTENT_COOKIE);
    return { ok: true as const };
  } catch (error) {
    return toActionFailure(error, "Không thể tạo mật khẩu.", {
      event: "account.google_password_set_failed",
    });
  }
}
