# Nghiệp vụ lập kế hoạch tài chính tương lai

> Trạng thái: Nghiệp vụ đã chốt, đủ điều kiện thiết kế chi tiết và triển khai.  
> Kế hoạch kỹ thuật: `docs/future-plan-implementation-plan.md`.

## 1. Mục tiêu

Một workspace có thể lập kế hoạch cần đạt một số tiền xác định vào một tháng trong tương lai. Hệ thống phải:

1. Tính khoản bắt buộc phải dành cho mục tiêu mỗi tháng.
2. Tính hạn mức còn được phép chi mà không phá kế hoạch.
3. Phân bổ hạn mức chi vào sáu hũ tài chính cố định.
4. Cho mọi giao dịch chi tiêu thụ hạn mức hũ theo category.
5. Dồn phần chi vượt hoặc phần chi thiếu sang các tháng còn lại.
6. Cảnh báo khi kế hoạch không khả thi với dòng tiền dự kiến.

## 2. Phạm vi và phân quyền

- Mỗi kế hoạch thuộc đúng một workspace và tính trên toàn bộ ví thuộc workspace đó.
- Transfer giữa các ví trong cùng workspace có dòng tiền ròng bằng `0`.
- Tại một thời điểm, mỗi workspace chỉ có tối đa một kế hoạch `active`.
- Admin được tạo, kích hoạt, sửa các trường được phép, hủy và kết thúc kế hoạch.
- Member chỉ được xem.
- Tiến độ là số liệu ảo; hệ thống không chuyển hoặc khóa tiền thật trong ví.

## 3. Các khái niệm tiền tệ

### 3.1. Số tiền mục tiêu

Tổng số tiền workspace muốn có khi đến hạn, ví dụ `100.000.000` đồng sau 10 tháng.

### 3.2. Tiền đã dành sẵn cho mục tiêu

`existingGoalAmount` là khoản tiền thực tế đã được người dùng xác nhận dành riêng cho mục tiêu trước khi kế hoạch bắt đầu.

- Mặc định bằng `0`.
- Đây không phải tổng số dư ví và không được tự động lấy toàn bộ số dư workspace.
- Không được lớn hơn số tiền mục tiêu.
- Không được lớn hơn `max(currentWorkspaceBalance, 0)` tại lúc kích hoạt kế hoạch.
- Được chụp cố định khi kích hoạt kế hoạch; không thay đổi theo số dư ví về sau.
- Sau khi kế hoạch `active`, trường này không được sửa.

### 3.3. Số dư thực tế của workspace

`currentWorkspaceBalance` là tổng `current_balance` của toàn bộ ví còn thuộc workspace tại thời điểm tính.

- Hệ thống tự tính, người dùng không nhập.
- Số dư này được dùng để tính khả năng chi của tháng đầu tiên.
- Không đồng nghĩa với tiền đã dành sẵn cho mục tiêu.
- Việc ví bị vô hiệu hóa không làm tiền biến mất khỏi phép tính; chỉ ví bị xóa hợp lệ theo quy tắc dữ liệu mới bị loại.

### 3.4. Số tiền mục tiêu còn lại

```text
Mục tiêu còn lại
= max(Số tiền mục tiêu - existingGoalAmount, 0)
```

### 3.5. Khoản dành cho mục tiêu cơ sở

Tháng tạo kế hoạch được tính là tháng đầu tiên. Số tháng kế hoạch bao gồm cả `start_month` và `target_month`.

- `start_month` được hệ thống lấy từ tháng kích hoạt theo timezone workspace, không do người dùng chọn.
- Nếu plan ở trạng thái draft qua tháng mới, `start_month` chỉ được xác lập tại lúc kích hoạt.
- Deadline là thời điểm kết thúc ngày cuối cùng của `target_month` theo timezone workspace.

```text
Khoản cơ sở của các tháng trước tháng cuối
= floor(Mục tiêu còn lại / Tổng số tháng)

Khoản cơ sở của tháng cuối
= Mục tiêu còn lại - Tổng khoản cơ sở của các tháng trước
```

Cách này bảo đảm mọi số tiền hiển thị là số nguyên VND và tổng khoản phải dành luôn đúng bằng mục tiêu còn lại.

## 4. Ngân sách tháng và sáu hũ

### 4.1. Nguyên tắc không tính trùng chi phí

Chi phí định kỳ và giao dịch chi ghi nhận sớm là chi tiêu của hũ tương ứng. Chúng không bị trừ trước khi phân bổ hũ rồi lại trừ lần thứ hai khỏi hũ.

Mỗi tháng có ba lớp số liệu:

1. **Hạn mức hũ gộp thô**: nguồn lực sau khi trừ khoản bắt buộc; có thể âm.
2. **Hạn mức hũ gộp có thể phân bổ**: `max(hạn mức thô, 0)`, là số tiền duy nhất được chia vào hũ.
3. **Hạn mức hũ còn lại**: hạn mức đã phân bổ trừ chi phí đã phát sinh và chi phí đã biết của hũ.

### 4.2. Tháng đầu tiên

Tháng đầu phải dựa trên số tiền thực tế đang có, kể cả khi kế hoạch được tạo giữa tháng. Giao dịch thực tế của tháng được tính từ ngày đầu tháng.

```text
Hạn mức hũ gộp thô tháng đầu
= currentWorkspaceBalance
- existingGoalAmount
+ Chi phí approved đã phát sinh từ đầu tháng
+ Thu nhập còn lại dự kiến trong tháng
- Khoản phải dành cho mục tiêu tháng này
```

Việc cộng lại chi phí đã phát sinh chỉ nhằm tái tạo hạn mức gộp trước khi chi; khoản đó sẽ được trừ đúng một lần khi tính hạn mức còn lại.

```text
Hạn mức còn lại tháng đầu
= Hạn mức hũ gộp có thể phân bổ tháng đầu
- Chi phí approved từ đầu tháng
- Chi phí scheduled/recurring còn lại trong tháng
```

Công thức tương đương ở mức tổng tiền:

```text
Tiền còn có thể chi thô tháng đầu
= currentWorkspaceBalance
- existingGoalAmount
+ Thu nhập dự kiến còn lại
- Chi phí scheduled/recurring còn lại
- Khoản phải dành cho mục tiêu
```

Nếu kết quả thô âm, không được phân bổ số âm vào sáu hũ:

```text
Hạn mức hũ gộp có thể phân bổ
= max(Hạn mức hũ gộp thô, 0)

Thiếu hụt nguồn lực
= max(-Hạn mức hũ gộp thô, 0)
```

Hạn mức có thể chi hiển thị bằng `0`; thiếu hụt nguồn lực được hiển thị riêng và được đưa vào phép tính sức khỏe/carry của kế hoạch.

### 4.3. Các tháng sau

```text
Hạn mức hũ gộp thô của tháng
= Tổng thu nhập dự kiến của tháng
- Khoản phải dành cho mục tiêu của tháng

Hạn mức hũ còn lại
= Hạn mức hũ gộp có thể phân bổ
- Chi phí approved
- Chi phí scheduled
- Chi phí recurring dự kiến chưa materialize
```

Một occurrence recurring đã materialize thành transaction không được tính thêm lần nữa.

### 4.4. Phân bổ sáu hũ

Sáu hũ cố định của hệ thống:

| Mã hệ thống | Tên hiển thị | Tỷ lệ mặc định |
| --- | --- | ---: |
| `ESSENTIAL` | Thiết yếu | 55% |
| `RESPONSIBILITY` | Trách nhiệm | 10% |
| `DEVELOPMENT` | Phát triển | 10% |
| `ENJOYMENT` | Hưởng thụ | 10% |
| `INVESTMENT` | Đầu tư | 10% |
| `GIVING` | Cho đi | 5% |

Không được thêm, đổi tên, sửa ý nghĩa, vô hiệu hóa hoặc xóa hũ.

- Khi tạo kế hoạch, Admin có thể thiết lập lại tỷ lệ.
- Mỗi tỷ lệ có tối đa hai chữ số thập phân, có thể bằng `0%`.
- Chỉ lưu khi tổng sáu tỷ lệ bằng chính xác `100%`.
- Thay đổi tỷ lệ của kế hoạch đang chạy có hiệu lực từ ngày đầu tháng kế tiếp.
- Tháng đã đóng giữ nguyên tỷ lệ lịch sử.

```text
Hạn mức gộp của hũ
= floor(Hạn mức hũ gộp có thể phân bổ × Tỷ lệ hũ / 100)
```

Phần VND còn dư do lấy xuống được cộng vào hũ `ESSENTIAL`, bảo đảm tổng sáu hũ đúng bằng hạn mức tháng. Chi phí approved, scheduled và recurring sau đó được trừ khỏi đúng hũ theo snapshot/category tương ứng.

### 4.5. Vượt hạn mức từng hũ

- Mỗi hũ có thể hiển thị số tiền còn lại âm nếu chi phí của riêng hũ vượt hạn mức hũ.
- Hệ thống không tự chuyển hạn mức giữa các hũ trong tháng và không viết lại tỷ lệ.
- Nếu một hũ vượt nhưng hũ khác còn dư, tổng chi chưa vượt hạn mức có thể phân bổ và không có thiếu hụt nguồn lực, kế hoạch tổng thể không phát sinh thiếu hụt.
- Thiếu hụt kế hoạch tổng thể được xác định từ tổng chi vượt hạn mức cộng với `resourceShortfall`, không chỉ từ trạng thái của từng hũ.

## 5. Điều chỉnh khi chi vượt hoặc chi ít

### 5.1. Kết quả thực tế của tháng

```text
Chênh lệch ngân sách tháng
= Hạn mức hũ gộp có thể phân bổ
- Tổng chi phí eligible của tháng
- Thiếu hụt nguồn lực
```

- Chênh lệch âm: đã chi vào phần tiền phải dành cho mục tiêu.
- Chênh lệch bằng `0`: đúng kế hoạch.
- Chênh lệch dương: khoản chưa dùng được xem là dành thêm cho mục tiêu, tức đi trước kế hoạch.

```text
Số tiền thực tế dành được trong tháng
= max(
    Khoản phải dành cho mục tiêu tháng
    + Chênh lệch ngân sách tháng,
    0
  )
```

### 5.2. Tiến độ thực tế và tiến độ dự kiến

```text
Tiến độ đã ghi nhận
= existingGoalAmount
+ Tổng số tiền thực tế dành được của các tháng đã đóng
```

Phần chưa chi của tháng đang mở chưa được coi là tiến độ đã ghi nhận vì người dùng vẫn có thể sử dụng nó trước khi tháng kết thúc.

```text
Tiến độ dự kiến cuối tháng hiện tại
= Tiến độ đã ghi nhận
+ Số tiền dự kiến dành được của tháng đang mở
```

- Màn hình phải hiển thị rõ `Đã ghi nhận` và `Dự kiến cuối tháng`, không dùng một nhãn chung gây hiểu nhầm.
- Actual tháng đang mở chỉ gồm transaction approved; forecast cuối tháng cộng thêm scheduled và recurring chưa materialize.
- Underspend chỉ chính thức trở thành phần đi trước khi tháng được đóng.
- Sức khỏe của plan đang chạy dùng forecast nhưng không làm thay đổi tiến độ đã ghi nhận.

```text
Thiếu hụt lũy kế
= max(Tiến độ bắt buộc của các tháng đã đóng - Tiến độ đã ghi nhận, 0)

Đi trước lũy kế
= max(Tiến độ đã ghi nhận - Tiến độ bắt buộc của các tháng đã đóng, 0)
```

### 5.3. Phân bổ lại các tháng còn lại

Trong tháng đang mở, mỗi khi dữ liệu giao dịch, số dư hoặc dự báo định kỳ thay đổi, hệ thống phải tính lại tiến độ dự kiến của tháng đó và lập tức chia phần mục tiêu còn thiếu cho các tháng chưa đóng tiếp theo. Đây là reforecast ảo; không tạo hoặc sửa snapshot tháng đóng.

Khi tháng được đóng, kết quả thực tế trở thành snapshot chính thức và cùng công thức được dùng để chốt lịch còn lại:

```text
Mục tiêu chưa đạt
= max(Số tiền mục tiêu - Tiến độ đã ghi nhận, 0)

Khoản phải dành của các tháng còn lại
= floor(Mục tiêu chưa đạt / Số tháng còn lại)
```

Phần dư được đưa vào tháng cuối. Vì vậy chi vượt làm hạn mức chi các tháng sau giảm; chi ít làm hạn mức các tháng sau tăng hoặc khoản phải dành giảm.

### 5.4. Tháng đã đóng và giao dịch backdate

- Tỷ lệ hũ và khoản cơ sở đã chốt của tháng đóng không bị viết lại.
- Nếu giao dịch lịch sử được Admin sửa, duyệt, xóa hoặc backdate hợp lệ, actual của tháng đó được tính lại.
- Chênh lệch mới chỉ được carry forward vào các tháng chưa đóng; không sửa hạn mức lịch sử đã hiển thị của tháng đóng.
- Mọi thay đổi phải có audit.

### 5.5. Cơ chế đóng tháng

- Tháng được đóng tại đầu ngày đầu tiên của tháng kế tiếp theo timezone workspace.
- Tác vụ đóng tháng phải idempotent; chạy lại không tạo snapshot hoặc carry trùng.
- Ngoài scheduled job, mọi lần đọc hoặc thay đổi plan phải lazy catch-up các tháng chưa đóng để hệ thống tự phục hồi khi job bị trễ.
- Nếu bỏ lỡ nhiều tháng, hệ thống đóng tuần tự từ tháng cũ nhất đến tháng mới nhất vì kết quả tháng trước ảnh hưởng tháng sau.
- Mỗi plan chỉ có đúng một bản ghi tháng cho một `year-month`.

## 6. Ví dụ chuẩn

```text
Thu nhập tháng                              30.000.000
Tổng chi phí recurring                     10.000.000
Khoản phải dành cho mục tiêu               10.000.000

Hạn mức hũ gộp                             20.000.000
Recurring tiêu thụ hạn mức hũ              10.000.000
Hạn mức còn lại để chi                     10.000.000
```

Nếu workspace chi thêm đúng `10.000.000`, tổng chi tháng là `20.000.000` và kế hoạch vẫn đúng tiến độ.

Nếu workspace chi thêm `12.000.000`, tổng chi tháng là `22.000.000`:

```text
Chênh lệch ngân sách                        -2.000.000
Số tiền thực tế dành được                    8.000.000
Thiếu hụt cần chia cho các tháng còn lại     2.000.000
```

Với 9 tháng còn lại, tám tháng đầu nhận phần chia lấy xuống; toàn bộ số dư VND được dồn vào tháng cuối để tổng bù đúng `2.000.000`.

Ví dụ tháng đầu dựa trên tiền thực tế:

```text
Số dư workspace hiện tại                   20.000.000
Thu nhập còn lại trong tháng                        0
Chi phí đã biết còn lại                             0
Khoản phải dành cho mục tiêu               10.000.000
Tiền còn có thể chi                         10.000.000
```

Nếu số dư thực tế chỉ còn `8.000.000`, hạn mức chi bằng `0` và kế hoạch thiếu `2.000.000`; hệ thống không tạo số dư âm giả.

## 7. Category và hũ

### 7.1. Nguồn category

- Bỏ hoàn toàn category template cá nhân và luồng import template.
- Khi tạo workspace, hệ thống tạo trực tiếp bộ category mặc định thuộc workspace.
- Workspace có thể tạo category riêng theo phân quyền.
- Category của workspace này không được dùng trong workspace khác.

### 7.2. Quy tắc liên kết

- Category expense cấp gốc bắt buộc chọn một hũ.
- Category income không gắn hũ.
- Không được đổi type Thu/Chi sau khi category được tạo.
- Category con luôn kế thừa hũ của category cha và không có lựa chọn riêng.
- Khi cha đổi hũ, toàn bộ con đổi theo trong cùng database transaction.
- Giao dịch expense mới bắt buộc có category.
- Service tự lấy hũ từ category và lưu `jar_code` snapshot; client không được cung cấp giá trị đáng tin cậy này.
- Giao dịch cũ giữ snapshot khi category đổi hũ.
- Income và transfer không gắn hũ.
- Recurring expense tiêu hạn mức hũ; occurrence tương lai dùng hũ hiện tại của category, occurrence đã tạo giữ snapshot.
- Category đang được recurring rule active tham chiếu không được xóa hoặc vô hiệu hóa.
- Category chỉ được xóa khi không có transaction và không có recurring rule nào tham chiếu; trường hợp khác chỉ được vô hiệu hóa khi không vi phạm quy tắc recurring.

### 7.3. Khi không có kế hoạch active

Sáu hũ và snapshot vẫn dùng để phân loại, lọc và báo cáo chi tiêu. Không tính hạn mức, không hiển thị vượt hũ và không carry chênh lệch khi workspace không có kế hoạch `active`.

## 8. Nguồn dữ liệu actual và forecast

- Actual chỉ gồm transaction `approved`.
- `pending` hiển thị riêng và không làm thay đổi actual hoặc số dư.
- `rejected` và transaction đã xóa bị loại.
- Forecast gồm transaction `scheduled` và occurrence chưa materialize của recurring rule `active`.
- Không double count scheduled transaction đã được tạo từ recurring rule.
- Kế hoạch được tính lại khi transaction, recurring rule, deadline, tỷ lệ hũ hoặc tháng hiện tại thay đổi.
- Cùng một bộ đầu vào phải luôn tạo cùng một kết quả.

## 9. Vòng đời và sức khỏe kế hoạch

### 9.1. Trạng thái vòng đời được lưu

- `draft`: được sửa toàn bộ và được xóa.
- `active`: không được sửa target, start month hoặc existing goal amount; chỉ được sửa deadline và tỷ lệ có hiệu lực tương lai.
- `completed`: read-only.
- `cancelled`: read-only.

`at_risk` và `overdue` không phải trạng thái vòng đời; chúng là sức khỏe được tính từ dữ liệu.

### 9.2. Sức khỏe được tính

- `ahead`: đi trước tiến độ bắt buộc.
- `on_track`: đúng tiến độ.
- `behind`: chậm nhưng forecast vẫn có thể đạt.
- `at_risk`: forecast đến deadline không đủ mục tiêu.
- `goal_reached`: đã đạt mục tiêu trước hoặc đúng hạn.
- `overdue`: đã qua deadline nhưng chưa đạt.

Đạt sớm chỉ đổi sức khỏe thành `goal_reached`; plan vẫn `active` cho đến khi Admin kết thúc. Đến deadline:

- Đủ mục tiêu: hệ thống chuyển plan sang `completed`.
- Chưa đủ: plan vẫn `active`, sức khỏe `overdue`, để Admin gia hạn hoặc hủy.

Sau khi plan cũ `completed` hoặc `cancelled`, workspace được tạo/kích hoạt plan mới.

Nếu `existingGoalAmount = targetAmount` tại lúc kích hoạt, plan có health `goal_reached` ngay nhưng vẫn tuân theo cùng lifecycle.

Giao dịch backdate hoặc chỉnh sửa ledger sau khi plan đã `completed`/`cancelled`:

- Không tự mở lại plan và không carry chênh lệch sang plan mới.
- Lifecycle, tỷ lệ và hạn mức tháng đã đóng giữ nguyên.
- Báo cáo actual được tính lại và hiển thị chênh lệch điều chỉnh so với kết quả lúc đóng.
- Mọi điều chỉnh phải có audit.

## 10. Sửa deadline và điều kiện không khả thi

- Admin được sửa deadline của plan `active` nhưng deadline mới không được trước tháng hiện tại.
- Việc sửa phải có audit và tính lại toàn bộ tháng chưa đóng.
- Target không được sửa sau khi active.

Kế hoạch không khả thi khi forecast cho thấy nguồn lực không đủ khoản bắt buộc hoặc hạn mức còn có thể chi âm. UI phải hiển thị số tiền thiếu và có thể đề xuất gia hạn, tăng thu hoặc giảm chi; không tự sửa kế hoạch.

## 11. Quy tắc tiền và làm tròn

- Sản phẩm chỉ nhận và hiển thị số nguyên VND; không cho nhập phần thập phân của tiền.
- Database vẫn dùng `numeric(20,4)` và TypeScript dùng `Decimal.js`; không dùng `number`/`float` cho tính toán tiền.
- Mọi phép phân bổ tiền lấy xuống đến VND.
- Dư do chia tỷ lệ hũ được cộng vào `ESSENTIAL`.
- Dư do chia khoản mục tiêu hoặc thiếu hụt theo tháng được cộng vào tháng cuối.

## 12. Migration production vào sáu hũ

Migration thực hiện theo thứ tự expand → backfill → verify → contract và không thay đổi amount, balance hoặc workflow status.

Trước backfill phải kiểm tra toàn bộ cây category. Migration phải dừng và xuất báo cáo nếu có category cha không tồn tại, cha thuộc workspace khác, vòng lặp hierarchy hoặc quan hệ cha-con khác type Thu/Chi. Không tự fallback các bản ghi lỗi cấu trúc sang `ESSENTIAL`.

### 12.1. Category cấp gốc

| Mã category | Hũ |
| --- | --- |
| `EXPENSE_FOOD` | Thiết yếu |
| `EXPENSE_BILLS_UTILITIES` | Thiết yếu |
| `EXPENSE_TRANSPORTATION` | Thiết yếu |
| `EXPENSE_HEALTH` | Thiết yếu |
| `EXPENSE_PERSONAL` | Thiết yếu |
| `EXPENSE_EDUCATION` | Phát triển |
| `EXPENSE_SOCIAL_GIFTS` | Cho đi |
| `EXPENSE_ENTERTAINMENT` | Hưởng thụ |
| `EXPENSE_UNEXPECTED` | Trách nhiệm |
| `EXPENSE_INVESTMENT` | Đầu tư |
| `EXPENSE_TAX` | Trách nhiệm |
| `EXPENSE_OPERATIONS` | Thiết yếu |
| `EXPENSE_UTILITIES` | Thiết yếu |
| `EXPENSE_OTHER` | Thiết yếu |

- Category expense cấp gốc không khớp mapping, gồm category custom, mặc định vào `ESSENTIAL`.
- Category con luôn lấy hũ của cha sau khi cha được mapping; inheritance ưu tiên hơn code riêng của category con.
- Category income có `jar_code = null`.
- Transaction expense có category lấy snapshot từ category sau backfill.
- Transaction expense lịch sử không có category nhận snapshot `ESSENTIAL`.
- Với recurring expense legacy không có category, migration tạo idempotent một category root `EXPENSE_UNCATEGORIZED` (tên hiển thị `Chưa phân loại`) thuộc hũ `ESSENTIAL` trong workspace bị ảnh hưởng và gắn recurring vào category này. Category migration này là category workspace bình thường; không tạo cho workspace không có dữ liệu cần xử lý.

### 12.2. Dữ liệu template cũ

- Backup và thống kê trước khi xóa.
- Category template cá nhân cũ bị xóa vĩnh viễn ở contract migration sau khi xác minh không còn consumer.
- Category đã thuộc workspace và đang được giao dịch tham chiếu phải được giữ nguyên.

## 13. Điều hướng và cài đặt

- Bỏ menu và trang Cài đặt chung.
- Chuyển đầy đủ năm color theme và light/dark mode lên authenticated header.
- Trên mobile, Kế hoạch nằm trong menu sheet, không thêm vào bottom navigation.
- Quản lý category nằm trong ngữ cảnh workspace.
- Điều khiển header phải có accessible name, keyboard navigation và focus management.

## 14. Ngoài phạm vi

- Tự động chuyển hoặc khóa tiền thật.
- Tích hợp ngân hàng.
- Tư vấn đầu tư hoặc bảo đảm lợi nhuận.
