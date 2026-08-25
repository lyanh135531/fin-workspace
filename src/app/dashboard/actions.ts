"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/auth";
import { changeReasonSchema, createTransactionSchema, createWalletSchema, deleteRequestReasonSchema } from "@/domain";
import { debug } from "@/lib/debug";
import { AppError } from "@/lib/errors";
import { MONEY_LIMIT_ERROR_MESSAGE } from "@/lib/money-limits";
import {
  approveTransaction,
  approveTransactionChange,
  createTransaction,
  deleteOrRequestTransaction,
  deleteTransaction,
  rejectTransaction,
  rejectTransactionChange,
  updateTransaction,
} from "@/services/transaction-service";
import { idSchema } from "@/domain/common/schemas";
import { createWalletForWorkspace } from "@/services/wallet-service";
import { requireWorkspaceMember } from "@/services/workspace-access";

function transactionActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? fallback;
  }
  if (error instanceof Error) {
    if (
      error.message.includes("numeric field overflow") ||
      error.message.includes("Value out of range for the type")
    ) {
      return MONEY_LIMIT_ERROR_MESSAGE;
    }
    return error.message;
  }
  return fallback;
}

function revalidateFinancialPlanViews() {
  revalidatePath("/financial-plans");
  revalidatePath("/dashboard/financial-plans");
}

export async function addWalletAction(workspaceId: string, input: unknown) {
  const requestId = crypto.randomUUID();
  try { const user = await workspaceActor(workspaceId); const wallet = await createWalletForWorkspace(user.userId, user.workspaceId, createWalletSchema.parse(input)); debug("wallet.created", { requestId, walletId: wallet.id, workspaceId: user.workspaceId }); revalidatePath("/dashboard"); revalidateFinancialPlanViews(); return { ok: true }; }
  catch (error) { debug("wallet.failed", { requestId, message: error instanceof Error ? error.message : "unknown" }); return { ok: false, message: error instanceof Error ? error.message : "Unable to create wallet." }; }
}

export async function addTransactionAction(workspaceId: string, input: unknown) {
  const requestId = crypto.randomUUID();
  try { const user = await workspaceActor(workspaceId); const transaction = await createTransaction(user.userId, user.workspaceId, createTransactionSchema.parse(input)); debug("transaction.created", { requestId, transactionId: transaction.id, workspaceId: user.workspaceId }); revalidatePath("/dashboard"); revalidatePath(`/workspace/${user.workspaceId}`); revalidatePath("/overview"); revalidateFinancialPlanViews(); return { ok: true, status: transaction.workflowStatus }; }
  catch (error) { debug("transaction.failed", { requestId, message: error instanceof Error ? error.message : "unknown" }); return { ok: false, message: transactionActionErrorMessage(error, "Không thể tạo giao dịch.") }; }
}

export async function addQuickTransactionAction(workspaceId: unknown, input: unknown) {
  const requestId = crypto.randomUUID();
  try {
    const user = await workspaceActor(workspaceId);
    const transaction = await createTransaction(
      user.userId,
      user.workspaceId,
      createTransactionSchema.parse(input),
    );
    debug("transaction.quick_created", {
      requestId,
      transactionId: transaction.id,
      workspaceId: user.workspaceId,
    });
    revalidatePath("/dashboard");
    revalidatePath(`/workspace/${user.workspaceId}`);
    revalidatePath("/overview");
    revalidateFinancialPlanViews();
    return { ok: true, status: transaction.workflowStatus };
  } catch (error) {
    debug("transaction.quick_failed", {
      requestId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      ok: false,
      message: transactionActionErrorMessage(error, "Không thể lưu giao dịch."),
    };
  }
}

export async function approveTransactionAction(workspaceId: string, transactionId: string) {
  const requestId = crypto.randomUUID();
  try { const user = await workspaceActor(workspaceId); const transaction = await approveTransaction(user.userId, user.workspaceId, idSchema.parse(transactionId)); debug("transaction.approved", { requestId, transactionId: transaction.id, workspaceId: user.workspaceId }); revalidatePath("/dashboard"); revalidatePath(`/workspace/${user.workspaceId}`); revalidatePath("/overview"); revalidateFinancialPlanViews(); return { ok: true }; }
  catch (error) { debug("transaction.approve_failed", { requestId, message: error instanceof Error ? error.message : "unknown" }); return { ok: false, message: error instanceof Error ? error.message : "Unable to approve transaction." }; }
}

async function workspaceActor(workspaceIdInput: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new AppError("AUTHENTICATION_REQUIRED", "Please sign in.");
  const workspaceId = idSchema.parse(workspaceIdInput);
  await requireWorkspaceMember(session.user.id, workspaceId);
  return { userId: session.user.id, workspaceId };
}

export async function updateTransactionAction(workspaceId: string, transactionId: string, input: unknown, reason?: unknown) {
  const requestId = crypto.randomUUID();
  try {
    const user = await workspaceActor(workspaceId);
    const result = await updateTransaction(user.userId, user.workspaceId, idSchema.parse(transactionId), createTransactionSchema.parse(input), changeReasonSchema.parse(reason));
    debug("transaction.update_processed", { requestId, transactionId, result: result.kind, workspaceId: user.workspaceId });
    revalidatePath(`/workspace/${user.workspaceId}`); revalidatePath("/overview"); revalidateFinancialPlanViews();
    return { ok: true, kind: result.kind };
  } catch (error) {
    debug("transaction.update_failed", { requestId, message: error instanceof Error ? error.message : "unknown" });
    return { ok: false, message: transactionActionErrorMessage(error, "Không thể cập nhật giao dịch.") };
  }
}

const updateTransactionsSchema = z.array(z.object({
  transactionId: idSchema,
  input: createTransactionSchema,
})).min(1).max(100);

export async function updateTransactionsAction(workspaceId: string, input: unknown, reason?: unknown) {
  const requestId = crypto.randomUUID();
  try {
    const user = await workspaceActor(workspaceId);
    const changes = updateTransactionsSchema.parse(input);
    const normalizedReason = changeReasonSchema.parse(reason);
    let updated = 0;
    let requested = 0;
    const errors: string[] = [];
    for (const change of changes) {
      try {
        const result = await updateTransaction(user.userId, user.workspaceId, change.transactionId, change.input, normalizedReason);
        if (result.kind === "updated") updated += 1;
        else requested += 1;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Không thể cập nhật giao dịch.");
      }
    }
    debug("transactions.update_processed", { requestId, transactionCount: changes.length, updated, requested, errorCount: errors.length, workspaceId: user.workspaceId });
    revalidatePath("/dashboard"); revalidatePath(`/workspace/${user.workspaceId}`); revalidatePath("/overview"); revalidateFinancialPlanViews();
    if (errors.length) return { ok: false, message: `Đã xử lý ${updated + requested}/${changes.length} giao dịch. ${errors[0]}`, updated, requested };
    return { ok: true, updated, requested };
  } catch (error) {
    debug("transactions.update_failed", { requestId, message: error instanceof Error ? error.message : "unknown" });
    return { ok: false, message: error instanceof Error ? error.message : "Unable to update transactions." };
  }
}

export async function rejectTransactionAction(workspaceId: string, transactionId: string) {
  const requestId = crypto.randomUUID();
  try { const user = await workspaceActor(workspaceId); await rejectTransaction(user.userId, user.workspaceId, idSchema.parse(transactionId)); debug("transaction.rejected", { requestId, transactionId, workspaceId: user.workspaceId }); revalidatePath("/dashboard"); revalidatePath(`/workspace/${user.workspaceId}`); revalidatePath("/overview"); revalidateFinancialPlanViews(); return { ok: true }; }
  catch (error) { debug("transaction.reject_failed", { requestId, message: error instanceof Error ? error.message : "unknown" }); return { ok: false, message: error instanceof Error ? error.message : "Unable to reject transaction." }; }
}

export async function deleteTransactionAction(workspaceId: string, transactionId: string, reason?: unknown) {
  const requestId = crypto.randomUUID();
  try { const user = await workspaceActor(workspaceId); const result = await deleteOrRequestTransaction(user.userId, user.workspaceId, idSchema.parse(transactionId), deleteRequestReasonSchema.parse(reason)); debug("transaction.delete_processed", { requestId, transactionId, result: result.kind, workspaceId: user.workspaceId }); revalidatePath(`/workspace/${user.workspaceId}`); revalidatePath("/dashboard"); revalidatePath("/overview"); revalidateFinancialPlanViews(); return { ok: true, kind: result.kind }; }
  catch (error) { debug("transaction.delete_failed", { requestId, message: error instanceof Error ? error.message : "unknown" }); return { ok: false, message: error instanceof Error ? error.message : "Unable to delete transaction." }; }
}

export async function reviewTransactionChangeAction(workspaceId: string, changeRequestId: string, approve: boolean) {
  const requestId = crypto.randomUUID();
  try {
    const user = await workspaceActor(workspaceId);
    const id = idSchema.parse(changeRequestId);
    if (approve) await approveTransactionChange(user.userId, user.workspaceId, id);
    else await rejectTransactionChange(user.userId, user.workspaceId, id);
    debug("transaction.change_reviewed", { requestId, changeRequestId: id, approve, workspaceId: user.workspaceId });
    revalidatePath(`/workspace/${user.workspaceId}`); revalidatePath("/overview"); revalidatePath("/dashboard"); revalidateFinancialPlanViews();
    return { ok: true };
  } catch (error) {
    debug("transaction.change_review_failed", { requestId, message: error instanceof Error ? error.message : "unknown" });
    return { ok: false, message: error instanceof Error ? error.message : "Unable to review transaction change." };
  }
}

export async function deleteTransactionsAction(workspaceId: string, transactionIds: unknown) {
  const requestId = crypto.randomUUID();
  try { const user = await workspaceActor(workspaceId); const ids = Array.from(new Set(idSchema.array().min(1).max(100).parse(transactionIds))); for (const id of ids) await deleteTransaction(user.userId, user.workspaceId, id); debug("transactions.deleted", { requestId, transactionCount: ids.length, workspaceId: user.workspaceId }); revalidatePath(`/workspace/${user.workspaceId}`); revalidatePath("/overview"); revalidateFinancialPlanViews(); return { ok: true, count: ids.length }; }
  catch (error) { debug("transactions.delete_failed", { requestId, message: error instanceof Error ? error.message : "unknown" }); return { ok: false, message: error instanceof Error ? error.message : "Unable to delete transactions." }; }
}
