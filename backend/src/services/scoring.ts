import type { Job, Profile, Settings } from "@prisma/client";

const CITIZENSHIP_PATTERNS = [
  /\bus\s*citizen/i,
  /\bunited\s*states\s*citizen/i,
  /\bgreen\s*card/i,
  /\bsecurity\s*clearance/i,
  /\bclearance\s*required/i,
  /\bmust\s*be\s*(legally\s*)?authorized\s*to\s*work/i,
  /\bwithout\s*sponsorship/i,
  /\bno\s*visa\s*sponsor/i,
  /\bpermanent\s*resident/i,
  /\bUS\s*Person/i,
];

const OPT_CPT_PATTERNS = [
  /\bopt\b/i,
  /\bcpt\b/i,
  /\bf[\-\s]?1\b/i,
  /\bopen\s*to\s*(?:opt|cpt)/i,
  /\binternational\s*students?\s*(?:welcome|accepted|eligible)/i,
  /\bvisa\s*sponsor/i,
];

const SENIORITY_KEYWORDS: Record<string, RegExp[]> = {
  junior: [/\bjunior\b/i, /\bjr\.?\b/i, /\bentry[\s-]level\b/i, /\bassociate\b/i],
  mid: [/\bmid[\s-]level\b/i, /\bmid[\s-]senior\b/i],
  senior: [/\bsenior\b/i, /\bsr\.?\b/i, /\blead\b/i, /\bstaff\b/i, /\bprincipal\b/i],
  lead: [/\blead\b/i, /\bstaff\b/i, /\bprincipal\b/i, /\barchitect\b/i],
  staff: [/\bstaff\b/i, /\bprincipal\b/i, /\bdistinguished\b/i],
};

const STARTUP_PATTERNS = [/\bstartup\b/i, /\bearly[\s-]stage\b/i, /\bseries\s*[a-c]\b/i, /\bsmall\s*team\b/i];
const ENTERPRISE_PATTERNS = [/\bfortune\s*500\b/i, /\benterprise\b/i, /\blarge[\s-]scale\b/i, /\bglobal\s*company\b/i];

const EDUCATION_LEVELS: Record<string, number> = {
  none: 0,
  associate: 1,
  bachelors: 2,
  masters: 3,
  phd: 4,
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countKeywordMatches(text: string, keyword: string, cap = 3): number {
  const regex = new RegExp(escapeRegex(keyword.toLowerCase()), "gi");
  const matches = text.match(regex);
  return Math.min(matches?.length ?? 0, cap);
}

function countAnyKeywordMatches(
  text: string,
  keywords: string[],
  capPerKeyword = 3,
  totalCap = 10
): number {
  let total = 0;
  for (const kw of keywords) {
    if (!kw.trim()) continue;
    total += countKeywordMatches(text, kw, capPerKeyword);
    if (total >= totalCap) return totalCap;
  }
  return total;
}

function extractYearsRequired(text: string): number | null {
  // Match patterns like "5+ years", "3-5 years", "minimum 5 years"
  const patterns = [
    /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/gi,
    /(?:minimum|at\s*least|requires?)\s*(\d+)\s*(?:years?|yrs?)/gi,
  ];
  let maxYears = 0;
  let found = false;
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      found = true;
      maxYears = Math.max(maxYears, parseInt(match[1]));
    }
  }
  return found ? maxYears : null;
}

export function scoreJob(job: Job, profile: Profile, weights: Settings): number {
  let score = 0;
  const searchText = `${job.title} ${job.description}`.toLowerCase();
  const fullText = `${job.title} ${job.description}`;

  // Include highlights/qualifications text for penalties (best-effort; highlights is Json)
  const highlights = job.highlights as any;
  const qualificationsText = Array.isArray(highlights?.Qualifications)
    ? highlights.Qualifications.join(" \n ")
    : typeof highlights?.Qualifications === "string"
      ? highlights.Qualifications
      : "";
  const combinedAvoidText = `${searchText} ${qualificationsText.toLowerCase()}`;

  // --- Skill matching (flat, no primary/secondary distinction) ---
  for (const kw of profile.skills) {
    score += countKeywordMatches(searchText, kw) * weights.weightSkillMatch;
  }
  for (const kw of profile.targetTitles) {
    score += countKeywordMatches(searchText, kw) * weights.weightTargetTitle;
  }

  // --- Recency boost ---
  if (job.postedAt) {
    const ageMs = Date.now() - new Date(job.postedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays <= 1) score += weights.weightRecencyDay1;
    else if (ageDays <= 3) score += weights.weightRecencyDay3;
    else if (ageDays <= 7) score += weights.weightRecencyWeek;
  }

  // --- Remote / work mode matching ---
  if (profile.remotePreferred && job.isRemote) {
    score += weights.weightRemoteMatch;
  } else if (profile.workModePreference === "remote" && job.isRemote) {
    score += weights.weightWorkModeMatch;
  } else if (profile.workModePreference === "onsite" && !job.isRemote) {
    score += weights.weightOnsiteMatch;
  }

  // --- Seniority match ---
  if (profile.seniority && SENIORITY_KEYWORDS[profile.seniority]) {
    const patterns = SENIORITY_KEYWORDS[profile.seniority];
    const matches = patterns.some((p) => p.test(fullText));
    if (matches) {
      score += weights.weightSeniorityMatch;
    } else {
      // Check for mismatch: e.g. junior profile but job needs 10+ years
      const yearsRequired = extractYearsRequired(fullText);
      if (yearsRequired !== null && profile.yearsOfExperience !== null) {
        if (yearsRequired > (profile.yearsOfExperience ?? 0) + 2) {
          score += weights.weightSeniorityMismatch;
        }
      }
    }
  }

  // --- Salary match ---
  if (profile.minSalary || profile.maxSalary) {
    const jobMin = job.salaryMin;
    const jobMax = job.salaryMax;
    if (jobMin !== null || jobMax !== null) {
      const jMin = jobMin ?? jobMax ?? 0;
      const jMax = jobMax ?? jobMin ?? 0;
      const pMin = profile.minSalary ?? 0;
      const pMax = profile.maxSalary ?? Infinity;

      // Overlap check
      if (jMax >= pMin && jMin <= pMax) {
        score += weights.weightSalaryOverlap;
      } else if (jMax < pMin) {
        score += weights.weightSalaryBelow;
      }
    }
  }

  // --- Industry/domain match (max 2 matched) ---
  if (profile.industries.length > 0) {
    let industryMatches = 0;
    for (const ind of profile.industries) {
      if (industryMatches >= 2) break;
      if (countKeywordMatches(searchText, ind, 1) > 0) {
        industryMatches++;
      }
    }
    score += industryMatches * weights.weightIndustryMatch;
  }

  // --- Education match ---
  if (profile.education && EDUCATION_LEVELS[profile.education] !== undefined) {
    const profileLevel = EDUCATION_LEVELS[profile.education];
    // Check if job mentions degree requirements
    const phdMatch = /\bph\.?d\.?\b/i.test(fullText) || /\bdoctorate\b/i.test(fullText);
    const mastersMatch = /\bmaster'?s?\s*(degree)?\b/i.test(fullText) || /\bm\.?s\.?\s/i.test(fullText);
    const bachelorsMatch = /\bbachelor'?s?\s*(degree)?\b/i.test(fullText) || /\bb\.?s\.?\s/i.test(fullText);

    let jobLevel = -1; // unknown
    if (phdMatch) jobLevel = 4;
    else if (mastersMatch) jobLevel = 3;
    else if (bachelorsMatch) jobLevel = 2;

    if (jobLevel >= 0) {
      if (profileLevel >= jobLevel) {
        score += weights.weightEducationMeet;
      } else {
        score += weights.weightEducationUnder;
      }
    }
  }

  // --- Company size/type match ---
  if (profile.companySizePreference) {
    if (profile.companySizePreference === "startup" && STARTUP_PATTERNS.some((p) => p.test(fullText))) {
      score += weights.weightCompanySize;
    } else if (profile.companySizePreference === "enterprise" && ENTERPRISE_PATTERNS.some((p) => p.test(fullText))) {
      score += weights.weightCompanySize;
    }
  }

  // --- Experience years match ---
  if (profile.yearsOfExperience !== null && profile.yearsOfExperience !== undefined) {
    const yearsRequired = extractYearsRequired(fullText);
    if (yearsRequired !== null) {
      const diff = yearsRequired - profile.yearsOfExperience;
      if (diff <= 0) {
        score += weights.weightExpMeet; // we meet or exceed
      } else if (diff <= 2) {
        score += weights.weightExpClose; // slightly under, still reasonable
      } else {
        score += weights.weightExpUnder; // significantly under-qualified
      }
    }
  }

  // --- Citizenship penalty ---
  if (profile.citizenshipNotRequired) {
    if (CITIZENSHIP_PATTERNS.some((p) => p.test(fullText))) {
      score += weights.weightCitizenship;
    }
  }

  // --- OPT/CPT/F1 boost ---
  if (profile.citizenshipNotRequired) {
    if (OPT_CPT_PATTERNS.some((p) => p.test(fullText))) {
      score += weights.weightOptCptBoost;
    }
  }

  // --- Avoid keywords penalty ---
  if (profile.avoidKeywords.length > 0 && weights.weightAvoidKeyword !== 0) {
    const matches = countAnyKeywordMatches(combinedAvoidText, profile.avoidKeywords);
    if (matches > 0) {
      score += matches * weights.weightAvoidKeyword;
    }
  }

  return Math.max(score, 0);
}
