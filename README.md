# Fox Catering

A daily lunch ordering app for office catering. Employees place orders for the day's menu; the admin manages the menu photo, views orders, sends the order summary to the catering company via WhatsApp, and configures cutoff times.

Built with **Next.js 16 (App Router)**, **Redis**, **Tailwind CSS**, and **Docker**.

---

## Features

### Public order page
- Today's menu photo displayed full-width
- Quick toggle: **Meniul zilei** (non-veg) or **Vegetarian** — sets both courses at once
- Per-course overrides: mix **Felul 1** and **Felul 2** independently (auto-flagged as **Personalizat**)
- Special request note (free text)
- Quantity selector
- Order summary → confirm flow
- Edit / delete own orders for today *(hidden after cutoff — orders become read-only)*
- Nickname saved in `localStorage`
- Romanian / English flag switcher (🇷🇴 / 🇬🇧)

### Admin panel
- **Menu upload** — drag & drop, file picker, or paste from clipboard (`Ctrl+V`)
- **Orders** — live summary counts (Meniul zilei / Vegetarian / Personalizat / Total), custom order detail, full order table toggle, auto-refresh every 30 s
- **Send via WhatsApp** — one-tap button builds a localised order message and opens `wa.me`
- **Settings** — order cutoff time, toggle cutoff on/off, active weekdays (Mon–Sun), catering WhatsApp number
- Session-based login (HTTP-only cookie, 8 h TTL)

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose v2)

---

## Quick start (build from source)

### 1. Create the environment file

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Redis connection (default works with docker compose)
REDIS_URL=redis://redis:6379

# Admin login credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password

# Secret — generate with: openssl rand -base64 32
NEXTAUTH_SECRET=your-secret-here

# Default UI language: ro or en
NEXT_PUBLIC_DEFAULT_LANG=ro

# Server timezone — must match the timezone used when setting cutoff times
TZ=Europe/Bucharest
```

> **Note:** Never commit `.env` to version control. It is already in `.gitignore`.

### 2. Start

```bash
docker compose up -d --build
```

The app will be available at **http://localhost:3000**

### 3. Stop

```bash
docker compose down
```

---

## Deploy from exported image (tar.gz)

Use this when deploying to a server without internet access or without the source code.

### On the build machine

```bash
# Build for AMD64 (Linux server target)
docker buildx build --platform linux/amd64 -t fox-catering-app:latest --load .

# Export the image
docker save fox-catering-app:latest | gzip > fox-catering-app.tar.gz
```

### Copy to the target server

Transfer these files to the same folder on the target server:

```
fox-catering-app.tar.gz   ← exported image
deploy/docker-compose.yml ← uses the pre-built image (no build step)
deploy/.env.example       ← template — copy to .env and fill in values
deploy/deploy.sh          ← optional helper script
```

### On the target server

```bash
# 1. Create .env from template
cp .env.example .env
nano .env    # set ADMIN_USERNAME, ADMIN_PASSWORD, NEXTAUTH_SECRET

# 2. Load image
docker load < fox-catering-app.tar.gz

# 3. Start
docker compose up -d
```

Or use the helper script (loads the image automatically if tar.gz is present):

```bash
chmod +x deploy.sh && ./deploy.sh
```

> **Admin login fails?**  
> `ADMIN_USERNAME` and `ADMIN_PASSWORD` are read at **runtime** from the `.env` file.  
> Make sure `.env` is in the same directory as `docker-compose.yml` before starting.

---

## Admin panel

- **URL:** http://localhost:3000/admin/login
- **Username / Password:** values from `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env`

---

## Data persistence

Two named Docker volumes survive `docker compose down`:

| Volume | Contents |
|---|---|
| `fox-catering_redis_data` | Orders, settings, sessions |
| `fox-catering_app_uploads` | Uploaded menu photos |

Wipe everything: `docker compose down -v`

---

## Local development (without Docker)

Requires Node.js 20+ and a local Redis instance.

```bash
npm install
cp .env.example .env.local
# Edit .env.local: set REDIS_URL=redis://localhost:6379
npm run dev
```

App runs at **http://localhost:3000**.

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `REDIS_URL` | Yes | `redis://redis:6379` | Redis connection string |
| `ADMIN_USERNAME` | Yes | — | Admin login username |
| `ADMIN_PASSWORD` | Yes | — | Admin login password |
| `NEXTAUTH_SECRET` | Yes | — | Random 32+ char secret for session cookies |
| `NEXT_PUBLIC_DEFAULT_LANG` | No | `ro` | Default UI language (`ro` or `en`) |
| `TZ` | No | `Europe/Bucharest` | Server timezone for cutoff time evaluation |

---

## Project structure

```
src/
  app/
    admin/          # Admin pages (login, dashboard, menu, orders, settings)
    api/            # API routes (orders, menu, admin/*)
    uploads/        # Dynamic file serving for uploaded menu photos
  components/       # React components (OrderPage, LanguageSwitcher)
  i18n/             # next-intl config + ro.json / en.json translations
  lib/
    redis.ts        # Redis client + all data-layer functions
    auth.ts         # Session validation helper
  proxy.ts          # Next.js middleware (admin auth guard + locale cookie)
  types/            # Shared TypeScript types
public/
  uploads/          # Persisted via Docker volume at runtime
Dockerfile          # Multi-stage production build (standalone output)
docker-compose.yml  # App + Redis services
deploy/             # Standalone deployment package (no source needed)
```
