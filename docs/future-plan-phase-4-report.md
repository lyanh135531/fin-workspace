# Phase 4 — Enforce sáu hũ và Category/Transaction UI

Ngày thực hiện: 2026-08-24

## Kết quả

- Category expense cấp gốc bắt buộc chọn một trong sáu hũ cố định.
- Category expense con luôn kế thừa hũ cha; client không quyết định hũ riêng.
- Category income cấm hũ; type Thu/Chi tiếp tục immutable.
- Expense transaction và recurring expense bắt buộc category ở schema, service và UI.
- Transaction service không còn fallback `ESSENTIAL`; snapshot chỉ lấy từ category hợp lệ.
- Form Category hiển thị trường hũ bắt buộc cho root, trạng thái kế thừa read-only cho child và ẩn hũ với income.
- Danh sách Category hiển thị tên hũ kèm icon, không truyền đạt bằng màu đơn thuần.
- Các form tạo/sửa transaction và recurring đánh dấu category expense là bắt buộc và không còn lựa chọn “Không chọn”.
- Đã thêm ba database CHECK constraint được tạo `NOT VALID`, sau đó `VALIDATE`:
  - `CATEGORY_type_jar_code_check`
  - `TRANSACTION_type_category_jar_check`
  - `RECURRING_TRANSACTION_type_category_check`

## Migration và data integrity

- Backup trước enforce: `backups/phase4-preenforce/fin_workspace_20260824T085437Z.dump`.
- Rehearsal migration thành công trên database restore tạm.
- Migration `20260824090000_enforce_financial_jars` deploy thành công.
- Negative-write test xác nhận database từ chối jar/category sai invariant.
- Verify sau enforce: `invariantIssueCount = 0`.
- Báo cáo: `backups/phase4-postenforce/jar_verify_20260824T085727Z.json`.

## Verification

- `pnpm prisma:generate`: pass.
- `pnpm typecheck`: pass.
- `pnpm test`: 31 files, 134 tests pass.
- ESLint toàn bộ file Phase 4, trừ `settings/page.tsx`: pass.
- `settings/page.tsx` còn lỗi lint có sẵn do `Math.random()` tạo invite code trong server render; thay đổi Phase 4 tại file này chỉ thêm `jarCode` vào view-model.
- `pnpm build`: pass.
- `git diff --check`: pass, chỉ có cảnh báo line ending của working tree.

## Browser QA

Không thể chạy kiểm tra tương tác trong in-app browser vì browser plugin từ chối chính dependency của nó do trusted-path configuration. Đây là lỗi hạ tầng kiểm thử, không phải lỗi build/runtime được quan sát. Checklist 375px, desktop, keyboard và light/dark được giữ lại cho Phase 8 để chạy lại khi browser control khả dụng; không ghi nhận giả là đã pass.

## Exit gate

Code, service, database constraint, migration rehearsal và automated gate đã hoàn tất. Browser visual QA được chuyển nguyên trạng sang hardening gate Phase 8.
