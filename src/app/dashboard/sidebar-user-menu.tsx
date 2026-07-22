"use client";

import { signOut } from "next-auth/react";
import { LogOut, ChevronUp } from "lucide-react";
import { useState, useTransition, useSyncExternalStore } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function initials(username: string): string {
  const parts = username.trim().split(/[\s_\-\.]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

function useSidebarCollapsed() {
  return useSyncExternalStore(
    (cb) => {
      const obs = new MutationObserver(cb);
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-sidebar-collapsed"] });
      return () => obs.disconnect();
    },
    () => document.documentElement.dataset.sidebarCollapsed === "true",
    () => false,
  );
}

type Props = { username: string; role: "admin" | "member" | "none" };

export function SidebarUserMenu({ username, role }: Props) {
  const [pending, start] = useTransition();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const collapsed = useSidebarCollapsed();

  const roleLabel =
    role === "admin" ? "Admin" : role === "member" ? "Member" : "Chưa có ws";
  const roleClass = role === "admin" ? "" : "role-member";
  const avatarText = initials(username);

  function handleSignOut() {
    start(async () => {
      await signOut({ callbackUrl: "/sign-in" });
    });
  }

  const LogoutButton = (
    <button
      type="button"
      className="sidebar-logout-popover-btn"
      onClick={handleSignOut}
      disabled={pending}
      id="sidebar-logout-btn"
      aria-label="Đăng xuất khỏi hệ thống"
    >
      <LogOut size={14} strokeWidth={2} />
      {pending ? "Đang đăng xuất…" : "Đăng xuất"}
    </button>
  );

  /* ── Collapsed: avatar icon → right flyout popover ── */
  if (collapsed) {
    return (
      <div className="sidebar-user-section">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger
            render={
              <button
                type="button"
                className="sidebar-user-row"
                aria-label={`Tài khoản: ${username}. Nhấn để xem tùy chọn.`}
              />
            }
          >
            <div className="sidebar-user-avatar" aria-hidden>
              {avatarText}
            </div>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="end"
            sideOffset={8}
            className="sidebar-flyout-popover"
            style={{ minWidth: "13rem" }}
          >
            <div className="sidebar-flyout-user-header">
              <div className="sidebar-user-avatar" style={{ width: "2.2rem", height: "2.2rem", fontSize: ".8rem" }} aria-hidden>
                {avatarText}
              </div>
              <div>
                <p className="sidebar-flyout-username">{username}</p>
                <span className={`sidebar-user-role ${roleClass}`}>{roleLabel}</span>
              </div>
            </div>
            <div className="sidebar-flyout-divider" />
            {LogoutButton}
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  /* ── Expanded: inline section with popover menu ── */
  return (
    <div className="sidebar-user-section" aria-label="Tài khoản người dùng">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="sidebar-user-row"
              aria-label={`Tài khoản: ${username}. Nhấn để xem tùy chọn.`}
              aria-expanded={popoverOpen}
            />
          }
        >
          <div className="sidebar-user-avatar" aria-hidden>{avatarText}</div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name" title={username}>{username}</span>
            <span className={`sidebar-user-role ${roleClass}`}>{roleLabel}</span>
          </div>
          <ChevronUp
            size={13}
            strokeWidth={2}
            style={{
              flex: "0 0 auto",
              color: "var(--text-muted)",
              transform: popoverOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 200ms ease",
            }}
          />
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={6}
          className="sidebar-flyout-popover"
          style={{ minWidth: "13rem" }}
        >
          <div className="sidebar-flyout-user-header">
            <div className="sidebar-user-avatar" style={{ width: "2.2rem", height: "2.2rem", fontSize: ".8rem" }} aria-hidden>
              {avatarText}
            </div>
            <div>
              <p className="sidebar-flyout-username">{username}</p>
              <span className={`sidebar-user-role ${roleClass}`}>{roleLabel}</span>
            </div>
          </div>
          <div className="sidebar-flyout-divider" />
          {LogoutButton}
        </PopoverContent>
      </Popover>
    </div>
  );
}
