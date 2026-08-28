"use client";

import { Button, Loading } from "@/components/base";
import { signOut } from "next-auth/react";
import {
  ChevronRight,
  ChevronUp,
  Download,
  FileText,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SpotlightTrigger } from "@/components/ui/spotlight-trigger";
import { AccountSettingsModal } from "@/app/dashboard/account-settings-modal";
import { useOptionalSidebar } from "@/components/ui/sidebar";
import { usePwaInstall } from "@/app/pwa-install";

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
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const sidebar = useOptionalSidebar();
  const { requestInstall, showAccountAction } = usePwaInstall();
  const collapsed = sidebar?.state === "collapsed" && !forceExpanded;

  const roleLabel =
    role === "admin" ? "Admin" : role === "member" ? "Member" : "Chưa có ws";
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
      className="group flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20 transition-colors cursor-pointer text-left disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={handleSignOut}
      disabled={pending}
      id="sidebar-logout-btn"
      aria-label="Đăng xuất khỏi hệ thống"
    >
      {pending ? (
        <div className="py-0.5">
          <Loading label="Đang đăng xuất..." />
        </div>
      ) : (
        <>
          <div className="flex size-7 items-center justify-center rounded-lg bg-destructive/10 text-destructive group-hover:bg-destructive/20 transition-colors shrink-0">
            <LogOut size={14} strokeWidth={2} />
          </div>
          <span className="flex-1 font-medium">Đăng xuất</span>
        </>
      )}
    </Button>
  );

  const OpenAccountSettingsBtn = (
    <Button
      variant="unstyled"
      size="auto"
      type="button"
      className="group flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-left"
      onClick={() => {
        setPopoverOpen(false);
        if (onOpenAccountSettings) onOpenAccountSettings();
        else setAccountModalOpen(true);
      }}
    >
      <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-[var(--text-secondary)] group-hover:bg-[var(--primary)]/15 group-hover:text-[var(--primary)] transition-colors shrink-0">
        <UserRound size={14} strokeWidth={2} />
      </div>
      <span className="flex-1 font-medium">Thông tin tài khoản</span>
      <ChevronRight
        size={14}
        className="text-[var(--text-muted)] opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
      />
    </Button>
  );

  const InstallPwaButton = showAccountAction ? (
    <Button
      variant="unstyled"
      size="auto"
      type="button"
      className="group flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-left"
      onClick={() => {
        setPopoverOpen(false);
        void requestInstall();
      }}
    >
      <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-[var(--text-secondary)] group-hover:bg-[var(--primary)]/15 group-hover:text-[var(--primary)] transition-colors shrink-0">
        <Download size={14} strokeWidth={2} aria-hidden="true" />
      </div>
      <span className="flex-1 font-medium">Cài đặt Felix</span>
      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--surface-secondary)] text-[var(--text-muted)] border border-[var(--border)]/60">
        PWA
      </span>
    </Button>
  ) : null;

  const LegalDocumentLinks = (
    <>
      <Link
        href={`/privacy?callbackUrl=${encodeURIComponent(pathname)}`}
        className="group flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
        onClick={() => setPopoverOpen(false)}
      >
        <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-[var(--text-secondary)] group-hover:bg-[var(--surface-hover)] group-hover:text-[var(--foreground)] transition-colors shrink-0">
          <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" />
        </div>
        <span className="flex-1 font-medium">Chính sách bảo mật</span>
      </Link>
      <Link
        href={`/terms?callbackUrl=${encodeURIComponent(pathname)}`}
        className="group flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
        onClick={() => setPopoverOpen(false)}
      >
        <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-[var(--text-secondary)] group-hover:bg-[var(--surface-hover)] group-hover:text-[var(--foreground)] transition-colors shrink-0">
          <FileText size={14} strokeWidth={2} aria-hidden="true" />
        </div>
        <span className="flex-1 font-medium">Điều khoản sử dụng</span>
      </Link>
    </>
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
          elevation="flat"
          className="w-60 p-1 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-none ring-0 flex flex-col gap-0.5 text-[var(--foreground)]"
        >
          {/* Account Actions */}
          <div className="flex flex-col gap-0.5">
            {OpenAccountSettingsBtn}
            {InstallPwaButton}
          </div>

          {/* Divider */}
          <div className="my-0.5 h-px bg-[var(--border)]" />

          {/* Legal / Policy Links */}
          <div className="flex flex-col gap-0.5">{LegalDocumentLinks}</div>

          {/* Divider */}
          <div className="my-0.5 h-px bg-[var(--border)]" />

          {/* Logout Action */}
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
