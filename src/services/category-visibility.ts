/** Chỉ các category thuộc đúng workspace mới được sử dụng trong giao dịch. */
export function availableCategoryWhere(workspaceId: string) {
  return {
    status: "active" as const,
    deletedAt: null,
    workspaceId,
  };
}

/** Dùng ở màn quản trị workspace để xem cả category đã vô hiệu hóa. */
export function manageableCategoryWhere(workspaceId: string) {
  return { deletedAt: null, workspaceId };
}
