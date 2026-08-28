import { redirect } from "next/navigation";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { FinancialPlansManager } from "@/app/dashboard/financial-plans/financial-plans-manager";
import { PageContainer } from "@/components/base";
import { getBusinessDateInTimeZone } from "@/lib/date";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { getFinancialPlanView, getWorkspaceFinancialPlans } from "@/services/financial-plan-service";
import { requireWorkspaceMember } from "@/services/workspace-access";
import { isAdminRole } from "@/domain/role-policy";

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

  return (
    <PageContainer>
      <div className="min-[901px]:mx-auto min-[901px]:max-w-[76rem]">
        <FinancialPlansManager
          workspaceName={member.workspace.name}
          currency={member.workspace.baseCurrency}
          businessMonth={getBusinessDateInTimeZone(member.workspace.timeZone).slice(0, 7)}
          canManage={isAdminRole(member.role.code)}
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
        />
      </div>
    </PageContainer>
  );
}
