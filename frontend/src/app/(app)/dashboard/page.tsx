"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { DashboardStats, Job } from "@/lib/types";
import { StatusPieChart } from "@/components/charts/StatusPieChart";
import { DiscoveredBarChart } from "@/components/charts/DiscoveredBarChart";
import { formatRelativeDate } from "@/lib/utils";

function StatsCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: string;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${accent || "bg-gray-100"}`}
        >
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<DashboardStats>("/api/dashboard/stats"),
      apiFetch<Job[]>("/api/dashboard/recent"),
    ])
      .then(([s, r]) => {
        setStats(s);
        setRecentJobs(r);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Overview of your job search pipeline
        </p>
      </div>

      {/* Quota alert */}
      {stats.quotaExceeded && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-start gap-3">
          <span className="text-red-500 text-lg leading-none mt-0.5">⚠</span>
          <div>
            <p className="text-sm font-medium text-red-800">
              JSearch API quota exceeded
            </p>
            <p className="text-sm text-red-600 mt-0.5">
              Your monthly API request limit has been reached. New job pulls will
              fail until the quota resets. Previous recommendations are still
              visible.
            </p>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Total Jobs"
          value={stats.totalJobs}
          icon="📋"
          accent="bg-blue-50"
        />
        <StatsCard
          label="Discovered (24h)"
          value={stats.jobsLast24h}
          icon="🆕"
          accent="bg-green-50"
        />
        <StatsCard
          label="Saved"
          value={stats.totalSaved}
          icon="📌"
          accent="bg-amber-50"
        />
        <StatsCard
          label="Applied"
          value={stats.appliedCount}
          icon="🚀"
          accent="bg-purple-50"
        />
      </div>

      {/* Last run info */}
      {stats.lastRunAt && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 flex items-center justify-between">
          <div className="text-sm">
            <span className="text-blue-700 font-medium">Last pull: </span>
            <span className="text-blue-600">
              {formatRelativeDate(stats.lastRunAt)}
            </span>
            <span className="text-blue-500 ml-2">
              ({stats.lastRunNewJobs} new jobs)
            </span>
          </div>
          <div className="text-sm text-blue-500">
            {stats.recommendedCount} recommended
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">
            Application Status
          </h2>
          <StatusPieChart data={stats.statusBreakdown} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">
            Jobs Discovered (14 days)
          </h2>
          <DiscoveredBarChart data={stats.dailyDiscoveries} />
        </div>
      </div>

      {/* Recent recommended */}
      {recentJobs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">
            Top Recommended Jobs
          </h2>
          <div className="divide-y divide-gray-100">
            {recentJobs.map((job) => (
              <div
                key={job.id}
                className="py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {job.companyLogo ? (
                      <img
                        src={job.companyLogo}
                        alt={job.company}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-sm font-bold text-gray-400">
                        {job.company.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {job.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {job.company} &middot; {job.location}
                    </p>
                  </div>
                </div>
                {job.score !== undefined && (
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                    {job.score}pts
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
