import { redirect } from "next/navigation";
import { InvestmentsManager } from "@/app/dashboard/investments/investments-manager";
import { PageContainer } from "@/components/base";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { getWorkspaceInvestmentsOverview } from "@/services/investment-service";

export default async function InvestmentsPage() {
  const session = await requireAcceptedLegalPageSession();
  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!workspaceId) redirect("/overview");

  const data = await getWorkspaceInvestmentsOverview(session.user.id, workspaceId);

  return (
    <PageContainer>
      <InvestmentsManager data={data} />
    </PageContainer>
  );
}
