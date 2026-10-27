import Decimal from "decimal.js";
import { notFound } from "next/navigation";

import { getCreditCardsData } from "@/app/dashboard/credit-cards/credit-cards-data";
import {
  CreditCardOverview,
  type CreditCardOverviewItem,
  type FundingWallet,
} from "@/app/dashboard/wallets/credit-card-overview";
import { PageContainer } from "@/components/base";
import { installmentAmounts } from "@/domain";
import { idSchema } from "@/domain/common/schemas";
import { isAdminRole, workspaceCapabilities } from "@/domain/role-policy";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { prisma } from "@/lib/prisma";
import { accessibleWorkspaceMemberWhere } from "@/services/active-workspace";
import { availableCategoryWhere } from "@/services/category-visibility";
import {
  generateWorkspaceCreditCardStatements,
  shareForImportedInstallment,
} from "@/services/credit-card-statement-service";
import { processDueRecurringTransactions } from "@/services/recurring-transaction-service";
import { activateDueScheduledTransactionsForRequest } from "@/services/transaction-service";

const ZERO = new Decimal(0);

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function normalizePositiveWalletAmounts(raw: Map<string, Decimal>): Map<string, Decimal> {
  let creditPool = ZERO;
  const positiveEntries: Array<[string, Decimal]> = [];
  for (const [walletId, amount] of raw.entries()) {
    if (amount.lt(0)) {
      creditPool = creditPool.plus(amount.abs());
    } else if (amount.gt(0)) {
      positiveEntries.push([walletId, amount]);
    }
  }
  const normalized = new Map<string, Decimal>();
  for (const [walletId, amount] of positiveEntries) {
    if (creditPool.gt(0)) {
      const deduct = Decimal.min(amount, creditPool);
      const rem = amount.minus(deduct);
      creditPool = creditPool.minus(deduct);
      if (rem.gt(0)) normalized.set(walletId, rem);
    } else {
      normalized.set(walletId, amount);
    }
  }
  return normalized;
}

async function loadCreditCardsDataForWorkspace(
  workspaceId: string,
  roleCode: string,
  baseCurrency: string,
  timeZone: string,
) {
  await Promise.all([
    activateDueScheduledTransactionsForRequest(workspaceId).catch(() => null),
    generateWorkspaceCreditCardStatements(workspaceId, timeZone).catch(() => null),
    processDueRecurringTransactions({ workspaceId }).catch(() => null),
  ]);

  const businessDate = getBusinessDateInTimeZone(timeZone);
  const canManage = workspaceCapabilities(roleCode).canManageWallets;
  const canApprove = isAdminRole(roleCode);

  const [walletLinks, categories] = await Promise.all([
    prisma.workspaceWallet.findMany({
      where: { workspaceId, wallet: { deletedAt: null } },
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

  const activeWallets = walletLinks
    .map((link) => link.wallet)
    .filter((wallet) => wallet.status === "active");
  const walletNameById = new Map(
    walletLinks.map(({ wallet }) => [wallet.id, wallet.name] as const),
  );
  const fundingWallets: FundingWallet[] = activeWallets
    .filter((wallet) => wallet.kind === "asset")
    .map((wallet) => ({ id: wallet.id, name: wallet.name }));
  const selectableWallets = activeWallets.map((wallet) => ({
    id: wallet.id,
    name: wallet.name,
    kind: wallet.kind,
  }));
  const cardWallets = activeWallets.filter(
    (wallet): wallet is typeof wallet & { creditCardProfile: NonNullable<typeof wallet.creditCardProfile> } =>
      wallet.kind === "credit_card" && wallet.creditCardProfile !== null,
  );
  const cardWalletIds = cardWallets.map((wallet) => wallet.id);

  if (cardWalletIds.length === 0) {
    return {
      workspaceId,
      currency: baseCurrency,
      businessDate,
      cards: [] as CreditCardOverviewItem[],
      canManage,
      canApprove,
      fundingWallets,
      selectableWallets,
      categories,
    };
  }

  const [obligations, statements, installmentPlans, transactions] = await Promise.all([
    prisma.creditCardObligationEntry.findMany({
      where: { workspaceId, cardWalletId: { in: cardWalletIds } },
      include: {
        fundingWallet: { select: { name: true } },
        paymentAllocations: { select: { id: true, amount: true } },
        statementItems: { select: { id: true } },
      },
      orderBy: [{ postedDate: "asc" }, { id: "asc" }],
    }),
    prisma.creditCardStatement.findMany({
      where: { workspaceId, cardWalletId: { in: cardWalletIds } },
      include: {
        items: { orderBy: { createdAt: "asc" } },
        payments: {
          where: { deletedAt: null, workflowStatus: { not: "rejected" } },
          include: { creditCardPaymentSources: true },
        },
      },
      orderBy: [{ cycleEndDate: "desc" }],
    }),
    prisma.creditCardInstallmentPlan.findMany({
      where: { workspaceId, cardWalletId: { in: cardWalletIds } },
      include: {
        transaction: { select: { amount: true, description: true } },
        feeTransaction: {
          include: {
            creditCardObligationEntries: {
              include: {
                paymentAllocations: { select: { id: true } },
                statementItems: { select: { id: true } },
              },
            },
          },
        },
        importedObligations: {
          include: {
            paymentAllocations: { select: { id: true, amount: true } },
            statementItems: { select: { id: true } },
          },
        },
        installments: {
          include: {
            statementItems: {
              include: {
                statement: { select: { status: true, paidAt: true } },
              },
            },
          },
          orderBy: { installmentNo: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.transaction.findMany({
      where: {
        deletedAt: null,
        member: { workspaceId },
        walletId: { in: cardWalletIds },
      },
      include: {
        category: { select: { name: true } },
        installmentPlan: { select: { id: true, status: true } },
        creditCardStatement: { select: { id: true, status: true, paidAt: true } },
        creditCardAllocations: { select: { fundingWalletId: true, amount: true } },
        refundTransactions: {
          where: { deletedAt: null, workflowStatus: { not: "rejected" } },
          select: { id: true, amount: true },
        },
        creditCardObligationEntries: {
          include: {
            paymentAllocations: { select: { id: true } },
            statementItems: {
              include: {
                statement: { select: { status: true, paidAt: true } },
              },
            },
          },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const cards: CreditCardOverviewItem[] = cardWallets.map((wallet) => {
    const profile = wallet.creditCardProfile;
    const balance = new Decimal(wallet.currentBalance.toString());
    const debt = Decimal.max(balance, ZERO);
    const creditBalance = balance.lt(0) ? balance.abs() : ZERO;
    const limit = new Decimal(profile.creditLimit.toString());
    const availableCredit = Decimal.max(limit.minus(debt), ZERO);
    const isOverLimit = limit.gt(0) && debt.gt(limit);

    const cardObligations = obligations.filter((item) => item.cardWalletId === wallet.id);
    const cardStatements = statements.filter((item) => item.cardWalletId === wallet.id);
    const cardPlans = installmentPlans.filter((item) => item.cardWalletId === wallet.id);
    const cardTransactions = transactions.filter((item) => item.walletId === wallet.id);

    const pendingPayment = cardTransactions
      .filter(
        (tx) =>
          tx.purpose === "credit_card_payment" &&
          (tx.workflowStatus === "pending" || tx.workflowStatus === "scheduled"),
      )
      .reduce((sum, tx) => sum.plus(tx.amount.toString()), ZERO);
    const hasPendingCardPayment = pendingPayment.gt(0);

    const rawShares = new Map<string, Decimal>();
    const importableByWallet = new Map<string, Decimal>();
    for (const entry of cardObligations) {
      const paid = entry.paymentAllocations.reduce(
        (sum, alloc) => sum.plus(alloc.amount.toString()),
        ZERO,
      );
      const rem = new Decimal(entry.amount.toString()).minus(paid);
      rawShares.set(
        entry.fundingWalletId,
        (rawShares.get(entry.fundingWalletId) ?? ZERO).plus(rem),
      );
      if (
        entry.source === "opening_balance" &&
        entry.installmentPlanId === null &&
        rem.gt(0) &&
        entry.paymentAllocations.length === 0 &&
        entry.statementItems.length === 0
      ) {
        importableByWallet.set(
          entry.fundingWalletId,
          (importableByWallet.get(entry.fundingWalletId) ?? ZERO).plus(rem),
        );
      }
    }
    const normalizedShares = normalizePositiveWalletAmounts(rawShares);
    const fundingShares = [...normalizedShares.entries()].map(([walletId, outstanding]) => ({
      walletId,
      walletName:
        walletNameById.get(walletId) ??
        cardObligations.find((item) => item.fundingWalletId === walletId)?.fundingWallet.name ??
        "Ví nguồn",
      outstanding: outstanding.toString(),
    }));

    const mappedStatements = cardStatements.map((stmt) => {
      const approvedPayments = stmt.payments.filter(
        (payment) => payment.workflowStatus === "approved",
      );
      const paidAmount = approvedPayments.reduce(
        (sum, payment) => sum.plus(payment.amount.toString()),
        ZERO,
      );
      const totalAmount = new Decimal(stmt.totalAmount.toString());
      const remainingAmount =
        stmt.status === "paid" ? ZERO : Decimal.max(totalAmount.minus(paidAmount), ZERO);
      return {
        id: stmt.id,
        cycleEndDate: isoDate(stmt.cycleEndDate),
        dueDate: isoDate(stmt.dueDate),
        amount: totalAmount.toString(),
        paidAmount: paidAmount.toString(),
        remainingAmount: remainingAmount.toString(),
        isPartiallyPaid: stmt.status !== "paid" && paidAmount.gt(0) && remainingAmount.gt(0),
        status: stmt.status,
      };
    });

    const activeStatementRaw =
      cardStatements.find((stmt) => stmt.status === "issued") ?? cardStatements[0] ?? null;
    const activeStatementMapped = activeStatementRaw
      ? mappedStatements.find((stmt) => stmt.id === activeStatementRaw.id) ?? null
      : null;

    let activeStatement: CreditCardOverviewItem["statement"] = null;
    if (activeStatementRaw && activeStatementMapped) {
      const rawStmtDue = new Map<string, Decimal>();
      let carriedTotal = ZERO;
      for (const item of activeStatementRaw.items) {
        const amt = new Decimal(item.amount.toString());
        rawStmtDue.set(
          item.fundingWalletId,
          (rawStmtDue.get(item.fundingWalletId) ?? ZERO).plus(amt),
        );
        if (item.isCarry && amt.gt(0)) {
          carriedTotal = carriedTotal.plus(amt);
        }
      }
      for (const payment of activeStatementRaw.payments) {
        if (payment.workflowStatus !== "approved") continue;
        for (const source of payment.creditCardPaymentSources) {
          rawStmtDue.set(
            source.sourceWalletId,
            (rawStmtDue.get(source.sourceWalletId) ?? ZERO).minus(source.amount.toString()),
          );
        }
      }
      const normalizedStmtSources =
        activeStatementRaw.status === "paid"
          ? new Map<string, Decimal>()
          : normalizePositiveWalletAmounts(rawStmtDue);
      activeStatement = {
        ...activeStatementMapped,
        overdue:
          activeStatementMapped.status !== "paid" &&
          activeStatementMapped.dueDate < businessDate,
        paymentPending: hasPendingCardPayment,
        sources: [...normalizedStmtSources.entries()].map(([walletId, amount]) => ({
          walletId,
          amount: amount.toString(),
        })),
        hasCarriedBalance: carriedTotal.gt(0),
        carriedAmount: carriedTotal.toString(),
      };
    }

    const mappedPlans = cardPlans.map((plan) => {
      const importedPrincipal = plan.importedObligations.reduce(
        (sum, entry) => sum.plus(entry.amount.toString()),
        ZERO,
      );
      const principal =
        plan.origin === "imported" || !plan.transaction
          ? importedPrincipal
          : new Decimal(plan.transaction.amount.toString());
      const fee = new Decimal(plan.feeAmount.toString());
      const locked =
        plan.importedObligations.some(
          (entry) => entry.paymentAllocations.length > 0 || entry.statementItems.length > 0,
        ) ||
        plan.installments.some((inst) => inst.statementItems.length > 0) ||
        Boolean(
          plan.feeTransaction?.creditCardObligationEntries.some(
            (entry) => entry.paymentAllocations.length > 0 || entry.statementItems.length > 0,
          ),
        );
      const txShares =
        plan.origin === "transaction" && plan.transaction
          ? installmentAmounts(principal, plan.termCount)
          : [];

      return {
        id: plan.id,
        origin: plan.origin,
        description: plan.description ?? plan.transaction?.description ?? null,
        principal: principal.toString(),
        fee: fee.toString(),
        termCount: plan.termCount,
        paidTermCount: plan.paidTermCount,
        importBalanceMode: plan.importBalanceMode,
        canDelete: canManage && !locked,
        status: plan.status,
        installments: plan.installments.map((inst) => {
          const itemShare =
            inst.statementItems[0] !== undefined
              ? new Decimal(inst.statementItems[0].amount.toString())
              : plan.origin === "imported" || !plan.transaction
                ? shareForImportedInstallment(
                    principal,
                    plan.termCount,
                    plan.paidTermCount,
                    inst.installmentNo,
                  )
                : (txShares[inst.installmentNo - 1] ?? ZERO).plus(
                    inst.installmentNo === 1 ? fee : ZERO,
                  );
          const paid =
            plan.status === "completed" ||
            inst.statementItems.some(
              (si) => si.statement.status === "paid" && si.statement.paidAt !== null,
            );
          return {
            number: inst.installmentNo,
            dueDate: isoDate(inst.dueDate),
            amount: itemShare.toString(),
            paid,
          };
        }),
      };
    });

    const refundCandidates: CreditCardOverviewItem["refundCandidates"] = [];
    const activities: CreditCardOverviewItem["activities"] = cardTransactions.map((tx) => {
      const refundedTotal = tx.refundTransactions.reduce(
        (sum, ref) => sum.plus(ref.amount.toString()),
        ZERO,
      );
      const isStandardApprovedExpense =
        tx.purpose === "standard" &&
        tx.type === "expense" &&
        tx.workflowStatus === "approved" &&
        !tx.installmentPlan;
      const refundable = isStandardApprovedExpense
        ? Decimal.max(new Decimal(tx.amount.toString()).minus(refundedTotal), ZERO)
        : ZERO;
      const dateStr = isoDate(tx.date);
      if (refundable.gt(0)) {
        refundCandidates.push({
          id: tx.id,
          description: tx.description,
          date: dateStr,
          refundableAmount: refundable.toString(),
        });
      }
      const hasPaidOrBilledObligation = tx.creditCardObligationEntries.some(
        (entry) =>
          entry.paymentAllocations.length > 0 ||
          entry.statementItems.length > 0,
      );
      const hasTrulyPaidStatementItem = tx.creditCardObligationEntries.some((entry) =>
        entry.statementItems.some(
          (si) => si.statement.status === "paid" && si.statement.paidAt !== null,
        ),
      );
      const installmentEligible =
        canManage &&
        isStandardApprovedExpense &&
        new Decimal(tx.amount.toString()).gte(2) &&
        tx.refundTransactions.length === 0 &&
        !hasPaidOrBilledObligation;
      const canEdit =
        tx.workflowStatus !== "rejected" &&
        tx.purpose === "standard" &&
        !tx.installmentPlan &&
        tx.refundTransactions.length === 0 &&
        !tx.creditCardStatement &&
        !hasPaidOrBilledObligation;
      const canDelete =
        (tx.purpose === "credit_card_payment" && canApprove) ||
        ((tx.purpose === "standard" || tx.purpose === "credit_card_refund") &&
          (!tx.installmentPlan || tx.installmentPlan.status === "pending") &&
          !tx.creditCardStatement &&
          tx.refundTransactions.length === 0 &&
          !tx.creditCardObligationEntries.some((entry) => entry.paymentAllocations.length > 0) &&
          !hasTrulyPaidStatementItem);

      return {
        id: tx.id,
        type: tx.type,
        toWalletId: tx.toWalletId,
        purpose: tx.purpose,
        description: tx.description,
        amount: tx.amount.toString(),
        date: dateStr,
        status: tx.workflowStatus,
        installmentEligible,
        installmentPlanId: tx.installmentPlan?.id ?? null,
        refundableAmount: refundable.toString(),
        canDelete,
        canEdit,
        categoryId: tx.categoryId,
        category: tx.category?.name ?? null,
        walletId: tx.walletId,
        allocations: tx.creditCardAllocations.map((alloc) => ({
          walletId: alloc.fundingWalletId,
          amount: alloc.amount.toString(),
        })),
      };
    });

    return {
      id: wallet.id,
      name: wallet.name,
      description: wallet.description,
      debt: debt.toString(),
      creditBalance: creditBalance.toString(),
      limit: limit.toString(),
      availableCredit: availableCredit.toString(),
      isOverLimit,
      pendingPayment: pendingPayment.toString(),
      hasApprovedTransactions: cardTransactions.some(
        (tx) => tx.workflowStatus === "approved",
      ),
      defaultFundingWalletId: profile.defaultFundingWalletId,
      statementClosingDay: profile.statementClosingDay,
      paymentDueDay: profile.paymentDueDay,
      fundingShares,
      importableOpeningDebt: [...importableByWallet.entries()].map(
        ([walletId, amount]) => ({
          walletId,
          amount: amount.toString(),
        }),
      ),
      statement: activeStatement,
      statements: mappedStatements,
      installmentPlans: mappedPlans,
      refundCandidates,
      activities,
    };
  });

  return {
    workspaceId,
    currency: baseCurrency,
    businessDate,
    cards,
    canManage,
    canApprove,
    fundingWallets,
    selectableWallets,
    categories,
  };
}

export default async function CreditCardDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ cardId: string }>;
  searchParams?: Promise<{ workspaceId?: string }>;
}) {
  const [{ cardId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

  let data = await getCreditCardsData();

  const parsedWorkspaceId = idSchema.safeParse(resolvedSearchParams?.workspaceId);
  if (parsedWorkspaceId.success && parsedWorkspaceId.data !== data.workspaceId) {
    const session = await requireAcceptedLegalPageSession();
    const membership = await prisma.workspaceMember.findFirst({
      where: accessibleWorkspaceMemberWhere(
        session.user.id,
        parsedWorkspaceId.data,
      ),
      include: { workspace: true, role: true },
    });
    if (membership) {
      data = await loadCreditCardsDataForWorkspace(
        membership.workspaceId,
        membership.role.code,
        membership.workspace.baseCurrency,
        membership.workspace.timeZone,
      );
    }
  }

  const currentCard = data.cards.find((c) => c.id === cardId);
  if (!currentCard) {
    notFound();
  }

  return (
    <PageContainer>
      <CreditCardOverview
        workspaceId={data.workspaceId}
        currency={data.currency}
        businessDate={data.businessDate}
        cards={data.cards}
        initialCardId={cardId}
        isDetailPage={true}
        canManage={data.canManage}
        canApprove={data.canApprove}
        fundingWallets={data.fundingWallets}
        wallets={data.selectableWallets}
        categories={data.categories}
      />
    </PageContainer>
  );
}
