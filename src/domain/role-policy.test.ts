import { describe, expect, it } from "vitest";
import { isAdminRole, isOwnerRole } from "@/domain/role-policy";

describe("role policy", () => {
  it("lets Owner inherit every Admin capability", () => {
    expect(isAdminRole("OWNER")).toBe(true);
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("MEMBER")).toBe(false);
  });

  it("keeps Owner-only capabilities distinct", () => {
    expect(isOwnerRole("OWNER")).toBe(true);
    expect(isOwnerRole("ADMIN")).toBe(false);
  });
});
