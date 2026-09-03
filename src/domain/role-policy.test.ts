import { describe, expect, it } from "vitest";
import { isAdminRole, isWorkspaceRoleCode, workspaceCapabilities } from "@/domain/role-policy";

describe("role policy", () => {
  it("grants administrative capabilities only to Admin", () => {
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("MEMBER")).toBe(false);
    expect(isAdminRole("OWNER")).toBe(false);
  });

  it("accepts only Admin and Member as workspace roles", () => {
    expect(isWorkspaceRoleCode("ADMIN")).toBe(true);
    expect(isWorkspaceRoleCode("MEMBER")).toBe(true);
    expect(isWorkspaceRoleCode("OWNER")).toBe(false);
  });

  it("lets members create recurring schedules without granting management rights", () => {
    expect(workspaceCapabilities("MEMBER")).toMatchObject({
      canCreateRecurringTransactions: true,
      canApproveRecurringTransactions: false,
      canManageWorkspace: false,
      canManageWallets: false,
      canManagePlans: false,
    });
  });
});
