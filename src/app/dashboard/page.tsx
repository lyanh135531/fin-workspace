import Decimal from "decimal.js";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { Ledger } from "@/app/dashboard/dashboard-actions";
import { DashboardSummaryPanel } from "@/app/dashboard/dashboard-summary-panel";
import { isAdminRole } from "@/domain/role-policy";
import { availableCategoryWhere } from "@/services/category-visibility";
import { formatAmount } from "@/lib/format";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { activateDueScheduledTransactions } from "@/services/transaction-service";

export async function WorkspaceDashboard({ targetWorkspaceId }: { targetWorkspaceId?: string } = {}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");

  const workspaceId = targetWorkspaceId ?? await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) return <p>Không có workspace đang hoạt động.</p>;

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
  if (!membership) return <p>Không có quyền xem workspace này.</p>;

  await activateDueScheduledTransactions(workspaceId);
  const currentPeriod = getBusinessDateInTimeZone(membership.workspace.timeZone).slice(0, 7);

  const [walletLinks, categories, transactions] = await Promise.all([
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
        category: { select: { name: true, color: true } },
        member: { include: { user: { select: { username: true } } } },
        changeRequests: { where: { status: "pending" }, select: { id: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
  ]);

  const currentMonthTransactions = transactions.filter((item) => item.date.toISOString().slice(0, 7) === currentPeriod);
  const approved = currentMonthTransactions.filter((item) => item.workflowStatus === "approved");
  const income = approved
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum.plus(item.amount.toString()), new Decimal(0));
  const expense = approved
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum.plus(item.amount.toString()), new Decimal(0));
  const balance = walletLinks.reduce(
    (sum, item) => sum.plus(item.wallet.currentBalance.toString()),
    new Decimal(0),
  );
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
    category: item.category ? { name: item.category.name, color: item.category.color } : null,
    member: item.member.user.username,
    hasPendingChange: item.changeRequests.length > 0,
    isRecurring: Boolean(item.recurringTransactionId),
  }));
  const pendingCount = transactions.filter((item) => item.workflowStatus === "pending").length;
  const isAdmin = isAdminRole(membership.role.code);

  return (
    <div className="dashboard-workspace-view">
      <div className="dashboard-ledger-column">
        <section className="sunrise-card dashboard-ledger-card overflow-hidden">
          <Ledger
            workspaceId={workspaceId}
            transactions={ledger}
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
      <DashboardSummaryPanel
        metrics={[
          { label: "Tổng số dư", value: `${formatAmount(balance)} ₫`, note: `${walletLinks.length} ví đang hoạt động`, tone: "balance" },
          { label: "Thu nhập", value: `${formatAmount(income)} ₫`, note: "Tháng hiện tại", tone: "income" },
          { label: "Chi tiêu", value: `${formatAmount(expense)} ₫`, note: "Tháng hiện tại", tone: "expense" },
          { label: "Chờ xác nhận", value: `${pendingCount} giao dịch`, note: "Chưa thay đổi số dư", tone: "pending" },
        ]}
        wallets={walletLinks.map(({ wallet }) => ({ id: wallet.id, name: wallet.name, balance: `${formatAmount(wallet.currentBalance.toString())} ₫` }))}
      />
    </div>
  );
}

export default WorkspaceDashboard;
