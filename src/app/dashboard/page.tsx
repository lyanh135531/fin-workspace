import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { DashboardLedgerWorkspace } from "@/app/dashboard/dashboard-ledger-workspace";
import { buildLedgerPeriodSummaries } from "@/app/dashboard/dashboard-summary-data";
import { NoWorkspaceOnboarding } from "@/components/no-workspace-onboarding";
import { isAdminRole } from "@/domain/role-policy";
import { availableCategoryWhere } from "@/services/category-visibility";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { getUserJoinRequests } from "@/services/join-request-query";
import { activateDueScheduledTransactions } from "@/services/transaction-service";

const LEDGER_PAGE_SIZE = 20;

export async function WorkspaceDashboard({
  targetWorkspaceId,
  startWithNewTransaction = false,
}: {
  targetWorkspaceId?: string;
  startWithNewTransaction?: boolean;
} = {}) {
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
        toWallet: { select: { name: true } },
        category: { select: { name: true, color: true } },
        member: { include: { user: { select: { username: true } } } },
        changeRequests: { where: { status: "pending" }, select: { id: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);
  const totalTransactions = transactions.length;
  const summaries = buildLedgerPeriodSummaries(transactions, currentPeriod);
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
  return <DashboardLedgerWorkspace
    initialMonth={currentPeriod}
    summaries={summaries}
    wallets={walletLinks.map(({ wallet }) => ({ id: wallet.id, name: wallet.name, balance: wallet.currentBalance.toString() }))}
    ledgerProps={{
      workspaceId,
      businessDate,
      initialMonth: currentPeriod,
      transactions: ledger,
      totalTransactions,
      pageSize: LEDGER_PAGE_SIZE,
      isAdmin,
      canEditTransactions: true,
      canApprove: isAdmin,
      scopeLabel: "workspace này",
      wallets: walletLinks.map(({ wallet }) => ({ id: wallet.id, name: wallet.name })),
      categories,
      canManageWallets: isAdmin,
      startWithNewTransaction,
    }}
  />;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string | string[] }>;
}) {
  const { action } = await searchParams;
  return <WorkspaceDashboard startWithNewTransaction={action === "new-transaction"} />;
}
