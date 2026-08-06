import { WorkspaceDashboard } from "@/app/dashboard/page";

type WorkspacePageProps = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ action?: string | string[] }>;
};

export default async function WorkspacePage({ params, searchParams }: WorkspacePageProps) {
  const [{ workspaceId }, { action }] = await Promise.all([params, searchParams]);

  return (
    <WorkspaceDashboard
      targetWorkspaceId={workspaceId}
      startWithNewTransaction={action === "new-transaction"}
    />
  );
}
