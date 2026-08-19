import { headers } from "next/headers";

import { isPortalHostname, normalizeHostname } from "@/lib/host-routing";
import { SignInClient } from "./sign-in-client";

type SignInPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const headerStore = await headers();
  const forwardedHost = headerStore.get("x-forwarded-host");
  const hostname = normalizeHostname(
    forwardedHost ?? headerStore.get("host"),
  );
  const params = await searchParams;
  const callbackValue = params.callbackUrl;
  const callbackUrl = Array.isArray(callbackValue)
    ? callbackValue[0]
    : callbackValue;

  return (
    <SignInClient
      callbackUrl={callbackUrl}
      portalMode={isPortalHostname(hostname)}
    />
  );
}
