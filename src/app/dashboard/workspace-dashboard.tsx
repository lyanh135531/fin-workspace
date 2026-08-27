import { DashboardLedgerWorkspace } from "@/app/dashboard/dashboard-ledger-workspace";
import { buildLedgerPeriodSummaries } from "@/app/dashboard/dashboard-summary-data";
import { authOptions } from "@/auth";
import { isAdminRole } from "@/domain/role-policy";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import {
  getTransactionChangeAction,
  getTransactionChangeDetails,
  getTransactionChangeReason,
  type TransactionChangeLookups,
} from "@/lib/transaction-change-display";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { availableCategoryWhere } from "@/services/category-visibility";
import { activateDueScheduledTransactionsForRequest } from "@/services/transaction-service";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

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

  const workspaceId =
    targetWorkspaceId ?? (await resolveActiveWorkspaceId(session.user.id));
  if (!workspaceId) redirect("/onboarding");

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
  if (!membership) redirect("/onboarding");

  await activateDueScheduledTransactionsForRequest(workspaceId);
  const businessDate = getBusinessDateInTimeZone(membership.workspace.timeZone);
  const currentPeriod = businessDate.slice(0, 7);

  const [walletLinks, categories, transactions] = await Promise.all([
    prisma.workspaceWallet.findMany({
      where: { workspaceId, wallet: { status: "active", deletedAt: null } },
      include: { wallet: true },
      orderBy: [{ sortOrder: "asc" }, { wallet: { name: "asc" } }],
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
      orderBy: { sortOrder: "asc" },
    }),
    prisma.transaction.findMany({
      where: { deletedAt: null, member: { workspaceId } },
      include: {
        wallet: { select: { name: true } },
        toWallet: { select: { name: true } },
        category: { select: { name: true, color: true, icon: true } },
        member: { include: { user: { select: { username: true } } } },
        changeRequests: {
          where: { status: "pending" },
          select: {
            id: true,
            proposedData: true,
            requester: {
              select: { user: { select: { username: true } } },
            },
          },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);
  const summaries = buildLedgerPeriodSummaries(transactions, currentPeriod);
  const isAdmin = isAdminRole(membership.role.code);
  const changeLookups: TransactionChangeLookups = {
    wallets: new Map(
      walletLinks.map(({ wallet }) => [wallet.id, wallet.name] as const),
    ),
    categories: new Map(
      categories.map((category) => [category.id, category.name] as const),
    ),
  };
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
    category: item.category
      ? {
          name: item.category.name,
          color: item.category.color,
          icon: item.category.icon,
        }
      : null,
    member: item.member.user.username ?? "Người dùng",
    canRequestDelete: isAdmin || item.memberId === membership.id,
    hasPendingChange: item.changeRequests.length > 0,
    pendingChangeRequestId: item.changeRequests[0]?.id ?? null,
    pendingChangeAction: getTransactionChangeAction(
      item.changeRequests[0]?.proposedData,
    ),
    pendingChangeRequester:
      item.changeRequests[0]?.requester.user.username ?? null,
    pendingChangeReason: getTransactionChangeReason(
      item.changeRequests[0]?.proposedData,
    ),
    pendingChangeDetails: getTransactionChangeDetails(
      item.changeRequests[0]?.proposedData,
      {
        walletId: item.walletId,
        toWalletId: item.toWalletId,
        categoryId: item.categoryId,
        type: item.type,
        amount: item.amount.toString(),
        description: item.description,
        date: item.date.toISOString().slice(0, 10),
      },
      changeLookups,
    ),
    isRecurring: Boolean(item.recurringTransactionId),
  }));
  return (
    <DashboardLedgerWorkspace
      initialMonth={currentPeriod}
      summaries={summaries}
      ledgerProps={{
        workspaceId,
        businessDate,
        currency: membership.workspace.baseCurrency,
        transactions: ledger,
        pageSize: LEDGER_PAGE_SIZE,
        isAdmin,
        canEditTransactions: true,
        canApprove: isAdmin,
        scopeLabel: "nhóm này",
        wallets: walletLinks.map(({ wallet }) => ({
          id: wallet.id,
          name: wallet.name,
        })),
        categories,
        startWithNewTransaction,
      }}
    />
  );
}

