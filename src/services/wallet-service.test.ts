import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  setWalletStatusForWorkspace,
  softDeleteWalletForWorkspace,
} from "@/services/wallet-service";
import { requireWorkspaceMember } from "@/services/workspace-access";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/services/workspace-access", () => ({
  requireWorkspaceMember: vi.fn(),
}));

function transactionClient(walletStatus: "active" | "deactive") {
  return {
    workspaceWallet: {
      findFirst: vi.fn().mockResolvedValue({
        wallet: { id: "wallet-1", status: walletStatus },
      }),
    },
    transaction: {
      count: vi.fn().mockResolvedValue(0),
    },
    recurringTransaction: {
      count: vi.fn().mockResolvedValue(0),
    },
    wallet: {
      update: vi.fn().mockResolvedValue({
        id: "wallet-1",
        status: walletStatus,
      }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("wallet-service lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireWorkspaceMember as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "member-1",
    });
  });

  it("blocks deactivation while any non-deleted recurring transaction uses the wallet", async () => {
    const tx = transactionClient("active");
    tx.recurringTransaction.count.mockResolvedValue(2);
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await expect(
      setWalletStatusForWorkspace(
        "admin-1",
        "workspace-1",
        "wallet-1",
        "deactive",
      ),
    ).rejects.toThrow(
      "Ví đang được sử dụng bởi 2 giao dịch định kỳ. Hãy đổi ví hoặc xóa giao dịch định kỳ liên quan trước.",
    );

    expect(tx.recurringTransaction.count).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        deletedAt: null,
        OR: [{ walletId: "wallet-1" }, { toWalletId: "wallet-1" }],
      },
    });
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it("reactivates a paused wallet without dependency checks", async () => {
    const tx = transactionClient("deactive");
    tx.wallet.update.mockResolvedValue({ id: "wallet-1", status: "active" });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await setWalletStatusForWorkspace(
      "admin-1",
      "workspace-1",
      "wallet-1",
      "active",
    );

    expect(tx.recurringTransaction.count).not.toHaveBeenCalled();
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "wallet-1" },
      data: { status: "active" },
    });
  });

  it("soft-deletes a paused wallet while preserving its database record", async () => {
    const tx = transactionClient("deactive");
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await softDeleteWalletForWorkspace(
      "admin-1",
      "workspace-1",
      "wallet-1",
    );

    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: "wallet-1" },
      data: {
        status: "deactive",
        deletedAt: expect.any(Date),
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "workspace.wallet_deleted",
        entityId: "wallet-1",
        metadata: expect.objectContaining({ softDeleted: true }),
      }),
    });
  });
});
