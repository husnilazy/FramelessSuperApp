# Frameless Creative Admin Dashboard

A powerful admin dashboard for **Frameless Creative** — a video production company with sub-brands **STUDIODO** and **ZENSVISUAL**.

## Architecture

```
artifacts/
  frameless/       — React + Vite frontend (port 22245, path /)
  api-server/      — Express API server (port 8080, path /api)
lib/
  db/              — Drizzle ORM + PostgreSQL schema + migrations
  api-spec/        — OpenAPI YAML spec (source of truth)
  api-client-react/— Generated React Query hooks (orval)
  api-zod/         — Generated Zod schemas (orval)
```

## Stack
- **Frontend**: React 18, Vite, Wouter (routing), TanStack Query, Recharts, shadcn/ui, Framer Motion
- **Backend**: Express, Pino logging, Drizzle ORM, PostgreSQL
- **Design**: Glassmorphism, dark theme, electric orange accent (`hsl(16,100%,60%)`), Bebas Neue headings
- **Codegen**: Orval from OpenAPI spec → React Query hooks + Zod schemas

## Running

Workflows are pre-configured:
- **API Server**: `pnpm --filter @workspace/api-server run dev`
- **Frontend**: `pnpm --filter @workspace/frameless run dev`

## Database

Uses the monorepo's built-in PostgreSQL (`DATABASE_URL` env var).

Push schema changes:
```bash
pnpm --filter @workspace/db run push
```

## Admin Login

- **Email**: `admin@frameless.com`
- **Password**: `admin123`

## Pages

| Route | Page |
|-------|------|
| `/login` | Login (FRAMELESS™ branding) |
| `/dashboard` | Control Room — KPIs, cash flow chart, activity feed |
| `/projects` | Projects list — search, filter, create |
| `/projects/:id` | Project detail — tasks, progress, budget |
| `/team` | Crew management — cards by department |
| `/clients` | Client database — search, create |
| `/invoices` | Invoices — filter by status, create |
| `/invoices/:id` | Invoice detail — print-ready document view |
| `/expenses` | Expense tracking — filter by category |
| `/finance` | Financial intelligence — charts, summaries |
| `/settings` | System info + profile |

## API Endpoints

All routes prefixed with `/api`:
- `POST /api/auth/login` — authenticate, returns JWT-like token
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/dashboard/stats`
- `GET /api/dashboard/cash-flow`
- `GET /api/dashboard/recent-activity`
- `GET/POST /api/projects`
- `GET/PATCH/DELETE /api/projects/:id`
- `GET/POST /api/projects/:id/tasks`
- `GET/POST /api/team`
- `GET/PATCH/DELETE /api/team/:id`
- `GET/POST /api/clients`
- `GET/PATCH/DELETE /api/clients/:id`
- `GET/POST /api/invoices`
- `GET/PATCH /api/invoices/:id`
- `GET/POST /api/expenses`
- `GET /api/finance/summary`
- `GET /api/finance/cash-flow`
- `GET /api/activity`

## Auth

Token-based (in-memory Map). Token stored in `localStorage`. Auth header: `Bearer <token>`.

## Codegen

After changing `lib/api-spec/openapi.yaml`:
```bash
pnpm --filter @workspace/api-spec run codegen
```

## Currency

Indonesian Rupiah (IDR) — formatted with `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })`.
