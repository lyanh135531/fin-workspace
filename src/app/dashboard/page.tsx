import { WorkspaceDashboard } from "@/app/dashboard/workspace-dashboard";
import { PageContainer } from "@/components/base";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string | string[] }>;
}) {
  const { action } = await searchParams;
  return (
    <PageContainer className="dashboard-page-container lg:h-full lg:min-h-0">
      <WorkspaceDashboard
        startWithNewTransaction={action === "new-transaction"}
      />
    </PageContainer>
  );
}
