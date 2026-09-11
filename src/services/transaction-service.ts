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
import { assertCardBalanceReconciled, normalizeApprovedRefundAllocations, syncCreditCardObligationsForTransaction } from "@/services/credit-card-ledger";
import { activateInstallmentPlanInTransaction } from "@/services/credit-card-installment-service";
import { completePaidInstallmentPlansInTransaction, statementPaymentDetails } from "@/services/credit-card-statement-service";

type TransactionClient = Prisma.TransactionClient;
type ResolvedTransactionInput = CreateTransactionInput & { timing: TransactionTiming };
type TransactionResourceInput = {
  transactionId?: string;
  walletId: string;
  toWalletId?: string | null;
  categoryId?: string | null;
  type: "income" | "expense" | "transfer";
  amount?: Decimal.Value;
  allocations?: Array<{ walletId: string; amount: Decimal }>;
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
  if (typeof tx.$queryRaw === "function") {
    for (const walletId of [...new Set(walletIds)].sort()) {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "WALLETS" WHERE "id" = CAST(${walletId} AS uuid) FOR UPDATE`,
      );
    }
  }
  const links = await tx.workspaceWallet.findMany({
    where: { workspaceId, walletId: { in: walletIds }, wallet: { status: "active", deletedAt: null } },
    select: {
      walletId: true,
      wallet: {
        select: {
          kind: true,
          currentBalance: true,
          creditCardProfile: { select: { creditLimit: true, defaultFundingWalletId: true } },
        },
      },
    },
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
  const sourceLink = links.find((link) => link.walletId === input.walletId);
  const destinationLink = links.find((link) => link.walletId === input.toWalletId);
  if (!sourceLink) throw new AppError("WORKSPACE_ISOLATION_VIOLATION", "Không tìm thấy ví thực hiện trong nhóm này.");
  // Older test doubles and pre-migration records have no explicit kind; asset is the migration default.
  const sourceKind = sourceLink.wallet?.kind ?? "asset";
  const destinationKind = destinationLink?.wallet?.kind ?? "asset";
  if (input.type === "transfer" && (sourceKind !== "asset" || destinationKind !== "asset")) {
    throw new AppError("VALIDATION_ERROR", "Chuyển tiền thông thường chỉ áp dụng giữa các ví tài sản.");
  }
  if (input.type === "income" && sourceKind === "credit_card") {
    throw new AppError("VALIDATION_ERROR", "Hãy ghi nhận hoàn tiền từ trang Thẻ tín dụng.");
  }
  if (input.type === "expense" && sourceKind === "credit_card") {
    const profile = sourceLink.wallet.creditCardProfile;
    if (!profile) throw new AppError("CONFLICT", "Thẻ thiếu cấu hình hạn mức hoặc ví thanh toán mặc định.");
    const allocations = input.allocations?.length
      ? input.allocations
      : input.amount === undefined
        ? []
        : [{ walletId: profile.defaultFundingWalletId, amount: new Decimal(input.amount) }];
    if (!allocations.length) throw new AppError("VALIDATION_ERROR", "Cần phân bổ nguồn trả cho giao dịch thẻ.");
    const allocationIds = allocations.map((allocation) => allocation.walletId);
    const allocationLinks = await tx.workspaceWallet.findMany({
      where: {
        workspaceId,
        walletId: { in: allocationIds },
        wallet: { kind: "asset", status: "active", deletedAt: null },
      },
      select: { walletId: true },
    });
    if (new Set(allocationLinks.map((link) => link.walletId)).size !== new Set(allocationIds).size) {
      throw new AppError("WORKSPACE_ISOLATION_VIOLATION", "Nguồn trả thẻ phải là ví tài sản đang hoạt động trong nhóm này.");
    }
    const total = allocations.reduce((sum, allocation) => sum.plus(allocation.amount), new Decimal(0));
    const amount = input.amount === undefined ? null : new Decimal(input.amount);
    if (amount && !total.eq(amount)) throw new AppError("VALIDATION_ERROR", "Tổng phân bổ phải bằng số tiền giao dịch.");
    const pending = await tx.transaction.aggregate({
      where: {
        walletId: input.walletId,
        type: "expense",
        purpose: "standard",
        workflowStatus: { in: ["pending", "scheduled"] },
        deletedAt: null,
        id: input.transactionId ? { not: input.transactionId } : undefined,
      },
      _sum: { amount: true },
    });
    const exposure = new Decimal(sourceLink.wallet.currentBalance.toString())
      .plus(pending._sum.amount?.toString() ?? 0)
      .plus(input.amount ?? 0);
    if (exposure.gt(profile.creditLimit.toString())) {
      throw new AppError("VALIDATION_ERROR", "Giao dịch vượt hạn mức khả dụng sau các giao dịch đang chờ.");
    }
    if (!category?.jarCode) throw new AppError("VALIDATION_ERROR", "Danh mục chi tiêu chưa có hũ tài chính hợp lệ.");
    return { jarCode: category.jarCode, walletKind: sourceKind, allocations };
  }
  if (input.type === "expense" && sourceKind === "asset" && input.allocations?.length) {
    throw new AppError("VALIDATION_ERROR", "Giao dịch từ ví tài sản không cần phân bổ nguồn trả thẻ.");
  }
  const expenseJarCode = input.type === "expense" ? category?.jarCode : null;
  if (input.type === "expense" && !expenseJarCode) {
    throw new AppError("VALIDATION_ERROR", "Danh mục chi tiêu chưa có hũ tài chính hợp lệ.");
  }
  return {
    jarCode: input.type === "expense"
      ? expenseJarCode
      : null,
    ...(sourceKind === "credit_card" ? { walletKind: sourceKind } : {}),
  };
}

export async function applyBalance(tx: TransactionClient, record: Pick<Transaction, "id" | "type" | "purpose" | "amount" | "walletId" | "toWalletId"> & { creditCardStatementId?: string | null }, reverse = false) {
  const amount = new Decimal(record.amount.toString());
  const wallet = typeof tx.wallet.findUniqueOrThrow === "function"
    ? await tx.wallet.findUniqueOrThrow({
        where: { id: record.walletId },
        select: { kind: true, currentBalance: true, creditCardProfile: { select: { creditLimit: true } } },
      })
    : { kind: "asset" as const, currentBalance: new Decimal(0), creditCardProfile: null };
  if (record.purpose === "credit_card_payment") {
    if (!reverse && !record.creditCardStatementId && new Decimal(wallet.currentBalance.toString()).lt(amount)) {
      throw new AppError("VALIDATION_ERROR", "Số tiền thanh toán vượt quá dư nợ thẻ hiện tại.");
    }
    const sources = await tx.creditCardPaymentSource.findMany({ where: { paymentTransactionId: record.id } });
    for (const source of sources) {
      await tx.wallet.update({
        where: { id: source.sourceWalletId },
        data: { currentBalance: reverse ? { increment: source.amount } : { decrement: source.amount } },
      });
    }
    await tx.wallet.update({ where: { id: record.walletId }, data: { currentBalance: reverse ? { increment: amount } : { decrement: amount } } });
    return;
  }
  if (record.purpose === "credit_card_refund") {
    await tx.wallet.update({ where: { id: record.walletId }, data: { currentBalance: reverse ? { increment: amount } : { decrement: amount } } });
    return;
  }
  if (wallet.kind === "credit_card") {
    if (record.type !== "expense") throw new AppError("VALIDATION_ERROR", "Loại giao dịch không hợp lệ cho thẻ tín dụng.");
    if (!reverse && wallet.creditCardProfile && new Decimal(wallet.currentBalance.toString()).plus(amount).gt(wallet.creditCardProfile.creditLimit.toString())) {
      throw new AppError("VALIDATION_ERROR", "Giao dịch vượt hạn mức thẻ tín dụng.");
    }
    await tx.wallet.update({ where: { id: record.walletId }, data: { currentBalance: reverse ? { decrement: amount } : { increment: amount } } });
    return;
  }
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

async function replaceCreditCardAllocations(
  tx: TransactionClient,
  transactionId: string,
  allocations: CreateTransactionInput["allocations"],
) {
  await tx.creditCardAllocation.deleteMany({ where: { transactionId } });
  if (!allocations?.length) return;
  await tx.creditCardAllocation.createMany({
    data: allocations.map((allocation) => ({
      transactionId,
      fundingWalletId: allocation.walletId,
      amount: allocation.amount,
    })),
  });
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
      postedDate: asDatabaseDate(input.postedDate ?? input.date),
      workflowStatus: "approved",
      recurringTransactionId: recurring?.id,
      recurringPeriod: recurring?.period,
      jarCode: resources.jarCode,
    },
  });
  if (resources.walletKind === "credit_card") {
    await replaceCreditCardAllocations(tx, record.id, resources.allocations ?? input.allocations);
  }
  await applyBalance(tx, record);
  if (resources.walletKind === "credit_card") {
    await syncCreditCardObligationsForTransaction(tx, workspaceId, record.id);
    await assertCardBalanceReconciled(tx, record.walletId);
  }
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
    postedDate: input.postedDate ?? input.date,
    allocations: input.allocations?.map((allocation) => ({
      walletId: allocation.walletId,
      amount: allocation.amount.toString(),
    })),
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
  const current = await tx.transaction.findFirst({
    where: { id: record.id, deletedAt: null },
    include: { wallet: { select: { kind: true } }, installmentPlan: { select: { id: true, status: true } }, creditCardStatement: { select: { id: true } } },
  });
  if (!current) throw new AppError("NOT_FOUND", "Giao dịch không còn tồn tại.");
  if (current.installmentPlan || current.creditCardStatement) throw new AppError("CONFLICT", "Giao dịch đã vào kế hoạch trả góp hoặc sao kê và không thể sửa.");
  if (current.purpose && current.purpose !== "standard") {
    throw new AppError("CONFLICT", "Giao dịch thẻ chuyên biệt không thể sửa bằng biểu mẫu giao dịch thường.");
  }
  if (current.workflowStatus === "approved" && current.wallet?.kind === "credit_card") {
    throw new AppError("CONFLICT", "Chi tiêu thẻ đã duyệt không thể sửa; hãy hoàn tiền và tạo giao dịch mới.");
  }
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
      postedDate: asDatabaseDate(input.postedDate ?? input.date),
      workflowStatus,
      jarCode: resources.jarCode,
    },
  });
  await replaceCreditCardAllocations(
    tx,
    updated.id,
    resources.walletKind === "credit_card" ? resources.allocations : undefined,
  );
  if (workflowStatus === "approved") await applyBalance(tx, updated);
  return updated;
}

async function softDelete(tx: TransactionClient, record: Transaction) {
  await lockTransaction(tx, record.id);
  const current = await tx.transaction.findFirst({
    where: { id: record.id, deletedAt: null },
    include: { wallet: { select: { kind: true } }, installmentPlan: { select: { id: true, status: true } }, creditCardStatement: { select: { id: true } } },
  });
  if (!current) throw new AppError("NOT_FOUND", "Giao dịch không còn tồn tại.");
  if (current.installmentPlan?.status === "active" || current.installmentPlan?.status === "completed" || current.creditCardStatement) throw new AppError("CONFLICT", "Giao dịch đã vào kế hoạch trả góp hoặc sao kê và không thể xóa.");
  if (current.installmentPlan?.status === "pending") await tx.creditCardInstallmentPlan.delete({ where: { id: current.installmentPlan.id } });
  if (current.purpose && current.purpose !== "standard") {
    throw new AppError("CONFLICT", "Giao dịch thẻ chuyên biệt không thể xóa trực tiếp; hãy tạo điều chỉnh.");
  }
  if (current.workflowStatus === "approved" && current.wallet?.kind === "credit_card") {
    throw new AppError("CONFLICT", "Chi tiêu thẻ đã duyệt không thể xóa; hãy tạo hoàn tiền.");
  }
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
        postedDate: asDatabaseDate(resolved.postedDate ?? resolved.date),
        workflowStatus,
        jarCode: resources.jarCode,
      },
    });
    if (resources.walletKind === "credit_card") {
      await replaceCreditCardAllocations(tx, record.id, resources.allocations ?? resolved.allocations);
    }
    if (workflowStatus === "approved") {
      await applyBalance(tx, record);
      if (resources.walletKind === "credit_card") {
        await syncCreditCardObligationsForTransaction(tx, workspaceId, record.id);
        await assertCardBalanceReconciled(tx, record.walletId);
      }
    }
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
      include: { creditCardAllocations: true, installmentPlan: { select: { id: true, status: true } } },
    });
    if (!record) throw new AppError("NOT_FOUND", "Không tìm thấy giao dịch đang chờ hoặc đã lên lịch.");
    const resources = !record.purpose || record.purpose === "standard"
      ? await requireTransactionResources(tx, workspaceId, {
          ...record,
          transactionId: record.id,
          allocations: (record.creditCardAllocations ?? []).map((allocation) => ({
            walletId: allocation.fundingWalletId,
            amount: new Decimal(allocation.amount.toString()),
          })),
        })
      : { jarCode: record.jarCode, walletKind: "credit_card" as const };
    const today = getBusinessDateInTimeZone(member.workspace.timeZone);
    const nextStatus = record.workflowStatus === "scheduled"
      ? "approved"
      : workflowStatusForAppliedDate(asBusinessDate(record.date), today);
    const claimed = await tx.transaction.updateMany({
      where: { id: record.id, workflowStatus: record.workflowStatus, deletedAt: null },
      data: { workflowStatus: nextStatus, jarCode: resources.jarCode },
    });
    if (claimed.count !== 1) throw new AppError("CONFLICT", "Giao dịch đã được xử lý.");
    if (nextStatus === "approved") {
      if (record.purpose === "credit_card_payment") {
        const sources = await tx.creditCardPaymentSource.findMany({ where: { paymentTransactionId: record.id } });
        for (const walletId of [...new Set([record.walletId, ...sources.map((source) => source.sourceWalletId)])].sort()) {
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "WALLETS" WHERE "id" = CAST(${walletId} AS uuid) FOR UPDATE`);
        }
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "CREDIT_CARD_OBLIGATION_ENTRY" WHERE "card_wallet_id" = CAST(${record.walletId} AS uuid) FOR UPDATE`);
        if (!record.creditCardStatementId) throw new AppError("CONFLICT", "Thanh toán thẻ chưa gắn với sao kê.");
        const details = await statementPaymentDetails(tx, record.creditCardStatementId);
        const allocations = [...details.allocations].map(([obligationEntryId, amount]) => ({ obligationEntryId, amount }));
        await tx.creditCardPaymentAllocation.createMany({
          data: allocations.map((allocation) => ({ paymentTransactionId: record.id, ...allocation })),
        });
        await tx.creditCardPaymentReservation.updateMany({
          where: { paymentTransactionId: record.id, releasedAt: null },
          data: { releasedAt: new Date() },
        });
      }
      await applyBalance(tx, record);
      if (record.purpose === "credit_card_payment" && record.creditCardStatementId) {
        await tx.creditCardStatement.update({ where: { id: record.creditCardStatementId }, data: { status: "paid", paidAt: new Date() } });
        await completePaidInstallmentPlansInTransaction(tx, record.creditCardStatementId);
      }
      if (resources.walletKind === "credit_card" && record.purpose === "standard") {
        await syncCreditCardObligationsForTransaction(tx, workspaceId, record.id);
        if (record.installmentPlan?.status === "pending") await activateInstallmentPlanInTransaction(tx, workspaceId, record.installmentPlan.id);
        await assertCardBalanceReconciled(tx, record.walletId);
      }
      if (record.purpose === "credit_card_payment") {
        await assertCardBalanceReconciled(tx, record.walletId);
      } else if (record.purpose === "credit_card_refund") {
        await normalizeApprovedRefundAllocations(tx, record.id);
        await syncCreditCardObligationsForTransaction(tx, workspaceId, record.id);
        await assertCardBalanceReconciled(tx, record.walletId);
      }
    }
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
    await tx.creditCardInstallmentPlan.deleteMany({ where: { transactionId: record.id, status: "pending" } });
    await tx.transaction.update({ where: { id: record.id }, data: { workflowStatus: "rejected" } });
    if (record.purpose === "credit_card_payment") {
      await tx.creditCardPaymentReservation.updateMany({ where: { paymentTransactionId: record.id, releasedAt: null }, data: { releasedAt: new Date() } });
    }
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
      const current = await tx.transaction.findFirst({
        where: { id: record.id, workflowStatus: "scheduled", deletedAt: null },
        include: { creditCardAllocations: true, installmentPlan: { select: { id: true, status: true } } },
      });
      if (!current) continue;
      const resources = current.purpose === "standard"
          ? await requireTransactionResources(tx, workspaceId, {
              ...current,
              transactionId: current.id,
            allocations: (current.creditCardAllocations ?? []).map((allocation) => ({
              walletId: allocation.fundingWalletId,
              amount: new Decimal(allocation.amount.toString()),
            })),
          })
        : { jarCode: current.jarCode, walletKind: "credit_card" as const };
      const claimed = await tx.transaction.updateMany({ where: { id: current.id, workflowStatus: "scheduled", deletedAt: null }, data: { workflowStatus: "approved", jarCode: resources.jarCode } });
      if (claimed.count !== 1) continue;
      if (current.purpose === "credit_card_payment") {
        const sources = await tx.creditCardPaymentSource.findMany({ where: { paymentTransactionId: current.id } });
        for (const walletId of [...new Set([current.walletId, ...sources.map((source) => source.sourceWalletId)])].sort()) {
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "WALLETS" WHERE "id" = CAST(${walletId} AS uuid) FOR UPDATE`);
        }
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "CREDIT_CARD_OBLIGATION_ENTRY" WHERE "card_wallet_id" = CAST(${current.walletId} AS uuid) FOR UPDATE`);
        if (!current.creditCardStatementId) throw new AppError("CONFLICT", "Thanh toán thẻ chưa gắn với sao kê.");
        const details = await statementPaymentDetails(tx, current.creditCardStatementId);
        const allocations = [...details.allocations].map(([obligationEntryId, amount]) => ({ obligationEntryId, amount }));
        await tx.creditCardPaymentAllocation.createMany({ data: allocations.map((allocation) => ({ paymentTransactionId: current.id, ...allocation })) });
        await tx.creditCardPaymentReservation.updateMany({ where: { paymentTransactionId: current.id, releasedAt: null }, data: { releasedAt: new Date() } });
      }
      await applyBalance(tx, current);
      if (current.purpose === "credit_card_payment" && current.creditCardStatementId) {
        await tx.creditCardStatement.update({ where: { id: current.creditCardStatementId }, data: { status: "paid", paidAt: new Date() } });
        await completePaidInstallmentPlansInTransaction(tx, current.creditCardStatementId);
      }
      if (resources.walletKind === "credit_card" && current.purpose !== "credit_card_payment") {
        if (current.purpose === "credit_card_refund") await normalizeApprovedRefundAllocations(tx, current.id);
        await syncCreditCardObligationsForTransaction(tx, workspaceId, current.id);
        if (current.purpose === "standard" && current.installmentPlan?.status === "pending") await activateInstallmentPlanInTransaction(tx, workspaceId, current.installmentPlan.id);
      }
      if (resources.walletKind === "credit_card") await assertCardBalanceReconciled(tx, current.walletId);
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
    if (record.purpose && record.purpose !== "standard") throw new AppError("VALIDATION_ERROR", "Giao dịch thẻ chuyên biệt không thể sửa trực tiếp.");
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
    if (!isAdminRole(member.role.code) && record.memberId !== member.id) {
      throw new AppError("FORBIDDEN", "Bạn chỉ có thể gửi yêu cầu xóa giao dịch do mình tạo.");
    }
    if (record.purpose && record.purpose !== "standard") throw new AppError("VALIDATION_ERROR", "Giao dịch thẻ chuyên biệt không thể xóa trực tiếp.");
    if (isAdminRole(member.role.code)) {
      await softDelete(tx, record);
      await tx.auditLog.create({ data: { workspaceId, actorUserId: userId, action: "transaction.deleted", entityType: "transaction", entityId: record.id, metadata: { workflowStatus: record.workflowStatus, balanceReversed: record.workflowStatus === "approved" } } });
      return { kind: "deleted" as const, id: record.id };
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
