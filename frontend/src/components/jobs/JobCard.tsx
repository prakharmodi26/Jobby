"use client";
import type { Job } from "@/lib/types";
import { formatSalary, formatRelativeDate } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";

interface JobCardProps {
  job: Job;
  onSave?: (jobId: number) => void;
  onIgnore?: (jobId: number) => void;
  onApply?: (jobId: number) => void;
  onClick?: (job: Job) => void;
  showScore?: boolean;
}

export function JobCard({
  job,
  onSave,
  onIgnore,
  onApply,
  onClick,
  showScore,
}: JobCardProps) {
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryPeriod);

  return (
    <div
      onClick={() => onClick?.(job)}
      className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group"
    >
      <div className="flex items-start gap-4">
        {/* Company logo */}
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

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-blue-600 transition-colors">
                {job.title}
              </h3>
              <p className="text-sm text-gray-600 mt-0.5">{job.company}</p>
            </div>
            {showScore && job.score !== undefined && (
              <span className="shrink-0 bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-1 rounded-md">
                {job.score}pts
              </span>
            )}
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-xs text-gray-500">{job.location}</span>
            {job.isRemote && (
              <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                Remote
              </span>
            )}
            {job.employmentType && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {job.employmentType}
              </span>
            )}
            {salary && (
              <span className="text-xs font-medium text-emerald-600">
                {salary}
              </span>
            )}
            {job.postedAt && (
              <span className="text-xs text-gray-400">
                {formatRelativeDate(job.postedAt)}
              </span>
            )}
            {job.savedStatus && <StatusBadge status={job.savedStatus} />}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
        {!job.savedStatus && onSave && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSave(job.id);
            }}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            Save
          </button>
        )}
        {onIgnore && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onIgnore(job.id);
            }}
            className="text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            Ignore
          </button>
        )}
        <a
          href={job.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.stopPropagation();
            onApply?.(job.id);
          }}
          className="ml-auto text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          Apply ↗
        </a>
      </div>
    </div>
  );
}
