"use client";

import { usePathname } from "next/navigation";

export function DashboardHeaderSubtitle({ fallback }: { fallback: string }) {
  const pathname = usePathname();
  if (pathname === "/wallets" || pathname === "/dashboard/wallets") return <span>Danh sách và cấu hình ví</span>;
  return <span>{fallback}</span>;
}
