import { Router } from "express";
import { prisma } from "../prisma.js";
import { searchJobs } from "../services/jsearch.js";
import { upsertJob } from "../services/jobUpsert.js";
import { scoreJob } from "../services/scoring.js";
import type { Prisma, Settings } from "@prisma/client";

export const jobsRouter = Router();

// GET /api/jobs/recommended
jobsRouter.get("/recommended", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const offset = (page - 1) * limit;

  // Sort/filter params
  const sort = (req.query.sort as string) || "score";
  const order = (req.query.order as string) === "asc" ? "asc" : "desc";
  const search = (req.query.search as string) || "";
  const remote = req.query.remote === "true";
  const employmentType = (req.query.employmentType as string) || "";

  // Load expiry setting
  const settings = await prisma.settings.findFirst();
  const expiryDays = settings?.recommendedExpiryDays ?? 5;
  const cutoff = new Date(Date.now() - expiryDays * 24 * 60 * 60 * 1000);

  // Get best match per job across all completed runs, filtered by expiry
  // Use a subquery to pick the highest score per jobId
  const bestMatches: { id: number; jobId: number; score: number }[] =
    await prisma.$queryRaw`
      SELECT DISTINCT ON (rm."jobId")
        rm."id", rm."jobId", rm."score"
      FROM "RecommendedMatch" rm
      JOIN "RecommendedRun" rr ON rr."id" = rm."runId"
      JOIN "Job" j ON j."id" = rm."jobId"
      WHERE rr."status" IN ('completed', 'running', 'cancelled')
        AND j."ignored" = false
        AND (j."postedAt" >= ${cutoff} OR j."postedAt" IS NULL)
      ORDER BY rm."jobId", rm."score" DESC
    `;

  if (bestMatches.length === 0) {
    res.json({ jobs: [], total: 0, page, totalPages: 0 });
    return;
  }

  // Load full job data for these matches
  const matchMap = new Map(bestMatches.map((m) => [m.jobId, m]));
  const jobIds = bestMatches.map((m) => m.jobId);

  // Build additional filters
  const jobWhere: Prisma.JobWhereInput = {
    id: { in: jobIds },
    ignored: false,
  };
  const andConditions: Prisma.JobWhereInput[] = [];

  if (search) {
    andConditions.push({
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  if (remote) {
    jobWhere.isRemote = true;
  }
  if (employmentType) {
    const types = employmentType.split(",").map((t) => t.trim()).filter(Boolean);
    if (types.length === 1) {
      jobWhere.employmentType = { contains: types[0], mode: "insensitive" };
    } else if (types.length > 1) {
      andConditions.push({
        OR: types.map((t) => ({
          employmentType: { contains: t, mode: "insensitive" as const },
        })),
      });
    }
  }
  if (andConditions.length > 0) {
    jobWhere.AND = andConditions;
  }

  const total = await prisma.job.count({ where: jobWhere });

  // Determine sort
  const validJobSorts = ["postedAt", "discoveredAt", "title", "company"];
  const sortByScore = sort === "score";

  const dbOrder: Record<string, string> = {};
  if (!sortByScore && validJobSorts.includes(sort)) {
    dbOrder[sort] = order;
  } else if (!sortByScore) {
    dbOrder.discoveredAt = order;
  }

  const jobs = await prisma.job.findMany({
    where: jobWhere,
    orderBy: sortByScore ? { discoveredAt: "desc" } : dbOrder,
    skip: sortByScore ? 0 : offset,
    take: sortByScore ? undefined : limit,
    include: { savedJobs: true },
  });

  let results = jobs.map((job) => {
    const match = matchMap.get(job.id);
    return {
      ...job,
      score: match?.score ?? 0,
      savedStatus: job.savedJobs[0]?.status ?? null,
      savedId: job.savedJobs[0]?.id ?? null,
    };
  });

  // Sort and paginate
  if (sortByScore) {
    results.sort((a, b) => order === "asc" ? a.score - b.score : b.score - a.score);
    results = results.slice(offset, offset + limit);
  }

  res.json({
    jobs: results,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// POST /api/jobs/:id/save
jobsRouter.post("/:id/save", async (req, res) => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const jobId = parseInt(idParam);
  const { status } = req.body;

  const updateData: Record<string, unknown> = {};
  if (status) {
    updateData.status = status;
    if (status !== "saved") {
      // Set appliedAt only if not already set
      const existing = await prisma.savedJob.findUnique({ where: { jobId } });
      if (!existing?.appliedAt) {
        updateData.appliedAt = new Date();
      }
    }
  }

  const saved = await prisma.savedJob.upsert({
    where: { jobId },
    create: {
      jobId,
      status: status || "saved",
      appliedAt: status && status !== "saved" ? new Date() : null,
    },
    update: updateData,
  });

  res.json(saved);
});

// POST /api/jobs/:id/ignore
jobsRouter.post("/:id/ignore", async (req, res) => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await prisma.job.update({
    where: { id: parseInt(idParam) },
    data: { ignored: true },
  });
  res.json({ success: true });
});

// DELETE /api/jobs/:id/ignore
jobsRouter.delete("/:id/ignore", async (req, res) => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await prisma.job.update({
    where: { id: parseInt(idParam) },
    data: { ignored: false },
  });
  res.json({ success: true });
});

// GET /api/jobs/saved
jobsRouter.get("/saved", async (req, res) => {
  const status = req.query.status as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const offset = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;

  const [savedJobs, total] = await Promise.all([
    prisma.savedJob.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: offset,
      take: limit,
      include: { job: true },
    }),
    prisma.savedJob.count({ where }),
  ]);

  res.json({
    jobs: savedJobs.map((s) => ({
      ...s.job,
      savedId: s.id,
      savedStatus: s.status,
      notes: s.notes,
      appliedAt: s.appliedAt,
      savedCreatedAt: s.createdAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// PATCH /api/jobs/saved/:id
jobsRouter.patch("/saved/:id", async (req, res) => {
  const { status, notes, appliedAt } = req.body;
  const data: Record<string, unknown> = {};

  if (status !== undefined) data.status = status;
  if (notes !== undefined) data.notes = notes;
  if (appliedAt !== undefined) {
    data.appliedAt = appliedAt ? new Date(appliedAt) : null;
  }
  // Auto-set appliedAt when moving to a non-saved status
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (status && status !== "saved" && appliedAt === undefined) {
    const existing = await prisma.savedJob.findUnique({
      where: { id: parseInt(idParam) },
    });
    if (existing && !existing.appliedAt) {
      data.appliedAt = new Date();
    }
  }

  const updated = await prisma.savedJob.update({
    where: { id: parseInt(idParam) },
    data,
    include: { job: true },
  });

  res.json(updated);
});

// DELETE /api/jobs/saved/:id
jobsRouter.delete("/saved/:id", async (req, res) => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await prisma.savedJob.delete({
    where: { id: parseInt(idParam) },
  });
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// GET /api/jobs/search — proxy to JSearch, upsert results, return with scores
// ---------------------------------------------------------------------------
jobsRouter.get("/search", async (req, res) => {
  const {
    query,
    page,
    num_pages,
    country,
    language,
    date_posted,
    work_from_home,
    employment_types,
    job_requirements,
    radius,
    exclude_job_publishers,
  } = req.query;

  console.log(`[Search] Incoming request — query="${query}", page=${page}, num_pages=${num_pages}, country=${country}, date_posted=${date_posted}, remote=${work_from_home}, types=${employment_types}, requirements=${job_requirements}, radius=${radius}`);

  if (!query) {
    console.log("[Search] Rejected: missing query parameter");
    res.status(400).json({ error: "query is required" });
    return;
  }

  // Load profile for defaults and scoring, load settings for search params and weights
  const [profile, settingsRaw] = await Promise.all([
    prisma.profile.findFirst(),
    prisma.settings.findFirst() as Promise<Settings | null>,
  ]);
  const settings =
    settingsRaw ??
    (await prisma.settings.create({
      data: {},
    }));

  // Build search params — user-provided values override settings/profile defaults
  const searchParams = {
    query: query as string,
    page: parseInt(page as string) || 1,
    num_pages: parseInt(num_pages as string) || settings.searchNumPages || 3,
    country: (country as string) || "us",
    language: (language as string) || undefined,
    date_posted: (date_posted as string) || undefined,
    work_from_home: work_from_home === "true"
      ? true
      : (work_from_home === undefined && profile?.remotePreferred)
        ? true
        : undefined,
    employment_types: (employment_types as string)
      || (profile?.roleTypes?.length ? profile.roleTypes.join(",") : undefined),
    job_requirements: (job_requirements as string) || undefined,
    radius: radius ? parseInt(radius as string) : undefined,
    exclude_job_publishers: (exclude_job_publishers as string)
      || (settings?.excludePublishers?.length ? settings.excludePublishers.join(",") : undefined),
  };

  let results;
  try {
    results = await searchJobs(searchParams);
  } catch (err) {
    console.error("[Search] JSearch API call failed:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
      res.status(429).json({ error: "Search failed: API usage limit reached." });
      return;
    }
    res.status(502).json({ error: "Search failed. Please try again." });
    return;
  }

  console.log(`[Search] JSearch returned ${results.data?.length ?? 0} jobs`);

  // Upsert each result into local DB for dedup + save capability
  const localJobs = [];
  let newCount = 0;
  let dupeCount = 0;
  let errorCount = 0;
  const scoredForRun: { jobId: number; score: number }[] = [];

  for (const apiJob of results.data) {
    try {
      const { jobId, isNew } = await upsertJob(apiJob);
      if (isNew) newCount++;
      else dupeCount++;
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { savedJobs: true },
      });
      if (job) {
        localJobs.push({
          ...job,
          score: profile ? scoreJob(job, profile, settings) : 0,
          savedStatus: job.savedJobs[0]?.status ?? null,
          savedId: job.savedJobs[0]?.id ?? null,
        });
        if (profile) {
          const score = scoreJob(job, profile, settings);
          scoredForRun.push({ jobId: job.id, score });
        }
      }
    } catch (err) {
      errorCount++;
      console.error(`[Search] Failed to upsert job "${apiJob.job_title}" (${apiJob.job_id}):`, err);
    }
  }

  console.log(`[Search] Upsert results — new: ${newCount}, dupes: ${dupeCount}, errors: ${errorCount}`);
  console.log(`[Search] Responding with ${localJobs.length} jobs`);

  // Record a run and insert matches for jobs meeting the min score
  if (profile && scoredForRun.length > 0) {
    const minScore = settings.minRecommendedScore ?? 50;
    const filtered = scoredForRun
      .filter((s) => s.score >= minScore)
      .sort((a, b) => b.score - a.score);

    try {
      const run = await prisma.recommendedRun.create({
        data: {
          status: "completed",
          paramsJson: JSON.stringify({
            source: "search",
            query,
            num_pages: searchParams.num_pages,
            country,
            date_posted,
          }),
          totalFetched: totalFetchedFromResults(results),
          newJobs: newCount,
          duplicates: dupeCount,
        },
      });

      if (filtered.length > 0) {
        await prisma.recommendedMatch.createMany({
          data: filtered.map((s, idx) => ({
            runId: run.id,
            jobId: s.jobId,
            score: s.score,
          })),
          skipDuplicates: true,
        });
      }
    } catch (err) {
      console.error("[Search] Failed to create recommended matches for search:", err);
    }
  }

  res.json({ jobs: localJobs, total: localJobs.length });
});

function totalFetchedFromResults(results: { data?: unknown[] }): number {
  if (!results?.data || !Array.isArray(results.data)) return 0;
  return results.data.length;
}

// ---------------------------------------------------------------------------
// GET /api/jobs/all — paginated view of all discovered jobs with scores
// ---------------------------------------------------------------------------
jobsRouter.get("/all", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
  const offset = (page - 1) * limit;
  const sort = (req.query.sort as string) || "discoveredAt";
  const order = (req.query.order as string) === "asc" ? "asc" : "desc";
  const search = req.query.search as string | undefined;
  const remote = req.query.remote as string | undefined;
  const employmentType = req.query.employmentType as string | undefined;
  const minSalary = req.query.minSalary ? parseFloat(req.query.minSalary as string) : undefined;
  const maxSalary = req.query.maxSalary ? parseFloat(req.query.maxSalary as string) : undefined;
  const countryFilter = req.query.country as string | undefined;

  // Build where clause
  const where: Prisma.JobWhereInput = { ignored: false };
  const andConditions: Prisma.JobWhereInput[] = [];

  if (search) {
    andConditions.push({
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  if (remote === "true") {
    where.isRemote = true;
  }
  if (employmentType) {
    const types = employmentType.split(",").map((t) => t.trim()).filter(Boolean);
    if (types.length === 1) {
      where.employmentType = { contains: types[0], mode: "insensitive" };
    } else if (types.length > 1) {
      andConditions.push({
        OR: types.map((t) => ({
          employmentType: { contains: t, mode: "insensitive" as const },
        })),
      });
    }
  }
  if (andConditions.length > 0) {
    where.AND = andConditions;
  }
  if (minSalary !== undefined) {
    where.salaryMin = { gte: minSalary };
  }
  if (maxSalary !== undefined) {
    where.salaryMax = { lte: maxSalary };
  }
  if (countryFilter) {
    where.country = { equals: countryFilter, mode: "insensitive" };
  }

  // For score sorting we need to score in-memory
  const sortByScore = sort === "score";

  const validSortColumns = ["discoveredAt", "title", "company", "salaryMin", "postedAt", "employmentType"];
  const orderBy: Record<string, string> = {};
  if (!sortByScore && validSortColumns.includes(sort)) {
    orderBy[sort] = order;
  } else if (!sortByScore) {
    orderBy.discoveredAt = order;
  }

  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy: sortByScore ? { discoveredAt: "desc" } : orderBy,
      skip: sortByScore ? 0 : offset,
      take: sortByScore ? 500 : limit, // fetch more for score sorting
      include: { savedJobs: true },
    }),
  ]);

  const [profile, allJobsSettings] = await Promise.all([
    prisma.profile.findFirst(),
    prisma.settings.findFirst() as Promise<Settings | null>,
  ]);

  let scored = jobs.map((job) => ({
    ...job,
    score: profile && allJobsSettings ? scoreJob(job, profile, allJobsSettings) : 0,
    savedStatus: job.savedJobs[0]?.status ?? null,
    savedId: job.savedJobs[0]?.id ?? null,
  }));

  if (sortByScore) {
    scored.sort((a, b) => order === "asc" ? a.score - b.score : b.score - a.score);
    scored = scored.slice(offset, offset + limit);
  }

  res.json({
    jobs: scored,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});
