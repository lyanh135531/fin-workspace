"use server";

import { revalidatePath } from "next/cache";
import {
  createFinancialPlanSchema,
  financialPlanIdSchema,
  updateFinancialPlanAllocationSchema,
  updateFinancialPlanDeadlineSchema,
  updateFinancialPlanDraftSchema,
} from "@/domain";
import { AppError } from "@/lib/errors";
import { toActionFailure } from "@/lib/server-error";
import { requireAcceptedLegalSession } from "@/lib/legal-access";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import {
  activateFinancialPlan,
  cancelFinancialPlan,
  completeFinancialPlan,
  createFinancialPlanDraft,
  deleteFinancialPlan,
  updateFinancialPlanAllocations,
  updateFinancialPlanDeadline,
  updateFinancialPlanDraft,
} from "@/services/financial-plan-service";
import { requireWorkspaceMember } from "@/services/workspace-access";

async function adminActor() {
  const session = await requireAcceptedLegalSession();
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) throw new AppError("FORBIDDEN", "Không có nhóm tài chính đang hoạt động.");
  await requireWorkspaceMember(session.user.id, workspaceId, true);
  return { userId: session.user.id, workspaceId };
}

function refresh() {
  revalidatePath("/financial-plans");
  revalidatePath("/dashboard/financial-plans");
  revalidatePath("/overview");
}

function failure(error: unknown, fallback: string, event: string) {
  return toActionFailure(error, fallback, { event });
}

export async function createFinancialPlanDraftAction(input: unknown) {
  try {
    const actor = await adminActor();
    const record = await createFinancialPlanDraft(actor.userId, actor.workspaceId, createFinancialPlanSchema.parse(input));
    refresh();
    return { ok: true as const, id: record.id };
  } catch (error) { return failure(error, "Không thể tạo kế hoạch nháp.", "financial_plan.draft_create_failed"); }
}

export async function updateFinancialPlanDraftAction(input: unknown) {
  try {
    const actor = await adminActor();
    const parsed = updateFinancialPlanDraftSchema.parse(input);
    await updateFinancialPlanDraft(actor.userId, actor.workspaceId, parsed);
    refresh();
    return { ok: true as const };
  } catch (error) { return failure(error, "Không thể cập nhật kế hoạch nháp.", "financial_plan.draft_update_failed"); }
}

export async function deleteFinancialPlanAction(planId: unknown) {
  try {
    const actor = await adminActor();
    await deleteFinancialPlan(actor.userId, actor.workspaceId, financialPlanIdSchema.parse(planId));
    refresh();
    return { ok: true as const };
  } catch (error) { return failure(error, "Không thể xóa kế hoạch.", "financial_plan.delete_failed"); }
}

export async function activateFinancialPlanAction(planId: unknown) {
  try {
    const actor = await adminActor();
    await activateFinancialPlan(actor.userId, actor.workspaceId, financialPlanIdSchema.parse(planId));
    refresh();
    return { ok: true as const };
  } catch (error) { return failure(error, "Không thể kích hoạt kế hoạch.", "financial_plan.activate_failed"); }
}

export async function updateFinancialPlanDeadlineAction(input: unknown) {
  try {
    const actor = await adminActor();
    const parsed = updateFinancialPlanDeadlineSchema.parse(input);
    await updateFinancialPlanDeadline(actor.userId, actor.workspaceId, parsed.planId, parsed.targetMonth);
    refresh();
    return { ok: true as const };
  } catch (error) { return failure(error, "Không thể cập nhật thời hạn.", "financial_plan.deadline_update_failed"); }
}

export async function updateFinancialPlanAllocationsAction(input: unknown) {
  try {
    const actor = await adminActor();
    const parsed = updateFinancialPlanAllocationSchema.parse(input);
    await updateFinancialPlanAllocations(actor.userId, actor.workspaceId, parsed.planId, parsed.percentages);
    refresh();
    return { ok: true as const };
  } catch (error) { return failure(error, "Không thể cập nhật tỷ lệ hũ.", "financial_plan.allocation_update_failed"); }
}

export async function cancelFinancialPlanAction(planId: unknown) {
  try {
    const actor = await adminActor();
    await cancelFinancialPlan(actor.userId, actor.workspaceId, financialPlanIdSchema.parse(planId));
    refresh();
    return { ok: true as const };
  } catch (error) { return failure(error, "Không thể hủy kế hoạch.", "financial_plan.cancel_failed"); }
}

export async function completeFinancialPlanAction(planId: unknown) {
  try {
    const actor = await adminActor();
    await completeFinancialPlan(actor.userId, actor.workspaceId, financialPlanIdSchema.parse(planId));
    refresh();
    return { ok: true as const };
  } catch (error) { return failure(error, "Không thể hoàn thành kế hoạch.", "financial_plan.complete_failed"); }
}
