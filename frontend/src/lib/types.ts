export interface Job {
  id: number;
  source: string;
  sourceJobId: string | null;
  title: string;
  company: string;
  companyLogo: string | null;
  location: string;
  city: string | null;
  state: string | null;
  country: string | null;
  isRemote: boolean;
  description: string;
  applyUrl: string;
  canonicalUrl: string | null;
  employmentType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: string | null;
  benefits: string[] | null;
  highlights: {
    Qualifications?: string[];
    Benefits?: string[];
    Responsibilities?: string[];
  } | null;
  postedAt: string | null;
  discoveredAt: string;
  fingerprint: string | null;
  ignored: boolean;
  // Joined fields
  score?: number;
  savedStatus?: string | null;
  savedId?: number | null;
  notes?: string | null;
  appliedAt?: string | null;
  savedCreatedAt?: string | null;
}

export interface Profile {
  id: number;
  userMd: string;
  updatedAt: string;
}

export interface Settings {
  id: number;
  cronSchedule: string;
  cronEnabled: boolean;
  searchNumPages: number;
  recommendedNumPages: number;
  recommendedExpiryDays: number;
  coverLetterModel: string;
  minRecommendedScore: number;
  updatedAt: string;
}

export interface RecommendedQuery {
  id: number;
  query: string;
  page: number;
  numPages: number;
  country: string;
  language: string | null;
  datePosted: string;
  workFromHome: boolean;
  employmentTypes: string | null;
  jobRequirements: string | null;
  radius: number | null;
  excludeJobPublishers: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScoringPattern {
  id: number;
  pattern: string;
  weight: number;
  effect: string;
  countOnce: boolean;
  disqualify: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalJobs: number;
  jobsLast24h: number;
  recommendedCount: number;
  totalSaved: number;
  appliedCount: number;
  statusBreakdown: { status: string; count: number }[];
  lastRunAt: string | null;
  lastRunNewJobs: number;
  dailyDiscoveries: { date: string; count: number }[];
  recentRuns: {
    runAt: string;
    newJobs: number;
    totalFetched: number;
    duplicates: number;
  }[];
  quotaExceeded?: boolean;
}

export interface PaginatedResponse<T> {
  jobs: T[];
  total: number;
  page: number;
  totalPages: number;
}
