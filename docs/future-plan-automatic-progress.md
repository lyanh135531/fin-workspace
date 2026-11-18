# Kế hoạch: tiến độ tự động (phiên bản 2)

Quy tắc này thay thế nguồn tiến độ thủ công/liên kết một ví trong tài liệu nghiệp vụ trước.
Phạm vi thay đổi chỉ gồm Kế hoạch. Ví, giao dịch, định kỳ và thẻ chỉ là nguồn đọc.

## Tiến độ

- Nguồn tiền ròng = tổng số dư các ví tài sản thuộc workspace trừ toàn bộ dư nợ thẻ chưa trả.
- Bao gồm ví bị vô hiệu hóa còn giữ tiền; loại ví đã xóa hợp lệ. Không cộng hạn mức tín dụng.
- Bao gồm toàn bộ gốc trả góp chưa thanh toán; không cộng lại phần chưa đến hạn.
- Tiến độ hiển thị không âm. Giá trị ròng âm vẫn được giữ khi tính thiếu hụt ngân sách.
- Chỉ dữ liệu đã approved làm thay đổi số dư thực tế.
- Chuyển tiền nội bộ không thay đổi tổng. Trả thẻ đồng thời giảm tiền và giảm nợ nên không làm giảm tích lũy lần nữa.
- Một quỹ chung được phân bổ theo ưu tiên, deadline và thời điểm tạo; không tính cùng một khoản cho nhiều mục tiêu.
- Tiền có thể giảm sau khi chi; không chỉ cộng biến động dương.
- Tích lũy là số dư tại thời điểm tính, không phải tổng số dư cuối các tháng.

## Bắt đầu và ngân sách

- Tạo và kích hoạt mặc định ngay trong tháng hiện tại theo timezone workspace, kể cả ngày cuối tháng.
- Vẫn cho lưu bản nháp. Không giảm khoản cần dành theo số ngày còn lại.
- Số dư ròng tại kích hoạt được chụp tự động, người dùng không nhập tiến độ ban đầu.
- Khoản cần dành được tính riêng cho từng mục tiêu theo deadline, sau đó cộng thành nghĩa vụ tháng.
- Ngân sách tháng dùng nguồn tiền ròng, khoản cần giữ, actual từ đầu tháng và forecast còn lại.
- Scheduled/recurring đã qua ngày hiện tại không được coi là khoản thu tương lai chưa nhận.
- Dự báo tiền cuối tháng chỉ cộng biến động tương lai một lần; thanh toán nợ đã được giữ lại không trừ lần nữa.
- Không gọi các worker ví/giao dịch/định kỳ từ tính năng kế hoạch để thay đổi dữ liệu của chúng.

## Sáu hũ

- Tổng tỷ lệ chính xác 100%. Admin thay đổi có hiệu lực ngay cho toàn tháng đang mở.
- Giữ nguyên số tiền đã chi, phân bổ lại hạn mức. Hũ có thể chuyển sang vượt hạn mức.
- Tỷ lệ mới tiếp tục có hiệu lực ở các tháng sau; gỡ override tương lai của cơ chế cũ.
- Tháng đã chốt giữ nguyên tỷ lệ và hạn mức. Mỗi thay đổi có audit.

## Chốt tháng và lịch sử

- Chốt theo thứ tự, idempotent, dùng tiền và nợ tại cùng ranh giới ngày cuối kỳ.
- Snapshot 2.0.0 lưu số tiền tích lũy cuối kỳ trong closed_actual_goal_amount (stock).
- Không cộng stock của nhiều tháng. actual_contribution từng mục tiêu có thể âm.
- Snapshot cũ giữ nguyên, được nhận diện bằng calculator_version.
- Giao dịch backdate được phản ánh ở actual điều chỉnh; không sửa snapshot đã chốt.
- Kế hoạch đã kết thúc giữ kết quả riêng; không lấy tiền của kế hoạch mới làm tiến độ.

## Chuyển tiếp

- Không tạo thêm hoặc sử dụng funding entry để tính tiến độ.
- API cũ nhập/duyệt/đảo đóng góp từ chối yêu cầu.
- Migration 20261118090000 chỉ gỡ liên kết ví trong mục tiêu đang mở, đóng các yêu cầu chờ duyệt và ghi audit.
- Không xóa funding đã duyệt, không ghi lại snapshot lịch sử, không thay đổi số dư ví hoặc giao dịch.
- Áp dụng migration theo quy trình deploy hiện có trước khi mở giao diện mới.


## Follow-up corrections

- Scheduled expenses not yet posted remain reserved even when overdue, including prior months. Overdue income is reported separately and excluded from spendable budget.
- Recurring forecasts include unmaterialized overdue periods from nextExecutionDate; a materialized period is never counted a second time.
- Adding, editing, reordering or finishing goals closes past months under the same plan advisory lock and database transaction before applying the mutation.
- Migration 20261118100000 adds a dated transition baseline for existing active plans. Exact activation history cannot be guaranteed because wallet membership is not versioned, so the transition uses the current asset pool minus full card debt. Original activation values and closed snapshots are retained; the new balance/date and old value are audited.
- Baseline migration can be replayed without resetting a transitioned plan or duplicating its audit entry. Apply this migration before deploying code which reads the new fields.
