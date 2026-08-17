"use client";

import { usePathname } from "next/navigation";

const PAGE_LABELS: Record<string, string> = {
  "/overview": "Tổng quan",
  "/dashboard/overview": "Tổng quan",
  "/dashboard": "Sổ giao dịch",
  "/recurring-transactions": "Định kỳ",
  "/wallets": "Ví",
  "/dashboard/wallets": "Ví",
  "/setting": "Cài đặt chung",
  "/settings/account": "Tài khoản",
  "/account": "Tài khoản",
  "/settings/workspace": "Cài đặt",
  "/workspaces/create": "Tạo nhóm",
  "/settings/workspaces/create": "Tạo nhóm",
  "/settings/join": "Tham gia nhóm",
  "/dashboard/settings": "Cài đặt",
  "/dashboard/settings/general": "Cài đặt chung",
  "/dashboard/settings/account": "Tài khoản",
  "/dashboard/workspaces/create": "Tạo nhóm",
  "/dashboard/join": "Tham gia",
  "/dashboard/join-requests": "Yêu cầu tham gia",
};

export function DashboardHeaderSubtitle({ fallback }: { fallback: string }) {
  const pathname = usePathname();
  const pageLabel = PAGE_LABELS[pathname] ?? (pathname.startsWith("/workspace/") ? "Sổ giao dịch" : null);
  const showWorkspaceName =
    pathname !== "/setting" && pathname !== "/dashboard/settings/general";

  return (
    <span className="dashboard-header-subtitle">
      {showWorkspaceName && fallback}
      {showWorkspaceName && pageLabel && (
        <span style={{ opacity: 0.4, margin: "0 0.35rem" }}>·</span>
      )}
      {pageLabel}
    </span>
  );
}
