"use server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/auth";
import { idSchema } from "@/domain/common/schemas";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { activeWorkspaceCookie } from "@/services/active-workspace";
export async function selectWorkspaceAction(workspaceId: string) { const session=await getServerSession(authOptions);if(!session?.user?.id)throw new AppError("AUTHENTICATION_REQUIRED","Please sign in.");const id=idSchema.parse(workspaceId);const member=await prisma.workspaceMember.findFirst({where:{userId:session.user.id,workspaceId:id,status:"active",deletedAt:null,workspace:{status:"active",deletedAt:null}}});if(!member)throw new AppError("FORBIDDEN","You do not have access to this workspace.");const store=await cookies();store.set(activeWorkspaceCookie,id,{httpOnly:true,sameSite:"lax",path:"/"});revalidatePath("/overview");revalidatePath(`/workspace/${id}`);revalidatePath("/settings/workspace");return {ok:true}; }
