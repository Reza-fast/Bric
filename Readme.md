# BRIC

Construction project dashboard: **Next.js** frontend, **Node.js (Express)** API, **PostgreSQL** database.

## Layout

- `backend/` -- `src/domain` (models), `src/services`, `src/controllers`, `src/repositories`, `src/routes`, `db/migrations`
- `frontend/` -- Next.js App Router, `src/app`, `src/components`, `src/lib`

## Run locally

1. Create database `bric`, copy `backend/.env.example` to `backend/.env`, set `DATABASE_URL`.
2. In `backend`: `npm install`, then `npm run db:migrate`, then `npm run dev` (API on port 4000).
3. In `frontend`: `npm install`, then `npm run dev` (app on port 3000). Optional: `frontend/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:4000`.

## Git (once per clone)

Enable hooks so `node_modules` and `.next` cannot be committed:

`git config core.hooksPath .githooks`