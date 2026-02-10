# Jobby — Your Personal Job Board

<p align="center">
  <img src="frontend/public/jobby_bg_remove.svg" alt="Jobby Logo" width="280" />
</p>

Jobby is a **single-user, self-hosted job board** that automatically discovers job listings from the web, scores them against your profile, and surfaces the best matches — so you can focus on applying, not searching.

---

## ✨ Features

- **Automated job discovery** — Fetches listings from the JSearch (RapidAPI) external API on a configurable cron schedule.
- **Smart scoring & ranking** — Every job is scored against your profile (skills, titles, locations, preferences) using fully configurable weights.
- **Duplicate detection** — 3-strategy cascade: source+ID → canonical URL → SHA-256 fingerprint.
- **Save, track & manage** — Mark jobs as saved, applied, OA, interview, offer, or rejected.
- **AI cover letter generation** — Generate tailored cover letters using your markdown profile + job details. Supports VT ARC, Google Gemini, and OpenRouter backends.
- **AI profile builder** — Use AI to help write your markdown profile from your experiences.
- **Dashboard analytics** — Charts for discovered jobs over time and application status breakdown.
- **Dark sidebar UI** — Clean Next.js 15 frontend with Tailwind CSS.

---

## 🏗️ Architecture

```
frontend/   → Next.js 15 + React 19 + Tailwind v4 (App Router)
backend/    → Express 5 + TypeScript (REST API on /api/*)
prisma/     → Shared Prisma schema, PostgreSQL
```

| Component | Port | Description |
|-----------|------|-------------|
| Frontend  | 3000 | Next.js app |
| Backend   | 4000 | Express API |
| PostgreSQL| 5432 | Database    |

---

## 🔐 Default Credentials

> **⚠️ IMPORTANT: The default login credentials are:**
>
> **Username: `defaultjobby`**
> **Password: `jobby1234`**
>
> **Please change your username and password from the Settings page immediately after your first login.**

---

## 🚀 Quick Start with Docker Compose

The fastest way to get Jobby running. You only need **Docker** and **Docker Compose** installed.

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/my_job_board.git
cd my_job_board
```

### 2. Create your environment file

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string. The default works with the Docker Compose postgres service. |
| `JWT_SECRET` | ✅ | A long random string for signing auth tokens. Change this! |
| `JSEARCH_API_KEY` | ✅ | RapidAPI key for [JSearch](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch). Required to fetch job listings. |
| `FRONTEND_URL` | ✅ | Origin of the frontend for CORS (e.g. `http://localhost:3000` or your domain). |
| `NEXT_PUBLIC_API_URL` | ✅ | URL the frontend uses to reach the backend (e.g. `http://localhost:4000` or your domain). |
| `VT_ARC_KEY` | ➖ | VT ARC LLM API key (optional, for cover letter generation). |
| `GOOGLE_API_KEY` | ➖ | Google Gemini API key (optional, for cover letter generation). |
| `OPENROUTER_API_KEY` | ➖ | OpenRouter API key (optional, for cover letter generation). |

> You need **at least one** AI API key (VT ARC, Gemini, or OpenRouter) if you want cover letter generation. Otherwise it's optional.

### 3. Build and start

```bash
docker compose up --build -d
```

This will:
1. Start a PostgreSQL 16 database
2. Build the backend, run Prisma migrations, seed the default user, and start the Express server
3. Build and start the Next.js frontend

### 4. Open the app

Go to [http://localhost:3000](http://localhost:3000) and log in with the default credentials above.

---

## 🛠️ Local Development (without Docker)

### Prerequisites

- **Node.js 22+**
- **PostgreSQL** running locally
- **npm** (comes with Node.js)

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
# Edit .env with your DATABASE_URL pointing to your local PostgreSQL
```

### 3. Set up the database

```bash
npm run db:migrate    # Run Prisma migrations
npm run db:seed       # Seed the default user
```

### 4. Start dev servers

```bash
# In separate terminals, or use a process manager:
npm run dev:backend   # Express on port 4000
npm run dev:frontend  # Next.js on port 3000
```

---

## 📖 Available Scripts

All commands run from the project root:

| Command | Description |
|---------|-------------|
| `npm run dev:backend` | Start backend in dev mode (tsx watch) |
| `npm run dev:frontend` | Start Next.js dev server |
| `npm run build` | Build both workspaces |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:push` | Push schema changes (no migration files) |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:studio` | Open Prisma Studio GUI |
| `npm run db:seed` | Seed the database with default user |

---

## 📁 Project Structure

```
├── backend/
│   └── src/
│       ├── index.ts              # Express entry point
│       ├── prisma.ts             # Prisma client singleton
│       ├── middleware/auth.ts     # JWT auth middleware
│       ├── routes/               # REST API route handlers
│       ├── scheduler/cron.ts     # Job discovery cron scheduler
│       └── services/             # Scoring, job upsert, JSearch client
├── frontend/
│   └── src/
│       ├── app/                  # Next.js App Router pages
│       ├── components/           # React components
│       ├── hooks/                # Custom hooks (useAuth)
│       └── lib/                  # API client, types, utilities
├── prisma/
│   ├── schema.prisma             # Database schema
│   ├── seed.ts                   # Default user seeding
│   └── migrations/               # Migration history
├── docker-compose.yml
├── .env.example
└── package.json                  # npm workspaces root
```

---

## ⚙️ How It Works

1. **Profile setup** — Configure your skills, target titles, preferred locations, and preferences on the Profile page.
2. **Automated discovery** — A cron scheduler (configurable in Settings) builds search queries from your profile and fetches listings from the JSearch API.
3. **Deduplication** — Each job is deduplicated using a 3-strategy cascade to avoid duplicates.
4. **Scoring** — Every job is scored against your profile using configurable weights from Settings. Scores are always ≥ 0.
5. **Browse & apply** — View recommended jobs ranked by score, save jobs you're interested in, and track your application status.
6. **Cover letters** — Generate AI-powered cover letters using your markdown profile and job details.

---

## 🔧 Configuration

All scoring weights, cron schedule, and search parameters are configurable from the **Settings** page in the app — no need to edit code or restart the server.

The cover letter model can be switched between VT ARC, Google Gemini, and OpenRouter from Settings as well.

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.
