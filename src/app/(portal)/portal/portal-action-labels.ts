const ACTION_LABELS: Record<string, string> = {
  // Workspace
  "workspace.created": "Tạo workspace",
  "workspace.deleted": "Xóa workspace",
  "workspace.settings_updated": "Cập nhật workspace",
  "workspace.invite_code_regenerated": "Tạo mã mời mới",
  "workspace.join_requested": "Yêu cầu tham gia",
  "workspace.join_approved": "Duyệt tham gia",
  "workspace.join_rejected": "Từ chối tham gia",
  "workspace.member_account_created": "Tạo tài khoản member",
  "workspace.member_deactivated": "Vô hiệu hóa member",

  // Transaction
  "transaction.created": "Tạo giao dịch",
  "transaction.approved": "Duyệt giao dịch",
  "transaction.rejected": "Từ chối giao dịch",
  "transaction.updated": "Cập nhật giao dịch",
  "transaction.deleted": "Xóa giao dịch",
  "transaction.scheduled_activated": "Giao dịch lên lịch kích hoạt",
  "transaction.update_requested": "Yêu cầu sửa giao dịch",
  "transaction.delete_requested": "Yêu cầu xóa giao dịch",
  "transaction.update_approved": "Duyệt yêu cầu sửa",
  "transaction.delete_approved": "Duyệt yêu cầu xóa",

  // Recurring transaction
  "recurring_transaction.created": "Tạo giao dịch định kỳ",
  "recurring_transaction.updated": "Cập nhật giao dịch định kỳ",
  "recurring_transaction.deleted": "Xóa giao dịch định kỳ",
  "recurring_transaction.paused": "Tạm dừng giao dịch định kỳ",
  "recurring_transaction.resumed": "Tiếp tục giao dịch định kỳ",
  "recurring_transaction.executed": "Thực thi giao dịch định kỳ",
  "recurring_transaction.completed": "Hoàn thành giao dịch định kỳ",

  // Category
  "CATEGORY_CREATED": "Tạo danh mục",
  "CATEGORY_UPDATED": "Cập nhật danh mục",
  "CATEGORY_DELETED": "Xóa danh mục",
  "CATEGORY_ACTIVATED": "Kích hoạt danh mục",
  "CATEGORY_DEACTIVATED": "Vô hiệu hóa danh mục",
  "category.imported_from_template": "Nhập danh mục từ mẫu",

  // Wallet
  "wallet.created": "Tạo ví",
  "wallet.updated": "Cập nhật ví",
  "wallet.deleted": "Xóa ví",
  "wallet.deactivated": "Vô hiệu hóa ví",
};

/**
 * Convert an audit log action string to a human-readable Vietnamese label.
 * Falls back to the raw action string if no mapping exists.
 */
export function formatActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}
