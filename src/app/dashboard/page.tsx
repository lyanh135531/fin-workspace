import { redirect } from "next/navigation";

import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string | string[] }>;
}) {
  const [{ action }, session] = await Promise.all([
    searchParams,
    requireAcceptedLegalPageSession(),
  ]);
  const activeWorkspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (!activeWorkspaceId) {
    redirect("/onboarding");
  }

  const query = action === "new-transaction" ? "?action=new-transaction" : "";
  redirect(`/workspace/${activeWorkspaceId}${query}`);
}
