export const ADMIN_ROLE_CODES = ["OWNER", "ADMIN"] as const;

export function isAdminRole(roleCode: string) {
  return roleCode === "OWNER" || roleCode === "ADMIN";
}

export function isOwnerRole(roleCode: string) {
  return roleCode === "OWNER";
}
