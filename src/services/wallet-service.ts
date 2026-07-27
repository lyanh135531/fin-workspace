import type { CreateWalletInput, UpdateWalletInput } from "@/domain";
import { Prisma } from "@/generated/prisma/client";
import Decimal from "decimal.js";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { createApprovedTransactionInTransaction } from "@/services/transaction-service";
import { requireWorkspaceMember } from "@/services/workspace-access";

async function lockWorkspaceWalletNames(
  tx: Prisma.TransactionClient,
  workspaceId: string,
) {
  await tx.$queryRaw<Array<{ lock: string }>>`
    SELECT pg_advisory_xact_lock(hashtext(${workspaceId}))::text AS "lock"
  `;
}

async function assertWalletNameAvailable(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  name: string,
  excludeWalletId?: string,
) {
  const duplicate = await tx.workspaceWallet.findFirst({
    where: {
      workspaceId,
      walletId: excludeWalletId ? { not: excludeWalletId } : undefined,
      wallet: {
        deletedAt: null,
        name: { equals: name, mode: "insensitive" },
      },
    },
    select: { walletId: true },
  });
  if (duplicate) {
    throw new AppError(
      "CONFLICT",
      `Tên ví “${name}” đã tồn tại trong workspace.`,
    );
  }
}

export async function createWalletForWorkspace(userId: string, workspaceId: string, input: CreateWalletInput) {
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    await lockWorkspaceWalletNames(tx, workspaceId);
    await assertWalletNameAvailable(tx, workspaceId, input.name);
    const zero = new Decimal(0);
    const wallet = await tx.wallet.create({
      data: {
        name: input.name,
        description: input.description,
        openingBalance: zero,
        currentBalance: zero,
      },
    });
    await tx.workspaceWallet.create({ data: { workspaceId, walletId: wallet.id } });
    if (input.funding && input.funding.type !== "none") {
      const businessDate = getBusinessDateInTimeZone(
        member.workspace.timeZone,
        new Date(),
      );
      const transaction = await createApprovedTransactionInTransaction(
        tx,
        workspaceId,
        member.id,
        {
          walletId: input.funding.type === "transfer"
            ? input.funding.sourceWalletId
            : wallet.id,
          toWalletId: input.funding.type === "transfer" ? wallet.id : undefined,
          categoryId: undefined,
          type: input.funding.type,
          amount: input.funding.amount,
          description: `Tạo ví mới “${input.name}”`,
          date: businessDate,
        },
      );
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "transaction.created",
          entityType: "transaction",
          entityId: transaction.id,
          metadata: {
            workflowStatus: "approved",
            balanceApplied: true,
            walletInitialFunding: true,
            createdWalletId: wallet.id,
          },
        },
      });
    }
    return wallet;
  });
}

export async function updateWalletForWorkspace(userId: string, workspaceId: string, input: UpdateWalletInput) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    await lockWorkspaceWalletNames(tx, workspaceId);
    const link = await tx.workspaceWallet.findFirst({
      where: { workspaceId, walletId: input.walletId, wallet: { deletedAt: null } },
      select: { walletId: true },
    });
    if (!link) throw new AppError("WORKSPACE_ISOLATION_VIOLATION", "Wallet is not available in this workspace.");
    if (input.name !== undefined) {
      await assertWalletNameAvailable(tx, workspaceId, input.name, input.walletId);
    }
    return tx.wallet.update({
      where: { id: link.walletId },
      data: {
        name: input.name,
        description: input.description === undefined ? undefined : input.description || null,
      },
    });
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

async function lockWallets(
  tx: Prisma.TransactionClient,
  walletIds: string[],
) {
  for (const walletId of [...new Set(walletIds)].sort()) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "WALLETS" WHERE "id" = CAST(${walletId} AS uuid) FOR UPDATE`,
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
  settlementWalletId?: string,
) {
  const member = await requireWorkspaceMember(userId, workspaceId, true);

  return prisma.$transaction(async (tx) => {
    await lockWallets(
      tx,
      settlementWalletId ? [walletId, settlementWalletId] : [walletId],
    );
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
    const balance = new Decimal(link.wallet.currentBalance.toString());
    let settlementTransactionId: string | null = null;

    if (!balance.isZero()) {
      if (!settlementWalletId) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Ví vẫn còn số dư. Hãy chọn một ví đối ứng để tất toán trước khi xóa.",
        );
      }
      if (settlementWalletId === walletId) {
        throw new AppError("VALIDATION_ERROR", "Ví đối ứng phải khác ví đang xóa.");
      }
      const settlementLink = await tx.workspaceWallet.findFirst({
        where: {
          workspaceId,
          walletId: settlementWalletId,
          wallet: { status: "active", deletedAt: null },
        },
        select: { walletId: true },
      });
      if (!settlementLink) {
        throw new AppError(
          "WORKSPACE_ISOLATION_VIOLATION",
          "Ví đối ứng không thuộc workspace này hoặc không còn hoạt động.",
        );
      }

      const amount = balance.abs();
      const sourceWalletId = balance.isPositive() ? walletId : settlementWalletId;
      const destinationWalletId = balance.isPositive() ? settlementWalletId : walletId;
      const businessDate = getBusinessDateInTimeZone(
        member.workspace.timeZone,
        new Date(),
      );
      const settlement = await tx.transaction.create({
        data: {
          memberId: member.id,
          walletId: sourceWalletId,
          toWalletId: destinationWalletId,
          categoryId: null,
          type: "transfer",
          amount,
          description: `Tất toán ví “${link.wallet.name}” trước khi xóa`,
          date: new Date(`${businessDate}T00:00:00.000Z`),
          workflowStatus: "approved",
        },
      });
      await tx.wallet.update({
        where: { id: sourceWalletId },
        data: { currentBalance: { decrement: amount } },
      });
      await tx.wallet.update({
        where: { id: destinationWalletId },
        data: { currentBalance: { increment: amount } },
      });
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "transaction.created",
          entityType: "transaction",
          entityId: settlement.id,
          metadata: {
            workflowStatus: "approved",
            balanceApplied: true,
            walletSettlement: true,
            deletedWalletId: walletId,
          },
        },
      });
      settlementTransactionId = settlement.id;
    }

    const deletedAt = new Date();
    const wallet = await tx.wallet.update({
      where: { id: walletId },
      data: {
        status: "deactive",
        deletedAt,
        currentBalance: new Decimal(0),
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "workspace.wallet_deleted",
        entityType: "wallet",
        entityId: walletId,
        metadata: {
          softDeleted: true,
          deletedAt: deletedAt.toISOString(),
          settlementTransactionId,
        },
      },
    });
    return wallet;
  });
}
