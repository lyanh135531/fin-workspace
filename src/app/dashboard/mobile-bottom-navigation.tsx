"use client";

import {
  BookOpen,
  LayoutDashboard,
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

function navigationItems(currentWorkspaceId?: string): MobileNavigationItem[] {
  const items: MobileNavigationItem[] = [
    {
      href: "/overview",
      label: "Tổng quan",
      icon: LayoutDashboard,
      active: (pathname: string): boolean => pathname === "/overview",
    },
  ];

  if (currentWorkspaceId) {
    items.push(
      {
        href: `/workspace/${currentWorkspaceId}`,
        label: "Sổ giao dịch",
        icon: BookOpen,
        active: (pathname: string): boolean =>
          pathname === "/dashboard" || pathname.startsWith("/workspace/"),
      },
      {
        href: "/wallets",
        label: "Ví",
        icon: WalletCards,
        active: (pathname: string): boolean => pathname === "/wallets",
      },
    );
  }

  items.push({
    href: "/setting",
    label: "Cài đặt",
    icon: Settings,
    active: (pathname: string): boolean =>
      pathname === "/setting" || pathname.startsWith("/settings/"),
  });

  return items;
}

export function MobileBottomNavigation({
  currentWorkspaceId,
}: {
  currentWorkspaceId?: string;
}) {
  const pathname = usePathname();
  const items = navigationItems(currentWorkspaceId);

  return (
    <nav className="mobile-bottom-navigation" aria-label="Điều hướng nhanh">
      <div className="mobile-bottom-navigation-inner">
        {items.map((item) => {
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
              <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
