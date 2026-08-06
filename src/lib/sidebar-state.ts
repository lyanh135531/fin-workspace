export const SIDEBAR_STATE_COOKIE = "fin-sidebar-collapsed";

export function isSidebarOpen(storedValue: string | undefined): boolean {
  return storedValue !== "true";
}
