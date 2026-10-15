import { redirect } from "next/navigation";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { FinancialPlansManager } from "@/app/dashboard/financial-plans/financial-plans-manager";
import { PageContainer } from "@/components/base";
import { monthDateRange } from "@/domain/financial-plan/month";
import { FINANCIAL_JAR_CODES, type FinancialJarCode } from "@/domain";
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

  const planRangeStart = view && view.status !== "draft" && view.months.length > 0
    ? monthDateRange(view.months[0].month).start
    : monthDateRange(businessMonth).start;
  const planRangeEnd = view && view.status !== "draft" && view.months.length > 0
    ? monthDateRange(view.months[view.months.length - 1].month).end
    : monthDateRange(businessMonth).end;

  const [financialGoals, walletLinks, expenseCategories, rawTransactions] = await Promise.all([
    selected
      ? getFinancialPlanGoalPortfolio(
          session.user.id,
          workspaceId,
          selected.id,
          currentPlanMonth?.projectedActualGoalAmount ?? currentPlanMonth?.adjustedRequiredAmount ?? "0",
        )
      : Promise.resolve([]),
    prisma.workspaceWallet.findMany({
      where: { workspaceId, wallet: { kind: "asset", status: "active", deletedAt: null } },
      select: { wallet: { select: { id: true, name: true, currentBalance: true } } },
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
            type: "expense",
            purpose: { not: "credit_card_payment" },
            workflowStatus: { in: ["approved", "scheduled", "pending"] },
            date: { gte: planRangeStart, lt: planRangeEnd },
            OR: [{ jarCode: { not: null } }, { category: { jarCode: { not: null } } }],
          },
          select: {
            id: true,
            amount: true,
            description: true,
            date: true,
            purpose: true,
            workflowStatus: true,
            jarCode: true,
            wallet: { select: { name: true } },
            member: { select: { user: { select: { username: true } } } },
            category: { select: { id: true, name: true, color: true, icon: true, jarCode: true } },
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 400,
        })
      : Promise.resolve([]),
  ]);

  const jarCategories = expenseCategories
    .filter((cat) => isFinancialJarCode(cat.jarCode))
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      jarCode: cat.jarCode as FinancialJarCode,
    }));

  const jarTransactions = rawTransactions.flatMap((tx) => {
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
      memberName: tx.member.user.username ?? "Thành viên",
      categoryId: tx.category?.id ?? null,
      categoryName: tx.category?.name ?? "Chưa phân loại",
      categoryColor: tx.category?.color ?? null,
    }];
  });

  return (
    <PageContainer>
      <div className="md:mx-auto md:max-w-7xl">
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
          goalWallets={walletLinks.map(({ wallet }) => ({ id: wallet.id, name: wallet.name, balance: wallet.currentBalance.toString() }))}
          jarCategories={jarCategories}
          jarTransactions={jarTransactions}
        />
      </div>
    </PageContainer>
  );
}

