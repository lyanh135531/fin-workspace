# Phase 5 — Loại bỏ danh mục mẫu và chuyển cài đặt giao diện

## Phạm vi đã hoàn thành

- Workspace mới luôn tạo trực tiếp bộ danh mục mặc định kèm `jarCode`; không còn phụ thuộc danh mục mẫu của user.
- Đăng ký tài khoản không còn tạo `CATEGORY_TEMPLATE`.
- Đã xóa luồng import danh mục mẫu, service/template UI và các truy vấn runtime liên quan.
- Dữ liệu/schema legacy `CATEGORY_TEMPLATE` và `CATEGORY.user_id` được giữ nguyên tạm thời để dọn hợp đồng ở Phase 8; runtime không còn đọc chúng.
- Đã bỏ menu **Cài đặt chung**. Route cũ `/dashboard/settings/general` và `/setting` chuyển hướng về `/overview` để không tạo trang chết.
- Điều khiển giao diện được đưa lên header desktop và vào menu sheet mobile.
- Giao diện hỗ trợ 5 theme cố định và light/dark, lưu lựa chọn bằng `localStorage` và áp dụng qua `data-theme`/`data-mode`.
- Đổi mật khẩu được tách sang action tài khoản riêng, không còn phụ thuộc action của trang cài đặt chung.

## Kiểm tra

- TypeScript: đạt.
- Unit test: đạt, 31 file / 132 test.
- ESLint cho toàn bộ file Phase 5: đạt.
- Production build: đạt; `.next/BUILD_ID` được tạo sau khi compile, typecheck và static generation hoàn tất.
- `git diff --check`: đạt sau khi dọn whitespace sinh ra trong Phase 5.
- Audit mã nguồn: không còn consumer runtime của import/template và không còn link menu đến **Cài đặt chung**.

## Hạng mục mang sang Phase 8

- Visual QA bằng browser chưa thể chạy do browser plugin từ chối nạp dependency ngoài trusted path. Đây là hạng mục **chưa xác nhận**, không được tính là đã đạt.
- Xóa schema/data legacy chỉ thực hiện ở Phase 8 sau khi toàn bộ tính năng mới và migration production đã ổn định.
