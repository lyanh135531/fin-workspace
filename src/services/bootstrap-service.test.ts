import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerAccount } from "@/services/bootstrap-service";
import { registerAccountAction } from "@/app/setup/actions";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("argon2", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed_password"),
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(
    new Headers({ "x-forwarded-for": "bootstrap-service-test" }),
  ),
}));

describe("bootstrap-service & registerAccountAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
  });

  describe("registerAccount", () => {
    it("throws CONFLICT AppError when username already exists", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-1", username: "admin" });

      await expect(registerAccount("admin", "password123")).rejects.toThrow(
        "Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên đăng nhập khác."
      );
    });

    it("creates user successfully without workspace during initial bootstrap", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u-100", username: "admin" });

      const res = await registerAccount("admin", "password123");
      expect(res).toEqual({ userId: "u-100" });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          username: "admin",
          passwordHash: "hashed_password",
        },
      });
    });

    it("blocks registering a reserved platform admin username once any user exists", async () => {
      vi.stubEnv("PLATFORM_ADMIN_USERNAMES", "sysadmin");
      try {
        (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

        await expect(registerAccount("SysAdmin", "password123")).rejects.toThrow(
          "Tên đăng nhập này đã được hệ thống bảo lưu. Vui lòng chọn tên đăng nhập khác.",
        );
        expect(prisma.user.create).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it("allows creating a second account when one already exists", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u-200", username: "user2" });

      const res = await registerAccount("user2", "password456");
      expect(res).toEqual({ userId: "u-200" });
    });
  });

  describe("registerAccountAction", () => {
    it("returns validation error message and fieldErrors for invalid input", async () => {
      const res = await registerAccountAction({
        username: "a",
        password: "123",
      });

      expect(res.ok).toBe(false);
      expect(res.message).toBe("Vui lòng kiểm tra lại các thông tin bên dưới.");
      expect(res.fieldErrors?.username).toBe("Tên đăng nhập phải có ít nhất 3 ký tự.");
      expect(res.fieldErrors?.password).toBe("Mật khẩu phải có ít nhất 8 ký tự.");
    });

    it("returns specific AppError message when username is taken", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "existing", username: "admin" });

      const res = await registerAccountAction({
        username: "admin",
        password: "password123",
      });

      expect(res.ok).toBe(false);
      expect(res.message).toBe("Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên đăng nhập khác.");
    });
  });
});

