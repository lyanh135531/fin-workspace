import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/auth";
import { GoogleSetupClient } from "@/app/setup/google/google-setup-client";
import { prisma } from "@/lib/prisma";

export default async function GoogleSetupPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in");
  if (session.user.profileCompleted) redirect("/overview");
  const account = await prisma.oAuthAccount.findFirst({
    where: { userId: session.user.id, provider: "google" },
    select: { email: true },
  });
  if (!account) redirect("/sign-in");
  return <GoogleSetupClient email={account.email} />;
}
