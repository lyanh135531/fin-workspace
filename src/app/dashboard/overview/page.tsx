import Decimal from "decimal.js";
import { addDays } from "date-fns";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { OverviewDashboard } from "@/app/dashboard/overview/overview-dashboard";
import { NoWorkspaceOnboarding } from "@/components/no-workspace-onboarding";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { availableCategoryWhere } from "@/services/category-visibility";
import { getUserJoinRequests } from "@/services/join-request-query";
import { activateDueScheduledTransactions } from "@/services/transaction-service";

export default async function OverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) {
    const joinRequests = await getUserJoinRequests(session.user.id);
    return <NoWorkspaceOnboarding username={session.user.username ?? "User"} joinRequests={joinRequests} />;
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id, workspaceId, status: "active", deletedAt: null, workspace: { status: "active", deletedAt: null } },
    include: { workspace: true },
  });
  if (!membership) {
    const joinRequests = await getUserJoinRequests(session.user.id);
    return <NoWorkspaceOnboarding username={session.user.username ?? "User"} joinRequests={joinRequests} />;
  }

  await activateDueScheduledTransactions(workspaceId);
  const businessDate = getBusinessDateInTimeZone(membership.workspace.timeZone);
  const reportPeriod = businessDate.slice(0, 7);
  const upcomingStartDate = new Date(`${businessDate}T00:00:00.000Z`);
  const upcomingEndDate = addDays(upcomingStartDate, 30);

  const [walletLinks, categories, members, transactions, recurringTransactions] = await Promise.all([
    prisma.workspaceWallet.findMany({ where: { workspaceId, wallet: { status: "active", deletedAt: null } }, include: { wallet: true }, orderBy: [{ sortOrder: "asc" }, { wallet: { name: "asc" } }] }),
    prisma.category.findMany({ where: availableCategoryWhere(workspaceId), select: { id: true, name: true, color: true, icon: true, parentId: true, type: true }, orderBy: { sortOrder: "asc" } }),
    prisma.workspaceMember.findMany({ where: { workspaceId, status: "active", deletedAt: null }, select: { id: true, user: { select: { username: true } } }, orderBy: { user: { username: "asc" } } }),
    prisma.transaction.findMany({
      where: { deletedAt: null, member: { workspaceId } },
      include: { wallet: { select: { name: true } }, category: { select: { name: true, color: true } }, member: { include: { user: { select: { username: true } } } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.recurringTransaction.findMany({
      where: {
        workspaceId,
        status: "active",
        deletedAt: null,
        nextExecutionDate: { gte: upcomingStartDate, lte: upcomingEndDate },
      },
      include: {
        wallet: { select: { name: true } },
      },
      orderBy: [{ nextExecutionDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const totalByCurrency = walletLinks.reduce<Record<string, string>>((totals, { wallet }) => {
    // Wallets currently inherit the workspace base currency; preserve the per-currency shape for future support.
    totals[membership.workspace.baseCurrency] = new Decimal(totals[membership.workspace.baseCurrency] ?? 0).plus(wallet.currentBalance.toString()).toString();
    return totals;
  }, {});

  return <OverviewDashboard
    workspace={{ id: workspaceId, name: membership.workspace.name, currency: membership.workspace.baseCurrency }}
    reportPeriod={reportPeriod}
    wallets={walletLinks.map(({ wallet }) => ({ id: wallet.id, name: wallet.name, balance: wallet.currentBalance.toString(), updatedAt: wallet.updatedAt.toISOString() }))}
    totalByCurrency={totalByCurrency}
    categories={categories.map((category) => ({ ...category, type: category.type as "income" | "expense" }))}
    members={members.map((member) => ({ id: member.id, name: member.user.username }))}
    transactions={transactions.map((transaction) => ({ id: transaction.id, amount: transaction.amount.toString(), type: transaction.type, status: transaction.workflowStatus, description: transaction.description, date: transaction.date.toISOString(), walletId: transaction.walletId, toWalletId: transaction.toWalletId, wallet: transaction.wallet.name, categoryId: transaction.categoryId, category: transaction.category, memberId: transaction.memberId, member: transaction.member.user.username }))}
    upcomingTransactions={[
      ...transactions
        .filter(
          (transaction) =>
            transaction.workflowStatus === "scheduled" &&
            transaction.date >= upcomingStartDate &&
            transaction.date <= upcomingEndDate,
        )
        .map((transaction) => ({
          id: transaction.id,
          source: "scheduled" as const,
          amount: transaction.amount.toString(),
          type: transaction.type,
          description: transaction.description,
          date: transaction.date.toISOString(),
          walletId: transaction.walletId,
          wallet: transaction.wallet.name,
          categoryId: transaction.categoryId,
          memberId: transaction.memberId,
        })),
      ...recurringTransactions.map((transaction) => ({
        id: transaction.id,
        source: "recurring" as const,
        amount: transaction.amount.toString(),
        type: transaction.type,
        description: transaction.description,
        date: transaction.nextExecutionDate.toISOString(),
        walletId: transaction.walletId,
        wallet: transaction.wallet.name,
        categoryId: transaction.categoryId,
        memberId: transaction.createdByMemberId,
      })),
    ].sort((left, right) => left.date.localeCompare(right.date))}
  />;
}
