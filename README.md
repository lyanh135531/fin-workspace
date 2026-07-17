# Fin Workspace

## Local operations

1. Copy `.env.example` to `.env` and set `DATABASE_URL` and `NEXTAUTH_SECRET`.
2. Run `pnpm prisma:deploy` to apply migrations.
3. Run `pnpm dev` for local development, or `pnpm build` then `pnpm start` for production.

Do not run raw balance updates. Financial mutations belong in `src/services` and must use Prisma transactions.
