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
import { MobileAppearanceControls } from "@/app/dashboard/appearance-controls";

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
              variant="unstyled"
              size="auto"
              type="button"
              className="mobile-navigation-trigger"
              aria-label="Mở điều hướng"
            />
          }
        >
          <Menu size={20} strokeWidth={1.9} />
        </SheetTrigger>
        <SheetContent
          side="left"
          className="mobile-navigation-sheet"
        >
          <SheetHeader className="mobile-navigation-header">
            <div className="mobile-navigation-brand">
              <FinLogo size={40} />
              <div>
                <SheetTitle>Felix</SheetTitle>
                <SheetDescription>
                  Không gian tài chính của bạn
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="mobile-navigation-body">
            <DashboardNavigation
              currentId={currentId}
              workspaces={workspaces}
              pendingJoinCount={pendingJoinCount}
              isAdmin={isAdmin}
              username={username}
              forceExpandedWorkspaceSwitcher
            />
            <MobileAppearanceControls />
          </div>

          <div className="mobile-navigation-user">
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
