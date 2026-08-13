import Decimal from "decimal.js";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { WalletManagement } from "@/app/dashboard/wallets/wallet-management";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { isAdminRole } from "@/domain/role-policy";
import { PageContainer } from "@/components/base";

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
    include: {
      wallet: {
        include: {
          _count: {
            select: {
              sourceTransactions: { where: { deletedAt: null } },
              destinationTransactions: { where: { deletedAt: null } },
              sourceRecurringTransactions: { where: { deletedAt: null, workspaceId } },
              destinationRecurringTransactions: { where: { deletedAt: null, workspaceId } },
            },
          },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { wallet: { name: "asc" } }],
  });
  const totalBalance = links.filter(({ wallet }) => wallet.status === "active").reduce((total, { wallet }) => total.plus(wallet.currentBalance.toString()), new Decimal(0));
  return (
    <PageContainer className="wallets-page-container">
      <div className="min-[901px]:mx-auto min-[901px]:max-w-[76rem]">
        <WalletManagement
          key={links
            .map(
              ({ wallet, sortOrder }) =>
                `${wallet.id}:${wallet.updatedAt.toISOString()}:${sortOrder}`,
            )
            .join("|")}
          workspace={{
            name: membership.workspace.name,
            currency: membership.workspace.baseCurrency,
          }}
          totalBalance={totalBalance.toString()}
          isAdmin={isAdminRole(membership.role.code)}
          wallets={links.map(({ wallet }) => ({
            id: wallet.id,
            name: wallet.name,
            description: wallet.description,
            openingBalance: wallet.openingBalance.toString(),
            currentBalance: wallet.currentBalance.toString(),
            status: wallet.status,
            transactionCount:
              wallet._count.sourceTransactions +
              wallet._count.destinationTransactions,
            recurringTransactionCount:
              wallet._count.sourceRecurringTransactions +
              wallet._count.destinationRecurringTransactions,
            updatedAt: wallet.updatedAt.toISOString(),
          }))}
        />
      </div>
    </PageContainer>
  );
}
