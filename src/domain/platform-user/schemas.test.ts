import { describe, expect, it } from "vitest";

import {
  isPlatformAdminUsername,
  parsePlatformAdminUsernames,
  parsePortalUserSearchParams,
} from "@/domain/platform-user/schemas";

describe("portal user schemas", () => {
  it("normalizes search filters and page values", () => {
    expect(
      parsePortalUserSearchParams({
        q: "  felix  ",
        page: "2",
      }),
    ).toEqual({ q: "felix", page: 2 });
  });

  it("falls back to safe defaults for invalid filters", () => {
    expect(
      parsePortalUserSearchParams({ page: "-3" }),
    ).toEqual({ q: "", page: 1 });
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
