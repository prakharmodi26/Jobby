"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import type { Job, PaginatedResponse } from "@/lib/types";
import { JobCard } from "@/components/jobs/JobCard";
import { JobDetailPanel } from "@/components/jobs/JobDetailPanel";
import { cn } from "@/lib/utils";

interface RunStatus {
  status: "none" | "running" | "completed" | "failed" | "cancelled";
  runId?: number;
  runAt?: string;
  totalFetched?: number;
  newJobs?: number;
  duplicates?: number;
  errorMessage?: string;
}

type SortOption = "score" | "postedAt" | "discoveredAt";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "score", label: "Score" },
  { value: "postedAt", label: "Date Posted" },
  { value: "discoveredAt", label: "Latest Pull" },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "Full-time", label: "Full-time" },
  { value: "Part-time", label: "Part-time" },
  { value: "Contractor", label: "Contract" },
  { value: "Internship", label: "Intern" },
];

export default function RecommendedPage() {
  const [data, setData] = useState<PaginatedResponse<Job> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pullError, setPullError] = useState<string | null>(null);
  const [quotaWarning, setQuotaWarning] = useState<string | null>(null);
  const [currentRunId, setCurrentRunId] = useState<number | null>(null);
  const wasPullingRef = useRef(false);

  // Filters & sorting
  const [search, setSearch] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOption>("score");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const fetchJobs = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        sort,
        order,
      });
      if (search.trim()) params.set("search", search.trim());
      if (remoteOnly) params.set("remote", "true");
      if (employmentTypeFilter.length > 0)
        params.set("employmentType", employmentTypeFilter.join(","));

      const res = await apiFetch<PaginatedResponse<Job>>(
        `/api/jobs/recommended?${params}`
      );
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [page, sort, order, search, remoteOnly, employmentTypeFilter]);

  const checkRunStatus = useCallback(async () => {
    try {
      const status = await apiFetch<RunStatus>("/api/admin/recommended-status");
      const isRunning = status.status === "running";
      setPulling(isRunning);
      if (status.runId) {
        setCurrentRunId(status.runId);
      }
      if (status.status === "failed" && status.errorMessage) {
        const msg = status.errorMessage.toLowerCase();
        if (msg.includes("429") || msg.includes("quota")) {
          setQuotaWarning("API usage limit is finished. Change the API key or wait, then pull again.");
        } else {
          setQuotaWarning(null);
        }
      } else if (status.status === "completed") {
        setQuotaWarning(null);
      }

      if (wasPullingRef.current && !isRunning) {
        fetchJobs();
      }
      wasPullingRef.current = isRunning;
    } catch (err) {
      console.error(err);
    }
  }, [fetchJobs]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    checkRunStatus();
  }, [checkRunStatus]);

  useEffect(() => {
    if (!pulling) return;
    const interval = setInterval(checkRunStatus, 3000);
    return () => clearInterval(interval);
  }, [pulling, checkRunStatus]);

  // While a pull is running, refresh jobs list periodically to surface streaming results
  useEffect(() => {
    if (!pulling) return;
    const interval = setInterval(() => fetchJobs({ silent: true }), 3000);
    return () => clearInterval(interval);
  }, [pulling, fetchJobs]);

  const handlePullRecommended = async () => {
    setPullError(null);
    setQuotaWarning(null);
    try {
      const res = await apiFetch<{ started?: boolean; error?: string; runId?: number }>(
        "/api/admin/run-recommended",
        { method: "POST" }
      );
      if (res.started) {
        setPulling(true);
        wasPullingRef.current = true;
        if (res.runId) setCurrentRunId(res.runId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("409") || msg.toLowerCase().includes("already running")) {
        setPulling(true);
        wasPullingRef.current = true;
      } else {
        setPullError(msg);
      }
    }
  };

  const handleCancelPull = async () => {
    if (!currentRunId) return;
    try {
      await apiFetch("/api/admin/cancel-recommended", {
        method: "POST",
        body: JSON.stringify({ runId: currentRunId }),
      });
      setQuotaWarning(null);
      setPulling(false);
      wasPullingRef.current = false;
    } catch (err) {
      console.error("Failed to cancel pull", err);
    }
  };

  const handleSave = async (jobId: number) => {
    await apiFetch(`/api/jobs/${jobId}/save`, { method: "POST" });
    fetchJobs();
  };

  const handleApply = async (jobId: number) => {
    await apiFetch(`/api/jobs/${jobId}/save`, {
      method: "POST",
      body: JSON.stringify({ status: "applied" }),
    });
    fetchJobs();
  };

  const handleIgnore = async (jobId: number) => {
    await apiFetch(`/api/jobs/${jobId}/ignore`, { method: "POST" });
    fetchJobs();
  };

  const pullButton = pulling ? (
    <button
      onClick={handleCancelPull}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-red-100 text-red-700 hover:bg-red-200"
    >
      <div className="h-4 w-4 rounded-full border-2 border-red-600 border-t-transparent animate-spin" />
      Cancel Pull
    </button>
  ) : (
    <button
      onClick={handlePullRecommended}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-emerald-600 text-white hover:bg-emerald-700"
    >
      Pull Recommended
    </button>
  );

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!data || data.jobs.length === 0) {
    // Show filters + empty state so user can clear filters or pull
    const hasFilters = search || remoteOnly || employmentTypeFilter.length > 0;
    return (
      <div>
        {pulling && (
          <div className="mb-4 flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <div className="h-3 w-3 rounded-full border-2 border-blue-700 border-t-transparent animate-spin" />
            <span>Pull in progress — new recommendations will appear live.</span>
          </div>
        )}
        {quotaWarning && (
          <div className="mb-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <span className="text-lg leading-none">⚠</span>
            <div>
              <p className="font-medium">API usage limit is finished.</p>
              <p className="text-red-600">Change the API key or wait and try again.</p>
            </div>
          </div>
        )}
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Filter by title or company..."
            className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => { setRemoteOnly(!remoteOnly); setPage(1); }}
            className={cn(
              "text-sm px-3 py-2 rounded-lg border transition-colors",
              remoteOnly
                ? "bg-green-50 text-green-700 border-green-300"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            )}
          >
            Remote only
          </button>
          {EMPLOYMENT_TYPE_OPTIONS.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => {
                setEmploymentTypeFilter((prev) =>
                  prev.includes(type.value)
                    ? prev.filter((v) => v !== type.value)
                    : [...prev, type.value]
                );
                setPage(1);
              }}
              className={cn(
                "text-sm px-3 py-2 rounded-lg border transition-colors",
                employmentTypeFilter.includes(type.value)
                  ? "bg-blue-50 text-blue-700 border-blue-300"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              )}
            >
              {type.label}
            </button>
          ))}
          {pullButton}
        </div>

        <div className="text-center py-16">
          {pulling ? (
            <>
              <div className="flex items-center justify-center gap-2 text-gray-600 mb-2">
                <div className="h-5 w-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                <span className="text-lg">Fetching recommendations…</span>
              </div>
              <p className="text-gray-400 text-sm">
                New jobs will stream in as each query returns.
              </p>
            </>
          ) : (
            <>
              <p className="text-gray-500 text-lg">
                {hasFilters ? "No jobs match your filters" : "No recommended jobs yet"}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {hasFilters
                  ? "Try adjusting your filters"
                  : "Set up your profile and pull recommended jobs to get started"}
              </p>
            </>
          )}
          {pullError && (
            <p className="text-red-500 text-sm mt-2">{pullError}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Filter by title or company..."
          className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => { setRemoteOnly(!remoteOnly); setPage(1); }}
          className={cn(
            "text-sm px-3 py-2 rounded-lg border transition-colors",
            remoteOnly
              ? "bg-green-50 text-green-700 border-green-300"
              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          )}
        >
          Remote only
        </button>
        {EMPLOYMENT_TYPE_OPTIONS.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => {
              setEmploymentTypeFilter((prev) =>
                prev.includes(type.value)
                  ? prev.filter((v) => v !== type.value)
                  : [...prev, type.value]
              );
              setPage(1);
            }}
            className={cn(
              "text-sm px-3 py-2 rounded-lg border transition-colors",
              employmentTypeFilter.includes(type.value)
                ? "bg-blue-50 text-blue-700 border-blue-300"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            )}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Sort bar + pull button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {data.total} job{data.total !== 1 ? "s" : ""}
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-xs text-gray-400">Sort:</span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                if (sort === opt.value) {
                  setOrder((o) => (o === "desc" ? "asc" : "desc"));
                } else {
                  setSort(opt.value);
                  setOrder(opt.value === "discoveredAt" ? "desc" : "desc");
                }
                setPage(1);
              }}
              className={cn(
                "text-xs px-2.5 py-1 rounded-md border transition-colors",
                sort === opt.value
                  ? "bg-blue-50 text-blue-700 border-blue-300"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              )}
            >
              {opt.label}
              {sort === opt.value && (
                <span className="ml-1">{order === "desc" ? "\u2193" : "\u2191"}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {pullError && (
            <p className="text-red-500 text-sm">{pullError}</p>
          )}
          {pullButton}
        </div>
      </div>

          {pulling && (
            <div className="mb-3 flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <div className="h-3 w-3 rounded-full border-2 border-blue-700 border-t-transparent animate-spin" />
              <span>Live updating — new results appear as queries finish.</span>
            </div>
          )}
      {quotaWarning && (
        <div className="mb-3 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <span className="text-lg leading-none">⚠</span>
          <div>
            <p className="font-medium">API usage limit is finished.</p>
            <p className="text-red-600">Change the API key or wait and try again.</p>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {data.jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            showScore
            onSave={handleSave}
            onApply={handleApply}
            onIgnore={handleIgnore}
            onClick={setSelectedJob}
          />
        ))}
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {data.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Next
          </button>
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

      {pulling && (
        <div className="flex items-center justify-center gap-2 text-sm text-blue-600 mt-4">
          <div className="h-4 w-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <span>Continuing to fetch and score new recommendations…</span>
        </div>
      )}
    </div>
  );
}
