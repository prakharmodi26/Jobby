# Copilot Instructions — Jobby

## Build & Run

This is an npm workspaces monorepo (`backend/` and `frontend/`). All commands run from root unless noted.

```bash
# Dev servers
npm run dev:backend       # tsx watch on backend (Express, port 4000)
npm run dev:frontend      # next dev (port 3000)

# Build
npm run build             # builds both workspaces

# Type-check only (no emit)
npx tsc --noEmit -p backend/tsconfig.json
npx tsc --noEmit -p frontend/tsconfig.json

# Database
npm run db:migrate        # prisma migrate dev
npm run db:push           # prisma db push (no migration files)
npm run db:generate       # regenerate Prisma client
npm run db:studio         # Prisma Studio GUI
npm run db:seed           # seed via prisma/seed.ts

# Docker (PostgreSQL + full stack)
docker compose up
```

There is no test suite or linter configured.

## Architecture

**Single-user personal job board** that fetches listings from the JSearch (RapidAPI) external API, scores them against a user profile, and surfaces recommendations.

```
frontend/  — Next.js 15 + React 19 + Tailwind v4, App Router
backend/   — Express 5 + TypeScript, REST API on /api/*
prisma/    — Shared Prisma schema, PostgreSQL
```

### Data flow

1. **Cron scheduler** (`backend/src/scheduler/cron.ts`) triggers `recommendedRunner` on a configurable schedule (stored in `Settings.cronSchedule`).
2. **recommendedRunner** builds search queries from the user's Profile (target titles × locations × skills), calls JSearch API, and upserts results.
3. **jobUpsert** deduplicates using a 3-strategy cascade: source+sourceJobId → canonical URL → SHA-256 fingerprint (company+title+location+postedAt).
4. **scoring** (`backend/src/services/scoring.ts`) computes a relevance score per job using the user's Profile and configurable weights from the `Settings` model. Score is always ≥ 0.
5. Frontend fetches scored/ranked jobs via REST and displays them.

### Key models (all singletons except Job/SavedJob/RecommendedRun/RecommendedMatch)

- **Profile** — "Who you are": skills, titles, locations, preferences. Single row, no userId FK.
- **Settings** — "How the system behaves": scoring weights, cron schedule, search params. Single row. Created with defaults on first access if missing.
- **User** — Auth only (username + passwordHash). Single user.
- **Job** — Discovered listings. Compound unique on `[source, sourceJobId]`, indexed on `canonicalUrl`, `fingerprint`, `discoveredAt`, `ignored`.

### Auth

Cookie-based JWT (`httpOnly`, 7-day expiry). Token contains `{ username, userId }`. Auth middleware in `backend/src/middleware/auth.ts` augments `req.user`. Login uses username (not email).

### Frontend patterns

- Route groups: `(auth)/` for login, `(app)/` for authenticated pages (layout includes Sidebar).
- `frontend/src/lib/api.ts` — `apiFetch<T>()` wrapper: auto-includes credentials, redirects to `/login` on 401.
- `frontend/src/lib/types.ts` — Frontend interfaces mirroring Prisma models.
- `frontend/src/hooks/useAuth.ts` — Auth state hook used by Sidebar and layouts.
- Styling: Tailwind v4 with `clsx` + `tailwind-merge` via `cn()` utility (`frontend/src/lib/utils.ts`).

## Conventions

- **Backend imports use `.js` extensions** (ESM output): `import { prisma } from "../prisma.js"`. Always include `.js` in relative imports.
- **Prisma client** is a shared singleton at `backend/src/prisma.ts`. Always import from there, never instantiate directly.
- **Settings/Profile are singletons** — use `findFirst()` to load, create with defaults if missing. Never filter by userId.
- **Backend route pattern**: each route file exports a `Router()` mounted in `index.ts`. All routes under `/api/*` are protected with `authMiddleware` except `/api/auth/login` and `/api/auth/logout`.
- **Scoring weights are never hardcoded** in scoring logic — they come from the `Settings` model. `scoreJob(job, profile, settings)` takes all three.
- **Frontend pages are `"use client"`** components that call `apiFetch` directly. No server components for data fetching.
- **Environment config** lives in `.env` at project root (see `.env.example`). Backend loads it via `dotenv` with fallback to parent directory.

### Cover letter generation

- Users write a markdown profile (`Profile.userMd`) containing experiences, projects, achievements, and optional cover letter instructions.
- `POST /api/cover-letter/generate` takes `{ jobId, messages? }`. The backend builds a system prompt from `userMd` + job details, then calls the **VT ARC LLM API** (`gpt-oss-120b` model) at `https://llm-api.arc.vt.edu/api/v1/chat/completions`. Auth via `VT_ARC_KEY` env var.
- The API is **never called** if `userMd` is empty — the endpoint returns 400 immediately.
- Conversation is **ephemeral** — chat history lives in React state (`CoverLetterPanel`), not persisted to database.
- Follow-up edits send the full message history back to the backend so the LLM has context.
- PDF download uses `html2pdf.js` client-side.
