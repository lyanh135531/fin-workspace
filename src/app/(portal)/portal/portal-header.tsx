"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronRight, Menu } from "lucide-react";

import { ThemeToggle } from "@/app/theme-toggle";
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

type PortalHeaderProps = {
  username: string;
};

const routeTitles: Record<string, string> = {
  "/portal": "Tổng quan",
  "/portal/users": "Người dùng",
  "/portal/activity": "Nhật ký hoạt động",
};

function getBreadcrumb(pathname: string) {
  if (routeTitles[pathname]) {
    return [{ label: "Portal", href: "/portal" }, { label: routeTitles[pathname] }];
  }
  if (pathname.startsWith("/portal/users/")) {
    return [
      { label: "Portal", href: "/portal" },
      { label: "Người dùng", href: "/portal/users" },
      { label: "Hồ sơ" },
    ];
  }
  return [{ label: "Portal", href: "/portal" }];
}

export function PortalHeader({ username }: PortalHeaderProps) {
  const pathname = usePathname();
  return <PortalHeaderInner key={pathname} username={username} pathname={pathname} />;
}

function PortalHeaderInner({
  username,
  pathname,
}: PortalHeaderProps & { pathname: string }) {
  const [open, setOpen] = useState(false);
  const breadcrumbItems = getBreadcrumb(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 sm:px-6">
      {/* Left section: Breadcrumbs (Desktop) / Mobile Drawer */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Drawer */}
        <div className="min-[640px]:hidden">
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
        </div>

        {/* Mobile Logo link */}
        <Link
          href="/portal"
          className="flex items-center gap-2 text-[var(--foreground)] min-[640px]:hidden"
          aria-label="Felix Portal"
        >
          <FinLogo size={28} />
          <span className="text-sm font-semibold">Portal</span>
        </Link>

        {/* Desktop Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 text-xs min-[640px]:flex">
          {breadcrumbItems.map((item, idx) => {
            const isLast = idx === breadcrumbItems.length - 1;
            return (
              <div key={idx} className="flex items-center gap-1.5">
                {idx > 0 && (
                  <ChevronRight className="size-3 text-[var(--text-muted)]" aria-hidden />
                )}
                {isLast || !item.href ? (
                  <span className="font-semibold text-[var(--foreground)]">
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="text-[var(--text-secondary)] transition-colors hover:text-[var(--foreground)]"
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <ThemeToggle />
    </header>
  );
}
