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
