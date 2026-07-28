import Decimal from "decimal.js";
import { Prisma, type Transaction } from "@/generated/prisma/client";
import { createTransactionSchema, type CreateTransactionInput } from "@/domain";
import { isAdminRole } from "@/domain/role-policy";
import { transactionTimingForDate, workflowStatusForAppliedDate, workflowStatusForCreation, type TransactionTiming } from "@/domain/transaction/policy";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { TRANSACTION_CSV_MAX_ROWS } from "@/lib/transaction-csv";
import { availableCategoryWhere } from "@/services/category-visibility";
import { requireWorkspaceMember } from "@/services/workspace-access";

type TransactionClient = Prisma.TransactionClient;
type ResolvedTransactionInput = CreateTransactionInput & { timing: TransactionTiming };
type ImportTransactionInput = CreateTransactionInput & { categoryName?: string };

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
  input: Pick<CreateTransactionInput, "walletId" | "toWalletId" | "categoryId">,
) {
  const walletIds = [input.walletId, input.toWalletId].filter((id): id is string => Boolean(id));
  const links = await tx.workspaceWallet.findMany({
    where: { workspaceId, walletId: { in: walletIds }, wallet: { status: "active", deletedAt: null } },
    select: { walletId: true },
  });
  if (new Set(links.map((link) => link.walletId)).size !== new Set(walletIds).size) {
    throw new AppError("WORKSPACE_ISOLATION_VIOLATION", "Ví không thuộc workspace này hoặc không còn hoạt động.");
  }
  if (input.categoryId) {
    const category = await tx.category.findFirst({ where: { id: input.categoryId, ...availableCategoryWhere(workspaceId) }, select: { id: true } });
    if (!category) throw new AppError("FORBIDDEN", "Danh mục không khả dụng trong workspace này.");
  }
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
  await requireTransactionResources(tx, workspaceId, input);
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
  await requireTransactionResources(tx, workspaceId, input);
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
  if (!record) throw new AppError("NOT_FOUND", "Không tìm thấy giao dịch trong workspace này.");
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
    await requireTransactionResources(tx, workspaceId, resolved);
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
      },
    });
    if (workflowStatus === "approved") await applyBalance(tx, record);
    await tx.auditLog.create({
      data: { workspaceId, actorUserId: userId, action: "transaction.created", entityType: "transaction", entityId: record.id, metadata: { timing: resolved.timing, workflowStatus, balanceApplied: workflowStatus === "approved" } },
    });
    return record;
  });
}

export async function importTransactions(
  userId: string,
  workspaceId: string,
  inputs: ImportTransactionInput[],
  now = new Date(),
) {
  if (inputs.length < 1 || inputs.length > TRANSACTION_CSV_MAX_ROWS) {
    throw new AppError("VALIDATION_ERROR", `Mỗi lần chỉ được import từ 1 đến ${TRANSACTION_CSV_MAX_ROWS.toLocaleString("vi-VN")} giao dịch.`);
  }

  const member = await requireWorkspaceMember(userId, workspaceId);
  const rows = inputs.map(({ categoryName, ...input }) => ({
    input: resolveTransactionInput(input, member.workspace.timeZone, now),
    categoryName,
    workflowStatus: workflowStatusForCreation(
      member.role.code,
      transactionTimingForDate(input.date, getBusinessDateInTimeZone(member.workspace.timeZone, now)),
    ),
  }));

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "WORKSPACES" WHERE "id" = CAST(${workspaceId} AS uuid) FOR UPDATE`);

    const walletIds = [...new Set(rows.flatMap(({ input }) => [input.walletId, input.toWalletId].filter((id): id is string => Boolean(id))))];
    const walletLinks = await tx.workspaceWallet.findMany({
      where: { workspaceId, walletId: { in: walletIds }, wallet: { status: "active", deletedAt: null } },
      select: { walletId: true },
    });
    if (walletLinks.length !== walletIds.length) {
      throw new AppError("WORKSPACE_ISOLATION_VIOLATION", "Một hoặc nhiều ví không thuộc workspace này hoặc không còn hoạt động.");
    }

    const existingCategories = await tx.category.findMany({
      where: { workspaceId, deletedAt: null },
      select: { id: true, name: true, code: true, type: true, status: true, sortOrder: true },
    });
    const activeCategoryIds = new Set(existingCategories.filter((category) => category.status === "active").map((category) => category.id));
    const categoryIds = [...new Set(rows.flatMap(({ input }) => input.categoryId ? [input.categoryId] : []))];
    if (categoryIds.some((categoryId) => !activeCategoryIds.has(categoryId))) {
      throw new AppError("FORBIDDEN", "Một hoặc nhiều danh mục không khả dụng trong workspace này.");
    }

    const normalizeCategoryName = (name: string) => name.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi-VN");
    const categoryIdByName = new Map<string, string | null>();
    for (const category of existingCategories.filter((item) => item.status === "active")) {
      const key = normalizeCategoryName(category.name);
      categoryIdByName.set(key, categoryIdByName.has(key) ? null : category.id);
    }

    const missingCategorySpecs = new Map<string, { name: string; type: "income" | "expense" }>();
    for (const row of rows) {
      if (row.input.categoryId || !row.categoryName) continue;
      const key = normalizeCategoryName(row.categoryName);
      if (categoryIdByName.get(key) === null) {
        throw new AppError("CONFLICT", `Workspace đang có nhiều danh mục trùng tên “${row.categoryName}”.`);
      }
      if (categoryIdByName.has(key)) continue;
      const type = row.input.type === "income" ? "income" : "expense";
      const existing = missingCategorySpecs.get(key);
      if (!existing) missingCategorySpecs.set(key, { name: row.categoryName.trim(), type });
      else if (existing.type !== type) existing.type = "expense";
    }

    const usedCodes = new Set(existingCategories.map((category) => category.code.toLocaleUpperCase("vi-VN")));
    const createCategoryCode = (name: string) => {
      const normalized = name
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replaceAll("đ", "d")
        .replaceAll("Đ", "D")
        .toLocaleUpperCase("vi-VN")
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 68) || "CSV_CATEGORY";
      let code = normalized;
      let suffix = 2;
      while (usedCodes.has(code)) {
        code = `${normalized.slice(0, 68 - String(suffix).length)}_${suffix}`;
        suffix += 1;
      }
      usedCodes.add(code);
      return code;
    };

    const startingSortOrder = Math.max(-1, ...existingCategories.map((category) => category.sortOrder)) + 1;
    const createdCategories = [...missingCategorySpecs.entries()].map(([key, category], index) => ({
      id: crypto.randomUUID(),
      workspaceId,
      name: category.name,
      code: createCategoryCode(category.name),
      color: category.type === "income" ? "#2F9E76" : "#E36D5B",
      type: category.type,
      icon: "tag",
      sortOrder: Math.min(10_000, startingSortOrder + index),
      key,
    }));
    for (let index = 0; index < createdCategories.length; index += 1_000) {
      const chunk = createdCategories.slice(index, index + 1_000);
      await tx.category.createMany({
        data: chunk.map((category) => ({
          id: category.id,
          workspaceId: category.workspaceId,
          name: category.name,
          code: category.code,
          color: category.color,
          type: category.type,
          icon: category.icon,
          sortOrder: category.sortOrder,
        })),
      });
    }
    for (const category of createdCategories) categoryIdByName.set(category.key, category.id);

    const preparedRows = rows.map((row) => {
      const categoryId = row.input.categoryId
        ?? (row.categoryName ? categoryIdByName.get(normalizeCategoryName(row.categoryName)) : undefined)
        ?? undefined;
      if (row.categoryName && !categoryId) {
        throw new AppError("VALIDATION_ERROR", `Không thể tạo hoặc ánh xạ danh mục “${row.categoryName}”.`);
      }
      return { ...row, categoryId };
    });

    let importedCount = 0;
    for (let index = 0; index < preparedRows.length; index += 1_000) {
      const chunk = preparedRows.slice(index, index + 1_000);
      const created = await tx.transaction.createMany({
        data: chunk.map(({ input, workflowStatus, categoryId }) => ({
          memberId: member.id,
          walletId: input.walletId,
          toWalletId: input.toWalletId ?? null,
          categoryId: categoryId ?? null,
          type: input.type,
          amount: input.amount,
          description: input.description ?? null,
          date: asDatabaseDate(input.date),
          workflowStatus,
        })),
      });
      importedCount += created.count;
    }

    const balanceChanges = new Map<string, Decimal>();
    const addBalanceChange = (walletId: string, amount: Decimal) => {
      balanceChanges.set(walletId, (balanceChanges.get(walletId) ?? new Decimal(0)).plus(amount));
    };

    for (const { input, workflowStatus } of preparedRows) {
      if (workflowStatus !== "approved") continue;
      if (input.type === "income") addBalanceChange(input.walletId, input.amount);
      if (input.type === "expense") addBalanceChange(input.walletId, input.amount.negated());
      if (input.type === "transfer" && input.toWalletId) {
        addBalanceChange(input.walletId, input.amount.negated());
        addBalanceChange(input.toWalletId, input.amount);
      }
    }

    for (const [walletId, change] of balanceChanges) {
      if (change.isZero()) continue;
      await tx.wallet.update({
        where: { id: walletId },
        data: { currentBalance: change.isPositive() ? { increment: change } : { decrement: change.abs() } },
      });
    }

    const statusCounts = preparedRows.reduce((counts, row) => {
      counts[row.workflowStatus] += 1;
      return counts;
    }, { approved: 0, pending: 0, scheduled: 0, rejected: 0 });

    if (createdCategories.length) {
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "category.csv_imported",
          entityType: "CATEGORY",
          metadata: {
            createdCategoryCount: createdCategories.length,
            categoryNames: createdCategories.slice(0, 100).map((category) => category.name),
          },
        },
      });
    }

    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "transaction.csv_imported",
        entityType: "transaction",
        metadata: { importedCount, createdCategoryCount: createdCategories.length, ...statusCounts },
      },
    });

    return { importedCount, createdCategoryCount: createdCategories.length, ...statusCounts };
  }, { maxWait: 10_000, timeout: 120_000 });
}

export async function approveTransaction(userId: string, workspaceId: string, transactionId: string) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    await lockTransaction(tx, transactionId);
    const record = await tx.transaction.findFirst({
      where: { id: transactionId, workflowStatus: { in: ["pending", "scheduled"] }, deletedAt: null, member: { workspaceId, status: "active", deletedAt: null } },
    });
    if (!record) throw new AppError("NOT_FOUND", "Không tìm thấy giao dịch đang chờ hoặc đã lên lịch.");
    const claimed = await tx.transaction.updateMany({
      where: { id: record.id, workflowStatus: record.workflowStatus, deletedAt: null },
      data: { workflowStatus: "approved" },
    });
    if (claimed.count !== 1) throw new AppError("CONFLICT", "Giao dịch đã được xử lý.");
    await applyBalance(tx, record);
    await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "transaction.approved", entityType: "transaction", entityId: record.id, metadata: { previousStatus: record.workflowStatus } } });
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
      const claimed = await tx.transaction.updateMany({ where: { id: current.id, workflowStatus: "scheduled", deletedAt: null }, data: { workflowStatus: "approved" } });
      if (claimed.count !== 1) continue;
      await applyBalance(tx, current);
      await tx.auditLog.create({ data: { workspaceId, action: "transaction.scheduled_activated", entityType: "transaction", entityId: current.id, metadata: { dueDate: asBusinessDate(current.date) } } });
      activated += 1;
    }
    return activated;
  });
}

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
