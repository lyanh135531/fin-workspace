Bạn là một Senior UI/UX Designer và Frontend Designer chuyên thiết kế dashboard tài chính hiện đại. Hãy thiết kế giao diện cho hệ thống quản lý tài chính gia đình theo phong cách **Sunrise Family**: trẻ trung, ấm áp, chuyên nghiệp, dễ sử dụng hằng ngày nhưng vẫn đủ chặt chẽ cho một sản phẩm tài chính có thể phát triển lâu dài.

## 1. Định hướng thiết kế tổng thể

Thiết kế phải tạo cảm giác:

* Ấm áp, gần gũi và hướng đến gia đình.
* Hiện đại, gọn gàng, đáng tin cậy.
* Trẻ trung nhưng không quá hoạt hình.
* Dễ đọc với số liệu tài chính lớn.
* Hạn chế cảm giác nặng nề thường thấy ở phần mềm kế toán.
* Có khả năng mở rộng sang web responsive, PWA và Flutter.

Sử dụng ngôn ngữ thiết kế thống nhất trên tất cả màn hình:

* Nền chính màu kem nhạt: `#FFF8F0`.
* Surface/card màu trắng: `#FFFFFF`.
* Màu cam đào: `#FFB38A`.
* Màu cam chính: `#F97345`.
* Màu coral cho CTA: `#FF5B3D`.
* Màu navy cho chữ chính: `#17233C`.
* Màu xanh da trời: `#69B7F3`.
* Màu xanh lá biểu thị thu nhập: `#168A39`.
* Màu đỏ biểu thị chi tiêu: `#E84335`.
* Border màu be nhạt: `#ECE4DA`.
* Font ưu tiên: `DM Sans`, `Manrope` hoặc font sans-serif tương đương.

Card sử dụng:

* Border radius từ `18px–24px`.
* Border mảnh `1px`.
* Shadow mềm, nhẹ, không quá nổi.
* Khoảng cách theo hệ thống `8px`.
* Padding card từ `20px–28px`.
* Hiệu ứng hover nâng card khoảng `2px`.
* Animation trong khoảng `160–220ms`.
* Focus ring màu xanh da trời để đảm bảo accessibility.

Không sử dụng glassmorphism quá mạnh, màu neon hoặc gradient tối. Gradient chỉ nên xuất hiện nhẹ tại hero card và nút hành động chính.

## 2. Cấu trúc layout chính

Thiết kế desktop theo viewport tham chiếu `1440 × 900`.

Bố cục gồm:

* Sidebar cố định bên trái, rộng khoảng `240–248px`.
* Topbar phía trên nội dung, cao khoảng `80–88px`.
* Main content sử dụng grid 12 cột.
* Content padding từ `28px–32px`.
* Khoảng cách giữa các section từ `20px–24px`.
* Chiều rộng nội dung cần linh hoạt và hỗ trợ màn hình lớn.

Trên tablet:

* Sidebar thu gọn chỉ còn icon.
* Các grid lớn chuyển thành hai cột.
* Data table được phép cuộn ngang.

Trên mobile:

* Sidebar chuyển thành menu drawer.
* Có bottom navigation.
* Các card chuyển thành một cột.
* Nút thêm giao dịch trở thành floating action button hoặc CTA nổi bật.
* Form giao dịch chuyển thành một cột.
* Toàn bộ thao tác phải phù hợp với touch target tối thiểu `44px`.

## 3. Sidebar và menu bar

Sidebar cần có logo hoặc biểu tượng ngôi nhà kết hợp tài chính, cùng tên workspace hiện tại, ví dụ:

* Gia đình Billy
* Family Workspace

Bên dưới logo có workspace switcher:

* Avatar viết tắt của workspace.
* Tên workspace hiện tại.
* Nút dropdown để đổi workspace.
* Thiết kế dạng card nhỏ, border mềm và nền trắng.

Các menu chính:

1. Tổng quan
2. Workspace
3. Ví
4. Ngân sách
5. Danh mục
6. Thành viên
7. Cài đặt

Menu active sử dụng:

* Nền peach nhạt.
* Chữ và icon màu coral.
* Một thanh chỉ báo nhỏ bên trái.
* Border nhẹ hoặc inner shadow.
* Có thể hiển thị badge số lượng, ví dụ Workspace có `12` giao dịch cần theo dõi.

Cuối sidebar có một mini card hiển thị tình trạng ngân sách tháng:

* “Tháng 7 đang ổn”
* “68% ngân sách”
* Thanh progress coral trên nền navy.

## 4. Topbar

Topbar gồm:

* Tên màn hình hoặc lời chào: “Xin chào, Billy”.
* Ngày hiện tại.
* Danh sách avatar thành viên gia đình dạng chồng lớp.
* Nút tìm kiếm.
* Nút thông báo có badge số lượng.
* Có thể bổ sung menu hồ sơ người dùng.

Topbar cần giữ bố cục nhẹ, không chiếm quá nhiều không gian và sử dụng background kem có độ trong suốt vừa phải.

## 5. Màn hình Dashboard – Tổng quan

Dashboard phải cung cấp cái nhìn nhanh về tình trạng tài chính gia đình.

### Hero balance card

Card chính hiển thị:

* Tổng số dư.
* Thu nhập tháng này.
* Chi tiêu tháng này.
* So sánh hoặc xu hướng với tháng trước.
* Hình minh họa một gia đình Việt Nam gồm bố, mẹ và các con đứng cạnh ngôi nhà hiện đại trong ánh bình minh.

Hình minh họa nằm bên phải card. Nội dung số liệu nằm bên trái. Sử dụng gradient peach/cream nhẹ để hòa trộn hình và nội dung.

Số dư phải là điểm nhấn lớn nhất, ví dụ:

* Tổng số dư: `128.450.000 ₫`
* Thu nhập tháng này: `42.000.000 ₫`
* Chi tiêu tháng này: `27.650.000 ₫`

### Quick action

Bên cạnh hero card là nút/card “Thêm giao dịch”:

* Nền gradient coral–orange.
* Icon dấu cộng lớn trong vòng tròn trắng.
* Nội dung: “Ghi lại khoản thu hoặc chi mới”.
* Hover nâng nhẹ và tăng shadow.
* Nhấn vào sẽ mở modal đăng ký giao dịch.

### Wallet summary

Hiển thị các ví:

* Tiền mặt.
* Vietcombank.
* MoMo.
* Ví đầu tư nếu có.

Mỗi wallet card gồm:

* Icon hoặc ký hiệu.
* Tên ví.
* Số dư.
* Thanh progress nhỏ.
* Màu nhận diện riêng nhưng vẫn thuộc palette Sunrise Family.

### Budget overview

Hiển thị ngân sách tháng bằng donut chart:

* Phần trăm đã sử dụng.
* Đã chi tiêu.
* Còn lại.
* Tổng ngân sách.
* Dropdown chọn tháng.

Màu chính của chart là orange và blue, phần chưa sử dụng là xám nhạt.

### Recent transactions

Danh sách giao dịch gần đây gồm:

* Icon category.
* Nội dung giao dịch.
* Ngày giờ.
* Ví sử dụng.
* Số tiền.
* Thu nhập hiển thị màu xanh.
* Chi tiêu hiển thị màu đỏ.
* Link “Xem tất cả”.

## 6. Màn hình Workspace – Sổ thu chi

Workspace là nơi vận hành chính của hệ thống. Đây là phiên bản chuyên nghiệp hơn của bảng Excel quản lý thu chi.

Header màn hình gồm:

* Breadcrumb: `Workspace / Tháng 7 năm 2026`.
* Tiêu đề: “Sổ thu chi gia đình”.
* Mô tả ngắn.
* Nút “Xuất dữ liệu”.
* Nút CTA “Thêm giao dịch”.

### Summary cards

Hiển thị bốn thẻ tổng hợp:

1. Thu nhập đã ghi nhận.
2. Chi tiêu đã ghi nhận.
3. Ngân sách còn lại.
4. Giao dịch cần xử lý.

Mỗi card gồm:

* Icon có nền pastel.
* Label.
* Giá trị tài chính.
* Trend hoặc thông tin phụ.
* Không sử dụng quá nhiều màu trong cùng một card.

### Thanh tìm kiếm và bộ lọc

Toolbar phía trên bảng gồm:

* Tìm kiếm theo nội dung giao dịch hoặc ghi chú.
* Lọc theo hạng mục.
* Lọc theo trạng thái.
* Lọc theo ví.
* Lọc theo khoảng ngày.
* Nút mở bộ lọc nâng cao.
* Có thể thêm nút reset filter.

### Data table giao dịch

Bảng giao dịch bao gồm các cột:

1. Checkbox chọn dòng.
2. Thông tin giao dịch.
3. Hạng mục.
4. Ví.
5. Ngân sách tháng.
6. Giá trị giao dịch.
7. Ngày giao dịch.
8. Trạng thái.
9. Ghi chú.
10. Menu thao tác.

Cột “Thông tin giao dịch” gồm:

* Icon thu hoặc chi.
* Nội dung giao dịch.
* Mã giao dịch nhỏ.

Cột “Hạng mục” sử dụng pill badge với màu nhận diện:

* Vốn: xanh da trời.
* Trả nợ: đỏ nhạt.
* Mua nhà: vàng.
* Gia đình: tím nhạt.
* Đầu tư: đỏ đậm.
* Ăn uống: coral.
* Khác: xanh lá.

Không sử dụng màu sắc làm tín hiệu duy nhất; badge phải có text rõ ràng.

Cột “Ngân sách tháng” không phải dữ liệu được nhập trực tiếp trong transaction. Đây là dữ liệu tham chiếu được lấy từ budget của category trong tháng tương ứng. Hiển thị:

* Tổng ngân sách category.
* Một thanh progress thể hiện tỷ lệ giao dịch so với ngân sách.

Cột “Giá trị”:

* Thu nhập có dấu `+` và màu xanh.
* Chi tiêu có dấu `−` và màu đỏ.
* Căn phải để dễ so sánh số liệu.

Trạng thái giao dịch hiển thị bằng status pill:

* Đã ghi nhận: xanh lá.
* Chờ duyệt: vàng/cam.
* Dự kiến: xanh da trời.
* Đã hủy: xám hoặc đỏ nhạt.

Mỗi status cần có:

* Chấm màu.
* Label rõ ràng.
* Không chỉ sử dụng icon.

Bảng cần hỗ trợ:

* Hover từng dòng.
* Chọn một hoặc nhiều dòng.
* Thanh thao tác hàng loạt khi có dòng được chọn.
* Phân trang.
* Sắp xếp theo ngày hoặc số tiền.
* Cuộn ngang trên màn hình nhỏ.
* Empty state khi không có dữ liệu.
* Loading skeleton khi tải dữ liệu.

## 7. Modal thêm giao dịch

Khi nhấn “Thêm giao dịch”, mở modal hoặc drawer có các trường:

* Nội dung giao dịch.
* Loại giao dịch: thu nhập, chi tiêu hoặc chuyển khoản.
* Hạng mục.
* Ví thanh toán.
* Số tiền.
* Ngày giao dịch.
* Trạng thái.
* Ghi chú.

Ngân sách không được nhập trực tiếp. Hệ thống tự động đối chiếu ngân sách dựa trên:

* Workspace.
* Category.
* Tháng của ngày giao dịch.
* Currency.

Form cần có:

* Label rõ ràng.
* Placeholder thực tế.
* Validation.
* Error message.
* Nút Hủy bỏ.
* Nút Lưu giao dịch.
* Loading state khi lưu.
* Toast thông báo sau khi thành công.
* Keyboard navigation và focus management.

## 8. Các màn hình liên quan

### Ví

Hiển thị:

* Danh sách ví.
* Số dư hiện tại.
* Loại ví.
* Currency.
* Trạng thái.
* Giao dịch gần nhất.
* Tổng tiền vào và tiền ra.
* Nút thêm ví.

### Ngân sách

Hiển thị:

* Ngân sách theo tháng.
* Ngân sách theo category.
* Planned amount.
* Actual amount.
* Remaining amount.
* Tỷ lệ sử dụng.
* Cảnh báo khi gần hoặc vượt ngân sách.
* Chart so sánh giữa kế hoạch và thực tế.

### Danh mục

Hiển thị category dạng card hoặc tree:

* Category cha/con.
* Loại income hoặc expense.
* Icon.
* Màu.
* Trạng thái active/inactive.
* Số giao dịch đã sử dụng category.

### Thành viên

Hiển thị:

* Avatar.
* Họ tên.
* Vai trò trong workspace.
* Trạng thái.
* Hoạt động gần đây.
* Quyền truy cập.
* Nút mời thành viên.

### Cài đặt

Bao gồm:

* Tên workspace.
* Base currency.
* Timezone.
* Quy tắc duyệt giao dịch.
* Thông báo.
* Bảo mật và 2FA.
* Phân quyền.
* Audit log.
* Backup.

## 9. Nguyên tắc UX và dữ liệu

* Chỉ giao dịch `POSTED` mới ảnh hưởng số dư ví và chi tiêu thực tế.
* Giao dịch `SCHEDULED` và `PENDING` có thể xuất hiện trong phần dự kiến nhưng không cộng trừ vào số dư thực tế.
* Budget là một entity riêng, không phải transaction.
* Không cho phép người dùng nhập ngân sách trực tiếp trong form giao dịch.
* Các giao dịch đã posted cần được thể hiện là dữ liệu quan trọng, hạn chế chỉnh sửa trực tiếp.
* Luôn hiển thị currency cùng số tiền.
* Hỗ trợ định dạng tiền Việt Nam.
* Mọi hành động quan trọng cần có feedback bằng toast, modal xác nhận hoặc inline message.
* Tránh sử dụng quá nhiều biểu đồ; ưu tiên số liệu dễ hiểu và actionable.
* Đảm bảo contrast, keyboard navigation và `prefers-reduced-motion`.

Hãy tạo thiết kế high-fidelity hoàn chỉnh, thống nhất từ Dashboard đến Workspace và các module liên quan. Giao diện phải có dữ liệu mẫu thực tế bằng tiếng Việt, responsive, dễ chuyển thành React/Next.js hoặc Flutter, đồng thời đủ chuyên nghiệp để sử dụng như nền tảng cho một sản phẩm SaaS quản lý tài chính gia đình.
