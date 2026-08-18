import { describe, expect, it } from "vitest";

import {
  getHostnameRedirectTarget,
  isApplicationPath,
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
