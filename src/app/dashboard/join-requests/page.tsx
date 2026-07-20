import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { JoinRequestsClient } from "@/app/dashboard/join-requests/requests-client";
export default async function JoinRequestsPage(){const s=await getServerSession(authOptions);if(!s?.user?.id)redirect("/sign-in");const workspaceId=await resolveActiveWorkspaceId(s.user.id);if(!workspaceId)redirect("/dashboard");const member=await prisma.workspaceMember.findFirst({where:{userId:s.user.id,workspaceId,status:"active",deletedAt:null},include:{workspace:true,role:true}});if(!member||member.role.code!=="ADMIN")redirect("/dashboard");const [requests,roles]=await Promise.all([prisma.workspaceJoinRequest.findMany({where:{workspaceId,status:"pending"},include:{requester:{select:{username:true}}},orderBy:{createdAt:"asc"}}),prisma.role.findMany({select:{code:true,name:true}})]);return <div className="mx-auto max-w-3xl"><a href="/dashboard/settings" className="text-sm text-slate-500">← Cài đặt</a><h1 className="mt-6 text-3xl font-semibold">Yêu cầu tham gia</h1><p className="mt-2 text-sm text-slate-500">{member.workspace.name}</p><JoinRequestsClient roles={roles} requests={requests.map(r=>({id:r.id,username:r.requester.username}))}/></div>}
