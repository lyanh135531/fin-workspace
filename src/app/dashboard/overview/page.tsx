import Decimal from "decimal.js";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { OverviewDashboard } from "@/app/dashboard/overview/overview-dashboard";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { availableCategoryWhere } from "@/services/category-visibility";
import { currentExpensePeriod } from "@/services/monthly-workspace-service";
import { activateDueScheduledTransactions } from "@/services/transaction-service";

function recentPeriods(count: number) {
  const [year, month] = currentExpensePeriod().split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - count + index, 1));
    return date.toISOString().slice(0, 7);
  });
}

export default async function OverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) return <p>Không có workspace đang hoạt động.</p>;

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id, workspaceId, status: "active", deletedAt: null, workspace: { status: "active", deletedAt: null } },
    include: { workspace: true },
  });
  if (!membership) return <p>Không có workspace đang hoạt động.</p>;
  await activateDueScheduledTransactions(workspaceId);

  const periods = recentPeriods(12);
  const [walletLinks, categories, members, transactions, monthlyWorkspaces] = await Promise.all([
    prisma.workspaceWallet.findMany({ where: { workspaceId, wallet: { status: "active", deletedAt: null } }, include: { wallet: true }, orderBy: { wallet: { name: "asc" } } }),
    prisma.category.findMany({ where: availableCategoryWhere(workspaceId), select: { id: true, name: true, color: true }, orderBy: { sortOrder: "asc" } }),
    prisma.workspaceMember.findMany({ where: { workspaceId, status: "active", deletedAt: null }, select: { id: true, user: { select: { username: true } } }, orderBy: { user: { username: "asc" } } }),
    prisma.transaction.findMany({
      where: { deletedAt: null, member: { workspaceId } },
      include: { wallet: { select: { name: true } }, category: { select: { name: true, color: true } }, member: { include: { user: { select: { username: true } } } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.monthlyWorkspace.findMany({
      where: { userId: session.user.id, period: { in: periods }, workspace: { deletedAt: null } },
      select: {
        period: true,
        workspace: {
          select: {
            wallets: {
              where: { wallet: { status: "active", deletedAt: null } },
              select: { wallet: { select: { currentBalance: true } } },
            },
            members: {
              select: {
                transactions: {
                  where: { type: "expense", workflowStatus: "approved", deletedAt: null },
                  select: { amount: true, date: true },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const monthlyWorkspaceByPeriod = new Map(monthlyWorkspaces.map((item) => [item.period, item]));
  const monthlyFinancials = periods.map((period) => {
    const monthlyWorkspace = monthlyWorkspaceByPeriod.get(period);
    const balance = monthlyWorkspace?.workspace.wallets.reduce(
      (total, link) => total.plus(link.wallet.currentBalance.toString()),
      new Decimal(0),
    ) ?? new Decimal(0);
    const expense = monthlyWorkspace?.workspace.members.flatMap((member) => member.transactions)
      .filter((transaction) => transaction.date.toISOString().slice(0, 7) === period)
      .reduce((total, transaction) => total.plus(transaction.amount.toString()), new Decimal(0)) ?? new Decimal(0);
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
