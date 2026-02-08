import { createHash } from "crypto";
import { prisma } from "../prisma.js";
import type { JSearchJob } from "./jsearch.js";

// Strip tracking params from URLs for canonical comparison
function canonicalizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const paramsToStrip = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "ref",
      "source",
    ];
    for (const param of paramsToStrip) {
      parsed.searchParams.delete(param);
    }
    // Sort remaining params for consistency
    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return null;
  }
}

function computeFingerprint(
  company: string,
  title: string,
  location: string | null,
  postedAt: string | null
): string {
  const raw = [company || "", title || "", location || "", postedAt || ""]
    .map((s) => s.toLowerCase().trim())
    .join("|");
  return createHash("sha256").update(raw).digest("hex");
}

export interface UpsertResult {
  jobId: number;
  isNew: boolean;
}

export async function upsertJob(apiJob: JSearchJob): Promise<UpsertResult> {
  const canonical = canonicalizeUrl(apiJob.job_apply_link);
  const fingerprint = computeFingerprint(
    apiJob.employer_name,
    apiJob.job_title,
    apiJob.job_location,
    apiJob.job_posted_at_datetime_utc
  );

  const jobData = {
    source: "jsearch",
    sourceJobId: apiJob.job_id,
    title: apiJob.job_title,
    company: apiJob.employer_name,
    companyLogo: apiJob.employer_logo,
    location: apiJob.job_location,
    city: apiJob.job_city,
    state: apiJob.job_state,
    country: apiJob.job_country,
    isRemote: apiJob.job_is_remote ?? false,
    description: apiJob.job_description,
    applyUrl: apiJob.job_apply_link,
    canonicalUrl: canonical,
    employmentType: apiJob.job_employment_type,
    salaryMin: apiJob.job_min_salary,
    salaryMax: apiJob.job_max_salary,
    salaryPeriod: apiJob.job_salary_period,
    benefits: apiJob.job_benefits as unknown as undefined,
    highlights: apiJob.job_highlights as unknown as undefined,
    postedAt: apiJob.job_posted_at_datetime_utc
      ? new Date(apiJob.job_posted_at_datetime_utc)
      : null,
    fingerprint,
  };

  // Strategy 1: Match by source + sourceJobId (preferred)
  if (apiJob.job_id) {
    const existing = await prisma.job.findUnique({
      where: { source_sourceJobId: { source: "jsearch", sourceJobId: apiJob.job_id } },
    });
    if (existing) {
      return { jobId: existing.id, isNew: false };
    }
  }

  // Strategy 2: Match by canonical URL
  if (canonical) {
    const existing = await prisma.job.findFirst({
      where: { canonicalUrl: canonical },
    });
    if (existing) {
      return { jobId: existing.id, isNew: false };
    }
  }

  // Strategy 3: Match by fingerprint
  const existing = await prisma.job.findFirst({
    where: { fingerprint },
  });
  if (existing) {
    return { jobId: existing.id, isNew: false };
  }

  // No match found — create new job
  const job = await prisma.job.create({ data: jobData });
  console.log(`[Upsert] NEW job id=${job.id} — "${apiJob.job_title}" at ${apiJob.employer_name}`);
  return { jobId: job.id, isNew: true };
}
