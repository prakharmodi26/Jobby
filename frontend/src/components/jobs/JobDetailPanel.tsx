"use client";
import type { Job } from "@/lib/types";
import { formatSalary, formatRelativeDate, STATUS_OPTIONS } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";

interface JobDetailPanelProps {
  job: Job;
  onClose: () => void;
  onSave?: (jobId: number) => void;
  onApply?: (jobId: number) => void;
  onStatusChange?: (jobId: number, savedId: number, status: string) => void;
}

export function JobDetailPanel({
  job,
  onClose,
  onSave,
  onApply,
  onStatusChange,
}: JobDetailPanelProps) {
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryPeriod);
  const highlights = job.highlights as {
    Qualifications?: string[];
    Benefits?: string[];
    Responsibilities?: string[];
  } | null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                {job.companyLogo ? (
                  <img
                    src={job.companyLogo}
                    alt={job.company}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-xl font-bold text-gray-400">
                    {job.company.charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {job.title}
                </h2>
                <p className="text-sm text-gray-600">{job.company}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">{job.location}</span>
                  {job.isRemote && (
                    <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      Remote
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              &times;
            </button>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-3 mt-4">
            {job.savedStatus ? (
              <div className="flex items-center gap-2">
                <StatusBadge status={job.savedStatus} />
                {onStatusChange && job.savedId && (
                  <select
                    value={job.savedStatus}
                    onChange={(e) =>
                      onStatusChange(job.id, job.savedId!, e.target.value)
                    }
                    className="text-xs border border-gray-300 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              onSave && (
                <button
                  onClick={() => onSave(job.id)}
                  className="text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors"
                >
                  Save Job
                </button>
              )
            )}
            <a
              href={job.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onApply?.(job.id)}
              className="text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg transition-colors"
            >
              Apply ↗
            </a>
            {salary && (
              <span className="ml-auto text-sm font-semibold text-emerald-600">
                {salary}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Info row */}
          <div className="flex flex-wrap gap-3 text-sm text-gray-600">
            {job.employmentType && (
              <span className="bg-gray-100 px-3 py-1 rounded-full">
                {job.employmentType}
              </span>
            )}
            {job.postedAt && (
              <span className="bg-gray-100 px-3 py-1 rounded-full">
                Posted {formatRelativeDate(job.postedAt)}
              </span>
            )}
          </div>

          {/* Description */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
            <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed max-h-96 overflow-auto">
              {job.description}
            </div>
          </div>

          {/* Highlights */}
          {highlights?.Qualifications && highlights.Qualifications.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Qualifications
              </h3>
              <ul className="text-sm text-gray-700 space-y-1.5 list-disc list-inside">
                {highlights.Qualifications.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {highlights?.Responsibilities &&
            highlights.Responsibilities.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Responsibilities
                </h3>
                <ul className="text-sm text-gray-700 space-y-1.5 list-disc list-inside">
                  {highlights.Responsibilities.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

          {highlights?.Benefits && highlights.Benefits.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Benefits</h3>
              <ul className="text-sm text-gray-700 space-y-1.5 list-disc list-inside">
                {highlights.Benefits.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
