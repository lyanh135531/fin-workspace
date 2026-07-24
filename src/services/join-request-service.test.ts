import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { requestWorkspaceJoin, reviewWorkspaceJoinRequest } from "@/services/join-request-service";
import { requireWorkspaceMember } from "@/services/workspace-access";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/services/workspace-access", () => ({
  requireWorkspaceMember: vi.fn(),
}));

describe("join-request-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes a six-digit invite code before finding the workspace", async () => {
    const tx = {
      workspace: {
        findFirst: vi.fn().mockResolvedValue({ id: "workspace-1" }),
      },
      workspaceMember: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      workspaceJoinRequest: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "request-1" }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await requestWorkspaceJoin("user-1", "892415");

    expect(tx.workspace.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { inviteCode: "892415" },
          { inviteCode: "892-415" },
          { inviteCode: "892415" },
        ],
        status: "active",
        deletedAt: null,
      },
    });
    expect(tx.workspaceJoinRequest.create).toHaveBeenCalledWith({
      data: { workspaceId: "workspace-1", requesterId: "user-1" },
    });
  });

  it("assigns the role selected by the admin when approving a request", async () => {
    const tx = {
      workspaceJoinRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: "request-1",
          requesterId: "user-2",
        }),
        update: vi.fn().mockResolvedValue({ id: "request-1", status: "approved" }),
      },
      role: {
        findUnique: vi.fn().mockResolvedValue({ id: "role-admin", code: "ADMIN" }),
      },
      workspaceMember: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await reviewWorkspaceJoinRequest(
      "admin-1",
      "workspace-1",
      "request-1",
      true,
      "ADMIN",
    );

    expect(requireWorkspaceMember).toHaveBeenCalledWith(
      "admin-1",
      "workspace-1",
      true,
    );
    expect(tx.role.findUnique).toHaveBeenCalledWith({ where: { code: "ADMIN" } });
    expect(tx.workspaceMember.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-1",
        userId: "user-2",
        roleId: "role-admin",
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "workspace.join_approved",
        metadata: { roleCode: "ADMIN" },
      }),
    });
  });

  it("uses MEMBER when an approval does not specify a role", async () => {
    const tx = {
      workspaceJoinRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: "request-1",
          requesterId: "user-2",
        }),
        update: vi.fn().mockResolvedValue({ id: "request-1", status: "approved" }),
      },
      role: {
        findUnique: vi.fn().mockResolvedValue({ id: "role-member", code: "MEMBER" }),
      },
      workspaceMember: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await reviewWorkspaceJoinRequest(
      "admin-1",
      "workspace-1",
      "request-1",
      true,
    );

    expect(tx.role.findUnique).toHaveBeenCalledWith({ where: { code: "MEMBER" } });
  });

  it("prevents an admin from granting the OWNER role", async () => {
    (requireWorkspaceMember as ReturnType<typeof vi.fn>).mockResolvedValue({
      role: { code: "ADMIN" },
    });
    const tx = {
      workspaceJoinRequest: {
        findFirst: vi.fn().mockResolvedValue({
          id: "request-1",
          requesterId: "user-2",
        }),
      },
      role: {
        findUnique: vi.fn(),
      },
    };
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      reviewWorkspaceJoinRequest(
        "admin-1",
        "workspace-1",
        "request-1",
        true,
        "OWNER",
      ),
    ).rejects.toThrow("Chỉ Owner workspace mới có thể cấp vai trò Owner.");
    expect(tx.role.findUnique).not.toHaveBeenCalled();
  });
});
