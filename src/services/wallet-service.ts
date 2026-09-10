import type {
  CreateWalletInput,
  ReorderWalletsInput,
  UpdateWalletInput,
} from "@/domain";
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
      `Tên ví “${name}” đã tồn tại trong nhóm.`,
    );
  }
}

export async function createWalletForWorkspace(userId: string, workspaceId: string, input: CreateWalletInput) {
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    await lockWorkspaceWalletNames(tx, workspaceId);
    await assertWalletNameAvailable(tx, workspaceId, input.name);
    const zero = new Decimal(0);
    const kind = input.kind ?? "asset";
    const creditCard = input.creditCard;
    const openingAllocations = creditCard?.openingDebt.gt(0) && creditCard.openingAllocations.length === 0
      ? [{ walletId: creditCard.defaultFundingWalletId, amount: creditCard.openingDebt }]
      : (creditCard?.openingAllocations ?? []);
    if (kind === "credit_card" && !creditCard) {
      throw new AppError("VALIDATION_ERROR", "Thiếu cấu hình thẻ tín dụng.");
    }
    if (kind === "credit_card" && creditCard) {
      const fundingWalletIds = [
        creditCard.defaultFundingWalletId,
        ...openingAllocations.map((allocation) => allocation.walletId),
      ];
      const fundingLinks = await tx.workspaceWallet.findMany({
        where: {
          workspaceId,
          walletId: { in: fundingWalletIds },
          wallet: { kind: "asset", status: "active", deletedAt: null },
        },
        select: { walletId: true },
      });
      if (new Set(fundingLinks.map(({ walletId }) => walletId)).size !== new Set(fundingWalletIds).size) {
        throw new AppError("WORKSPACE_ISOLATION_VIOLATION", "Ví trả thẻ phải là ví tài sản đang hoạt động trong nhóm này.");
      }
    }
    const openingBalance = kind === "credit_card" && creditCard ? creditCard.openingDebt : zero;
    const wallet = await tx.wallet.create({
      data: {
        name: input.name,
        description: input.description,
        kind,
        assetSubtype: kind === "asset" ? (input.assetSubtype ?? "other") : null,
        openingBalance,
        currentBalance: openingBalance,
        creditCardProfile: creditCard ? {
          create: {
            creditLimit: creditCard.creditLimit,
            defaultFundingWalletId: creditCard.defaultFundingWalletId,
            openingAllocations: openingAllocations.length ? {
              create: openingAllocations.map((allocation) => ({
                fundingWalletId: allocation.walletId,
                amount: allocation.amount,
              })),
            } : undefined,
          },
        } : undefined,
      },
    });
    const lastWallet = await tx.workspaceWallet.findFirst({
      where: { workspaceId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    await tx.workspaceWallet.create({
      data: {
        workspaceId,
        walletId: wallet.id,
        sortOrder: (lastWallet?.sortOrder ?? -1) + 1,
      },
    });
    if (kind === "credit_card" && creditCard) {
      const businessDate = getBusinessDateInTimeZone(member.workspace.timeZone, new Date());
      if (creditCard.openingDebt.gt(0)) {
        await tx.creditCardObligationEntry.createMany({
          data: openingAllocations.map((allocation) => ({
            workspaceId,
            cardWalletId: wallet.id,
            fundingWalletId: allocation.walletId,
            kind: "opening_debt" as const,
            source: "opening_balance" as const,
            effectiveDate: new Date(`${businessDate}T00:00:00.000Z`),
            postedDate: new Date(`${businessDate}T00:00:00.000Z`),
            amount: allocation.amount,
            idempotencyKey: `opening:${wallet.id}:${allocation.walletId}`,
          })),
        });
      }
    }
    if (kind === "asset" && input.funding && input.funding.amount.gt(0)) {
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
    if (kind === "credit_card") {
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "workspace.credit_card_created",
          entityType: "wallet",
          entityId: wallet.id,
          metadata: { openingDebt: openingBalance.toString() },
        },
      });
    }
    return wallet;
  });
}

export async function reorderWalletsForWorkspace(
  userId: string,
  workspaceId: string,
  input: ReorderWalletsInput,
) {
  await requireWorkspaceMember(userId, workspaceId, true);

  return prisma.$transaction(async (tx) => {
    await lockWorkspaceWalletNames(tx, workspaceId);
    const links = await tx.workspaceWallet.findMany({
      where: { workspaceId, wallet: { deletedAt: null } },
      select: { walletId: true },
    });
    const existingWalletIds = new Set(links.map(({ walletId }) => walletId));
    const hasExactWalletSet =
      existingWalletIds.size === input.walletIds.length &&
      input.walletIds.every((walletId) => existingWalletIds.has(walletId));

    if (!hasExactWalletSet) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Danh sách sắp xếp không khớp với các ví hiện có. Hãy tải lại trang và thử lại.",
      );
    }

    await Promise.all(
      input.walletIds.map((walletId, sortOrder) =>
        tx.workspaceWallet.update({
          where: { workspaceId_walletId: { workspaceId, walletId } },
          data: { sortOrder },
        }),
      ),
    );
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
    if (!link) throw new AppError("WORKSPACE_ISOLATION_VIOLATION", "Ví không khả dụng trong nhóm tài chính này.");
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
  const [openTransactions, recurringTransactions, creditCardDependencies] = await Promise.all([
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
    Promise.all([
      tx.creditCardProfile?.count?.({ where: { defaultFundingWalletId: walletId } }) ?? 0,
      tx.creditCardObligationEntry?.count?.({ where: { fundingWalletId: walletId } }) ?? 0,
      tx.creditCardPaymentReservation?.count?.({ where: { sourceWalletId: walletId, releasedAt: null } }) ?? 0,
    ]).then((counts) => counts.reduce((sum, count) => sum + count, 0)),
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
  if (creditCardDependencies > 0) {
    throw new AppError("CONFLICT", "Ví còn liên kết thanh toán hoặc nghĩa vụ thẻ tín dụng.");
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
        "Ví không tồn tại trong nhóm này.",
      );
    }
    if (link.wallet.status === status) return link.wallet;

    if (status === "deactive") {
      if (link.wallet.kind === "credit_card" && !new Decimal(link.wallet.currentBalance.toString()).isZero()) {
        throw new AppError("CONFLICT", "Thẻ vẫn còn dư nợ. Hãy thanh toán hết trước khi tạm ngưng.");
      }
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
        "Ví không tồn tại trong nhóm này.",
      );
    }
    if (link.wallet.status !== "deactive") {
      throw new AppError("VALIDATION_ERROR", "Hãy tạm ngưng ví trước khi xóa.");
    }

    await assertWalletHasNoOpenDependencies(tx, workspaceId, walletId);
    const balance = new Decimal(link.wallet.currentBalance.toString());
    if (link.wallet.kind === "credit_card" && !balance.isZero()) {
      throw new AppError("CONFLICT", "Thẻ vẫn còn dư nợ. Không thể tất toán bằng chuyển khoản ví thông thường.");
    }
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
          "Ví đối ứng không thuộc nhóm này hoặc không còn hoạt động.",
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
          jarCode: null,
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
