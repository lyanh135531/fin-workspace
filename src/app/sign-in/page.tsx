import { headers } from "next/headers";

import { googleAuthEnabled } from "@/auth";
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
  const errorValue = params.error;
  const googleError = Array.isArray(errorValue) ? errorValue[0] : errorValue;

  return (
    <SignInClient
      callbackUrl={callbackUrl}
      portalMode={isPortalHostname(hostname)}
      googleEnabled={googleAuthEnabled}
      googleError={Boolean(googleError)}
    />
  );
}
