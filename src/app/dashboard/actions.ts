"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/auth";
import { changeReasonSchema, createTransactionSchema, createWalletSchema, deleteRequestReasonSchema } from "@/domain";
import { debug } from "@/lib/debug";
import { AppError } from "@/lib/errors";
import { MONEY_LIMIT_ERROR_MESSAGE } from "@/lib/money-limits";
import { toActionFailure } from "@/lib/server-error";
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

function transactionActionFailure(error: unknown, fallback: string, event: string, requestId: string) {
  if (error instanceof Error) {
    if (
      error.message.includes("numeric field overflow") ||
      error.message.includes("Value out of range for the type")
    ) {
      return toActionFailure(
        new AppError("VALIDATION_ERROR", MONEY_LIMIT_ERROR_MESSAGE),
        fallback,
        { event, requestId },
      );
    }
  }
  return toActionFailure(error, fallback, { event, requestId });
}

function revalidateFinancialPlanViews() {
  revalidatePath("/financial-plans");
  revalidatePath("/dashboard/financial-plans");
}

export async function addWalletAction(workspaceId: string, input: unknown) {
  const requestId = crypto.randomUUID();
  try { const user = await workspaceActor(workspaceId); const wallet = await createWalletForWorkspace(user.userId, user.workspaceId, createWalletSchema.parse(input)); debug("wallet.created", { requestId, walletId: wallet.id, workspaceId: user.workspaceId }); revalidatePath("/dashboard"); revalidateFinancialPlanViews(); return { ok: true as const }; }
  catch (error) { debug("wallet.failed", { requestId, message: error instanceof Error ? error.message : "unknown" }); return toActionFailure(error, "Không thể tạo ví.", { event: "wallet.failed", requestId }); }
}

export async function addTransactionAction(workspaceId: string, input: unknown) {
  const requestId = crypto.randomUUID();
  try { const user = await workspaceActor(workspaceId); const transaction = await createTransaction(user.userId, user.workspaceId, createTransactionSchema.parse(input)); debug("transaction.created", { requestId, transactionId: transaction.id, workspaceId: user.workspaceId }); revalidatePath("/dashboard"); revalidatePath(`/workspace/${user.workspaceId}`); revalidatePath("/overview"); revalidateFinancialPlanViews(); return { ok: true as const, status: transaction.workflowStatus }; }
  catch (error) { debug("transaction.failed", { requestId, message: error instanceof Error ? error.message : "unknown" }); return transactionActionFailure(error, "Không thể tạo giao dịch.", "transaction.failed", requestId); }
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
    return { ok: true as const, status: transaction.workflowStatus };
  } catch (error) {
    debug("transaction.quick_failed", {
      requestId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return transactionActionFailure(error, "Không thể lưu giao dịch.", "transaction.quick_failed", requestId);
  }
}

export async function approveTransactionAction(workspaceId: string, transactionId: string) {
  const requestId = crypto.randomUUID();
  try { const user = await workspaceActor(workspaceId); const transaction = await approveTransaction(user.userId, user.workspaceId, idSchema.parse(transactionId)); debug("transaction.approved", { requestId, transactionId: transaction.id, workspaceId: user.workspaceId }); revalidatePath("/dashboard"); revalidatePath(`/workspace/${user.workspaceId}`); revalidatePath("/overview"); revalidateFinancialPlanViews(); return { ok: true as const }; }
  catch (error) { debug("transaction.approve_failed", { requestId, message: error instanceof Error ? error.message : "unknown" }); return toActionFailure(error, "Không thể duyệt giao dịch.", { event: "transaction.approve_failed", requestId }); }
}

async function workspaceActor(workspaceIdInput: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new AppError("AUTHENTICATION_REQUIRED", "Vui lòng đăng nhập.");
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
    return { ok: true as const, kind: result.kind };
  } catch (error) {
    debug("transaction.update_failed", { requestId, message: error instanceof Error ? error.message : "unknown" });
    return transactionActionFailure(error, "Không thể cập nhật giao dịch.", "transaction.update_failed", requestId);
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
        errors.push(transactionActionFailure(error, "Không thể cập nhật giao dịch.", "transaction.batch_item_failed", requestId).message);
      }
    }
    debug("transactions.update_processed", { requestId, transactionCount: changes.length, updated, requested, errorCount: errors.length, workspaceId: user.workspaceId });
    revalidatePath("/dashboard"); revalidatePath(`/workspace/${user.workspaceId}`); revalidatePath("/overview"); revalidateFinancialPlanViews();
    if (errors.length) return { ok: false as const, code: "CONFLICT" as const, message: `Đã xử lý ${updated + requested}/${changes.length} giao dịch. ${errors[0]}`, requestId, updated, requested };
    return { ok: true as const, updated, requested };
  } catch (error) {
    debug("transactions.update_failed", { requestId, message: error instanceof Error ? error.message : "unknown" });
    return toActionFailure(error, "Không thể cập nhật các giao dịch.", { event: "transactions.update_failed", requestId });
  }
}

export async function rejectTransactionAction(workspaceId: string, transactionId: string) {
  const requestId = crypto.randomUUID();
  try { const user = await workspaceActor(workspaceId); await rejectTransaction(user.userId, user.workspaceId, idSchema.parse(transactionId)); debug("transaction.rejected", { requestId, transactionId, workspaceId: user.workspaceId }); revalidatePath("/dashboard"); revalidatePath(`/workspace/${user.workspaceId}`); revalidatePath("/overview"); revalidateFinancialPlanViews(); return { ok: true as const }; }
  catch (error) { debug("transaction.reject_failed", { requestId, message: error instanceof Error ? error.message : "unknown" }); return toActionFailure(error, "Không thể từ chối giao dịch.", { event: "transaction.reject_failed", requestId }); }
}

export async function deleteTransactionAction(workspaceId: string, transactionId: string, reason?: unknown) {
  const requestId = crypto.randomUUID();
  try { const user = await workspaceActor(workspaceId); const result = await deleteOrRequestTransaction(user.userId, user.workspaceId, idSchema.parse(transactionId), deleteRequestReasonSchema.parse(reason)); debug("transaction.delete_processed", { requestId, transactionId, result: result.kind, workspaceId: user.workspaceId }); revalidatePath(`/workspace/${user.workspaceId}`); revalidatePath("/dashboard"); revalidatePath("/overview"); revalidateFinancialPlanViews(); return { ok: true as const, kind: result.kind }; }
  catch (error) { debug("transaction.delete_failed", { requestId, message: error instanceof Error ? error.message : "unknown" }); return toActionFailure(error, "Không thể xóa giao dịch.", { event: "transaction.delete_failed", requestId }); }
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
    return { ok: true as const };
  } catch (error) {
    debug("transaction.change_review_failed", { requestId, message: error instanceof Error ? error.message : "unknown" });
    return toActionFailure(error, "Không thể xử lý yêu cầu thay đổi.", { event: "transaction.change_review_failed", requestId });
  }
}

export async function deleteTransactionsAction(workspaceId: string, transactionIds: unknown) {
  const requestId = crypto.randomUUID();
  try { const user = await workspaceActor(workspaceId); const ids = Array.from(new Set(idSchema.array().min(1).max(100).parse(transactionIds))); for (const id of ids) await deleteTransaction(user.userId, user.workspaceId, id); debug("transactions.deleted", { requestId, transactionCount: ids.length, workspaceId: user.workspaceId }); revalidatePath(`/workspace/${user.workspaceId}`); revalidatePath("/overview"); revalidateFinancialPlanViews(); return { ok: true as const, count: ids.length }; }
  catch (error) { debug("transactions.delete_failed", { requestId, message: error instanceof Error ? error.message : "unknown" }); return toActionFailure(error, "Không thể xóa các giao dịch.", { event: "transactions.delete_failed", requestId }); }
}
