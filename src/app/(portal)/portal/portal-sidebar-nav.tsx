"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutDashboard, UsersRound } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const portalLinks = [
  { href: "/portal", label: "Tổng quan", icon: LayoutDashboard, exact: true },
  { href: "/portal/users", label: "Người dùng", icon: UsersRound, exact: false },
  { href: "/portal/activity", label: "Nhật ký hoạt động", icon: Activity, exact: false },
] as const;

export function PortalSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex min-h-0 flex-1 flex-col" aria-label="Điều hướng portal">
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {portalLinks.map((link) => {
              const isActive = link.exact
                ? pathname === link.href
                : pathname.startsWith(link.href);

              return (
                <SidebarMenuItem key={link.href}>
                  <SidebarMenuButton
                    isActive={isActive}
                    render={<Link href={link.href} />}
                    aria-label={link.label}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <link.icon strokeWidth={1.8} />
                    <span>{link.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </nav>
  );
}
