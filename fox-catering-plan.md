# Fox Catering App — Implementation Plan

## Top-Level Overview

Build a responsive full-stack web application for managing daily lunch menu orders from the Fox catering company.

**Stack:** Next.js 16 (App Router, TypeScript) · Redis (ioredis) · Tailwind CSS v4 · `next-intl` · Docker Compose  
**Scope:**
- Public order page: browse menu photo, pick menu type/courses (non-veg / veg / mixed), set quantity, enter nickname, special request note, preview & confirm order, edit/delete own order
- Admin dashboard: upload/paste menu photo, view & delete all orders, grouped summary with WhatsApp send, settings (cutoff time, active weekdays, WhatsApp phone), admin login
- i18n: Romanian (default) + English via `next-intl` — flag switcher, cookie-persisted locale
- No database of users or sensitive data; nicknames stored client-side only (localStorage)

**Non-goals:** User accounts, email notifications, payment, multi-day order history, mobile push.

---

## Sub-Tasks

---

### Sub-Task 1 — Project Scaffold & Docker Compose Environment

**Status:** `[x] complete`

**Delivered:**
- Next.js 16 with TypeScript, App Router, Tailwind CSS v4, ESLint, `src/` layout
- Dependencies: `ioredis`, `next-intl`, `uuid`, `js-cookie`, `sharp`
- `docker-compose.yml` with `app` (port 3000) and `redis:7-alpine` (port 6379) services, named volumes
- Multi-stage `Dockerfile` (deps → builder → runner, standalone output)
- `.env.example` documenting all required variables
- `src/lib/redis.ts` singleton ioredis client
- `src/components/`, `src/lib/`, `src/i18n/` directory structure

---

### Sub-Task 2 — i18n Setup (Romanian + English)

**Status:** `[x] complete`

**Delivered:**
- `next-intl` configured via `src/i18n/request.ts` (no locale routing — cookie-based)
- `src/proxy.ts` sets `NEXT_LOCALE` cookie on first visit, defaults to `ro` (ignores `Accept-Language`)
- Full translation files `src/i18n/ro.json` and `src/i18n/en.json`
- `LanguageSwitcher` component shows 🇷🇴 / 🇬🇧 flag buttons; active flag highlighted; locale passed as prop from server layout to avoid SSR/CSR mismatch

---

### Sub-Task 3 — Redis Data Layer

**Status:** `[x] complete`

**Delivered:**
- `src/types/index.ts`: `Order`, `MenuType`, `CourseSelection`, `AppSettings` types
- `src/lib/redis.ts`: `getOrders`, `addOrder`, `deleteOrder`, `updateOrder`, `getMenuPhoto`, `setMenuPhoto`, `deleteMenuPhoto`, `getSettings`, `setSettings`, `setSession`, `getSession`, `deleteSession`
- Redis key schema: `orders:YYYY-MM-DD` (list), `menu:YYYY-MM-DD` (string), `settings` (hash), `session:<token>` (string, 8h TTL)
- Default settings seeded on first access: `cutoffHour=10`, `cutoffMinute=30`, `cutoffEnabled=true`, `activeDays=[1-7]`, `whatsappPhone=""`

---

### Sub-Task 4 — Admin Authentication

**Status:** `[x] complete`

**Delivered:**
- `POST /api/admin/login` — validates against `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars, sets HTTP-only `admin_session` cookie, stores token in Redis (8h TTL)
- `POST /api/admin/logout` — clears cookie and Redis session
- `src/proxy.ts` guards all `/admin/*` and `/api/admin/*` paths; `/admin/login` and `/api/admin/login` are excluded
- `src/app/admin/(auth)/login/page.tsx` — login form with error feedback
- `src/lib/auth.ts` — `validateAdminSession(request)` helper

---

### Sub-Task 5 — Admin Menu Upload

**Status:** `[x] complete`

**Delivered:**
- `GET /api/admin/menu` — returns current day's photo filename and URL
- `POST /api/admin/menu` — accepts `multipart/form-data`, converts to JPEG via `sharp`, saves to `/public/uploads/menu-YYYY-MM-DD.jpg`, updates Redis
- `src/app/admin/(dashboard)/menu/page.tsx` — drag-and-drop, file picker, clipboard paste (`Ctrl+V`), live preview
- `src/app/uploads/[filename]/route.ts` — streams uploaded files from disk (required for Next.js standalone mode where `/public/` is not served dynamically)
- Shared `src/app/admin/(dashboard)/layout.tsx` — sidebar nav with Dashboard, Menu Upload, Orders, Settings, Logout

---

### Sub-Task 6 — Admin Settings Page

**Status:** `[x] complete`

**Delivered:**
- `GET /api/admin/settings` and `PATCH /api/admin/settings`
- Settings: cutoff toggle, cutoff hour/minute, active weekdays (Mon–Sun), WhatsApp phone number
- WhatsApp phone stored as digits after the fixed `+4` Romanian prefix
- `src/app/admin/(dashboard)/settings/page.tsx`

---

### Sub-Task 7 — Public Order Page

**Status:** `[x] complete`

**Delivered:**
- `GET /api/menu` — returns `{ photoUrl, isOpen, reason }` based on active day + cutoff
- `GET /api/orders?nickname=...` — returns own orders only
- `POST /api/orders` — validates cutoff/active day server-side, persists order
- `DELETE /api/orders/[id]` and `PATCH /api/orders/[id]` — ownership verified by nickname
- `src/components/OrderPage.tsx`:
  - NicknamePrompt (localStorage-persisted)
  - Quick menu toggle (Carne / Vegetarian sets both courses at once)
  - Per-course overrides (Supă + Fel principal toggled independently — mixed selection auto-sets `menuType = "custom"`)
  - Note field for special requests (also triggers `custom`)
  - Quantity selector, order summary, confirm flow
  - My orders section with inline edit and delete
  - Toast notifications

---

### Sub-Task 8 — Admin Orders View

**Status:** `[x] complete`

**Delivered:**
- `GET /api/admin/orders` and `DELETE /api/admin/orders/[id]`
- Summary cards: Carne count (orange), Vegetarian count (green), Personalizat count (purple), Total (brand)
- Custom orders section: full detail per order (type breakdown if mixed, note) — no nicknames in display
- "View all" toggle: full per-order table for all types
- Auto-refresh every 30 s + manual refresh button
- **Send via WhatsApp** button: opens `wa.me` link with pre-filled message (localised, includes counts + custom order details, total at bottom, no nicknames)

---

### Sub-Task 9 — Admin Dashboard Home

**Status:** `[x] complete`

**Delivered:**
- `GET /api/admin/status` — returns `{ orderCount, menuPhotoUploaded, cutoffEnabled, cutoffTime, isOpen }`
- `src/app/admin/(dashboard)/page.tsx` — status cards (order count, menu uploaded, open/closed) + nav cards

---

### Sub-Task 10 — Styling, Responsiveness & UX Polish

**Status:** `[x] complete`

**Delivered:**
- Fox orange brand theme (`#F97316`) via Tailwind v4 `@theme` CSS block
- Mobile-first responsive layouts for all public and admin pages
- Loading spinners, error messages, toast notifications
- 🦊 favicon via `src/app/icon.svg`
- Accessible form inputs, keyboard-navigable quantity selector

---

### Sub-Task 11 — Docker Compose & Production Build Verification

**Status:** `[x] complete`

**Delivered:**
- `.dockerignore` reducing build context from 528 MB to ~4 KB
- `docker-compose.yml` with Redis healthcheck, named volumes for uploads and Redis data, `TZ=Europe/Bucharest` for correct cutoff time evaluation
- `deploy/` folder with standalone `docker-compose.yml` (uses pre-built image), `.env.example`, and `deploy.sh` helper for tar-based deployment
- AMD64 cross-platform build: `docker buildx build --platform linux/amd64`
- `README.md` with full setup, local dev, and tar-based deployment instructions

---

## Post-Completion Changes

| Change | Description |
|---|---|
| Weekend ordering | `activeDays` default extended to include Sat (6) + Sun (7); settings page shows all 7 days |
| Menu photo display fix | Added `src/app/uploads/[filename]/route.ts` to serve runtime-written files in standalone mode |
| No text inputs for courses | Soup/main replaced with per-course type toggles; quick full-menu selector added |
| Auto-detect custom menu | `menuType = "custom"` when soup ≠ main type or note is non-empty |
| Admin orders table | Replaced Soup/Main columns with Menu Type badge column |
| Custom count card | Added Personalizat card to admin orders summary grid |
| WhatsApp send | Localised message with counts, custom order details (no nicknames), total |
| Default language fix | Proxy no longer reads `Accept-Language`; always defaults to `ro` |
| Language switcher | Flag emoji buttons (🇷🇴 / 🇬🇧); active state driven by server-resolved locale prop |
| Cutoff timezone fix | `TZ=Europe/Bucharest` added to Docker env so `new Date().getHours()` matches admin-configured times |
| Favicon | 🦊 emoji favicon via `src/app/icon.svg` |

---

## Environment Variables Reference

| Variable | Description | Example |
|---|---|---|
| `REDIS_URL` | Redis connection string | `redis://redis:6379` |
| `ADMIN_USERNAME` | Admin login username | `admin` |
| `ADMIN_PASSWORD` | Admin login password | `changeme` |
| `NEXTAUTH_SECRET` | Secret for signing session cookies | random 32-char string |
| `NEXT_PUBLIC_DEFAULT_LANG` | Default locale | `ro` |
| `TZ` | Server timezone for cutoff evaluation | `Europe/Bucharest` |

---

## Redis Key Schema

| Key | Type | Value |
|---|---|---|
| `menu:YYYY-MM-DD` | String | Filename of menu photo |
| `orders:YYYY-MM-DD` | List | JSON-serialised `Order` objects |
| `settings` | Hash | `cutoffHour`, `cutoffMinute`, `cutoffEnabled`, `activeDays`, `whatsappPhone` |
| `session:<token>` | String | `"admin"` (TTL 8h) |
