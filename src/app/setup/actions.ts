"use server";

import { z } from "zod";
import { registerAccount } from "@/services/bootstrap-service";
import { AppError } from "@/lib/errors";

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Tên đăng nhập phải có ít nhất 3 ký tự.")
    .max(80, "Tên đăng nhập tối đa 80 ký tự."),
  password: z
    .string()
    .min(6, "Mật khẩu phải có ít nhất 6 ký tự.")
    .max(128, "Mật khẩu tối đa 128 ký tự."),
});

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
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      const formatted = parsed.error.format();
      return {
        ok: false,
        message: "Thông tin nhập vào chưa hợp lệ. Vui lòng kiểm tra lại các trường bên dưới.",
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
    return { ok: false, message: "Không thể tạo tài khoản. Vui lòng thử lại sau." };
  }
}



