# Kế hoạch triển khai sáu hũ và kế hoạch tài chính tương lai

> Trạng thái: Nghiệp vụ đã chốt, đủ điều kiện triển khai theo phase. Review theo codebase ngày 2026-08-24.  
> Nguồn nghiệp vụ: `docs/future-plan-business.md`.  
> Nguyên tắc rollout: additive migration trước, backfill và xác minh, sau đó mới siết constraint và xóa code cũ.

## 1. Kết luận review

Không nên triển khai toàn bộ tính năng trong một đợt. Phạm vi được chia thành hai nhánh:

1. **Nền tảng sáu hũ và category**: nghiệp vụ chính đã đủ rõ để triển khai.
2. **Kế hoạch tương lai**: nghiệp vụ đã chốt, có thể khóa schema và calculator theo roadmap.

Các điểm code hiện tại ảnh hưởng trực tiếp:

- `Category` đang dùng chung cho category workspace và danh mục mẫu user thông qua `workspaceId`/`userId` nullable.
- `Transaction.categoryId` hiện optional và service chưa kiểm tra type của category khớp type giao dịch.
- Giao dịch chưa lưu hũ snapshot.
- Workspace creation đang ưu tiên sao chép danh mục mẫu user, sau đó mới fallback sang constant mặc định.
- Registration đang tạo danh mục mẫu cho mỗi user.
- Workspace settings vẫn query và render panel import template.
- Header authenticated hiện chỉ có notification; bộ chọn năm color theme đang nằm trong trang Cài đặt chung.
- Mobile bottom navigation hiện đã có bốn destination cộng một nút nhập nhanh ở giữa; thêm Kế hoạch trực tiếp sẽ vượt quá mật độ hợp lý.
- Chưa có test E2E; việc kiểm tra responsive và dark mode hiện phải có checklist thủ công hoặc bổ sung hạ tầng test riêng.

## 2. Quyết định sản phẩm

### 2.1. Đã chốt

- Sáu định nghĩa hũ cố định; không CRUD.
- Tỷ lệ được thiết lập khi tạo kế hoạch, tổng bắt buộc đúng `100%`.
- Tỷ lệ mặc định: Thiết yếu `55%`, Trách nhiệm `10%`, Phát triển `10%`, Hưởng thụ `10%`, Đầu tư `10%`, Cho đi `5%`.
- Thay đổi tỷ lệ sau đó có hiệu lực từ tháng kế tiếp; tháng đã đóng không thay đổi.
- Giao dịch chi mới bắt buộc có category.
- Category không được đổi type Thu/Chi sau khi tạo.
- Category con kế thừa hũ của category cha.
- Giao dịch định kỳ tiêu hạn mức hũ tương ứng.
- Kỳ recurring đã phát sinh giữ snapshot; kỳ tương lai dùng hũ hiện tại của category.
- Tối đa một kế hoạch `active` trong workspace.
- Kế hoạch tính trên toàn bộ ví workspace; transfer nội bộ là dòng tiền ròng bằng `0`.
- Tiến độ được tính ảo từ dữ liệu giao dịch, không chuyển tiền thật.
- Cho nhập `existingGoalAmount`, mặc định `0`, là khoản đã thực sự dành riêng cho mục tiêu; không tự coi toàn bộ số dư ví là tiền mục tiêu.
- Tháng đầu tự tính khả năng chi từ tổng số dư thực tế của toàn bộ ví workspace tại thời điểm tính.
- Tính tháng hiện tại là tháng đầu.
- Actual của tháng đầu lấy từ ngày đầu tháng, kể cả plan được tạo giữa tháng.
- Phần chi thấp hơn hạn mức được tính là đi trước kế hoạch.
- Actual chỉ dùng `approved`; forecast dùng `scheduled` và recurring active; `pending` hiển thị riêng; rejected/deleted bị loại.
- Admin được sửa deadline và hệ thống tính lại; target của plan active không được sửa.
- Mobile mở Kế hoạch từ menu sheet.
- Member chỉ xem; Admin quản lý.
- Category template production cũ bị xóa vĩnh viễn trong contract migration sau backup.

### 2.2. Trạng thái

Không còn product gate mở trong phạm vi hiện tại.

## 3. Thiết kế dữ liệu đề xuất

### 3.1. Mã hũ cố định

Tạo enum/domain constant duy nhất:

```text
ESSENTIAL
RESPONSIBILITY
DEVELOPMENT
ENJOYMENT
INVESTMENT
GIVING
```

Tên hiển thị được map trong domain. Không tạo CRUD cho định nghĩa hũ.

### 3.2. Category và transaction

Mở rộng schema:

```text
CATEGORY.jar_code nullable
TRANSACTION.jar_code nullable
```

Quy tắc:

- Category `expense` cấp gốc: `jar_code` bắt buộc sau backfill.
- Category con được service gán cùng `jar_code` với cha; khi cha đổi hũ, update toàn bộ con trong cùng transaction.
- Category `income`: `jar_code = null`.
- Transaction `expense`: `jar_code` snapshot bắt buộc sau backfill, kể cả giao dịch lịch sử không có category.
- Transaction `income` và `transfer`: `jar_code = null`.
- Client gửi `categoryId`, không gửi `jarCode` khi tạo transaction.
- Service lấy category trong đúng workspace, kiểm tra category type, rồi chụp `jarCode` vào transaction.
- Khi update transaction hoặc duyệt change request, service phải tạo lại snapshot theo category được đề xuất trong cùng transaction database.
- Recurring template tiếp tục giữ `categoryId`; lần phát sinh tiếp theo lấy hũ hiện tại của category và chụp vào transaction mới.

### 3.3. Tỷ lệ hũ theo kế hoạch

Tỷ lệ thuộc kế hoạch và có hiệu lực theo tháng:

```text
PLAN_JAR_ALLOCATION
- financial_plan_id
- jar_code
- percentage numeric(...)
- effective_month
```

Tổng sáu tỷ lệ của cùng plan/kỳ phải bằng `100`, được validate bằng `Decimal` trong service và cập nhật trong một `Prisma.$transaction`. Allocation mới chỉ có hiệu lực từ tháng kế tiếp; allocation của tháng đã đóng được giữ để bảo toàn lịch sử.

### 3.4. Kế hoạch tương lai

Model tối thiểu đề xuất:

```text
FINANCIAL_PLAN
- id
- workspace_id
- name
- target_amount numeric(20,4)
- existing_goal_amount numeric(20,4)
- start_month
- target_month
- status (draft | active | completed | cancelled)
- created_by_member_id
- created_at / updated_at / deleted_at
```

Database phải enforce tối đa một plan `active` cho mỗi workspace bằng unique partial index hoặc cơ chế lock + constraint tương đương.

`existing_goal_amount` mặc định `0`, phải là số nguyên VND, không âm, không lớn hơn `target_amount` và không lớn hơn `max(currentWorkspaceBalance, 0)` tại thời điểm kích hoạt. Trường này được khóa khi plan đã `active`.

`at_risk`, `overdue`, `ahead`, `on_track`, `behind` và `goal_reached` là health được calculator suy ra, không lưu chung trong cột lifecycle status.

Không lưu `number` cho tiền. Mọi phép tính nằm trong service và dùng `Decimal.js`.

Lịch tháng hiện tại/tương lai được tính deterministic từ plan + transactions + recurring rules. Tháng đang mở không dùng snapshot làm nguồn sự thật.

Snapshot tháng đóng là bắt buộc:

```text
FINANCIAL_PLAN_MONTH
- id
- financial_plan_id
- month
- base_required_amount numeric(20,4)
- adjusted_required_amount numeric(20,4)
- raw_gross_budget numeric(20,4)
- allocatable_gross_budget numeric(20,4)
- resource_shortfall numeric(20,4)
- closed_actual_amount numeric(20,4)
- closed_at
- calculator_version

FINANCIAL_PLAN_MONTH_JAR
- financial_plan_month_id
- jar_code
- percentage numeric(...)
- allocated_amount numeric(20,4)
- closed_actual_amount numeric(20,4)
```

Database enforce unique `(financial_plan_id, month)` và `(financial_plan_month_id, jar_code)`. Snapshot giữ nguyên kết quả tại lúc đóng. Actual hiện tại của tháng lịch sử vẫn được tính từ ledger; nếu có backdate, UI hiển thị delta so với `closed_actual_amount`, còn calculator dùng actual mới để tính lại tháng chưa đóng.

### 3.5. Quy tắc calculator bắt buộc

- `remainingTarget = max(targetAmount - existingGoalAmount, 0)`.
- `existingGoalAmount <= min(targetAmount, max(currentWorkspaceBalance, 0))` tại lúc kích hoạt.
- Tháng đầu dùng `currentWorkspaceBalance - existingGoalAmount`, cộng forecast thu còn lại, trừ forecast chi còn lại và khoản mục tiêu; không yêu cầu người dùng nhập số tiền đang có và không cho chi lại khoản đã dành sẵn.
- Khi tái tạo hạn mức hũ gộp tháng đầu, cộng lại expense approved từ đầu tháng rồi trừ chúng đúng một lần ở actual theo hũ.
- Tháng sau dùng forecast income trừ khoản mục tiêu để tạo hạn mức hũ gộp; recurring/scheduled expense tiêu hạn mức hũ, không bị trừ hai lần.
- Occurrence recurring đã materialize được nhận diện bằng khóa kỳ ổn định và bị loại khỏi forecast recurring tương ứng.
- Phân bổ tiền lấy xuống đến VND. Dư tỷ lệ hũ vào `ESSENTIAL`; dư chia theo tháng vào tháng cuối.
- `allocatableGrossBudget = max(rawGrossBudget, 0)` và `resourceShortfall = max(-rawGrossBudget, 0)`; chỉ giá trị không âm được phân bổ vào hũ.
- Hũ riêng lẻ được phép có remaining âm và hiển thị cảnh báo; hệ thống không tự chuyển hạn mức giữa hũ.
- `budgetVariance = allocatableGrossBudget - eligibleExpense - resourceShortfall`.
- `actualGoalAmountForMonth = max(requiredGoalAmount + budgetVariance, 0)`.
- Vượt một hũ nhưng tổng tháng không vượt và không có `resourceShortfall` thì không tạo carry; thiếu hụt nguồn lực luôn làm giảm tiến độ dù chưa phát sinh expense.
- `realizedProgress` chỉ gồm `existingGoalAmount` và các tháng đã đóng. Tháng đang mở trả `projectedEndOfMonthProgress` riêng; underspend chỉ ghi nhận khi đóng tháng.
- `adjustedRequiredAmount` của từng tháng chưa đóng được reforecast tuần tự từ `projectedProgress` mới nhất. Vì vậy giao dịch/số dư/recurring thay đổi trong tháng đang mở phải lập tức làm thay đổi khoản phải dành của các tháng sau, nhưng không biến projection thành realized progress.
- Calculator dùng timezone của workspace để xác định ngày đầu tháng, cuối tháng và kỳ recurring.

## 4. Roadmap thực thi theo phase

Không được đổi thứ tự các phase dữ liệu. Production bắt buộc đi theo chuỗi `expand → dual-write → backfill → verify → enforce → contract` để code cũ và code mới cùng chạy an toàn trong lúc rollout.

### Phase 0 — Baseline, backup và rehearsal

**Phạm vi**

- Khóa công thức nghiệp vụ thành calculator test vectors trước khi sửa schema.
- Chụp backup production và kiểm tra quy trình restore.
- Thống kê category/transaction theo workspace, type, category, code, status và deleted state.
- Kiểm tra transaction tham chiếu category global hoặc category khác workspace.
- Kiểm tra cây category: orphan parent, parent khác workspace, cycle và cha-con khác type.
- Viết script preflight, backfill, verify và dry-run report; rehearsal trên production clone.

**Exit gate**

- Backup restore thành công.
- Preflight không còn lỗi cấu trúc chưa xử lý.
- Có checksum baseline cho amount, opening balance, current balance và workflow status.
- Test vectors nghiệp vụ đã được review và cố định.

### Phase 1 — Expand schema sáu hũ

**Phạm vi**

- Thêm enum sáu mã hũ cố định.
- Thêm `CATEGORY.jar_code` nullable và `TRANSACTION.jar_code` nullable.
- Thêm index phục vụ backfill/report; chưa thêm `NOT NULL` hoặc constraint cuối.
- Generate Prisma client và deploy schema backward-compatible.
- Không xóa `CATEGORY.user_id`, template data, route hoặc service cũ.

**Exit gate**

- Phiên bản ứng dụng đang chạy trước migration vẫn hoạt động với schema mới.
- Migration expand chạy được trên production clone trong thời gian chấp nhận được.
- Không có thay đổi dữ liệu tài chính.

### Phase 2 — Dual-write domain và service

**Phạm vi**

- Thêm domain constant/schema cho sáu hũ; không có API CRUD hũ.
- Mọi category expense mới được ghi `jar_code`; trong cửa sổ tương thích, request từ UI cũ thiếu hũ tạm fallback `ESSENTIAL` và phải ghi audit/metric.
- Category con luôn lấy hũ từ cha; đổi hũ cha cập nhật toàn bộ descendants atomically.
- Transaction expense mới chụp snapshot từ category; transaction legacy thiếu category tạm fallback `ESSENTIAL` trong cửa sổ tương thích.
- Transaction update, change-request approval và recurring posting đều dual-write snapshot trong cùng `Prisma.$transaction`.
- Income/transfer luôn ghi `jar_code = null`.
- Cấm đổi category type; thêm quy tắc recurring reference và workspace isolation.
- Workspace seeding/copy path hiện tại phải truyền được `jar_code`, nhưng chưa xóa template flow.

Fallback tương thích chỉ tồn tại đến Phase 4; không được coi là hành vi sản phẩm cuối.

**Exit gate**

- Mọi write path mới không tạo thêm expense có `jar_code = null`.
- Metric fallback được theo dõi và không có cross-workspace reference mới.
- Unit/integration test cho create/update/approval/recurring đều qua.

### Phase 3 — Backfill, verify và chuẩn hóa production

**Phạm vi**

- Income category → `jar_code = null`.
- Expense root mapping theo bảng đã chốt; custom root → `ESSENTIAL`.
- Category con kế thừa cha sau khi root mapping hoàn tất.
- Expense transaction có category lấy snapshot từ category; không category → `ESSENTIAL`.
- Income/transfer transaction → `jar_code = null`.
- Với mỗi workspace có recurring expense legacy thiếu category, tạo idempotent root category `EXPENSE_UNCATEGORIZED` thuộc `ESSENTIAL` rồi gắn các recurring đó vào category vừa tạo.
- Chạy theo batch có checkpoint, idempotent và quan sát được; không tạo allocation cho workspace chưa có plan.

**Exit gate**

- Expense category và expense transaction còn `jar_code IS NULL` bằng `0`.
- Income/transfer có `jar_code IS NOT NULL` bằng `0`.
- Recurring expense còn `category_id IS NULL` bằng `0` sau migration.
- Không còn lỗi hierarchy hoặc workspace isolation.
- Checksum amount/balance/workflow trước và sau giống nhau.
- Dual-write tiếp tục giữ các invariant trong suốt thời gian verify.

### Phase 4 — Enforce sáu hũ và hoàn thiện Category UI

**Phạm vi**

- Form expense root bắt buộc chọn hũ; income ẩn field; category con hiển thị hũ kế thừa read-only.
- Expense transaction mới bắt buộc category; xóa fallback tương thích của Phase 2.
- UI không cho đổi type hoặc CRUD sáu hũ.
- Hiển thị hũ bằng text + icon/semantic state, không chỉ dựa vào màu.
- Chặn xóa/vô hiệu hóa category theo transaction/recurring dependency.
- Sau khi app enforcement đã deploy và verify, thêm database CHECK/NOT NULL phù hợp với từng transaction/category type.
- Kiểm tra mobile, desktop, light/dark, keyboard, focus và error feedback.

**Exit gate**

- Metric fallback Phase 2 bằng `0` trước khi xóa fallback.
- Không thể tạo expense/category sai invariant qua UI, action hoặc gọi service trực tiếp.
- Snapshot cũ không đổi khi category chuyển hũ.
- Database constraint được rehearsal và không khóa bảng ngoài ngưỡng vận hành.

### Phase 5 — Loại bỏ template/import và dọn General Settings

**Phạm vi A — Category source**

- Đổi constant template thành workspace seed kèm `jarCode`.
- Registration ngừng tạo category template cá nhân.
- Workspace creation luôn seed category mặc định trực tiếp trong transaction tạo workspace.
- Xóa UI/query/action/service import và toàn bộ copy/onboarding liên quan.
- Deploy code không còn đọc `CATEGORY.user_id`; giữ column/data deprecated đến Phase 8.

**Phạm vi B — Appearance/navigation**

- Tách đầy đủ năm color theme + light/dark thành component dùng lại được.
- Đưa trigger vào authenticated header với accessible name, keyboard và focus management.
- Xóa menu/trang Cài đặt chung; giữ Cài đặt workspace.
- Route cũ dùng redirect có thời hạn nếu cần tương thích bookmark production.

**Exit gate**

- Workspace mới luôn có đúng bộ category workspace và hũ mặc định.
- Không còn consumer runtime của template/import hoặc `CATEGORY.user_id`.
- Appearance hoạt động đúng trên mobile/desktop và light/dark.
- Chưa xóa dữ liệu template production trong phase này.

### Phase 6 — Financial plan schema và calculator engine

**Phạm vi dữ liệu**

- Thêm `FINANCIAL_PLAN`, `PLAN_JAR_ALLOCATION`, `FINANCIAL_PLAN_MONTH` và `FINANCIAL_PLAN_MONTH_JAR`.
- Unique partial index bảo đảm một plan active/workspace; unique plan-month và month-jar.
- Dùng advisory lock theo workspace khi activate và theo plan khi close month.
- Thêm audit cho activate, deadline, allocation, close, complete và cancel.

**Phạm vi calculator**

- Implement toàn bộ công thức trong tài liệu nghiệp vụ bằng `Decimal.js` và số nguyên VND.
- Tháng đầu lấy mọi ví chưa xóa qua `WORKSPACE_WALLET`, gồm ví tạm ngưng.
- Tách raw/allocatable gross, `resourceShortfall`, jar remaining, total overspend và jar overspend.
- Tách `realizedProgress` khỏi `projectedEndOfMonthProgress`.
- Expand recurring theo timezone, loại occurrence đã materialize và loại transfer nội bộ.
- Thực hiện redistribution, rounding, deadline edit, health và lifecycle.
- Backdate active plan carry delta vào tháng mở; completed/cancelled chỉ hiển thị adjusted actual.

**Phạm vi đóng tháng**

- Scheduled job idempotent theo timezone workspace.
- Lazy catch-up trước mọi plan read/write; đóng tuần tự tháng bị bỏ lỡ.
- Snapshot immutable và có `calculator_version`.

**Exit gate**

- Toàn bộ calculator vectors, boundary, concurrency và idempotency test qua.
- Cùng input luôn tạo cùng output; không double count recurring/scheduled.
- Chưa expose UI quản lý plan nếu engine chưa qua test production-like dataset.

### Phase 7 — Actions, RBAC và giao diện kế hoạch

**Phạm vi backend**

- Server Actions chỉ validate/authenticate/RBAC, gọi service và revalidate.
- Admin quản lý; Member chỉ xem.
- API/view-model trả lifecycle, derived health, realized/projected progress, shortfall, lịch tháng và sáu hũ.

**Phạm vi UI**

- Màn empty state, create draft, review/activate, active detail, month history, edit deadline, future allocation, cancel/complete.
- Hiển thị riêng đã ghi nhận và dự kiến cuối tháng; phân biệt jar overspend với plan shortfall.
- Desktop thêm Kế hoạch vào navigation; mobile chỉ thêm vào menu sheet.
- Khi không có plan active, báo cáo hũ vẫn hoạt động nhưng không có hạn mức/carry.
- Dùng base components hiện có, semantic tokens, không shadow; kiểm tra accessibility và responsive.

**Exit gate**

- RBAC, workspace isolation, stale form/concurrency và destructive confirmation test qua.
- Mobile 375px, desktop, light/dark và keyboard flow được kiểm tra.
- Không có business calculation trong component hoặc Server Action.

### Phase 8 — Hardening, production rollout và contract cleanup

**Rollout**

- Chạy full regression, build và migration rehearsal lần cuối.
- Deploy theo canary/controlled rollout; theo dõi fallback, null jar, close-month failure, calculator mismatch, job latency và query performance.
- Chuẩn bị rollback theo từng deploy; không rollback schema bằng thao tác phá hủy.
- Đối soát một tập workspace production với calculator offline/read-only.

**Contract cleanup sau thời gian quan sát**

- Backup và thống kê category template cũ.
- Xóa vĩnh viễn template rows sau khi xác minh không còn consumer.
- Xóa relation `User.categoryTemplates`, `CATEGORY.user_id` và index cũ.
- Chuyển unique category thành `(workspace_id, code)` và xử lý toàn bộ global category còn lại.
- Xóa redirect/route compatibility chỉ sau thời hạn đã công bố.
- Cập nhật runbook, migration report và tài liệu vận hành month-close job.

**Exit gate**

- Không còn null/sai jar, consumer template hoặc lỗi month-close tồn đọng.
- Balance và workflow không đổi ngoài giao dịch hợp lệ.
- Restore/rollback runbook đã được xác minh.
- Chỉ đánh dấu hoàn thành khi production qua ít nhất một chu kỳ đóng tháng thành công.

## 5. Test bắt buộc

### Migration/data integrity

- Rehearsal migration trên production clone.
- Migration abort và xuất report khi có orphan parent, cross-workspace parent, cycle hoặc category hierarchy khác type.
- Recurring expense legacy thiếu category được gắn idempotent vào `EXPENSE_UNCATEGORIZED`/`ESSENTIAL` đúng workspace.
- Assert mapping từng default code và fallback custom → `ESSENTIAL`.
- Assert category con luôn nhận hũ của cha, kể cả code của con khớp một mapping khác.
- Assert transaction không category → `ESSENTIAL`.
- So sánh checksum/tổng tiền và balance trước/sau migration.
- Assert workspace isolation cho category, transaction và allocation.

### Domain/service

- Category expense bắt buộc hũ; income cấm hũ.
- Category con nhận hũ từ cha; đổi hũ cha cập nhật con atomically.
- Category type luôn immutable sau khi tạo.
- Chặn deactivate/delete category theo quy tắc transaction và recurring reference.
- Category type phải khớp transaction type.
- User không thể gửi giả `jarCode` để ghi vào transaction.
- Snapshot không đổi khi category đổi hũ.
- Transaction update/change approval lấy snapshot mới đúng lúc.
- Recurring posting lấy hũ hiện tại và không tạo trùng occurrence.
- Member/Admin workflow vẫn giữ nguyên.
- Calculator dùng Decimal cho target, tỷ lệ, thiếu hụt và rounding tháng cuối.
- `existingGoalAmount` mặc định `0`, bị khóa sau activate, không vượt target và không vượt số dư thực tế lúc kích hoạt.
- Tháng đầu dùng số dư ví thực tế; không coi toàn bộ số dư là `existingGoalAmount`.
- Tháng đầu loại `existingGoalAmount` khỏi số dư được phép chi để không đếm cùng một khoản tiền hai lần.
- Aggregator plan gồm ví tạm ngưng chưa xóa; wallet settlement transfer không đổi dòng tiền ròng.
- Giao dịch approved từ đầu tháng không bị tính trùng khi tái tạo hạn mức tháng đầu.
- Recurring/scheduled expense tiêu hạn mức hũ đúng một lần.
- Mọi hạn mức tiền là số nguyên VND; dư hũ vào `ESSENTIAL`, dư tháng vào tháng cuối.
- Raw gross âm tạo allocation `0` và `resourceShortfall` đúng, không tạo jar allocation âm.
- `resourceShortfall` làm giảm `actualGoalAmountForMonth` ngay cả khi expense bằng `0`.
- Khi `resourceShortfall = 0`, vượt một hũ nhưng không vượt tổng chỉ cảnh báo hũ; không tạo thiếu hụt/carry mục tiêu.
- `realizedProgress` không ghi nhận underspend tháng đang mở; projection cuối tháng hiển thị riêng.
- Overspend nhiều tháng liên tiếp, underspend, tháng không khả thi và deadline.
- Không double count recurring/scheduled transaction.
- Backdated change chỉ carry delta sang tháng mở; snapshot tỷ lệ/hạn mức tháng đóng không đổi.
- Backdated change sau completed/cancelled không reopen và không ảnh hưởng plan mới.
- Month close idempotent, chống race, lazy catch-up và đóng đúng thứ tự khi bỏ lỡ nhiều tháng.
- Unique plan-month/jar snapshot và concurrent activation không tạo bản ghi trùng.
- Lifecycle và derived health hoạt động độc lập, gồm đạt sớm và quá hạn.
- Không có active plan thì chỉ phân loại/báo cáo hũ, không tính hạn mức.

### UI và regression

- Category create/edit trên mobile và desktop.
- Theme + mode trong header ở light/dark.
- Sidebar, mobile navigation, breadcrumb và deep link sau khi bỏ Cài đặt chung.
- Viewport tối thiểu 375px và desktop convention hiện có.
- `aria-label`, keyboard navigation, focus-visible và error feedback.
- Không thêm shadow, màu hard-code phá dark mode hoặc override diện mạo base component.

### Command verification

```text
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## 6. Tiêu chí hoàn thành

- Mọi category expense production có đúng một hũ; income không có hũ.
- Mọi transaction expense có snapshot hũ; lịch sử không đổi khi category đổi hũ.
- Sáu hũ không có API hoặc UI CRUD.
- Workspace mới nhận đúng category mặc định và mapping hũ trong cùng transaction tạo workspace.
- Không còn registration/template/import flow hoặc consumer của `CATEGORY.user_id`.
- Không còn Cài đặt chung; appearance đầy đủ nằm ở authenticated header.
- Balance và workflow giao dịch không thay đổi do migration hũ.
- Engine kế hoạch cho kết quả deterministic, Decimal-safe và không double count.
- Tháng đầu phản ánh đúng tổng số dư ví thực tế nhưng không nhập nhằng với tiền đã dành sẵn cho mục tiêu.
- Tiến độ đã ghi nhận và dự kiến cuối tháng không bị trộn thành một con số.
- Lifecycle, health, rounding VND và carry từ tháng đóng tuân thủ tài liệu nghiệp vụ.
- Mobile, desktop, light mode và dark mode đã được kiểm tra.

## 7. Thứ tự PR khuyến nghị

1. PR preflight/rehearsal tooling + calculator test vectors.
2. PR jar schema expand nullable.
3. PR jar dual-write domain/services + compatibility metrics.
4. PR idempotent backfill/verify tooling và production runbook.
5. PR final jar enforcement + category/transaction UI + database constraints.
6. PR workspace seed + remove template/import runtime code, chưa contract database.
7. PR appearance header + remove General Settings navigation/routes.
8. PR financial-plan schema + pure calculator + snapshot models.
9. PR month-close engine/job + actions/RBAC.
10. PR financial-plan UI/query/navigation.
11. PR observability/hardening và contract cleanup sau thời gian theo dõi.

Không gộp schema expand, backfill và contract migration trong cùng một PR/deploy. Không gộp contract cleanup với engine kế hoạch. Mỗi deploy phải có rollback boundary độc lập.
