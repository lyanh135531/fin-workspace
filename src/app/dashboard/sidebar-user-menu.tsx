"use client";

import { Button } from "@/components/base";
import { signOut } from "next-auth/react";
import { LogOut, ChevronUp, User } from "lucide-react";
import { useState, useTransition } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AccountSettingsModal } from "@/app/dashboard/account-settings-modal";
import { useOptionalSidebar } from "@/components/ui/sidebar";

function initials(username: string): string {
  const parts = username.trim().split(/[\s_\-\.]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

type Props = {
  username: string;
  role: "admin" | "member" | "none";
  forceExpanded?: boolean;
};

export function SidebarUserMenu({ username, role, forceExpanded = false }: Props) {
  const [pending, start] = useTransition();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const sidebar = useOptionalSidebar();
  const collapsed = sidebar?.state === "collapsed" && !forceExpanded;

  const roleLabel =
    role === "admin" ? "Admin" : role === "member" ? "Member" : "Chưa có ws";
  const roleClass = role === "admin" ? "role-admin" : "role-member";
  const avatarText = initials(username);

  function handleSignOut() {
    start(async () => {
      await signOut({ callbackUrl: "/sign-in", redirect: false });
      window.location.assign("/sign-in");
    });
  }

  const LogoutButton = (
    <Button variant="unstyled" size="auto"
      type="button"
      className="sidebar-logout-popover-btn"
      onClick={handleSignOut}
      disabled={pending}
      id="sidebar-logout-btn"
      aria-label="Đăng xuất khỏi hệ thống"
    >
      <LogOut size={14} strokeWidth={2} />
      {pending ? "Đang đăng xuất…" : "Đăng xuất"}
    </Button>
  );

  const OpenAccountSettingsBtn = (
    <Button variant="unstyled" size="auto"
      type="button"
      className="sidebar-user-popover-link"
      onClick={() => {
        setPopoverOpen(false);
        setAccountModalOpen(true);
      }}
    >
      <User size={14} strokeWidth={2} />
      <span>Cài đặt tài khoản</span>
    </Button>
  );

  return (
    <div className="sidebar-user-section group-data-[collapsible=icon]:m-0! group-data-[collapsible=icon]:p-0!" aria-label="Tài khoản người dùng">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger
          render={
            <Button variant="unstyled" size="auto"
              type="button"
              className="sidebar-user-row sidebar-user-card transition-[width,height,padding,gap] duration-300 ease-in-out group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:min-h-8! group-data-[collapsible=icon]:gap-0! group-data-[collapsible=icon]:p-0!"
              aria-label={`Tài khoản: ${username}. Nhấn để xem tùy chọn.`}
              aria-expanded={popoverOpen}
            />
          }
        >
          <div className="sidebar-user-avatar-wrap">
            <div className="sidebar-user-avatar" aria-hidden>{avatarText}</div>
            <span className="sidebar-user-status-dot" aria-hidden />
          </div>

          <div className="sidebar-user-info max-w-48 overflow-hidden opacity-100 transition-[max-width,opacity] duration-200 ease-in-out group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0">
            <span className="sidebar-user-name" title={username}>{username}</span>
            <div className="flex items-center gap-2 mt-[2px]">
              {role !== "none" ? (
                <span className={`sidebar-user-role ${roleClass}`}>{roleLabel}</span>
              ) : (
                <span className="sidebar-user-subtext">Chưa tham gia WS</span>
              )}
            </div>
          </div>

          <div className="sidebar-user-chevron-wrap shrink-0 opacity-100 transition-opacity duration-150 group-data-[collapsible=icon]:opacity-0">
            <ChevronUp
              size={13}
              strokeWidth={2.2}
              className={`sidebar-user-chevron ${popoverOpen ? "rotate-180" : ""}`}
            />
          </div>
        </PopoverTrigger>

        <PopoverContent
          side={collapsed ? "right" : "top"}
          align={collapsed ? "end" : "start"}
          sideOffset={collapsed ? 10 : 8}
          className="sidebar-flyout-popover sidebar-user-popover-content"
        >
          <div className="sidebar-flyout-user-header">
            <div className="sidebar-user-avatar-wrap">
              <div className="sidebar-user-avatar sidebar-avatar-lg" aria-hidden>
                {avatarText}
              </div>
              <span className="sidebar-user-status-dot" aria-hidden />
            </div>
            <div className="sidebar-user-flyout-meta">
              <p className="sidebar-flyout-username">{username}</p>
              <span className={`sidebar-user-role ${roleClass}`}>{roleLabel}</span>
            </div>
          </div>
          <div className="sidebar-flyout-divider" />
          {OpenAccountSettingsBtn}
          {LogoutButton}
        </PopoverContent>
      </Popover>

      <AccountSettingsModal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        username={username}
      />
    </div>
  );
}

