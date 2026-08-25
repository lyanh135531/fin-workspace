# Runbook rollout kế hoạch tài chính

## 1. Trước deploy

1. Tạo backup bằng `scripts/backup-database.sh`; giữ lại đường dẫn dump và SHA-256.
2. Chạy preflight/contract audit trên production clone.
3. Rehearsal toàn bộ migration từ database baseline và chạy restore test.
4. Chạy typecheck, full test, production build và calculator integration test.
5. Đối chiếu `financialSignature` trước/sau: transaction count/amount, wallet opening/current balance và workflow counts phải giống nhau.

## 2. Thứ tự deploy

1. Deploy migration expand/backfill/enforce của sáu hũ.
2. Deploy application dual-write rồi kiểm tra invariant bằng `run-financial-plan-jar-verify.sh`.
3. Deploy schema/engine kế hoạch và route worker.
4. Deploy UI cho một nhóm canary nội bộ trước.
5. Khi canary ổn định, bật `financial-plan-worker` và mở UI cho toàn bộ workspace.
6. Contract cleanup template/global chỉ chạy sau backup và `contract_audit.safeToContract = true`.

Không rollback schema bằng cách drop table/column ngược. Nếu application mới lỗi, rollback image ứng dụng về bản tương thích với schema mở rộng; giữ nguyên migration đã chạy.

## 3. Theo dõi

Chạy `scripts/run-financial-plan-health-check.sh` ít nhất mỗi 5 phút trong ngày đầu và sau thời điểm đầu tháng của từng timezone đang dùng.

Alert ngay khi một giá trị sau lớn hơn `0`:

- `overdueMonthClosures`;
- `calculatorVersionMismatches`;
- `invalidAllocationSets`;
- `nullExpenseCategoryJars`;
- `nullExpenseTransactionJars`.

Theo dõi thêm log `[financial-plan-worker]`, HTTP 5xx của `/api/internal/financial-plans/close`, latency database và thời gian transaction month-close. Không log secret hoặc dữ liệu số dư chi tiết.

## 4. Đối soát canary

Với từng workspace canary:

1. Tính offline/read-only cùng calculator version từ target, existing goal, số dư toàn bộ ví, approved/scheduled và recurring.
2. So sánh required amount, raw/allocatable gross, resource shortfall, sáu allocation, realized và projected progress.
3. Xác nhận transfer ròng bằng `0` và recurring materialized không bị đếm đôi.
4. Sai khác dù `1 VND` phải dừng rollout và giữ plan ở read-only cho đến khi xác định nguyên nhân.

## 5. Xử lý sự cố

- Worker trễ: sửa worker rồi gọi endpoint một lần; lazy catch-up và advisory lock sẽ đóng tuần tự, idempotent.
- Calculator mismatch: không sửa snapshot đã đóng; dừng activation mới, đối soát input/version và phát hành calculator version mới có migration rõ ràng.
- UI lỗi: rollback image application; schema mới vẫn giữ tương thích dữ liệu.
- Cần phục hồi do contract cleanup: dừng app/workers và dùng `scripts/restore-database.sh` với dump đã xác minh. Restore sẽ làm mất mọi write sau thời điểm backup, nên chỉ thực hiện khi đã phê duyệt sự cố dữ liệu.

## 6. Gate hoàn tất production

Không đánh dấu rollout production hoàn thành trước khi:

- canary qua đối soát;
- không có health issue tồn đọng;
- ít nhất một chu kỳ month-close production thực tế thành công;
- mobile/desktop/light/dark/keyboard visual QA đạt;
- thời hạn giữ redirect compatibility đã kết thúc hoặc redirect được quyết định giữ lại.
