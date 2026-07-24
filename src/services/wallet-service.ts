import type { CreateWalletInput, UpdateWalletInput } from "@/domain";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/services/workspace-access";

export async function createWalletForWorkspace(userId: string, workspaceId: string, input: CreateWalletInput) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.create({ data: { name: input.name, description: input.description, openingBalance: input.openingBalance, currentBalance: input.openingBalance } });
    await tx.workspaceWallet.create({ data: { workspaceId, walletId: wallet.id } });
    return wallet;
  });
}

export async function updateWalletForWorkspace(userId: string, workspaceId: string, input: UpdateWalletInput) {
  await requireWorkspaceMember(userId, workspaceId, true);
  const link = await prisma.workspaceWallet.findFirst({
    where: { workspaceId, walletId: input.walletId, wallet: { deletedAt: null } },
    select: { walletId: true },
  });
  if (!link) throw new AppError("WORKSPACE_ISOLATION_VIOLATION", "Wallet is not available in this workspace.");
  return prisma.wallet.update({
    where: { id: link.walletId },
    data: {
      name: input.name,
      description: input.description === undefined ? undefined : input.description || null,
    },
  });
}

async function assertWalletHasNoOpenDependencies(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  walletId: string,
) {
  const [openTransactions, recurringTransactions] = await Promise.all([
    tx.transaction.count({
      where: {
        deletedAt: null,
        workflowStatus: { in: ["pending", "scheduled"] },
        member: { workspaceId },
        OR: [{ walletId }, { toWalletId: walletId }],
      },
    }),
    tx.recurringTransaction.count({
      where: {
        workspaceId,
        deletedAt: null,
        OR: [{ walletId }, { toWalletId: walletId }],
      },
    }),
  ]);

  if (openTransactions > 0) {
    throw new AppError(
      "CONFLICT",
      `Ví còn ${openTransactions} giao dịch đang chờ hoặc đã lên lịch. Hãy xử lý các giao dịch này trước.`,
    );
  }
  if (recurringTransactions > 0) {
    throw new AppError(
      "CONFLICT",
      `Ví đang được sử dụng bởi ${recurringTransactions} giao dịch định kỳ. Hãy đổi ví hoặc xóa giao dịch định kỳ liên quan trước.`,
    );
  }
}

export async function setWalletStatusForWorkspace(
  userId: string,
  workspaceId: string,
  walletId: string,
  status: "active" | "deactive",
) {
  await requireWorkspaceMember(userId, workspaceId, true);

  return prisma.$transaction(async (tx) => {
    const link = await tx.workspaceWallet.findFirst({
      where: { workspaceId, walletId, wallet: { deletedAt: null } },
      include: { wallet: true },
    });
    if (!link) {
      throw new AppError(
        "WORKSPACE_ISOLATION_VIOLATION",
        "Ví không tồn tại trong workspace này.",
      );
    }
    if (link.wallet.status === status) return link.wallet;

    if (status === "deactive") {
      await assertWalletHasNoOpenDependencies(tx, workspaceId, walletId);
    }

    const wallet = await tx.wallet.update({
      where: { id: walletId },
      data: { status },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: status === "active" ? "workspace.wallet_reactivated" : "workspace.wallet_deactivated",
        entityType: "wallet",
        entityId: walletId,
        metadata: { status },
      },
    });
    return wallet;
  });
}

export async function softDeleteWalletForWorkspace(
  userId: string,
  workspaceId: string,
  walletId: string,
) {
  await requireWorkspaceMember(userId, workspaceId, true);

  return prisma.$transaction(async (tx) => {
    const link = await tx.workspaceWallet.findFirst({
      where: { workspaceId, walletId, wallet: { deletedAt: null } },
      include: { wallet: true },
    });
    if (!link) {
      throw new AppError(
        "WORKSPACE_ISOLATION_VIOLATION",
        "Ví không tồn tại trong workspace này.",
      );
    }
    if (link.wallet.status !== "deactive") {
      throw new AppError("VALIDATION_ERROR", "Hãy tạm ngưng ví trước khi xóa.");
    }

    await assertWalletHasNoOpenDependencies(tx, workspaceId, walletId);
    const deletedAt = new Date();
    const wallet = await tx.wallet.update({
      where: { id: walletId },
      data: { status: "deactive", deletedAt },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "workspace.wallet_deleted",
        entityType: "wallet",
        entityId: walletId,
        metadata: { softDeleted: true, deletedAt: deletedAt.toISOString() },
      },
    });
    return wallet;
  });
}
