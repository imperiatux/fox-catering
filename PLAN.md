# Fox Catering Daily Ordering App — Implementation Plan

## Overview

A responsive React web application in the public `fox-catering` GitHub repository for collecting daily weekday lunch orders. The organizer uploads the catering company's daily menu photo; colleagues select one of four fixed course options (Non-Vegi: Soup, Non-Vegi: Main, Vegi: Soup, Vegi: Main) and submit a nickname-only order before the daily cut-off.

The system uses a static React frontend and a small serverless API. It does not scrape Facebook, use a database, or collect sensitive information. The API stores private JSON objects by date in Redis with automatic TTL expiry, retaining only the order date, nickname, selected courses, and an optional note. The organizer accesses protected administration with one password supplied solely as a deployment secret.

**Deployment target:** Docker (primary — Express + Redis) and Vercel (secondary — serverless + Upstash KV).

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
- Multi-stage `Dockerfile` (node:22-alpine) and `docker-compose.yml` (`app` + `redis`)
- `server/index.ts` — Express adapter that mounts all Vercel-style handlers
- Full `README.md` covering Docker setup, local dev, Vercel deployment, privacy, and daily workflow

---

### 2. Model daily orders and private temporary storage

**Status:** [x] complete

**Delivered:**
- `src/types.ts` — shared TypeScript types: `MENU_OPTIONS` constants, `MenuOption`, `VALID_MAINS`, `VALID_SECONDARIES`, `Order`, `DailyOrders`, `SubmitOrderRequest`, `ApiError`
- `api/lib/storage-keys.ts` — `orders:{YYYY-MM-DD}` / `menu-image:{YYYY-MM-DD}` key conventions
- `api/lib/kv.ts` — `getOrders`, `setOrders`, `getMenuImage`, `setMenuImage`; 3-day TTL; auto-selects `ioredis` (Docker) or `@vercel/kv` (Vercel) based on `REDIS_URL`
- `api/lib/validation.ts` — `normalizeNickname`, `validateNickname`, `validateDate`, `getCutoff`, `isCutoffPassed`

---

### 3. Deliver the public daily ordering experience

**Status:** [x] complete

**Delivered:**
- `GET /api/menu-image` — returns today's stored menu image data URL or 404
- `GET/POST/DELETE /api/orders` — public order read/submit/remove with cutoff enforcement (403 after cutoff)
- `GET /api/config` — exposes `cutoffHour`, `cutoffMinute`, `cutoffEnabled` to the frontend
- `src/utils/date.ts` — `getTodayBucharest`, `isWeekend`, `isCutoffPassed`, `minutesUntilCutoff`, `formatDateDisplay` (all via `Intl`, no external timezone libs)
- `src/hooks/useMenuImage.ts`, `useOrders.ts`, `useConfig.ts`
- `src/pages/OrderPage.tsx`:
  - Loading / weekend states
  - After cutoff: shows only the "Ordering closed" banner — no image, no form, no orders list
  - Before cutoff: menu image (if uploaded), order form, today's orders list
  - Four fixed course options via quick-select buttons (🥩 Non-Vegetarian / 🥦 Vegetarian) and individual dropdowns — **Non-Vegetarian pre-selected by default**
  - Optional "Special request for main course" note field (max 100 chars)
  - Nickname field with `localStorage` persistence
  - Create / replace / remove order actions
  - Cutoff countdown banner
  - Privacy notice footer

---

### 4. Implement protected menu administration and daily order reporting

**Status:** [x] complete

**Delivered:**
- `POST /api/admin/login` — timing-safe password check; sets HMAC-SHA256 signed `HttpOnly` session cookie (8 h); `Secure` flag controlled by `COOKIE_SECURE` env var
- `POST /api/admin/logout` — clears cookie
- `POST /api/admin/parse-menu?date=` — session-gated multipart image upload; stores image as base64 data URL in Redis
- `GET /api/admin/orders` — session-gated orders read
- `GET /api/admin/export` — session-gated CSV download (columns: nickname, main, note, secondary)
- `GET/POST /api/admin/cutoff` — runtime cutoff toggle
- `api/lib/auth.ts` — `verifyAdminSession`: manual cookie parsing, HMAC re-verification, age check
- `src/pages/AdminLoginPage.tsx` — password form
- `src/pages/AdminDashboardPage.tsx`:
  - **Menu Image tab** — date picker + image upload; loads and displays already-stored image for selected date
  - **Orders tab** — date picker; fetches menu image + orders in parallel; shows image above the summary; three-count summary (Non-vegetarian / Vegetarian / Custom); custom-orders table by default with "Show all orders" toggle; Type column in full view
  - **Cutoff Toggle** — green/orange status bar with one-click toggle; "runtime override" badge when active

---

### 5. Verify cutoff, privacy, and operational behavior

**Status:** [x] complete

**Delivered:**
- `api/lib/validation.test.ts` — normalizeNickname, validateNickname, validateDate, isCutoffPassed (with `vi.setSystemTime` for 10:30 boundary in EEST)
- `api/lib/storage-keys.test.ts` — key format assertions for orders and menu-image keys
- `api/lib/auth.test.ts` — valid token, expired token, tampered token, missing cookie
- `api/orders.test.ts` — POST cutoff rejection, invalid nickname, valid submit using `MENU_OPTIONS` constants, DELETE cutoff rejection, DELETE valid
- `src/utils/date.test.ts` — isWeekend, isCutoffPassed, formatDateDisplay
- All 24 tests pass; typecheck (3 tsconfigs) and production build are clean
- Privacy review passed: no secrets in source, orders store only date/nickname/main/secondary/note, `HttpOnly` cookie, `dist-server/` excluded from test runner

---

### 6. Post-plan additions

These features were added after the original five sub-tasks were complete.

#### 6a. Docker deployment

**Status:** [x] complete

- `Dockerfile` (multi-stage, node:22-alpine, pnpm pinned to 11.25.0)
- `docker-compose.yml` — `app` + `redis:7-alpine`
- `.dockerignore` — excludes `node_modules/`, `dist/`, `dist-server/`, `.env`
- `.npmrc` / `pnpm-workspace.yaml` — `allowBuilds: esbuild`
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
- `CutoffToggle` component in `AdminDashboardPage` — green/orange status bar with one-click toggle; shows "runtime override" badge when active

#### 6d. Menu image upload and public display

**Status:** [x] complete

- `POST /api/admin/parse-menu?date=` — reads multipart upload via `@fastify/busboy`; stores original image as base64 data URL in Redis under `menu-image:{date}`
- `GET /api/menu-image?date=` — public endpoint returning `{ dataUrl }` or 404
- `src/hooks/useMenuImage.ts` — fetches today's image on mount
- `OrderPage` — image displayed between the cutoff banner and the order form (only before cutoff)
- `AdminDashboardPage` Menu Image tab — shows stored image on load; new upload replaces it
- `AdminDashboardPage` Orders tab — fetches and shows the menu image above the summary card
- Image keyed by date; automatically expires after 3 days; next day's key is always empty until admin uploads

#### 6e. Nickname casing preservation

**Status:** [x] complete

- `normalizeNickname` in `api/lib/validation.ts` changed from `.trim().toLowerCase()` to `.trim()` — nicknames are now stored and matched with their original casing

#### 6f. Categorised orders summary in admin dashboard

**Status:** [x] complete

- `classifyOrder(o)` uses `MENU_OPTIONS` constants; any order with a non-empty `note` is classified as **Custom** regardless of course selection
- Summary card shows three bold counts (Non-vegetarian / Vegetarian / Custom)
- Default table view shows custom orders only; "Show all orders" toggle reveals all with a Type column

#### 6g. Optional main-course note

**Status:** [x] complete

- `Order.note?: string` and `SubmitOrderRequest.note?: string` added to types
- API validates (string, ≤ 100 chars, trimmed) and stores note only when non-empty
- Order form shows "Special request for main course (optional)" text input below the main-course select
- Existing order pre-fills the note field on load
- Note shown inline (italic, muted) in the public orders list and current-order card
- Admin orders table has a **Note** column; CSV export includes a `note` column
- CSV export updated: `nickname,main,note,secondary`

#### 6h. Fixed generic course names (no menu text entry)

**Status:** [x] complete

- Menu text entry removed entirely; four fixed course labels defined as `MENU_OPTIONS` constants in `src/types.ts`:
  - `"Non-Vegi: Soup"`, `"Non-Vegi: Main"`, `"Vegi: Soup"`, `"Vegi: Main"`
- API validates submitted courses against `VALID_MAINS` / `VALID_SECONDARIES` constant arrays (no menu lookup in Redis)
- `api/menu.ts`, `api/admin/menu.ts`, `src/hooks/useMenu.ts`, `DailyMenu`/`MenuVariant`/`AdminMenuRequest` types all removed
- Admin "Menu Management" tab renamed to **"Menu Image"** — image upload only, no form fields
- Public order page: Non-Vegetarian menu pre-selected by default; Non-veg option listed first in buttons and dropdowns
- After cutoff: public page shows **only** the closed banner — no image, no form, no orders list

#### 6i. OCR removal

**Status:** [x] complete

- `ocr/` directory (Tesseract Dockerfile + Romanian language pack) deleted
- `sharp` dependency removed
- `preprocessForOcr`, `runOcr`, `parseMenuText`, `cleanDish` and all OCR logic removed from `api/admin/parse-menu.ts`
- `ocr` service, `OCR_URL` env var, and `depends_on: ocr` removed from `docker-compose.yml`
- `OPENAI_API_KEY` entry removed from `.env.example`
- `pnpm-workspace.yaml` and `.npmrc` updated to remove `sharp` build permissions

#### 6j. Multi-order per nickname

**Status:** [x] complete

- `Order.id: string` added to `src/types.ts` — server-generated UUID, used for targeted deletion
- **POST** no longer replaces an existing order; it always appends a new entry; `id = crypto.randomUUID()` generated server-side
- **DELETE** now accepts `{ id, date }` in the request body and filters by `Order.id` (returns 404 if not found); nickname is no longer required
- `src/pages/OrderPage.tsx`:
  - `myOrder` (single) replaced by `myOrders: Order[]` (all orders for this nickname)
  - Pre-fill-from-existing logic removed; form always starts with defaults (Non-Veg, qty 1, empty note)
  - After a successful POST the form resets to defaults via `resetForm()`
  - "Your order(s) today" card lists each order with its own **Remove** button (`deletingId: string | null` tracks which is in-flight)
  - "Update Order" button and single-order remove replaced by always-present **"Place Order"** button
  - Public orders list key changed from `order.nickname` to `order.id`
- `api/orders.test.ts` updated: mock data includes `id` fields; DELETE tests send `{ id }` instead of `{ nickname }`
- CSS: `.my-orders-list`, `.my-orders-list__item`, `.my-orders-list__detail` added to `src/index.css`
