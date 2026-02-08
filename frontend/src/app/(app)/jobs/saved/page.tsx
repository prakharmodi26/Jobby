"use client";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { Job, PaginatedResponse } from "@/lib/types";
import { JobDetailPanel } from "@/components/jobs/JobDetailPanel";
import { StatusBadge } from "@/components/jobs/StatusBadge";
import {
  formatSalary,
  formatRelativeDate,
  STATUS_OPTIONS,
  cn,
} from "@/lib/utils";

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  ...STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
];

export default function SavedPage() {
  const [data, setData] = useState<PaginatedResponse<Job> | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesValue, setNotesValue] = useState("");

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (filter !== "all") params.set("status", filter);

      const res = await apiFetch<PaginatedResponse<Job>>(
        `/api/jobs/saved?${params}`
      );
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleStatusChange = async (savedId: number, status: string) => {
    await apiFetch(`/api/jobs/saved/${savedId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    fetchJobs();
  };

  const handleSaveNotes = async (savedId: number) => {
    await apiFetch(`/api/jobs/saved/${savedId}`, {
      method: "PATCH",
      body: JSON.stringify({ notes: notesValue }),
    });
    setEditingNotes(null);
    fetchJobs();
  };

  const handleApply = async (jobId: number) => {
    await apiFetch(`/api/jobs/${jobId}/save`, {
      method: "POST",
      body: JSON.stringify({ status: "applied" }),
    });
    fetchJobs();
  };

  const handleRemove = async (savedId: number) => {
    if (!confirm("Remove this job from saved?")) return;
    await apiFetch(`/api/jobs/saved/${savedId}`, { method: "DELETE" });
    fetchJobs();
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              setFilter(opt.value);
              setPage(1);
            }}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors",
              filter === opt.value
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {!data || data.jobs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg">No saved jobs</p>
          <p className="text-gray-400 text-sm mt-1">
            Save jobs from Recommended or Search to track them here
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4">
            {data.jobs.map((job) => (
              <div
                key={job.savedId || job.id}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {job.companyLogo ? (
                      <img
                        src={job.companyLogo}
                        alt={job.company}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-lg font-bold text-gray-400">
                        {job.company.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className="cursor-pointer"
                        onClick={() => setSelectedJob(job)}
                      >
                        <h3 className="font-semibold text-gray-900 text-sm hover:text-blue-600 transition-colors">
                          {job.title}
                        </h3>
                        <p className="text-sm text-gray-600">{job.company}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {job.location}
                          </span>
                          {job.isRemote && (
                            <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                              Remote
                            </span>
                          )}
                          {job.salaryMin && (
                            <span className="text-xs font-medium text-emerald-600">
                              {formatSalary(
                                job.salaryMin,
                                job.salaryMax,
                                job.salaryPeriod
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status + actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={job.savedStatus || "saved"}
                          onChange={(e) =>
                            handleStatusChange(job.savedId!, e.target.value)
                          }
                          className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleRemove(job.savedId!)}
                          className="text-gray-400 hover:text-red-500 transition-colors text-lg"
                          title="Remove"
                        >
                          &times;
                        </button>
                      </div>
                    </div>

                    {/* Applied date */}
                    {job.appliedAt && (
                      <p className="text-xs text-gray-400 mt-1">
                        Applied {formatRelativeDate(job.appliedAt)}
                      </p>
                    )}

                    {/* Notes */}
                    <div className="mt-3">
                      {editingNotes === job.savedId ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={notesValue}
                            onChange={(e) => setNotesValue(e.target.value)}
                            className="flex-1 text-xs border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Add notes..."
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveNotes(job.savedId!)}
                            className="text-xs text-blue-600 font-medium"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingNotes(null)}
                            className="text-xs text-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingNotes(job.savedId!);
                            setNotesValue(job.notes || "");
                          }}
                          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {job.notes || "Add notes..."}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom bar */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <StatusBadge status={job.savedStatus || "saved"} />
                  <a
                    href={job.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleApply(job.id)}
                    className="ml-auto text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Apply ↗
                  </a>
                </div>
              </div>
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
                onClick={() =>
                  setPage((p) => Math.min(data.totalPages, p + 1))
                }
                disabled={page === data.totalPages}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {selectedJob && (
        <JobDetailPanel
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onApply={handleApply}
          onStatusChange={(_jobId, savedId, status) => {
            handleStatusChange(savedId, status);
            setSelectedJob(null);
          }}
        />
      )}
    </div>
  );
}
