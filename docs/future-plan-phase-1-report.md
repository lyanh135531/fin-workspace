# Báo cáo Phase 1 — Expand schema sáu hũ

> Ngày thực hiện: 2026-08-24  
> Migration: `20260824081000_expand_financial_jars`.

## Thay đổi

- Thêm PostgreSQL/Prisma enum `JAR_CODE` với sáu giá trị cố định.
- Thêm `CATEGORY.jar_code` nullable.
- Thêm `TRANSACTION.jar_code` nullable.
- Thêm index category theo workspace/type/jar và transaction theo jar/date.
- Chưa thêm constraint cuối, chưa backfill và chưa xóa code legacy.

## Verification

- Prisma generate: pass.
- TypeScript typecheck: pass.
- Test: `114/114` pass.
- Migration deploy trên PostgreSQL local: pass.
- Hai cột mới đều nullable và toàn bộ row cũ vẫn `null`, đúng chiến lược expand.
- Sáu enum value trong database đúng thứ tự đã chốt.
- Preflight sau migration: `0` blocking issue.
- Wallet checksum, transaction checksum, opening/current balance và tổng transaction amount không đổi so với Phase 0.

## Exit gate

Phase 1 hoàn tất. Schema mới backward-compatible và sẵn sàng cho dual-write Phase 2.
