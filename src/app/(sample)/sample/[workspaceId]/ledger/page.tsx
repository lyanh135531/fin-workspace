import { WorkspaceDashboard } from "@/app/dashboard/page";

export default async function SampleLedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ action?: string | string[] }>;
}) {
  const [{ workspaceId }, { action }] = await Promise.all([params, searchParams]);
  return <WorkspaceDashboard targetWorkspaceId={workspaceId} startWithNewTransaction={action === "new-transaction"} />;
}
