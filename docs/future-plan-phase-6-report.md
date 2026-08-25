# Phase 6 — Financial plan schema và calculator engine

## Dữ liệu và constraint

- Thêm `FINANCIAL_PLAN`, `PLAN_JAR_ALLOCATION`, `FINANCIAL_PLAN_MONTH`, `FINANCIAL_PLAN_MONTH_JAR` và enum lifecycle.
- Partial unique index bảo đảm tối đa một plan `active` trong mỗi workspace.
- Unique plan-month, month-jar và allocation theo kỳ.
- CHECK constraint cho tiền nguyên VND, amount không âm, tháng luôn là ngày đầu tháng và lifecycle hợp lệ.
- Constraint trigger bắt buộc mỗi kỳ allocation và mỗi snapshot tháng có đủ sáu hũ, tổng đúng `100%`.
- Snapshot tháng đóng và snapshot hũ bị chặn `UPDATE` ở database.
- Migration `20260824102000_financial_plan_engine` và `20260824104500_financial_plan_snapshot_guards` đã deploy thành công trên database phát triển.

## Calculator và ledger

- Calculator dùng `Decimal.js`, floor đến VND; dư chia tháng vào tháng cuối, dư chia hũ vào `ESSENTIAL`.
- Tách raw/allocatable gross, `resourceShortfall`, total/jar overspend, budget variance và actual goal amount.
- Tháng đầu tự lấy số dư thực tế của toàn bộ ví chưa xóa qua `WORKSPACE_WALLET`, kể cả ví tạm ngưng.
- Các tháng sau dùng income actual/forecast; transfer nội bộ bị loại khỏi dòng tiền ròng.
- Forecast gồm scheduled và recurring active; occurrence recurring đã materialize bị loại theo `(recurring_transaction_id, recurring_period)`.
- Pending được trả riêng; rejected/deleted bị loại.
- Tách `realizedProgress`, `projectedEndOfCurrentMonthProgress` và `projectedEndOfPlanProgress`.
- Live reforecast tính tuần tự khoản phải dành của toàn bộ tháng chưa đóng từ projection mới nhất. Chi vượt/chi ít hoặc recurring thay đổi trong tháng đang mở lập tức ảnh hưởng lịch tương lai mà không sửa snapshot.
- Health được suy ra, không lưu: ahead, on_track, behind, at_risk, goal_reached, overdue.
- Backdate của plan active được tính lại từ ledger và carry delta vào lịch chưa đóng; completed/cancelled giữ snapshot progress và trả adjusted actual/delta riêng.

## Lifecycle và đóng tháng

- Admin service: draft create/update/delete vĩnh viễn, activate, deadline, allocation tháng sau, cancel và complete.
- `existingGoalAmount` bị kiểm tra với target và số dư workspace lúc activate; sau activate không có write path sửa lại.
- Advisory lock theo workspace khi activate/finish và theo plan khi close month.
- Lazy catch-up đóng tuần tự các tháng bị bỏ lỡ; scheduled worker dùng route `POST /api/internal/financial-plans/close`.
- Month-close idempotent, snapshot có `calculatorVersion = 1.0.0` và tự complete khi đóng deadline đã đủ mục tiêu.
- Deadline mới không được trước tháng hiện tại; tỷ lệ mới có hiệu lực từ tháng kế tiếp và không sửa snapshot đã đóng.

## Kiểm tra

- TypeScript: đạt.
- ESLint phạm vi Phase 6: đạt.
- Unit/integration hiện tại: đạt, 36 file / 154 test.
- Integration database fixture xác nhận: concurrent activation chỉ một lần thành công, ví tạm ngưng vẫn tính, lazy close nhiều tháng theo thứ tự, chạy lại không nhân đôi, snapshot immutable, đủ 6 hũ/100%, deadline → allocation tháng sau → cancel → plan kế tiếp.
- Production build: đạt; route worker được build thành dynamic route.
- Invariant dữ liệu category/transaction sau migration: `0` lỗi (`jar_verify_20260824T093059Z.json`).

## Hạng mục hardening đã ghi nhận

- `pg` hiện phát cảnh báo deprecation khi integration test cố tình chạy hai transaction activation đồng thời trên adapter hiện tại. Kết quả locking/constraint vẫn đúng; cần kiểm tra/nâng adapter khi dependency hỗ trợ ở Phase 8.
- Browser visual QA vẫn chưa chạy được do lỗi trusted-path của browser plugin; tiếp tục giữ trạng thái chưa xác nhận đến Phase 8.
