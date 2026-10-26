FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate
WORKDIR /app

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json ./

COPY packages/db ./packages/db
COPY packages/schema ./packages/schema
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @physiocore/db generate
RUN pnpm --filter @physiocore/db build
RUN pnpm --filter @physiocore/schema build
RUN pnpm --filter @physiocore/api build

FROM node:20-alpine
RUN addgroup -S physiocore && adduser -S physiocore -G physiocore
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/schema/package.json ./packages/schema/package.json
COPY --from=builder /app/packages/schema/dist ./packages/schema/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:4000/live || exit 1

USER physiocore
CMD ["node", "apps/api/dist/index.js"]
