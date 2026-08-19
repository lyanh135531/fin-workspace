"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";

import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/base";
import { FinLogo } from "@/components/fin-logo";
import { PortalSidebarNav } from "./portal-sidebar-nav";

type PortalMobileHeaderProps = {
  username: string;
};

export function PortalMobileHeader({ username }: PortalMobileHeaderProps) {
  const pathname = usePathname();
  return <PortalMobileHeaderInner key={pathname} username={username} />;
}

function PortalMobileHeaderInner({ username }: PortalMobileHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-10 flex min-h-14 items-center gap-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_92%,transparent)] px-4 backdrop-blur-md min-[640px]:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="unstyled"
              size="auto"
              type="button"
              className="grid size-9 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:text-[var(--foreground)]"
              aria-label="Mở điều hướng portal"
            />
          }
        >
          <Menu size={20} strokeWidth={1.9} />
        </SheetTrigger>
        <SheetContent
          side="left"
          className="flex w-[17rem] flex-col gap-0 bg-[var(--surface-secondary)] p-0"
        >
          <SheetHeader className="border-b border-[var(--border)] px-5 py-4">
            <div className="flex items-center gap-3">
              <FinLogo size={36} />
              <div>
                <SheetTitle className="text-base">Felix Portal</SheetTitle>
                <SheetDescription className="text-xs">
                  Quản trị hệ thống
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-auto px-2 py-3">
            <PortalSidebarNav />
          </div>

          <div className="border-t border-[var(--border)] px-5 py-3">
            <p className="truncate text-sm font-semibold text-[var(--foreground)]">
              {username}
            </p>
            <p className="text-xs text-[var(--text-muted)]">Portal Admin</p>
          </div>
        </SheetContent>
      </Sheet>

      <Link
        href="/portal"
        className="flex items-center gap-2 text-[var(--foreground)]"
        aria-label="Felix Portal"
      >
        <FinLogo size={28} />
        <span className="text-sm font-semibold">Portal</span>
      </Link>
    </header>
  );
}
