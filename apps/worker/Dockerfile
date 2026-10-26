FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate
WORKDIR /app

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json ./

COPY packages/db ./packages/db
COPY apps/worker ./apps/worker

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @physiocore/db generate
RUN pnpm --filter @physiocore/db build
RUN pnpm --filter @physiocore/worker build

FROM node:20-alpine
RUN addgroup -S physiocore && adduser -S physiocore -G physiocore
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/worker/package.json ./apps/worker/package.json

USER physiocore
CMD ["node", "apps/worker/dist/index.js"]
