# Báo cáo Phase 2 — Dual-write sáu hũ

> Ngày thực hiện: 2026-08-24

## Domain và category

- Thêm sáu jar code cố định, mapping category production và fallback compatibility `ESSENTIAL`.
- Category schema nhận `jarCode` optional trong cửa sổ tương thích.
- Default category, workspace copy, template/global/import write path đều ghi jar.
- Category con luôn lấy jar của cha; client jar của category con bị bỏ qua.
- Đổi jar cha cập nhật con trong cùng transaction.
- Cấm đổi type category sau khi tạo.
- Chặn deactivate category có recurring active và chặn delete category có transaction/recurring reference.
- Audit category create/update ghi jar và trạng thái fallback.

## Transaction và recurring

- Transaction create, approved create, update, change approval, pending approval và scheduled activation đều chụp `jar_code` từ category.
- Recurring occurrence lấy jar hiện tại của category khi materialize.
- Legacy expense thiếu category hoặc category chưa backfill tạm ghi `ESSENTIAL` và audit `jarFallback`.
- Income/transfer ghi `jar_code = null`; wallet settlement transfer cũng ghi null rõ ràng.
- Category type phải khớp transaction type và phải thuộc đúng workspace.

## Verification

- Prisma generate: pass.
- TypeScript typecheck: pass.
- Test: `127/127` pass.
- ESLint cho toàn bộ domain/service/test thay đổi: pass.
- Production build: pass sau khi cho phép tải Google Fonts.
- Test mới bao phủ fixed jar codes, mapping, child inheritance, category type immutability, recurring dependency guard, transaction snapshot, legacy fallback và workspace default mapping.

## Exit gate

Phase 2 hoàn tất ở mức code. Mọi write path mới đã dual-write; fallback compatibility được giữ đến khi Phase 3 backfill và Phase 4 UI enforcement hoàn tất.
