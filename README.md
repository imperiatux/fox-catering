# Fox Catering

A responsive React web app for collecting daily weekday lunch orders from a small office group. The organizer uploads the catering company's daily menu picture; colleagues submit a nickname-only order before the daily cut-off.

---

## Table of Contents

- [Running with Docker (recommended)](#running-with-docker-recommended)
- [Local Development (no Docker)](#local-development-no-docker)
- [Environment Variables](#environment-variables)
- [Deployment to Vercel](#deployment-to-vercel)
- [Privacy Boundaries](#privacy-boundaries)
- [Daily Organizer Workflow](#daily-organizer-workflow)
- [Project Structure](#project-structure)

---

## Running with Docker (recommended)

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine + Compose

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/<your-org>/fox-catering.git
cd fox-catering

# 2. Create a .env file with at minimum the organizer password
cp .env.example .env
# → edit .env and set ADMIN_PASSWORD

# 3. Build and start all services
docker compose up --build
```

The app is available at **http://localhost:3000**.

Two containers start together:

| Service | Role |
|---|---|
| `app` | Express server — serves the built React frontend and all API routes |
| `redis` | Ephemeral Redis store — holds daily menu images and orders (TTL-based expiry) |

### Cross-platform builds (Apple Silicon → amd64 server)

If your development machine is Apple Silicon (arm64) and the target server is amd64:

```bash
docker buildx build --platform linux/amd64 -t fox-catering-app --load .
docker save fox-catering-app | gzip > fox-catering-amd64.tar.gz
# transfer and load on the server:
docker load < fox-catering-amd64.tar.gz
```

### Stopping

```bash
docker compose down
```

---

## Local Development (no Docker)

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/) 11+

### Steps

```bash
pnpm install

# Frontend only (no API)
pnpm dev

# Full stack: requires a running Redis instance
# Set REDIS_URL=redis://localhost:6379 in .env, then:
pnpm run build:all
node dist-server/server/index.js
```

### Build commands

| Command | Output |
|---|---|
| `pnpm run build` | Vite frontend → `dist/` |
| `pnpm run build:server` | Express server → `dist-server/` |
| `pnpm run build:all` | Both of the above |
| `pnpm run typecheck` | TypeScript check across all three tsconfigs |
| `pnpm test` | Vitest unit + API tests |

---

## Environment Variables

Copy `.env.example` to `.env` (Docker) or `.env.local` (Vercel dev). **Never commit either file.**

| Variable | Required for | Description |
|---|---|---|
| `ADMIN_PASSWORD` | All | Organizer admin password. Server-side only. Min 16 characters recommended. |
| `COOKIE_SECURE` | Docker/HTTP | Set to `"false"` to omit the `Secure` cookie flag on plain HTTP. Defaults to secure. Already set in `docker-compose.yml`. |
| `REDIS_URL` | Docker/local | Redis connection string, e.g. `redis://localhost:6379`. Set automatically by `docker-compose.yml`. |
| `CUTOFF_HOUR` | Optional | Hour of the daily order cutoff in Europe/Bucharest time (default: `10`). |
| `CUTOFF_MINUTE` | Optional | Minute of the daily order cutoff (default: `30`). |
| `KV_REST_API_URL` | Vercel only | Vercel KV (Upstash Redis) REST endpoint URL. |
| `KV_REST_API_TOKEN` | Vercel only | Vercel KV read-write access token. |

### Testing after the cutoff

To keep ordering open past 10:30 (e.g. during local testing), either:

- Set `CUTOFF_HOUR=23 CUTOFF_MINUTE=59` in `.env` before `docker compose up`, **or**
- Log in as admin and use the **Cutoff Toggle** at the top of the dashboard — takes effect instantly, resets on container restart.

---

## Deployment to Vercel

This project can also deploy to **Vercel** as a static React site with serverless API routes. Vercel KV (Upstash Redis) replaces the local Redis container.

### First deploy

```bash
pnpm add -g vercel
vercel link
vercel --prod
```

### Subsequent deploys

Push to the `main` branch — Vercel's GitHub integration deploys automatically.

### Production secrets (Vercel dashboard)

**Project → Settings → Environment Variables:**

- `ADMIN_PASSWORD`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

### Getting KV credentials

1. Open the [Vercel dashboard](https://vercel.com/dashboard) → **Storage** → create a **KV** store.
2. Link the store to your project.
3. Under the store's **Quickstart / .env.local** tab, copy `KV_REST_API_URL` and `KV_REST_API_TOKEN`.

---

## Privacy Boundaries

| What is stored | Where | Retention |
|---|---|---|
| Menu image (uploaded by organizer) | Redis, keyed by date | Auto-deleted after 3 days via TTL |
| Order: date, nickname, selected courses, optional note | Redis, keyed by date | Auto-deleted after 3 days via TTL |

**What is NOT collected:**

- Names, email addresses, phone numbers, or any contact details
- IP addresses, browser fingerprints, or session identifiers
- Account credentials of any kind (one organizer password, server-side only)

The repository is public; secrets and private order data never appear in source code or git history.

---

## Daily Organizer Workflow

Each weekday, Monday–Friday:

1. **Open the admin panel** at `/admin` and log in with the organizer password.
2. **Go to the "Menu Image" tab**, select today's date, and click **"Upload menu image"** — upload the catering company's JPEG/PNG photo of the daily menu. The image is saved to Redis and immediately shown on the public order page.
3. **Share the ordering link** (`/`) with colleagues via the office chat.
4. **At 10:30 Europe/Bucharest time** the system closes ordering automatically. After the cutoff the public page shows only the "Ordering closed" banner — no form, no image, no orders list. The cutoff can be toggled off temporarily from the admin dashboard if needed.
5. **Open the Orders tab** in the admin panel — the daily menu image is shown at the top for reference. Review the summary counts (Non-vegetarian / Vegetarian / Custom) and the custom-orders table, then place the consolidated phone order.
6. Optionally **export as CSV** for records.

Orders and menu images are automatically deleted from Redis after three days — no manual cleanup required.

---

## Project Structure

```
fox-catering/
├── api/                          # Serverless API handlers (Vercel / Express)
│   ├── config.ts                 # GET  /api/config — public runtime config (cutoff time)
│   ├── health.ts                 # GET  /api/health — liveness probe
│   ├── menu-image.ts             # GET  /api/menu-image — public daily menu image
│   ├── orders.ts                 # GET/POST/DELETE /api/orders — public ordering
│   ├── admin/
│   │   ├── cutoff.ts             # GET/POST /api/admin/cutoff — cutoff toggle
│   │   ├── export.ts             # GET  /api/admin/export — CSV download
│   │   ├── login.ts              # POST /api/admin/login — session cookie auth
│   │   ├── logout.ts             # POST /api/admin/logout
│   │   ├── orders.ts             # GET  /api/admin/orders — all orders for a date
│   │   └── parse-menu.ts         # POST /api/admin/parse-menu — store uploaded image
│   └── lib/
│       ├── auth.ts               # HMAC session cookie verification
│       ├── cutoff-override.ts    # In-memory runtime cutoff override store
│       ├── kv.ts                 # Redis/KV storage helpers (ioredis or @vercel/kv)
│       ├── storage-keys.ts       # Key naming conventions
│       └── validation.ts         # Shared server-side validators + cutoff logic
├── server/
│   └── index.ts                  # Express entry point for Docker deployment
├── src/                          # React frontend
│   ├── App.tsx                   # Client-side router
│   ├── index.css                 # Global stylesheet (CSS custom properties, mobile-first)
│   ├── main.tsx                  # React 18 entry point
│   ├── types.ts                  # Shared TypeScript types + MENU_OPTIONS constants
│   ├── hooks/
│   │   ├── useConfig.ts          # Fetches /api/config (cutoff time)
│   │   ├── useMenuImage.ts       # Fetches today's menu image
│   │   └── useOrders.ts          # Fetches today's orders
│   ├── pages/
│   │   ├── AdminDashboardPage.tsx  # Menu image upload, orders view, CSV export, cutoff toggle
│   │   ├── AdminLoginPage.tsx      # Password login form
│   │   └── OrderPage.tsx           # Public daily ordering UI
│   └── utils/
│       └── date.ts               # Bucharest timezone helpers
├── .dockerignore
├── .env.example                  # Environment variable documentation (no real values)
├── .npmrc                        # pnpm build script allowlist
├── Dockerfile                    # Multi-stage build: deps → build → runtime
├── docker-compose.yml            # app + redis services
├── index.html                    # Vite HTML entry
├── package.json
├── PLAN.md                       # Implementation plan and decisions log
├── tsconfig.api.json             # API TypeScript config (CommonJS)
├── tsconfig.app.json             # Frontend TypeScript config
├── tsconfig.node.json            # Vite config TypeScript config
├── tsconfig.server.json          # Express server TypeScript config
├── vercel.json                   # Vercel routing, build, and function config
└── vitest.config.ts              # Test runner config
```
