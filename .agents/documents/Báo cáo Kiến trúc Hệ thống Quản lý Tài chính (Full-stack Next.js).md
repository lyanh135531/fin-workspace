### Báo cáo Kiến trúc Hệ thống Quản lý Tài chính (Full-stack Next.js)

##### 1\. Tổng quan về Mô hình Kiến trúc Phân lớp (Layered Architecture)

Trong thiết kế hệ thống tài chính, sự minh bạch và khả năng truy vết dữ liệu là những ưu tiên hàng đầu. Kiến trúc của hệ thống được xây dựng dựa trên mô hình phân lớp (Layered Architecture), tạo ra sự tách biệt rõ rệt giữa giao diện, logic nghiệp vụ và lưu trữ dữ liệu. Cách tiếp cận này không chỉ giúp hệ thống dễ bảo trì mà còn đảm bảo các quy tắc kiểm soát tài chính được thực thi một cách nghiêm ngặt tại đúng lớp trách nhiệm của chúng.

* **Presentation Layer (Tầng Giao tiếp người dùng):**  Sử dụng Next.js để quản lý trạng thái hiển thị. Tầng này chịu trách nhiệm thu thập thông tin giao dịch và phản hồi trạng thái từ hệ thống, đồng thời đảm bảo tính nhất quán về mặt thị giác thông qua các thuộc tính định cấu hình sẵn.  
* **Service/Domain Layer (Tầng Xử lý nghiệp vụ):**  Đóng vai trò là trung tâm điều khiển, nơi thực thi các quy tắc cô lập dữ liệu giữa các Workspace và kiểm tra quyền hạn của thành viên. Đây là nơi các luồng phê duyệt (Workflow) được quản lý trước khi bất kỳ thay đổi nào được ghi nhận vào số dư thực tế.  
* **Data Access Layer (Tầng Giao tiếp cơ sở dữ liệu):**  Đảm bảo tính toàn vẹn vật lý của dữ liệu. Điểm đặc biệt trong kiến trúc này là chiến lược  **Soft Delete**  (Xóa mềm); mọi bảng trong hệ thống đều sở hữu trường deleted\_at. Kiến trúc này mandates rằng không có dữ liệu tài chính nào bị xóa vĩnh viễn khỏi hệ thống, cho phép khôi phục và phục vụ công tác kiểm toán (audit trail) bất cứ lúc nào.

##### 2\. Chi tiết Tầng Presentation: Next.js Server Components & Server Actions

Hệ thống tận dụng các tiến bộ mới nhất của Next.js để tối ưu hóa bảo mật và trải nghiệm người dùng:

* **Next.js Server Components (RSC):**  Việc fetch dữ liệu danh mục, ví và lịch sử giao dịch được thực hiện trực tiếp tại Server. Điều này giúp giảm thiểu việc lộ diện các cấu trúc API nhạy cảm ra phía Client. Đặc biệt, các trường thông tin như color (mã màu) và order (thứ tự sắp xếp) trong bảng CATEGORY được xử lý tại đây để đảm bảo giao diện người dùng luôn nhất quán và tối ưu theo cấu hình của từng tổ chức.  
* **Server Actions:**  Thay thế cho các API Route truyền thống để xử lý mutation. Khi người dùng tạo một yêu cầu chi tiêu hoặc chuyển khoản, Server Actions sẽ tiếp nhận, thực thi kiểm tra nghiệp vụ và phản hồi kết quả ngay lập tức. Cơ chế này giúp thu hẹp bề mặt tấn công và đảm bảo mọi yêu cầu thay đổi dữ liệu đều được xác thực danh tính một cách nghiêm ngặt trên môi trường server an toàn.

##### 3\. Tầng Service: Logic Nghiệp vụ và Quản lý Workspace

Logic nghiệp vụ tập trung vào việc quản trị sự cô lập và quy trình phê duyệt chặt chẽ:

* **Cô lập dữ liệu và Scoping:**  Hệ thống thực thi việc phân tách dữ liệu dựa trên workspace\_id. Quan trọng hơn, CATEGORY và các thành viên được quản lý trong bảng WORKSPACE\_MEMBERS đều được gán chặt với một Workspace cụ thể. Điều này ngăn chặn hoàn toàn việc nhiễm chéo dữ liệu tài chính giữa các tổ chức khác nhau.  
* **Quản lý vai trò dựa trên Thành viên:**  Khác với các hệ thống phổ thông, vai trò (ROLE) được gán thông qua bảng trung gian WORKSPACE\_MEMBERS. Kiến trúc này cho phép một người dùng (USERS) có thể đảm nhận các vai trò khác nhau trong các không gian làm việc khác nhau, tối ưu hóa tính linh hoạt cho mô hình doanh nghiệp nhiều chi nhánh.  
* **Cơ chế Ví dùng chung (Shared Wallets):**  Mối quan hệ nhiều-nhiều giữa WORKSPACES và WALLETS (thông qua bảng WORKSPACE\_WALLET) cho phép một nguồn vốn được quản lý và sử dụng bởi nhiều nhóm làm việc, trong khi vẫn duy trì sự kiểm soát tập trung vào số dư.

##### 4\. Tầng Dữ liệu: Prisma ORM và PostgreSQL

Tầng dữ liệu được thiết kế để đảm bảo sự chặt chẽ về kiểu và quan hệ logic:

* **Prisma ORM:**  Vai trò của Prisma không chỉ là cầu nối giữa TypeScript và PostgreSQL mà còn là công cụ cưỡng ép kiểu dữ liệu (Type-safety). Mọi truy vấn đều phải tuân thủ schema đã định nghĩa, hạn chế tối đa các lỗi runtime liên quan đến dữ liệu tài chính.  
* **Quản lý trạng thái bằng Enum:**  Hệ thống chuẩn hóa các trạng thái thông qua các Enum:  
* STATUS: Điều khiển quyền truy cập của thực thể (active/deactive).  
* TRANSACTION\_TYPE: Phân loại dòng tiền thành income (thu), expense (chi), hoặc transfer (chuyển khoản).  
* WORKFLOW\_STATUS: Kiểm soát vòng đời giao dịch từ khi khởi tạo (pending) đến khi được xác nhận (approved) hoặc từ chối (rejected).  
* **Cấu trúc quan hệ:**  Mọi giao dịch trong bảng TRANSACTION được liên kết trực tiếp với member\_id (trỏ đến WORKSPACE\_MEMBERS) thay vì user\_id trực tiếp, nhằm xác định chính xác danh tính thực thi trong ngữ cảnh của Workspace đó.

##### 5\. Cơ chế Đảm bảo Tính Toàn vẹn và Chính xác Tài chính

Đây là lớp phòng thủ cuối cùng để bảo vệ sự chính xác của dòng tiền:

* **Độ chính xác số học:**  Kiến trúc mandates sử dụng kiểu dữ liệu numeric(20,4) cho tất cả các trường liên quan đến tiền tệ (opening\_balance, current\_balance, amount). Việc sử dụng 4 chữ số thập phân là bắt buộc để xử lý các phép tính toán chính xác về tỷ giá hoặc lãi suất tích lũy, tránh hoàn toàn lỗi làm tròn của kiểu số thực (float). Ở tầng ứng dụng, thư viện Decimal.js được sử dụng để duy trì độ chính xác này trước khi lưu vào DB.  
* **Database Triggers và Workflow Status:**  Hệ thống không cập nhật số dư ví một cách tùy tiện. Một Database Trigger được thiết lập để theo dõi sự thay đổi của WORKFLOW\_STATUS. Chỉ khi trạng thái chuyển sang approved, Trigger mới kích thực thi việc cập nhật current\_balance trong bảng WALLETS. Điều này đảm bảo tiền thực tế chỉ biến động khi giao dịch đã qua kiểm duyệt.  
* **Atomic Transactions (Giao dịch nguyên tử) cho Chuyển khoản:**  Đối với loại hình transfer, hệ thống thực thi một đơn vị công việc không thể chia cắt. Logic sẽ trừ tiền tại wallet\_id (ví nguồn) và cộng tiền vào to\_wallet\_id (ví đích) trong cùng một transaction. Nếu một trong hai bước thất bại, toàn bộ quá trình sẽ bị rollback, đảm bảo không bao giờ xảy ra tình trạng thất thoát tiền trong trạng thái lơ lửng. Lưu ý rằng to\_wallet\_id sẽ luôn mang giá trị null đối với các giao dịch thu/chi thông thường.

##### 6\. Tổng kết Quy hoạch Cơ sở Dữ liệu

Bảng dưới đây tổng hợp các thực thể cốt lõi và các mối quan hệ then chốt trong kiến trúc hệ thống:  
| Tên Bảng | Các trường khóa ngoại (Refs) | Ý nghĩa nghiệp vụ |  
| \------ | \------ | \------ |  
| USERS | \- | Lưu trữ thông tin định danh và trạng thái xóa mềm của người dùng. |  
| WORKSPACES | \- | Đơn vị quản lý cấp cao nhất cho việc cô lập dữ liệu. |  
| ROLE | \- | Danh mục các quyền hạn có thể gán cho thành viên. |  
| WORKSPACE\_MEMBERS | workspace\_id, user\_id, role\_id | Định danh người dùng trong một không gian làm việc cụ thể. |  
| WALLETS | \- | Quản lý số dư đầu kỳ (opening\_balance) và số dư thực tế. |  
| WORKSPACE\_WALLET | workspace\_id, wallet\_id | Cho phép chia sẻ nguồn tiền giữa các không gian làm việc. |  
| CATEGORY | workspace\_id | Phân loại giao dịch, hỗ trợ hiển thị qua color và order. |  
| TRANSACTION | member\_id, wallet\_id, to\_wallet\_id, category\_id | Ghi nhận biến động dòng tiền dựa trên TRANSACTION\_TYPE. |  
