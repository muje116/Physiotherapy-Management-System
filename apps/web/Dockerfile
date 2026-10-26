FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate
WORKDIR /app

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/schema ./packages/schema
COPY apps/web ./apps/web

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @physiocore/schema build
RUN pnpm --filter @physiocore/web build

FROM node:20-alpine AS runner
RUN addgroup -S physiocore && adduser -S physiocore -G physiocore
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=physiocore:physiocore /app/apps/web/.next/standalone ./
COPY --from=builder --chown=physiocore:physiocore /app/apps/web/.next/static ./apps/web/.next/static

USER physiocore
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3000 || exit 1
CMD ["node", "apps/web/server.js"]
