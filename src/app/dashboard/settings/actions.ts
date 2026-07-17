"use server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/auth";
import { idSchema } from "@/domain/common/schemas";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { changeWorkspaceMemberRole, deactivateWorkspaceMember } from "@/services/member-management-service";
import { inviteUserToWorkspace, respondToWorkspaceInvitation } from "@/services/invitation-service";
import { createWorkspaceForUser, updateWorkspaceSettings } from "@/services/workspace-service";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
const inviteSchema=z.object({username:z.string().trim().min(3).max(80),roleCode:z.string().trim().min(1).max(40)});const roleSchema=z.object({memberId:idSchema,roleCode:z.string().trim().min(1).max(40)});
const workspaceSchema=z.object({name:z.string().trim().min(3).max(120),description:z.string().trim().max(500).optional(),baseCurrency:z.literal("VND"),timeZone:z.literal("Asia/Ho_Chi_Minh"),approvalRequired:z.boolean(),status:z.enum(["active","deactive"])});
async function adminActor(){const session=await getServerSession(authOptions);if(!session?.user?.id)throw new AppError("AUTHENTICATION_REQUIRED","Please sign in.");const workspaceId=await resolveActiveWorkspaceId(session.user.id);const member=workspaceId?await prisma.workspaceMember.findFirst({where:{userId:session.user.id,workspaceId,status:"active",deletedAt:null,role:{code:"ADMIN"},workspace:{status:"active",deletedAt:null}}}):null;if(!member)throw new AppError("FORBIDDEN","Only workspace administrators can manage users.");return {userId:session.user.id,workspaceId:member.workspaceId};}
function fail(error:unknown){return {ok:false,message:error instanceof Error?error.message:"Unable to save changes."};}
export async function inviteUserAction(input:unknown){try{const actor=await adminActor();const data=inviteSchema.parse(input);await inviteUserToWorkspace(actor.userId,actor.workspaceId,data.username,data.roleCode);revalidatePath("/dashboard/settings");return {ok:true,message:null};}catch(error){return fail(error);}}
export async function changeMemberRoleAction(input:unknown){try{const actor=await adminActor();const data=roleSchema.parse(input);await changeWorkspaceMemberRole(actor.userId,actor.workspaceId,data.memberId,data.roleCode);revalidatePath("/dashboard/settings");revalidatePath("/dashboard");return {ok:true,message:null};}catch(error){return fail(error);}}
export async function removeMemberAction(input:unknown){try{const actor=await adminActor();const memberId=idSchema.parse(input);await deactivateWorkspaceMember(actor.userId,actor.workspaceId,memberId);revalidatePath("/dashboard/settings");revalidatePath("/dashboard");return {ok:true,message:null};}catch(error){return fail(error);}}
export async function createWorkspaceAction(input:unknown){try{const session=await getServerSession(authOptions);if(!session?.user?.id)throw new AppError("AUTHENTICATION_REQUIRED","Please sign in.");const data=workspaceSchema.omit({status:true}).parse(input);const workspace=await createWorkspaceForUser(session.user.id,{...data,description:data.description||undefined});revalidatePath("/dashboard");revalidatePath("/dashboard/settings");return {ok:true,message:null,workspaceId:workspace.id};}catch(error){return fail(error);}}
export async function updateWorkspaceSettingsAction(input:unknown){try{const actor=await adminActor();const data=workspaceSchema.parse(input);await updateWorkspaceSettings(actor.userId,actor.workspaceId,{...data,description:data.description||undefined});revalidatePath("/dashboard/settings");revalidatePath("/dashboard");return {ok:true,message:null};}catch(error){return fail(error);}}
export async function respondInvitationAction(input:unknown){try{const session=await getServerSession(authOptions);if(!session?.user?.id)throw new AppError("AUTHENTICATION_REQUIRED","Please sign in.");const data=z.object({invitationId:idSchema,accept:z.boolean()}).parse(input);await respondToWorkspaceInvitation(session.user.id,data.invitationId,data.accept);revalidatePath("/dashboard/settings");revalidatePath("/dashboard");return {ok:true,message:null};}catch(error){return fail(error);}}
