import Decimal from "decimal.js";
import { redirect } from "next/navigation";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { OverviewDashboard } from "@/app/dashboard/overview/overview-dashboard";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { availableCategoryWhere } from "@/services/category-visibility";
import { activateDueScheduledTransactionsForRequest } from "@/services/transaction-service";

import { PageContainer } from "@/components/base";

export default async function OverviewPage() {
  const session = await requireAcceptedLegalPageSession();
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) redirect("/onboarding");

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id, workspaceId, status: "active", deletedAt: null, workspace: { status: "active", deletedAt: null } },
    include: { workspace: true, role: true },
  });
  if (!membership) redirect("/onboarding");

  await activateDueScheduledTransactionsForRequest(workspaceId);
  const businessDate = getBusinessDateInTimeZone(membership.workspace.timeZone);
  const reportPeriod = businessDate.slice(0, 7);

  const [walletLinks, members, transactions, recurringRows, categories] = await Promise.all([
    prisma.workspaceWallet.findMany({ where: { workspaceId, wallet: { status: "active", deletedAt: null } }, include: { wallet: true }, orderBy: [{ sortOrder: "asc" }, { wallet: { name: "asc" } }] }),
    prisma.workspaceMember.findMany({ where: { workspaceId, status: "active", deletedAt: null }, select: { id: true, user: { select: { username: true } } }, orderBy: { user: { username: "asc" } } }),
    prisma.transaction.findMany({
      where: { deletedAt: null, member: { workspaceId } },
      include: { wallet: { select: { name: true } }, category: { select: { name: true, color: true, icon: true } }, member: { include: { user: { select: { username: true } } } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.recurringTransaction.findMany({
      where: {
        workspaceId,
        status: "active",
        deletedAt: null,
        approvalStatus: "approved",
        nextExecutionDate: { gte: new Date(businessDate) },
      },
      include: {
        wallet: { select: { name: true } },
        category: { select: { name: true, color: true, icon: true } },
      },
      orderBy: { nextExecutionDate: "asc" },
      take: 5,
    }),
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

  const totalByCurrency = walletLinks.reduce<Record<string, string>>((totals, { wallet }) => {
    // Wallets currently inherit the workspace base currency; preserve the per-currency shape for future support.
    totals[membership.workspace.baseCurrency] = new Decimal(totals[membership.workspace.baseCurrency] ?? 0).plus(wallet.currentBalance.toString()).toString();
    return totals;
  }, {});

  return (
    <PageContainer>
      <div className="min-[901px]:mx-auto min-[901px]:max-w-[76rem]">
        <OverviewDashboard
          workspace={{ id: workspaceId, name: membership.workspace.name, currency: membership.workspace.baseCurrency }}
          reportPeriod={reportPeriod}
          businessDate={businessDate}
          wallets={walletLinks.map(({ wallet }) => ({ id: wallet.id, name: wallet.name, balance: wallet.currentBalance.toString(), updatedAt: wallet.updatedAt.toISOString() }))}
          totalByCurrency={totalByCurrency}
          members={members.map((member) => ({ id: member.id, name: member.user.username ?? "Người dùng" }))}
          categories={categories.map((cat) => ({
            id: cat.id,
            name: cat.name,
            color: cat.color,
            icon: cat.icon,
            parentId: cat.parentId,
            type: cat.type as "income" | "expense",
          }))}
          transactions={transactions.map((transaction) => ({ id: transaction.id, amount: transaction.amount.toString(), type: transaction.type, status: transaction.workflowStatus, description: transaction.description, date: transaction.date.toISOString(), walletId: transaction.walletId, toWalletId: transaction.toWalletId, wallet: transaction.wallet.name, categoryId: transaction.categoryId, category: transaction.category, memberId: transaction.memberId, member: transaction.member.user.username ?? "Người dùng" }))}
          userRole={membership.role.name}
          upcomingRecurring={recurringRows.map((item) => ({
            id: item.id,
            amount: item.amount.toString(),
            type: item.type,
            description: item.description,
            nextExecutionDate: item.nextExecutionDate.toISOString(),
            wallet: item.wallet.name,
            category: item.category,
          }))}
        />
      </div>
    </PageContainer>
  );
}
