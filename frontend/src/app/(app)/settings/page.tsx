"use client";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { Settings, RecommendedQuery, ScoringPattern } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Section                                                           */
/* ------------------------------------------------------------------ */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-gray-200 pt-6 mt-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const CRON_PRESETS = [
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every 12 hours (default)", value: "0 */12 * * *" },
  { label: "Every 24 hours", value: "0 0 * * *" },
  { label: "Custom", value: "__custom__" },
];

const COVER_LETTER_MODELS = [
  {
    value: "vt-arc",
    label: "VT ARC — GPT-OSS-120B",
    description: "Requires VT network/VPN and VT_ARC_KEY",
  },
  {
    value: "gemini",
    label: "Google Gemma 3 — Gemma 3 12B",
    description: "Requires GOOGLE_API_KEY",
  },
  {
    value: "gemma3-12b",
    label: "Gemma 3 12B Instruct",
    description: "Requires GOOGLE_API_KEY (same API, explicit model choice)",
  },
];

const DATE_POSTED_OPTIONS = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "3days", label: "3 Days" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

/* ------------------------------------------------------------------ */
/*  Empty form defaults                                               */
/* ------------------------------------------------------------------ */
const EMPTY_QUERY_FORM: Omit<RecommendedQuery, "id" | "createdAt" | "updatedAt" | "enabled"> = {
  query: "",
  page: 1,
  numPages: 1,
  country: "us",
  language: null,
  datePosted: "all",
  workFromHome: false,
  employmentTypes: null,
  jobRequirements: null,
  radius: null,
  excludeJobPublishers: null,
};

const EMPTY_PATTERN_FORM: Omit<ScoringPattern, "id" | "createdAt" | "updatedAt" | "enabled"> = {
  pattern: "",
  weight: 10,
  effect: "+",
  countOnce: false,
  disqualify: false,
};

/* ------------------------------------------------------------------ */
/*  Page Component                                                    */
/* ------------------------------------------------------------------ */
export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Account state
  const [username, setUsername] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  // Search settings
  const [searchNumPages, setSearchNumPages] = useState(3);

  // Recommended settings (general)
  const [minRecommendedScore, setMinRecommendedScore] = useState(50);
  const [recommendedExpiryDays, setRecommendedExpiryDays] = useState(5);
  const [recommendedNumPages, setRecommendedNumPages] = useState(1);

  // Recommended queries
  const [queries, setQueries] = useState<RecommendedQuery[]>([]);
  const [queryFormOpen, setQueryFormOpen] = useState(false);
  const [editingQueryId, setEditingQueryId] = useState<number | null>(null);
  const [queryForm, setQueryForm] = useState(EMPTY_QUERY_FORM);
  const [querySaving, setQuerySaving] = useState(false);

  // Scoring patterns
  const [patterns, setPatterns] = useState<ScoringPattern[]>([]);
  const [patternFormOpen, setPatternFormOpen] = useState(false);
  const [editingPatternId, setEditingPatternId] = useState<number | null>(null);
  const [patternForm, setPatternForm] = useState(EMPTY_PATTERN_FORM);
  const [patternSaving, setPatternSaving] = useState(false);
  const [patternError, setPatternError] = useState("");

  // Cron
  const [cronSchedule, setCronSchedule] = useState("0 */12 * * *");
  const [cronPreset, setCronPreset] = useState("0 */12 * * *");
  const [customCron, setCustomCron] = useState("");
  const [cronEnabled, setCronEnabled] = useState(true);

  // Cover letter model
  const [coverLetterModel, setCoverLetterModel] = useState("vt-arc");

  // OpenRouter
  const [openRouterModels, setOpenRouterModels] = useState<
    { id: string; name: string; context_length: number | null }[]
  >([]);
  const [openRouterLoading, setOpenRouterLoading] = useState(false);
  const [openRouterSearch, setOpenRouterSearch] = useState("");

  // Data maintenance
  const [clearingRecommended, setClearingRecommended] = useState(false);
  const [clearingJobs, setClearingJobs] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState("");

  /* ---------- helpers ---------- */

  const deriveCronPreset = (cron: string) => {
    const match = CRON_PRESETS.find(
      (p) => p.value !== "__custom__" && p.value === cron
    );
    if (match) {
      setCronPreset(match.value);
      setCustomCron("");
    } else {
      setCronPreset("__custom__");
      setCustomCron(cron);
    }
  };

  /* ---------- load data ---------- */

  const fetchData = useCallback(async () => {
    try {
      const [settings, me, queriesData, patternsData] = await Promise.all([
        apiFetch<Settings>("/api/settings"),
        apiFetch<{ username: string }>("/api/auth/me"),
        apiFetch<RecommendedQuery[]>("/api/recommended-queries"),
        apiFetch<ScoringPattern[]>("/api/scoring-patterns"),
      ]);

      setUsername(me.username);

      // Search settings
      setSearchNumPages(settings.searchNumPages);

      // Recommended settings
      setMinRecommendedScore(settings.minRecommendedScore ?? 50);
      setRecommendedExpiryDays(settings.recommendedExpiryDays ?? 5);
      setRecommendedNumPages(settings.recommendedNumPages ?? 1);
      setCronEnabled(settings.cronEnabled ?? true);

      // Cron
      setCronSchedule(settings.cronSchedule);
      deriveCronPreset(settings.cronSchedule);

      // Cover letter model
      setCoverLetterModel(settings.coverLetterModel || "vt-arc");

      // Queries & patterns
      setQueries(queriesData);
      setPatterns(patternsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchOpenRouterModels = useCallback(async () => {
    setOpenRouterLoading(true);
    try {
      const data = await apiFetch<{
        models: { id: string; name: string; context_length: number | null }[];
      }>("/api/openrouter/models");
      setOpenRouterModels(data.models);
    } catch (err) {
      console.error("Failed to fetch OpenRouter models:", err);
    } finally {
      setOpenRouterLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOpenRouterModels();
  }, [fetchOpenRouterModels]);

  /* ---------- account handlers ---------- */

  const handleUsernameChange = async () => {
    setUsernameSaving(true);
    setUsernameMsg("");
    try {
      await apiFetch("/api/auth/username", {
        method: "PATCH",
        body: JSON.stringify({ username }),
      });
      setUsernameMsg("Username updated");
      setTimeout(() => setUsernameMsg(""), 3000);
    } catch (err) {
      setUsernameMsg(
        err instanceof Error ? err.message : "Failed to update"
      );
    } finally {
      setUsernameSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPwSaving(true);
    setPwMsg("");
    if (newPassword !== confirmPassword) {
      setPwMsg("Passwords do not match");
      setPwSaving(false);
      return;
    }
    if (newPassword.length < 8) {
      setPwMsg("Password must be at least 8 characters");
      setPwSaving(false);
      return;
    }
    try {
      await apiFetch("/api/auth/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPwMsg("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwMsg(""), 3000);
    } catch (err) {
      setPwMsg(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setPwSaving(false);
    }
  };

  /* ---------- recommended queries handlers ---------- */

  const handleToggleQuery = async (id: number) => {
    try {
      const updated = await apiFetch<RecommendedQuery>(
        `/api/recommended-queries/${id}/toggle`,
        { method: "PATCH" }
      );
      setQueries((prev) =>
        prev.map((q) => (q.id === id ? updated : q))
      );
    } catch (err) {
      console.error("Failed to toggle query:", err);
    }
  };

  const handleDeleteQuery = async (id: number) => {
    if (!confirm("Delete this search query?")) return;
    try {
      await apiFetch(`/api/recommended-queries/${id}`, { method: "DELETE" });
      setQueries((prev) => prev.filter((q) => q.id !== id));
    } catch (err) {
      console.error("Failed to delete query:", err);
    }
  };

  const handleEditQuery = (q: RecommendedQuery) => {
    setEditingQueryId(q.id);
    setQueryForm({
      query: q.query,
      page: q.page,
      numPages: q.numPages,
      country: q.country,
      language: q.language,
      datePosted: q.datePosted,
      workFromHome: q.workFromHome,
      employmentTypes: q.employmentTypes,
      jobRequirements: q.jobRequirements,
      radius: q.radius,
      excludeJobPublishers: q.excludeJobPublishers,
    });
    setQueryFormOpen(true);
  };

  const handleSaveQuery = async () => {
    if (!queryForm.query.trim()) return;
    setQuerySaving(true);
    try {
      const body = JSON.stringify({
        ...queryForm,
        language: queryForm.language || null,
        employmentTypes: queryForm.employmentTypes || null,
        jobRequirements: queryForm.jobRequirements || null,
        radius: queryForm.radius || null,
        excludeJobPublishers: queryForm.excludeJobPublishers || null,
      });

      if (editingQueryId) {
        const updated = await apiFetch<RecommendedQuery>(
          `/api/recommended-queries/${editingQueryId}`,
          { method: "PUT", body }
        );
        setQueries((prev) =>
          prev.map((q) => (q.id === editingQueryId ? updated : q))
        );
      } else {
        const created = await apiFetch<RecommendedQuery>(
          "/api/recommended-queries",
          { method: "POST", body }
        );
        setQueries((prev) => [...prev, created]);
      }
      setQueryFormOpen(false);
      setEditingQueryId(null);
      setQueryForm(EMPTY_QUERY_FORM);
    } catch (err) {
      console.error("Failed to save query:", err);
    } finally {
      setQuerySaving(false);
    }
  };

  const handleCancelQuery = () => {
    setQueryFormOpen(false);
    setEditingQueryId(null);
    setQueryForm(EMPTY_QUERY_FORM);
  };

  /* ---------- scoring patterns handlers ---------- */

  const validatePattern = (p: string): string => {
    if (!p.trim()) return "Pattern is required";
    try {
      new RegExp(p);
      return "";
    } catch {
      return "Invalid regular expression";
    }
  };

  const handleTogglePattern = async (id: number) => {
    try {
      const updated = await apiFetch<ScoringPattern>(
        `/api/scoring-patterns/${id}/toggle`,
        { method: "PATCH" }
      );
      setPatterns((prev) =>
        prev.map((p) => (p.id === id ? updated : p))
      );
    } catch (err) {
      console.error("Failed to toggle pattern:", err);
    }
  };

  const handleDeletePattern = async (id: number) => {
    if (!confirm("Delete this scoring pattern?")) return;
    try {
      await apiFetch(`/api/scoring-patterns/${id}`, { method: "DELETE" });
      setPatterns((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Failed to delete pattern:", err);
    }
  };

  const handleEditPattern = (p: ScoringPattern) => {
    setEditingPatternId(p.id);
    setPatternForm({
      pattern: p.pattern,
      weight: p.weight,
      effect: p.effect,
      countOnce: p.countOnce,
      disqualify: p.disqualify,
    });
    setPatternError("");
    setPatternFormOpen(true);
  };

  const handleSavePattern = async () => {
    const err = validatePattern(patternForm.pattern);
    if (err) {
      setPatternError(err);
      return;
    }
    setPatternSaving(true);
    setPatternError("");
    try {
      const body = JSON.stringify(patternForm);

      if (editingPatternId) {
        const updated = await apiFetch<ScoringPattern>(
          `/api/scoring-patterns/${editingPatternId}`,
          { method: "PUT", body }
        );
        setPatterns((prev) =>
          prev.map((p) => (p.id === editingPatternId ? updated : p))
        );
      } else {
        const created = await apiFetch<ScoringPattern>(
          "/api/scoring-patterns",
          { method: "POST", body }
        );
        setPatterns((prev) => [...prev, created]);
      }
      setPatternFormOpen(false);
      setEditingPatternId(null);
      setPatternForm(EMPTY_PATTERN_FORM);
    } catch (err) {
      console.error("Failed to save pattern:", err);
    } finally {
      setPatternSaving(false);
    }
  };

  const handleCancelPattern = () => {
    setPatternFormOpen(false);
    setEditingPatternId(null);
    setPatternForm(EMPTY_PATTERN_FORM);
    setPatternError("");
  };

  /* ---------- save settings ---------- */

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    const resolvedCron =
      cronPreset === "__custom__" ? customCron : cronPreset;

    try {
      await apiFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          searchNumPages,
          recommendedNumPages,
          recommendedExpiryDays,
          minRecommendedScore,
          cronSchedule: resolvedCron,
          cronEnabled,
          coverLetterModel,
        }),
      });
      setCronSchedule(resolvedCron);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  /* ---------- data maintenance ---------- */

  const handleClearRecommended = async () => {
    if (!confirm("Clear all recommended matches and runs? This cannot be undone.")) return;
    setClearingRecommended(true);
    setMaintenanceMsg("");
    try {
      await apiFetch("/api/admin/clear-recommended", { method: "POST" });
      setMaintenanceMsg("Recommended data cleared.");
    } catch (err) {
      setMaintenanceMsg(
        err instanceof Error ? err.message : "Failed to clear recommended data"
      );
    } finally {
      setClearingRecommended(false);
    }
  };

  const handleClearJobs = async () => {
    if (!confirm("Clear ALL jobs, saved jobs, and recommendations? This cannot be undone.")) return;
    setClearingJobs(true);
    setMaintenanceMsg("");
    try {
      await apiFetch("/api/admin/clear-jobs", { method: "POST" });
      setMaintenanceMsg("All jobs and related data cleared.");
    } catch (err) {
      setMaintenanceMsg(
        err instanceof Error ? err.message : "Failed to clear jobs data"
      );
    } finally {
      setClearingJobs(false);
    }
  };

  /* ---------- render ---------- */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your account, search defaults, recommended settings, and cron
          schedule
        </p>
      </div>

      <div className="space-y-6">
        {/* ==================== Account ==================== */}
        <Section title="Account">
          {/* Username */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Username
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              />
              <button
                onClick={handleUsernameChange}
                disabled={usernameSaving}
                className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
              >
                {usernameSaving ? "Saving..." : "Update"}
              </button>
            </div>
            {usernameMsg && (
              <p
                className={cn(
                  "text-sm font-medium",
                  usernameMsg.includes("updated")
                    ? "text-green-600"
                    : "text-red-600"
                )}
              >
                {usernameMsg}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Change Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8 characters)"
              className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={handlePasswordChange}
                disabled={pwSaving || !currentPassword || !newPassword}
                className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {pwSaving ? "Updating..." : "Change Password"}
              </button>
              {pwMsg && (
                <p
                  className={cn(
                    "text-sm font-medium",
                    pwMsg.includes("updated")
                      ? "text-green-600"
                      : "text-red-600"
                  )}
                >
                  {pwMsg}
                </p>
              )}
            </div>
          </div>
        </Section>

        {/* ==================== Search Settings ==================== */}
        <Section title="Search Settings">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Default Pages per Search
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={searchNumPages}
              onChange={(e) =>
                setSearchNumPages(
                  Math.max(1, Math.min(50, parseInt(e.target.value) || 1))
                )
              }
              className="w-48 px-4 py-2.5 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-0.5">1 credit per page</p>
          </div>
        </Section>

        {/* ==================== Recommended Settings ==================== */}
        <Section title="Recommended Settings">
          {/* --- General Settings --- */}
          <h3 className="text-sm font-semibold text-gray-800">General</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Minimum Score
              </label>
              <input
                type="number"
                value={minRecommendedScore}
                onChange={(e) =>
                  setMinRecommendedScore(parseInt(e.target.value) || 0)
                }
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-0.5">
                Only jobs at or above this score enter recommendations.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Expiry Days
              </label>
              <input
                type="number"
                min={1}
                max={90}
                value={recommendedExpiryDays}
                onChange={(e) =>
                  setRecommendedExpiryDays(
                    Math.max(1, Math.min(90, parseInt(e.target.value) || 5))
                  )
                }
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-0.5">
                Hide jobs older than this
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Default Pages for Queries
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={recommendedNumPages}
                onChange={(e) =>
                  setRecommendedNumPages(
                    Math.max(1, Math.min(50, parseInt(e.target.value) || 1))
                  )
                }
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* --- Search Queries --- */}
          <div className="border-t border-gray-100 pt-4 mt-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">
                Search Queries
              </h3>
              {!queryFormOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingQueryId(null);
                    setQueryForm(EMPTY_QUERY_FORM);
                    setQueryFormOpen(true);
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Query
                </button>
              )}
            </div>

            {/* Query list */}
            {queries.length === 0 && !queryFormOpen && (
              <p className="text-sm text-gray-400 italic">
                No search queries configured yet.
              </p>
            )}

            <div className="space-y-2">
              {queries.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between gap-3 p-3 border border-gray-200 rounded-xl bg-white"
                >
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-sm font-bold text-gray-900 truncate">
                      {q.query}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                      {q.country.toUpperCase()}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                      {q.datePosted}
                    </span>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full border font-medium",
                        q.enabled
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      )}
                    >
                      {q.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleQuery(q.id)}
                      className={cn(
                        "px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors",
                        q.enabled
                          ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                          : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                      )}
                    >
                      {q.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditQuery(q)}
                      className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuery(q.id)}
                      className="px-2.5 py-1 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Query inline form */}
            {queryFormOpen && (
              <div className="mt-3 p-4 border border-blue-200 rounded-xl bg-blue-50/30 space-y-3">
                <h4 className="text-sm font-medium text-gray-800">
                  {editingQueryId ? "Edit Query" : "New Query"}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Query *
                    </label>
                    <input
                      type="text"
                      value={queryForm.query}
                      onChange={(e) =>
                        setQueryForm({ ...queryForm, query: e.target.value })
                      }
                      placeholder="e.g. software engineer"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Page
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={queryForm.page}
                      onChange={(e) =>
                        setQueryForm({
                          ...queryForm,
                          page: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Num Pages
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={queryForm.numPages}
                      onChange={(e) =>
                        setQueryForm({
                          ...queryForm,
                          numPages: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      value={queryForm.country}
                      onChange={(e) =>
                        setQueryForm({ ...queryForm, country: e.target.value })
                      }
                      placeholder="us"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Language
                    </label>
                    <input
                      type="text"
                      value={queryForm.language ?? ""}
                      onChange={(e) =>
                        setQueryForm({
                          ...queryForm,
                          language: e.target.value || null,
                        })
                      }
                      placeholder="en (optional)"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Date Posted
                    </label>
                    <select
                      value={queryForm.datePosted}
                      onChange={(e) =>
                        setQueryForm({
                          ...queryForm,
                          datePosted: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {DATE_POSTED_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="queryWfh"
                      checked={queryForm.workFromHome}
                      onChange={(e) =>
                        setQueryForm({
                          ...queryForm,
                          workFromHome: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label
                      htmlFor="queryWfh"
                      className="text-sm text-gray-700"
                    >
                      Work from Home
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Employment Types
                    </label>
                    <input
                      type="text"
                      value={queryForm.employmentTypes ?? ""}
                      onChange={(e) =>
                        setQueryForm({
                          ...queryForm,
                          employmentTypes: e.target.value || null,
                        })
                      }
                      placeholder="fulltime,parttime (optional)"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Job Requirements
                    </label>
                    <input
                      type="text"
                      value={queryForm.jobRequirements ?? ""}
                      onChange={(e) =>
                        setQueryForm({
                          ...queryForm,
                          jobRequirements: e.target.value || null,
                        })
                      }
                      placeholder="under_3_years_experience (optional)"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Radius
                    </label>
                    <input
                      type="number"
                      value={queryForm.radius ?? ""}
                      onChange={(e) =>
                        setQueryForm({
                          ...queryForm,
                          radius: e.target.value
                            ? parseInt(e.target.value)
                            : null,
                        })
                      }
                      placeholder="miles (optional)"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Exclude Job Publishers
                    </label>
                    <input
                      type="text"
                      value={queryForm.excludeJobPublishers ?? ""}
                      onChange={(e) =>
                        setQueryForm({
                          ...queryForm,
                          excludeJobPublishers: e.target.value || null,
                        })
                      }
                      placeholder="BeeBe,Dice (optional, comma-separated)"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveQuery}
                    disabled={querySaving || !queryForm.query.trim()}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {querySaving
                      ? "Saving..."
                      : editingQueryId
                        ? "Update Query"
                        : "Save Query"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelQuery}
                    className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* --- Scoring Patterns --- */}
          <div className="border-t border-gray-100 pt-4 mt-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">
                Scoring Patterns
              </h3>
              {!patternFormOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPatternId(null);
                    setPatternForm(EMPTY_PATTERN_FORM);
                    setPatternError("");
                    setPatternFormOpen(true);
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Pattern
                </button>
              )}
            </div>

            {/* Pattern list */}
            {patterns.length === 0 && !patternFormOpen && (
              <p className="text-sm text-gray-400 italic">
                No scoring patterns configured yet.
              </p>
            )}

            <div className="space-y-2">
              {patterns.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 p-3 border border-gray-200 rounded-xl bg-white"
                >
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-sm font-mono text-gray-900 truncate">
                      {p.pattern}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 font-medium">
                      {p.weight}
                    </span>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full border font-medium",
                        p.effect === "+"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      )}
                    >
                      {p.effect}
                    </span>
                    {p.countOnce && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                        countOnce
                      </span>
                    )}
                    {p.disqualify && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 font-semibold">
                        disqualify
                      </span>
                    )}
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full border font-medium",
                        p.enabled
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      )}
                    >
                      {p.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTogglePattern(p.id)}
                      className={cn(
                        "px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors",
                        p.enabled
                          ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                          : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                      )}
                    >
                      {p.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditPattern(p)}
                      className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePattern(p.id)}
                      className="px-2.5 py-1 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pattern inline form */}
            {patternFormOpen && (
              <div className="mt-3 p-4 border border-blue-200 rounded-xl bg-blue-50/30 space-y-3">
                <h4 className="text-sm font-medium text-gray-800">
                  {editingPatternId ? "Edit Pattern" : "New Pattern"}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Pattern (regex) *
                    </label>
                    <input
                      type="text"
                      value={patternForm.pattern}
                      onChange={(e) => {
                        setPatternForm({
                          ...patternForm,
                          pattern: e.target.value,
                        });
                        if (patternError) {
                          const err = validatePattern(e.target.value);
                          setPatternError(err);
                        }
                      }}
                      placeholder="e.g. \\bclearance\\b"
                      className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    {patternError && (
                      <p className="text-xs text-red-600 mt-1">
                        {patternError}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      className={cn(
                        "block text-xs font-medium mb-1",
                        patternForm.disqualify
                          ? "text-gray-400"
                          : "text-gray-600"
                      )}
                    >
                      Weight
                    </label>
                    <input
                      type="number"
                      value={patternForm.weight}
                      onChange={(e) =>
                        setPatternForm({
                          ...patternForm,
                          weight: parseInt(e.target.value) || 0,
                        })
                      }
                      disabled={patternForm.disqualify}
                      className={cn(
                        "w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white",
                        patternForm.disqualify && "opacity-40 cursor-not-allowed"
                      )}
                    />
                  </div>
                  <div>
                    <label
                      className={cn(
                        "block text-xs font-medium mb-1",
                        patternForm.disqualify
                          ? "text-gray-400"
                          : "text-gray-600"
                      )}
                    >
                      Effect
                    </label>
                    <select
                      value={patternForm.effect}
                      onChange={(e) =>
                        setPatternForm({
                          ...patternForm,
                          effect: e.target.value,
                        })
                      }
                      disabled={patternForm.disqualify}
                      className={cn(
                        "w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white",
                        patternForm.disqualify && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      <option value="+">+ (boost)</option>
                      <option value="-">- (penalize)</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="patternCountOnce"
                        checked={patternForm.countOnce}
                        onChange={(e) =>
                          setPatternForm({
                            ...patternForm,
                            countOnce: e.target.checked,
                          })
                        }
                        disabled={patternForm.disqualify}
                        className={cn(
                          "h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500",
                          patternForm.disqualify &&
                            "opacity-40 cursor-not-allowed"
                        )}
                      />
                      <label
                        htmlFor="patternCountOnce"
                        className={cn(
                          "text-sm",
                          patternForm.disqualify
                            ? "text-gray-400"
                            : "text-gray-700"
                        )}
                      >
                        Count Once
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="patternDisqualify"
                        checked={patternForm.disqualify}
                        onChange={(e) =>
                          setPatternForm({
                            ...patternForm,
                            disqualify: e.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label
                        htmlFor="patternDisqualify"
                        className="text-sm text-gray-700"
                      >
                        Disqualify
                      </label>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSavePattern}
                    disabled={patternSaving || !patternForm.pattern.trim()}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {patternSaving
                      ? "Saving..."
                      : editingPatternId
                        ? "Update Pattern"
                        : "Save Pattern"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelPattern}
                    className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* ==================== Cover Letter Model ==================== */}
        <Section title="Cover Letter Model">
          <p className="text-sm text-gray-500 -mt-2 mb-3">
            Select the AI model used for generating cover letters.
          </p>

          {/* Built-in models */}
          <div className="space-y-3">
            {COVER_LETTER_MODELS.map((model) => (
              <label
                key={model.value}
                className={cn(
                  "flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-colors",
                  coverLetterModel === model.value
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <input
                  type="radio"
                  name="coverLetterModel"
                  value={model.value}
                  checked={coverLetterModel === model.value}
                  onChange={() => setCoverLetterModel(model.value)}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {model.label}
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {model.description}
                  </p>
                </div>
              </label>
            ))}

            {/* OpenRouter section */}
            <label
              className={cn(
                "flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-colors",
                coverLetterModel.startsWith("openrouter:")
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <input
                type="radio"
                name="coverLetterModel"
                value="openrouter"
                checked={coverLetterModel.startsWith("openrouter:")}
                onChange={() => {
                  if (!coverLetterModel.startsWith("openrouter:") && openRouterModels.length > 0) {
                    setCoverLetterModel(`openrouter:${openRouterModels[0].id}`);
                  }
                }}
                className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 mt-0.5"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">
                  OpenRouter — Free Models
                </span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Requires OPENROUTER_API_KEY. Access hundreds of free AI models.
                </p>

                {coverLetterModel.startsWith("openrouter:") && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={openRouterSearch}
                      onChange={(e) => setOpenRouterSearch(e.target.value)}
                      placeholder="Search models..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow mb-2"
                    />
                    {openRouterLoading ? (
                      <div className="flex items-center gap-2 py-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                        <span className="text-xs text-gray-500">Loading models...</span>
                      </div>
                    ) : (
                      <select
                        value={coverLetterModel.replace("openrouter:", "")}
                        onChange={(e) => setCoverLetterModel(`openrouter:${e.target.value}`)}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {openRouterModels
                          .filter((m) =>
                            m.name.toLowerCase().includes(openRouterSearch.toLowerCase()) ||
                            m.id.toLowerCase().includes(openRouterSearch.toLowerCase())
                          )
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.id})
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            </label>
          </div>
        </Section>

        {/* ==================== Cron Schedule ==================== */}
        <Section title="Cron Schedule">
          <p className="text-sm text-gray-500 -mt-2 mb-3">
            How often the recommended job pull runs automatically.
          </p>

          <div className="flex items-center gap-3 mb-3">
            <span
              className={cn(
                "text-xs font-semibold px-3 py-1 rounded-full border",
                cronEnabled
                  ? "bg-green-100 text-green-700 border-green-200"
                  : "bg-red-100 text-red-700 border-red-200"
              )}
            >
              {cronEnabled ? "Cron active" : "Cron disabled"}
            </span>
            <button
              type="button"
              onClick={() => setCronEnabled((v) => !v)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg border transition-colors",
                cronEnabled
                  ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                  : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
              )}
            >
              {cronEnabled ? "Disable cron" : "Enable cron"}
            </button>
          </div>

          <div className="space-y-2">
            {CRON_PRESETS.map((preset) => (
              <label
                key={preset.value}
                className="flex items-center gap-3 cursor-pointer"
              >
                <input
                  type="radio"
                  name="cronPreset"
                  value={preset.value}
                  checked={cronPreset === preset.value}
                  onChange={() => {
                    setCronPreset(preset.value);
                    if (preset.value !== "__custom__") {
                      setCustomCron("");
                    }
                  }}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{preset.label}</span>
              </label>
            ))}
          </div>

          {cronPreset === "__custom__" && (
            <div className="mt-3">
              <input
                type="text"
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
                placeholder="e.g. 0 */8 * * *"
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow font-mono"
              />
            </div>
          )}

          <p className="text-xs text-gray-400 mt-2">
            Current schedule:{" "}
            <span className="font-mono text-gray-500">{cronSchedule}</span>
          </p>
        </Section>

        {/* ==================== Data Maintenance ==================== */}
        <Section title="Data Maintenance">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleClearRecommended}
              disabled={clearingRecommended}
              className="px-4 py-2.5 bg-amber-100 text-amber-800 text-sm font-medium rounded-xl border border-amber-200 hover:bg-amber-200 disabled:opacity-60"
            >
              {clearingRecommended ? "Clearing..." : "Clear Recommended"}
            </button>
            <button
              type="button"
              onClick={handleClearJobs}
              disabled={clearingJobs}
              className="px-4 py-2.5 bg-red-100 text-red-800 text-sm font-medium rounded-xl border border-red-200 hover:bg-red-200 disabled:opacity-60"
            >
              {clearingJobs ? "Clearing..." : "Clear All Jobs"}
            </button>
          </div>
          {maintenanceMsg && (
            <p className="text-sm text-gray-600 pt-2">{maintenanceMsg}</p>
          )}
        </Section>

        {/* ==================== Save Button ==================== */}
        <div className="flex items-center gap-3 pt-4 pb-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium">
              Saved successfully
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
