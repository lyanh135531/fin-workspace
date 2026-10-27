import Decimal from "decimal.js";
import { redirect } from "next/navigation";

import { WalletManagement } from "@/app/dashboard/wallets/wallet-management";
import { PageContainer } from "@/components/base";
import { workspaceCapabilities } from "@/domain/role-policy";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { availableCategoryWhere } from "@/services/category-visibility";
import {
  getWorkspaceCreditCardCommitmentDetails,
  getWorkspaceCreditCardCommitments,
} from "@/services/credit-card-service";

const ZERO = new Decimal(0);

export default async function WalletsPage({
  searchParams,
}: {
  searchParams?: Promise<{ reservedWalletId?: string }>;
}) {
  const [session, resolvedParams] = await Promise.all([
    requireAcceptedLegalPageSession(),
    searchParams,
  ]);
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) redirect("/overview");

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: session.user.id,
      workspaceId,
      status: "active",
      deletedAt: null,
      workspace: { status: "active", deletedAt: null },
    },
    include: { workspace: true, role: true },
  });
  if (!membership) redirect("/overview");

  const [links, commitments, commitmentDetails, categories] = await Promise.all([
    prisma.workspaceWallet.findMany({
      where: { workspaceId, wallet: { deletedAt: null } },
      include: {
        wallet: {
          include: {
            _count: {
              select: {
                sourceTransactions: { where: { deletedAt: null } },
                destinationTransactions: { where: { deletedAt: null } },
                sourceRecurringTransactions: {
                  where: { deletedAt: null, workspaceId },
                },
                destinationRecurringTransactions: {
                  where: { deletedAt: null, workspaceId },
                },
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { wallet: { name: "asc" } }],
    }),
    getWorkspaceCreditCardCommitments(workspaceId),
    getWorkspaceCreditCardCommitmentDetails(workspaceId),
    prisma.category.findMany({
      where: availableCategoryWhere(workspaceId),
      select: {
        id: true,
        name: true,
        color: true,
        icon: true,
        parentId: true,
        type: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const totalBalance = links
    .filter(({ wallet }) => wallet.status === "active" && wallet.kind !== "credit_card")
    .reduce((total, { wallet }) => {
      const committed = commitments.get(wallet.id) ?? ZERO;
      return total.plus(wallet.currentBalance.toString()).minus(committed);
    }, ZERO);

  return (
    <PageContainer className="wallets-page-container">
      <WalletManagement
        key={workspaceId}
        workspace={{
          name: membership.workspace.name,
          currency: membership.workspace.baseCurrency,
        }}
        totalBalance={totalBalance.toString()}
        isAdmin={workspaceCapabilities(membership.role.code).canManageWallets}
        commitmentDetails={commitmentDetails}
        initialReservedWalletId={resolvedParams?.reservedWalletId}
        categories={categories}
        wallets={links.map(({ wallet }) => {
          const committed = commitments.get(wallet.id) ?? ZERO;
          const currentBalanceStr = wallet.currentBalance.toString();
          return {
            id: wallet.id,
            name: wallet.name,
            description: wallet.description,
            openingBalance: wallet.openingBalance.toString(),
            currentBalance: currentBalanceStr,
            status: wallet.status,
            transactionCount:
              wallet._count.sourceTransactions +
              wallet._count.destinationTransactions,
            recurringTransactionCount:
              wallet._count.sourceRecurringTransactions +
              wallet._count.destinationRecurringTransactions,
            updatedAt: wallet.updatedAt.toISOString(),
            kind: wallet.kind,
            reservedBalance:
              wallet.kind === "credit_card" ? "0" : committed.toString(),
            availableBalance:
              wallet.kind === "asset"
                ? new Decimal(currentBalanceStr).minus(committed).toString()
                : undefined,
          };
        })}
      />
    </PageContainer>
  );
}
