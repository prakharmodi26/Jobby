import type { Job, ScoringPattern } from "@prisma/client";

export function scoreJob(
  job: Job,
  patterns: ScoringPattern[]
): { score: number; disqualified: boolean } {
  let score = 0;
  let disqualified = false;
  const text = `${job.title} ${job.description}`;

  for (const p of patterns) {
    if (!p.enabled) continue;

    let regex: RegExp;
    try {
      regex = new RegExp(p.pattern, "gi");
    } catch {
      // Skip invalid regex patterns
      continue;
    }

    const matches = text.match(regex);
    if (!matches || matches.length === 0) continue;

    if (p.disqualify) {
      disqualified = true;
      continue;
    }

    const count = p.countOnce ? 1 : matches.length;

    if (p.effect === "+") {
      score += p.weight * count;
    } else {
      score -= p.weight * count;
    }
  }

  return { score: Math.max(score, 0), disqualified };
}
