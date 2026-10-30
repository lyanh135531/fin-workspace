import type { Prisma } from "@/generated/prisma/client";
import type {
  CompactLedgerBundle,
  CompactLedgerRow,
  LedgerPayloadLookups,
} from "@/lib/ledger-payload";
import { prisma } from "@/lib/prisma";
import {
  getTransactionChangeAction,
  getTransactionChangeDetails,
  getTransactionChangeReason,
  type TransactionChangeLookups,
} from "@/lib/transaction-change-display";
import { availableCategoryWhere } from "@/services/category-visibility";

export type QueryLedgerWindowOptions = {
  workspaceId: string;
  memberId: string;
  isAdmin: boolean;
  range: { from: string; to: string } | null;
  includePinned?: boolean;
  knownWalletIds?: ReadonlySet<string>;
  knownCategoryIds?: ReadonlySet<string>;
  preloadedChangeLookups?: TransactionChangeLookups;
};

function toDbDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export async function queryWorkspaceLedgerBundle({
  workspaceId,
  memberId,
  isAdmin,
  range,
  includePinned = false,
  knownWalletIds,
  knownCategoryIds,
  preloadedChangeLookups,
}: QueryLedgerWindowOptions): Promise<CompactLedgerBundle> {
  const dateFilter: Prisma.TransactionWhereInput | null = range
    ? {
        date: {
          gte: toDbDate(range.from),
          lte: toDbDate(range.to),
        },
      }
    : null;

  const where: Prisma.TransactionWhereInput = {
    deletedAt: null,
    member: { workspaceId },
    ...(dateFilter
      ? includePinned
        ? {
            OR: [
              dateFilter,
              { workflowStatus: { in: ["scheduled", "pending"] } },
              { changeRequests: { some: { status: "pending" } } },
            ],
          }
        : dateFilter
      : {}),
  };

  const [transactions, olderRowProbe] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        wallet: { select: { name: true, status: true, deletedAt: true } },
        toWallet: { select: { name: true } },
        category: { select: { name: true, color: true, icon: true } },
        member: { select: { id: true, user: { select: { username: true } } } },
        installmentPlan: { select: { id: true } },
        refundTransactions: {
          where: { deletedAt: null, workflowStatus: { not: "rejected" } },
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
        creditCardPaymentSources: {
          select: {
            sourceWalletId: true,
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
    range
      ? prisma.transaction.findFirst({
          where: {
            deletedAt: null,
            member: { workspaceId },
            OR: [
              { date: { lt: toDbDate(range.from) } },
              { date: { gt: toDbDate(range.to) } },
            ],
            ...(includePinned
              ? {
                  workflowStatus: { notIn: ["scheduled", "pending"] },
                  changeRequests: { none: { status: "pending" } },
                }
              : {}),
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  const hasAnyPendingChange = transactions.some(
    (item) => item.changeRequests.length > 0,
  );

  let changeLookups = preloadedChangeLookups;
  if (!changeLookups && hasAnyPendingChange) {
    const [walletLinks, categories] = await Promise.all([
      prisma.workspaceWallet.findMany({
        where: { workspaceId },
        select: { walletId: true, wallet: { select: { name: true } } },
      }),
      prisma.category.findMany({
        where: availableCategoryWhere(workspaceId),
        select: { id: true, name: true },
      }),
    ]);
    changeLookups = {
      wallets: new Map(
        walletLinks.map((w) => [w.walletId, w.wallet.name] as const),
      ),
      categories: new Map(categories.map((c) => [c.id, c.name] as const)),
    };
  }
  const effectiveChangeLookups: TransactionChangeLookups = changeLookups ?? {
    wallets: new Map(),
    categories: new Map(),
  };

  const extraWallets: Record<string, string> = {};
  const extraCategories: Record<
    string,
    { name: string; color: string; icon: string | null }
  > = {};
  const members: Record<string, string> = {};

  const rows: CompactLedgerRow[] = transactions.map((item) => {
    members[item.memberId] = item.member.user.username ?? "Người dùng";

    if (!knownWalletIds || !knownWalletIds.has(item.walletId)) {
      extraWallets[item.walletId] = item.wallet.name;
    }
    if (
      item.toWalletId &&
      item.toWallet &&
      (!knownWalletIds || !knownWalletIds.has(item.toWalletId))
    ) {
      extraWallets[item.toWalletId] = item.toWallet.name;
    }
    if (
      item.categoryId &&
      item.category &&
      (!knownCategoryIds || !knownCategoryIds.has(item.categoryId))
    ) {
      extraCategories[item.categoryId] = {
        name: item.category.name,
        color: item.category.color,
        icon: item.category.icon,
      };
    }

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

    const canEdit =
      (isAdmin || item.memberId === memberId) &&
      item.purpose === "standard" &&
      item.workflowStatus !== "rejected" &&
      !isLockedForEdit;

    const canDelete =
      item.purpose === "balance_reconciliation"
        ? isAdmin &&
          item.workflowStatus !== "rejected" &&
          item.wallet.status === "active" &&
          item.wallet.deletedAt === null
        : item.purpose === "credit_card_payment"
          ? isAdmin && item.workflowStatus !== "rejected"
          : item.purpose === "credit_card_installment_fee" ||
              item.purpose === "investment_contribution" ||
              item.purpose === "investment_settlement"
            ? false
            : (isAdmin || item.memberId === memberId) &&
              item.workflowStatus !== "rejected" &&
              !isLockedForDelete;

    const dateIso = item.date.toISOString().slice(0, 10);
    const allocations = item.creditCardAllocations.map((alloc) => ({
      walletId: alloc.fundingWalletId,
      amount: alloc.amount.toString(),
    }));
    const paymentSources = item.creditCardPaymentSources.map((src) => ({
      walletId: src.sourceWalletId,
      amount: src.amount.toString(),
    }));

    const firstChange = item.changeRequests[0];
    const row: CompactLedgerRow = {
      id: item.id,
      amount: item.amount.toString(),
      type: item.type,
      date: dateIso,
      walletId: item.walletId,
      memberId: item.memberId,
    };

    if (item.purpose !== "standard") {
      row.purpose = item.purpose;
    }
    if (item.workflowStatus !== "approved") {
      row.status = item.workflowStatus;
    }
    if (item.description) {
      row.description = item.description;
    }
    if (item.toWalletId) {
      row.toWalletId = item.toWalletId;
    }
    if (item.categoryId) {
      row.categoryId = item.categoryId;
    }
    if (canEdit) {
      row.canEdit = true;
    }
    if (canDelete) {
      row.canDelete = true;
    }
    if (item.recurringTransactionId) {
      row.isRecurring = true;
    }
    if (allocations.length > 0) {
      row.allocations = allocations;
    }
    if (paymentSources.length > 0) {
      row.paymentSources = paymentSources;
    }
    if (firstChange) {
      row.pendingChange = {
        id: firstChange.id,
        action: getTransactionChangeAction(firstChange.proposedData),
        requester: firstChange.requester.user.username ?? null,
        reason: getTransactionChangeReason(firstChange.proposedData),
        details: getTransactionChangeDetails(
          firstChange.proposedData,
          {
            walletId: item.walletId,
            toWalletId: item.toWalletId,
            categoryId: item.categoryId,
            type: item.type,
            amount: item.amount.toString(),
            description: item.description,
            date: dateIso,
            allocations,
          },
          effectiveChangeLookups,
        ),
      };
    }

    return row;
  });

  const lookups: LedgerPayloadLookups = {
    members,
    ...(Object.keys(extraWallets).length > 0 ? { extraWallets } : {}),
    ...(Object.keys(extraCategories).length > 0 ? { extraCategories } : {}),
  };

  const latestUpdatedAt = transactions.reduce(
    (max, item) => Math.max(max, item.updatedAt.getTime()),
    0,
  );
  const revision = `${transactions.length}:${latestUpdatedAt}:${transactions[0]?.id ?? "empty"}`;

  return {
    revision,
    rows,
    lookups,
    coveredRange: range,
    isCompleteHistory: range === null || olderRowProbe === null,
  };
}
