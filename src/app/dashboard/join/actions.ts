"use server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/auth";
import { idSchema } from "@/domain/common/schemas";
import { AppError } from "@/lib/errors";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { requestWorkspaceJoin, reviewWorkspaceJoinRequest } from "@/services/join-request-service";
function fail(e:unknown){return {ok:false,message:e instanceof Error?e.message:"Không thể xử lý yêu cầu."};}
export async function requestJoinAction(input:unknown){try{const s=await getServerSession(authOptions);if(!s?.user?.id)throw new AppError("AUTHENTICATION_REQUIRED","Please sign in.");await requestWorkspaceJoin(s.user.id,z.object({inviteCode:z.string().trim().min(8).max(36)}).parse(input).inviteCode);revalidatePath("/dashboard/join");return {ok:true,message:null};}catch(e){return fail(e);}}
export async function reviewJoinAction(input:unknown){try{const s=await getServerSession(authOptions);if(!s?.user?.id)throw new AppError("AUTHENTICATION_REQUIRED","Please sign in.");const d=z.object({requestId:idSchema,approve:z.boolean()}).parse(input);const workspaceId=await resolveActiveWorkspaceId(s.user.id);if(!workspaceId)throw new AppError("FORBIDDEN","No active workspace.");await reviewWorkspaceJoinRequest(s.user.id,workspaceId,d.requestId,d.approve);revalidatePath("/dashboard/join-requests");revalidatePath("/dashboard/settings");return {ok:true,message:null};}catch(e){return fail(e);}}
