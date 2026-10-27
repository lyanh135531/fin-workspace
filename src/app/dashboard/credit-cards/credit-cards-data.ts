import Decimal from "decimal.js";
import { redirect } from "next/navigation";

import {
  CreditCardOverviewItem,
  FundingWallet,
} from "@/app/dashboard/wallets/credit-card-overview";
import { firstStatementOnOrAfter } from "@/domain/credit-card/installments";
import { isAdminRole, workspaceCapabilities } from "@/domain/role-policy";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { availableCategoryWhere } from "@/services/category-visibility";
import { generateWorkspaceCreditCardStatements } from "@/services/credit-card-statement-service";

const ZERO = new Decimal(0);

export async function getCreditCardsData() {
  const session = await requireAcceptedLegalPageSession();
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) redirect("/overview");

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
  if (!membership) redirect("/overview");
  const isAdmin = isAdminRole(membership.role.code);

  await generateWorkspaceCreditCardStatements(
    workspaceId,
    membership.workspace.timeZone,
  );

  const [links, allWalletLinks, categories] = await Promise.all([
    prisma.workspaceWallet.findMany({
      where: {
        workspaceId,
        wallet: { kind: "credit_card", deletedAt: null },
      },
      include: {
        wallet: {
          include: {
            _count: {
              select: {
                sourceTransactions: {
                  where: { workflowStatus: "approved", deletedAt: null },
                },
              },
            },
            creditCardProfile: {
              include: {
                obligations: {
                  include: {
                    fundingWallet: { select: { name: true } },
                    paymentAllocations: { select: { amount: true } },
                    statementItems: { select: { id: true } },
                  },
                  orderBy: [{ postedDate: "asc" }, { id: "asc" }],
                },
                statements: {
                  include: {
                    items: true,
                    payments: {
                      where: {
                        deletedAt: null,
                        workflowStatus: { not: "rejected" },
                      },
                      select: {
                        id: true,
                        amount: true,
                        workflowStatus: true,
                        creditCardPaymentSources: {
                          select: { sourceWalletId: true, amount: true },
                        },
                      },
                    },
                  },
                  orderBy: { cycleEndDate: "desc" },
                  take: 24,
                },
                installmentPlans: {
                  include: {
                    transaction: {
                      select: {
                        description: true,
                        amount: true,
                        type: true,
                        creditCardObligationEntries: {
                          select: {
                            paymentAllocations: { select: { id: true } },
                          },
                        },
                      },
                    },
                    feeTransaction: {
                      select: {
                        creditCardObligationEntries: {
                          select: {
                            paymentAllocations: { select: { id: true } },
                          },
                        },
                      },
                    },
                    importedObligations: {
                      include: {
                        paymentAllocations: { select: { id: true } },
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
                },
              },
            },
            sourceTransactions: {
              where: {
                deletedAt: null,
                purpose: {
                  in: [
                    "standard",
                    "credit_card_payment",
                    "credit_card_refund",
                    "credit_card_installment_fee",
                  ],
                },
              },
              include: {
                category: { select: { id: true, name: true } },
                creditCardAllocations: {
                  select: { fundingWalletId: true, amount: true },
                },
                creditCardPaymentReservations: {
                  where: { releasedAt: null },
                  select: { sourceWalletId: true, amount: true },
                },
                installmentPlan: { select: { id: true } },
                refundTransactions: {
                  where: { deletedAt: null, workflowStatus: { not: "rejected" } },
                  select: { amount: true },
                },
                creditCardObligationEntries: {
                  include: {
                    paymentAllocations: { select: { id: true } },
                    statementItems: {
                      select: {
                        id: true,
                        statement: { select: { status: true, paidAt: true } },
                      },
                    },
                  },
                },
              },
              orderBy: [{ date: "desc" }, { createdAt: "desc" }],
              take: 30,
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { wallet: { name: "asc" } }],
    }),
    prisma.workspaceWallet.findMany({
      where: {
        workspaceId,
        wallet: { status: "active", deletedAt: null },
      },
      select: { wallet: { select: { id: true, name: true, kind: true } } },
      orderBy: [{ sortOrder: "asc" }, { wallet: { name: "asc" } }],
    }),
    prisma.category.findMany({
      where: {
        type: "expense",
        ...availableCategoryWhere(workspaceId),
      },
      select: { id: true, name: true, icon: true, color: true, parentId: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const fundingWallets: FundingWallet[] = allWalletLinks
    .filter(({ wallet }) => wallet.kind === "asset")
    .map(({ wallet }) => ({ id: wallet.id, name: wallet.name }));
  const selectableWallets = allWalletLinks.map(({ wallet }) => wallet);

  const refundTransactions = links.length
    ? await prisma.transaction.findMany({
        where: {
          walletId: { in: links.map(({ wallet }) => wallet.id) },
          type: "expense",
          purpose: "standard",
          workflowStatus: "approved",
          deletedAt: null,
          member: { workspaceId },
        },
        include: {
          refundTransactions: {
            where: { deletedAt: null, workflowStatus: { not: "rejected" } },
            select: { amount: true },
          },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      })
    : [];

  const refundCandidatesByCard = new Map<
    string,
    Array<{
      id: string;
      description: string | null;
      date: string;
      refundableAmount: string;
    }>
  >();

  for (const transaction of refundTransactions) {
    const refundable = Decimal.max(
      new Decimal(transaction.amount.toString()).minus(
        transaction.refundTransactions.reduce(
          (sum, refund) => sum.plus(refund.amount.toString()),
          ZERO,
        ),
      ),
      ZERO,
    );
    if (!refundable.gt(0)) continue;
    const candidates = refundCandidatesByCard.get(transaction.walletId) ?? [];
    candidates.push({
      id: transaction.id,
      description: transaction.description,
      date: transaction.date.toISOString().slice(0, 10),
      refundableAmount: refundable.toString(),
    });
    refundCandidatesByCard.set(transaction.walletId, candidates);
  }

  const activeReservations =
    links.length && prisma.creditCardPaymentReservation?.findMany
      ? await prisma.creditCardPaymentReservation.findMany({
          where: {
            releasedAt: null,
            paymentTransaction: {
              walletId: { in: links.map(({ wallet }) => wallet.id) },
              workflowStatus: { in: ["pending", "scheduled"] },
              deletedAt: null,
              member: { workspaceId },
            },
          },
          select: {
            sourceWalletId: true,
            amount: true,
            paymentTransaction: { select: { walletId: true } },
          },
        })
      : null;

  const cards: CreditCardOverviewItem[] = links.flatMap(({ wallet }) => {
    const profile = wallet.creditCardProfile;
    if (!profile) return [];

    const pendingByWallet = new Map<string, Decimal>();
    if (activeReservations) {
      for (const reservation of activeReservations) {
        if (reservation.paymentTransaction.walletId !== wallet.id) continue;
        pendingByWallet.set(
          reservation.sourceWalletId,
          (pendingByWallet.get(reservation.sourceWalletId) ?? ZERO).plus(
            reservation.amount.toString(),
          ),
        );
      }
    } else {
      for (const transaction of wallet.sourceTransactions) {
        for (const reservation of transaction.creditCardPaymentReservations) {
          pendingByWallet.set(
            reservation.sourceWalletId,
            (pendingByWallet.get(reservation.sourceWalletId) ?? ZERO).plus(
              reservation.amount.toString(),
            ),
          );
        }
      }
    }

    const rawOutstandingByWallet = new Map<
      string,
      { walletName: string; amount: Decimal }
    >();
    for (const obligation of profile.obligations) {
      const paid = obligation.paymentAllocations.reduce(
        (sum, item) => sum.plus(item.amount.toString()),
        ZERO,
      );
      const current = rawOutstandingByWallet.get(obligation.fundingWalletId)?.amount ?? ZERO;
      rawOutstandingByWallet.set(obligation.fundingWalletId, {
        walletName: obligation.fundingWallet.name,
        amount: current.plus(obligation.amount.toString()).minus(paid),
      });
    }

    let leftoverCardCredit = ZERO;
    const positiveWalletEntries: Array<[string, { walletName: string; amount: Decimal }]> = [];
    for (const [walletId, item] of rawOutstandingByWallet.entries()) {
      if (item.amount.lt(0)) {
        leftoverCardCredit = leftoverCardCredit.plus(item.amount.abs());
      } else if (item.amount.gt(0)) {
        positiveWalletEntries.push([walletId, item]);
      }
    }

    const outstandingByWallet = new Map<
      string,
      { walletName: string; amount: Decimal }
    >();
    for (const [walletId, item] of positiveWalletEntries) {
      let netAmount = item.amount;
      if (leftoverCardCredit.gt(0)) {
        const deduct = Decimal.min(netAmount, leftoverCardCredit);
        netAmount = netAmount.minus(deduct);
        leftoverCardCredit = leftoverCardCredit.minus(deduct);
      }
      if (netAmount.gt(0)) {
        outstandingByWallet.set(walletId, {
          walletName: item.walletName,
          amount: netAmount,
        });
      }
    }

    const oldestStatement = [...profile.statements]
      .reverse()
      .find((statement) => statement.status === "issued");

    const approvedPayments = oldestStatement?.payments.filter((p) => p.workflowStatus === "approved") ?? [];
    const pendingPayment = oldestStatement?.payments.some((p) => p.workflowStatus === "pending" || p.workflowStatus === "scheduled") ?? false;

    const statementSources = new Map<string, Decimal>();
    for (const item of oldestStatement?.items ?? []) {
      statementSources.set(
        item.fundingWalletId,
        (statementSources.get(item.fundingWalletId) ?? ZERO).plus(
          item.amount.toString(),
        ),
      );
    }

    const paidByWallet = new Map<string, Decimal>();
    let unattributedStatementPaid = ZERO;
    for (const payment of approvedPayments) {
      let sourcesSum = ZERO;
      for (const source of payment.creditCardPaymentSources) {
        const amt = new Decimal(source.amount.toString());
        sourcesSum = sourcesSum.plus(amt);
        paidByWallet.set(
          source.sourceWalletId,
          (paidByWallet.get(source.sourceWalletId) ?? ZERO).plus(amt),
        );
      }
      const paymentAmt = new Decimal(payment.amount.toString());
      if (paymentAmt.gt(sourcesSum)) {
        unattributedStatementPaid = unattributedStatementPaid.plus(
          paymentAmt.minus(sourcesSum),
        );
      }
    }

    const rawRemainingSources = new Map<string, Decimal>();
    for (const [walletId, due] of statementSources) {
      rawRemainingSources.set(walletId, due);
    }
    for (const [walletId, paid] of paidByWallet) {
      rawRemainingSources.set(
        walletId,
        (rawRemainingSources.get(walletId) ?? ZERO).minus(paid),
      );
    }
    let excessStatementPaidPool = unattributedStatementPaid;
    const positiveStatementEntries: Array<[string, Decimal]> = [];
    for (const [walletId, amount] of rawRemainingSources.entries()) {
      if (amount.lt(0)) {
        excessStatementPaidPool = excessStatementPaidPool.plus(amount.abs());
      } else if (amount.gt(0)) {
        positiveStatementEntries.push([walletId, amount]);
      }
    }
    const remainingSources = new Map<string, Decimal>();
    for (const [walletId, amount] of positiveStatementEntries) {
      if (excessStatementPaidPool.gt(0)) {
        const deduct = Decimal.min(amount, excessStatementPaidPool);
        const rem = amount.minus(deduct);
        excessStatementPaidPool = excessStatementPaidPool.minus(deduct);
        if (rem.gt(0)) remainingSources.set(walletId, rem);
      } else {
        remainingSources.set(walletId, amount);
      }
    }

    const rawStatementPaid = approvedPayments.reduce(
      (sum, p) => sum.plus(p.amount.toString()),
      ZERO,
    );
    const statementTotalAmount = new Decimal(oldestStatement?.totalAmount.toString() ?? 0);
    const statementTotalPaid = Decimal.min(statementTotalAmount, rawStatementPaid);
    const statementTotalRemaining = Decimal.max(statementTotalAmount.minus(statementTotalPaid), ZERO);
    const isPartiallyPaid = statementTotalPaid.gt(0) && statementTotalRemaining.gt(0);
    const hasCarriedBalance = oldestStatement?.items.some((item) => item.isCarry) ?? false;
    const carriedAmount = oldestStatement?.items
      .filter((item) => item.isCarry)
      .reduce((sum, item) => sum.plus(item.amount.toString()), ZERO)
      .toString() ?? "0";

    return [{
      id: wallet.id,
      name: wallet.name,
      currency: membership.workspace.baseCurrency,
      description: wallet.description,
      balance: wallet.currentBalance.toString(),
      remainingBalance: Decimal.max(
        new Decimal(wallet.currentBalance.toString()).negated(),
        ZERO,
      ).toString(),
      debt: Decimal.max(wallet.currentBalance.toString(), ZERO).toString(),
      creditBalance: Decimal.max(
        new Decimal(wallet.currentBalance.toString()).negated(),
        ZERO,
      ).toString(),
      limit: profile.creditLimit.toString(),
      availableCredit: new Decimal(profile.creditLimit.toString())
        .minus(wallet.currentBalance.toString())
        .toString(),
      isOverLimit: new Decimal(wallet.currentBalance.toString()).gt(profile.creditLimit.toString()),
      pendingPayment: [...pendingByWallet.values()]
        .reduce((sum, amount) => sum.plus(amount), ZERO)
        .toString(),
      hasApprovedTransactions: wallet._count.sourceTransactions > 0,
      defaultFundingWalletId: profile.defaultFundingWalletId,
      statementClosingDay: profile.statementClosingDay,
      paymentDueDay: profile.paymentDueDay,
      statement: oldestStatement ? {
        id: oldestStatement.id,
        cycleEndDate: oldestStatement.cycleEndDate.toISOString().slice(0, 10),
        dueDate: oldestStatement.dueDate.toISOString().slice(0, 10),
        amount: oldestStatement.totalAmount.toString(),
        paidAmount: statementTotalPaid.toString(),
        remainingAmount: statementTotalRemaining.toString(),
        isPartiallyPaid,
        hasCarriedBalance,
        carriedAmount,
        status: oldestStatement.status,
        overdue:
          oldestStatement.dueDate.toISOString().slice(0, 10) <
          getBusinessDateInTimeZone(membership.workspace.timeZone),
        paymentPending: pendingPayment,
        sources: [...remainingSources.entries()]
          .filter(([, amount]) => amount.gt(0))
          .map(([walletId, amount]) => ({
            walletId,
            amount: amount.toString(),
          })),
      } : null,
      statements: profile.statements.map((statement) => {
        const approved = statement.payments.filter((p) => p.workflowStatus === "approved");
        const rawPaid = approved.reduce((sum, p) => sum.plus(p.amount.toString()), ZERO);
        const stmtAmount = new Decimal(statement.totalAmount.toString());
        const paid = Decimal.min(stmtAmount, rawPaid);
        const remaining = Decimal.max(stmtAmount.minus(paid), ZERO);
        return {
          id: statement.id,
          cycleEndDate: statement.cycleEndDate.toISOString().slice(0, 10),
          dueDate: statement.dueDate.toISOString().slice(0, 10),
          amount: statement.totalAmount.toString(),
          paidAmount: paid.toString(),
          remainingAmount: remaining.toString(),
          isPartiallyPaid: paid.gt(0) && remaining.gt(0),
          status: statement.status,
        };
      }),
      installmentPlans: profile.installmentPlans.map((plan) => ({
        id: plan.id,
        origin: plan.origin,
        description:
          plan.description ??
          plan.transaction?.description ??
          (plan.transaction?.type === "transfer" ? "Chuyển tiền từ thẻ" : null),
        principal: plan.transaction
          ? plan.transaction.amount.toString()
          : plan.importedObligations.reduce(
              (sum, entry) => sum.plus(entry.amount.toString()),
              ZERO,
            ).toString(),
        fee: plan.feeAmount.toString(),
        termCount: plan.termCount,
        paidTermCount: plan.paidTermCount,
        monthlyPrincipal: plan.installments[0]?.principalAmount.toString() ?? "0",
        monthlyFee: plan.installments[0]?.feeAmount.toString() ?? "0",
        totalPerTerm: plan.installments[0]
          ? new Decimal(plan.installments[0].principalAmount.toString())
              .plus(plan.installments[0].feeAmount.toString())
              .toString()
          : "0",
        remainingPrincipal:
          plan.status === "completed"
            ? "0"
            : Decimal.max(
                new Decimal(
                  plan.transaction
                    ? plan.transaction.amount.toString()
                    : plan.importedObligations.reduce(
                        (sum, entry) => sum.plus(entry.amount.toString()),
                        ZERO,
                      ).toString(),
                ).minus(
                  plan.installments
                    .filter((i) =>
                      i.statementItems.some(
                        (s) => s.statement.status === "paid" && s.statement.paidAt !== null,
                      ),
                    )
                    .reduce((sum, i) => sum.plus(i.principalAmount.toString()), ZERO),
                ),
                ZERO,
              ).toString(),
        nextStatementDate:
          plan.status === "completed"
            ? null
            : profile.statementClosingDay
              ? firstStatementOnOrAfter(
                  getBusinessDateInTimeZone(membership.workspace.timeZone),
                  profile.statementClosingDay,
                )
              : null,
        importBalanceMode: plan.importBalanceMode,
        status: plan.status,
        canDelete:
          plan.status !== "completed" &&
          plan.importedObligations.every(
            (entry) => entry.paymentAllocations.length === 0 && entry.statementItems.length === 0,
          ) &&
          (plan.transaction?.creditCardObligationEntries.every(
            (entry) => entry.paymentAllocations.length === 0,
          ) ?? true) &&
          (plan.feeTransaction?.creditCardObligationEntries.every(
            (entry) => entry.paymentAllocations.length === 0,
          ) ?? true) &&
          plan.installments.every((installment) => installment.statementItems.length === 0),
        installments: plan.installments.map((installment) => ({
          number: installment.installmentNo,
          dueDate: installment.dueDate.toISOString().slice(0, 10),
          amount: new Decimal(installment.principalAmount.toString())
            .plus(installment.feeAmount.toString())
            .toString(),
          paid:
            plan.status === "completed" ||
            (installment.statementItems.length > 0 &&
              installment.statementItems.every(
                (item) => item.statement.status === "paid" && item.statement.paidAt !== null,
              )),
        })),
      })),
      fundingShares: [...outstandingByWallet.entries()].map(
        ([walletId, item]) => ({
          walletId,
          walletName: item.walletName,
          outstanding: Decimal.max(item.amount, ZERO).toString(),
        }),
      ),
      importableOpeningDebt: profile.obligations
        .filter(
          (entry) =>
            entry.source === "opening_balance" &&
            !entry.installmentPlanId &&
            entry.paymentAllocations.length === 0 &&
            entry.statementItems.length === 0 &&
            new Decimal(entry.amount.toString()).gt(0),
        )
        .reduce<Array<{ walletId: string; amount: string }>>((items, entry) => {
          const current = items.find((item) => item.walletId === entry.fundingWalletId);
          if (current) {
            current.amount = new Decimal(current.amount).plus(entry.amount.toString()).toString();
          } else {
            items.push({ walletId: entry.fundingWalletId, amount: entry.amount.toString() });
          }
          return items;
        }, []),
      reservedFunding: [...outstandingByWallet.entries()].map(
        ([walletId, item]) => ({
          walletId,
          amount: Decimal.max(item.amount, ZERO).toString(),
        }),
      ),
      activities: wallet.sourceTransactions.map((transaction) => {
        const isInAnyStatement =
          Boolean(transaction.creditCardStatementId) ||
          transaction.creditCardObligationEntries.some(
            (entry) => entry.statementItems.length > 0,
          );
        const isInPaidStatement = transaction.creditCardObligationEntries.some(
          (entry) =>
            entry.statementItems.some(
              (item) => item.statement.status === "paid" && item.statement.paidAt !== null,
            ),
        );
        const isPaidOrClosed =
          isInPaidStatement ||
          transaction.creditCardObligationEntries.some(
            (entry) => entry.paymentAllocations.length > 0,
          );
        const isOwnerOrAdmin = isAdmin || transaction.memberId === membership.id;
        const canModify =
          isOwnerOrAdmin &&
          transaction.purpose === "standard" &&
          transaction.workflowStatus !== "rejected" &&
          !transaction.installmentPlan &&
          !transaction.creditCardStatementId &&
          transaction.refundTransactions.length === 0;
        const canDelete =
          transaction.purpose === "credit_card_payment"
            ? isAdmin && transaction.workflowStatus !== "rejected"
            : (canModify && !isPaidOrClosed) ||
              (isOwnerOrAdmin && transaction.purpose === "credit_card_refund" && !isPaidOrClosed);
        return {
          id: transaction.id,
          type: transaction.type,
          toWalletId: transaction.toWalletId ?? null,
          purpose: transaction.purpose,
          description: transaction.description,
          amount: transaction.amount.toString(),
          date: transaction.date.toISOString().slice(0, 10),
          status: transaction.workflowStatus,
          categoryId: transaction.categoryId ?? null,
          category: transaction.category?.name ?? null,
          walletId: transaction.walletId,
          allocations: transaction.creditCardAllocations.map((allocation) => ({
            walletId: allocation.fundingWalletId,
            amount: allocation.amount.toString(),
          })),
          installmentEligible:
            transaction.purpose === "standard" &&
            (transaction.type === "expense" || transaction.type === "transfer") &&
            transaction.workflowStatus === "approved" &&
            !transaction.installmentPlan &&
            transaction.refundTransactions.length === 0 &&
            transaction.creditCardObligationEntries.every(
              (entry) =>
                entry.paymentAllocations.length === 0 &&
                entry.statementItems.length === 0,
            ),
          canDelete,
          canEdit: canModify && !isPaidOrClosed && !isInAnyStatement,
          installmentPlanId: transaction.installmentPlan?.id ?? null,
          refundableAmount:
            transaction.purpose === "standard" && transaction.type === "expense"
              ? Decimal.max(
                  new Decimal(transaction.amount.toString()).minus(
                    transaction.refundTransactions.reduce(
                      (sum, refund) => sum.plus(refund.amount.toString()),
                      ZERO,
                    ),
                  ),
                  ZERO,
                ).toString()
              : "0",
        };
      }),
      refundCandidates: refundCandidatesByCard.get(wallet.id) ?? [],
    }];
  });

  return {
    workspaceId,
    currency: membership.workspace.baseCurrency,
    businessDate: getBusinessDateInTimeZone(membership.workspace.timeZone),
    cards,
    canManage: workspaceCapabilities(membership.role.code).canManageWallets,
    canApprove: workspaceCapabilities(membership.role.code).canApproveTransactions,
    fundingWallets,
    selectableWallets,
    categories,
  };
}
