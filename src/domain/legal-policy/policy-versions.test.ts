import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import privacySource from "@/content/legal/privacy.json";
import termsSource from "@/content/legal/terms.json";
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_VERSION,
  hasCurrentLegalConsent,
  PRIVACY_POLICY_SOURCE_HASH,
  TERMS_SOURCE_HASH,
} from "@/domain/legal-policy/policy-versions";

function sourceHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

describe("legal policy versions", () => {
  it("requires a deliberate source-hash update when legal copy changes", () => {
    expect(sourceHash(privacySource)).toBe(PRIVACY_POLICY_SOURCE_HASH);
    expect(sourceHash(termsSource)).toBe(TERMS_SOURCE_HASH);
  });

  it("accepts only the exact current version pair", () => {
    expect(
      hasCurrentLegalConsent(
        CURRENT_PRIVACY_POLICY_VERSION,
        CURRENT_TERMS_VERSION,
      ),
    ).toBe(true);
    expect(hasCurrentLegalConsent("older", CURRENT_TERMS_VERSION)).toBe(false);
    expect(hasCurrentLegalConsent(undefined, undefined)).toBe(false);
  });
});
