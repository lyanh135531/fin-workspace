export const CURRENT_PRIVACY_POLICY_VERSION = "2026-08-28";
export const CURRENT_TERMS_VERSION = "2026-08-28";
export const CURRENT_LEGAL_EFFECTIVE_DATE = "28/08/2026";

export const PRIVACY_POLICY_SOURCE_HASH =
  "a8585cbe3aa32925c01c7eed22a4febcb29244953f4efc8d8c6db9bf2da125e4";
export const TERMS_SOURCE_HASH =
  "68c068885b63b544c69c8c3260a646cd4bf5a8ae2878999b32919a88839957df";

export function isLegalConsentEnforced() {
  return process.env.LEGAL_CONSENT_ENFORCED === "true";
}

export function hasCurrentLegalConsent(
  privacyVersion: string | null | undefined,
  termsVersion: string | null | undefined,
) {
  return (
    privacyVersion === CURRENT_PRIVACY_POLICY_VERSION &&
    termsVersion === CURRENT_TERMS_VERSION
  );
}
