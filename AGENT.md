### HƯỚNG DẪN PHÁT TRIỂN DÀNH CHO AI AGENT (AGENTS.MD)

##### 1\. Giới thiệu và Mục tiêu

Tài liệu này là bộ quy chuẩn kỹ thuật  **bắt buộc**  dành cho mọi AI Agent và kỹ sư phần mềm khi tham gia phát triển dự án Fin Workspace. Mục tiêu tối thượng là đảm bảo tính toàn vẹn tuyệt đối của dữ liệu tài chính thông qua việc kiểm soát chặt chẽ logic tính toán, phân quyền và cấu trúc mã nguồn. Mọi đề xuất mã nguồn (code suggestions) không tuân thủ các nguyên tắc này sẽ bị coi là lỗi nghiêm trọng.

##### 2\. Nguyên tắc Cốt lõi về Tài chính (Financial Integrity)

Để duy trì độ chính xác cấp độ ngân hàng, các quy tắc sau phải được thực thi không ngoại lệ:

* **Độ chính xác số thực:**  
* Toàn bộ các trường tiền tệ bao gồm amount, opening\_balance, và current\_balance  **phải**  sử dụng kiểu dữ liệu numeric(20,4) trong database.  
* Trong mã nguồn (Next.js),  **nghiêm cấm**  sử dụng kiểu number hoặc float để tính toán.  
* **Bắt buộc**  sử dụng thư viện Decimal.js. Yêu cầu AI Agent sử dụng Zod .transform() để chuyển đổi dữ liệu đầu vào thành đối tượng Decimal ngay tại tầng validation.  
* **Tính cô lập (Workspace Isolation):**  
* Dữ liệu giữa các Workspace là tuyệt đối biệt lập.  
* Lưu ý: Bảng WALLETS không chứa trực tiếp workspace\_id. Khi truy vấn ví,  **phải**  thực hiện join thông qua bảng trung gian WORKSPACE\_WALLET để xác thực quyền sở hữu của Workspace hiện hành.  
* **Giao dịch nguyên tử (Atomic Transactions):**  
* Mọi hoạt động thay đổi số dư (current\_balance) và ghi log giao dịch (TRANSACTION)  **phải**  được bọc trong Prisma $transaction.

##### 3\. Kiến trúc Hệ thống Phân lớp (Layered Architecture)

Dự án tuân thủ mô hình phân lớp nghiêm ngặt trong Next.js để tách biệt trách nhiệm:

1. **Domain Layer:**  Định nghĩa Zod Schemas và Prisma Types. Đây là "nguồn sự thật" duy nhất về cấu trúc dữ liệu.  
2. **Services Layer:**   **Nơi duy nhất**  được phép chứa logic tính toán tài chính và cập nhật số dư. Nghiêm cấm đặt logic cập nhật số dư tại Server Actions hoặc UI Components.  
3. **Server Actions Layer:**  Tiếp nhận Request, xác thực Role-based Access Control (RBAC) và gọi các hàm từ Services Layer.  
4. **Lib/Utils Layer:**  Chứa các hàm định dạng (formatters) và helper dùng chung.

##### 4\. Quy tắc Cơ sở Dữ liệu và Luồng Nghiệp vụ

AI Agent cần đặc biệt lưu ý các logic nhánh dựa trên trạng thái và loại giao dịch.  
**Bảng trạng thái WORKFLOW\_STATUS:**  
| Trạng thái | Ý nghĩa | Hệ quả tài chính |  
| \------ | \------ | \------ |  
| pending | Đang chờ phê duyệt | Không thay đổi số dư ví. |  
| approved | Đã phê duyệt | Bắt buộc cập nhật current\_balance. |  
| rejected | Bị từ chối | Không thay đổi số dư, giữ nguyên lịch sử. |  
**Logic xử lý theo TRANSACTION\_TYPE:**

* **income**  **(Thu nhập):**  Tăng current\_balance của wallet\_id.  
* **expense**  **(Chi phí):**  Giảm current\_balance của wallet\_id.  
* **transfer**  **(Chuyển khoản):**  
* Yêu cầu bắt buộc có to\_wallet\_id.  
* Sử dụng $transaction để đồng thời giảm current\_balance của wallet\_id (ví gửi) và tăng current\_balance của to\_wallet\_id (ví nhận).**Mối quan hệ nhân sự:**  
* TRANSACTION.member\_id  **phải**  tham chiếu đến id của bảng WORKSPACE\_MEMBERS, không được nhầm lẫn với USERS.id.

##### 5\. Phân quyền và Quy trình Phê duyệt (Authorization)

Mọi hành động nhạy cảm phải được kiểm tra qua vai trò (Role):

* **Member:**  Chỉ được tạo giao dịch ở trạng thái pending. Không được phép chỉnh sửa dữ liệu đã ở trạng thái approved.  
* **Admin:**  Có quyền chuyển đổi trạng thái giao dịch (approved/rejected).  
* **Kiểm tra Danh mục (Category):**  Khi gán category\_id vào giao dịch, Agent phải kiểm tra: Category đó thuộc về workspace\_id hiện tại HOẶC là Category hệ thống (có workspace\_id là null).

##### 6\. Tech Stack và Tiêu chuẩn Code

Thành phần,Công nghệ,Tiêu chuẩn áp dụng  
Framework,Next.js,"App Router, Server Actions."  
ORM,Prisma,Luôn sử dụng transactions cho đa bảng.  
Số thực,Decimal.js,"numeric(20,4)."  
Validation,Zod,Schema-first validation.  
UI/Styling,"Shadcn/UI, Tailwind",Đảm bảo tính nhất quán giao diện.

##### 7\. Chỉ dẫn Đặc biệt cho Agent (Cheat Sheet)

**Khi thực hiện lập trình, hãy tuân thủ Checklist sau:**

* **Checklist Giao dịch:**  
*  Xác thực member\_id thuộc về WORKSPACE\_MEMBERS.  
*  Nếu type là transfer, đảm bảo to\_wallet\_id không trống và khác wallet\_id.  
*  Kiểm tra category\_id có hợp lệ cho workspace (null hoặc trùng workspace\_id).  
* **Checklist Truy vấn:**  
*  Luôn lọc theo workspace\_id thông qua WORKSPACE\_WALLET khi truy xuất WALLETS.  
*  Không bao giờ trả về password\_hash của người dùng.  
* **Checklist Cập nhật:**  
*  Chỉ cập nhật current\_balance tại  **Service Layer** .  
*  Sử dụng $transaction cho mọi hành động thay đổi số dư.  
*  Luôn sử dụng Decimal.js cho mọi phép tính cộng, trừ, nhân, chia.