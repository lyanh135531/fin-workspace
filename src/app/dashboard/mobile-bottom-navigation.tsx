"use client";

import {
  BookOpen,
  CalendarRange,
  CreditCard,
  LayoutDashboard,
  Plus,
  Repeat2,
  Settings,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useOptimisticNavigation } from "@/app/dashboard/use-optimistic-navigation";
import {
  isWorkspaceNavigationActive,
  workspaceNavigationItems,
  type WorkspaceNavigationKey,
} from "@/app/dashboard/workspace-navigation";
import { cn } from "@/lib/utils";

type MobileNavigationItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: (pathname: string) => boolean;
};

function navigationItems(currentWorkspaceId?: string): {
  left: MobileNavigationItem[];
  right: MobileNavigationItem[];
} {
  const icons: Record<WorkspaceNavigationKey, typeof LayoutDashboard> = {
    overview: LayoutDashboard,
    ledger: BookOpen,
    recurring: Repeat2,
    plans: CalendarRange,
    wallets: WalletCards,
    creditCards: CreditCard,
    settings: Settings,
  };
  const primary = workspaceNavigationItems(currentWorkspaceId)
    .filter((item) => item.mobilePrimary && (!item.requiresWorkspace || Boolean(currentWorkspaceId)))
    .map((item) => ({
      href: item.href,
      label: item.key === "ledger" ? "Giao dịch" : item.label,
      icon: icons[item.key],
      active: (pathname: string) => isWorkspaceNavigationActive(item.key, pathname),
    }));
  return { left: primary.slice(0, 2), right: primary.slice(2) };
}

export function MobileBottomNavigation({
  currentWorkspaceId,
}: {
  currentWorkspaceId?: string;
}) {
  const pathname = usePathname();
  const { pendingHref, beginNavigation } = useOptimisticNavigation();
  const { left, right } = navigationItems(currentWorkspaceId);

  function handleFabClick() {
    window.dispatchEvent(new CustomEvent("open-quick-transaction"));
  }

  return (
    <nav
      className="mobile-bottom-navigation fixed inset-x-0 bottom-0 z-40 flex h-16 items-center border-t border-[var(--border)] bg-[var(--surface)]/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      aria-label="Điều hướng nhanh"
    >
      <div className="mobile-bottom-navigation-inner mx-auto grid w-full max-w-md grid-cols-5 items-center gap-1">
        {left.map((item) => {
          const Icon = item.icon;
          const isActive = item.active(pathname);
          const isPending = pendingHref === item.href;
          const isVisuallyActive = pendingHref ? isPending : isActive;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              aria-busy={isPending || undefined}
              onNavigate={(event) => {
                event.preventDefault();
                beginNavigation(item.href);
              }}
              className={cn(
                "mobile-bottom-navigation-item flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[0.68rem] font-medium transition-colors",
                isVisuallyActive
                  ? "is-active font-semibold text-[var(--primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--foreground)]",
              )}
            >
              <Icon size={19} strokeWidth={isVisuallyActive ? 2.1 : 1.8} aria-hidden="true" />
              <span className="max-w-full px-0.5 text-center leading-tight">{item.label}</span>
            </Link>
          );
        })}

        {currentWorkspaceId ? (
          <div className="flex items-center justify-center">
            <button
              type="button"
              className="mobile-bottom-navigation-fab flex size-11 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--text-on-primary)] transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              onClick={handleFabClick}
              aria-label="Nhập nhanh giao dịch"
            >
              <span className="mobile-bottom-navigation-fab-icon flex items-center justify-center">
                <Plus size={22} strokeWidth={2.4} aria-hidden="true" />
              </span>
            </button>
          </div>
        ) : (
          <div aria-hidden="true" />
        )}

        {right.map((item) => {
          const Icon = item.icon;
          const isActive = item.active(pathname);
          const isPending = pendingHref === item.href;
          const isVisuallyActive = pendingHref ? isPending : isActive;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              aria-busy={isPending || undefined}
              onNavigate={(event) => {
                event.preventDefault();
                beginNavigation(item.href);
              }}
              className={cn(
                "mobile-bottom-navigation-item flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[0.68rem] font-medium transition-colors",
                isVisuallyActive
                  ? "is-active font-semibold text-[var(--primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--foreground)]",
              )}
            >
              <Icon size={19} strokeWidth={isVisuallyActive ? 2.1 : 1.8} aria-hidden="true" />
              <span className="max-w-full px-0.5 text-center leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
