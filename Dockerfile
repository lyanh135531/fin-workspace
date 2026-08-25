FROM node:22-alpine AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder
COPY . .
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV APP_TIME_ZONE="Asia/Ho_Chi_Minh"
ENV PORT=15730
RUN pnpm prisma:generate && pnpm build

FROM dependencies AS migrate
COPY . .
CMD ["pnpm", "prisma:deploy"]

FROM node:22-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY scripts/recurring-worker.mjs scripts/financial-plan-worker.mjs ./
USER node
CMD ["node", "recurring-worker.mjs"]

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=15730
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 15730
CMD ["node", "server.js"]
