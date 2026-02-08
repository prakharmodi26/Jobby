"use client";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { Job, PaginatedResponse } from "@/lib/types";
import { JobCard } from "@/components/jobs/JobCard";
import { JobDetailPanel } from "@/components/jobs/JobDetailPanel";

export default function RecommendedPage() {
  const [data, setData] = useState<PaginatedResponse<Job> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<PaginatedResponse<Job>>(
        `/api/jobs/recommended?page=${page}&limit=20`
      );
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

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

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!data || data.jobs.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 text-lg">No recommended jobs yet</p>
        <p className="text-gray-400 text-sm mt-1">
          Set up your profile and run a recommended pull to get started
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {data.total} recommended job{data.total !== 1 ? "s" : ""}
        </p>
      </div>

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
    </div>
  );
}
