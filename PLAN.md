# Implementation Plan: Enhanced Job Board Features

## Overview

This plan covers: persistent search results, expanded profile fields, enhanced search/recommendation filters, a new "All Jobs" database page, improved scoring, and a settings panel for API parameters.

**Key constraint:** JSearch API returns max 10 jobs per page, max 50 pages. Available filters: `query`, `page`, `num_pages`, `country`, `language`, `date_posted`, `work_from_home`, `employment_types`, `job_requirements` (experience), `radius`, `exclude_job_publishers`. No salary/company-size/industry API filters exist — those must be handled via post-fetch scoring and description scanning.

---

## Step 1: Expand Prisma Schema — Profile Model

**File:** `prisma/schema.prisma` — Profile model (lines 18-27)

Add these optional fields to the existing Profile model:

```prisma
model Profile {
  id                      Int      @id @default(autoincrement())

  // --- Existing fields (unchanged) ---
  targetTitles            String[] @default([])
  skills                  String[] @default([])
  preferredLocations      String[] @default([])
  remotePreferred         Boolean  @default(false)
  citizenshipNotRequired  Boolean  @default(true)
  workAuthorization       String   @default("")

  // --- NEW fields ---
  seniority               String   @default("")          // "junior" | "mid" | "senior" | "lead" | "staff"
  minSalary               Int?                            // desired minimum annual compensation
  maxSalary               Int?                            // desired maximum annual compensation
  yearsOfExperience       Int?                            // required years of experience
  primarySkills           String[] @default([])           // primary/strongest skills
  secondarySkills         String[] @default([])           // secondary/nice-to-have skills
  industries              String[] @default([])           // e.g. ["fintech", "healthcare", "saas"]
  companySizePreference   String   @default("")          // "startup" | "mid" | "enterprise" | ""
  companyTypes            String[] @default([])           // e.g. ["product", "consulting", "agency"]
  locationRadius          Int?                            // radius in km for job search
  timezonePreference      String   @default("")          // e.g. "US/Central", "UTC-6 to UTC-8"
  roleTypes               String[] @default([])           // ["FULLTIME", "CONTRACTOR", "PARTTIME", "INTERN"]
  workModePreference      String   @default("")          // "onsite" | "hybrid" | "remote" | ""
  education               String   @default("")          // "bachelors" | "masters" | "phd" | "none" | ""
  degrees                 String[] @default([])           // e.g. ["Computer Science", "Mathematics"]
  excludePublishers       String[] @default([])           // publishers to exclude from results

  // --- Search/Recommendation Settings ---
  searchNumPages          Int      @default(5)            // default num_pages for manual search (1-50)
  recommendedNumPages     Int      @default(3)            // num_pages per query for recommended pull
  recommendedDatePosted   String   @default("week")       // date_posted for recommended pull

  updatedAt               DateTime @updatedAt
}
```

**Run:** `npx prisma migrate dev --name expand_profile`

---

## Step 2: Backend — Update Profile Route

**File:** `backend/src/routes/profile.ts`

Update the PUT handler to accept and persist all new fields. The existing pattern already conditionally includes fields from `req.body` — extend it with every new field name. No structural change needed, just more fields in the `data` object.

---

## Step 3: Backend — Update JSearch Service

**File:** `backend/src/services/jsearch.ts`

Add `language` to `JSearchParams` interface (it's the only missing API param). The interface already has all other params. No other change needed here.

---

## Step 4: Backend — Update Search Route

**File:** `backend/src/routes/jobs.ts` — `GET /api/jobs/search`

### 4a. Accept new query parameters:

Add support for these params from the frontend:
- `num_pages` (number, default from profile's `searchNumPages` or 5)
- `job_requirements` (string, comma-separated)
- `radius` (number, in km)
- `exclude_job_publishers` (string, comma-separated)
- `language` (string)

### 4b. Fetch profile to auto-fill defaults:

When the user searches, load their profile and use it to fill in defaults:
- `employment_types` → fall back to `profile.roleTypes.join(",")` if not provided
- `work_from_home` → fall back to `profile.remotePreferred` if not provided
- `job_requirements` → map `profile.yearsOfExperience` to the JSearch values:
  - 0-2 → `"under_3_years_experience"`
  - 3+ → `"more_than_3_years_experience"`
  - null → `"no_experience"` (or omit)
- `radius` → fall back to `profile.locationRadius` if not provided
- `exclude_job_publishers` → fall back to `profile.excludePublishers.join(",")` if not provided
- `num_pages` → fall back to `profile.searchNumPages`

The user-provided values from the query string always override profile defaults.

### 4c. Compute scores for search results:

After upserting, compute `scoreJob(job, profile)` for each returned job and include the score in the response. This means the search results will also show relevance scores.

---

## Step 5: Backend — New "All Jobs" Endpoint

**File:** `backend/src/routes/jobs.ts`

Add `GET /api/jobs/all` endpoint:

```
GET /api/jobs/all?page=1&limit=50&sort=discoveredAt&order=desc&search=react&remote=true&minSalary=100000
```

**Parameters:**
- `page`, `limit` (pagination, default limit=50)
- `sort` (column: `discoveredAt`, `title`, `company`, `salaryMin`, `score`, `postedAt`)
- `order` (`asc` | `desc`)
- `search` (text filter on title, company, description)
- `remote` (boolean filter)
- `employmentType` (filter)
- `minSalary`, `maxSalary` (range filter)
- `country` (filter)

**Logic:**
1. Build Prisma `where` clause from filters
2. Fetch paginated jobs with `findMany` + `count`
3. Load the profile once
4. For each job, compute `scoreJob(job, profile)` and attach score
5. If `sort=score`, sort in-memory after scoring (or pre-compute — see note below)
6. Return `{ jobs, total, page, totalPages }`

**Note on score sorting:** For large datasets, scoring every job on every request is expensive. For the initial implementation, we'll compute scores on-the-fly for the current page only. Sorting by score requires fetching all jobs and scoring them — we can limit this to the first 500 jobs or add a pre-computed `score` column later if needed.

---

## Step 6: Backend — Enhanced Scoring

**File:** `backend/src/services/scoring.ts`

Expand the scoring algorithm to use new profile fields:

```
Current scoring:
  - Keyword match (skills + targetTitles): 10pts × count (max 3 per keyword)
  - Recency: 10-30pts
  - Remote preference: 15pts
  - Citizenship penalty: -50pts

New additions:
  - Seniority match: Scan description for seniority keywords
    - If profile.seniority = "senior" and description contains "senior|sr\.|lead|staff": +20pts
    - If profile.seniority = "junior" and description contains "junior|jr\.|entry.level|associate": +20pts
    - If mismatched (e.g. junior profile but "10+ years required"): -15pts

  - Salary match: Compare job salary range with profile range
    - If job salary overlaps profile range: +15pts
    - If job salary below profile minimum: -20pts
    - No salary info: 0pts (neutral)

  - Primary vs Secondary skills:
    - Primary skill match: 15pts per keyword (instead of 10)
    - Secondary skill match: 5pts per keyword (instead of 10)
    - (Replace the current flat 10pts with this distinction)

  - Industry/domain match: Scan description for profile.industries keywords
    - Each match: +10pts (max 2 industries matched)

  - Education match: Scan description for degree requirements
    - If job requires degree user has: +5pts
    - If job requires higher degree than user has: -10pts

  - Work mode match:
    - If profile.workModePreference = "remote" and job.isRemote: +10pts
    - If profile.workModePreference = "onsite" and !job.isRemote: +5pts

  - Company type/size: Scan description for keywords
    - Startup indicators: "startup|early.stage|series.[a-c]|small.team"
    - Enterprise indicators: "fortune.500|enterprise|large.scale|global.company"
    - Match with profile.companySizePreference: +10pts

  - Experience years: Scan description for "X+ years" patterns
    - If within profile range: +10pts
    - If significantly above: -15pts
```

Update `scoreJob` function signature to accept the expanded Profile type.

---

## Step 7: Backend — Enhanced Recommended Runner

**File:** `backend/src/services/recommendedRunner.ts`

### 7a. Use expanded profile for query construction:

Current: `"${title} in ${location}"` and `"${title} remote"`

New query strategy — build smarter queries:
- Include seniority: `"senior software engineer in Chicago"`
- Include primary skills in some queries: `"react developer in Chicago"`
- Use `profile.roleTypes` → pass as `employment_types` param
- Use `profile.yearsOfExperience` → map to `job_requirements` param
- Use `profile.locationRadius` → pass as `radius` param
- Use `profile.workModePreference` → set `work_from_home` accordingly
- Use `profile.excludePublishers` → pass as `exclude_job_publishers`
- Use `profile.recommendedNumPages` for `num_pages` (instead of hardcoded 1)
- Use `profile.recommendedDatePosted` for `date_posted` (instead of hardcoded "week")

### 7b. More query combinations:

```
For each targetTitle:
  For each preferredLocation:
    - "{seniority} {title} in {location}" (with employment_types, job_requirements, radius)
  If remotePreferred or workModePreference == "remote":
    - "{seniority} {title} remote" (work_from_home=true)
  For top 2 primarySkills:
    - "{skill} {title}" (to find skill-specific roles)
```

---

## Step 8: Frontend — Update Types

**File:** `frontend/src/lib/types.ts`

### 8a. Expand Profile interface:

Add all new fields matching the Prisma schema additions.

### 8b. Expand Job interface:

Already has `score?: number` — no change needed. The score will now be returned from search results too.

---

## Step 9: Frontend — Persistent Search Results

**File:** `frontend/src/app/(app)/jobs/search/page.tsx`

Use `sessionStorage` to persist search state:

- On search completion, save `{ query, country, datePosted, remoteOnly, selectedTypes, jobs, numPages, jobRequirements, radius }` to `sessionStorage.setItem("searchState", JSON.stringify(...))`
- On component mount, check `sessionStorage.getItem("searchState")` and restore state if found
- On logout (in `useAuth` hook), call `sessionStorage.clear()`
- On new search, overwrite the stored state

This means navigating away from search and coming back preserves results without re-fetching.

---

## Step 10: Frontend — Enhanced Search Page UI

**File:** `frontend/src/app/(app)/jobs/search/page.tsx`

Add these controls to the search form:

| Control | Type | Maps to API param |
|---------|------|-------------------|
| Number of Pages | Number input (1-50, default from profile) | `num_pages` |
| Experience Level | Multi-select checkboxes | `job_requirements` |
| Search Radius (km) | Number input | `radius` |
| Exclude Publishers | Text input (comma-separated) | `exclude_job_publishers` |

Layout: Expand the existing filter row into a collapsible "Advanced Filters" section below the main search bar. Keep query + country + date_posted + remote + employment_types visible. Put num_pages, job_requirements, radius, exclude_publishers behind a "More Filters" toggle.

Also add a small display showing result count and score badge on each card (already supported by `JobCard` with `showScore`).

---

## Step 11: Frontend — Expanded Profile Page

**File:** `frontend/src/app/(app)/profile/page.tsx`

Add new sections to the profile form. Group them logically:

### Section: "Role Preferences" (new)
- **Seniority Level** — Select: Junior, Mid, Senior, Lead, Staff
- **Role Types** — Multi-checkbox: Full-time, Part-time, Contract, Intern
- **Work Mode** — Select: Any, Remote, Hybrid, Onsite
- **Years of Experience** — Number input

### Section: "Compensation" (new)
- **Minimum Salary** — Number input with "$" prefix
- **Maximum Salary** — Number input with "$" prefix

### Section: "Skills" (enhanced)
- **Primary Skills** — Tag input (new, replaces or supplements existing `skills`)
- **Secondary Skills** — Tag input (new)
- Keep existing **Skills & Keywords** as-is for backward compatibility, or migrate to primary/secondary

### Section: "Education" (new)
- **Highest Education** — Select: None, Associate, Bachelor's, Master's, PhD
- **Degrees / Fields of Study** — Tag input

### Section: "Industry & Company" (new)
- **Industry Preferences** — Tag input (e.g. fintech, healthcare, SaaS)
- **Company Size** — Select: Any, Startup, Mid-size, Enterprise
- **Company Types** — Tag input (e.g. product, consulting, agency)

### Section: "Location" (enhanced)
- Keep existing **Preferred Locations** tag input
- Add **Search Radius (km)** — Number input
- Add **Timezone Preference** — Text input

### Section: "Work Authorization" (enhanced)
- Keep existing toggle + text input
- Add **Exclude Publishers** — Tag input

### Section: "Search Settings" (new)
- **Default Pages per Search** — Number input (1-50, default 5)
- **Recommended: Pages per Query** — Number input (1-50, default 3)
- **Recommended: Date Posted Filter** — Select: Today, 3 Days, Week, Month

All new fields are optional — empty/null values are ignored by the backend.

---

## Step 12: Frontend — New "All Jobs" Page

### 12a. Create route

**New file:** `frontend/src/app/(app)/jobs/all/page.tsx`

### 12b. Page design — Data table layout:

A full-width table (not cards) with columns:
- **Title** (link/clickable to open detail panel)
- **Company**
- **Location** (with remote badge)
- **Type** (Full-time, Contract, etc.)
- **Salary** (formatted range)
- **Score** (computed relevance score, color-coded)
- **Posted** (relative date)
- **Discovered** (relative date)
- **Status** (saved status badge, or "—")
- **Actions** (Save, Ignore, Apply link)

### 12c. Features:
- Pagination (50 per page)
- Column header click to sort (by any column)
- Search/filter bar at top (text search across title + company)
- Filter chips: Remote only, Employment type, Salary range, Country
- Rows are compact — fits more data on screen
- Click a row to open `JobDetailPanel` on the right side
- Score column shows the computed score with color gradient (red < 20, yellow 20-50, green > 50)

### 12d. Update navigation

**File:** `frontend/src/app/(app)/jobs/layout.tsx` — Add "All Jobs" tab
**File:** `frontend/src/components/Sidebar.tsx` — Add "All Jobs" nav item

---

## Step 13: Frontend — Settings for API Parameters

The search settings are embedded in the Profile page (Step 11, "Search Settings" section). This covers:
- Default `num_pages` for manual search
- `num_pages` for recommended pull
- `date_posted` for recommended pull
- `exclude_job_publishers`

These are saved as part of the profile and used as defaults by the backend (Step 4b).

---

## File Change Summary

| File | Action | What changes |
|------|--------|-------------|
| `prisma/schema.prisma` | Edit | Add ~20 fields to Profile model |
| `backend/src/routes/profile.ts` | Edit | Handle new fields in PUT |
| `backend/src/routes/jobs.ts` | Edit | Expand search params, add /all endpoint, add scores to search results |
| `backend/src/services/jsearch.ts` | Edit | Add `language` to params interface |
| `backend/src/services/scoring.ts` | Edit | Expanded scoring algorithm |
| `backend/src/services/recommendedRunner.ts` | Edit | Smarter query construction using expanded profile |
| `frontend/src/lib/types.ts` | Edit | Expand Profile interface |
| `frontend/src/app/(app)/jobs/search/page.tsx` | Edit | Add filters, persist results, show scores |
| `frontend/src/app/(app)/profile/page.tsx` | Edit | Add all new profile sections |
| `frontend/src/app/(app)/jobs/all/page.tsx` | **Create** | New "All Jobs" data table page |
| `frontend/src/app/(app)/jobs/layout.tsx` | Edit | Add "All Jobs" tab |
| `frontend/src/components/Sidebar.tsx` | Edit | Add "All Jobs" nav item |

---

## Implementation Order

1. **Step 1** — Prisma schema migration (everything else depends on this)
2. **Steps 2-3** — Backend profile route + jsearch params (quick, unblocks frontend)
3. **Step 8** — Frontend types (unblocks all frontend work)
4. **Steps 4-5** — Backend search + all-jobs endpoints (can parallelize)
5. **Steps 6-7** — Scoring + recommended runner enhancements
6. **Steps 9-10** — Frontend search page enhancements
7. **Step 11** — Frontend profile page expansion
8. **Step 12** — Frontend All Jobs page (new file, independent)
9. **Step 13** — Already covered by Step 11
