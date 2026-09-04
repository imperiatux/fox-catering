# Fox Catering Daily Ordering App — Implementation Plan

## Overview

A responsive React web application in the public `fox-catering` GitHub repository for collecting daily weekday lunch orders. The organizer manually enters the vegetarian and non-vegetarian menus published by the catering company. Visitors can select either predefined menu or mix main and secondary courses into a custom menu, then submit a nickname-only order.

The system uses a static React frontend and a small serverless API. It does not scrape Facebook, use a database, or collect sensitive information. The API stores private JSON objects by date in Redis with automatic TTL expiry, retaining only the order date, nickname, and selected courses. The organizer accesses protected administration with one password supplied solely as a deployment secret.

**Deployment target:** Docker (primary — Express + Redis + Tesseract OCR) and Vercel (secondary — serverless + Upstash KV).

---

## Sub-Tasks

### 1. Establish the application and deployment foundation

**Status:** [x] complete

**Decisions made:**
- **Provider:** Vercel for cloud deployment; Docker + Express for local/self-hosted.
- **Package manager:** pnpm
- **Frontend:** Vite + React 18 + TypeScript (strict)
- **Storage:** `@vercel/kv` on Vercel; `ioredis` against a Redis container locally — the same `api/lib/kv.ts` module selects the backend based on the `REDIS_URL` env var.

**Delivered:**
- Vite + React + TypeScript project scaffold
- `vercel.json` with SPA fallback and `/api/*` rewrites
- Global mobile-first CSS with CSS custom properties
- `.env.example` documenting all variable names
- Multi-stage `Dockerfile` (node:22-alpine) and `docker-compose.yml` (`app` + `redis` + `ocr`)
- `server/index.ts` — Express adapter that mounts all Vercel-style handlers
- Full `README.md` covering Docker setup, local dev, Vercel deployment, privacy, and daily workflow

---

### 2. Model daily menus and private temporary storage

**Status:** [x] complete

**Delivered:**
- `src/types.ts` — shared TypeScript interfaces: `MenuVariant`, `DailyMenu`, `Order`, `DailyOrders`, `SubmitOrderRequest`, `AdminMenuRequest`, `ApiError`, `ParseMenuResponse`
- `api/lib/storage-keys.ts` — `menu:{YYYY-MM-DD}` / `orders:{YYYY-MM-DD}` key conventions
- `api/lib/kv.ts` — `getMenu`, `setMenu`, `getOrders`, `setOrders`; 3-day TTL; auto-selects `ioredis` (Docker) or `@vercel/kv` (Vercel) based on `REDIS_URL`
- `api/lib/validation.ts` — `normalizeNickname`, `validateNickname`, `validateDate`, `validateMenuVariant`, `getCutoff`, `isCutoffPassed`

---

### 3. Deliver the public daily ordering experience

**Status:** [x] complete

**Delivered:**
- `GET /api/menu` — returns daily menu or 404
- `GET/POST/DELETE /api/orders` — public order read/submit/remove with cutoff enforcement (403 after cutoff)
- `GET /api/config` — exposes `cutoffHour`, `cutoffMinute`, `cutoffEnabled` to the frontend
- `src/utils/date.ts` — `getTodayBucharest`, `isWeekend`, `isCutoffPassed`, `minutesUntilCutoff`, `formatDateDisplay` (all via `Intl`, no external timezone libs)
- `src/hooks/useMenu.ts`, `useOrders.ts`, `useConfig.ts`
- `src/pages/OrderPage.tsx`:
  - Loading / weekend / no-menu / cutoff-passed states
  - Two menu cards (veg / non-veg)
  - Quick-select variant buttons + custom main/secondary dropdowns for mix-and-match
  - Nickname field with `localStorage` persistence
  - Create / replace / remove order actions
  - Today's orders list (public)
  - Cutoff countdown banner
  - Privacy notice footer

---

### 4. Implement protected menu administration and daily order reporting

**Status:** [x] complete

**Delivered:**
- `POST /api/admin/login` — timing-safe password check; sets HMAC-SHA256 signed `HttpOnly` session cookie (8 h); `Secure` flag controlled by `COOKIE_SECURE` env var (omitted on plain HTTP for Docker)
- `POST /api/admin/logout` — clears cookie
- `GET/PUT /api/admin/menu` — session-gated menu read/write
- `GET /api/admin/orders` — session-gated orders read
- `GET /api/admin/export` — session-gated CSV download
- `GET/POST /api/admin/cutoff` — runtime cutoff toggle (see §6)
- `POST /api/admin/parse-menu` — OCR-based menu image parser (see §6)
- `api/lib/auth.ts` — `verifyAdminSession`: manual cookie parsing, HMAC re-verification, age check
- `src/pages/AdminLoginPage.tsx` — password form
- `src/pages/AdminDashboardPage.tsx` — Menu Management tab + Orders tab + Cutoff Toggle widget

---

### 5. Verify cutoff, privacy, and operational behavior

**Status:** [x] complete

**Delivered:**
- `api/lib/validation.test.ts` — normalizeNickname, validateNickname, validateDate, validateMenuVariant, isCutoffPassed (with `vi.setSystemTime` for 10:30 boundary in EEST)
- `api/lib/storage-keys.test.ts` — key format assertions
- `api/lib/auth.test.ts` — valid token, expired token, tampered token, missing cookie
- `api/orders.test.ts` — POST cutoff rejection, invalid nickname, valid submit, DELETE cutoff rejection, DELETE valid
- `src/utils/date.test.ts` — isWeekend, isCutoffPassed, formatDateDisplay
- All 24 tests pass; typecheck (3 tsconfigs) and production build are clean
- Privacy review passed: no secrets in source, orders store only date/nickname/main/secondary, `HttpOnly` cookie, `dist-server/` excluded from test runner

---

### 6. Post-plan additions

These features were added after the original five sub-tasks were complete.

#### 6a. Docker deployment

**Status:** [x] complete

- `Dockerfile` (multi-stage, node:22-alpine, pnpm pinned to 11.25.0)
- `docker-compose.yml` — `app` + `redis:7-alpine` + `ocr` (Tesseract)
- `.dockerignore` — excludes `node_modules/`, `dist/`, `dist-server/`, `.env`
- `.npmrc` — `onlyBuiltDependencies[]=esbuild` to allow esbuild install scripts
- `pnpm-workspace.yaml` — `allowBuilds: esbuild: true`
- `server/index.ts` — Express adapter: routes all API handlers, bypasses body parser for multipart, serves `dist/` statically with SPA fallback
- `tsconfig.server.json` — CJS output to `dist-server/`; `build:server` script writes `dist-server/package.json` with `"type":"commonjs"` to override root `"type":"module"`
- `COOKIE_SECURE=false` in `docker-compose.yml` so the admin session cookie works over plain HTTP on localhost

#### 6b. Configurable cutoff time

**Status:** [x] complete

- `CUTOFF_HOUR` / `CUTOFF_MINUTE` env vars override the default 10:30 cutoff
- `api/lib/validation.ts` `getCutoff()` reads env vars, then applies any runtime override
- `GET /api/config` exposes effective cutoff values to the frontend
- `src/utils/date.ts` `isCutoffPassed` and `minutesUntilCutoff` accept `cutoffHour`/`cutoffMinute` parameters
- `src/hooks/useConfig.ts` fetches `/api/config` on mount; `OrderPage` uses it for client-side cutoff display

#### 6c. Runtime cutoff toggle (admin)

**Status:** [x] complete

- `api/lib/cutoff-override.ts` — in-memory `CutoffOverride` store (resets on restart)
- `GET/POST /api/admin/cutoff` — session-gated read/write of the override
- `getCutoff()` in `validation.ts` checks the override first, then env vars, then default 10:30
- `CutoffToggle` component in `AdminDashboardPage` — green/orange status bar with one-click toggle; shows "runtime override" badge when active; refreshes on POST response

#### 6d. Menu image OCR (local Tesseract)

**Status:** [x] complete

- `ocr/Dockerfile` — extends `hertzg/tesseract-server:latest`; downloads Romanian (`ron`) Tesseract language pack at build time
- `api/admin/parse-menu.ts`:
  - Reads multipart upload via `@fastify/busboy`
  - POSTs image to `OCR_URL/tesseract` with `languages: ["ron","eng"]`
  - Parses raw OCR text with a heuristic splitter (vegetarian/non-veg section headers → `Fel principal` / `Fel secundar` / `Garnitura` / `Supa` keywords)
  - Returns `{ vegetarian, nonVegetarian, raw }` — `raw` shown in UI for transparency
- `openai` dependency removed; no external API calls for OCR
- `AdminDashboardPage` — "Upload menu image" button pre-fills the four form fields; organizer reviews and corrects before saving
- `OCR_URL` wired in `docker-compose.yml` (`http://ocr:8884`); `ocr` service health-checked before `app` starts

#### 6e. Nickname casing preservation

**Status:** [x] complete

- `normalizeNickname` in `api/lib/validation.ts` changed from `.trim().toLowerCase()` to `.trim()` — nicknames are now stored and matched with their original casing
- `OrderPage.tsx` displays the stored nickname as-is (no client-side transform)

---

#### 6f. Categorised orders summary in admin dashboard

**Status:** [x] complete

**Delivered:**
- `AdminDashboardPage.tsx` — `OrdersTab` now fetches `/api/admin/orders` and `/api/admin/menu` in parallel
- `buildSummary()` replaced by `categoriseOrders(orders, menu)` which classifies each order into:
  - **Non-vegetarian** — main and secondary both match the non-veg variant exactly
  - **Vegetarian** — main and secondary both match the veg variant exactly
  - **Custom** — any other combination (mix of variants, or no menu available)
- Summary card shows three bold counts (Non-vegetarian / Vegetarian / Custom) above the per-nickname table
- Orders table gains a **Type** column (Non-veg / Veg / Custom) per row
- `src/index.css` — `.admin-summary-counts` layout for the three-count summary card
- `api/lib/validation.test.ts` and `api/orders.test.ts` — updated to expect trim-only (casing-preserved) nicknames; all 24 tests pass
