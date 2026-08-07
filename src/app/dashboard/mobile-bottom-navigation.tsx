"use client";

import {
  BookOpen,
  LayoutDashboard,
  Plus,
  Settings,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
  const left: MobileNavigationItem[] = [
    {
      href: "/overview",
      label: "Tổng quan",
      icon: LayoutDashboard,
      active: (pathname: string): boolean => pathname === "/overview",
    },
  ];

  if (currentWorkspaceId) {
    left.push({
      href: `/workspace/${currentWorkspaceId}`,
      label: "Giao dịch",
      icon: BookOpen,
      active: (pathname: string): boolean =>
        pathname === "/dashboard" || pathname.startsWith("/workspace/"),
    });
  }

  const right: MobileNavigationItem[] = [];

  if (currentWorkspaceId) {
    right.push({
      href: "/wallets",
      label: "Ví",
      icon: WalletCards,
      active: (pathname: string): boolean => pathname === "/wallets",
    });
  }

  right.push({
    href: "/settings/workspace",
    label: "Cài đặt",
    icon: Settings,
    active: (pathname: string): boolean =>
      pathname.startsWith("/settings/") || pathname === "/setting",
  });

  return { left, right };
}

export function MobileBottomNavigation({
  currentWorkspaceId,
}: {
  currentWorkspaceId?: string;
}) {
  const pathname = usePathname();
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

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "mobile-bottom-navigation-item",
                isActive && "is-active",
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

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "mobile-bottom-navigation-item",
                isActive && "is-active",
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
