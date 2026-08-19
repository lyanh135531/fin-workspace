import type { Metadata } from "next";
import Link from "next/link";

import { FinLogo } from "@/components/fin-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { requirePlatformAdminSession } from "@/services/platform-access";
import { PortalSidebarNav } from "./portal-sidebar-nav";
import { PortalHeader } from "./portal-header";

export const metadata: Metadata = {
  title: "Portal người dùng",
  robots: { index: false, follow: false },
};

export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await requirePlatformAdminSession();

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="min-[901px]:pb-3">
          <Link
            href="/portal"
            className="flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md px-1 text-[var(--foreground)] outline-none transition-[width,height,padding,color,gap] duration-200 hover:text-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] min-[901px]:h-11 min-[901px]:justify-start min-[901px]:gap-3 min-[901px]:rounded-xl min-[901px]:px-2 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:self-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0! min-[901px]:group-data-[collapsible=icon]:size-10!"
            aria-label="Felix Portal"
          >
            <FinLogo size={36} />
            <span className="max-w-28 truncate text-base font-semibold tracking-[-0.02em] transition-[max-width,opacity] duration-200 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0">
              Portal
            </span>
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <PortalSidebarNav />
        </SidebarContent>

        <SidebarFooter className="min-[901px]:pt-3">
          <div className="flex min-w-0 items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-[width,height,padding,gap] duration-300 ease-in-out group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--primary)_14%,var(--surface))] text-xs font-bold text-[var(--primary)]">
              {admin.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 overflow-hidden opacity-100 transition-[max-width,opacity] duration-200 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0">
              <p className="truncate font-semibold text-[var(--foreground)]" title={admin.username}>
                {admin.username}
              </p>
              <p className="text-[0.68rem] text-[var(--text-muted)]">Portal Admin</p>
            </div>
          </div>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset className="flex h-dvh min-h-0 min-w-0 flex-col bg-[var(--surface-secondary)]">
        <PortalHeader username={admin.username} />

        <main id="main-content" className="flex flex-1 min-h-0 flex-col overflow-hidden">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
