import { Router } from "express";
import { prisma } from "../prisma.js";
import { startRecommendedPull } from "../services/recommendedRunner.js";

export const adminRouter = Router();

adminRouter.post("/run-recommended", async (_req, res) => {
  try {
    // Check for an already-running pull (with 15-min staleness cutoff)
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const activeRun = await prisma.recommendedRun.findFirst({
      where: {
        status: "running",
        runAt: { gte: fifteenMinAgo },
      },
    });
    if (activeRun) {
      res.status(409).json({ error: "A recommended pull is already running" });
      return;
    }

    const runId = await startRecommendedPull();
    res.status(202).json({ started: true, runId });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
});

adminRouter.get("/recommended-status", async (_req, res) => {
  try {
    const latestRun = await prisma.recommendedRun.findFirst({
      orderBy: { runAt: "desc" },
    });

    if (!latestRun) {
      res.json({ status: "none" });
      return;
    }

    res.json({
      status: latestRun.status,
      runId: latestRun.id,
      runAt: latestRun.runAt,
      totalFetched: latestRun.totalFetched,
      newJobs: latestRun.newJobs,
      duplicates: latestRun.duplicates,
      errorMessage: latestRun.errorMessage,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
});
