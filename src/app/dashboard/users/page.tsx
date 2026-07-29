import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { MemberAccountForm } from "@/app/dashboard/users/member-account-form";
import { ADMIN_ROLE_CODES } from "@/domain/role-policy";
import { prisma } from "@/lib/prisma";

import { PageContainer } from "@/components/base";

export default async function MemberAccountsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");
  const workspaces = await prisma.workspaceMember.findMany({
    where: { userId: session.user.id, status: "active", deletedAt: null, role: { code: { in: [...ADMIN_ROLE_CODES] } }, workspace: { status: "active", deletedAt: null } },
    include: { workspace: { select: { id: true, name: true } } },
    orderBy: { workspace: { name: "asc" } },
  });
  if (workspaces.length === 0) redirect("/overview");
  return <PageContainer className="workspace-settings-page"><div className="workspace-settings-container"><MemberAccountForm workspaces={workspaces.map((item) => item.workspace)}/></div></PageContainer>;
}
