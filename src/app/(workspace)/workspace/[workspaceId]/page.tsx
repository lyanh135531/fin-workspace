import { WorkspaceDashboard } from "@/app/dashboard/workspace-dashboard";
import { PageContainer } from "@/components/base";

type WorkspacePageProps = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ action?: string | string[] }>;
};

export default async function WorkspacePage({
  params,
  searchParams,
}: WorkspacePageProps) {
  const [{ workspaceId }, { action }] = await Promise.all([
    params,
    searchParams,
  ]);
  const startWithNewTransaction = action === "new-transaction";

  return (
    <PageContainer className="dashboard-page-container">
      <WorkspaceDashboard
        targetWorkspaceId={workspaceId}
        startWithNewTransaction={startWithNewTransaction}
      />
    </PageContainer>
  );
}
