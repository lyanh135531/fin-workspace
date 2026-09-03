import Decimal from "decimal.js";
import { cache } from "react";
import { Prisma, type Transaction } from "@/generated/prisma/client";
import {
  createTransactionSchema,
  type CreateTransactionInput,
  type FinancialJarCode,
} from "@/domain";
import { isAdminRole } from "@/domain/role-policy";
import { transactionTimingForDate, workflowStatusForAppliedDate, workflowStatusForCreation, type TransactionTiming } from "@/domain/transaction/policy";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { availableCategoryWhere } from "@/services/category-visibility";
import { requireWorkspaceMember } from "@/services/workspace-access";

type TransactionClient = Prisma.TransactionClient;
type ResolvedTransactionInput = CreateTransactionInput & { timing: TransactionTiming };
type TransactionResourceInput = {
  walletId: string;
  toWalletId?: string | null;
  categoryId?: string | null;
  type: "income" | "expense" | "transfer";
};

function asDatabaseDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function asBusinessDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function resolveTransactionInput(input: CreateTransactionInput, timeZone: string, now = new Date()): ResolvedTransactionInput {
  const today = getBusinessDateInTimeZone(timeZone, now);
  return { ...input, timing: transactionTimingForDate(input.date, today) };
}

export async function requireTransactionResources(
  tx: TransactionClient,
  workspaceId: string,
  input: TransactionResourceInput,
) {
  const walletIds = [input.walletId, input.toWalletId].filter((id): id is string => Boolean(id));
  const links = await tx.workspaceWallet.findMany({
    where: { workspaceId, walletId: { in: walletIds }, wallet: { status: "active", deletedAt: null } },
    select: { walletId: true },
  });
  if (new Set(links.map((link) => link.walletId)).size !== new Set(walletIds).size) {
    throw new AppError("WORKSPACE_ISOLATION_VIOLATION", "Ví không thuộc nhóm này hoặc không còn hoạt động.");
  }
  let category: { id: string; type: "income" | "expense"; jarCode: FinancialJarCode | null } | null = null;
  if (input.type === "expense" && !input.categoryId) {
    throw new AppError("VALIDATION_ERROR", "Cần chọn danh mục cho giao dịch chi tiêu.");
  }
  if (input.categoryId) {
    category = await tx.category.findFirst({ where: { id: input.categoryId, ...availableCategoryWhere(workspaceId) }, select: { id: true, type: true, jarCode: true } });
    if (!category) throw new AppError("FORBIDDEN", "Danh mục không khả dụng trong nhóm này.");
    if (input.type === "transfer" || category.type !== input.type) {
      throw new AppError("VALIDATION_ERROR", "Loại danh mục không khớp với loại giao dịch.");
    }
  }
  const expenseJarCode = input.type === "expense" ? category?.jarCode : null;
  if (input.type === "expense" && !expenseJarCode) {
    throw new AppError("VALIDATION_ERROR", "Danh mục chi tiêu chưa có hũ tài chính hợp lệ.");
  }
  return {
    jarCode: input.type === "expense"
      ? expenseJarCode
      : null,
  };
}

async function applyBalance(tx: TransactionClient, record: Pick<Transaction, "type" | "amount" | "walletId" | "toWalletId">, reverse = false) {
  const amount = new Decimal(record.amount.toString());
  if (record.type === "income") {
    await tx.wallet.update({ where: { id: record.walletId }, data: { currentBalance: reverse ? { decrement: amount } : { increment: amount } } });
  }
  if (record.type === "expense") {
    await tx.wallet.update({ where: { id: record.walletId }, data: { currentBalance: reverse ? { increment: amount } : { decrement: amount } } });
  }
  if (record.type === "transfer") {
    if (!record.toWalletId) throw new AppError("VALIDATION_ERROR", "Giao dịch chuyển khoản thiếu ví nhận.");
    await tx.wallet.update({ where: { id: record.walletId }, data: { currentBalance: reverse ? { increment: amount } : { decrement: amount } } });
    await tx.wallet.update({ where: { id: record.toWalletId }, data: { currentBalance: reverse ? { decrement: amount } : { increment: amount } } });
  }
}

export async function createApprovedTransactionInTransaction(
  tx: TransactionClient,
  workspaceId: string,
  memberId: string,
  input: CreateTransactionInput,
  recurring?: { id: string; period: string },
) {
  const resources = await requireTransactionResources(tx, workspaceId, input);
  const record = await tx.transaction.create({
    data: {
      memberId,
      walletId: input.walletId,
      toWalletId: input.toWalletId ?? null,
      categoryId: input.categoryId ?? null,
      type: input.type,
      amount: input.amount,
      description: input.description ?? null,
      date: asDatabaseDate(input.date),
      workflowStatus: "approved",
      recurringTransactionId: recurring?.id,
      recurringPeriod: recurring?.period,
      jarCode: resources.jarCode,
    },
  });
  await applyBalance(tx, record);
  return record;
}

async function lockTransaction(tx: TransactionClient, transactionId: string) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "TRANSACTION" WHERE "id" = CAST(${transactionId} AS uuid) FOR UPDATE`);
}

function transactionSnapshot(record: Transaction) {
  return {
    walletId: record.walletId,
    toWalletId: record.toWalletId,
    categoryId: record.categoryId,
    type: record.type,
    amount: record.amount.toString(),
    description: record.description,
    date: asBusinessDate(record.date),
    workflowStatus: record.workflowStatus,
    jarCode: record.jarCode,
  };
}

function proposedTransaction(input: ResolvedTransactionInput) {
  return {
    walletId: input.walletId,
    toWalletId: input.toWalletId ?? null,
    categoryId: input.categoryId ?? null,
    type: input.type,
    amount: input.amount.toString(),
    description: input.description ?? null,
    date: input.date,
  };
}

async function applyUpdate(
  tx: TransactionClient,
  workspaceId: string,
  record: Transaction,
  input: CreateTransactionInput,
  timeZone: string,
  now = new Date(),
) {
  await lockTransaction(tx, record.id);
  const current = await tx.transaction.findFirst({ where: { id: record.id, deletedAt: null } });
  if (!current) throw new AppError("NOT_FOUND", "Giao dịch không còn tồn tại.");
  const resources = await requireTransactionResources(tx, workspaceId, input);
  if (current.workflowStatus === "approved") await applyBalance(tx, current, true);
  const workflowStatus = workflowStatusForAppliedDate(input.date, getBusinessDateInTimeZone(timeZone, now));
  const updated = await tx.transaction.update({
    where: { id: record.id },
    data: {
      walletId: input.walletId,
      toWalletId: input.toWalletId ?? null,
      categoryId: input.categoryId ?? null,
      type: input.type,
      amount: input.amount,
      description: input.description ?? null,
      date: asDatabaseDate(input.date),
      workflowStatus,
      jarCode: resources.jarCode,
    },
  });
  if (workflowStatus === "approved") await applyBalance(tx, updated);
  return updated;
}

async function softDelete(tx: TransactionClient, record: Transaction) {
  await lockTransaction(tx, record.id);
  const current = await tx.transaction.findFirst({ where: { id: record.id, deletedAt: null } });
  if (!current) throw new AppError("NOT_FOUND", "Giao dịch không còn tồn tại.");
  const claimed = await tx.transaction.updateMany({ where: { id: current.id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (claimed.count !== 1) throw new AppError("CONFLICT", "Giao dịch đã được xóa trước đó.");
  if (current.workflowStatus === "approved") await applyBalance(tx, current, true);
}

async function findWorkspaceTransaction(tx: TransactionClient, workspaceId: string, transactionId: string) {
  await lockTransaction(tx, transactionId);
  const record = await tx.transaction.findFirst({
    where: { id: transactionId, deletedAt: null, member: { workspaceId, status: "active", deletedAt: null } },
  });
  if (!record) throw new AppError("NOT_FOUND", "Không tìm thấy giao dịch trong nhóm này.");
  return record;
}

async function ensureNoPendingChange(tx: TransactionClient, transactionId: string) {
  const pending = await tx.transactionChangeRequest.findFirst({ where: { transactionId, status: "pending" }, select: { id: true } });
  if (pending) throw new AppError("CONFLICT", "Giao dịch đã có một yêu cầu thay đổi đang chờ duyệt.");
}

export async function createTransaction(userId: string, workspaceId: string, input: CreateTransactionInput, now = new Date()) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  const resolved = resolveTransactionInput(input, member.workspace.timeZone, now);
  const workflowStatus = workflowStatusForCreation(member.role.code, resolved.timing);
  return prisma.$transaction(async (tx) => {
    const resources = await requireTransactionResources(tx, workspaceId, resolved);
    const record = await tx.transaction.create({
      data: {
        memberId: member.id,
        walletId: resolved.walletId,
        toWalletId: resolved.toWalletId,
        categoryId: resolved.categoryId,
        type: resolved.type,
        amount: resolved.amount,
        description: resolved.description,
        date: asDatabaseDate(resolved.date),
        workflowStatus,
        jarCode: resources.jarCode,
      },
    });
    if (workflowStatus === "approved") await applyBalance(tx, record);
    await tx.auditLog.create({
      data: { workspaceId, actorUserId: userId, action: "transaction.created", entityType: "transaction", entityId: record.id, metadata: { timing: resolved.timing, workflowStatus, balanceApplied: workflowStatus === "approved", jarCode: resources.jarCode } },
    });
    return record;
  });
}

export async function approveTransaction(userId: string, workspaceId: string, transactionId: string) {
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    await lockTransaction(tx, transactionId);
    const record = await tx.transaction.findFirst({
      where: { id: transactionId, workflowStatus: { in: ["pending", "scheduled"] }, deletedAt: null, member: { workspaceId, status: "active", deletedAt: null } },
    });
    if (!record) throw new AppError("NOT_FOUND", "Không tìm thấy giao dịch đang chờ hoặc đã lên lịch.");
    const resources = await requireTransactionResources(tx, workspaceId, record);
    const today = getBusinessDateInTimeZone(member.workspace.timeZone);
    const nextStatus = record.workflowStatus === "scheduled"
      ? "approved"
      : workflowStatusForAppliedDate(asBusinessDate(record.date), today);
    const claimed = await tx.transaction.updateMany({
      where: { id: record.id, workflowStatus: record.workflowStatus, deletedAt: null },
      data: { workflowStatus: nextStatus, jarCode: resources.jarCode },
    });
    if (claimed.count !== 1) throw new AppError("CONFLICT", "Giao dịch đã được xử lý.");
    if (nextStatus === "approved") await applyBalance(tx, record);
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "transaction.approved", entityType: "transaction", entityId: record.id, metadata: { previousStatus: record.workflowStatus, workflowStatus: nextStatus, balanceApplied: nextStatus === "approved", jarCode: resources.jarCode } } });
    return tx.transaction.findUniqueOrThrow({ where: { id: record.id } });
  });
}

export async function rejectTransaction(userId: string, workspaceId: string, transactionId: string) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    await lockTransaction(tx, transactionId);
    const record = await tx.transaction.findFirst({ where: { id: transactionId, workflowStatus: "pending", deletedAt: null, member: { workspaceId, status: "active", deletedAt: null } } });
    if (!record) throw new AppError("NOT_FOUND", "Không tìm thấy giao dịch đang chờ duyệt.");
    await tx.transaction.update({ where: { id: record.id }, data: { workflowStatus: "rejected" } });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "transaction.rejected", entityType: "transaction", entityId: record.id } });
    return record;
  });
}

/** Posts due scheduled transactions when a workspace is opened. Safe under concurrent requests. */
export async function activateDueScheduledTransactions(workspaceId: string, now = new Date()) {
  const workspace = await prisma.workspace.findFirst({ where: { id: workspaceId, deletedAt: null }, select: { timeZone: true } });
  if (!workspace) return 0;
  const dueDate = asDatabaseDate(getBusinessDateInTimeZone(workspace.timeZone, now));
  return prisma.$transaction(async (tx) => {
    const due = await tx.transaction.findMany({
      where: { workflowStatus: "scheduled", date: { lte: dueDate }, deletedAt: null, member: { workspaceId } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      take: 1_000,
    });
    let activated = 0;
    for (const record of due) {
      await lockTransaction(tx, record.id);
      const current = await tx.transaction.findFirst({ where: { id: record.id, workflowStatus: "scheduled", deletedAt: null } });
      if (!current) continue;
      const resources = await requireTransactionResources(tx, workspaceId, current);
      const claimed = await tx.transaction.updateMany({ where: { id: current.id, workflowStatus: "scheduled", deletedAt: null }, data: { workflowStatus: "approved", jarCode: resources.jarCode } });
      if (claimed.count !== 1) continue;
      await applyBalance(tx, current);
      await tx.auditLog.create({ data: { workspaceId, action: "transaction.scheduled_activated", entityType: "transaction", entityId: current.id, metadata: { dueDate: asBusinessDate(current.date), jarCode: resources.jarCode } } });
      activated += 1;
    }
    return activated;
  });
}

export const activateDueScheduledTransactionsForRequest = cache(
  async (workspaceId: string): Promise<number> =>
    activateDueScheduledTransactions(workspaceId, new Date()),
);

export async function updateTransaction(
  userId: string,
  workspaceId: string,
  transactionId: string,
  input: CreateTransactionInput,
  reason: string,
  now = new Date(),
) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  return prisma.$transaction(async (tx) => {
    const record = await findWorkspaceTransaction(tx, workspaceId, transactionId);
    if (!isAdminRole(member.role.code) && record.memberId !== member.id) {
      throw new AppError("FORBIDDEN", "Bạn chỉ có thể gửi yêu cầu sửa giao dịch do mình tạo.");
    }
    const resolved = resolveTransactionInput(input, member.workspace.timeZone, now);
    await requireTransactionResources(tx, workspaceId, resolved);
    if (isAdminRole(member.role.code)) {
      const updated = await applyUpdate(tx, workspaceId, record, resolved, member.workspace.timeZone, now);
      await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "transaction.updated", entityType: "transaction", entityId: record.id, metadata: { previous: transactionSnapshot(record) } } });
      return { kind: "updated" as const, id: updated.id };
    }
    await ensureNoPendingChange(tx, record.id);
    const request = await tx.transactionChangeRequest.create({
      data: { transactionId: record.id, requesterMemberId: member.id, previousData: transactionSnapshot(record), proposedData: { action: "update", reason, transaction: proposedTransaction(resolved) } },
    });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "transaction.update_requested", entityType: "transaction", entityId: record.id, metadata: { changeRequestId: request.id, reason } } });
    return { kind: "requested" as const, id: request.id };
  });
}

export async function deleteOrRequestTransaction(userId: string, workspaceId: string, transactionId: string, reason: string) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  return prisma.$transaction(async (tx) => {
    const record = await findWorkspaceTransaction(tx, workspaceId, transactionId);
    if (isAdminRole(member.role.code)) {
      await softDelete(tx, record);
      await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "transaction.deleted", entityType: "transaction", entityId: record.id, metadata: { workflowStatus: record.workflowStatus, balanceReversed: record.workflowStatus === "approved" } } });
      return { kind: "deleted" as const, id: record.id };
    }
    if (record.memberId !== member.id) {
      throw new AppError("FORBIDDEN", "Bạn chỉ có thể gửi yêu cầu xóa giao dịch do mình tạo.");
    }
    if (!reason.trim()) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Vui lòng nhập lý do xóa giao dịch.",
      );
    }
    await ensureNoPendingChange(tx, record.id);
    const request = await tx.transactionChangeRequest.create({
      data: { transactionId: record.id, requesterMemberId: member.id, previousData: transactionSnapshot(record), proposedData: { action: "delete", reason } },
    });
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "transaction.delete_requested", entityType: "transaction", entityId: record.id, metadata: { changeRequestId: request.id, reason } } });
    return { kind: "requested" as const, id: request.id };
  });
}

/** Admin-only bulk delete used by the ledger selection toolbar. */
export async function deleteTransaction(userId: string, workspaceId: string, transactionId: string) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return deleteOrRequestTransaction(userId, workspaceId, transactionId, "Đã thông báo");
}

function readProposedData(value: Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError("VALIDATION_ERROR", "Dữ liệu yêu cầu thay đổi không hợp lệ.");
  const action = value.action;
  if (action === "delete") return { action, reason: typeof value.reason === "string" ? value.reason : "Đã thông báo" } as const;
  if (action === "update") {
    const transaction = value.transaction && typeof value.transaction === "object" && !Array.isArray(value.transaction)
      ? { ...value.transaction, toWalletId: value.transaction.toWalletId ?? undefined, categoryId: value.transaction.categoryId ?? undefined, description: value.transaction.description ?? undefined }
      : value.transaction;
    const parsed = createTransactionSchema.safeParse(transaction);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Dữ liệu cập nhật giao dịch không hợp lệ.");
    return { action, reason: typeof value.reason === "string" ? value.reason : "Đã thông báo", transaction: parsed.data } as const;
  }
  throw new AppError("VALIDATION_ERROR", "Loại yêu cầu thay đổi không hợp lệ.");
}

export async function approveTransactionChange(userId: string, workspaceId: string, changeRequestId: string, now = new Date()) {
  const reviewer = await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    const request = await tx.transactionChangeRequest.findFirst({
      where: { id: changeRequestId, status: "pending", transaction: { deletedAt: null, member: { workspaceId } } },
      include: { transaction: true },
    });
    if (!request) throw new AppError("NOT_FOUND", "Không tìm thấy yêu cầu thay đổi đang chờ duyệt.");
    const claimed = await tx.transactionChangeRequest.updateMany({ where: { id: request.id, status: "pending" }, data: { status: "approved", reviewerMemberId: reviewer.id, reviewedAt: now } });
    if (claimed.count !== 1) throw new AppError("CONFLICT", "Yêu cầu thay đổi đã được xử lý.");
    const proposed = readProposedData(request.proposedData);
    if (proposed.action === "delete") await softDelete(tx, request.transaction);
    if (proposed.action === "update") {
      await applyUpdate(tx, workspaceId, request.transaction, proposed.transaction, reviewer.workspace.timeZone, now);
    }
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: `transaction.${proposed.action}_approved`, entityType: "transaction", entityId: request.transactionId, metadata: { changeRequestId: request.id, reason: proposed.reason } } });
    return request;
  });
}

export async function rejectTransactionChange(userId: string, workspaceId: string, changeRequestId: string) {
  const reviewer = await requireWorkspaceMember(userId, workspaceId, true);
  const result = await prisma.transactionChangeRequest.updateMany({
    where: { id: changeRequestId, status: "pending", transaction: { deletedAt: null, member: { workspaceId } } },
    data: { status: "rejected", reviewerMemberId: reviewer.id, reviewedAt: new Date() },
  });
  if (result.count !== 1) throw new AppError("NOT_FOUND", "Không tìm thấy yêu cầu thay đổi đang chờ duyệt.");
  return result;
}
