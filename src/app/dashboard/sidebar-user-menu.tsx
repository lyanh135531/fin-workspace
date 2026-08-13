"use client";

import { Button, Loading } from "@/components/base";
import { signOut } from "next-auth/react";
import { LogOut, ChevronUp, KeyRound } from "lucide-react";
import { useState, useTransition } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SpotlightTrigger } from "@/components/ui/spotlight-trigger";
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
  onOpenAccountSettings?: () => void;
};

export function SidebarUserMenu({
  username,
  role,
  forceExpanded = false,
  onOpenAccountSettings,
}: Props) {
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
      await signOut({ callbackUrl: "/sign-in" });
    });
  }

  const LogoutButton = (
    <Button
      variant="unstyled"
      size="auto"
      type="button"
      className="sidebar-logout-popover-btn rounded-lg"
      onClick={handleSignOut}
      disabled={pending}
      id="sidebar-logout-btn"
      aria-label="Đăng xuất khỏi hệ thống"
    >
      {pending ? (
        <Loading label="Đang đăng xuất..." />
      ) : (
        <>
          <LogOut size={14} strokeWidth={2} />
          Đăng xuất
        </>
      )}
    </Button>
  );

  const OpenAccountSettingsBtn = (
    <Button
      variant="unstyled"
      size="auto"
      type="button"
      className="sidebar-user-popover-link rounded-lg"
      onClick={() => {
        setPopoverOpen(false);
        if (onOpenAccountSettings) onOpenAccountSettings();
        else setAccountModalOpen(true);
      }}
    >
      <KeyRound size={14} strokeWidth={2} />
      <span>Đổi mật khẩu</span>
    </Button>
  );

  return (
    <div
      className="sidebar-user-section min-[901px]:w-full min-[901px]:border-0! min-[901px]:p-0! group-data-[collapsible=icon]:m-0! group-data-[collapsible=icon]:p-0!"
      aria-label="Tài khoản người dùng"
    >
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <SpotlightTrigger
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
          mobileOnly
          render={
            <Button
              variant="unstyled"
              size="auto"
              type="button"
              className="sidebar-user-row sidebar-user-card rounded-2xl transition-[width,height,padding,gap,background-color] duration-300 ease-in-out min-[901px]:h-[3.25rem]! min-[901px]:w-full! min-[901px]:justify-start! min-[901px]:gap-3! min-[901px]:rounded-xl! min-[901px]:border-0! min-[901px]:bg-transparent! min-[901px]:px-2.5! min-[901px]:py-2! min-[901px]:shadow-none! min-[901px]:hover:bg-[var(--surface-hover)]! min-[901px]:hover:shadow-none! group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:min-h-8! group-data-[collapsible=icon]:gap-0! group-data-[collapsible=icon]:p-0! min-[901px]:group-data-[collapsible=icon]:mx-auto! min-[901px]:group-data-[collapsible=icon]:size-10! min-[901px]:group-data-[collapsible=icon]:min-h-10! min-[901px]:group-data-[collapsible=icon]:justify-center! min-[901px]:group-data-[collapsible=icon]:bg-transparent!"
              data-sidebar-profile-state={collapsed ? "collapsed" : "expanded"}
              aria-label={`Tài khoản: ${username}. Nhấn để xem tùy chọn.`}
              aria-expanded={popoverOpen}
            />
          }
          dismissLabel="Đóng menu tài khoản"
        >
          {(spotlightTrigger) => (
            <PopoverTrigger render={spotlightTrigger}>
              <div className="sidebar-user-avatar-wrap min-[901px]:shrink-0">
                <div
                  className="sidebar-user-avatar rounded-lg min-[901px]:grid! min-[901px]:size-8! min-[901px]:place-items-center!"
                  aria-hidden
                >
                  {avatarText}
                </div>
                <span className="sidebar-user-status-dot" aria-hidden />
              </div>

              <div className="sidebar-user-info max-w-48 overflow-hidden opacity-100 transition-[max-width,opacity] duration-200 ease-in-out min-[901px]:flex! min-[901px]:min-w-0 min-[901px]:flex-1 min-[901px]:flex-col min-[901px]:items-start group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0 min-[901px]:group-data-[collapsible=icon]:hidden!">
                <span
                  className="sidebar-user-name min-[901px]:max-w-full min-[901px]:truncate min-[901px]:font-semibold"
                  title={username}
                >
                  {username}
                </span>
                <span className="sidebar-user-role-inline min-[901px]:block! min-[901px]:text-[0.68rem] min-[901px]:text-[var(--text-muted)]">
                  {roleLabel}
                </span>
              </div>

              <div className="sidebar-user-chevron-wrap shrink-0 opacity-100 transition-opacity duration-150 group-data-[collapsible=icon]:opacity-0 min-[901px]:group-data-[collapsible=icon]:hidden!">
                <ChevronUp
                  size={13}
                  strokeWidth={2.2}
                  className={`sidebar-user-chevron ${popoverOpen ? "rotate-180" : ""}`}
                />
              </div>
            </PopoverTrigger>
          )}
        </SpotlightTrigger>

        <PopoverContent
          side={collapsed ? "right" : "top"}
          align={collapsed ? "end" : "start"}
          sideOffset={collapsed ? 10 : 8}
          className="sidebar-flyout-popover sidebar-user-popover-content"
        >
          <div className="sidebar-flyout-user-header">
            <div className="sidebar-user-avatar-wrap">
              <div
                className="sidebar-user-avatar sidebar-avatar-lg rounded-lg"
                aria-hidden
              >
                {avatarText}
              </div>
              <span className="sidebar-user-status-dot" aria-hidden />
            </div>
            <div className="sidebar-user-flyout-meta">
              <p className="sidebar-flyout-username">{username}</p>
              <span className={`sidebar-user-role ${roleClass}`}>
                {roleLabel}
              </span>
            </div>
          </div>
          <div className="sidebar-flyout-divider" />
          {OpenAccountSettingsBtn}
          {LogoutButton}
        </PopoverContent>
      </Popover>

      {!onOpenAccountSettings && (
        <AccountSettingsModal
          open={accountModalOpen}
          onClose={() => setAccountModalOpen(false)}
          username={username}
        />
      )}
    </div>
  );
}
