import Decimal from "decimal.js";
import { redirect } from "next/navigation";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import {
  OverviewDashboard,
  type OverviewFinancialPlanSnapshot,
} from "@/app/dashboard/overview/overview-dashboard";
import { FINANCIAL_JAR_LABELS, type FinancialJarCode } from "@/domain/financial-jar/jars";
import { workspaceCapabilities } from "@/domain/role-policy";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { availableCategoryWhere } from "@/services/category-visibility";
import { activateDueScheduledTransactionsForRequest } from "@/services/transaction-service";
import { getWorkspaceCreditCardCommitments } from "@/services/credit-card-service";
import { generateWorkspaceCreditCardStatements } from "@/services/credit-card-statement-service";
import {
  getFinancialPlanView,
  getWorkspaceFinancialPlans,
} from "@/services/financial-plan-service";
import { PageContainer } from "@/components/base";

const ZERO = new Decimal(0);

export default async function OverviewPage() {
  const session = await requireAcceptedLegalPageSession();
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
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

  await Promise.all([
    activateDueScheduledTransactionsForRequest(workspaceId),
    generateWorkspaceCreditCardStatements(
      workspaceId,
      membership.workspace.timeZone,
    ).catch(() => undefined),
  ]);

  const businessDate = getBusinessDateInTimeZone(membership.workspace.timeZone);
  const reportPeriod = businessDate.slice(0, 7);

  const [
    walletLinks,
    members,
    transactions,
    recurringRows,
    categories,
    commitments,
    plans,
  ] = await Promise.all([
    prisma.workspaceWallet.findMany({
      where: {
        workspaceId,
        wallet: { status: "active", deletedAt: null },
      },
      include: {
        wallet: {
          include: {
            creditCardProfile: {
              include: {
                statements: {
                  where: { status: "issued" },
                  include: {
                    payments: {
                      where: {
                        deletedAt: null,
                        workflowStatus: "approved",
                      },
                      select: { amount: true },
                    },
                  },
                  orderBy: { cycleEndDate: "asc" },
                },
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { wallet: { name: "asc" } }],
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId, status: "active", deletedAt: null },
      select: { id: true, user: { select: { username: true } } },
      orderBy: { user: { username: "asc" } },
    }),
    prisma.transaction.findMany({
      where: { deletedAt: null, member: { workspaceId } },
      include: {
        wallet: { select: { name: true } },
        toWallet: { select: { name: true } },
        category: { select: { name: true, color: true, icon: true } },
        member: { include: { user: { select: { username: true } } } },
        creditCardPaymentSources: {
          select: { sourceWalletId: true, amount: true },
        },
      },
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
        toWallet: { select: { name: true } },
        category: { select: { name: true, color: true, icon: true } },
      },
      orderBy: { nextExecutionDate: "asc" },
      take: 8,
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
    getWorkspaceCreditCardCommitments(workspaceId),
    getWorkspaceFinancialPlans(session.user.id, workspaceId).catch(() => []),
  ]);

  // Resolve active financial plan & 6-jars snapshot for the overview command center
  let financialPlanSnapshot: OverviewFinancialPlanSnapshot | null = null;
  const activePlan =
    plans.find((plan) => plan.status === "active") ??
    plans.find((plan) => plan.status === "completed") ??
    plans[0];

  if (activePlan) {
    try {
      const planView = await getFinancialPlanView(
        session.user.id,
        workspaceId,
        activePlan.id,
      );
      if (planView.status !== "draft") {
        const currentMonthView =
          planView.months.find(
            (month) => month.month === reportPeriod && !month.closed,
          ) ??
          planView.months.find((month) => !month.closed) ??
          planView.months[planView.months.length - 1];

        financialPlanSnapshot = {
          id: planView.id,
          name: planView.name,
          status: planView.status,
          health: planView.health,
          targetAmount: planView.targetAmount,
          realizedProgress: planView.realizedProgress,
          realizedProgressPercentage: planView.realizedProgressPercentage,
          targetMonth: planView.targetMonth,
          currentMonth: currentMonthView
            ? {
                month: currentMonthView.month,
                allocatableGrossBudget:
                  currentMonthView.allocatableGrossBudget,
                adjustedRequiredAmount:
                  currentMonthView.adjustedRequiredAmount,
                availableToSpend: currentMonthView.availableToSpend,
                eligibleExpense:
                  ("eligibleExpense" in currentMonthView
                    ? currentMonthView.eligibleExpense
                    : "0") ?? "0",
                jars: currentMonthView.jars.map((jar) => {
                  const spent =
                    ("expenseAmount" in jar
                      ? jar.expenseAmount
                      : jar.closedActualAmount) ?? "0";
                  const allocated = jar.allocatedAmount;
                  const remaining =
                    ("remainingAmount" in jar
                      ? jar.remainingAmount
                      : Decimal.max(
                          new Decimal(allocated).minus(spent),
                          ZERO,
                        ).toFixed(0)) ?? "0";
                  const overspend =
                    ("overspendAmount" in jar
                      ? jar.overspendAmount
                      : Decimal.max(
                          new Decimal(spent).minus(allocated),
                          ZERO,
                        ).toFixed(0)) ?? "0";
                  return {
                    jarCode: jar.jarCode as FinancialJarCode,
                    label:
                      FINANCIAL_JAR_LABELS[jar.jarCode as FinancialJarCode] ??
                      jar.jarCode,
                    percentage: jar.percentage,
                    allocatedAmount: allocated,
                    spentAmount: spent,
                    remainingAmount: remaining,
                    overspendAmount: overspend,
                  };
                }),
              }
            : null,
        };
      }
    } catch {
      financialPlanSnapshot = null;
    }
  }

  const totalByCurrency = walletLinks.reduce<Record<string, string>>(
    (totals, { wallet }) => {
      const current = new Decimal(
        totals[membership.workspace.baseCurrency] ?? 0,
      );
      totals[membership.workspace.baseCurrency] = (
        wallet.kind === "credit_card"
          ? current.minus(wallet.currentBalance.toString())
          : current.plus(wallet.currentBalance.toString())
      ).toString();
      return totals;
    },
    {},
  );

  return (
    <PageContainer>
      <OverviewDashboard
        workspace={{
          id: workspaceId,
          name: membership.workspace.name,
          currency: membership.workspace.baseCurrency,
        }}
        reportPeriod={reportPeriod}
        businessDate={businessDate}
        canApprove={
          workspaceCapabilities(membership.role.code).canApproveTransactions
        }
        financialPlanSnapshot={financialPlanSnapshot}
        wallets={walletLinks.map(({ wallet }) => {
          const committed = commitments.get(wallet.id) ?? ZERO;
          const profile = wallet.creditCardProfile;
          const oldestIssuedStmt = profile?.statements[0] ?? null;
          let issuedStatement: {
            id: string;
            dueDate: string;
            totalAmount: string;
            remainingAmount: string;
            overdue: boolean;
          } | null = null;

          if (oldestIssuedStmt) {
            const paid = oldestIssuedStmt.payments.reduce(
              (sum, p) => sum.plus(p.amount.toString()),
              ZERO,
            );
            const totalAmt = new Decimal(
              oldestIssuedStmt.totalAmount.toString(),
            );
            const remainingAmt = Decimal.max(totalAmt.minus(paid), ZERO);
            const dueDateStr = oldestIssuedStmt.dueDate
              .toISOString()
              .slice(0, 10);
            if (remainingAmt.gt(0)) {
              issuedStatement = {
                id: oldestIssuedStmt.id,
                dueDate: dueDateStr,
                totalAmount: totalAmt.toString(),
                remainingAmount: remainingAmt.toString(),
                overdue: dueDateStr < businessDate,
              };
            }
          }

          return {
            id: wallet.id,
            name: wallet.name,
            kind: wallet.kind,
            assetSubtype: wallet.assetSubtype ?? "other",
            defaultFundingWalletId: profile?.defaultFundingWalletId ?? null,
            creditLimit: profile?.creditLimit.toString() ?? null,
            statementClosingDay: profile?.statementClosingDay ?? null,
            paymentDueDay: profile?.paymentDueDay ?? null,
            issuedStatement,
            balance: wallet.currentBalance.toString(),
            committed: committed.toString(),
            available:
              wallet.kind === "asset"
                ? new Decimal(wallet.currentBalance.toString())
                    .minus(committed)
                    .toString()
                : wallet.currentBalance.toString(),
            updatedAt: wallet.updatedAt.toISOString(),
          };
        })}
        totalByCurrency={totalByCurrency}
        members={members.map((member) => ({
          id: member.id,
          name: member.user.username ?? "Người dùng",
        }))}
        categories={categories.map((cat) => ({
          id: cat.id,
          name: cat.name,
          color: cat.color,
          icon: cat.icon,
          parentId: cat.parentId,
          type: cat.type as "income" | "expense",
        }))}
        transactions={transactions.map((transaction) => ({
          id: transaction.id,
          amount: transaction.amount.toString(),
          type: transaction.type,
          purpose: transaction.purpose,
          status: transaction.workflowStatus,
          description: transaction.description,
          date: transaction.date.toISOString(),
          walletId: transaction.walletId,
          toWalletId: transaction.toWalletId,
          wallet: transaction.wallet.name,
          toWallet: transaction.toWallet?.name ?? null,
          categoryId: transaction.categoryId,
          category: transaction.category,
          memberId: transaction.memberId,
          member: transaction.member.user.username ?? "Người dùng",
          paymentSources: transaction.creditCardPaymentSources.map(
            (source) => ({
              walletId: source.sourceWalletId,
              amount: source.amount.toString(),
            }),
          ),
        }))}
        userRole={membership.role.name}
        upcomingRecurring={recurringRows.map((item) => ({
          id: item.id,
          amount: item.amount.toString(),
          type: item.type,
          description: item.description,
          nextExecutionDate: item.nextExecutionDate.toISOString(),
          wallet: item.wallet.name,
          toWallet: item.toWallet?.name ?? null,
          category: item.category,
        }))}
      />
    </PageContainer>
  );
}
