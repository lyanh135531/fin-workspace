import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { JoinRequestsClient } from "@/app/dashboard/join-requests/requests-client";
import { isAdminRole } from "@/domain/role-policy";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";

export default async function JoinRequestsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) redirect("/dashboard");
  const member = await prisma.workspaceMember.findFirst({ where: { userId: session.user.id, workspaceId, status: "active", deletedAt: null }, include: { workspace: true, role: true } });
  if (!member || !isAdminRole(member.role.code)) redirect("/dashboard");
  const [requests, roles] = await Promise.all([
    prisma.workspaceJoinRequest.findMany({ where: { workspaceId, status: "pending" }, include: { requester: { select: { username: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.role.findMany({ select: { code: true, name: true } }),
  ]);
  return <div className="mx-auto max-w-3xl"><a href="/dashboard/settings" className="text-sm text-slate-500">← Quay lại dashboard</a><h1 className="mt-6 text-3xl font-semibold">Yêu cầu tham gia</h1><p className="mt-2 text-sm text-slate-500">{member.workspace.name}</p><JoinRequestsClient roles={roles} requests={requests.map((request) => ({ id: request.id, username: request.requester.username }))}/></div>;
}
