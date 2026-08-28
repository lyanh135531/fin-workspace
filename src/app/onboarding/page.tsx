import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingClient } from "@/app/onboarding/onboarding-client";
import { PwaInstallProvider } from "@/app/pwa-install";
import { requireAcceptedLegalPageSession } from "@/lib/legal-access";
import { appPwaMetadata } from "@/lib/pwa-metadata";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { getUserJoinRequests } from "@/services/join-request-query";

export const metadata: Metadata = {
  ...appPwaMetadata,
  title: "Bắt đầu với Felix",
  description: "Thiết lập không gian tài chính đầu tiên của bạn.",
};

export default async function OnboardingPage() {
  const session = await requireAcceptedLegalPageSession();

  const workspaceId = await resolveActiveWorkspaceId(session.user.id);
  if (workspaceId) redirect("/overview");

  const requests = await getUserJoinRequests(session.user.id);
  const pendingRequests = requests
    .filter((request) => request.status === "pending")
    .map((request) => ({
      id: request.id,
      workspaceName: request.workspaceName,
      createdAt: request.createdAt.toISOString(),
    }));

  return (
    <PwaInstallProvider>
      <OnboardingClient
        username={session.user.username ?? "bạn"}
        pendingRequests={pendingRequests}
      />
    </PwaInstallProvider>
  );
}
