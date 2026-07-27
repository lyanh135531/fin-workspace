import Decimal from "decimal.js";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { Ledger } from "@/app/dashboard/dashboard-actions";
import { DashboardSummaryPanel } from "@/app/dashboard/dashboard-summary-panel";
import { NoWorkspaceOnboarding } from "@/components/no-workspace-onboarding";
import { isAdminRole } from "@/domain/role-policy";
import { availableCategoryWhere } from "@/services/category-visibility";
import { formatAmount } from "@/lib/format";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { getUserJoinRequests } from "@/services/join-request-query";
import { activateDueScheduledTransactions } from "@/services/transaction-service";

const LEDGER_PAGE_SIZE = 20;

export async function WorkspaceDashboard({ targetWorkspaceId }: { targetWorkspaceId?: string } = {}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");

  const workspaceId = targetWorkspaceId ?? await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) {
    const joinRequests = await getUserJoinRequests(session.user.id);
    return <NoWorkspaceOnboarding username={session.user.username ?? "User"} joinRequests={joinRequests} />;
  }

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
  if (!membership) {
    const joinRequests = await getUserJoinRequests(session.user.id);
    return <NoWorkspaceOnboarding username={session.user.username ?? "User"} joinRequests={joinRequests} />;
  }

  await activateDueScheduledTransactions(workspaceId);
  const businessDate = getBusinessDateInTimeZone(membership.workspace.timeZone);
  const currentPeriod = businessDate.slice(0, 7);
  const [currentYear, currentMonth] = currentPeriod.split("-").map(Number);
  const periodStart = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
  const nextPeriodStart = new Date(Date.UTC(currentYear, currentMonth, 1));

  const [walletLinks, categories, transactions, currentMonthTransactions, pendingCount] = await Promise.all([
    prisma.workspaceWallet.findMany({
      where: { workspaceId, wallet: { status: "active", deletedAt: null } },
      include: { wallet: true },
      orderBy: { wallet: { name: "asc" } },
    }),
    prisma.category.findMany({
      where: availableCategoryWhere(workspaceId),
      select: { id: true, name: true, color: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.transaction.findMany({
      where: { deletedAt: null, member: { workspaceId } },
      include: {
        wallet: { select: { name: true } },
        toWallet: { select: { name: true } },
        category: { select: { name: true, color: true } },
        member: { include: { user: { select: { username: true } } } },
        changeRequests: { where: { status: "pending" }, select: { id: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.transaction.findMany({
      where: {
        deletedAt: null,
        member: { workspaceId },
        workflowStatus: "approved",
        date: { gte: periodStart, lt: nextPeriodStart },
      },
      select: { amount: true, type: true },
    }),
    prisma.transaction.count({
      where: { deletedAt: null, member: { workspaceId }, workflowStatus: "pending" },
    }),
  ]);
  const totalTransactions = transactions.length;
  const income = currentMonthTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum.plus(item.amount.toString()), new Decimal(0));
  const expense = currentMonthTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum.plus(item.amount.toString()), new Decimal(0));
  const balance = walletLinks.reduce(
    (sum, item) => sum.plus(item.wallet.currentBalance.toString()),
    new Decimal(0),
  );
  const isAdmin = isAdminRole(membership.role.code);
  const ledger = transactions.map((item) => ({
    id: item.id,
    amount: item.amount.toString(),
    type: item.type,
    status: item.workflowStatus,
    description: item.description,
    date: item.date.toISOString(),
    walletId: item.walletId,
    toWalletId: item.toWalletId,
    categoryId: item.categoryId,
    wallet: item.wallet.name,
    toWallet: item.toWallet?.name ?? null,
    category: item.category ? { name: item.category.name, color: item.category.color } : null,
    member: item.member.user.username,
    canRequestDelete: isAdmin || item.memberId === membership.id,
    hasPendingChange: item.changeRequests.length > 0,
    isRecurring: Boolean(item.recurringTransactionId),
  }));
  return (
    <div className="dashboard-workspace-view">
      <div className="dashboard-ledger-column">
        <DashboardSummaryPanel
          metrics={[
            { label: "Tổng số dư", value: `${formatAmount(balance)} ₫`, note: `${walletLinks.length} ví đang hoạt động`, tone: "balance" },
            { label: "Thu nhập", value: `${formatAmount(income)} ₫`, note: "Tháng hiện tại", tone: "income" },
            { label: "Chi tiêu", value: `${formatAmount(expense)} ₫`, note: "Tháng hiện tại", tone: "expense" },
            { label: "Chờ xác nhận", value: `${pendingCount} giao dịch`, note: "Chưa thay đổi số dư", tone: "pending" },
          ]}
          wallets={walletLinks.map(({ wallet }) => ({ id: wallet.id, name: wallet.name, balance: `${formatAmount(wallet.currentBalance.toString())} ₫` }))}
        />
        <section className="sunrise-card dashboard-ledger-card overflow-hidden">
          <Ledger
            workspaceId={workspaceId}
            businessDate={businessDate}
            initialMonth={currentPeriod}
            transactions={ledger}
            totalTransactions={totalTransactions}
            pageSize={LEDGER_PAGE_SIZE}
            isAdmin={isAdmin}
            canEditTransactions
            canApprove={isAdmin}
            scopeLabel="workspace này"
            wallets={walletLinks.map(({ wallet }) => ({ id: wallet.id, name: wallet.name }))}
            categories={categories}
            canManageWallets={isAdmin}
          />
        </section>
      </div>
    </div>
  );
}

export default WorkspaceDashboard;
