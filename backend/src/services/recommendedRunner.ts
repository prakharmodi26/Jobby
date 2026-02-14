import { prisma } from "../prisma.js";
import { searchJobs } from "./jsearch.js";
import { upsertJob } from "./jobUpsert.js";
import { scoreJob } from "./scoring.js";
import type { JSearchParams } from "./jsearch.js";
import type { RecommendedRun, ScoringPattern, RecommendedQuery } from "@prisma/client";

const cancelledRuns = new Set<number>();

async function executeRecommendedPull(
  run: RecommendedRun,
  queries: RecommendedQuery[],
  patterns: ScoringPattern[],
  minScore: number
) {
  let totalFetched = 0;
  let newJobs = 0;
  let duplicates = 0;
  let queryErrors = 0;
  let lastErrorMessage = "";
  const jobIdsThisRun: number[] = [];

  async function upsertMatchesIncremental(jobIds: number[]) {
    if (jobIds.length === 0) return;

    const jobs = await prisma.job.findMany({
      where: { id: { in: jobIds } },
    });

    const scored = jobs
      .map((job) => ({
        jobId: job.id,
        ...scoreJob(job, patterns),
      }))
      .filter((s) => s.score >= minScore && !s.disqualified)
      .sort((a, b) => b.score - a.score);

    await prisma.$transaction(
      scored.map((s) =>
        prisma.recommendedMatch.upsert({
          where: { runId_jobId: { runId: run.id, jobId: s.jobId } },
          create: { runId: run.id, jobId: s.jobId, score: s.score },
          update: { score: s.score },
        })
      )
    );
  }

  try {
    console.log(`[RecommendedPull] Running ${queries.length} queries`);

    for (const q of queries) {
      if (cancelledRuns.has(run.id)) {
        console.log(`[RecommendedPull] Run ${run.id} cancelled; stopping remaining queries`);
        break;
      }

      const searchParams: JSearchParams = {
        query: q.query,
        page: q.page,
        num_pages: q.numPages,
        country: q.country,
        language: q.language || undefined,
        date_posted: q.datePosted !== "all" ? q.datePosted : undefined,
        work_from_home: q.workFromHome || undefined,
        employment_types: q.employmentTypes || undefined,
        job_requirements: q.jobRequirements || undefined,
        radius: q.radius || undefined,
        exclude_job_publishers: q.excludeJobPublishers || undefined,
      };

      console.log(
        `[RecommendedPull] Query #${q.id}: "${q.query}" (country=${q.country}, datePosted=${q.datePosted}, pages=${q.numPages}, remote=${q.workFromHome})`
      );

      try {
        const response = await searchJobs(searchParams);

        for (const apiJob of response.data) {
          totalFetched++;
          const result = await upsertJob(apiJob);
          if (result.isNew) newJobs++;
          else duplicates++;
          if (!jobIdsThisRun.includes(result.jobId)) {
            jobIdsThisRun.push(result.jobId);
          }
        }

        await upsertMatchesIncremental(jobIdsThisRun);
      } catch (err) {
        queryErrors++;
        lastErrorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[RecommendedPull] Query "${q.query}" failed:`, err);
      }
    }

    console.log(
      `[RecommendedPull] Fetched ${totalFetched} jobs (${newJobs} new, ${duplicates} dupes), scoring ${jobIdsThisRun.length} unique`
    );

    // Final scoring pass
    const jobs = await prisma.job.findMany({
      where: { id: { in: jobIdsThisRun } },
    });

    const scored = jobs.map((job) => ({
      jobId: job.id,
      ...scoreJob(job, patterns),
    }));

    const filtered = scored
      .filter((s) => s.score >= minScore && !s.disqualified)
      .sort((a, b) => b.score - a.score);

    await upsertMatchesIncremental(filtered.map((s) => s.jobId));

    const allFailed = totalFetched === 0 && queryErrors > 0 && queryErrors === queries.length;

    await prisma.recommendedRun.update({
      where: { id: run.id },
      data: {
        totalFetched,
        newJobs,
        duplicates,
        status: cancelledRuns.has(run.id)
          ? "cancelled"
          : allFailed
            ? "failed"
            : "completed",
        errorMessage: allFailed ? lastErrorMessage : null,
      },
    });

    return { totalFetched, newJobs, duplicates };
  } catch (err) {
    await prisma.recommendedRun.update({
      where: { id: run.id },
      data: { status: "failed", errorMessage: String(err) },
    });
    throw err;
  }
}

export async function startRecommendedPull(): Promise<number> {
  const queries = await prisma.recommendedQuery.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "desc" },
  });

  if (queries.length === 0) {
    throw new Error("No recommended queries configured — add queries in Settings first");
  }

  const patterns = await prisma.scoringPattern.findMany({
    where: { enabled: true },
  });

  let settings = await prisma.settings.findFirst();
  if (!settings) {
    settings = await prisma.settings.create({ data: {} });
  }

  const minScore = settings.minRecommendedScore ?? 50;

  const run = await prisma.recommendedRun.create({
    data: {
      status: "running",
      paramsJson: JSON.stringify({
        queryIds: queries.map((q) => q.id),
        queryTexts: queries.map((q) => q.query),
        patternCount: patterns.length,
        minScore,
      }),
    },
  });

  // Fire and forget
  executeRecommendedPull(run, queries, patterns, minScore).catch((err) => {
    console.error("[RecommendedPull] Background pull failed:", err);
  });

  return run.id;
}

export function cancelRecommendedRun(runId: number) {
  cancelledRuns.add(runId);
}
