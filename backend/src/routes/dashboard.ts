import { Router } from "express";
import { prisma } from "../prisma.js";

export const dashboardRouter = Router();

dashboardRouter.get("/stats", async (_req, res) => {
  const [totalJobs, totalSaved, statusCounts, recentRun, jobsLast24h] =
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

  // Recommended count from latest run
  const recommendedCount = recentRun
    ? await prisma.recommendedMatch.count({
        where: { runId: recentRun.id, job: { ignored: false } },
      })
    : 0;

  // Check for recent quota errors (failed runs with 429/quota messages)
  const latestFailedRun = await prisma.recommendedRun.findFirst({
    orderBy: { runAt: "desc" },
    where: {
      status: "failed",
      errorMessage: { not: null },
    },
  });

  const quotaExceeded =
    latestFailedRun?.errorMessage?.includes("429") ||
    latestFailedRun?.errorMessage?.toLowerCase().includes("exceeded") ||
    false;

  // Only show alert if the failed run is more recent than the last successful run
  const showQuotaAlert =
    quotaExceeded &&
    (!recentRun || latestFailedRun!.runAt > recentRun.runAt);

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
    quotaExceeded: showQuotaAlert,
  });
});

dashboardRouter.get("/recent", async (_req, res) => {
  const latestRun = await prisma.recommendedRun.findFirst({
    orderBy: { runAt: "desc" },
    where: { status: "completed" },
  });
  if (!latestRun) {
    res.json([]);
    return;
  }

  const matches = await prisma.recommendedMatch.findMany({
    where: { runId: latestRun.id, job: { ignored: false } },
    orderBy: { rank: "asc" },
    take: 5,
    include: {
      job: { include: { savedJobs: true } },
    },
  });

  res.json(
    matches.map((m) => ({
      ...m.job,
      score: m.score,
      rank: m.rank,
      savedStatus: m.job.savedJobs[0]?.status ?? null,
    }))
  );
});
