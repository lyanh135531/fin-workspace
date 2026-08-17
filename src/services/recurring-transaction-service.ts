import Decimal from "decimal.js";
import { Prisma } from "@/generated/prisma/client";
import type { RecurringTransactionInput } from "@/domain";
import {
  firstExecutionOnOrAfter,
  nextMonthlyExecution,
} from "@/domain/recurring-transaction/schedule-date";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/services/workspace-access";
import {
  createApprovedTransactionInTransaction,
  requireTransactionResources,
} from "@/services/transaction-service";

type TransactionClient = Prisma.TransactionClient;

function asDatabaseDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function asBusinessDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dayOfMonthFromStartDate(startDate: string) {
  return Number(startDate.slice(8, 10));
}

function firstExecutionInRange(input: Pick<RecurringTransactionInput, "startDate" | "endDate">) {
  const firstExecutionDate = firstExecutionOnOrAfter(
    input.startDate,
    dayOfMonthFromStartDate(input.startDate),
  );
  if (input.endDate && firstExecutionDate > input.endDate) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Khoảng hiệu lực không chứa ngày thực hiện nào. Hãy điều chỉnh ngày hoặc chu kỳ.",
    );
  }
  return firstExecutionDate;
}

async function lockRecurringTransaction(tx: TransactionClient, recurringTransactionId: string) {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "RECURRING_TRANSACTION" WHERE "id" = CAST(${recurringTransactionId} AS uuid) FOR UPDATE`,
  );
}

async function findManagedRecurringTransaction(
  tx: TransactionClient,
  workspaceId: string,
  recurringTransactionId: string,
) {
  await lockRecurringTransaction(tx, recurringTransactionId);
  const record = await tx.recurringTransaction.findFirst({
    where: { id: recurringTransactionId, workspaceId, deletedAt: null },
  });
  if (!record) throw new AppError("NOT_FOUND", "Không tìm thấy giao dịch định kỳ trong nhóm này.");
  return record;
}

function transactionInput(record: {
  walletId: string;
  toWalletId: string | null;
  categoryId: string | null;
  type: "income" | "expense" | "transfer";
  amount: { toString(): string };
  description: string | null;
}, date: string) {
  return {
    walletId: record.walletId,
    toWalletId: record.toWalletId ?? undefined,
    categoryId: record.categoryId ?? undefined,
    type: record.type,
    amount: new Decimal(record.amount.toString()),
    description: record.description ?? undefined,
    date,
  };
}

export async function createRecurringTransaction(
  userId: string,
  workspaceId: string,
  input: RecurringTransactionInput,
) {
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  const nextExecutionDate = firstExecutionInRange(input);
  const dayOfMonth = dayOfMonthFromStartDate(input.startDate);

  return prisma.$transaction(async (tx) => {
    await requireTransactionResources(tx, workspaceId, input);
    const record = await tx.recurringTransaction.create({
      data: {
        workspaceId,
        createdByMemberId: member.id,
        walletId: input.walletId,
        toWalletId: input.toWalletId ?? null,
        categoryId: input.categoryId ?? null,
        type: input.type,
        amount: input.amount,
        description: input.description ?? null,
        dayOfMonth,
        startDate: asDatabaseDate(input.startDate),
        endDate: input.endDate ? asDatabaseDate(input.endDate) : null,
        nextExecutionDate: asDatabaseDate(nextExecutionDate),
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "recurring_transaction.created",
        entityType: "recurring_transaction",
        entityId: record.id,
        metadata: {
          dayOfMonth,
          startDate: input.startDate,
          endDate: input.endDate ?? null,
          nextExecutionDate,
        },
      },
    });
    return record;
  });
}

export async function updateRecurringTransaction(
  userId: string,
  workspaceId: string,
  recurringTransactionId: string,
  input: RecurringTransactionInput,
  now = new Date(),
) {
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  const today = getBusinessDateInTimeZone(member.workspace.timeZone, now);

  return prisma.$transaction(async (tx) => {
    const current = await findManagedRecurringTransaction(tx, workspaceId, recurringTransactionId);
    await requireTransactionResources(tx, workspaceId, input);
    const dayOfMonth = dayOfMonthFromStartDate(input.startDate);
    const timingChanged = current.dayOfMonth !== dayOfMonth
      || asBusinessDate(current.startDate) !== input.startDate
      || (current.endDate ? asBusinessDate(current.endDate) : undefined) !== input.endDate;
    const nextExecutionDate = timingChanged
      ? asDatabaseDate(firstExecutionInRange(input))
      : current.nextExecutionDate;
    const record = await tx.recurringTransaction.update({
      where: { id: current.id },
      data: {
        walletId: input.walletId,
        toWalletId: input.toWalletId ?? null,
        categoryId: input.categoryId ?? null,
        type: input.type,
        amount: input.amount,
        description: input.description ?? null,
        dayOfMonth,
        startDate: asDatabaseDate(input.startDate),
        endDate: input.endDate ? asDatabaseDate(input.endDate) : null,
        nextExecutionDate,
        completedAt: timingChanged ? null : current.completedAt,
        lastError: null,
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "recurring_transaction.updated",
        entityType: "recurring_transaction",
        entityId: current.id,
        metadata: {
          dayOfMonth,
          startDate: input.startDate,
          endDate: input.endDate ?? null,
          nextExecutionDate: asBusinessDate(nextExecutionDate),
          timingChanged,
          updatedOn: today,
        },
      },
    });
    return record;
  });
}

export async function setRecurringTransactionStatus(
  userId: string,
  workspaceId: string,
  recurringTransactionId: string,
  status: "active" | "deactive",
  now = new Date(),
) {
  const member = await requireWorkspaceMember(userId, workspaceId, true);
  const today = getBusinessDateInTimeZone(member.workspace.timeZone, now);
  return prisma.$transaction(async (tx) => {
    const current = await findManagedRecurringTransaction(tx, workspaceId, recurringTransactionId);
    const effectiveStart = asBusinessDate(current.startDate) > today
      ? asBusinessDate(current.startDate)
      : today;
    const nextBusinessDate = firstExecutionOnOrAfter(effectiveStart, current.dayOfMonth);
    if (status === "active" && current.endDate && nextBusinessDate > asBusinessDate(current.endDate)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Khoảng hiệu lực đã kết thúc. Hãy cập nhật ngày kết thúc trước khi kích hoạt lại.",
      );
    }
    const nextExecutionDate = status === "active"
      ? asDatabaseDate(nextBusinessDate)
      : current.nextExecutionDate;
    const record = await tx.recurringTransaction.update({
      where: { id: current.id },
      data: {
        status,
        nextExecutionDate,
        completedAt: status === "active" ? null : current.completedAt,
        lastError: status === "active" ? null : current.lastError,
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: status === "active" ? "recurring_transaction.activated" : "recurring_transaction.paused",
        entityType: "recurring_transaction",
        entityId: current.id,
        metadata: { nextExecutionDate: asBusinessDate(nextExecutionDate) },
      },
    });
    return record;
  });
}

export async function deleteRecurringTransaction(
  userId: string,
  workspaceId: string,
  recurringTransactionId: string,
) {
  await requireWorkspaceMember(userId, workspaceId, true);
  return prisma.$transaction(async (tx) => {
    const current = await findManagedRecurringTransaction(tx, workspaceId, recurringTransactionId);
    const record = await tx.recurringTransaction.update({
      where: { id: current.id },
      data: { status: "deactive", deletedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "recurring_transaction.deleted",
        entityType: "recurring_transaction",
        entityId: current.id,
      },
    });
    return record;
  });
}

async function processOneDueOccurrence(workspaceId: string, recurringTransactionId: string, today: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      await lockRecurringTransaction(tx, recurringTransactionId);
      const record = await tx.recurringTransaction.findFirst({
        where: {
          id: recurringTransactionId,
          workspaceId,
          status: "active",
          deletedAt: null,
          nextExecutionDate: { lte: asDatabaseDate(today) },
        },
      });
      if (!record) return { kind: "skipped" as const };

      const dueDate = asBusinessDate(record.nextExecutionDate);
      if (record.endDate && dueDate > asBusinessDate(record.endDate)) {
        await tx.recurringTransaction.update({
          where: { id: record.id },
          data: { status: "deactive", completedAt: new Date(), lastError: null },
        });
        await tx.auditLog.create({
          data: {
            workspaceId,
            action: "recurring_transaction.completed",
            entityType: "recurring_transaction",
            entityId: record.id,
            metadata: { endDate: asBusinessDate(record.endDate) },
          },
        });
        return { kind: "completed" as const };
      }
      const period = dueDate.slice(0, 7);
      const nextExecutionDate = nextMonthlyExecution(dueDate, record.dayOfMonth);
      const existing = await tx.transaction.findUnique({
        where: {
          recurringTransactionId_recurringPeriod: {
            recurringTransactionId: record.id,
            recurringPeriod: period,
          },
        },
        select: { id: true },
      });
      if (!existing) {
        const transaction = await createApprovedTransactionInTransaction(
          tx,
          workspaceId,
          record.createdByMemberId,
          transactionInput(record, dueDate),
          { id: record.id, period },
        );
        await tx.auditLog.create({
          data: {
            workspaceId,
            action: "recurring_transaction.posted",
            entityType: "transaction",
            entityId: transaction.id,
            metadata: { recurringTransactionId: record.id, period, dueDate },
          },
        });
      }
      const completed = Boolean(record.endDate && nextExecutionDate > asBusinessDate(record.endDate));
      await tx.recurringTransaction.update({
        where: { id: record.id },
        data: {
          nextExecutionDate: asDatabaseDate(nextExecutionDate),
          status: completed ? "deactive" : "active",
          completedAt: completed ? new Date() : null,
          lastError: null,
        },
      });
      if (completed) {
        await tx.auditLog.create({
          data: {
            workspaceId,
            action: "recurring_transaction.completed",
            entityType: "recurring_transaction",
            entityId: record.id,
            metadata: { endDate: asBusinessDate(record.endDate!), lastPeriod: period },
          },
        });
      }
      return {
        kind: existing ? "advanced" as const : "posted" as const,
        completed,
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể tạo giao dịch đến hạn.";
    await prisma.$transaction(async (tx) => {
      await lockRecurringTransaction(tx, recurringTransactionId);
      const current = await tx.recurringTransaction.findFirst({
        where: {
          id: recurringTransactionId,
          workspaceId,
          status: "active",
          deletedAt: null,
          nextExecutionDate: { lte: asDatabaseDate(today) },
        },
      });
      if (!current) return;
      await tx.recurringTransaction.update({
        where: { id: current.id },
        data: { status: "deactive", lastError: message.slice(0, 2_000) },
      });
      await tx.auditLog.create({
        data: {
          workspaceId,
          action: "recurring_transaction.failed",
          entityType: "recurring_transaction",
          entityId: current.id,
          metadata: {
            dueDate: asBusinessDate(current.nextExecutionDate),
            message: message.slice(0, 500),
          },
        },
      });
    });
    return { kind: "failed" as const };
  }
}

export async function processDueRecurringTransactions(
  workspaceId: string,
  now = new Date(),
  limit = 500,
) {
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, status: "active", deletedAt: null },
    select: { timeZone: true },
  });
  if (!workspace) return { posted: 0, failed: 0, advanced: 0, completed: 0, handled: 0 };
  const today = getBusinessDateInTimeZone(workspace.timeZone, now);
  await prisma.recurringTransaction.updateMany({
    where: {
      workspaceId,
      status: "deactive",
      deletedAt: null,
      completedAt: null,
      lastError: null,
      endDate: { lt: asDatabaseDate(today) },
    },
    data: { completedAt: now },
  });
  const result = { posted: 0, failed: 0, advanced: 0, completed: 0, handled: 0 };

  for (let attempted = 0; attempted < limit; attempted += 1) {
    const due = await prisma.recurringTransaction.findFirst({
      where: {
        workspaceId,
        status: "active",
        deletedAt: null,
        nextExecutionDate: { lte: asDatabaseDate(today) },
      },
      orderBy: [{ nextExecutionDate: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (!due) break;
    const occurrence = await processOneDueOccurrence(workspaceId, due.id, today);
    if (occurrence.kind !== "skipped") result.handled += 1;
    if (occurrence.kind === "posted") result.posted += 1;
    if (occurrence.kind === "failed") result.failed += 1;
    if (occurrence.kind === "advanced") result.advanced += 1;
    if (occurrence.kind === "completed" || ("completed" in occurrence && occurrence.completed)) {
      result.completed += 1;
    }
  }
  return result;
}

export async function processAllDueRecurringTransactions(now = new Date(), limit = 500) {
  const workspaces = await prisma.workspace.findMany({
    where: { status: "active", deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const total = { posted: 0, failed: 0, advanced: 0, completed: 0, handled: 0 };
  let remaining = limit;
  for (const workspace of workspaces) {
    if (remaining <= 0) break;
    const result = await processDueRecurringTransactions(workspace.id, now, remaining);
    total.posted += result.posted;
    total.failed += result.failed;
    total.advanced += result.advanced;
    total.completed += result.completed;
    total.handled += result.handled;
    remaining -= result.handled;
  }
  return total;
}
