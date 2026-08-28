import { hasCurrentLegalConsent } from "@/domain/legal-policy/policy-versions";
import { isPortalHostname } from "@/lib/host-routing";

type AuthenticatedPrerequisiteInput = {
  pathname: string;
  search: string;
  hostname: string;
  profileCompleted: boolean | undefined;
  acceptedPrivacyVersion: string | null | undefined;
  acceptedTermsVersion: string | null | undefined;
  consentEnforced: boolean;
};

export function getAuthenticatedPrerequisiteRedirect({
  pathname,
  search,
  hostname,
  profileCompleted,
  acceptedPrivacyVersion,
  acceptedTermsVersion,
  consentEnforced,
}: AuthenticatedPrerequisiteInput) {
  if (profileCompleted === false && pathname !== "/setup/google") {
    return "/setup/google";
  }

  const hasConsent = hasCurrentLegalConsent(
    acceptedPrivacyVersion,
    acceptedTermsVersion,
  );
  if (
    profileCompleted !== false &&
    consentEnforced &&
    !hasConsent &&
    pathname !== "/consent"
  ) {
    const query = new URLSearchParams({ callbackUrl: `${pathname}${search}` });
    return `/consent?${query.toString()}`;
  }

  if (pathname === "/consent" && (!consentEnforced || hasConsent)) {
    return isPortalHostname(hostname) ? "/portal" : "/overview";
  }

  return null;
}
