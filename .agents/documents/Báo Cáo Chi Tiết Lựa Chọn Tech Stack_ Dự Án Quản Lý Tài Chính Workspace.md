### Báo Cáo Chi Tiết Lựa Chọn Tech Stack: Dự Án Quản Lý Tài Chính Workspace

**1\. Tổng Quan Kiến Trúc Hệ Thống (Next.js Full-stack)**  
Dưới vai trò Kiến trúc sư Giải pháp, tôi xác định Next.js (App Router) là nền tảng cốt lõi duy nhất cho dự án này. Việc lựa chọn một kiến trúc Full-stack tập trung giúp tối ưu hóa nguồn lực phát triển và đảm bảo tính nhất quán cao nhất trong việc xử lý dữ liệu tài chính.Hệ thống được thiết kế tập trung hoàn toàn vào trải nghiệm Web Dashboard. Chiến lược xuyên suốt của dự án là thiết lập một hệ thống an toàn kiểu dữ liệu (Type-safety) tuyệt đối bằng cách sử dụng TypeScript đồng bộ: từ định nghĩa Database Schema qua Prisma, thông qua các API Route, cho đến tận lớp giao diện người dùng. Điều này giúp giảm thiểu tối đa các lỗi logic tiềm ẩn trong quá trình vận hành dòng tiền.Ba ưu điểm cốt lõi của lựa chọn này bao gồm:

* **Tốc độ phát triển vượt trội:**  Sử dụng Single Language Stack (TypeScript) cho cả Front-end và Back-end giúp đội ngũ dễ dàng chia sẻ logic xử lý và các interface dữ liệu, giảm thiểu thời gian chuyển đổi ngữ cảnh.  
* **Hiệu năng SSR/SSG tối ưu:**  Next.js cho phép Server-Side Rendering (SSR) các báo cáo tài chính nặng về dữ liệu, giúp hiển thị kết quả tức thì và tối ưu hóa khả năng truy xuất.  
* **Khả năng mở rộng API nội bộ:**  Việc quản lý các API Route ngay trong cùng một project giúp đơn giản hóa quy trình xác thực, phân quyền và giao tiếp dữ liệu giữa các thành phần hệ thống.


**2\. Lớp Giao Diện (UI) và Trải Nghiệm Người Dùng (UX)**  
Giao diện hệ thống được xây dựng dựa trên bộ công cụ hiện đại, tập trung vào tính chuẩn xác và khả năng trình bày dữ liệu trực quan.  
| Thư viện | Vai trò cụ thể |  
| \------ | \------ |  
| Shadcn/UI | Hệ thống Component nền tảng, đảm bảo sự nhất quán và chuyên nghiệp cho các thành phần UI như bảng biểu, hộp thoại và form nhập liệu. |  
| Tailwind CSS | Công cụ Styling theo phương thức utility-first, giúp tùy biến giao diện linh hoạt và tối ưu hóa CSS cho hiệu suất trình duyệt. |  
| Lucide React | Hệ thống Icon vector tối giản, hỗ trợ trực quan hóa các chức năng điều hướng và trạng thái tài chính. |  
| Recharts | Thư viện chuyên dụng để xử lý và trình bày các tập dữ liệu tài chính phức tạp dưới dạng biểu đồ sinh động. |  
Trong hệ thống, Recharts không chỉ đơn thuần là công cụ vẽ hình. Thư viện này sẽ trực tiếp tiêu thụ dữ liệu từ bảng TRANSACTION, thực hiện các phép tính tổng hợp trên trường amount theo trục thời gian date để mô tả xu hướng biến động số dư. Đồng thời, nó liên kết với category\_id để truy xuất CATEGORY.name, từ đó vẽ biểu đồ cơ cấu chi tiêu, giúp người quản trị nhận diện rõ ràng các nhóm chi phí phát sinh.

**3\. Quản Lý Trạng Thái và Xử Lý Form**  
Kiến trúc xử lý dữ liệu phía Client là sự kết hợp chặt chẽ giữa TanStack Query, Zustand và Zod nhằm đảm bảo tính toàn vẹn từ lúc nhập liệu đến khi lưu trữ.TanStack Query đóng vai trò quản lý Server-state, tự động hóa việc caching và đồng bộ các bản ghi giao dịch từ Server. Cơ chế này giúp đảm bảo dữ liệu hiển thị trên Dashboard luôn là mới nhất mà không gây quá tải cho hạ tầng. Zustand được chỉ định để quản lý trạng thái toàn cục, cụ thể là lưu trữ workspace\_id đang hoạt động. Đây là chìa khóa để thực hiện logic filter (lọc) dữ liệu trên toàn hệ thống: từ việc hiển thị danh sách WALLETS thông qua bảng trung gian WORKSPACE\_WALLET, đến việc lọc danh mục CATEGORY thuộc về không gian làm việc đó.Đối với quy trình nhập liệu, sự phối hợp giữa React Hook Form và Zod đóng vai trò như một "chốt chặn" an ninh. Mọi giao dịch khởi tạo phải vượt qua bước kiểm tra nghiêm ngặt về kiểu dữ liệu và giá trị Enum. Cụ thể, trường type phải thuộc TRANSACTION\_TYPE (income, expense, transfer) và workflow\_status phải nằm trong tập WORKFLOW\_STATUS (pending, approved, rejected). Điều này đảm bảo dữ liệu gửi lên Server luôn sạch và đúng cấu trúc schema.

**4\. Kiến Trúc Dữ Liệu và ORM (PostgreSQL & Prisma)**  
Hệ thống sử dụng PostgreSQL làm hệ quản trị cơ sở dữ liệu quan hệ, với chuẩn định danh UUID cho tất cả các Primary Key (PK) để đảm bảo tính duy nhất và bảo mật thông tin. Prisma ORM được sử dụng để quản lý các thực thể sau:

* **USERS:**  Quản lý tài khoản và định danh người dùng.  
* **WORKSPACES:**  Không gian quản lý tài chính riêng biệt cho từng tổ chức.  
* **ROLE:**  Định nghĩa các cấp bậc quyền hạn trong hệ thống.  
* **WORKSPACE\_MEMBERS:**  Liên kết người dùng vào workspace với vai trò cụ thể.  
* **WALLETS:**  Các ví tài chính lưu trữ opening\_balance và current\_balance.  
* **TRANSACTION:**  Nhật ký chi tiết mọi biến động tài chính.  
* **CATEGORY:**  Hệ thống phân loại mục đích thu chi.

Prisma chịu trách nhiệm quản lý quan hệ Many-to-Many giữa WORKSPACES và WALLETS thông qua bảng trung gian WORKSPACE\_WALLET. Đặc biệt, đối với các giao dịch có type là 'transfer', Prisma Transaction được áp dụng để thực thi logic chuyển khoản giữa wallet\_id và to\_wallet\_id. Cơ chế này đảm bảo tính nguyên tử (Atomicity): nếu việc trừ tiền ở ví gửi hoặc cộng tiền ở ví nhận gặp lỗi, toàn bộ thao tác sẽ được rollback (hoàn tác) ngay lập tức, ngăn chặn hoàn toàn tình trạng mất mát dữ liệu hoặc sai lệch số dư.

**5\. Logic Nghiệp Vụ Tài Chính và Backend**  
Sự chính xác tuyệt đối trong tính toán là yêu cầu bắt buộc của một hệ thống tài chính. Hệ thống sử dụng kiểu dữ liệu numeric(20,4) trong PostgreSQL để lưu trữ các giá trị tiền tệ. Con số 4 chữ số thập phân này được lựa chọn để hỗ trợ các bài toán quy đổi ngoại tệ hoặc tính toán phí giao dịch siêu nhỏ (micro-transactions) mà không gặp sai số. Phía Backend sẽ sử dụng thư viện Decimal.js hoặc Big.js để thực hiện các phép tính này, loại bỏ hoàn toàn rủi ro sai lệch từ kiểu dữ liệu floating-point mặc định của JavaScript.Logic cập nhật số dư được bảo vệ bởi Database Triggers. Cụ thể, trường current\_balance trong bảng WALLETS chỉ được cập nhật tự động khi và chỉ khi workflow\_status của giao dịch chuyển sang trạng thái 'approved'. Điều này tách biệt rõ ràng giữa luồng ghi nhận giao dịch và luồng thay đổi tài sản thực tế.Hệ thống xác thực NextAuth.js sẽ được cấu hình để thực hiện phân quyền dựa trên logic: ánh xạ mã ROLE.code (ví dụ: 'ADMIN', 'MEMBER') từ bảng ROLE thông qua mối quan hệ trong bảng WORKSPACE\_MEMBERS vào Session của người dùng. Điều này cho phép kiểm soát chặt chẽ quyền truy cập vào các tính năng phê duyệt hoặc chỉnh sửa dữ liệu nhạy cảm.

**6\. Xử Lý Thời Gian và Báo Cáo**  
Thời gian là trục tọa độ quan trọng nhất trong báo cáo tài chính. Hệ thống sử dụng thư viện date-fns để xử lý toàn diện các trường dữ liệu thời gian:

* Các trường created\_at, updated\_at (timestamptz) được ghi nhận chính xác theo chuẩn UTC tại tầng cơ sở dữ liệu.  
* Trường date (kiểu date) ghi lại ngày phát sinh nghiệp vụ thực tế.  
* date-fns thực hiện chuyển đổi và định dạng các mốc thời gian này sang múi giờ địa phương của người dùng, đảm bảo tính nhất quán giữa thời điểm giao dịch trên giấy tờ và hiển thị trên báo cáo điện tử.Sự kết hợp giữa sức mạnh của Next.js, tính an toàn của Prisma/PostgreSQL và sự chính xác của các thư viện bổ trợ như Decimal.js hay date-fns tạo nên một hệ sinh thái công nghệ vững chắc. Đây là giải pháp kiến trúc tối ưu, đáp ứng đầy đủ các yêu cầu về tốc độ xử lý, tính minh bạch và độ tin cậy tuyệt đối cho dự án Quản lý Tài chính Workspace.

