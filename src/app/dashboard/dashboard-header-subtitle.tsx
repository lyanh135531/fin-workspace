"use client";

import { usePathname } from "next/navigation";

export function DashboardHeaderSubtitle({ fallback }: { fallback: string }) {
  const pathname = usePathname();
  const subtitles: Record<string, string> = {
    "/overview": "Tình hình tài chính của workspace",
    "/dashboard/overview": "Tình hình tài chính của workspace",
    "/dashboard": "Nhật ký thu chi & quản lý giao dịch",
    "/recurring-transactions": "Tự động ghi nhận các khoản thu chi hằng tháng",
    "/wallets": "Danh sách và cấu hình ví",
    "/dashboard/wallets": "Danh sách và cấu hình ví",
    "/setting": "Giao diện và danh mục mẫu cá nhân",
    "/settings/account": "Thông tin cá nhân, đổi mật khẩu và bảo mật",
    "/account": "Thông tin cá nhân, đổi mật khẩu và bảo mật",
    "/settings/workspace": "Vận hành, danh mục và quyền truy cập",
    "/workspaces/create": "Khởi tạo không gian dữ liệu mới",
    "/settings/workspaces/create": "Khởi tạo không gian dữ liệu mới",
    "/settings/join": "Gửi yêu cầu tham gia bằng mã mời",
    "/dashboard/settings": "Vận hành, danh mục và quyền truy cập",
    "/dashboard/settings/general": "Giao diện và danh mục mẫu cá nhân",
    "/dashboard/settings/account": "Thông tin cá nhân, đổi mật khẩu và bảo mật",
    "/dashboard/workspaces/create": "Khởi tạo không gian dữ liệu mới",
    "/dashboard/join": "Gửi yêu cầu tham gia bằng mã mời",
    "/dashboard/join-requests": "Duyệt thành viên muốn tham gia workspace",
  };

  const matchedSubtitle = subtitles[pathname] ?? (pathname.startsWith("/workspace/") ? "Nhật ký thu chi & quản lý giao dịch" : undefined);
  return <span className="dashboard-header-subtitle">{matchedSubtitle ?? fallback}</span>;
}
