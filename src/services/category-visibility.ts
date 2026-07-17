/** Chỉ các category toàn cục hoặc thuộc đúng workspace mới được sử dụng. */
export function availableCategoryWhere(workspaceId: string) {
  return {
    status: "active" as const,
    deletedAt: null,
    OR: [{ workspaceId: null }, { workspaceId }],
  };
}

/** Dùng ở màn quản trị để xem cả category riêng đã vô hiệu hóa. */
export function manageableCategoryWhere(workspaceId: string) {
  return { deletedAt: null, OR: [{ workspaceId: null }, { workspaceId }] };
}
