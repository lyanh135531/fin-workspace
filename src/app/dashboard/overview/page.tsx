import Decimal from "decimal.js";
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

function recentPeriods(currentPeriod: string, count: number) {
  const [year, month] = currentPeriod.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - count + index, 1));
    return date.toISOString().slice(0, 7);
  });
}

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

  const currentPeriod = getBusinessDateInTimeZone(membership.workspace.timeZone).slice(0, 7);
  const periods = recentPeriods(currentPeriod, 12);
  const [walletLinks, categories, members, transactions] = await Promise.all([
    prisma.workspaceWallet.findMany({ where: { workspaceId, wallet: { status: "active", deletedAt: null } }, include: { wallet: true }, orderBy: { wallet: { name: "asc" } } }),
    prisma.category.findMany({ where: availableCategoryWhere(workspaceId), select: { id: true, name: true, color: true }, orderBy: { sortOrder: "asc" } }),
    prisma.workspaceMember.findMany({ where: { workspaceId, status: "active", deletedAt: null }, select: { id: true, user: { select: { username: true } } }, orderBy: { user: { username: "asc" } } }),
    prisma.transaction.findMany({
      where: { deletedAt: null, member: { workspaceId } },
      include: { wallet: { select: { name: true } }, category: { select: { name: true, color: true } }, member: { include: { user: { select: { username: true } } } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const openingBalance = walletLinks.reduce(
    (total, link) => total.plus(link.wallet.openingBalance.toString()),
    new Decimal(0),
  );
  const approvedTransactions = transactions.filter((transaction) => transaction.workflowStatus === "approved");
  const monthlyFinancials = periods.map((period) => {
    const balance = approvedTransactions.reduce((total, transaction) => {
      if (transaction.date.toISOString().slice(0, 7) > period) return total;
      if (transaction.type === "income") return total.plus(transaction.amount.toString());
      if (transaction.type === "expense") return total.minus(transaction.amount.toString());
      return total;
    }, openingBalance);
    const expense = approvedTransactions
      .filter((transaction) => transaction.type === "expense" && transaction.date.toISOString().slice(0, 7) === period)
      .reduce((total, transaction) => total.plus(transaction.amount.toString()), new Decimal(0));
    return { period, balance: balance.toString(), expense: expense.toString() };
  });

  const totalByCurrency = walletLinks.reduce<Record<string, string>>((totals, { wallet }) => {
    // Wallets currently inherit the workspace base currency; preserve the per-currency shape for future support.
    totals[membership.workspace.baseCurrency] = new Decimal(totals[membership.workspace.baseCurrency] ?? 0).plus(wallet.currentBalance.toString()).toString();
    return totals;
  }, {});

  return <OverviewDashboard
    workspace={{ id: workspaceId, name: membership.workspace.name, currency: membership.workspace.baseCurrency }}
    wallets={walletLinks.map(({ wallet }) => ({ id: wallet.id, name: wallet.name, balance: wallet.currentBalance.toString(), updatedAt: wallet.updatedAt.toISOString() }))}
    totalByCurrency={totalByCurrency}
    categories={categories}
    members={members.map((member) => ({ id: member.id, name: member.user.username }))}
    transactions={transactions.map((transaction) => ({ id: transaction.id, amount: transaction.amount.toString(), type: transaction.type, status: transaction.workflowStatus, description: transaction.description, date: transaction.date.toISOString(), walletId: transaction.walletId, toWalletId: transaction.toWalletId, wallet: transaction.wallet.name, categoryId: transaction.categoryId, category: transaction.category, memberId: transaction.memberId, member: transaction.member.user.username }))}
    monthlyFinancials={monthlyFinancials}
  />;
}
