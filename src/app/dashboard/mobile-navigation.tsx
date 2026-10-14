"use client";

import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/base";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DashboardNavigation } from "@/app/dashboard/dashboard-navigation";
import { AccountSettingsModal } from "@/app/dashboard/account-settings-modal";
import { SidebarUserMenu } from "@/app/dashboard/sidebar-user-menu";
import { FinLogo } from "@/components/fin-logo";

type Workspace = { id: string; name: string; role: string };

type MobileNavigationProps = {
  currentId?: string;
  workspaces: Workspace[];
  pendingJoinCount: number;
  isAdmin: boolean;
  username: string;
  role: "admin" | "member" | "none";
};

export function MobileNavigation(props: MobileNavigationProps) {
  const pathname = usePathname();
  return <MobileNavigationDrawer key={pathname} {...props} />;
}

function MobileNavigationDrawer({
  currentId,
  workspaces,
  pendingJoinCount,
  isAdmin,
  username,
  role,
}: MobileNavigationProps) {
  const [open, setOpen] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="icon"
              size="icon"
              type="button"
              className="md:hidden"
              aria-label="Mở menu điều hướng"
            />
          }
        >
          <Menu size={18} strokeWidth={1.9} />
        </SheetTrigger>
        <SheetContent
          side="left"
          className="flex flex-col gap-0 bg-[var(--surface)] p-0"
        >
          <SheetHeader className="border-b border-[var(--border)] px-4 py-3.5">
            <div className="flex items-center gap-3 pr-8">
              <FinLogo size={34} />
              <div className="min-w-0">
                <SheetTitle className="break-words text-base font-bold leading-snug text-[var(--foreground)]">
                  Felix
                </SheetTitle>
                <SheetDescription className="break-words text-xs leading-snug text-[var(--text-muted)]">
                  Không gian tài chính của bạn
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
            <DashboardNavigation
              currentId={currentId}
              workspaces={workspaces}
              pendingJoinCount={pendingJoinCount}
              isAdmin={isAdmin}
              username={username}
              forceExpandedWorkspaceSwitcher
              variant="all"
            />
          </div>

          <div className="border-t border-[var(--border)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <SidebarUserMenu
              username={username}
              role={role}
              forceExpanded
              onOpenAccountSettings={() => {
                setOpen(false);
                setAccountSettingsOpen(true);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <AccountSettingsModal
        open={accountSettingsOpen}
        onClose={() => setAccountSettingsOpen(false)}
        username={username}
      />
    </>
  );
}
