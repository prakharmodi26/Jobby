import { Router } from "express";
import { prisma } from "../prisma.js";
import { searchJobs } from "../services/jsearch.js";
import { upsertJob } from "../services/jobUpsert.js";
import { scoreJob } from "../services/scoring.js";
import type { Prisma } from "@prisma/client";

export const jobsRouter = Router();

// GET /api/jobs/recommended
jobsRouter.get("/recommended", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const offset = (page - 1) * limit;

  const latestRun = await prisma.recommendedRun.findFirst({
    orderBy: { runAt: "desc" },
    where: { status: "completed" },
  });

  if (!latestRun) {
    res.json({ jobs: [], total: 0, page, totalPages: 0 });
    return;
  }

  const where = { runId: latestRun.id, job: { ignored: false } };

  const [matches, total] = await Promise.all([
    prisma.recommendedMatch.findMany({
      where,
      orderBy: { rank: "asc" },
      skip: offset,
      take: limit,
      include: {
        job: { include: { savedJobs: true } },
      },
    }),
    prisma.recommendedMatch.count({ where }),
  ]);

  res.json({
    jobs: matches.map((m) => ({
      ...m.job,
      score: m.score,
      rank: m.rank,
      savedStatus: m.job.savedJobs[0]?.status ?? null,
      savedId: m.job.savedJobs[0]?.id ?? null,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// POST /api/jobs/:id/save
jobsRouter.post("/:id/save", async (req, res) => {
  const jobId = parseInt(req.params.id);
  const { status } = req.body;

  const saved = await prisma.savedJob.upsert({
    where: { jobId },
    create: {
      jobId,
      status: status || "saved",
      appliedAt: status && status !== "saved" ? new Date() : null,
    },
    update: {},
  });

  res.json(saved);
});

// POST /api/jobs/:id/ignore
jobsRouter.post("/:id/ignore", async (req, res) => {
  await prisma.job.update({
    where: { id: parseInt(req.params.id) },
    data: { ignored: true },
  });
  res.json({ success: true });
});

// DELETE /api/jobs/:id/ignore
jobsRouter.delete("/:id/ignore", async (req, res) => {
  await prisma.job.update({
    where: { id: parseInt(req.params.id) },
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
      status: s.status,
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
  if (status && status !== "saved" && appliedAt === undefined) {
    const existing = await prisma.savedJob.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (existing && !existing.appliedAt) {
      data.appliedAt = new Date();
    }
  }

  const updated = await prisma.savedJob.update({
    where: { id: parseInt(req.params.id) },
    data,
    include: { job: true },
  });

  res.json(updated);
});

// DELETE /api/jobs/saved/:id
jobsRouter.delete("/saved/:id", async (req, res) => {
  await prisma.savedJob.delete({
    where: { id: parseInt(req.params.id) },
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

  // Load profile for defaults and scoring
  const profile = await prisma.profile.findFirst();

  // Build search params — user-provided values override profile defaults
  const searchParams = {
    query: query as string,
    page: parseInt(page as string) || 1,
    num_pages: parseInt(num_pages as string) || profile?.searchNumPages || 5,
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
    radius: radius ? parseInt(radius as string) : (profile?.locationRadius ?? undefined),
    exclude_job_publishers: (exclude_job_publishers as string)
      || (profile?.excludePublishers?.length ? profile.excludePublishers.join(",") : undefined),
  };

  let results;
  try {
    results = await searchJobs(searchParams);
  } catch (err) {
    console.error("[Search] JSearch API call failed:", err);
    throw err;
  }

  console.log(`[Search] JSearch returned ${results.data?.length ?? 0} jobs`);

  // Upsert each result into local DB for dedup + save capability
  const localJobs = [];
  let newCount = 0;
  let dupeCount = 0;
  let errorCount = 0;

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
          score: profile ? scoreJob(job, profile) : 0,
          savedStatus: job.savedJobs[0]?.status ?? null,
          savedId: job.savedJobs[0]?.id ?? null,
        });
      }
    } catch (err) {
      errorCount++;
      console.error(`[Search] Failed to upsert job "${apiJob.job_title}" (${apiJob.job_id}):`, err);
    }
  }

  console.log(`[Search] Upsert results — new: ${newCount}, dupes: ${dupeCount}, errors: ${errorCount}`);
  console.log(`[Search] Responding with ${localJobs.length} jobs`);

  res.json({ jobs: localJobs, total: localJobs.length });
});

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

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
    ];
  }
  if (remote === "true") {
    where.isRemote = true;
  }
  if (employmentType) {
    where.employmentType = employmentType;
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

  const validSortColumns = ["discoveredAt", "title", "company", "salaryMin", "postedAt"];
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

  const profile = await prisma.profile.findFirst();

  let scored = jobs.map((job) => ({
    ...job,
    score: profile ? scoreJob(job, profile) : 0,
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
