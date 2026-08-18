import type { Metadata } from "next";

import { DashboardShell } from "@/app/dashboard/dashboard-shell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
