"use client";

import { LoaderCircle, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTransition } from "react";

import { cleanupBrowserPushBeforeLogout } from "@/app/dashboard/daily-reminder-controls";
import { Button } from "@/components/base";
import { cn } from "@/lib/utils";

type PortalSignOutButtonProps = {
  collapsibleSidebar?: boolean;
  className?: string;
};

export function PortalSignOutButton({
  collapsibleSidebar = false,
  className,
}: PortalSignOutButtonProps) {
  const [pending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await cleanupBrowserPushBeforeLogout();
      await signOut({ callbackUrl: "/sign-in" });
    });
  }

  return (
    <Button
      variant="unstyled"
      size="auto"
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      title="Đăng xuất"
      aria-label="Đăng xuất khỏi hệ thống"
      className={cn(
        "flex w-full min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-[var(--danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50",
        collapsibleSidebar &&
          "group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0",
        className,
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--danger)_12%,var(--surface))] text-[var(--danger)]">
        {pending ? (
          <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
        ) : (
          <LogOut size={14} strokeWidth={2} aria-hidden="true" />
        )}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 break-words font-medium leading-snug",
          collapsibleSidebar &&
            "transition-[max-width,opacity] duration-200 group-data-[collapsible=icon]:hidden",
        )}
      >
        {pending ? "Đang đăng xuất..." : "Đăng xuất"}
      </span>
    </Button>
  );
}
