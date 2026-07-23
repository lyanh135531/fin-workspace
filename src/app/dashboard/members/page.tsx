import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { SettingsClient } from "@/app/dashboard/settings/settings-client";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { isAdminRole } from "@/domain/role-policy";

export default async function MembersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) redirect("/overview");

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id, workspaceId, status: "active", deletedAt: null },
    include: { workspace: { select: { name: true } }, role: true },
  });
  if (!membership) redirect("/overview");

  const isAdmin = isAdminRole(membership.role.code);

  const [roles, members] = await Promise.all([
    prisma.role.findMany({ select: { code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.workspaceMember.findMany({
      where: { workspaceId, status: "active", deletedAt: null },
      include: {
        user: { select: { username: true } },
        role: { select: { code: true } },
      },
      orderBy: { user: { username: "asc" } },
    }),
  ]);

  return (
    <div className="workspace-settings-page">
      <div className="workspace-settings-container">
        <header className="settings-hero">
          <div>
            <p className="settings-eyebrow">Quản lý thành viên</p>
            <h1>{membership.workspace.name}</h1>
            <p className="settings-hero-copy">
              Quản lý vai trò và quyền hoạt động của các thành viên trong workspace.
            </p>
          </div>
          <div className="settings-summary" aria-label="Tổng quan">
            <span><strong>{members.length}</strong> thành viên</span>
            <span className={isAdmin ? "settings-role settings-role-admin" : "settings-role"}>
              {isAdmin ? "Quản trị viên" : "Thành viên"}
            </span>
          </div>
        </header>

        <SettingsClient
          roles={roles}
          isAdmin={isAdmin}
          members={members.map((member) => ({
            id: member.id,
            username: member.user.username,
            roleCode: member.role.code,
            isSelf: member.userId === session.user.id,
          }))}
        />
      </div>
    </div>
  );
}
