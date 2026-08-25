"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/auth";
import {
  createFinancialPlanSchema,
  financialPlanIdSchema,
  updateFinancialPlanAllocationSchema,
  updateFinancialPlanDeadlineSchema,
  updateFinancialPlanDraftSchema,
} from "@/domain";
import { AppError } from "@/lib/errors";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import {
  activateFinancialPlan,
  cancelFinancialPlan,
  completeFinancialPlan,
  createFinancialPlanDraft,
  deleteFinancialPlanDraft,
  updateFinancialPlanAllocations,
  updateFinancialPlanDeadline,
  updateFinancialPlanDraft,
} from "@/services/financial-plan-service";
import { requireWorkspaceMember } from "@/services/workspace-access";

async function adminActor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new AppError("AUTHENTICATION_REQUIRED", "Cần đăng nhập.");
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) throw new AppError("FORBIDDEN", "Không có workspace đang hoạt động.");
  await requireWorkspaceMember(session.user.id, workspaceId, true);
  return { userId: session.user.id, workspaceId };
}

function refresh() {
  revalidatePath("/financial-plans");
  revalidatePath("/dashboard/financial-plans");
  revalidatePath("/overview");
}

function failure(error: unknown, fallback: string) {
  return { ok: false as const, message: error instanceof Error ? error.message : fallback };
}

export async function createFinancialPlanDraftAction(input: unknown) {
  try {
    const actor = await adminActor();
    const record = await createFinancialPlanDraft(actor.userId, actor.workspaceId, createFinancialPlanSchema.parse(input));
    refresh();
    return { ok: true as const, id: record.id };
  } catch (error) { return failure(error, "Không thể tạo kế hoạch nháp."); }
}

export async function updateFinancialPlanDraftAction(input: unknown) {
  try {
    const actor = await adminActor();
    const parsed = updateFinancialPlanDraftSchema.parse(input);
    await updateFinancialPlanDraft(actor.userId, actor.workspaceId, parsed);
    refresh();
    return { ok: true as const };
  } catch (error) { return failure(error, "Không thể cập nhật kế hoạch nháp."); }
}

export async function deleteFinancialPlanDraftAction(planId: unknown) {
  try {
    const actor = await adminActor();
    await deleteFinancialPlanDraft(actor.userId, actor.workspaceId, financialPlanIdSchema.parse(planId));
    refresh();
    return { ok: true as const };
  } catch (error) { return failure(error, "Không thể xóa kế hoạch nháp."); }
}

export async function activateFinancialPlanAction(planId: unknown) {
  try {
    const actor = await adminActor();
    await activateFinancialPlan(actor.userId, actor.workspaceId, financialPlanIdSchema.parse(planId));
    refresh();
    return { ok: true as const };
  } catch (error) { return failure(error, "Không thể kích hoạt kế hoạch."); }
}

export async function updateFinancialPlanDeadlineAction(input: unknown) {
  try {
    const actor = await adminActor();
    const parsed = updateFinancialPlanDeadlineSchema.parse(input);
    await updateFinancialPlanDeadline(actor.userId, actor.workspaceId, parsed.planId, parsed.targetMonth);
    refresh();
    return { ok: true as const };
  } catch (error) { return failure(error, "Không thể cập nhật deadline."); }
}

export async function updateFinancialPlanAllocationsAction(input: unknown) {
  try {
    const actor = await adminActor();
    const parsed = updateFinancialPlanAllocationSchema.parse(input);
    await updateFinancialPlanAllocations(actor.userId, actor.workspaceId, parsed.planId, parsed.percentages);
    refresh();
    return { ok: true as const };
  } catch (error) { return failure(error, "Không thể cập nhật tỷ lệ hũ."); }
}

export async function cancelFinancialPlanAction(planId: unknown) {
  try {
    const actor = await adminActor();
    await cancelFinancialPlan(actor.userId, actor.workspaceId, financialPlanIdSchema.parse(planId));
    refresh();
    return { ok: true as const };
  } catch (error) { return failure(error, "Không thể hủy kế hoạch."); }
}

export async function completeFinancialPlanAction(planId: unknown) {
  try {
    const actor = await adminActor();
    await completeFinancialPlan(actor.userId, actor.workspaceId, financialPlanIdSchema.parse(planId));
    refresh();
    return { ok: true as const };
  } catch (error) { return failure(error, "Không thể hoàn thành kế hoạch."); }
}
