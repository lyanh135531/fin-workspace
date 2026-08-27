"use server";

import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/auth";
import { AppError } from "@/lib/errors";
import { toActionFailure } from "@/lib/server-error";
import { completeGoogleProfile } from "@/services/google-auth-service";

const schema = z.object({
  username: z.string().trim().min(3, "Tên đăng nhập phải có ít nhất 3 ký tự.").max(80),
});

export async function completeGoogleProfileAction(input: unknown) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.profileCompleted) {
      throw new AppError("AUTHENTICATION_REQUIRED", "Phiên thiết lập Google không còn hợp lệ.");
    }
    const { username } = schema.parse(input);
    const grant = await completeGoogleProfile(session.user.id, username);
    return { ok: true as const, token: grant.token };
  } catch (error) {
    return toActionFailure(error, "Không thể hoàn tất tài khoản Google.", {
      event: "account.google_profile_complete_failed",
    });
  }
}
