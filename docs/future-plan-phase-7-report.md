# Phase 7 — Actions, RBAC và giao diện kế hoạch

## Backend và phân quyền

- Server Actions chỉ xác thực session/workspace/Admin, parse Zod, gọi service và revalidate.
- Admin có thể tạo/sửa/xóa nháp, kích hoạt, đổi deadline, đổi tỷ lệ tháng sau, cancel và complete.
- Member dùng chung màn hình nhưng `canManage = false`; không render control quản trị và service tiếp tục chặn nếu gọi trực tiếp.
- Workspace isolation được giữ ở cả membership check và plan lookup.
- Form stale/concurrency trả conflict từ service; activate đồng thời vẫn được bảo vệ bằng advisory lock + partial unique index.
- Destructive flow của xóa nháp và cancel có alert confirmation trước khi gọi action.

## Giao diện

- Thêm route `/financial-plans` và route tương thích `/dashboard/financial-plans`.
- Thêm **Kế hoạch** vào desktop navigation và mobile menu sheet; không thêm vào mobile bottom navigation.
- Có empty state, create/edit draft, review/activate, active/read-only detail và plan history.
- Hiển thị riêng: mục tiêu, đã ghi nhận, dự kiến cuối tháng, dự kiến đến deadline và thiếu hụt nguồn lực.
- Hiển thị hạn mức/chi/còn lại/vượt cho sáu hũ; jar overspend không bị trình bày như plan shortfall.
- Lịch tháng phân biệt snapshot đã đóng và dự kiến; delta do backdate được hiển thị riêng.
- Edit deadline giải thích việc chia lại tháng chưa đóng; allocation giải thích hiệu lực từ tháng sau và khóa submit nếu tổng khác `100%`.
- Completed/cancelled không tiếp tục forecast tháng tương lai.
- Dùng base components, semantic tokens và Sheet `elevation="flat"`; mã feature không thêm shadow.
- Sửa accessibility base `Input`: label nay liên kết đúng với input qua `htmlFor`.
- Bổ sung breadcrumb, header subtitle, robots/proxy/host routing và nhãn audit portal.

## Kiểm tra

- TypeScript: đạt.
- ESLint phạm vi Phase 7: đạt.
- Unit/integration: đạt, 36 file / 153 test.
- Action test xác nhận Zod conversion, tỷ lệ sai bị chặn trước service, RBAC và conflict được trả về UI.
- Database integration xác nhận Member chỉ xem và không thể truy cập plan chéo workspace.
- Production build: đạt; cả `/financial-plans` và `/dashboard/financial-plans` có trong route manifest.
- Static UI audit: không có `shadow-*` trong feature, layout mobile-first, control có label/aria và native keyboard behavior.

## Visual QA đã xác nhận ở Phase 8

- Browser smoke test dùng workspace QA cô lập, sau đó xóa sạch fixture.
- Desktop `1440×1000` và mobile `390×844` đều render đúng; mobile menu sheet có mục Kế hoạch và bộ điều khiển giao diện.
- Luồng empty → tạo nháp → kích hoạt hiển thị đúng vector: số dư `20.000.000`, mục tiêu `100.000.000` trong 10 tháng, khoản bắt buộc `10.000.000`/tháng và hạn mức hũ `5.500.000 / 1.000.000 / 1.000.000 / 1.000.000 / 1.000.000 / 500.000`.
- Light/dark switch hoạt động; DOM accessibility có heading, navigation, dialog, textbox, spinbutton và progressbar đúng vai trò.
- Console không có error; chỉ có warning dev-mode `scroll-behavior` của Next.js ngoài phạm vi feature.
