import { DashboardShell } from "@/app/dashboard/dashboard-shell";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
