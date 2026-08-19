import { describe, expect, it } from "vitest";

import {
  isPlatformAdminUsername,
  parsePortalUserActivitySearchParams,
  parsePlatformAdminUsernames,
  parsePortalUserSearchParams,
} from "@/domain/platform-user/schemas";

describe("portal user schemas", () => {
  it("normalizes search filters and page values", () => {
    expect(
      parsePortalUserSearchParams({
        q: "  felix  ",
        status: "active",
        page: "2",
      }),
    ).toEqual({ q: "felix", status: "active", page: 2 });
  });

  it("falls back to safe defaults for invalid filters", () => {
    expect(
      parsePortalUserSearchParams({ status: "unknown", page: "-3" }),
    ).toEqual({ q: "", status: "all", page: 1 });
  });

  it("rejects unsafe activity page values", () => {
    expect(
      parsePortalUserActivitySearchParams({ activityPage: "Infinity" }),
    ).toEqual({ activityPage: 1 });
    expect(
      parsePortalUserActivitySearchParams({ activityPage: "1.5" }),
    ).toEqual({ activityPage: 1 });
    expect(
      parsePortalUserActivitySearchParams({ activityPage: ["3", "4"] }),
    ).toEqual({ activityPage: 3 });
  });

  it("parses an exact, comma-separated platform admin allowlist", () => {
    expect(parsePlatformAdminUsernames(" admin, operator ,, ")).toEqual(
      new Set(["admin", "operator"]),
    );
    expect(isPlatformAdminUsername("admin", "admin,operator")).toBe(true);
    expect(isPlatformAdminUsername("Admin", "admin,operator")).toBe(false);
  });

  it("denies access when the allowlist is empty", () => {
    expect(isPlatformAdminUsername("admin", undefined)).toBe(false);
  });
});
