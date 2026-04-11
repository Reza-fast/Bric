# BRIC

Construction project dashboard: **Next.js** frontend, **Node.js (Express)** API, **PostgreSQL** database.

## Layout

- `backend/` -- `src/domain` (models), `src/services`, `src/controllers`, `src/repositories`, `src/routes`, `db/migrations`
- `frontend/` -- Next.js App Router, `src/app`, `src/components`, `src/lib`

## Run locally

1. Create database `bric`, copy `backend/.env.example` to `backend/.env`, set `DATABASE_URL`, **`JWT_SECRET`** (at least 32 characters in production), and **`FRONTEND_ORIGIN`** (e.g. `http://localhost:3000`).
2. In `backend`: `npm install`, then `npm run db:migrate`, then `npm run dev` (API on port **4000**).
3. In `frontend`: `npm install`, then `npm run dev` (app on port **3000**). The app proxies `/api/*` to the backend (`API_PROXY_TARGET` in `frontend/next.config.ts`, default `http://127.0.0.1:4000`) so auth cookies stay **same-site** with the UI.
4. Open **http://localhost:3000/register** to create an account, then create a project from the API (or add UI later). Dashboard metrics are scoped to **projects you are a member of**.

### Auth / API

- **Register:** `POST /api/auth/register` — JSON `{ email, password, displayName, role? }` (password min 10 chars).
- **Login:** `POST /api/auth/login` — sets **httpOnly** cookie `bric_token` (name overridable via `AUTH_COOKIE_NAME`).
- **Session:** `GET /api/auth/me`, `PATCH /api/auth/me` (profile + optional password change), `POST /api/auth/logout`. Other `/api/*` routes require a valid cookie or `Authorization: Bearer <jwt>`.
- Default cookie name: **`bric_token`** (`AUTH_COOKIE_NAME` on the API). If you change it, set **`NEXT_PUBLIC_AUTH_COOKIE_NAME`** the same value so Next middleware can gate `/dashboard`.

### DB migrations (upgrades)

If your database already had `001_initial.sql` applied **before** the migration tracker existed, insert a row so `001` is skipped, then run `npm run db:migrate` again:

`INSERT INTO schema_migrations (filename) VALUES ('001_initial.sql') ON CONFLICT DO NOTHING;`

## Git (once per clone)

Enable hooks so `node_modules` and `.next` cannot be committed:

`git config core.hooksPath .githooks`