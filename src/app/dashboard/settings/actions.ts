"use server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { authOptions } from "@/auth";
import { idSchema } from "@/domain/common/schemas";
import { AppError } from "@/lib/errors";
import { changeWorkspaceMemberRole, deactivateWorkspaceMember } from "@/services/member-management-service";
import { createWorkspaceForUser, deleteWorkspaceForUser, updateWorkspaceSettings } from "@/services/workspace-service";
import { activeWorkspaceCookie, resolveActiveWorkspaceId } from "@/services/active-workspace";
import { requireWorkspaceMember } from "@/services/workspace-access";

const roleSchema = z.object({ memberId: idSchema, roleCode: z.string().trim().min(1).max(40) });
const workspaceSchema = z.object({ name: z.string().trim().min(3).max(120), description: z.string().trim().max(500).optional(), baseCurrency: z.literal("VND"), timeZone: z.literal("Asia/Ho_Chi_Minh"), approvalRequired: z.boolean(), status: z.enum(["active", "deactive"]) });

async function adminActor() { const session = await getServerSession(authOptions); if (!session?.user?.id) throw new AppError("AUTHENTICATION_REQUIRED", "Please sign in."); const workspaceId = await resolveActiveWorkspaceId(session.user.id); if (!workspaceId) throw new AppError("FORBIDDEN", "Only workspace administrators can manage users."); const member = await requireWorkspaceMember(session.user.id, workspaceId, true); return { userId: session.user.id, workspaceId: member.workspaceId }; }
function fail(error: unknown) { return { ok: false, message: error instanceof Error ? error.message : "Unable to save changes." }; }

export async function changeMemberRoleAction(input: unknown) { try { const actor = await adminActor(); const data = roleSchema.parse(input); await changeWorkspaceMemberRole(actor.userId, actor.workspaceId, data.memberId, data.roleCode); revalidatePath("/dashboard/settings"); revalidatePath("/dashboard"); return { ok: true, message: null }; } catch (error) { return fail(error); } }
export async function removeMemberAction(input: unknown) { try { const actor = await adminActor(); const memberId = idSchema.parse(input); await deactivateWorkspaceMember(actor.userId, actor.workspaceId, memberId); revalidatePath("/dashboard/settings"); revalidatePath("/dashboard"); return { ok: true, message: null }; } catch (error) { return fail(error); } }

export async function createWorkspaceAction(input: unknown) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new AppError("AUTHENTICATION_REQUIRED", "Please sign in.");
    const data = workspaceSchema.omit({ status: true }).parse(input);
    const workspace = await createWorkspaceForUser(session.user.id, { ...data, description: data.description || undefined });
    
    const store = await cookies();
    store.set(activeWorkspaceCookie, workspace.id, { path: "/" });

    revalidatePath("/dashboard");
    revalidatePath("/overview");
    revalidatePath("/settings/workspace");
    return { ok: true, message: null, workspaceId: workspace.id };
  } catch (error) {
    return fail(error);
  }
}

export async function updateWorkspaceSettingsAction(input: unknown) { try { const actor = await adminActor(); const data = workspaceSchema.parse(input); await updateWorkspaceSettings(actor.userId, actor.workspaceId, { ...data, description: data.description || undefined }); revalidatePath("/dashboard/settings"); revalidatePath("/dashboard"); return { ok: true, message: null }; } catch (error) { return fail(error); } }
export async function deleteWorkspaceAction() { try { const actor = await adminActor(); await deleteWorkspaceForUser(actor.userId, actor.workspaceId); revalidatePath("/overview"); revalidatePath("/settings/workspace"); return { ok: true, message: null }; } catch (error) { return fail(error); } }

