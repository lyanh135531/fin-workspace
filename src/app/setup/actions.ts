"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { registerAccount } from "@/services/bootstrap-service";
import { AppError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Tên đăng nhập phải có ít nhất 3 ký tự.")
    .max(80, "Tên đăng nhập tối đa 80 ký tự."),
  password: z
    .string()
    .min(8, "Mật khẩu phải có ít nhất 8 ký tự.")
    .max(128, "Mật khẩu tối đa 128 ký tự."),
});

const REGISTER_RATE_LIMIT = {
  name: "register",
  limit: 5,         // max 5 attempts
  windowMs: 60_000, // per 60 seconds
} as const;

export type RegisterActionResult = {
  ok: boolean;
  message: string | null;
  fieldErrors?: {
    username?: string;
    password?: string;
  };
};

export async function registerAccountAction(input: unknown): Promise<RegisterActionResult> {
  try {
    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? hdrs.get("x-real-ip")
      ?? "global";
    const rate = checkRateLimit(REGISTER_RATE_LIMIT, ip);
    if (!rate.allowed) {
      const seconds = Math.ceil(rate.retryAfterMs / 1000);
      return {
        ok: false,
        message: `Bạn đã thử quá nhiều lần. Đợi ${seconds} giây rồi thử lại.`,
      };
    }

    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      const formatted = parsed.error.format();
      return {
        ok: false,
        message: "Thông tin chưa đúng. Kiểm tra các mục bên dưới.",
        fieldErrors: {
          username: formatted.username?._errors[0],
          password: formatted.password?._errors[0],
        },
      };
    }

    const { username, password } = parsed.data;
    await registerAccount(username, password);
    return { ok: true, message: null };
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof Error) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Chưa tạo được tài khoản. Thử lại sau." };
  }
}
