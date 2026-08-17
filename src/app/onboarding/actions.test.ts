import { beforeEach, describe, expect, it, vi } from "vitest";

import { createPersonalWorkspaceAction } from "@/app/onboarding/actions";
import { createInitialWorkspaceForUser } from "@/services/workspace-service";

const { cookieSet, revalidatePath, getServerSession } = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  revalidatePath: vi.fn(),
  getServerSession: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ set: cookieSet }),
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

vi.mock("@/auth", () => ({
  authOptions: {},
}));

vi.mock("@/services/active-workspace", () => ({
  activeWorkspaceCookie: "fin-workspace-id",
}));

vi.mock("@/services/workspace-service", () => ({
  createInitialWorkspaceForUser: vi.fn(),
}));

describe("createPersonalWorkspaceAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    getServerSession.mockResolvedValue(null);

    const result = await createPersonalWorkspaceAction();

    expect(result).toEqual({
      ok: false,
      message: "Bạn cần đăng nhập để tiếp tục.",
    });
    expect(createInitialWorkspaceForUser).not.toHaveBeenCalled();
  });

  it("creates or reuses an initial workspace and stores it as active", async () => {
    getServerSession.mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(createInitialWorkspaceForUser).mockResolvedValue({
      workspace: { id: "workspace-1" },
      created: true,
    } as Awaited<ReturnType<typeof createInitialWorkspaceForUser>>);

    const result = await createPersonalWorkspaceAction();

    expect(createInitialWorkspaceForUser).toHaveBeenCalledWith("user-1", {
      name: "Tài chính cá nhân",
      description: "Không gian quản lý tài chính cá nhân",
      baseCurrency: "VND",
      timeZone: "Asia/Ho_Chi_Minh",
    });
    expect(cookieSet).toHaveBeenCalledWith(
      "fin-workspace-id",
      "workspace-1",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/onboarding");
    expect(result).toEqual({
      ok: true,
      message: null,
      workspaceId: "workspace-1",
    });
  });
});
