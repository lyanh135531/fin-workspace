import { getMonthDateRange } from "@/app/dashboard/dashboard-ledger-filters";
import { DashboardLedgerWorkspace } from "@/app/dashboard/dashboard-ledger-workspace";
import { isAdminRole } from "@/domain/role-policy";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { prisma } from "@/lib/prisma";
import type { TransactionChangeLookups } from "@/lib/transaction-change-display";
import {
  accessibleWorkspaceMemberWhere,
  resolveActiveWorkspaceId,
} from "@/services/active-workspace";
import { availableCategoryWhere } from "@/services/category-visibility";
import { generateWorkspaceCreditCardStatements } from "@/services/credit-card-statement-service";
import { queryWorkspaceLedgerBundle } from "@/services/ledger-window-query";
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
  const initialRange = getMonthDateRange(businessDate);
  const isAdmin = isAdminRole(membership.role.code);

  const [walletLinks, categories] = await Promise.all([
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
  ]);

  const knownWalletIds = new Set(walletLinks.map(({ wallet }) => wallet.id));
  const knownCategoryIds = new Set(categories.map((category) => category.id));
  const changeLookups: TransactionChangeLookups = {
    wallets: new Map(
      walletLinks.map(({ wallet }) => [wallet.id, wallet.name] as const),
    ),
    categories: new Map(
      categories.map((category) => [category.id, category.name] as const),
    ),
  };

  const initialBundle = await queryWorkspaceLedgerBundle({
    workspaceId,
    memberId: membership.id,
    isAdmin,
    range: initialRange,
    includePinned: true,
    knownWalletIds,
    knownCategoryIds,
    preloadedChangeLookups: changeLookups,
  });

  return (
    <DashboardLedgerWorkspace
      key={membership.workspaceId}
      initialBundle={initialBundle}
      ledgerProps={{
        workspaceId,
        businessDate,
        currency: membership.workspace.baseCurrency,
        pageSize: LEDGER_PAGE_SIZE,
        isAdmin,
        canEditTransactions: true,
        canApprove: isAdmin,
        scopeLabel: "nhóm này",
        wallets: walletLinks.map(({ wallet }) => ({
          id: wallet.id,
          name: wallet.name,
          kind: wallet.kind,
          defaultFundingWalletId:
            wallet.creditCardProfile?.defaultFundingWalletId ?? null,
        })),
        categories,
        startWithNewTransaction,
      }}
    />
  );
}
