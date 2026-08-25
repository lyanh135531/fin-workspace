"use server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/auth";
import { idSchema } from "@/domain/common/schemas";
import { workspaceRoleCodeSchema } from "@/domain/role-policy";
import { AppError } from "@/lib/errors";
import { toActionFailure } from "@/lib/server-error";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { requestWorkspaceJoin, reviewWorkspaceJoinRequest } from "@/services/join-request-service";
function fail(e:unknown,event:string){return toActionFailure(e,"Không thể xử lý yêu cầu.",{event});}
export async function requestJoinAction(input:unknown){try{const s=await getServerSession(authOptions);if(!s?.user?.id)throw new AppError("AUTHENTICATION_REQUIRED","Vui lòng đăng nhập.");await requestWorkspaceJoin(s.user.id,z.object({inviteCode:z.string().trim().min(6).max(36)}).parse(input).inviteCode);revalidatePath("/dashboard/join");revalidatePath("/settings/join");revalidatePath("/onboarding");return {ok:true,message:null};}catch(e){return fail(e,"workspace.join_request_failed");}}
export async function reviewJoinAction(input:unknown){try{const s=await getServerSession(authOptions);if(!s?.user?.id)throw new AppError("AUTHENTICATION_REQUIRED","Vui lòng đăng nhập.");const d=z.object({requestId:idSchema,approve:z.boolean(),roleCode:workspaceRoleCodeSchema.optional()}).parse(input);const workspaceId=await resolveActiveWorkspaceId(s.user.id);if(!workspaceId)throw new AppError("FORBIDDEN","Không có nhóm tài chính đang hoạt động.");await reviewWorkspaceJoinRequest(s.user.id,workspaceId,d.requestId,d.approve,d.roleCode);revalidatePath("/dashboard/join-requests");revalidatePath("/dashboard/settings");revalidatePath("/settings/workspace");revalidatePath("/", "layout");return {ok:true,message:null};}catch(e){return fail(e,"workspace.join_review_failed");}}
