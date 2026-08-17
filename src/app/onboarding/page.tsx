import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { OnboardingClient } from "@/app/onboarding/onboarding-client";
import { authOptions } from "@/auth";
import { resolveActiveWorkspaceId } from "@/services/active-workspace";
import { getUserJoinRequests } from "@/services/join-request-query";

export const metadata: Metadata = {
  title: "Bắt đầu với Felix",
  description: "Thiết lập không gian tài chính đầu tiên của bạn.",
};

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");

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
    <OnboardingClient
      username={session.user.username ?? "bạn"}
      pendingRequests={pendingRequests}
    />
  );
}
