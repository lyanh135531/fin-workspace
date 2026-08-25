# Phase 8 — Hardening, contract cleanup và rollout readiness

## Contract cleanup

- Đã backup trước contract và xác minh SHA-256: `backups/fin_workspace_20260824T094951Z.dump`.
- Contract audit xác nhận an toàn trước khi xóa: 113 template cá nhân, 6 category global, không có transaction/recurring/child reference ngoài workspace.
- Migration `20260824111000_contract_category_templates` đã xóa vĩnh viễn template/global rows, bỏ `CATEGORY.user_id`, bắt buộc `workspace_id` và đổi unique sang `(workspace_id, code)`.
- Hai category soft-deleted trùng code được giữ lại với code nội bộ `__DELETED__...`; không làm mất lịch sử.
- Backup hậu contract `backups/fin_workspace_20260824T100118Z.dump` đã được restore rehearsal thành công.
- Contract verify cuối: `contract_verify_20260825T012925Z.json`, `issueCount = 0`, còn 68 category workspace hợp lệ.

## Migration, backup và rollback

- Rehearsal đã chạy đúng thứ tự restore → legacy backfill → build/deploy contract → verify, dùng image migration được build lại từ source hiện tại.
- Sửa backup lock để luôn dọn `.backup.lock.d` trên success; restore script quản lý cả recurring worker và financial-plan worker.
- `prisma migrate status`: 23 migration source, database up to date.
- Docker Compose config, cú pháp hai Node worker và toàn bộ Bash operation script đều hợp lệ.
- Runbook rollout/monitor/incident nằm tại `docs/future-plan-rollout-runbook.md`.

## Browser QA

- Workspace/user QA cô lập được tạo chỉ cho smoke test và đã xóa sau kiểm tra.
- Desktop `1440×1000`, mobile `390×844`, dark mode và light-mode switch đã được kiểm tra thực tế.
- Vector nghiệp vụ chính hiển thị đúng tuyệt đối đến 1 VND: mục tiêu 100 triệu/10 tháng từ số dư thực tế 20 triệu tạo required 10 triệu, allocatable 10 triệu và phân bổ sáu hũ 55/10/10/10/10/5.
- Empty state, editor, ratio total 100%, draft review, activation, plan timeline, mobile menu sheet và appearance controls đều render đúng.
- Browser QA phát hiện và giúp sửa consumer `userId: null` còn sót trong workspace seeding sau contract migration.

## Gate kỹ thuật cuối

- Prisma generate: đạt.
- TypeScript: đạt.
- Unit/integration: 36 file, 154/154 test đạt.
- ESLint toàn bộ file thay đổi: đạt.
- Production build: đạt; có `/financial-plans`, `/dashboard/financial-plans` và `/api/internal/financial-plans/close`.
- `git diff --check`: đạt.
- Jar invariant: `jar_verify_20260825T012925Z.json`, 0 issue.
- Operational health: `health_20260825T012925Z.json`, 0 issue, không còn fixture/active plan QA.

Full-repository lint vẫn thất bại do 16 lỗi `require()` trong `.agents/skills/*` và lỗi `react-hooks/set-state-in-effect` có sẵn tại `src/app/dashboard/footer-clock.tsx`; các file thay đổi của feature không có lint error.

## Gate production còn phụ thuộc môi trường ngoài repository

Code, migration, dữ liệu local, rehearsal và rollout tooling đã sẵn sàng. Không được đánh dấu rollout production hoàn tất cho đến khi có đủ:

- deployment canary vào production thật;
- đối soát calculator trên workspace production đã chọn;
- monitoring không phát sinh issue;
- ít nhất một chu kỳ month-close production thực tế thành công.

Các gate này không thể được giả lập hoặc tự tuyên bố đạt từ workspace local.
