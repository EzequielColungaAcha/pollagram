# Polla — Lottery Pool Tracking

Production-ready web app for managing and displaying recurring lottery pool contests (**pollas**). Built with React, Vite, TypeScript, Tailwind CSS, and Supabase.

## Features

- **Public (read-only):** live standings, player picks, matched numbers, rankings, prize pool, history, statistics
- **Public:** home shows **active and closed** games (draft and archived are hidden)
- **Public:** leaderboard pick numbers sorted ascending in the UI
- **Public:** **Descargar Excel** — print-ready export (player name, N1–N10, sorted A→Z)
- **Public:** last registered draw date shown on the leaderboard card
- **Admin (authenticated):** game lifecycle, players/entries, daily draws, settings, audit log, draw invalidation
- **Admin:** games created as **borrador (draft)**; **Activar** publishes to the public home page
- **Admin:** configure draft games and register players before activation
- **Admin:** closed/archived games open as read-only **Ver** in admin
- **Admin:** audit log with Spanish labels and copy-raw-JSON button
- **Admin:** draws apply only within the game window (`start_date` → `DATE(closed_at)`)
- **Core engine:** slot-based matching (duplicate picks supported), persisted matches, prize distribution with deterministic rounding, rollover on no winners

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4 |
| Routing | React Router v7 |
| State | TanStack Query, Zustand |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Backend | Supabase (PostgreSQL, Auth, RPC) |

## Architecture

```
React SPA  →  Supabase client (reads)
           →  RPC functions (writes, transactional)
           →  PostgreSQL + RLS
```

**Key design decisions:**

- **Slot-based matching** — duplicate player numbers require separate draw hits per slot
- **Match persistence** — matches written at draw entry, never recomputed on read
- **Single active game** — enforced via partial unique index in PostgreSQL
- **RPC for writes** — business logic cannot be bypassed by client-side calls alone

## Project structure

```
src/
├── app/           # routes, layouts, router
├── components/    # ui, public, admin, charts
├── features/      # api, hooks, mutations
├── lib/           # supabase, query-client, format, export-leaderboard-xlsx, audit-format
├── validation/    # shared Zod schemas
├── types/         # domain + Supabase types
└── stores/        # theme, auth prefs

supabase/migrations/   # SQL schema, RLS, RPC functions (001–015)
supabase/seed.sql      # minimal local seed (see Local database bootstrap)
scripts/
├── setup-local-env.mjs   # write .env.local from supabase status
└── seed-admin.mjs        # create admin Auth user + profile
```

## Local development

Two options: **Docker (recommended)** for fully offline development, or **cloud Supabase** for production-like setup.

### Option A — Docker / Supabase local stack (recommended)

Runs PostgreSQL, Auth, and API in Docker via the Supabase CLI. No cloud project required.

#### Prerequisites

- Docker Desktop (or Docker Engine + Compose)
- Node.js 20+
- pnpm

#### Quick start

```bash
pnpm install
pnpm db:setup          # start Docker stack, write .env.local, seed admin
pnpm dev               # http://localhost:5173 — Vite loads .env.local automatically
```

Default admin credentials (override in `.env.local`):

- Email: `admin@polla.local`
- Password: `localdev123`

#### Local database bootstrap

What gets created locally, and how:

```mermaid
flowchart TD
  dbReset["pnpm db:reset"] --> migrations["Migrations 001–015"]
  migrations --> appSettings["app_settings row id=1"]
  dbSetup["pnpm db:setup"] --> dbStart["pnpm db:start"]
  dbSetup --> setupEnv["pnpm setup:local-env"]
  dbSetup --> seedAdmin["pnpm seed:admin:local"]
  seedAdmin --> adminUser["Auth user + profiles.role=admin"]
```

| Goal | Command |
|------|---------|
| Fresh schema (all migrations + `seed.sql`) | `pnpm db:reset` |
| Write/refresh `.env.local` from running stack | `pnpm setup:local-env` |
| Create admin login (local) | `pnpm seed:admin:local` |
| Full first-time local setup | `pnpm db:setup` |
| After pulling new migrations | `pnpm db:reset` (local) or `pnpm exec supabase db push` (remote) |

**What is seeded automatically:**

- **Schema + RPCs** — all files in `supabase/migrations/` (001–015), including default `app_settings` (`entry_fee` 10000, `prize_percent` 0.85).
- **`supabase/seed.sql`** — intentionally minimal; does **not** create demo games or players.
- **Admin user** — created by `pnpm seed:admin:local` (Auth user + `profiles.role = admin`).

Create games and players in the admin UI after logging in.

#### Useful URLs

| Service | URL |
|---------|-----|
| App | http://localhost:5173 |
| Supabase API | http://127.0.0.1:54321 |
| Supabase Studio | http://127.0.0.1:54323 |

#### Direct Postgres access

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Copy [`.env.local.example`](.env.local.example) to `.env.local` if you prefer manual setup after `pnpm db:start`.

#### Troubleshooting

**"Email logins are disabled"** — Auth config changed; restart the stack so GoTrue picks it up:

```bash
pnpm db:stop && pnpm db:start
```

Local config uses invite-only mode: `[auth].enable_signup = false` blocks public signup, while `[auth.email].enable_signup = true` keeps email/password login enabled for the seeded admin.

**New games appear as Activo instead of Borrador** — migration 015 is not applied. Run `pnpm db:reset` locally or `pnpm exec supabase db push` on the linked remote project.

---

### Option B — Cloud Supabase

#### Prerequisites

- Node.js 20+
- pnpm
- Supabase project (free tier)

#### Setup

1. **Clone and install**

   ```bash
   pnpm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project settings.

3. **Apply database migrations**

   ```bash
   # Token: https://supabase.com/dashboard/account/tokens
   SUPABASE_NO_KEYRING=1 pnpm exec supabase login --token sbp_YOUR_TOKEN
   pnpm exec supabase link --project-ref YOUR_PROJECT_REF
   pnpm exec supabase db push
   ```

   Or run each file in `supabase/migrations/` in order via the Supabase SQL editor.

   Migrations live in `supabase/migrations/` (001–015). Latest: **015** — games created as `draft`, `rpc_open_game` active-game guard, register players in draft.

4. **Seed admin user**

   ```bash
   # Set SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD in .env
   pnpm seed:admin
   ```

5. **Start dev server**

   ```bash
   pnpm dev
   ```

   Open http://localhost:5173

## Environment variables

| Variable | Client | Purpose |
|----------|--------|---------|
| `VITE_SUPABASE_URL` | Yes | Supabase API URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | No (seed only) | Admin seed script |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | No (seed only) | Admin credentials |
| `VITE_CURRENCY` / `VITE_LOCALE` | Yes | Display formatting |

Templates: [`.env.example`](.env.example) (cloud), [`.env.local.example`](.env.local.example) (local Docker).

## Commands reference

### Frontend / quality

| Command | Description |
|---------|-------------|
| `pnpm dev` | Vite dev server (uses `.env` or `.env.local`) |
| `pnpm dev:local` | Start Docker stack, refresh `.env.local`, run Vite |
| `pnpm build` | Typecheck + production build |
| `pnpm typecheck` | TypeScript only (`tsc -b --noEmit`) |
| `pnpm lint` | ESLint |
| `pnpm preview` | Preview production build |

### Local database

| Command | Description |
|---------|-------------|
| `pnpm db:start` | Start Supabase Docker stack |
| `pnpm db:stop` | Stop Docker containers |
| `pnpm db:status` | API URL, keys, ports |
| `pnpm db:reset` | Drop DB, reapply migrations 001–015 + `seed.sql` |
| `pnpm db:setup` | `db:start` + `setup:local-env` + `seed:admin:local` |
| `pnpm setup:local-env` | Generate `.env.local` from `supabase status` |
| `pnpm seed:admin:local` | Seed admin user (reads `.env.local`) |
| `pnpm seed:admin` | Seed admin user (reads `.env`, for cloud) |

### Supabase CLI (remote / types)

| Command | Description |
|---------|-------------|
| `pnpm exec supabase link --project-ref REF` | Link to cloud project |
| `pnpm exec supabase db push` | Apply pending migrations to linked project |
| `pnpm exec supabase gen types typescript --local > src/types/supabase.ts` | Regenerate TS types from local DB |

## Deployment

Production uses **Supabase** for the database/auth/API and a static host for the React frontend. Two frontend options are documented below.

### Supabase (database + auth)

Do this once (and again whenever migrations change).

1. **Create a project** at [supabase.com/dashboard](https://supabase.com/dashboard).

2. **Copy credentials** (Project Settings → API):
   - Project URL → `VITE_SUPABASE_URL`
   - anon public key → `VITE_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY` (seed only — never commit or expose in the frontend build)

3. **Apply migrations** from your machine:

   ```bash
   pnpm install
   # Create a token at https://supabase.com/dashboard/account/tokens
   # Browser login stores the token in the OS keyring; db push still reads
   # ~/.supabase/access-token — use --token so both paths work.
   SUPABASE_NO_KEYRING=1 pnpm exec supabase login --token sbp_YOUR_TOKEN
   pnpm exec supabase link --project-ref YOUR_PROJECT_REF
   pnpm exec supabase db push
   ```

   Migrations live in `supabase/migrations/` (001–015). Alternative: run each SQL file in order in the Supabase SQL editor.

   **If `db push` says "Access token not provided" after browser login:** run `pnpm exec supabase projects list` — if that works, re-login with `--token` as above (or `export SUPABASE_ACCESS_TOKEN=sbp_...` for the current shell).

4. **Seed the admin user** (local machine only):

   ```bash
   cp .env.example .env
   # Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
   # ADMIN_EMAIL, ADMIN_PASSWORD
   pnpm seed:admin
   ```

5. **Configure Auth** (Authentication → URL Configuration):
   - **Site URL:** your public frontend URL (see GitHub Pages or Vercel below)
   - **Redirect URLs:** same URL (and `/admin` paths if needed)
   - Enable the **Email** provider under Authentication → Providers

6. **Future schema updates:** `pnpm exec supabase db push`

### Frontend (GitHub Pages)

Target URL: **`https://<github-username>.github.io/pollagram/`** (repo name must be `pollagram`).

The repo includes [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml), Vite `base` via `VITE_BASE_PATH`, React Router `basename`, and [`public/404.html`](public/404.html) for SPA deep links.

1. **Push the repo to GitHub**

   ```bash
   git remote add origin git@github.com:YOUR_USER/pollagram.git
   git push -u origin main
   ```

2. **Add GitHub Actions secrets** (Settings → Secrets and variables → Actions):

   | Secret | Value |
   |--------|--------|
   | `VITE_SUPABASE_URL` | Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
   | `VITE_CURRENCY` | optional, e.g. `COP` |
   | `VITE_LOCALE` | optional, e.g. `es-CO` |

   Do **not** add `SUPABASE_SERVICE_ROLE_KEY` to GitHub.

3. **Enable Pages** (Settings → Pages → Source: **GitHub Actions**).

4. **Configure Supabase Auth Site URL** to `https://<github-username>.github.io/pollagram/`.

5. **Push to `main`** (or run the workflow manually). When the Actions job succeeds, open the Pages URL.

6. **Verify:** home loads, `/admin/login` works, deep links survive refresh.

**Local dev** uses `base: /` (default). GitHub Actions sets `VITE_BASE_PATH=/pollagram/` at build time.

#### Troubleshooting (GitHub Pages)

| Problem | Fix |
|---------|-----|
| Blank page / assets 404 | Confirm repo is named `pollagram` and workflow sets `VITE_BASE_PATH=/pollagram/` |
| Routes 404 on refresh | Ensure `public/404.html` is deployed (included in build) |
| Admin login fails | Supabase Auth Site URL must match the GitHub Pages URL |
| RPC / draft game errors | Run `pnpm exec supabase db push` (migration 015 may be missing) |
| `db push`: Access token not provided | Browser login uses the OS keyring; `db push` needs `~/.supabase/access-token`. Re-login with `SUPABASE_NO_KEYRING=1 pnpm exec supabase login --token sbp_...` |

### Frontend (Vercel)

Alternative to GitHub Pages:

1. Import repo in Vercel
2. Framework preset: **Vite**
3. Build command: `pnpm build`
4. Output directory: `dist`
5. Environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_CURRENCY` (optional)
   - `VITE_LOCALE` (optional)

Set Supabase Auth Site URL to your Vercel domain. No `VITE_BASE_PATH` needed (defaults to `/`).

## Game workflow

1. Admin creates a game → status **Borrador** (not on public home) → **Juegos**
2. Admin configures fee/percent and adds players while in draft
3. Admin clicks **Activar** → status **Activo** (only one active at a time; retroactive draw matching runs)
4. Game visible on public home; admin registers daily draws → **Sorteos**
5. Draws cross out numbers only from `start_date` through `DATE(closed_at)`
6. System persists matches, updates rankings, detects winners at 10/10
7. On winner: prizes calculated and game closed automatically
8. On no winner: admin closes game → prize rolls over to the next game
9. **Closed** games remain on public home until admin **archives**
10. **Archived** games: history/stats only; admin can **Ver** read-only

## License

Private — all rights reserved.
