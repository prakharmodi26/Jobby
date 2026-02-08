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
  rank?: number;
  savedStatus?: string | null;
  savedId?: number | null;
  notes?: string | null;
  appliedAt?: string | null;
  savedCreatedAt?: string | null;
}

export interface Profile {
  id: number;
  // Core targeting
  targetTitles: string[];
  skills: string[];
  preferredLocations: string[];
  remotePreferred: boolean;
  citizenshipNotRequired: boolean;
  workAuthorization: string;
  // Role preferences
  seniority: string;
  yearsOfExperience: number | null;
  roleTypes: string[];
  workModePreference: string;
  // Compensation
  minSalary: number | null;
  maxSalary: number | null;
  // Skills depth
  primarySkills: string[];
  secondarySkills: string[];
  // Education
  education: string;
  degrees: string[];
  // Industry & company
  industries: string[];
  companySizePreference: string;
  companyTypes: string[];
  // Location
  locationRadius: number | null;
  timezonePreference: string;
  // Search/Recommendation settings
  searchNumPages: number;
  recommendedNumPages: number;
  recommendedDatePosted: string;
  excludePublishers: string[];
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
}

export interface PaginatedResponse<T> {
  jobs: T[];
  total: number;
  page: number;
  totalPages: number;
}
