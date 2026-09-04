# syntax=docker/dockerfile:1

# ── Stage 1: install dependencies ─────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: build frontend + server ──────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

ENV CI=true

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Vite frontend → dist/
# Build Express server → dist-server/
RUN pnpm run build && pnpm run build:server

# ── Stage 3: production image ──────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Only copy what is needed at runtime
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["node", "dist-server/server/index.js"]
