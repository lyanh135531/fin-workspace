# Phase 3 — Backfill và xác minh production-like data

Ngày thực hiện: 2026-08-24

## Kết quả

- Đã thêm migration dữ liệu idempotent `20260824083500_backfill_financial_jars`.
- Đã map category gốc theo bảng nghiệp vụ; category custom về `ESSENTIAL`; category con kế thừa cha.
- Đã snapshot hũ cho toàn bộ expense transaction; income/transfer giữ `jar_code = null`.
- Đã tạo đúng một category `EXPENSE_UNCATEGORIZED`/`ESSENTIAL` cho workspace có recurring expense legacy thiếu category và gắn recurring vào category đó.
- Đã rehearsal trên bản backup, chạy lại riêng backfill lần hai và xác nhận idempotent.
- Đã deploy migration vào database hiện tại và chạy verify/preflight sau migration.

## Đối chiếu tài chính trước/sau

| Chỉ số | Trước | Sau |
| --- | ---: | ---: |
| Wallet | 12 | 12 |
| Transaction | 302 | 302 |
| Tổng transaction amount | 1000001094202234.0000 | 1000001094202234.0000 |
| Tổng opening balance | 145500000.0000 | 145500000.0000 |
| Tổng current balance | -999999526272234.0000 | -999999526272234.0000 |
| Pending / approved / rejected / scheduled | 2 / 293 / 3 / 4 | 2 / 293 / 3 / 4 |

## Invariant sau migration

- Expense category thiếu hũ: `0`.
- Income category có hũ: `0`.
- Expense transaction thiếu snapshot hũ: `0`.
- Income/transfer transaction có snapshot hũ: `0`.
- Category con lệch hũ cha: `0`.
- Expense transaction lệch snapshot tại thời điểm backfill: `0`.
- Recurring expense active thiếu category: `0`.
- Preflight blocking issue: `0`.

## Artifact

- `prisma/migrations/20260824083500_backfill_financial_jars/migration.sql`
- `scripts/financial-plan/verify-jar-backfill.sql`
- `scripts/run-financial-plan-jar-verify.sh`
- `scripts/rehearse-financial-plan-migrations.sh`
- `backups/phase3-prebackfill/fin_workspace_20260824T083923Z_migration_rehearsal.json`
- `backups/phase3-postbackfill/jar_verify_20260824T084326Z.json`
- `backups/phase3-postbackfill/preflight_20260824T084324Z.json`

## Exit gate

Phase 3 đạt toàn bộ exit gate. Có thể chuyển sang Phase 4: xóa fallback tương thích, enforce invariant ở domain/service/UI và cuối cùng thêm database constraint.
