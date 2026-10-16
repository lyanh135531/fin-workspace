import { DashboardLedgerWorkspace } from "@/app/dashboard/dashboard-ledger-workspace";
import { buildLedgerPeriodSummaries } from "@/app/dashboard/dashboard-summary-data";
import { isAdminRole } from "@/domain/role-policy";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { prisma } from "@/lib/prisma";
import {
  getTransactionChangeAction,
  getTransactionChangeDetails,
  getTransactionChangeReason,
  type TransactionChangeLookups,
} from "@/lib/transaction-change-display";
import {
  accessibleWorkspaceMemberWhere,
  resolveActiveWorkspaceId,
} from "@/services/active-workspace";
import { availableCategoryWhere } from "@/services/category-visibility";
import { generateWorkspaceCreditCardStatements } from "@/services/credit-card-statement-service";
import { activateDueScheduledTransactionsForRequest } from "@/services/transaction-service";
import { redirect } from "next/navigation";

const LEDGER_PAGE_SIZE = 20;

export async function WorkspaceDashboard({
  targetWorkspaceId,
  startWithNewTransaction = false,
}: {
  targetWorkspaceId?: string;
  startWithNewTransaction?: boolean;
} = {}) {
  const session = await requireAcceptedLegalPageSession();

  const workspaceId =
    targetWorkspaceId ?? (await resolveActiveWorkspaceId(session.user.id));
  if (!workspaceId) redirect("/onboarding");

  const membership = await prisma.workspaceMember.findFirst({
    where: accessibleWorkspaceMemberWhere(session.user.id, workspaceId),
    include: { workspace: true, role: true },
  });
  if (!membership) redirect("/onboarding");

  await activateDueScheduledTransactionsForRequest(workspaceId);
  await generateWorkspaceCreditCardStatements(
    workspaceId,
    membership.workspace.timeZone,
  );
  const businessDate = getBusinessDateInTimeZone(membership.workspace.timeZone);
  const currentPeriod = businessDate.slice(0, 7);

  const [walletLinks, categories, transactions] = await Promise.all([
    prisma.workspaceWallet.findMany({
      where: { workspaceId, wallet: { status: "active", deletedAt: null } },
      include: { wallet: { include: { creditCardProfile: true } } },
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
        installmentPlan: { select: { id: true } },
        refundTransactions: {
          where: { deletedAt: null },
          select: { id: true },
        },
        creditCardStatement: {
          select: { id: true, status: true, paidAt: true },
        },
        creditCardObligationEntries: {
          select: {
            paymentAllocations: { select: { id: true } },
            statementItems: {
              select: {
                id: true,
                statement: { select: { status: true, paidAt: true } },
              },
            },
          },
        },
        creditCardAllocations: {
          select: {
            fundingWalletId: true,
            amount: true,
          },
        },
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
  const ledger = transactions.map((item) => {
    const isLockedForEdit =
      Boolean(item.installmentPlan) ||
      item.refundTransactions.length > 0 ||
      Boolean(item.creditCardStatement) ||
      item.creditCardObligationEntries.some(
        (e) => e.paymentAllocations.length > 0 || e.statementItems.length > 0,
      );
    const isLockedForDelete =
      Boolean(item.installmentPlan) ||
      item.refundTransactions.length > 0 ||
      (item.creditCardStatement?.status === "paid" &&
        item.creditCardStatement.paidAt !== null) ||
      item.creditCardObligationEntries.some(
        (e) =>
          e.paymentAllocations.length > 0 ||
          e.statementItems.some(
            (s) => s.statement.status === "paid" && s.statement.paidAt !== null,
          ),
      );
    return {
      id: item.id,
      amount: item.amount.toString(),
      type: item.type,
      purpose: item.purpose,
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
      canRequestEdit:
        (isAdmin || item.memberId === membership.id) &&
        item.purpose === "standard" &&
        item.workflowStatus !== "rejected" &&
        !isLockedForEdit,
      canRequestDelete:
        item.purpose === "credit_card_payment"
          ? isAdmin && item.workflowStatus !== "rejected"
          : item.purpose === "credit_card_installment_fee"
            ? false
            : (isAdmin || item.memberId === membership.id) &&
              item.workflowStatus !== "rejected" &&
              !isLockedForDelete,
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
          allocations: item.creditCardAllocations.map((alloc) => ({
            walletId: alloc.fundingWalletId,
            amount: alloc.amount.toString(),
          })),
        },
        changeLookups,
      ),
      isRecurring: Boolean(item.recurringTransactionId),
      allocations: item.creditCardAllocations.map((alloc) => ({
        walletId: alloc.fundingWalletId,
        amount: alloc.amount.toString(),
      })),
    };
  });
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
          kind: wallet.kind,
          defaultFundingWalletId: wallet.creditCardProfile?.defaultFundingWalletId ?? null,
        })),
        categories,
        startWithNewTransaction,
      }}
    />
  );
}

