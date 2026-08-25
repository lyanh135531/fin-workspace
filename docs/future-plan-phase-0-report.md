# Báo cáo Phase 0 — Baseline và rehearsal

> Ngày thực hiện: 2026-08-24  
> Phạm vi đã chạy: PostgreSQL đang được cấu hình trong workspace local. Backup production thật phải được chạy lại tại Phase 8 trước rollout.

## Artifact đã tạo

- Calculator contract vectors: `src/domain/financial-plan/calculator-test-vectors.ts`.
- Contract test: `src/domain/financial-plan/calculator-test-vectors.test.ts`.
- Read-only data audit: `scripts/financial-plan/preflight.sql` và `scripts/run-financial-plan-preflight.sh`.
- Isolated restore rehearsal: `scripts/verify-database-backup.sh`.
- Backup script hỗ trợ cả `flock` trên Linux và atomic lock directory trên Git Bash/Windows.

## Kết quả audit local

- Workspace: `5`.
- Category chưa xóa: `182`.
- Transaction: `302`.
- Blocking issue: `0`.
- Expense transaction thiếu category: `0`.
- Recurring expense active thiếu category: `1`.
- Wallet checksum: `aa7e8f03b61258bb95239de261967542`.
- Transaction checksum: `104619b0825fa099b98482588c1b013c`.

Recurring expense legacy thiếu category sẽ được xử lý ở Phase 3 bằng category workspace `EXPENSE_UNCATEGORIZED` thuộc hũ `ESSENTIAL`.

## Backup/restore rehearsal

- Backup custom-format và SHA-256 được tạo thành công.
- `pg_restore --list` hợp lệ.
- Restore vào database tạm biệt lập thành công.
- Chữ ký nguồn và bản restore trùng nhau:
  - Wallet: `12`.
  - Tổng opening balance: `145500000.0000`.
  - Tổng current balance: `-999999526272234.0000`.
  - Transaction: `302`.
  - Tổng transaction amount: `1000001094202234.0000`.
  - Migration hoàn tất: `18`.
- Database rehearsal đã được xóa; không thay đổi database nguồn.

## Verification

- Calculator vectors: `114` test toàn repository pass.
- TypeScript typecheck: pass.
- Bash syntax check cho script mới: pass.
- ESLint riêng cho calculator artifact mới: pass.
- Full repository lint còn `17` lỗi và `3` warning có sẵn ngoài Phase 0, tập trung trong `.agents/skills`, `footer-clock.tsx`, `settings/page.tsx` và create-workspace UI. Không có lỗi lint từ file Phase 0 mới.

## Exit gate

Phase 0 cho môi trường phát triển đạt yêu cầu. Khi rollout production ở Phase 8, bắt buộc chạy lại preflight, backup và isolated restore rehearsal trên production clone/backup mới nhất trước khi thực hiện migration phá hủy.
