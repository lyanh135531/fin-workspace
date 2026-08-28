import { describe, expect, it } from "vitest";

import {
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_VERSION,
} from "@/domain/legal-policy/policy-versions";
import { getAuthenticatedPrerequisiteRedirect } from "@/lib/legal-routing";

const base = {
  pathname: "/overview",
  search: "",
  hostname: "app.felixwise.io.vn",
  profileCompleted: true,
  acceptedPrivacyVersion: CURRENT_PRIVACY_POLICY_VERSION,
  acceptedTermsVersion: CURRENT_TERMS_VERSION,
  consentEnforced: true,
};

describe("authenticated legal routing", () => {
  it("completes a provisional Google profile before requesting consent", () => {
    expect(
      getAuthenticatedPrerequisiteRedirect({
        ...base,
        profileCompleted: false,
        acceptedPrivacyVersion: null,
        acceptedTermsVersion: null,
      }),
    ).toBe("/setup/google");
    expect(
      getAuthenticatedPrerequisiteRedirect({
        ...base,
        pathname: "/setup/google",
        profileCompleted: false,
      }),
    ).toBeNull();
  });

  it("sends missing and stale consent to the consent screen", () => {
    expect(
      getAuthenticatedPrerequisiteRedirect({
        ...base,
        pathname: "/wallets",
        search: "?status=active",
        acceptedPrivacyVersion: null,
        acceptedTermsVersion: "older",
      }),
    ).toBe("/consent?callbackUrl=%2Fwallets%3Fstatus%3Dactive");
  });

  it("allows the consent screen without creating a redirect loop", () => {
    expect(
      getAuthenticatedPrerequisiteRedirect({
        ...base,
        pathname: "/consent",
        acceptedPrivacyVersion: null,
        acceptedTermsVersion: null,
      }),
    ).toBeNull();
  });

  it("leaves accepted users in the app and exits consent on the correct host", () => {
    expect(getAuthenticatedPrerequisiteRedirect(base)).toBeNull();
    expect(
      getAuthenticatedPrerequisiteRedirect({ ...base, pathname: "/consent" }),
    ).toBe("/overview");
    expect(
      getAuthenticatedPrerequisiteRedirect({
        ...base,
        pathname: "/consent",
        hostname: "portal.felixwise.io.vn",
      }),
    ).toBe("/portal");
  });

  it("does not enforce consent while the rollout flag is disabled", () => {
    expect(
      getAuthenticatedPrerequisiteRedirect({
        ...base,
        acceptedPrivacyVersion: null,
        acceptedTermsVersion: null,
        consentEnforced: false,
      }),
    ).toBeNull();
  });
});
