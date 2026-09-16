import { redirect } from "next/navigation";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { FinancialPlansManager } from "@/app/dashboard/financial-plans/financial-plans-manager";
import { PageContainer } from "@/components/base";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { getFinancialPlanView, getWorkspaceFinancialPlans } from "@/services/financial-plan-service";
import { requireWorkspaceMember } from "@/services/workspace-access";
import { workspaceCapabilities } from "@/domain/role-policy";
import { getFinancialPlanGoalPortfolio } from "@/services/financial-goal-service";
import { prisma } from "@/lib/prisma";

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
  const businessMonth = getBusinessDateInTimeZone(member.workspace.timeZone).slice(0, 7);
  const currentPlanMonth = view && view.status !== "draft"
    ? view.months.find((month) => month.month === businessMonth && !month.closed) ?? view.months.find((month) => !month.closed)
    : null;
  const [financialGoals, walletLinks] = await Promise.all([
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
  ]);

  return (
    <PageContainer>
      <div className="min-[901px]:mx-auto min-[901px]:max-w-[76rem]">
        <FinancialPlansManager
          workspaceName={member.workspace.name}
          currency={member.workspace.baseCurrency}
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
        />
      </div>
    </PageContainer>
  );
}
