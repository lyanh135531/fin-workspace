import { z } from "zod";

export const ADMIN_ROLE_CODES = ["ADMIN"] as const;
export const WORKSPACE_ROLE_CODES = ["ADMIN", "MEMBER"] as const;
export const workspaceRoleCodeSchema = z.enum(WORKSPACE_ROLE_CODES);

export function isAdminRole(roleCode: string) {
  return roleCode === "ADMIN";
}

export function isWorkspaceRoleCode(roleCode: string): roleCode is typeof WORKSPACE_ROLE_CODES[number] {
  return WORKSPACE_ROLE_CODES.some((code) => code === roleCode);
}
