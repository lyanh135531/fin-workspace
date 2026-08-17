# Felix

> Do not run raw balance updates. Financial mutations belong in `src/services` and must use Prisma transactions.

---

## Deploy với Docker *(khuyên dùng)*

```bash
cp .env.example .env
# Sửa POSTGRES_PASSWORD và NEXTAUTH_SECRET trong .env
# Nếu deploy sau một domain, đổi NEXTAUTH_URL thành URL public của ứng dụng.

docker compose up --build -d
```

Docker tự động chạy theo thứ tự: **PostgreSQL** → **migration** → **app** (port 15730).
Container `recurring-worker` kiểm tra giao dịch định kỳ mỗi phút và gọi endpoint nội bộ
bằng token được dẫn xuất từ `NEXTAUTH_SECRET`. Có thể cấu hình secret riêng bằng
`RECURRING_WORKER_SECRET` (`openssl rand -hex 32`).

### Backup PostgreSQL lúc 02:00 mỗi ngày

Script backup tạo dump đã kiểm tra, lưu checksum SHA-256 và chỉ giữ lại 2 bản
gần nhất. Bản cũ chỉ bị xóa sau khi bản mới đã backup và xác minh thành công.

Chạy thử thủ công trước:

```bash
chmod +x scripts/backup-database.sh
./scripts/backup-database.sh
```

Sau đó mở crontab của đúng Linux user đang chạy Docker:

```bash
crontab -e
```

Thêm dòng sau và thay `/srv/felix` bằng đường dẫn tuyệt đối tới project:

```cron
0 2 * * * /srv/felix/scripts/backup-database.sh >> /srv/felix/backups/backup.log 2>&1
```

Cron dùng timezone của Linux server. Kiểm tra bằng `timedatectl`; nếu muốn chạy
lúc 02:00 giờ Việt Nam thì server cần dùng timezone `Asia/Ho_Chi_Minh`.
Các file backup nằm trong `backups/`; có thể truyền thư mục khác làm tham số đầu
tiên cho script.

---

## Local Development

```bash
cp .env.example .env
# Sửa POSTGRES_PASSWORD, NEXTAUTH_SECRET
# Đổi host trong DATABASE_URL: "db" → "localhost", port "5432" → "15432"

pnpm install
pnpm prisma:deploy
pnpm dev
```

Yêu cầu: PostgreSQL đang chạy trên `localhost:15432` (hoặc `localhost:5432` nếu không dùng Docker).
