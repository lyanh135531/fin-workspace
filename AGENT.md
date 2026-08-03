# Felice — Quy ước bắt buộc cho Agent

> **Bắt buộc đọc tài liệu này trước khi phân tích, tạo hoặc chỉnh sửa bất kỳ file nào trong repository.**
> Nếu yêu cầu của người dùng mâu thuẫn với tài liệu này, ưu tiên yêu cầu của người dùng và nêu rõ tác động trước khi thực hiện.

## 1. Nguyên tắc làm việc

- Chỉ thay đổi những phần cần thiết cho yêu cầu. Không refactor hoặc đổi style diện rộng khi chưa được yêu cầu.
- Bảo toàn thay đổi hiện có của người khác trong working tree.
- Kiểm tra các component, token và convention hiện có trước khi tạo mới.
- Sau thay đổi, chạy kiểm tra phù hợp với phạm vi thay đổi (typecheck, lint hoặc test) khi môi trường hỗ trợ.

## 2. Quy chuẩn UI bắt buộc

Giao diện của dự án dựa trên **shadcn/ui + Tailwind CSS**. Mọi thay đổi UI phải tuân theo các quy tắc sau.

### 2.1 Ưu tiên component base

- Luôn dùng component trong `src/components/base/` cho các primitive có sẵn: `Button`, `Card`, `Input`, `Select`, `Tabs`, `Sheet`, `PageHeader`, v.v.
- Không tự tạo lại button, card, input, select, dialog hoặc primitive tương đương khi component base đã đáp ứng được nhu cầu.
- Dùng đúng API có sẵn của component, ví dụ `Button variant="destructive"`, thay vì mô phỏng bằng class Tailwind tự viết.

### 2.2 Không tự custom base component khi không cần thiết

- Không thêm `border-*`, `bg-*`, `text-*`, `ring-*`, `shadow-*`, `rounded-*` vào `Button`, `Card` hoặc primitive base chỉ để thay đổi diện mạo mặc định.
- Không override style của component base bằng CSS global, selector đặc biệt hoặc `!important`.
- Chỉ custom khi có yêu cầu sản phẩm hoặc ngữ nghĩa rõ ràng mà variant hiện có không thể đáp ứng (ví dụ: banner trạng thái `warning`, khu vực cảnh báo có nội dung riêng).
- Khi custom là cần thiết, giữ phạm vi ở component đang dùng; không sửa style nền tảng của toàn bộ ứng dụng nếu người dùng không yêu cầu.
- Với `Card`, không thêm outer `border` hoặc màu nền riêng nếu không có lý do ngữ nghĩa. `Card` đã sở hữu quy tắc viền, nền và dark mode thống nhất.

### 2.3 Bắt buộc dùng semantic design tokens

- Không tự thay đổi giá trị hoặc ý nghĩa của các CSS variable đã được thiết lập trong `src/app/globals.css` nếu không có yêu cầu rõ ràng từ người dùng.
- Không dùng màu khóa cứng như `text-slate-900`, `text-slate-800`, `bg-white`, `border-slate-*` cho nội dung và bề mặt có thể xuất hiện ở dark mode.
- Dùng semantic token hiện có, ưu tiên:
  - Nội dung chính: `text-[var(--foreground)]`
  - Nội dung phụ: `text-[var(--text-secondary)]`
  - Nội dung mờ: `text-[var(--text-muted)]`
  - Nền: `bg-[var(--surface)]`, `bg-[var(--surface-secondary)]`
  - Viền / phân cách: `border-[var(--border)]`
  - Trạng thái: `primary`, `destructive`, `success`, `warning` và các token tương ứng.
- Trước khi thêm token mới hoặc đổi token gốc, xác nhận không có token semantic hiện hữu nào đáp ứng được yêu cầu.

### 2.4 Theo chuẩn shadcn/ui

- Variant, focus state, disabled state, hover state và dark mode phải bám theo quy ước shadcn/ui đang có trong project.
- Với thao tác phá hủy dữ liệu, dùng `Button variant="destructive"`; không dùng nút đỏ tự custom.
- Không biến destructive thành nền đỏ đặc nếu design system hiện tại quy định kiểu tinted (nền đỏ nhạt, chữ/icon đỏ).
- Duy trì accessibility: label rõ ràng, `aria-label` cho icon-only button, focus-visible, độ tương phản đạt WCAG AA và trạng thái disabled dễ nhận biết.

### 2.5 Checklist UI trước khi hoàn tất

- [ ] Đã kiểm tra `src/components/base/` trước khi tạo UI mới.
- [ ] Đã dùng component base và variant hiện có khi phù hợp.
- [ ] Không có màu, border, background hoặc shadow khóa cứng làm hỏng dark mode.
- [ ] Không override token CSS hoặc style mặc định nếu không thật sự cần.
- [ ] Các thao tác destructive dùng đúng variant shadcn.
- [ ] Đã kiểm tra light mode và dark mode đối với phần UI chỉnh sửa.

## 3. Kiến trúc hệ thống

1. **Domain layer:** định nghĩa Zod schema và Prisma type; là nguồn sự thật cho cấu trúc dữ liệu.
2. **Services layer:** nơi duy nhất chứa nghiệp vụ tài chính và cập nhật số dư.
3. **Server Actions layer:** nhận request, xác thực RBAC, gọi service và revalidate khi cần.
4. **Lib/Utils layer:** formatter và helper dùng chung.

Không đưa logic nghiệp vụ hoặc cập nhật số dư vào UI component hay Server Action.

## 4. Tính toàn vẹn dữ liệu tài chính

- Các giá trị tiền tệ (`amount`, `opening_balance`, `current_balance`) dùng `numeric(20,4)` trong database và `Decimal.js` trong TypeScript. Không tính toán bằng `number` hoặc `float`.
- Chuyển input tiền tệ sang `Decimal` tại validation layer bằng Zod transform.
- Mọi thay đổi số dư và ghi giao dịch liên quan phải nằm trong `Prisma.$transaction`.
- Dữ liệu workspace phải cô lập tuyệt đối. Khi truy vấn ví, kiểm tra quyền sở hữu qua `WORKSPACE_WALLET`; không suy diễn workspace từ `WALLETS`.
- Không trả về `password_hash` hoặc dữ liệu nhạy cảm không cần thiết.

## 5. Quy tắc giao dịch và phân quyền

| Trạng thái | Hệ quả số dư |
| --- | --- |
| `pending` | Không thay đổi số dư. |
| `approved` | Cập nhật `current_balance` theo loại giao dịch. |
| `rejected` | Không thay đổi số dư; giữ lịch sử. |

- `income`: tăng số dư ví.
- `expense`: giảm số dư ví.
- `transfer`: bắt buộc có `to_wallet_id`, khác `wallet_id`, và cập nhật hai ví trong một transaction.
- `TRANSACTION.member_id` phải tham chiếu `WORKSPACE_MEMBERS.id`, không phải `USERS.id`.
- Member chỉ tạo giao dịch `pending`; Admin mới được duyệt/từ chối hoặc xử lý thay đổi nhạy cảm.
- Category của giao dịch phải thuộc workspace hiện tại hoặc là category hệ thống (`workspace_id = null`).

## 6. Checklist backend trước khi hoàn tất

- [ ] Đã validate input bằng schema thích hợp.
- [ ] Đã kiểm tra session, role và quyền truy cập workspace.
- [ ] Đã lọc dữ liệu theo workspace tại query/service layer.
- [ ] Đã dùng `Decimal.js` cho mọi tính toán tiền tệ.
- [ ] Đã dùng transaction cho mọi cập nhật số dư hoặc thay đổi đa bảng.
