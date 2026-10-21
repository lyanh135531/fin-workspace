export type WorkspaceNavigationKey =
  | "overview"
  | "ledger"
  | "recurring"
  | "plans"
  | "wallets"
  | "investments"
  | "creditCards"
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
      description: "Mục tiêu tiết kiệm và ngân sách 6 hũ",
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
      key: "investments",
      href: "/investments",
      label: "Sổ tiết kiệm & Đầu tư",
      description: "Đầu tư vàng tích sản và sổ tiết kiệm ngân hàng",
      requiresWorkspace: true,
    },
    {
      key: "creditCards",
      href: "/credit-cards",
      label: "Thẻ tín dụng",
      description: "Sao kê, trả góp và thanh toán thẻ",
      requiresWorkspace: true,
    },
    {
      key: "settings",
      href: "/settings/workspace",
      label: "Cài đặt nhóm",
      description: "Thông tin nhóm, danh mục và thành viên",
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
  if (key === "investments") {
    return (
      cleanPath === "/investments" ||
      cleanPath.startsWith("/investments/") ||
      cleanPath === "/dashboard/investments"
    );
  }
  if (key === "creditCards") return cleanPath === "/credit-cards" || cleanPath.startsWith("/credit-cards/");
  return (
    cleanPath === "/settings/workspace" ||
    cleanPath === "/dashboard/settings" ||
    cleanPath === "/dashboard/join-requests" ||
    cleanPath === "/members"
  );
}
