import Decimal from "decimal.js";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { WalletManagement } from "@/app/dashboard/wallets/wallet-management";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";

export default async function WalletsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) redirect("/overview");
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id, workspaceId, status: "active", deletedAt: null, workspace: { status: "active", deletedAt: null } },
    include: { workspace: true, role: true },
  });
  if (!membership) redirect("/overview");
  const links = await prisma.workspaceWallet.findMany({
    where: { workspaceId, wallet: { deletedAt: null } },
    include: { wallet: { include: { _count: { select: { sourceTransactions: { where: { deletedAt: null } }, destinationTransactions: { where: { deletedAt: null } } } } } } },
    orderBy: { wallet: { name: "asc" } },
  });
  const totalBalance = links.filter(({ wallet }) => wallet.status === "active").reduce((total, { wallet }) => total.plus(wallet.currentBalance.toString()), new Decimal(0));
  return <WalletManagement
    workspace={{ name: membership.workspace.name, currency: membership.workspace.baseCurrency }}
    totalBalance={totalBalance.toString()}
    isAdmin={membership.role.code === "ADMIN"}
    wallets={links.map(({ wallet }) => ({ id: wallet.id, name: wallet.name, description: wallet.description, openingBalance: wallet.openingBalance.toString(), currentBalance: wallet.currentBalance.toString(), status: wallet.status, transactionCount: wallet._count.sourceTransactions + wallet._count.destinationTransactions, updatedAt: wallet.updatedAt.toISOString() }))}
  />;
}
