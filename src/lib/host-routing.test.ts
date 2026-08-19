import { describe, expect, it } from "vitest";

import {
  getPostSignInPath,
  getHostnameRedirectTarget,
  isApplicationPath,
  normalizeHostname,
} from "@/lib/host-routing";

describe("hostname routing", () => {
  it("keeps the marketing homepage on the apex domain", () => {
    expect(getHostnameRedirectTarget("felixwise.io.vn", "/")).toBeNull();
  });

  it("sends the app homepage to the authenticated application entry", () => {
    expect(getHostnameRedirectTarget("app.felixwise.io.vn", "/")).toBe(
      "https://app.felixwise.io.vn/overview",
    );
  });

  it("moves legacy application deep links from the apex domain", () => {
    expect(
      getHostnameRedirectTarget(
        "felixwise.io.vn",
        "/dashboard/settings/general",
      ),
    ).toBe("https://app.felixwise.io.vn/dashboard/settings/general");
  });

  it("routes portal paths from public and app domains to the portal hostname", () => {
    expect(isApplicationPath("/portal/users")).toBe(true);
    expect(
      getHostnameRedirectTarget("felixwise.io.vn", "/portal/users"),
    ).toBe("https://portal.felixwise.io.vn/portal/users");
    expect(
      getHostnameRedirectTarget("app.felixwise.io.vn", "/portal/users"),
    ).toBe("https://portal.felixwise.io.vn/portal/users");
  });

  it("keeps the portal on its own authenticated hostname", () => {
    expect(
      getHostnameRedirectTarget("portal.felixwise.io.vn", "/"),
    ).toBe("https://portal.felixwise.io.vn/portal");
    expect(
      getHostnameRedirectTarget("portal.felixwise.io.vn", "/portal/users"),
    ).toBeNull();
    expect(
      getHostnameRedirectTarget("portal.felixwise.io.vn", "/sign-in"),
    ).toBeNull();
    expect(
      getHostnameRedirectTarget("portal.felixwise.io.vn", "/overview"),
    ).toBe("https://portal.felixwise.io.vn/portal");
  });

  it("preserves safe same-host deep links after sign-in", () => {
    expect(
      getPostSignInPath(
        "portal.felixwise.io.vn",
        "/portal/users?page=2",
        "https://portal.felixwise.io.vn",
      ),
    ).toBe("/portal/users?page=2");
    expect(
      getPostSignInPath(
        "portal.felixwise.io.vn",
        "https://app.felixwise.io.vn/overview",
        "https://portal.felixwise.io.vn",
      ),
    ).toBe("/portal");
  });

  it("normalizes forwarded hosts without sharing subdomain identity", () => {
    expect(normalizeHostname(" Portal.Felixwise.io.vn:443, proxy.local")).toBe(
      "portal.felixwise.io.vn",
    );
  });

  it("does not redirect similarly named marketing paths", () => {
    expect(isApplicationPath("/dashboard-preview")).toBe(false);
    expect(
      getHostnameRedirectTarget("felixwise.io.vn", "/dashboard-preview"),
    ).toBeNull();
  });

  it("does not interfere with local development", () => {
    expect(getHostnameRedirectTarget("localhost", "/overview")).toBeNull();
  });
});
