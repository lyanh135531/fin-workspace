"use server";

import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { z } from "zod";
import { authOptions } from "@/auth";
import { AppError } from "@/lib/errors";
import { toActionFailure } from "@/lib/server-error";
import { changeOwnPassword } from "@/services/user-profile-service";
import {
  beginGoogleLink,
  beginGooglePasswordSetup,
  getAccountSecurityState,
  GOOGLE_INTENT_COOKIE,
  unlinkGoogleAccount,
} from "@/services/google-auth-service";

async function actor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new AppError("AUTHENTICATION_REQUIRED", "Cần đăng nhập.");
  return session.user.id;
}

function failure(error: unknown) {
  return toActionFailure(error, "Không thể đổi mật khẩu.", {
    event: "account.password_change_failed",
  });
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

function oauthFailure(error: unknown, fallback: string, event: string) {
  return toActionFailure(error, fallback, { event });
}

async function setGoogleIntentCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_INTENT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function getAccountSecurityStateAction() {
  try {
    return { ok: true as const, data: await getAccountSecurityState(await actor()) };
  } catch (error) {
    return oauthFailure(error, "Không thể tải trạng thái bảo mật.", "account.security_state_failed");
  }
}

export async function startGoogleLinkAction(input: unknown) {
  try {
    const data = z.object({
      password: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại."),
      mode: z.enum(["link", "replace"]),
    }).parse(input);
    const intent = await beginGoogleLink(await actor(), data.password, data.mode);
    await setGoogleIntentCookie(intent.token, intent.expiresAt);
    return { ok: true as const };
  } catch (error) {
    return oauthFailure(error, "Không thể bắt đầu liên kết Google.", "account.google_link_start_failed");
  }
}

export async function startGooglePasswordSetupAction() {
  try {
    const intent = await beginGooglePasswordSetup(await actor());
    await setGoogleIntentCookie(intent.token, intent.expiresAt);
    return { ok: true as const };
  } catch (error) {
    return oauthFailure(error, "Không thể xác minh Google.", "account.google_password_start_failed");
  }
}

export async function unlinkGoogleAction(input: unknown) {
  try {
    const { password } = z.object({ password: z.string().min(1) }).parse(input);
    await unlinkGoogleAccount(await actor(), password);
    const cookieStore = await cookies();
    cookieStore.delete(GOOGLE_INTENT_COOKIE);
    return { ok: true as const };
  } catch (error) {
    return oauthFailure(error, "Không thể gỡ liên kết Google.", "account.google_unlink_failed");
  }
}
