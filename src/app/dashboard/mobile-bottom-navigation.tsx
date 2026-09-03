"use client";

import {
  BookOpen,
  CalendarRange,
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
    <nav className="mobile-bottom-navigation" aria-label="Điều hướng nhanh">
      <div className="mobile-bottom-navigation-inner">
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
                "mobile-bottom-navigation-item",
                isVisuallyActive && "is-active",
              )}
            >
              <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {currentWorkspaceId && (
          <button
            type="button"
            className="mobile-bottom-navigation-fab"
            onClick={handleFabClick}
            aria-label="Nhập nhanh giao dịch"
          >
            <span className="mobile-bottom-navigation-fab-icon">
              <Plus size={22} strokeWidth={2.4} aria-hidden="true" />
            </span>
          </button>
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
                "mobile-bottom-navigation-item",
                isVisuallyActive && "is-active",
              )}
            >
              <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
