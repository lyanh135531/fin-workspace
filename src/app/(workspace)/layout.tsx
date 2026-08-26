import type { Metadata } from "next";

import { DashboardShell } from "@/app/dashboard/dashboard-shell";
import { appPwaMetadata } from "@/lib/pwa-metadata";

export const metadata: Metadata = {
  ...appPwaMetadata,
  robots: { index: false, follow: false },
};

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
