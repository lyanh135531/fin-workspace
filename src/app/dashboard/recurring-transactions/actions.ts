"use server";

import { revalidatePath } from "next/cache";
import {
  recurringTransactionSchema,
  recurringTransactionStatusSchema,
} from "@/domain";
import { idSchema } from "@/domain/common/schemas";
import { AppError } from "@/lib/errors";
import { toActionFailure } from "@/lib/server-error";
import { requireAcceptedLegalSession } from "@/lib/legal-access";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import {
  createRecurringTransaction,
  deleteRecurringTransaction,
  setRecurringTransactionStatus,
  updateRecurringTransaction,
} from "@/services/recurring-transaction-service";
import { requireWorkspaceMember } from "@/services/workspace-access";

async function adminActor() {
  const session = await requireAcceptedLegalSession();
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) throw new AppError("FORBIDDEN", "Không có nhóm tài chính đang hoạt động.");
  await requireWorkspaceMember(session.user.id, workspaceId, true);
  return { userId: session.user.id, workspaceId };
}

function refreshRecurringPages(workspaceId: string) {
  revalidatePath("/recurring-transactions");
  revalidatePath("/dashboard");
  revalidatePath(`/workspace/${workspaceId}`);
  revalidatePath("/overview");
  revalidatePath("/financial-plans");
  revalidatePath("/dashboard/financial-plans");
}

function failure(error: unknown, fallback: string, event: string) {
  return toActionFailure(error, fallback, { event });
}

export async function createRecurringTransactionAction(input: unknown) {
  try {
    const actor = await adminActor();
    const record = await createRecurringTransaction(
      actor.userId,
      actor.workspaceId,
      recurringTransactionSchema.parse(input),
    );
    refreshRecurringPages(actor.workspaceId);
    return { ok: true as const, id: record.id };
  } catch (error) {
    return failure(error, "Không thể tạo giao dịch định kỳ.", "recurring_transaction.create_failed");
  }
}

export async function updateRecurringTransactionAction(id: unknown, input: unknown) {
  try {
    const actor = await adminActor();
    await updateRecurringTransaction(
      actor.userId,
      actor.workspaceId,
      idSchema.parse(id),
      recurringTransactionSchema.parse(input),
    );
    refreshRecurringPages(actor.workspaceId);
    return { ok: true as const };
  } catch (error) {
    return failure(error, "Không thể cập nhật giao dịch định kỳ.", "recurring_transaction.update_failed");
  }
}

export async function setRecurringTransactionStatusAction(id: unknown, status: unknown) {
  try {
    const actor = await adminActor();
    await setRecurringTransactionStatus(
      actor.userId,
      actor.workspaceId,
      idSchema.parse(id),
      recurringTransactionStatusSchema.parse(status),
    );
    refreshRecurringPages(actor.workspaceId);
    return { ok: true as const };
  } catch (error) {
    return failure(error, "Không thể thay đổi trạng thái.", "recurring_transaction.status_update_failed");
  }
}

export async function deleteRecurringTransactionAction(id: unknown) {
  try {
    const actor = await adminActor();
    await deleteRecurringTransaction(actor.userId, actor.workspaceId, idSchema.parse(id));
    refreshRecurringPages(actor.workspaceId);
    return { ok: true as const };
  } catch (error) {
    return failure(error, "Không thể xóa giao dịch định kỳ.", "recurring_transaction.delete_failed");
  }
}
