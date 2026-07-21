"use client";

import { usePathname } from "next/navigation";

export function DashboardHeaderSubtitle({ fallback }: { fallback: string }) {
  const pathname = usePathname();
  const subtitles: Record<string, string> = {
    "/overview": "Tình hình tài chính của workspace",
    "/dashboard/overview": "Tình hình tài chính của workspace",
    "/wallets": "Danh sách và cấu hình ví",
    "/dashboard/wallets": "Danh sách và cấu hình ví",
    "/setting": "Hệ thống, danh mục chung và tài khoản",
    "/settings/workspace": "Vận hành, danh mục và quyền truy cập",
    "/settings/users": "Tạo và cấp quyền cho thành viên",
    "/settings/workspaces/create": "Khởi tạo không gian dữ liệu mới",
    "/settings/join": "Gửi yêu cầu tham gia bằng mã mời",
    "/dashboard/settings": "Vận hành, danh mục và quyền truy cập",
    "/dashboard/settings/general": "Hệ thống, danh mục chung và tài khoản",
    "/dashboard/users": "Tạo và cấp quyền cho thành viên",
    "/dashboard/workspaces/create": "Khởi tạo không gian dữ liệu mới",
    "/dashboard/join": "Gửi yêu cầu tham gia bằng mã mời",
    "/dashboard/invitations": "Các lời mời đang chờ phản hồi",
    "/dashboard/join-requests": "Duyệt thành viên muốn tham gia workspace",
  };
  return <span className="dashboard-header-subtitle">{subtitles[pathname] ?? fallback}</span>;
}
