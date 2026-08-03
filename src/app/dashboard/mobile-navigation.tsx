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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="unstyled" size="auto"
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
        showCloseButton
      >
        <SheetHeader className="mobile-navigation-header">
          <div className="mobile-navigation-brand">
            <FinLogo size={30} />
            <div>
              <SheetTitle>Felice</SheetTitle>
              <SheetDescription>Điều hướng và chọn workspace</SheetDescription>
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
        </div>

        <div className="mobile-navigation-user">
          <SidebarUserMenu username={username} role={role} forceExpanded />
        </div>
      </SheetContent>
    </Sheet>
  );
}
