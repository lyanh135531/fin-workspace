import { describe, expect, it } from "vitest";

import { isSignInAllowedOnHostname } from "@/lib/portal-auth";

describe("portal authentication boundary", () => {
  it("allows normal users on the main application hostname", () => {
    expect(
      isSignInAllowedOnHostname(
        "user-a",
        "app.felixwise.io.vn",
        "admin",
      ),
    ).toBe(true);
  });

  it("allows only configured platform admins on the portal hostname", () => {
    expect(
      isSignInAllowedOnHostname(
        "admin",
        "portal.felixwise.io.vn",
        "admin",
      ),
    ).toBe(true);
    expect(
      isSignInAllowedOnHostname(
        "user-a",
        "portal.felixwise.io.vn",
        "admin",
      ),
    ).toBe(false);
  });
});
