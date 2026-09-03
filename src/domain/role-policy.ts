import { z } from "zod";

export const ADMIN_ROLE_CODES = ["ADMIN"] as const;
export const WORKSPACE_ROLE_CODES = ["ADMIN", "MEMBER"] as const;
export const workspaceRoleCodeSchema = z.enum(WORKSPACE_ROLE_CODES);

export function isAdminRole(roleCode: string) {
  return roleCode === "ADMIN";
}

export type WorkspaceCapabilities = {
  canApproveTransactions: boolean;
  canManageWorkspace: boolean;
  canManageWallets: boolean;
  canManagePlans: boolean;
  canCreateRecurringTransactions: boolean;
  canApproveRecurringTransactions: boolean;
};

export function workspaceCapabilities(roleCode: string): WorkspaceCapabilities {
  const isAdmin = isAdminRole(roleCode);
  return {
    canApproveTransactions: isAdmin,
    canManageWorkspace: isAdmin,
    canManageWallets: isAdmin,
    canManagePlans: isAdmin,
    canCreateRecurringTransactions: true,
    canApproveRecurringTransactions: isAdmin,
  };
}

export function isWorkspaceRoleCode(roleCode: string): roleCode is typeof WORKSPACE_ROLE_CODES[number] {
  return WORKSPACE_ROLE_CODES.some((code) => code === roleCode);
}
