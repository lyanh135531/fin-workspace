### Tài liệu Nghiệp vụ (BRD): Hệ thống Quản lý Tài chính Workspace

##### 1\. Tổng quan về Hệ thống

Hệ thống Quản lý Tài chính Workspace là giải pháp quản trị dòng tiền đa tầng, được thiết kế để tối ưu hóa việc phân bổ tài nguyên tài chính trong môi trường cộng tác. Mục tiêu cốt lõi của hệ thống là cung cấp cơ chế chia sẻ ví (Wallets) linh hoạt giữa nhiều không gian làm việc (Workspaces) nhưng vẫn phải đảm bảo tính cô lập tuyệt đối của các giao dịch và dữ liệu báo cáo theo từng đơn vị nghiệp vụ.  
**Đối tượng sử dụng:**

* **Quản trị viên (Admin):**  Có quyền kiểm soát toàn diện đối với cấu hình Workspace, quản lý danh mục, thiết lập ví và là đầu mối duy nhất có thẩm quyền phê duyệt các thay đổi đối với dữ liệu tài chính lịch sử.  
* **Thành viên (Member):**  Thực hiện các nghiệp vụ ghi chép giao dịch phát sinh hàng ngày (Thu, Chi, Chuyển khoản) trong phạm vi Workspace được phân quyền và tuân thủ các quy tắc kiểm soát của Admin.

##### 2\. Cấu trúc Tổ chức và Quản lý Thành viên

###### *2.1. Workspace và Trạng thái Hoạt động*

Hệ thống quản lý dữ liệu thông qua thực thể WORKSPACES. Mối quan hệ giữa người dùng và không gian làm việc được thiết lập tại bảng WORKSPACE\_MEMBERS.

* **Quy tắc Trạng thái (Status):**  Hệ thống BẮT BUỘC phải kiểm tra trạng thái (status) của cả Workspace và Workspace Member. Nếu trạng thái là deactive, mọi quyền truy cập và thực hiện giao dịch của người dùng tại Workspace đó phải bị chặn ngay lập tức.

###### *2.2. Phân quyền (Roles) và Kiểm soát Truy cập*

Vai trò người dùng được định nghĩa qua mã ROLE. Hệ thống phải thực thi phân quyền dựa trên logic cô lập dữ liệu (Isolation):  
| Chức năng | Admin | Member |  
| \------ | \------ | \------ |  
| Quản trị Workspace & Thay đổi trạng thái (Active/Deactive) | Có | Không |  
| Liên kết và quản lý Ví dùng chung (Shared Wallets) | Có | Không |  
| Tạo mới và quản lý Danh mục (Category) | Có | Không |  
| Ghi chép giao dịch (Hiện tại & Tương lai) | Có | Có |  
| Chỉnh sửa giao dịch quá khứ (date \< Current\_Date) | Có | Phải được phê duyệt |  
| Xem báo cáo tài chính | Toàn bộ Workspace | Chỉ dữ liệu của Workspace |

##### 3\. Mô hình Ví dùng chung (Shared Wallets)

###### *3.1. Cơ chế liên kết Nhiều-Nhiều (Many-to-Many)*

Thông qua bảng trung gian WORKSPACE\_WALLET, một Ví có thể được cấp quyền sử dụng cho nhiều Workspace khác nhau.

* **Lưu ý về Số dư:**  Hệ thống ghi nhận current\_balance trong bảng WALLETS là giá trị  **tổng cộng (Global Aggregate)** . Khi một ví được chia sẻ, số dư hiển thị tại các Workspace là như nhau, phản ánh đúng thực tế tài chính của ví đó trên toàn hệ thống.

###### *3.2. Tính cô lập Giao dịch (Transaction Isolation)*

Mặc dù Ví là tài nguyên dùng chung, hệ thống PHẢI đảm bảo tính riêng biệt của dữ liệu giao dịch:

* **Logic Truy vấn:**  Vì bảng TRANSACTION không có workspace\_id trực tiếp, hệ thống BẮT BUỘC thực hiện liên kết (Join) qua member\_id của bảng WORKSPACE\_MEMBERS để xác định giao dịch thuộc về Workspace nào.  
* **Báo cáo:**  Mọi báo cáo tài chính cấp Workspace chỉ được phép tổng hợp các giao dịch được tạo bởi thành viên thuộc Workspace đó. Tuyệt đối không để xảy ra tình trạng rò rỉ dữ liệu giao dịch giữa các Workspace cùng dùng chung một ví.

##### 4\. Quản lý Danh mục và Giao dịch

###### *4.1. Danh mục Hệ thống và Danh mục Riêng (Category Logic)*

Hệ thống sử dụng bảng CATEGORY với thuộc tính workspace\_id có thể chấp nhận giá trị null:

* **Global Categories (**  **workspace\_id**  **IS NULL):**  Là các danh mục mặc định do hệ thống cung cấp (ví dụ: Lương, Thuế, Chi phí vận hành chung). Mọi Workspace đều có thể sử dụng.  
* **Workspace-Specific Categories:**  Là danh mục do Admin của từng Workspace tạo riêng. Chỉ thành viên của Workspace đó mới thấy và sử dụng được.  
* **Ràng buộc:**  Không được phép tạo giao dịch với danh mục có trạng thái deactive.

###### *4.2. Loại hình Giao dịch (Transaction Types)*

Hệ thống thực thi 3 loại hình giao dịch từ Enum TRANSACTION\_TYPE:

* **Income (Thu):**  Tăng số dư wallet\_id.  
* **Expense (Chi):**  Giảm số dư wallet\_id.  
* **Transfer (Chuyển khoản):**  Luân chuyển tiền.  **Yêu cầu:**  Trường to\_wallet\_id là BẮT BUỘC khi loại giao dịch là transfer. Hệ thống phải thực hiện đồng thời việc giảm số dư ví nguồn (wallet\_id) và tăng số dư ví đích (to\_wallet\_id).

##### 5\. Quy trình Phê duyệt và Kiểm soát Giao dịch

###### *5.1. Định nghĩa Giao dịch Quá khứ*

Hệ thống sử dụng trường date trong bảng TRANSACTION để xác định tính chất thời điểm, không phụ thuộc vào thời gian tạo hệ thống (created\_at).

* **Giao dịch Quá khứ:**  Là bất kỳ giao dịch nào có TRANSACTION.date \< Current\_Date (Ngày hiện tại của hệ thống).

###### *5.2. Quy trình Phê duyệt Chỉnh sửa (Approval Workflow)*

Mọi hành vi sửa đổi dữ liệu lịch sử của Member phải được kiểm soát nghiêm ngặt:

1. **Khởi tạo yêu cầu:**  Member thực hiện chỉnh sửa một giao dịch có date trong quá khứ.  
2. **Trạng thái trung gian:**  Hệ thống ghi nhận các thay đổi vào bản ghi nhưng PHẢI đánh dấu trạng thái chờ phê duyệt (Sử dụng logic nghiệp vụ để treo việc cập nhật current\_balance và ghi nhận mốc updated\_at).  
3. **Thẩm định:**  Admin kiểm tra nội dung thay đổi và tác động đến dòng tiền.  
4. **Xác nhận (Finalize):**  Chỉ sau khi Admin phê duyệt, các thay đổi về amount hoặc wallet\_id mới được chính thức áp dụng vào số dư hiện tại của Ví.

##### 6\. Quy tắc Tài chính và Độ chính xác Dữ liệu

* **Độ chính xác:**  Tất cả các trường số dư và số tiền giao dịch (amount, opening\_balance, current\_balance) phải sử dụng kiểu dữ liệu numeric(20,4). Hệ thống phải đảm bảo độ chính xác đến 4 chữ số thập phân trong mọi phép tính toán tổng hợp.  
* **Số dư âm (Negative Balance):**  Hệ thống CHO PHÉP số dư ví âm để phục vụ các nghiệp vụ chi trước thu sau hoặc thấu chi doanh nghiệp.  
* **Tính toàn vẹn trạng thái:**  Tuyệt đối không cho phép thực hiện giao dịch nếu WALLETS.status \= 'deactive'.

##### 7\. Cấu trúc và Ánh xạ Dữ liệu Nghiệp vụ (Data Mapping)

###### *7.1. Danh mục các thực thể chức năng*

* **USERS:**  Quản lý danh tính và trạng thái hoạt động của người dùng hệ thống.  
* **WORKSPACES:**  Đơn vị định danh không gian làm việc, đóng vai trò là ranh giới cô lập dữ liệu báo cáo.  
* **WORKSPACE\_MEMBERS:**  Nguồn sự thật duy nhất (Source of Truth) về quyền hạn người dùng và ngữ cảnh Workspace.  
* **ROLE:**  Quy định tập hợp quyền hạn cho Admin và Member.  
* **WALLETS:**  Lưu trữ thông tin số dư tổng và trạng thái của nguồn tiền.  
* **WORKSPACE\_WALLET:**  Định nghĩa quyền truy cập ví của từng Workspace cụ thể.  
* **CATEGORY:**  Phân loại mục đích dòng tiền, hỗ trợ cả cấp độ toàn cục và cấp độ Workspace.  
* **TRANSACTION:**  Nhật ký chi tiết mọi biến động tài chính, lưu vết người thực hiện (member\_id) và thời điểm nghiệp vụ (date).

###### *7.2. Các mối liên kết dữ liệu trọng yếu*

* **Luồng Giao dịch:**  TRANSACTION.wallet\_id (Ví tác động) và TRANSACTION.to\_wallet\_id (Ví đích \- Chỉ dành cho Transfer).  
* **Luồng Phân loại:**  TRANSACTION.category\_id kết nối tới CATEGORY.id.  
* **Luồng Kiểm soát Workspace:**  TRANSACTION.member\_id \-\> WORKSPACE\_MEMBERS.id \-\> WORKSPACES.id. Đây là đường dẫn bắt buộc để lọc dữ liệu báo cáo.  
* **Luồng Phân quyền:**  USERS.id \+ WORKSPACES.id thông qua WORKSPACE\_MEMBERS để xác định ROLE.  
* **Luồng Quản lý Danh mục:**  CATEGORY.workspace\_id liên kết với WORKSPACES.id (Nếu NULL là danh mục dùng chung).

