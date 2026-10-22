const ACTION_LABELS: Record<string, string> = {
  // Workspace
  "workspace.created": "Tạo nhóm tài chính",
  "workspace.deleted": "Xóa nhóm tài chính",
  "workspace.settings_updated": "Cập nhật cài đặt nhóm",
  "workspace.invite_code_regenerated": "Tạo mã mời mới",
  "workspace.join_requested": "Yêu cầu tham gia",
  "workspace.join_approved": "Duyệt tham gia",
  "workspace.join_rejected": "Từ chối tham gia",
  "workspace.member_account_created": "Tạo tài khoản thành viên",
  "workspace.member_deactivated": "Vô hiệu hóa thành viên",
  "workspace.member_role_changed": "Thay đổi vai trò thành viên",
  "workspace.wallet_created": "Tạo ví",
  "workspace.wallet_updated": "Cập nhật ví",
  "workspace.wallet_reactivated": "Kích hoạt lại ví",
  "workspace.wallet_deactivated": "Vô hiệu hóa ví",
  "workspace.wallet_deleted": "Xóa ví",
  "workspace.credit_card_created": "Tạo thẻ tín dụng",
  "workspace.credit_card_updated": "Cập nhật thẻ tín dụng",
  "workspace.credit_card_deleted": "Xóa thẻ tín dụng",

  // Credit card
  "credit_card.payment_created": "Thanh toán dư nợ thẻ tín dụng",
  "credit_card.refund_created": "Hoàn tiền thẻ tín dụng",
  "credit_card.installment_registered": "Đăng ký trả góp thẻ tín dụng",
  "credit_card.installment_imported": "Nhập kỳ trả góp thẻ tín dụng",
  "credit_card.installment_import_deleted": "Xóa dữ liệu nhập trả góp",
  "credit_card.installment_deleted": "Xóa khoản trả góp thẻ tín dụng",

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
  "transaction.change_rejected": "Từ chối yêu cầu thay đổi giao dịch",

  // Recurring transaction
  "recurring_transaction.created": "Tạo giao dịch định kỳ",
  "recurring_transaction.updated": "Cập nhật giao dịch định kỳ",
  "recurring_transaction.deleted": "Xóa giao dịch định kỳ",
  "recurring_transaction.paused": "Tạm dừng giao dịch định kỳ",
  "recurring_transaction.resumed": "Tiếp tục giao dịch định kỳ",
  "recurring_transaction.activated": "Kích hoạt giao dịch định kỳ",
  "recurring_transaction.reactivation_requested": "Yêu cầu kích hoạt lại giao dịch định kỳ",
  "recurring_transaction.approved": "Duyệt giao dịch định kỳ",
  "recurring_transaction.rejected": "Từ chối giao dịch định kỳ",
  "recurring_transaction.executed": "Thực thi giao dịch định kỳ",
  "recurring_transaction.posted": "Ghi nhận giao dịch định kỳ",
  "recurring_transaction.failed": "Lỗi thực thi giao dịch định kỳ",
  "recurring_transaction.completed": "Hoàn thành giao dịch định kỳ",

  // Financial plan & goals
  "financial_plan.draft_created": "Tạo kế hoạch nháp",
  "financial_plan.draft_updated": "Cập nhật kế hoạch nháp",
  "financial_plan.draft_deleted": "Xóa kế hoạch nháp",
  "financial_plan.deleted": "Xóa kế hoạch tài chính",
  "financial_plan.activated": "Kích hoạt kế hoạch",
  "financial_plan.deadline_updated": "Cập nhật hạn hoàn thành kế hoạch",
  "financial_plan.allocation_updated": "Cập nhật tỷ lệ hũ kế hoạch",
  "financial_plan.month_closed": "Đóng tháng kế hoạch",
  "financial_plan.completed": "Hoàn thành kế hoạch",
  "financial_plan.cancelled": "Hủy kế hoạch",
  "financial_goal.created": "Tạo mục tiêu tài chính",
  "financial_goal.updated": "Cập nhật mục tiêu tài chính",
  "financial_goal.reordered": "Sắp xếp ưu tiên mục tiêu",
  "financial_goal.funding_recorded": "Ghi nhận đóng góp mục tiêu",
  "financial_goal.funding_requested": "Yêu cầu đóng góp mục tiêu",
  "financial_goal.funding_approved": "Duyệt đóng góp mục tiêu",
  "financial_goal.funding_rejected": "Từ chối đóng góp mục tiêu",
  "financial_goal.funding_reversed": "Hoàn tác đóng góp mục tiêu",
  "financial_goal.completed": "Hoàn thành mục tiêu tài chính",
  "financial_goal.cancelled": "Hủy mục tiêu tài chính",

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

  // Investment & Savings
  "investment.gold_holding_created": "Tạo khoản vàng tích sản",
  "investment.gold_lot_purchased": "Mua thêm vàng tích sản",
  "investment.gold_lot_updated": "Cập nhật đợt mua vàng",
  "investment.gold_sold": "Bán vàng tích sản",
  "investment.gold_sale_reverted": "Hoàn tác lần bán vàng",
  "investment.savings_created": "Mở sổ tiết kiệm ngân hàng",
  "investment.savings_settled": "Tất toán / Tái tục sổ tiết kiệm",
  "investment.savings_settlement_reverted": "Hoàn tác tất toán / tái tục sổ tiết kiệm",
};

/**
 * Convert an audit log action string to a human-readable Vietnamese label.
 * Falls back to the raw action string if no mapping exists.
 */
export function formatActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}
