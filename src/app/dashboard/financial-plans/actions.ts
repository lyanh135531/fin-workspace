"use server";

import { revalidatePath } from "next/cache";
import {
  createFinancialPlanSchema,
  financialPlanIdSchema,
  updateFinancialPlanAllocationSchema,
  updateFinancialPlanDeadlineSchema,
  updateFinancialPlanDraftSchema,
  createFinancialPlanWithGoalsSchema,
  createFinancialPlanGoalSchema,
  updateFinancialPlanGoalSchema,
  reorderFinancialPlanGoalsSchema,
  createFinancialGoalFundingSchema,
  reviewFinancialGoalFundingSchema,
  reverseFinancialGoalFundingSchema,
  financialPlanGoalIdSchema,
  financialPlanPreviewSchema,
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
import {
  createFinancialGoalFunding,
  createFinancialPlanGoal,
  createFinancialPlanWithGoals,
  finishFinancialPlanGoal,
  previewFinancialPlan,
  reorderFinancialPlanGoals,
  reviewFinancialGoalFunding,
  reverseFinancialGoalFunding,
  updateFinancialPlanGoal,
} from "@/services/financial-goal-service";
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

export async function createFinancialPlanWithGoalsAction(input: unknown) {
  try {
    const actor = await adminActor();
    const record = await createFinancialPlanWithGoals(actor.userId, actor.workspaceId, createFinancialPlanWithGoalsSchema.parse(input));
    refresh();
    return { ok: true as const, id: record.id };
  } catch (error) { return failure(error, "Không thể tạo kế hoạch đa mục tiêu.", "financial_plan.v2_create_failed"); }
}

export async function createFinancialPlanGoalAction(input: unknown) {
  try {
    const actor = await adminActor();
    const record = await createFinancialPlanGoal(actor.userId, actor.workspaceId, createFinancialPlanGoalSchema.parse(input));
    refresh();
    return { ok: true as const, id: record.id };
  } catch (error) { return failure(error, "Không thể thêm mục tiêu.", "financial_goal.create_failed"); }
}

export async function updateFinancialPlanGoalAction(input: unknown) {
  try {
    const actor = await adminActor();
    await updateFinancialPlanGoal(actor.userId, actor.workspaceId, updateFinancialPlanGoalSchema.parse(input));
    refresh();
    return { ok: true as const };
  } catch (error) { return failure(error, "Không thể cập nhật mục tiêu.", "financial_goal.update_failed"); }
}

export async function reorderFinancialPlanGoalsAction(input: unknown) {
  try {
    const actor = await adminActor();
    const parsed = reorderFinancialPlanGoalsSchema.parse(input);
    await reorderFinancialPlanGoals(actor.userId, actor.workspaceId, parsed.planId, parsed.goalIds);
    refresh();
    return { ok: true as const };
  } catch (error) { return failure(error, "Không thể đổi thứ tự ưu tiên.", "financial_goal.reorder_failed"); }
}

export async function createFinancialGoalFundingAction(input: unknown) {
  try {
    const session = await requireAcceptedLegalSession();
    const workspaceId = await resolveActiveWorkspaceId(session.user.id);
    if (!workspaceId) throw new AppError("FORBIDDEN", "Không có nhóm tài chính đang hoạt động.");
    const parsed = createFinancialGoalFundingSchema.parse(input);
    const entry = await createFinancialGoalFunding(session.user.id, workspaceId, parsed);
    refresh();
    return { ok: true as const, status: entry.status };
  } catch (error) { return failure(error, "Không thể ghi nhận khoản đóng góp.", "financial_goal.funding_create_failed"); }
}

export async function reviewFinancialGoalFundingAction(input: unknown) {
  try {
    const actor = await adminActor();
    const parsed = reviewFinancialGoalFundingSchema.parse(input);
    await reviewFinancialGoalFunding(actor.userId, actor.workspaceId, parsed.entryId, parsed.approve);
    refresh();
    return { ok: true as const };
  } catch (error) { return failure(error, "Không thể duyệt khoản đóng góp.", "financial_goal.funding_review_failed"); }
}

export async function reverseFinancialGoalFundingAction(input: unknown) {
  try {
    const actor = await adminActor();
    const parsed = reverseFinancialGoalFundingSchema.parse(input);
    await reverseFinancialGoalFunding(actor.userId, actor.workspaceId, parsed.entryId, parsed.effectiveDate, parsed.note);
    refresh();
    return { ok: true as const };
  } catch (error) { return failure(error, "Không thể hoàn tác khoản đóng góp.", "financial_goal.funding_reverse_failed"); }
}

export async function finishFinancialPlanGoalAction(input: unknown) {
  try {
    const actor = await adminActor();
    const parsed = financialPlanGoalIdSchema.parse((input as { goalId?: unknown })?.goalId);
    const status = (input as { status?: unknown })?.status;
    if (status !== "completed" && status !== "cancelled") throw new AppError("VALIDATION_ERROR", "Trạng thái mục tiêu không hợp lệ.");
    await finishFinancialPlanGoal(actor.userId, actor.workspaceId, parsed, status);
    refresh();
    return { ok: true as const };
  } catch (error) { return failure(error, "Không thể kết thúc mục tiêu.", "financial_goal.finish_failed"); }
}

export async function previewFinancialPlanAction(input: unknown) {
  try {
    await requireAcceptedLegalSession();
    return { ok: true as const, preview: previewFinancialPlan(financialPlanPreviewSchema.parse(input)) };
  } catch (error) { return failure(error, "Không thể tính bản xem trước.", "financial_plan.preview_failed"); }
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
