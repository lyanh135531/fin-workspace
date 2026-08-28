import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { CreateWorkspaceForm } from "@/app/dashboard/workspaces/create/create-workspace-form";
import { PageContainer } from "@/components/base";

export default async function CreateWorkspacePage() {
  await requireAcceptedLegalPageSession();

  return (
    <PageContainer className="workspace-create-shell">
      <CreateWorkspaceForm />
    </PageContainer>
  );
}
