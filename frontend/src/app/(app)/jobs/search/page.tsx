"use client";
import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import type { Job } from "@/lib/types";
import { JobCard } from "@/components/jobs/JobCard";
import { JobDetailPanel } from "@/components/jobs/JobDetailPanel";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "jobboard_search_state";

const COUNTRY_OPTIONS = [
  { value: "us", label: "United States" },
  { value: "ca", label: "Canada" },
  { value: "gb", label: "United Kingdom" },
  { value: "de", label: "Germany" },
  { value: "in", label: "India" },
  { value: "au", label: "Australia" },
];

const DATE_OPTIONS = [
  { value: "", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "3days", label: "Past 3 days" },
  { value: "week", label: "Past week" },
  { value: "month", label: "Past month" },
];

const EMPLOYMENT_TYPES = [
  { value: "FULLTIME", label: "Full-time" },
  { value: "PARTTIME", label: "Part-time" },
  { value: "CONTRACTOR", label: "Contract" },
  { value: "INTERN", label: "Intern" },
];

const JOB_REQUIREMENTS = [
  { value: "no_experience", label: "No experience" },
  { value: "under_3_years_experience", label: "< 3 years" },
  { value: "more_than_3_years_experience", label: "3+ years" },
  { value: "no_degree", label: "No degree" },
];

interface SearchState {
  query: string;
  country: string;
  datePosted: string;
  remoteOnly: boolean;
  selectedTypes: string[];
  numPages: number;
  jobRequirements: string[];
  radius: string;
  excludePublishers: string;
  jobs: Job[];
  searched: boolean;
}

function loadSearchState(): SearchState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSearchState(state: SearchState) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded — ignore
  }
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("us");
  const [datePosted, setDatePosted] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [numPages, setNumPages] = useState(5);
  const [jobRequirements, setJobRequirements] = useState<string[]>([]);
  const [radius, setRadius] = useState("");
  const [excludePublishers, setExcludePublishers] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Restore from session storage on mount
  useEffect(() => {
    const saved = loadSearchState();
    if (saved) {
      setQuery(saved.query);
      setCountry(saved.country);
      setDatePosted(saved.datePosted);
      setRemoteOnly(saved.remoteOnly);
      setSelectedTypes(saved.selectedTypes);
      setNumPages(saved.numPages || 5);
      setJobRequirements(saved.jobRequirements || []);
      setRadius(saved.radius || "");
      setExcludePublishers(saved.excludePublishers || "");
      setJobs(saved.jobs);
      setSearched(saved.searched);
      if (saved.jobRequirements?.length || saved.radius || saved.excludePublishers) {
        setShowAdvanced(true);
      }
    }
  }, []);

  const handleSearch = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!query.trim()) return;

      setLoading(true);
      setSearched(true);
      try {
        const params = new URLSearchParams({ query: query.trim(), country });
        params.set("num_pages", String(numPages));
        if (datePosted) params.set("date_posted", datePosted);
        if (remoteOnly) params.set("work_from_home", "true");
        if (selectedTypes.length > 0)
          params.set("employment_types", selectedTypes.join(","));
        if (jobRequirements.length > 0)
          params.set("job_requirements", jobRequirements.join(","));
        if (radius) params.set("radius", radius);
        if (excludePublishers.trim())
          params.set("exclude_job_publishers", excludePublishers.trim());

        const res = await apiFetch<{ jobs: Job[]; total: number }>(
          `/api/jobs/search?${params}`
        );
        setJobs(res.jobs);

        // Persist to session storage
        saveSearchState({
          query,
          country,
          datePosted,
          remoteOnly,
          selectedTypes,
          numPages,
          jobRequirements,
          radius,
          excludePublishers,
          jobs: res.jobs,
          searched: true,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [query, country, datePosted, remoteOnly, selectedTypes, numPages, jobRequirements, radius, excludePublishers]
  );

  const handleSave = async (jobId: number) => {
    await apiFetch(`/api/jobs/${jobId}/save`, { method: "POST" });
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId ? { ...j, savedStatus: "saved" } : j
      )
    );
  };

  const handleApply = async (jobId: number) => {
    await apiFetch(`/api/jobs/${jobId}/save`, {
      method: "POST",
      body: JSON.stringify({ status: "applied" }),
    });
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId ? { ...j, savedStatus: "applied" } : j
      )
    );
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleRequirement = (req: string) => {
    setJobRequirements((prev) =>
      prev.includes(req) ? prev.filter((r) => r !== req) : [...prev, req]
    );
  };

  return (
    <div>
      {/* Search form */}
      <form onSubmit={handleSearch} className="space-y-4 mb-6">
        {/* Query input */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Job title, keywords, or company..."
              className="w-full px-4 py-3 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        {/* Primary filters row */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          >
            {COUNTRY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={datePosted}
            onChange={(e) => setDatePosted(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DATE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setRemoteOnly(!remoteOnly)}
            className={cn(
              "text-sm px-3 py-2 rounded-lg border transition-colors",
              remoteOnly
                ? "bg-green-50 text-green-700 border-green-300"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            )}
          >
            Remote only
          </button>

          {EMPLOYMENT_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => toggleType(type.value)}
              className={cn(
                "text-sm px-3 py-2 rounded-lg border transition-colors",
                selectedTypes.includes(type.value)
                  ? "bg-blue-50 text-blue-700 border-blue-300"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              )}
            >
              {type.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm px-3 py-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 transition-colors ml-auto"
          >
            {showAdvanced ? "Less filters" : "More filters"}
          </button>
        </div>

        {/* Advanced filters */}
        {showAdvanced && (
          <div className="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Num pages */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Pages to fetch (1-50)
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={numPages}
                  onChange={(e) => setNumPages(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-0.5">10 jobs per page, 1 credit each</p>
              </div>

              {/* Radius */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Radius (km)
                </label>
                <input
                  type="number"
                  min={0}
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Exclude publishers */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Exclude publishers
                </label>
                <input
                  type="text"
                  value={excludePublishers}
                  onChange={(e) => setExcludePublishers(e.target.value)}
                  placeholder="e.g. BeeBe,Dice"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Experience requirements */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Experience level
              </label>
              <div className="flex flex-wrap gap-2">
                {JOB_REQUIREMENTS.map((req) => (
                  <button
                    key={req.value}
                    type="button"
                    onClick={() => toggleRequirement(req.value)}
                    className={cn(
                      "text-sm px-3 py-1.5 rounded-lg border transition-colors",
                      jobRequirements.includes(req.value)
                        ? "bg-purple-50 text-purple-700 border-purple-300"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    {req.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : searched && jobs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg">No results found</p>
          <p className="text-gray-400 text-sm mt-1">
            Try different keywords or broaden your filters
          </p>
        </div>
      ) : jobs.length > 0 ? (
        <>
          <p className="text-sm text-gray-500 mb-4">
            {jobs.length} result{jobs.length !== 1 ? "s" : ""}
          </p>
          <div className="grid gap-4">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onSave={handleSave}
                onApply={handleApply}
                onClick={setSelectedJob}
                showScore
              />
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg">Search for jobs</p>
          <p className="text-gray-400 text-sm mt-1">
            Enter keywords above to search across thousands of job listings
          </p>
        </div>
      )}

      {selectedJob && (
        <JobDetailPanel
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onSave={handleSave}
          onApply={handleApply}
        />
      )}
    </div>
  );
}
