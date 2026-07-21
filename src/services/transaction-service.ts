import Decimal from "decimal.js";
import type { CreateTransactionInput } from "@/domain";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { availableCategoryWhere } from "@/services/category-visibility";
import { requireWorkspaceMember, requireWorkspaceWallet } from "@/services/workspace-access";

export async function createTransaction(userId: string, workspaceId: string, input: CreateTransactionInput) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  await requireWorkspaceWallet(workspaceId, input.walletId);
  if (input.toWalletId) await requireWorkspaceWallet(workspaceId, input.toWalletId);
  if (input.categoryId) {
    const category = await prisma.category.findFirst({ where: { id: input.categoryId, ...availableCategoryWhere(workspaceId) } });
    if (!category) throw new AppError("FORBIDDEN", "Category is not available in this workspace.");
  }
  return prisma.transaction.create({ data: { ...input, memberId: member.id, workflowStatus: "pending", date: new Date(`${input.date}T00:00:00.000Z`) } });
}

export async function approveTransaction(userId: string, workspaceId: string, transactionId: string) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    const record = await tx.transaction.findFirst({ where: { id: transactionId, workflowStatus: "pending", deletedAt: null, member: { workspaceId, status: "active", deletedAt: null } } });
    if (!record) throw new AppError("NOT_FOUND", "Pending transaction was not found in this workspace.");
    const claimed = await tx.transaction.updateMany({
      where: { id: record.id, workflowStatus: "pending", deletedAt: null },
      data: { workflowStatus: "approved" },
    });
    if (claimed.count !== 1) throw new AppError("CONFLICT", "This transaction was already processed.");
    const amount = new Decimal(record.amount.toString());
    if (record.type === "income") await tx.wallet.update({ where: { id: record.walletId }, data: { currentBalance: { increment: amount } } });
    if (record.type === "expense") await tx.wallet.update({ where: { id: record.walletId }, data: { currentBalance: { decrement: amount } } });
    if (record.type === "transfer" && record.toWalletId) {
      await tx.wallet.update({ where: { id: record.walletId }, data: { currentBalance: { decrement: amount } } });
      await tx.wallet.update({ where: { id: record.toWalletId }, data: { currentBalance: { increment: amount } } });
    }
    return tx.transaction.findUniqueOrThrow({ where: { id: record.id } });
  });
}

export async function rejectTransaction(userId: string, workspaceId: string, transactionId: string) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.transaction.updateMany({ where: { id: transactionId, workflowStatus: "pending", deletedAt: null, member: { workspaceId, status: "active", deletedAt: null } }, data: { workflowStatus: "rejected" } });
}

/** Soft-deletes a transaction and atomically reverses any balance change it had applied. */
export async function deleteTransaction(userId: string, workspaceId: string, transactionId: string) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    const record = await tx.transaction.findFirst({ where: { id: transactionId, deletedAt: null, member: { workspaceId, status: "active", deletedAt: null } } });
    if (!record) throw new AppError("NOT_FOUND", "Transaction was not found in this workspace.");
    const claimed = await tx.transaction.updateMany({ where: { id: record.id, deletedAt: null }, data: { deletedAt: new Date() } });
    if (claimed.count !== 1) throw new AppError("CONFLICT", "This transaction was already deleted.");
    if (record.workflowStatus === "approved") {
      const amount = new Decimal(record.amount.toString());
      if (record.type === "income") await tx.wallet.update({ where: { id: record.walletId }, data: { currentBalance: { decrement: amount } } });
      if (record.type === "expense") await tx.wallet.update({ where: { id: record.walletId }, data: { currentBalance: { increment: amount } } });
      if (record.type === "transfer" && record.toWalletId) {
        await tx.wallet.update({ where: { id: record.walletId }, data: { currentBalance: { increment: amount } } });
        await tx.wallet.update({ where: { id: record.toWalletId }, data: { currentBalance: { decrement: amount } } });
      }
    }
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "transaction.deleted", entityType: "transaction", entityId: record.id, metadata: { type: record.type, workflowStatus: record.workflowStatus, balanceReversed: record.workflowStatus === "approved" } } });
    return record;
  });
}
