import { redirect } from "next/navigation";

import { WorkspaceDashboard } from "@/app/dashboard/workspace-dashboard";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";

type WorkspacePageProps = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ action?: string | string[] }>;
};

export default async function WorkspacePage({ params, searchParams }: WorkspacePageProps) {
  const [{ workspaceId }, { action }, session] = await Promise.all([
    params,
    searchParams,
    requireAcceptedLegalPageSession(),
  ]);
  const activeWorkspaceId = await resolveActiveWorkspaceId(session.user.id);
  const startWithNewTransaction = action === "new-transaction";

  if (workspaceId === activeWorkspaceId) {
    redirect(
      startWithNewTransaction
        ? "/dashboard?action=new-transaction"
        : "/dashboard",
    );
  }

  return (
    <WorkspaceDashboard
      targetWorkspaceId={workspaceId}
      startWithNewTransaction={startWithNewTransaction}
    />
  );
}
