export const CURRENT_PRIVACY_POLICY_VERSION = "2026-08-28";
export const CURRENT_TERMS_VERSION = "2026-08-28";
export const CURRENT_LEGAL_EFFECTIVE_DATE = "28/08/2026";

export const PRIVACY_POLICY_SOURCE_HASH =
  "d6e49904393fa4d2b96a7d434fc548ca45a93362a393512f8d2e63fb77a61ce1";
export const TERMS_SOURCE_HASH =
  "6999523fe3becda5912594b0d6a2680f8678815a89d58e1a4b7ce65026e0a175";

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
