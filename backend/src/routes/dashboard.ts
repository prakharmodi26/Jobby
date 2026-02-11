import { Router } from "express";
import { prisma } from "../prisma.js";

export const dashboardRouter = Router();

dashboardRouter.get("/stats", async (_req, res) => {
  const [totalJobs, totalSaved, statusCounts, recentRun, jobsLast24h, settings] =
    await Promise.all([
      prisma.job.count({ where: { ignored: false } }),
      prisma.savedJob.count(),
      prisma.savedJob.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
      prisma.recommendedRun.findFirst({
        orderBy: { runAt: "desc" },
        where: { status: "completed" },
      }),
      prisma.job.count({
        where: {
          discoveredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.settings.findFirst(),
    ]);

  // Daily discovery counts for the last 14 days (for bar chart)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const dailyDiscoveries: { date: string; count: number }[] =
    await prisma.$queryRaw`
      SELECT DATE("discoveredAt")::text as date, COUNT(*)::int as count
      FROM "Job"
      WHERE "discoveredAt" >= ${fourteenDaysAgo}
      GROUP BY DATE("discoveredAt")
      ORDER BY date ASC
    `;

  // Recent runs for a timeline view
  const recentRuns = await prisma.recommendedRun.findMany({
    orderBy: { runAt: "desc" },
    take: 7,
    where: { status: "completed" },
    select: {
      runAt: true,
      newJobs: true,
      totalFetched: true,
      duplicates: true,
    },
  });

  // Recommended count across all runs with expiry filter
  const expiryDays = settings?.recommendedExpiryDays ?? 5;
  const cutoff = new Date(Date.now() - expiryDays * 24 * 60 * 60 * 1000);

  const recommendedCountResult: { count: number }[] = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT rm."jobId")::int as count
    FROM "RecommendedMatch" rm
    JOIN "RecommendedRun" rr ON rr."id" = rm."runId"
    JOIN "Job" j ON j."id" = rm."jobId"
    WHERE rr."status" = 'completed'
      AND j."ignored" = false
      AND (j."postedAt" >= ${cutoff} OR j."postedAt" IS NULL)
  `;
  const recommendedCount = recommendedCountResult[0]?.count ?? 0;

  // Applied count
  const appliedCount = await prisma.savedJob.count({
    where: { status: { not: "saved" } },
  });

  res.json({
    totalJobs,
    jobsLast24h,
    recommendedCount,
    totalSaved,
    appliedCount,
    statusBreakdown: statusCounts.map((s) => ({
      status: s.status,
      count: s._count.status,
    })),
    lastRunAt: recentRun?.runAt ?? null,
    lastRunNewJobs: recentRun?.newJobs ?? 0,
    dailyDiscoveries,
    recentRuns,
    quotaExceeded: false,
  });
});

dashboardRouter.get("/recent", async (_req, res) => {
  const settings = await prisma.settings.findFirst();
  const expiryDays = settings?.recommendedExpiryDays ?? 5;
  const cutoff = new Date(Date.now() - expiryDays * 24 * 60 * 60 * 1000);

  // Get top 5 jobs by score across all completed runs, with expiry
  const topMatches: { jobId: number; score: number }[] = await prisma.$queryRaw`
    SELECT DISTINCT ON (rm."jobId")
      rm."jobId", rm."score"
    FROM "RecommendedMatch" rm
    JOIN "RecommendedRun" rr ON rr."id" = rm."runId"
    JOIN "Job" j ON j."id" = rm."jobId"
    WHERE rr."status" = 'completed'
      AND j."ignored" = false
      AND (j."postedAt" >= ${cutoff} OR j."postedAt" IS NULL)
    ORDER BY rm."jobId", rm."score" DESC
  `;

  // Sort by score descending, take top 5
  topMatches.sort((a, b) => b.score - a.score);
  const top5 = topMatches.slice(0, 5);

  if (top5.length === 0) {
    res.json([]);
    return;
  }

  const jobs = await prisma.job.findMany({
    where: { id: { in: top5.map((m) => m.jobId) } },
    include: { savedJobs: true },
  });

  const scoreMap = new Map(top5.map((m) => [m.jobId, m.score]));

  const result = jobs
    .map((job) => ({
      ...job,
      score: scoreMap.get(job.id) ?? 0,
      rank: 0,
      savedStatus: job.savedJobs[0]?.status ?? null,
    }))
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  res.json(result);
});
