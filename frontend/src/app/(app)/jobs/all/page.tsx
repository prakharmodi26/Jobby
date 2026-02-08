"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { Job } from "@/lib/types";
import { JobDetailPanel } from "@/components/jobs/JobDetailPanel";
import { formatSalary, formatRelativeDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

type SortCol = "discoveredAt" | "title" | "company" | "salaryMin" | "postedAt" | "score" | "employmentType";
type SortOrder = "asc" | "desc";

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "FULLTIME", label: "Full-time" },
  { value: "PARTTIME", label: "Part-time" },
  { value: "CONTRACTOR", label: "Contract" },
  { value: "INTERN", label: "Intern" },
];

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 50
      ? "bg-emerald-50 text-emerald-700"
      : score >= 20
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-600";
  return (
    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", color)}>
      {score}
    </span>
  );
}

export default function AllJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState("");
  const [sort, setSort] = useState<SortCol>("discoveredAt");
  const [order, setOrder] = useState<SortOrder>("desc");

  const limit = 50;

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort,
        order,
      });
      if (search.trim()) params.set("search", search.trim());
      if (remoteOnly) params.set("remote", "true");
      if (employmentTypeFilter) params.set("employmentType", employmentTypeFilter);

      const res = await apiFetch<{
        jobs: Job[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/api/jobs/all?${params}`);

      setJobs(res.jobs);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, sort, order, search, remoteOnly, employmentTypeFilter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleSort = (col: SortCol) => {
    if (sort === col) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSort(col);
      setOrder("desc");
    }
    setPage(1);
  };

  const handleSave = async (jobId: number) => {
    await apiFetch(`/api/jobs/${jobId}/save`, { method: "POST" });
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, savedStatus: "saved" } : j))
    );
  };

  const handleApply = async (jobId: number) => {
    await apiFetch(`/api/jobs/${jobId}/save`, {
      method: "POST",
      body: JSON.stringify({ status: "applied" }),
    });
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, savedStatus: "applied" } : j))
    );
  };

  const handleIgnore = async (jobId: number) => {
    await apiFetch(`/api/jobs/${jobId}/ignore`, { method: "POST" });
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    setTotal((t) => t - 1);
  };

  const SortHeader = ({ col, label }: { col: SortCol; label: string }) => (
    <th
      className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
      onClick={() => handleSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sort === col && (
          <span className="text-blue-600">{order === "asc" ? "\u2191" : "\u2193"}</span>
        )}
      </span>
    </th>
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Filter by title or company..."
          className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => {
            setRemoteOnly(!remoteOnly);
            setPage(1);
          }}
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
              setEmploymentTypeFilter((prev) => prev === type.value ? "" : type.value);
              setPage(1);
            }}
            className={cn(
              "text-sm px-3 py-2 rounded-lg border transition-colors",
              employmentTypeFilter === type.value
                ? "bg-blue-50 text-blue-700 border-blue-300"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            )}
          >
            {type.label}
          </button>
        ))}
        <span className="text-sm text-gray-400 ml-auto">
          {total} job{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortHeader col="title" label="Title" />
              <SortHeader col="company" label="Company" />
              <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
              <SortHeader col="employmentType" label="Type" />
              <SortHeader col="salaryMin" label="Salary" />
              <SortHeader col="score" label="Score" />
              <SortHeader col="postedAt" label="Posted" />
              <SortHeader col="discoveredAt" label="Discovered" />
              <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-3 py-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                </td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-12 text-center text-gray-400 text-sm">
                  No jobs found
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2.5 text-sm font-medium text-gray-900 max-w-[250px] truncate">
                    {job.title}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-600 max-w-[150px] truncate">
                    {job.company}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-500 max-w-[150px] truncate">
                    <span className="inline-flex items-center gap-1">
                      {job.location}
                      {job.isRemote && (
                        <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                          R
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">
                    {job.employmentType || "\u2014"}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">
                    {formatSalary(job.salaryMin, job.salaryMax, job.salaryPeriod) || "\u2014"}
                  </td>
                  <td className="px-3 py-2.5">
                    <ScoreBadge score={job.score ?? 0} />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                    {job.postedAt ? formatRelativeDate(job.postedAt) : "\u2014"}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                    {formatRelativeDate(job.discoveredAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    {job.savedStatus ? (
                      <span className="text-[10px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full uppercase">
                        {job.savedStatus}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">&mdash;</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      {!job.savedStatus && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSave(job.id);
                          }}
                          className="text-[11px] font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
                        >
                          Save
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleIgnore(job.id);
                        }}
                        className="text-[11px] font-medium text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                      >
                        Ignore
                      </button>
                      <a
                        href={job.applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApply(job.id);
                        }}
                        className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition-colors"
                      >
                        Apply
                      </a>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
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
