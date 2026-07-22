"use client";

import { signOut } from "next-auth/react";
import { LogOut, ChevronUp, Settings, User } from "lucide-react";
import Link from "next/link";
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
  const roleClass = role === "admin" ? "role-admin" : "role-member";
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
                className="sidebar-user-row sidebar-user-card-collapsed"
                aria-label={`Tài khoản: ${username}. Nhấn để xem tùy chọn.`}
              />
            }
          >
            <div className="sidebar-user-avatar-wrap">
              <div className="sidebar-user-avatar" aria-hidden>
                {avatarText}
              </div>
              <span className="sidebar-user-status-dot" aria-hidden />
            </div>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="end"
            sideOffset={10}
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
            <Link
              href="/setting"
              className="sidebar-user-popover-link"
              onClick={() => setPopoverOpen(false)}
            >
              <Settings size={14} strokeWidth={2} />
              <span>Cài đặt tài khoản</span>
            </Link>
            {LogoutButton}
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  /* ── Expanded: modern profile card layout ── */
  return (
    <div className="sidebar-user-section" aria-label="Tài khoản người dùng">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="sidebar-user-row sidebar-user-card"
              aria-label={`Tài khoản: ${username}. Nhấn để xem tùy chọn.`}
              aria-expanded={popoverOpen}
            />
          }
        >
          <div className="sidebar-user-avatar-wrap">
            <div className="sidebar-user-avatar" aria-hidden>{avatarText}</div>
            <span className="sidebar-user-status-dot" aria-hidden />
          </div>

          <div className="sidebar-user-info">
            <div className="sidebar-user-name-row">
              <span className="sidebar-user-name" title={username}>{username}</span>
              <span className={`sidebar-user-role ${roleClass}`}>{roleLabel}</span>
            </div>
            <span className="sidebar-user-subtext">Đang hoạt động</span>
          </div>

          <div className="sidebar-user-chevron-wrap">
            <ChevronUp
              size={13}
              strokeWidth={2.2}
              className={`sidebar-user-chevron ${popoverOpen ? "rotate-180" : ""}`}
            />
          </div>
        </PopoverTrigger>

        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
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
          <Link
            href="/setting"
            className="sidebar-user-popover-link"
            onClick={() => setPopoverOpen(false)}
          >
            <Settings size={14} strokeWidth={2} />
            <span>Cài đặt tài khoản</span>
          </Link>
          {LogoutButton}
        </PopoverContent>
      </Popover>
    </div>
  );
}
