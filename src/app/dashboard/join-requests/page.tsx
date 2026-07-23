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
  return <div className="workspace-settings-page"><div className="workspace-settings-container"><header className="settings-hero"><div><p className="settings-eyebrow">Quản lý workspace</p><h1>Yêu cầu tham gia</h1><p className="settings-hero-copy">{member.workspace.name}</p></div></header><JoinRequestsClient roles={roles} requests={requests.map((request) => ({ id: request.id, username: request.requester.username }))}/></div></div>;
}
