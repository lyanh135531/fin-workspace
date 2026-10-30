"use client";

import { usePathname } from "next/navigation";

const PAGE_LABELS: Record<string, string> = {
  "/overview": "Tổng quan",
  "/dashboard/overview": "Tổng quan",
  "/dashboard": "Sổ giao dịch",
  "/recurring-transactions": "Định kỳ",
  "/financial-plans": "Kế hoạch",
  "/wallets": "Ví",
  "/dashboard/wallets": "Ví",
  "/investments": "Đầu tư",
  "/dashboard/investments": "Đầu tư",
  "/credit-cards": "Thẻ tín dụng",
  "/dashboard/credit-cards": "Thẻ tín dụng",
  "/settings/account": "Tài khoản",
  "/account": "Tài khoản",
  "/settings/workspace": "Cài đặt nhóm",
  "/workspaces/create": "Tạo nhóm",
  "/settings/workspaces/create": "Tạo nhóm",
  "/settings/join": "Tham gia nhóm",
  "/dashboard/settings": "Cài đặt nhóm",
  "/dashboard/settings/account": "Tài khoản",
  "/dashboard/workspaces/create": "Tạo nhóm",
  "/dashboard/join": "Tham gia nhóm",
  "/dashboard/join-requests": "Yêu cầu tham gia",
  "/members": "Thành viên",
};

export function DashboardHeaderSubtitle({ fallback }: { fallback: string }) {
  const pathname = usePathname();
  const cleanPath = pathname.split("?")[0].split("#")[0];
  const pageLabel =
    PAGE_LABELS[cleanPath] ??
    (cleanPath.startsWith("/workspace/")
      ? "Sổ giao dịch"
      : cleanPath.startsWith("/credit-cards/")
        ? "Thẻ tín dụng"
        : cleanPath.startsWith("/investments/")
          ? "Đầu tư"
          : null);

  return (
    <div className="dashboard-header-subtitle flex min-w-0 flex-col justify-center sm:flex-row sm:items-center sm:gap-2">
      {pageLabel ? (
        <>
          <span className="text-[11px] font-medium leading-tight text-[var(--text-muted)] sm:text-sm sm:text-[var(--text-secondary)]">
            {fallback}
          </span>
          <span className="hidden shrink-0 text-[var(--text-muted)] sm:inline" aria-hidden="true">
            /
          </span>
          <span className="text-sm font-semibold leading-tight text-[var(--foreground)]">
            {pageLabel}
          </span>
        </>
      ) : (
        <span className="text-sm font-semibold leading-tight text-[var(--foreground)]">
          {fallback}
        </span>
      )}
    </div>
  );
}
