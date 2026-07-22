import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerAccount } from "@/services/bootstrap-service";
import { registerAccountAction } from "@/app/setup/actions";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock("argon2", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed_password"),
  },
}));

describe("bootstrap-service & registerAccountAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerAccount", () => {
    it("throws NOT_FOUND AppError when OWNER role is missing", async () => {
      const mockTx = {
        role: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };

      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
        return cb(mockTx);
      });

      await expect(registerAccount("admin", "password123", "Workspace A")).rejects.toThrow(
        "Vai trò OWNER không tồn tại trong hệ thống."
      );
    });

    it("throws CONFLICT AppError when username already exists", async () => {
      const mockTx = {
        role: {
          findUnique: vi.fn().mockResolvedValue({ id: "role-owner", code: "OWNER" }),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue({ id: "user-1", username: "admin" }),
        },
      };

      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
        return cb(mockTx);
      });

      await expect(registerAccount("admin", "password123", "Workspace A")).rejects.toThrow(
        "Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên đăng nhập khác."
      );
    });

    it("creates user, workspace, and membership successfully", async () => {
      const mockTx = {
        role: {
          findUnique: vi.fn().mockResolvedValue({ id: "role-owner", code: "OWNER" }),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "u-100", username: "admin" }),
        },
        workspace: {
          create: vi.fn().mockResolvedValue({ id: "w-100", name: "Workspace A" }),
        },
        workspaceMember: {
          create: vi.fn().mockResolvedValue({ id: "wm-100" }),
        },
      };

      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
        return cb(mockTx);
      });

      const res = await registerAccount("admin", "password123", "Workspace A");
      expect(res).toEqual({ userId: "u-100", workspaceId: "w-100" });
    });

    it("allows creating a second account when one already exists", async () => {
      const mockTx = {
        role: {
          findUnique: vi.fn().mockResolvedValue({ id: "role-owner", code: "OWNER" }),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "u-200", username: "user2" }),
        },
        workspace: {
          create: vi.fn().mockResolvedValue({ id: "w-200", name: "Workspace B" }),
        },
        workspaceMember: {
          create: vi.fn().mockResolvedValue({ id: "wm-200" }),
        },
      };

      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
        return cb(mockTx);
      });

      const res = await registerAccount("user2", "password456", "Workspace B");
      expect(res).toEqual({ userId: "u-200", workspaceId: "w-200" });
    });
  });

  describe("registerAccountAction", () => {
    it("returns validation error message and fieldErrors for invalid input", async () => {
      const res = await registerAccountAction({
        username: "a",
        password: "123",
        workspaceName: "",
      });

      expect(res.ok).toBe(false);
      expect(res.message).toBe("Thông tin nhập vào chưa hợp lệ. Vui lòng kiểm tra lại các trường bên dưới.");
      expect(res.fieldErrors?.username).toBe("Tên đăng nhập phải có ít nhất 3 ký tự.");
      expect(res.fieldErrors?.password).toBe("Mật khẩu phải có ít nhất 6 ký tự.");
      expect(res.fieldErrors?.workspaceName).toBe("Tên workspace phải có ít nhất 3 ký tự.");
    });

    it("returns specific AppError message when username is taken", async () => {
      const mockTx = {
        role: {
          findUnique: vi.fn().mockResolvedValue({ id: "role-owner", code: "OWNER" }),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue({ id: "existing", username: "admin" }),
        },
      };

      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
        return cb(mockTx);
      });

      const res = await registerAccountAction({
        username: "admin",
        password: "password123",
        workspaceName: "Workspace A",
      });

      expect(res.ok).toBe(false);
      expect(res.message).toBe("Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên đăng nhập khác.");
    });
  });
});
