import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { MemberAccountForm } from "@/app/dashboard/users/member-account-form";
import { prisma } from "@/lib/prisma";
export default async function MemberAccountsPage() { const session = await getServerSession(authOptions); if (!session?.user?.id) redirect("/sign-in"); const workspaces = await prisma.workspaceMember.findMany({ where: { userId: session.user.id, status: "active", deletedAt: null, role: { code: "ADMIN" }, workspace: { status: "active", deletedAt: null } }, include: { workspace: { select: { id: true, name: true } } }, orderBy: { workspace: { name: "asc" } } }); if (workspaces.length === 0) redirect("/dashboard"); return <main className="app-shell min-h-[100dvh] p-4 sm:p-8"><div className="mx-auto max-w-4xl"><a href="/dashboard" className="settings-back">← Quay lại sổ thu chi</a><div className="mt-6"><MemberAccountForm workspaces={workspaces.map((item) => item.workspace)}/></div></div></main>; }
