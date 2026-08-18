import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, UsersRound } from "lucide-react";

import { ThemeToggle } from "@/app/theme-toggle";
import { Button, PageContainer } from "@/components/base";
import { FinLogo } from "@/components/fin-logo";
import { requirePlatformAdminSession } from "@/services/platform-access";

export const metadata: Metadata = {
  title: "Portal người dùng",
  robots: { index: false, follow: false },
};

export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await requirePlatformAdminSession();

  return (
    <div className="min-h-dvh bg-[var(--surface-secondary)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <PageContainer className="px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 items-center gap-4">
            <Link
              href="/portal/users"
              className="flex min-w-0 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              aria-label="Felix Portal"
            >
              <FinLogo size={32} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-none">Felix Portal</span>
                <span className="mt-1 block text-xs text-[var(--text-muted)]">Chỉ đọc dữ liệu tài khoản</span>
              </span>
            </Link>

            <nav className="ml-auto flex items-center gap-1" aria-label="Điều hướng portal">
              <Button
                variant="info"
                render={<Link href="/portal/users" aria-current="page" />}
              >
                <UsersRound aria-hidden />
                <span className="hidden sm:inline">Người dùng</span>
              </Button>
              <Button variant="ghost" render={<Link href="/overview" />}>
                <span className="hidden lg:inline">Về ứng dụng</span>
                <ArrowUpRight aria-hidden />
              </Button>
              <ThemeToggle />
            </nav>
          </div>
        </PageContainer>
      </header>

      <main id="main-content">
        <PageContainer className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mb-5 flex items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
            <span>Đăng nhập với quyền portal</span>
            <span className="max-w-48 truncate" title={admin.username}>
              {admin.username}
            </span>
          </div>
          {children}
        </PageContainer>
      </main>
    </div>
  );
}
