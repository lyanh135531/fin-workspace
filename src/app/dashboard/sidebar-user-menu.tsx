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
import { cleanupBrowserPushBeforeLogout } from "@/app/dashboard/daily-reminder-controls";
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
    role === "admin"
      ? "Quản trị viên"
      : role === "member"
        ? "Thành viên"
        : "Chưa chọn nhóm";
  const avatarText = initials(username);

  function handleSignOut() {
    start(async () => {
      await cleanupBrowserPushBeforeLogout();
      await signOut({ callbackUrl: "/sign-in" });
    });
  }

  const LogoutButton = (
    <Button
      variant="unstyled"
      size="auto"
      type="button"
      className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[var(--danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface))] disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--danger)_12%,var(--surface))] text-[var(--danger)] transition-colors">
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
      className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
      onClick={() => {
        setPopoverOpen(false);
        if (onOpenAccountSettings) onOpenAccountSettings();
        else setAccountModalOpen(true);
      }}
    >
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-[var(--text-secondary)] transition-colors group-hover:bg-[color-mix(in_srgb,var(--primary)_14%,var(--surface))] group-hover:text-[var(--primary)]">
        <UserRound size={14} strokeWidth={2} />
      </div>
      <span className="flex-1 font-medium">Thông tin tài khoản</span>
      <ChevronRight
        size={14}
        className="text-[var(--text-muted)] opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100"
      />
    </Button>
  );

  const InstallPwaButton = showAccountAction ? (
    <Button
      variant="unstyled"
      size="auto"
      type="button"
      className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
      onClick={() => {
        setPopoverOpen(false);
        void requestInstall();
      }}
    >
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-[var(--text-secondary)] transition-colors group-hover:bg-[color-mix(in_srgb,var(--primary)_14%,var(--surface))] group-hover:text-[var(--primary)]">
        <Download size={14} strokeWidth={2} aria-hidden="true" />
      </div>
      <span className="flex-1 font-medium">Cài đặt ứng dụng</span>
      <span className="rounded border border-[var(--border)] bg-[var(--surface-secondary)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
        PWA
      </span>
    </Button>
  ) : null;

  const LegalDocumentLinks = (
    <>
      <Link
        href={`/privacy?callbackUrl=${encodeURIComponent(pathname)}`}
        className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
        onClick={() => setPopoverOpen(false)}
      >
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-[var(--text-secondary)] transition-colors group-hover:text-[var(--foreground)]">
          <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" />
        </div>
        <span className="flex-1 font-medium">Chính sách bảo mật</span>
      </Link>
      <Link
        href={`/terms?callbackUrl=${encodeURIComponent(pathname)}`}
        className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
        onClick={() => setPopoverOpen(false)}
      >
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-[var(--text-secondary)] transition-colors group-hover:text-[var(--foreground)]">
          <FileText size={14} strokeWidth={2} aria-hidden="true" />
        </div>
        <span className="flex-1 font-medium">Điều khoản sử dụng</span>
      </Link>
    </>
  );

  return (
    <div
      className="w-full border-0 p-0"
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
              className="flex h-12 w-full min-w-0 items-center justify-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors duration-150 hover:bg-[var(--surface-hover)] group-data-[collapsible=icon]:mx-auto! group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:min-h-10! group-data-[collapsible=icon]:justify-center! group-data-[collapsible=icon]:gap-0! group-data-[collapsible=icon]:p-0!"
              aria-label={`Tài khoản: ${username}. Nhấn để xem tùy chọn.`}
              aria-expanded={popoverOpen}
            />
          }
          dismissLabel="Đóng menu tài khoản"
        >
          {(spotlightTrigger) => (
            <PopoverTrigger render={spotlightTrigger}>
              <div className="relative shrink-0">
                <div
                  className="grid size-8 place-items-center rounded-lg bg-[var(--surface-secondary)] text-xs font-bold text-[var(--foreground)] border border-[var(--border)]"
                  aria-hidden
                >
                  {avatarText}
                </div>
                <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-[var(--surface)] bg-[var(--success)]" aria-hidden />
              </div>

              <div className="flex min-w-0 flex-1 flex-col items-start group-data-[collapsible=icon]:hidden!">
                <span
                  className="max-w-full break-words text-sm font-semibold leading-snug text-[var(--foreground)]"
                  title={username}
                >
                  {username}
                </span>
                <span className="block break-words text-xs leading-snug text-[var(--text-muted)]">
                  {roleLabel}
                </span>
              </div>

              <div className="shrink-0 text-[var(--text-muted)] group-data-[collapsible=icon]:hidden!">
                <ChevronUp
                  size={14}
                  strokeWidth={2}
                  className={`transition-transform ${popoverOpen ? "rotate-180" : ""}`}
                />
              </div>
            </PopoverTrigger>
          )}
        </SpotlightTrigger>

        <PopoverContent
          side={collapsed ? "right" : "top"}
          align={collapsed ? "end" : "start"}
          sideOffset={8}
          elevation="flat"
          className="flex w-60 flex-col gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 text-[var(--foreground)] ring-0"
        >
          <div className="flex flex-col gap-0.5">
            {OpenAccountSettingsBtn}
            {InstallPwaButton}
          </div>

          <div className="my-1 h-px bg-[var(--border)]" />

          <div className="flex flex-col gap-0.5">{LegalDocumentLinks}</div>

          <div className="my-1 h-px bg-[var(--border)]" />

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
