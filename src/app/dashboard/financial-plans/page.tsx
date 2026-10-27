import Decimal from "decimal.js";
import { redirect } from "next/navigation";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { FinancialPlansManager } from "@/app/dashboard/financial-plans/financial-plans-manager";
import { PageContainer } from "@/components/base";
import { monthDateRange, monthsInclusive } from "@/domain/financial-plan/month";
import { FINANCIAL_JAR_CODES, splitVndAcrossMonths, type FinancialJarCode } from "@/domain";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { getFinancialPlanView, getWorkspaceFinancialPlans } from "@/services/financial-plan-service";
import { requireWorkspaceMember } from "@/services/workspace-access";
import { workspaceCapabilities } from "@/domain/role-policy";
import { getFinancialPlanGoalPortfolio } from "@/services/financial-goal-service";
import { prisma } from "@/lib/prisma";

function isFinancialJarCode(value: string | null | undefined): value is FinancialJarCode {
  return Boolean(value && FINANCIAL_JAR_CODES.includes(value as FinancialJarCode));
}

export default async function FinancialPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const session = await requireAcceptedLegalPageSession();
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) redirect("/overview");
  const member = await requireWorkspaceMember(session.user.id, workspaceId);
  const plans = await getWorkspaceFinancialPlans(session.user.id, workspaceId);
  const requestedId = (await searchParams).plan;
  const selected = plans.find((plan) => plan.id === requestedId)
    ?? plans.find((plan) => plan.status === "active")
    ?? plans.find((plan) => plan.status === "draft")
    ?? plans[0];
  const view = selected ? await getFinancialPlanView(session.user.id, workspaceId, selected.id) : null;
  const businessDate = getBusinessDateInTimeZone(member.workspace.timeZone);
  const businessMonth = businessDate.slice(0, 7);
  const currentPlanMonth = view && view.status !== "draft"
    ? view.months.find((month) => month.month === businessMonth && !month.closed) ?? view.months.find((month) => !month.closed)
    : null;
  const draftMonthlyGoalAmount =
    view && view.status === "draft"
      ? splitVndAcrossMonths(
          Decimal.max(
            new Decimal(view.targetAmount).minus(view.existingGoalAmount),
            0,
          ),
          monthsInclusive(
            businessMonth,
            view.targetMonth >= businessMonth ? view.targetMonth : businessMonth,
          ).length,
        )[0]?.toFixed(0) ?? "0"
      : "0";

  const planRangeStart = view && view.status !== "draft" && view.months.length > 0
    ? monthDateRange(view.months[0].month).start
    : monthDateRange(businessMonth).start;
  const planRangeEnd = view && view.status !== "draft" && view.months.length > 0
    ? monthDateRange(view.months[view.months.length - 1].month).end
    : monthDateRange(businessMonth).end;

  const [financialGoals, walletLinks, expenseCategories, rawTransactions, rawInstallments] = await Promise.all([
    selected
      ? getFinancialPlanGoalPortfolio(
          session.user.id,
          workspaceId,
          selected.id,
          currentPlanMonth?.projectedActualGoalAmount ??
            currentPlanMonth?.adjustedRequiredAmount ??
            draftMonthlyGoalAmount,
        )
      : Promise.resolve([]),
    prisma.workspaceWallet.findMany({
      where: { workspaceId, wallet: { deletedAt: null } },
      select: {
        wallet: {
          select: {
            id: true,
            name: true,
            kind: true,
            status: true,
            currentBalance: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { wallet: { name: "asc" } }],
    }),
    prisma.category.findMany({
      where: { workspaceId, type: "expense", status: "active", deletedAt: null, jarCode: { not: null } },
      select: { id: true, name: true, color: true, icon: true, jarCode: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    view && view.status !== "draft"
      ? prisma.transaction.findMany({
          where: {
            member: { workspaceId },
            deletedAt: null,
            workflowStatus: { in: ["approved", "scheduled", "pending"] },
            date: { gte: planRangeStart, lt: planRangeEnd },
            OR: [
              {
                type: "expense",
                purpose: {
                  notIn: [
                    "credit_card_payment",
                    "investment_contribution",
                    "investment_settlement",
                    "balance_reconciliation",
                  ],
                },
              },
              { purpose: "credit_card_refund" },
            ],
            AND: [
              { OR: [{ jarCode: { not: null } }, { category: { jarCode: { not: null } } }] },
            ],
          },
          select: {
            id: true,
            amount: true,
            description: true,
            date: true,
            purpose: true,
            workflowStatus: true,
            jarCode: true,
            wallet: { select: { name: true, kind: true } },
            member: { select: { user: { select: { username: true } } } },
            category: { select: { id: true, name: true, color: true, icon: true, jarCode: true } },
            installmentPlan: { select: { id: true, status: true } },
            installmentFeePlan: { select: { id: true, status: true } },
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 5000,
        })
      : Promise.resolve([]),
    view && view.status !== "draft"
      ? prisma.creditCardInstallment.findMany({
          where: {
            dueDate: { gte: planRangeStart, lt: planRangeEnd },
            plan: {
              workspaceId,
              status: { in: ["active", "completed"] },
              card: { wallet: { deletedAt: null } },
            },
          },
          select: {
            id: true,
            installmentNo: true,
            dueDate: true,
            principalAmount: true,
            feeAmount: true,
            statementItems: { select: { id: true } },
            plan: {
              select: {
                termCount: true,
                description: true,
                status: true,
                card: { select: { wallet: { select: { name: true } } } },
                createdBy: { select: { user: { select: { username: true } } } },
                transaction: {
                  select: {
                    description: true,
                    jarCode: true,
                    category: { select: { id: true, name: true, color: true, jarCode: true } },
                  },
                },
              },
            },
          },
          orderBy: [{ dueDate: "desc" }, { installmentNo: "desc" }],
        })
      : Promise.resolve([]),
  ]);

  const assetWallets = walletLinks.filter(({ wallet }) => wallet.kind === "asset");
  const activeAssetWallets = assetWallets.filter(({ wallet }) => wallet.status === "active");
  const creditCardWallets = walletLinks.filter(({ wallet }) => wallet.kind === "credit_card");
  const totalAssetBalance = assetWallets.reduce(
    (sum, { wallet }) => sum.plus(wallet.currentBalance.toString()),
    new Decimal(0),
  );
  const totalCreditCardDebt = creditCardWallets.reduce(
    (sum, { wallet }) => sum.plus(Decimal.max(new Decimal(wallet.currentBalance.toString()), 0)),
    new Decimal(0),
  );

  const jarCategories = expenseCategories
    .filter((cat) => isFinancialJarCode(cat.jarCode))
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      jarCode: cat.jarCode as FinancialJarCode,
    }));

  const regularJarTransactions = rawTransactions.flatMap((tx) => {
    if (
      (tx.installmentPlan && tx.installmentPlan.status !== "pending") ||
      (tx.purpose === "credit_card_installment_fee" &&
        tx.installmentFeePlan &&
        tx.installmentFeePlan.status !== "pending")
    ) {
      return [];
    }
    const resolvedJar = tx.jarCode ?? tx.category?.jarCode ?? null;
    if (!isFinancialJarCode(resolvedJar)) return [];
    const isoDate = tx.date.toISOString().slice(0, 10);
    const signedAmount = tx.purpose === "credit_card_refund"
      ? `-${tx.amount.toString()}`
      : tx.amount.toString();
    return [{
      id: tx.id,
      jarCode: resolvedJar,
      month: isoDate.slice(0, 7),
      date: isoDate,
      amount: signedAmount,
      description: tx.description,
      workflowStatus: tx.workflowStatus,
      walletName: tx.wallet.name,
      walletKind: tx.wallet.kind,
      memberName: tx.member.user.username ?? "Thành viên",
      categoryId: tx.category?.id ?? null,
      categoryName: tx.category?.name ?? "Chưa phân loại",
      categoryColor: tx.category?.color ?? null,
    }];
  });

  const installmentJarTransactions = rawInstallments.flatMap((inst) => {
    const resolvedJar =
      inst.plan.transaction?.jarCode ??
      inst.plan.transaction?.category?.jarCode ??
      "RESPONSIBILITY";
    if (!isFinancialJarCode(resolvedJar)) return [];
    const isoDate = inst.dueDate.toISOString().slice(0, 10);
    const totalInstAmount = new Decimal(inst.principalAmount.toString())
      .plus(inst.feeAmount.toString())
      .toString();
    const workflowStatus =
      inst.statementItems.length > 0 ||
      inst.plan.status === "completed" ||
      isoDate.slice(0, 7) <= businessMonth
        ? ("approved" as const)
        : ("scheduled" as const);
    return [{
      id: `inst-${inst.id}`,
      jarCode: resolvedJar,
      month: isoDate.slice(0, 7),
      date: isoDate,
      amount: totalInstAmount,
      description: `Trả góp kỳ ${inst.installmentNo}/${inst.plan.termCount}: ${inst.plan.description || inst.plan.transaction?.description || "Khoản trả góp thẻ"}`,
      workflowStatus,
      walletName: inst.plan.card.wallet.name,
      walletKind: "credit_card" as const,
      isInstallment: true,
      memberName: inst.plan.createdBy.user.username ?? "Thành viên",
      categoryId: inst.plan.transaction?.category?.id ?? null,
      categoryName: inst.plan.transaction?.category?.name ?? "Trả góp thẻ tín dụng",
      categoryColor: inst.plan.transaction?.category?.color ?? null,
    }];
  });

  const jarTransactions = [...regularJarTransactions, ...installmentJarTransactions].sort(
    (a, b) => b.date.localeCompare(a.date),
  );

  return (
    <PageContainer>
      <FinancialPlansManager
        workspaceName={member.workspace.name}
        currency={member.workspace.baseCurrency}
        businessDate={businessDate}
        businessMonth={businessMonth}
        canManage={workspaceCapabilities(member.role.code).canManagePlans}
        plans={plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          status: plan.status,
          targetAmount: plan.targetAmount.toString(),
          existingGoalAmount: plan.existingGoalAmount.toString(),
          startMonth: plan.startMonth?.toISOString().slice(0, 7) ?? null,
          targetMonth: plan.targetMonth.toISOString().slice(0, 7),
        }))}
        selectedPlan={view}
        financialGoals={financialGoals}
        goalWallets={activeAssetWallets.map(({ wallet }) => ({ id: wallet.id, name: wallet.name, balance: wallet.currentBalance.toString() }))}
        walletSummary={{
          totalAssetBalance: totalAssetBalance.toFixed(0),
          totalCreditCardDebt: totalCreditCardDebt.toFixed(0),
          assetWalletCount: assetWallets.length,
          creditCardCount: creditCardWallets.length,
        }}
        jarCategories={jarCategories}
        jarTransactions={jarTransactions}
      />
    </PageContainer>
  );
}

