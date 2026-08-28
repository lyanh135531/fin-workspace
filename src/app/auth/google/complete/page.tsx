import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authOptions } from "@/auth";
import { isPortalHostname, normalizeHostname } from "@/lib/host-routing";

export default async function GoogleAuthCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/sign-in?error=google");
  if (!session.user.profileCompleted) redirect("/setup/google");

  const { returnTo } = await searchParams;
  const headerStore = await headers();
  const hostname = normalizeHostname(headerStore.get("x-forwarded-host") ?? headerStore.get("host"));
  const destination =
    returnTo === "password"
      ? "/account/google-password"
      : returnTo === "account"
        ? "/overview?google=linked"
        : isPortalHostname(hostname)
          ? "/portal"
          : "/overview";
  if (!session.user.legalConsentSatisfied) {
    redirect(`/consent?callbackUrl=${encodeURIComponent(destination)}`);
  }
  redirect(destination);
}
