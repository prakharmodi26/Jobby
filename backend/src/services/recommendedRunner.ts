import { prisma } from "../prisma.js";
import { searchJobs } from "./jsearch.js";
import { upsertJob } from "./jobUpsert.js";
import { scoreJob } from "./scoring.js";
import type { JSearchParams } from "./jsearch.js";
import type { Settings, Profile, RecommendedRun } from "@prisma/client";

function mapYearsToRequirement(years: number | null): string | undefined {
  if (years === null || years === undefined) return undefined;
  if (years < 3) return "under_3_years_experience";
  return "more_than_3_years_experience";
}

async function executeRecommendedPull(
  run: RecommendedRun,
  profile: Profile,
  settings: Settings | null
) {
  let totalFetched = 0;
  let newJobs = 0;
  let duplicates = 0;
  const jobIdsThisRun: number[] = [];

  // Shared params from settings + profile
  const sharedParams: Partial<JSearchParams> = {
    num_pages: settings?.recommendedNumPages || 3,
    date_posted: settings?.recommendedDatePosted || "week",
    employment_types: profile.roleTypes.length > 0 ? profile.roleTypes.join(",") : undefined,
    job_requirements: mapYearsToRequirement(profile.yearsOfExperience),
    exclude_job_publishers: settings?.excludePublishers?.length
      ? settings.excludePublishers.join(",")
      : undefined,
  };

  const seniorityPrefix = profile.seniority && profile.seniority !== "mid"
    ? `${profile.seniority} `
    : "";

  try {
    const queries: { query: string; work_from_home?: boolean }[] = [];

    for (const title of profile.targetTitles) {
      const prefixedTitle = `${seniorityPrefix}${title}`;

      // Title + location combinations
      if (profile.preferredLocations.length > 0) {
        for (const loc of profile.preferredLocations) {
          queries.push({ query: `${prefixedTitle} in ${loc}` });
        }
      } else {
        queries.push({ query: prefixedTitle });
      }

      // Remote query if preferred
      if (profile.remotePreferred || profile.workModePreference === "remote") {
        queries.push({ query: `${prefixedTitle} remote`, work_from_home: true });
      }
    }

    // Skill-based queries for top 2 skills
    const topSkills = profile.skills.slice(0, 2);
    for (const skill of topSkills) {
      for (const title of profile.targetTitles) {
        queries.push({ query: `${skill} ${title}` });
      }
    }

    console.log(`[RecommendedPull] Running ${queries.length} queries with num_pages=${sharedParams.num_pages}`);

    for (const q of queries) {
      try {
        const response = await searchJobs({
          query: q.query,
          ...sharedParams,
          work_from_home: q.work_from_home || undefined,
        });

        for (const apiJob of response.data) {
          totalFetched++;
          const result = await upsertJob(apiJob);
          if (result.isNew) {
            newJobs++;
          } else {
            duplicates++;
          }
          if (!jobIdsThisRun.includes(result.jobId)) {
            jobIdsThisRun.push(result.jobId);
          }
        }
      } catch (err) {
        console.error(`[RecommendedPull] Query "${q.query}" failed:`, err);
      }
    }

    console.log(`[RecommendedPull] Fetched ${totalFetched} jobs (${newJobs} new, ${duplicates} dupes), scoring ${jobIdsThisRun.length} unique`);

    // Score all discovered jobs
    const jobs = await prisma.job.findMany({
      where: { id: { in: jobIdsThisRun } },
    });

    const scored = jobs.map((job) => ({
      jobId: job.id,
      score: settings ? scoreJob(job, profile, settings) : 0,
    }));

    scored.sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      await prisma.recommendedMatch.createMany({
        data: scored.map((s, idx) => ({
          runId: run.id,
          jobId: s.jobId,
          score: s.score,
          rank: idx + 1,
        })),
        skipDuplicates: true,
      });
    }

    await prisma.recommendedRun.update({
      where: { id: run.id },
      data: {
        totalFetched,
        newJobs,
        duplicates,
        status: "completed",
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

export async function runRecommendedPull() {
  const profile = await prisma.profile.findFirst();
  if (!profile || profile.targetTitles.length === 0) {
    throw new Error("Profile not configured — set target titles first");
  }

  const settings = await prisma.settings.findFirst() as Settings | null;

  const run = await prisma.recommendedRun.create({
    data: {
      status: "running",
      paramsJson: JSON.stringify({
        targetTitles: profile.targetTitles,
        locations: profile.preferredLocations,
        remote: profile.remotePreferred,
        seniority: profile.seniority,
        skills: profile.skills,
        numPages: settings?.recommendedNumPages || 3,
        datePosted: settings?.recommendedDatePosted || "week",
      }),
    },
  });

  const result = await executeRecommendedPull(run, profile, settings);

  return { id: run.id, ...result };
}

export async function startRecommendedPull(): Promise<number> {
  const profile = await prisma.profile.findFirst();
  if (!profile || profile.targetTitles.length === 0) {
    throw new Error("Profile not configured — set target titles first");
  }

  const settings = await prisma.settings.findFirst() as Settings | null;

  const run = await prisma.recommendedRun.create({
    data: {
      status: "running",
      paramsJson: JSON.stringify({
        targetTitles: profile.targetTitles,
        locations: profile.preferredLocations,
        remote: profile.remotePreferred,
        seniority: profile.seniority,
        skills: profile.skills,
        numPages: settings?.recommendedNumPages || 3,
        datePosted: settings?.recommendedDatePosted || "week",
      }),
    },
  });

  // Fire and forget — don't await
  executeRecommendedPull(run, profile, settings).catch((err) => {
    console.error("[RecommendedPull] Background pull failed:", err);
  });

  return run.id;
}
