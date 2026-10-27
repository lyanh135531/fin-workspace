import Decimal from "decimal.js";
import { Prisma } from "@/generated/prisma/client";
import type { RecurringTransactionInput } from "@/domain";
import { isAdminRole } from "@/domain/role-policy";
import {
  firstExecutionOnOrAfter,
  nextMonthlyExecution,
} from "@/domain/recurring-transaction/schedule-date";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { createRequestId, getPublicError, reportServerError } from "@/lib/server-error";
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

function firstExecutionInRange(
  input: Pick<RecurringTransactionInput, "startDate" | "endDate">,
  dayOfMonth = dayOfMonthFromStartDate(input.startDate),
) {
  const firstExecutionDate = firstExecutionOnOrAfter(
    input.startDate,
    dayOfMonth,
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

async function requireRecurringTransactionResources(
  tx: TransactionClient,
  workspaceId: string,
  input: Parameters<typeof requireTransactionResources>[2],
) {
  if (typeof tx.workspaceWallet?.findFirst === "function") {
    const link = await tx.workspaceWallet.findFirst({
      where: { workspaceId, walletId: input.walletId, wallet: { status: "active", deletedAt: null } },
      select: { wallet: { select: { kind: true } } },
    });
    if (link?.wallet?.kind === "credit_card") {
      throw new AppError("VALIDATION_ERROR", "Giao dịch định kỳ chỉ áp dụng cho ví tài sản.");
    }
  }
  try {
    const resources = await requireTransactionResources(tx, workspaceId, input);
    if (resources.walletKind === "credit_card") {
      throw new AppError("VALIDATION_ERROR", "Giao dịch định kỳ chỉ áp dụng cho ví tài sản.");
    }
    return resources;
  } catch (error) {
    if (error instanceof AppError && error.message.includes("Thẻ thiếu cấu hình")) {
      throw new AppError("VALIDATION_ERROR", "Giao dịch định kỳ chỉ áp dụng cho ví tài sản.");
    }
    throw error;
  }
}

export async function createRecurringTransaction(
  userId: string,
  workspaceId: string,
  input: RecurringTransactionInput,
) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  const isAdmin = isAdminRole(member.role.code);
  const nextExecutionDate = firstExecutionInRange(input);
  const dayOfMonth = dayOfMonthFromStartDate(input.startDate);
  const now = new Date();

  const created = await prisma.$transaction(async (tx) => {
    await requireRecurringTransactionResources(tx, workspaceId, input);
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
        status: isAdmin ? "active" : "deactive",
        approvalStatus: isAdmin ? "approved" : "pending",
        reviewedByMemberId: isAdmin ? member.id : null,
        reviewedAt: isAdmin ? now : null,
        approvedAt: isAdmin ? now : null,
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
          approvalStatus: isAdmin ? "approved" : "pending",
        },
      },
    });
    return record;
  });
  await processDueRecurringTransactions(workspaceId, now);
  return created;
}

async function resolveNextExecutionCandidate(
  tx: TransactionClient,
  current: { id: string; nextExecutionDate: Date; startDate: Date },
  candidateDate: string,
  dayOfMonth: number,
  _today: string,
  startOrDayChanged = false,
) {
  if (!startOrDayChanged && asBusinessDate(current.nextExecutionDate) > candidateDate) {
    return asBusinessDate(current.nextExecutionDate);
  }
  const existing = await tx.transaction?.findFirst?.({
    where: {
      recurringTransactionId: current.id,
      recurringPeriod: candidateDate.slice(0, 7),
      deletedAt: null,
    },
    select: { id: true },
  });
  if (existing) {
    return nextMonthlyExecution(candidateDate, dayOfMonth);
  }
  return candidateDate;
}

export async function updateRecurringTransaction(
  userId: string,
  workspaceId: string,
  recurringTransactionId: string,
  input: RecurringTransactionInput,
  now = new Date(),
) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  const isAdmin = isAdminRole(member.role.code);
  const today = getBusinessDateInTimeZone(member.workspace.timeZone, now);

  const updated = await prisma.$transaction(async (tx) => {
    const current = await findManagedRecurringTransaction(tx, workspaceId, recurringTransactionId);
    if (!isAdmin) {
      if (current.createdByMemberId !== member.id) {
        throw new AppError("FORBIDDEN", "Bạn chỉ có thể chỉnh sửa lịch do mình tạo.");
      }
      if (current.completedAt) {
        throw new AppError("CONFLICT", "Lịch đã kết thúc và không thể chỉnh sửa.");
      }
      if (current.approvalStatus === "approved" && current.status === "active") {
        throw new AppError("CONFLICT", "Hãy tạm dừng lịch trước khi chỉnh sửa.");
      }
    }
    await requireRecurringTransactionResources(tx, workspaceId, input);
    const dayOfMonth = dayOfMonthFromStartDate(input.startDate);
    firstExecutionInRange(input, dayOfMonth);
    const startOrDayChanged =
      current.dayOfMonth !== dayOfMonth ||
      asBusinessDate(current.startDate) !== input.startDate;
    const endDateChanged =
      (current.endDate ? asBusinessDate(current.endDate) : undefined) !==
      input.endDate;
    const timingChanged = startOrDayChanged || endDateChanged;
    let nextExecutionDate = current.nextExecutionDate;
    if (startOrDayChanged) {
      const effectiveStart =
        current.approvalStatus === "approved" && input.startDate < today
          ? today
          : input.startDate;
      const rawCandidate = firstExecutionInRange(
        { startDate: effectiveStart, endDate: input.endDate },
        dayOfMonth,
      );
      const resolvedCandidate = await resolveNextExecutionCandidate(
        tx,
        current,
        rawCandidate,
        dayOfMonth,
        today,
        true,
      );
      nextExecutionDate = asDatabaseDate(resolvedCandidate);
    } else if (asBusinessDate(current.nextExecutionDate) <= today) {
      const effectiveStart =
        current.approvalStatus === "approved" && input.startDate < today
          ? today
          : input.startDate;
      const rawCandidate = firstExecutionOnOrAfter(effectiveStart, dayOfMonth);
      const resolvedCandidate = await resolveNextExecutionCandidate(
        tx,
        current,
        rawCandidate,
        dayOfMonth,
        today,
        false,
      );
      nextExecutionDate = asDatabaseDate(resolvedCandidate);
    }
    const completedByEndDate = Boolean(
      input.endDate && asBusinessDate(nextExecutionDate) > input.endDate,
    );
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
        completedAt: completedByEndDate
          ? now
          : timingChanged
            ? null
            : current.completedAt,
        lastError: null,
        ...(completedByEndDate ? { status: "deactive" as const } : {}),
        ...(!isAdmin
          ? {
              status: "deactive" as const,
              approvalStatus: "pending" as const,
              reviewedByMemberId: null,
              reviewedAt: null,
            }
          : {}),
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
  await processDueRecurringTransactions(workspaceId, now);
  return updated;
}

export async function setRecurringTransactionStatus(
  userId: string,
  workspaceId: string,
  recurringTransactionId: string,
  status: "active" | "deactive",
  now = new Date(),
) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  const isAdmin = isAdminRole(member.role.code);
  const today = getBusinessDateInTimeZone(member.workspace.timeZone, now);
  const updated = await prisma.$transaction(async (tx) => {
    const current = await findManagedRecurringTransaction(tx, workspaceId, recurringTransactionId);
    if (!isAdmin && current.createdByMemberId !== member.id) {
      throw new AppError("FORBIDDEN", "Bạn chỉ có thể thay đổi lịch do mình tạo.");
    }
    if (!isAdmin && status === "deactive") {
      if (current.status !== "active" || current.approvalStatus !== "approved") {
        throw new AppError("CONFLICT", "Lịch này hiện không hoạt động.");
      }
      const record = await tx.recurringTransaction.update({
        where: { id: current.id },
        data: { status: "deactive" },
      });
      await tx.auditLog.create({
        data: { workspaceId, actorUserId: userId, action: "recurring_transaction.paused", entityType: "recurring_transaction", entityId: current.id },
      });
      return record;
    }
    if (!isAdmin && status === "active") {
      if (current.status !== "deactive" || current.approvalStatus !== "approved") {
        throw new AppError("CONFLICT", "Lịch chưa sẵn sàng để gửi yêu cầu kích hoạt lại.");
      }
      const record = await tx.recurringTransaction.update({
        where: { id: current.id },
        data: { approvalStatus: "pending", reviewedByMemberId: null, reviewedAt: null },
      });
      await tx.auditLog.create({
        data: { workspaceId, actorUserId: userId, action: "recurring_transaction.reactivation_requested", entityType: "recurring_transaction", entityId: current.id },
      });
      return record;
    }
    if (status === "active" && current.approvalStatus !== "approved") {
      throw new AppError("CONFLICT", "Lịch phải được duyệt trước khi kích hoạt.");
    }
    if (status === "active") {
      await requireRecurringTransactionResources(tx, workspaceId, current);
    }
    const effectiveStart = asBusinessDate(current.startDate) > today
      ? asBusinessDate(current.startDate)
      : today;
    const rawBusinessDate = firstExecutionOnOrAfter(effectiveStart, current.dayOfMonth);
    const nextBusinessDate = status === "active"
      ? await resolveNextExecutionCandidate(tx, current, rawBusinessDate, current.dayOfMonth, today, false)
      : rawBusinessDate;
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
  if (status === "active") {
    await processDueRecurringTransactions(workspaceId, now);
  }
  return updated;
}

export async function deleteRecurringTransaction(
  userId: string,
  workspaceId: string,
  recurringTransactionId: string,
) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  const isAdmin = isAdminRole(member.role.code);
  return prisma.$transaction(async (tx) => {
    const current = await findManagedRecurringTransaction(tx, workspaceId, recurringTransactionId);
    if (!isAdmin) {
      if (current.createdByMemberId !== member.id) {
        throw new AppError("FORBIDDEN", "Bạn chỉ có thể xóa lịch do mình tạo.");
      }
      if (current.approvedAt || !["pending", "rejected"].includes(current.approvalStatus)) {
        throw new AppError("FORBIDDEN", "Lịch đã từng được duyệt chỉ có thể tạm dừng.");
      }
    }
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

export async function reviewRecurringTransaction(
  userId: string,
  workspaceId: string,
  recurringTransactionId: string,
  approve: boolean,
  now = new Date(),
) {
  const reviewer = await requireWorkspaceMember(userId, workspaceId, true);
  const today = getBusinessDateInTimeZone(reviewer.workspace.timeZone, now);
  const reviewed = await prisma.$transaction(async (tx) => {
    const current = await findManagedRecurringTransaction(tx, workspaceId, recurringTransactionId);
    if (current.approvalStatus !== "pending") {
      throw new AppError("CONFLICT", "Yêu cầu lịch định kỳ đã được xử lý.");
    }
    if (!approve) {
      const record = await tx.recurringTransaction.update({
        where: { id: current.id },
        data: {
          approvalStatus: "rejected",
          status: "deactive",
          reviewedByMemberId: reviewer.id,
          reviewedAt: now,
        },
      });
      await tx.auditLog.create({
        data: { workspaceId, actorUserId: userId, action: "recurring_transaction.rejected", entityType: "recurring_transaction", entityId: current.id },
      });
      return record;
    }

    await requireRecurringTransactionResources(tx, workspaceId, current);
    const effectiveStart = asBusinessDate(current.startDate) > today
      ? asBusinessDate(current.startDate)
      : today;
    const rawCandidate = firstExecutionOnOrAfter(effectiveStart, current.dayOfMonth);
    const nextExecutionDate = await resolveNextExecutionCandidate(
      tx,
      current,
      rawCandidate,
      current.dayOfMonth,
      today,
      false,
    );
    if (current.endDate && nextExecutionDate > asBusinessDate(current.endDate)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Khoảng hiệu lực đã kết thúc. Thành viên cần cập nhật lịch trước khi duyệt.",
      );
    }
    const record = await tx.recurringTransaction.update({
      where: { id: current.id },
      data: {
        approvalStatus: "approved",
        status: "active",
        nextExecutionDate: asDatabaseDate(nextExecutionDate),
        reviewedByMemberId: reviewer.id,
        reviewedAt: now,
        approvedAt: current.approvedAt ?? now,
        completedAt: null,
        lastError: null,
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "recurring_transaction.approved",
        entityType: "recurring_transaction",
        entityId: current.id,
        metadata: { nextExecutionDate },
      },
    });
    return record;
  });
  if (approve) {
    await processDueRecurringTransactions(workspaceId, now);
  }
  return reviewed;
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
          approvalStatus: "approved",
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
            metadata: { recurringTransactionId: record.id, period, dueDate, jarCode: transaction.jarCode },
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
    const requestId = createRequestId();
    const publicError = getPublicError(error, "Không thể tạo giao dịch đến hạn.");
    if (publicError.shouldLog) {
      reportServerError("recurring_transaction.occurrence_failed", requestId, error, {
        recurringTransactionId,
        workspaceId,
      });
    }
    const message = publicError.message;
    await prisma.$transaction(async (tx) => {
      await lockRecurringTransaction(tx, recurringTransactionId);
      const current = await tx.recurringTransaction.findFirst({
        where: {
          id: recurringTransactionId,
          workspaceId,
          status: "active",
          approvalStatus: "approved",
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
            errorCode: publicError.code,
            requestId,
            message: message.slice(0, 500),
          },
        },
      });
    });
    return { kind: "failed" as const };
  }
}

export async function runRecurringTransactionNow(
  userId: string,
  workspaceId: string,
  recurringTransactionId: string,
  now = new Date(),
) {
  const member = await requireWorkspaceMember(userId, workspaceId);
  const isAdmin = isAdminRole(member.role.code);
  return prisma.$transaction(async (tx) => {
    const current = await findManagedRecurringTransaction(tx, workspaceId, recurringTransactionId);
    if (!isAdmin && current.createdByMemberId !== member.id) {
      throw new AppError("FORBIDDEN", "Bạn chỉ có thể thực hiện lịch do mình tạo.");
    }
    if (current.status !== "active" || current.approvalStatus !== "approved" || current.completedAt) {
      throw new AppError("CONFLICT", "Chỉ lịch định kỳ đang bật và đã được duyệt mới có thể thực hiện ngay.");
    }
    await requireRecurringTransactionResources(tx, workspaceId, current);
    const today = getBusinessDateInTimeZone(member.workspace.timeZone, now);
    const currentMonth = today.slice(0, 7);
    const dueDate = asBusinessDate(current.nextExecutionDate);
    if (current.endDate && dueDate > asBusinessDate(current.endDate)) {
      throw new AppError("CONFLICT", "Khoảng hiệu lực của lịch định kỳ đã kết thúc.");
    }
    const period = dueDate.slice(0, 7);
    if (period > currentMonth) {
      throw new AppError(
        "CONFLICT",
        "Kỳ định kỳ của tháng hiện tại đã hoàn tất; chưa thể thực hiện trước cho các tháng tương lai.",
      );
    }
    const executionDate = dueDate > today ? today : dueDate;
    const nextExecutionDate = nextMonthlyExecution(dueDate, current.dayOfMonth);
    const existing = await tx.transaction?.findUnique?.({
      where: {
        recurringTransactionId_recurringPeriod: {
          recurringTransactionId: current.id,
          recurringPeriod: period,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new AppError("CONFLICT", "Giao dịch định kỳ của kỳ này đã được thực hiện trước đó.");
    }
    const transaction = await createApprovedTransactionInTransaction(
      tx,
      workspaceId,
      current.createdByMemberId,
      transactionInput(current, executionDate),
      { id: current.id, period },
    );
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "recurring_transaction.posted",
        entityType: "transaction",
        entityId: transaction.id,
        metadata: {
          recurringTransactionId: current.id,
          period,
          dueDate: executionDate,
          jarCode: transaction.jarCode,
          manualRun: true,
        },
      },
    });
    const completed = Boolean(current.endDate && nextExecutionDate > asBusinessDate(current.endDate));
    const record = await tx.recurringTransaction.update({
      where: { id: current.id },
      data: {
        nextExecutionDate: asDatabaseDate(nextExecutionDate),
        status: completed ? "deactive" : "active",
        completedAt: completed ? now : null,
        lastError: null,
      },
    });
    if (completed) {
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: "recurring_transaction.completed",
          entityType: "recurring_transaction",
          entityId: current.id,
          metadata: { endDate: asBusinessDate(current.endDate!), lastPeriod: period },
        },
      });
    }
    return record;
  });
}

export async function processDueRecurringTransactions(
  workspaceOrInput: string | { workspaceId: string; now?: Date; limit?: number },
  now = new Date(),
  limit = 500,
) {
  const workspaceId = typeof workspaceOrInput === "string" ? workspaceOrInput : workspaceOrInput.workspaceId;
  const effectiveNow = typeof workspaceOrInput === "string" ? now : (workspaceOrInput.now ?? now);
  const effectiveLimit = typeof workspaceOrInput === "string" ? limit : (workspaceOrInput.limit ?? limit);
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, status: "active", deletedAt: null },
    select: { timeZone: true },
  });
  if (!workspace) return { posted: 0, failed: 0, advanced: 0, completed: 0, handled: 0 };
  const today = getBusinessDateInTimeZone(workspace.timeZone, effectiveNow);
  await prisma.recurringTransaction.updateMany({
    where: {
      workspaceId,
      status: "deactive",
      deletedAt: null,
      completedAt: null,
      lastError: null,
      endDate: { lt: asDatabaseDate(today) },
    },
    data: { completedAt: effectiveNow },
  });
  const result = { posted: 0, failed: 0, advanced: 0, completed: 0, handled: 0 };

  for (let attempted = 0; attempted < effectiveLimit; attempted += 1) {
    const due = await prisma.recurringTransaction.findFirst({
      where: {
        workspaceId,
        status: "active",
        approvalStatus: "approved",
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
