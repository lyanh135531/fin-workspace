export type WorkspaceNavigationKey =
  | "overview"
  | "ledger"
  | "recurring"
  | "plans"
  | "wallets"
  | "settings";

export type WorkspaceNavigationItem = {
  key: WorkspaceNavigationKey;
  href: string;
  label: string;
  description: string;
  requiresWorkspace?: boolean;
  adminOnly?: boolean;
  mobilePrimary?: boolean;
};

export function workspaceNavigationItems(
  currentWorkspaceId?: string,
): WorkspaceNavigationItem[] {
  return [
    {
      key: "overview",
      href: "/overview",
      label: "Tổng quan",
      description: "Tổng quan tài chính",
      mobilePrimary: true,
    },
    {
      key: "ledger",
      href: currentWorkspaceId
        ? `/workspace/${currentWorkspaceId}`
        : "/dashboard",
      label: "Sổ giao dịch",
      description: "Sổ thu chi và lịch sử giao dịch",
      requiresWorkspace: true,
      mobilePrimary: true,
    },
    {
      key: "recurring",
      href: "/recurring-transactions",
      label: "Giao dịch định kỳ",
      description: "Các khoản thu chi tự động hằng tháng",
      requiresWorkspace: true,
    },
    {
      key: "plans",
      href: "/financial-plans",
      label: "Kế hoạch",
      description: "Mục tiêu tương lai và hạn mức sáu hũ",
      requiresWorkspace: true,
      mobilePrimary: true,
    },
    {
      key: "wallets",
      href: "/wallets",
      label: "Ví",
      description: "Số dư và các tài khoản ví",
      requiresWorkspace: true,
      mobilePrimary: true,
    },
    {
      key: "settings",
      href: "/settings/workspace",
      label: "Cài đặt nhóm",
      description: "Cơ chế phê duyệt, mã mời và cấu hình",
      requiresWorkspace: true,
      adminOnly: true,
    },
  ];
}

export function isWorkspaceNavigationActive(
  key: WorkspaceNavigationKey,
  pathname: string,
): boolean {
  const cleanPath = pathname.split("?")[0].split("#")[0];
  if (key === "overview") return cleanPath === "/overview";
  if (key === "ledger") return cleanPath === "/dashboard" || cleanPath.startsWith("/workspace/");
  if (key === "recurring") return cleanPath === "/recurring-transactions";
  if (key === "plans") return cleanPath === "/financial-plans";
  if (key === "wallets") return cleanPath === "/wallets";
  return (
    cleanPath === "/settings/workspace" ||
    cleanPath === "/dashboard/settings" ||
    cleanPath === "/dashboard/join-requests" ||
    cleanPath === "/members"
  );
}
