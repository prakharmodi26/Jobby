"use client";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { Settings } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  TagInput                                                          */
/* ------------------------------------------------------------------ */
function TagInput({
  label,
  placeholder,
  tags,
  onChange,
}: {
  label: string;
  placeholder: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) {
      onChange([...tags, val]);
    }
    setInput("");
  };

  const removeTag = (idx: number) => {
    onChange(tags.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      <div className="flex flex-wrap gap-2 p-3 border border-gray-300 rounded-xl min-h-[48px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-shadow bg-white">
        {tags.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-sm px-2.5 py-1 rounded-lg"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(i)}
              className="text-blue-400 hover:text-blue-600 ml-0.5"
            >
              &times;
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
            if (e.key === "Backspace" && !input && tags.length > 0) {
              removeTag(tags.length - 1);
            }
          }}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] text-sm outline-none bg-transparent py-1"
        />
      </div>
    </div>
  );
}

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
/*  WeightInput — compact labeled number input for scoring weights    */
/* ------------------------------------------------------------------ */
function WeightInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1 truncate">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  WeightGroup — subsection header + grid of weight inputs           */
/* ------------------------------------------------------------------ */
function WeightGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-800 mb-2">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const DEFAULTS: Partial<Settings> = {
  weightSkillMatch: 10,
  weightTargetTitle: 10,
  weightRecencyDay1: 30,
  weightRecencyDay3: 20,
  weightRecencyWeek: 10,
  weightRemoteMatch: 15,
  weightWorkModeMatch: 10,
  weightOnsiteMatch: 5,
  weightSeniorityMatch: 20,
  weightSeniorityMismatch: -15,
  weightSalaryOverlap: 15,
  weightSalaryBelow: -20,
  weightIndustryMatch: 10,
  weightEducationMeet: 5,
  weightEducationUnder: -10,
  weightCompanySize: 10,
  weightExpMeet: 10,
  weightExpClose: 5,
  weightExpUnder: -15,
  weightCitizenship: -50,
  weightOptCptBoost: 20,
};

const CRON_PRESETS = [
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every 12 hours (default)", value: "0 */12 * * *" },
  { label: "Every 24 hours", value: "0 0 * * *" },
  { label: "Custom", value: "__custom__" },
];

const DATE_POSTED_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "3days", label: "3 Days" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const COVER_LETTER_MODELS = [
  {
    value: "vt-arc",
    label: "VT ARC — GPT-OSS-120B",
    description: "Requires VT network/VPN and VT_ARC_KEY",
  },
  {
    value: "gemini",
    label: "Google Gemma 3 12B",
    description: "Requires GOOGLE_API_KEY",
  },
];

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
  const [searchNumPages, setSearchNumPages] = useState(5);
  const [recommendedNumPages, setRecommendedNumPages] = useState(3);
  const [recommendedDatePosted, setRecommendedDatePosted] = useState("week");
  const [excludePublishers, setExcludePublishers] = useState<string[]>([]);

  // Cron
  const [cronSchedule, setCronSchedule] = useState("0 */12 * * *");
  const [cronPreset, setCronPreset] = useState("0 */12 * * *");
  const [customCron, setCustomCron] = useState("");

  // Cover letter model
  const [coverLetterModel, setCoverLetterModel] = useState("vt-arc");

  // Scoring weights
  const [weightSkillMatch, setWeightSkillMatch] = useState(10);
  const [weightTargetTitle, setWeightTargetTitle] = useState(10);
  const [weightRecencyDay1, setWeightRecencyDay1] = useState(30);
  const [weightRecencyDay3, setWeightRecencyDay3] = useState(20);
  const [weightRecencyWeek, setWeightRecencyWeek] = useState(10);
  const [weightRemoteMatch, setWeightRemoteMatch] = useState(15);
  const [weightWorkModeMatch, setWeightWorkModeMatch] = useState(10);
  const [weightOnsiteMatch, setWeightOnsiteMatch] = useState(5);
  const [weightSeniorityMatch, setWeightSeniorityMatch] = useState(20);
  const [weightSeniorityMismatch, setWeightSeniorityMismatch] = useState(-15);
  const [weightSalaryOverlap, setWeightSalaryOverlap] = useState(15);
  const [weightSalaryBelow, setWeightSalaryBelow] = useState(-20);
  const [weightIndustryMatch, setWeightIndustryMatch] = useState(10);
  const [weightEducationMeet, setWeightEducationMeet] = useState(5);
  const [weightEducationUnder, setWeightEducationUnder] = useState(-10);
  const [weightCompanySize, setWeightCompanySize] = useState(10);
  const [weightExpMeet, setWeightExpMeet] = useState(10);
  const [weightExpClose, setWeightExpClose] = useState(5);
  const [weightExpUnder, setWeightExpUnder] = useState(-15);
  const [weightCitizenship, setWeightCitizenship] = useState(-50);
  const [weightOptCptBoost, setWeightOptCptBoost] = useState(20);

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
      const [settings, me] = await Promise.all([
        apiFetch<Settings>("/api/settings"),
        apiFetch<{ username: string }>("/api/auth/me"),
      ]);

      setUsername(me.username);

      // Search settings
      setSearchNumPages(settings.searchNumPages);
      setRecommendedNumPages(settings.recommendedNumPages);
      setRecommendedDatePosted(settings.recommendedDatePosted);
      setExcludePublishers(settings.excludePublishers);

      // Cron
      setCronSchedule(settings.cronSchedule);
      deriveCronPreset(settings.cronSchedule);

      // Cover letter model
      setCoverLetterModel(settings.coverLetterModel || "vt-arc");

      // Weights
      setWeightSkillMatch(settings.weightSkillMatch);
      setWeightTargetTitle(settings.weightTargetTitle);
      setWeightRecencyDay1(settings.weightRecencyDay1);
      setWeightRecencyDay3(settings.weightRecencyDay3);
      setWeightRecencyWeek(settings.weightRecencyWeek);
      setWeightRemoteMatch(settings.weightRemoteMatch);
      setWeightWorkModeMatch(settings.weightWorkModeMatch);
      setWeightOnsiteMatch(settings.weightOnsiteMatch);
      setWeightSeniorityMatch(settings.weightSeniorityMatch);
      setWeightSeniorityMismatch(settings.weightSeniorityMismatch);
      setWeightSalaryOverlap(settings.weightSalaryOverlap);
      setWeightSalaryBelow(settings.weightSalaryBelow);
      setWeightIndustryMatch(settings.weightIndustryMatch);
      setWeightEducationMeet(settings.weightEducationMeet);
      setWeightEducationUnder(settings.weightEducationUnder);
      setWeightCompanySize(settings.weightCompanySize);
      setWeightExpMeet(settings.weightExpMeet);
      setWeightExpClose(settings.weightExpClose);
      setWeightExpUnder(settings.weightExpUnder);
      setWeightCitizenship(settings.weightCitizenship);
      setWeightOptCptBoost(settings.weightOptCptBoost);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
          recommendedDatePosted,
          excludePublishers,
          cronSchedule: resolvedCron,
          coverLetterModel,
          weightSkillMatch,
          weightTargetTitle,
          weightRecencyDay1,
          weightRecencyDay3,
          weightRecencyWeek,
          weightRemoteMatch,
          weightWorkModeMatch,
          weightOnsiteMatch,
          weightSeniorityMatch,
          weightSeniorityMismatch,
          weightSalaryOverlap,
          weightSalaryBelow,
          weightIndustryMatch,
          weightEducationMeet,
          weightEducationUnder,
          weightCompanySize,
          weightExpMeet,
          weightExpClose,
          weightExpUnder,
          weightCitizenship,
          weightOptCptBoost,
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

  /* ---------- reset weights ---------- */

  const handleResetWeights = () => {
    setWeightSkillMatch(DEFAULTS.weightSkillMatch!);
    setWeightTargetTitle(DEFAULTS.weightTargetTitle!);
    setWeightRecencyDay1(DEFAULTS.weightRecencyDay1!);
    setWeightRecencyDay3(DEFAULTS.weightRecencyDay3!);
    setWeightRecencyWeek(DEFAULTS.weightRecencyWeek!);
    setWeightRemoteMatch(DEFAULTS.weightRemoteMatch!);
    setWeightWorkModeMatch(DEFAULTS.weightWorkModeMatch!);
    setWeightOnsiteMatch(DEFAULTS.weightOnsiteMatch!);
    setWeightSeniorityMatch(DEFAULTS.weightSeniorityMatch!);
    setWeightSeniorityMismatch(DEFAULTS.weightSeniorityMismatch!);
    setWeightSalaryOverlap(DEFAULTS.weightSalaryOverlap!);
    setWeightSalaryBelow(DEFAULTS.weightSalaryBelow!);
    setWeightIndustryMatch(DEFAULTS.weightIndustryMatch!);
    setWeightEducationMeet(DEFAULTS.weightEducationMeet!);
    setWeightEducationUnder(DEFAULTS.weightEducationUnder!);
    setWeightCompanySize(DEFAULTS.weightCompanySize!);
    setWeightExpMeet(DEFAULTS.weightExpMeet!);
    setWeightExpClose(DEFAULTS.weightExpClose!);
    setWeightExpUnder(DEFAULTS.weightExpUnder!);
    setWeightCitizenship(DEFAULTS.weightCitizenship!);
    setWeightOptCptBoost(DEFAULTS.weightOptCptBoost!);
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
          Manage your account, search defaults, cron schedule, and scoring
          weights
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
          <div className="grid grid-cols-3 gap-4">
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
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-0.5">1 credit per page</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Recommended: Pages/Query
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Recommended: Date Filter
              </label>
              <select
                value={recommendedDatePosted}
                onChange={(e) => setRecommendedDatePosted(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DATE_POSTED_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <TagInput
            label="Exclude Publishers"
            placeholder="e.g. BeeBe, Dice..."
            tags={excludePublishers}
            onChange={setExcludePublishers}
          />
        </Section>

        {/* ==================== Cover Letter Model ==================== */}
        <Section title="Cover Letter Model">
          <p className="text-sm text-gray-500 -mt-2 mb-3">
            Select the AI model used for generating cover letters.
          </p>

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
          </div>
        </Section>

        {/* ==================== Cron Schedule ==================== */}
        <Section title="Cron Schedule">
          <p className="text-sm text-gray-500 -mt-2 mb-3">
            How often the recommended job pull runs automatically.
          </p>

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

        {/* ==================== Scoring Weights ==================== */}
        <Section title="Scoring Weights">
          <p className="text-sm text-gray-500 -mt-2 mb-4">
            Fine-tune how jobs are scored. Positive values boost, negative
            values penalize. Changes take effect on the next recommended pull.
          </p>

          <div className="space-y-6">
            <WeightGroup title="Skills & Keywords">
              <WeightInput
                label="Skill match"
                value={weightSkillMatch}
                onChange={setWeightSkillMatch}
              />
              <WeightInput
                label="Target title match"
                value={weightTargetTitle}
                onChange={setWeightTargetTitle}
              />
            </WeightGroup>

            <WeightGroup title="Recency">
              <WeightInput
                label="Posted today"
                value={weightRecencyDay1}
                onChange={setWeightRecencyDay1}
              />
              <WeightInput
                label="Posted 3 days"
                value={weightRecencyDay3}
                onChange={setWeightRecencyDay3}
              />
              <WeightInput
                label="Posted this week"
                value={weightRecencyWeek}
                onChange={setWeightRecencyWeek}
              />
            </WeightGroup>

            <WeightGroup title="Work Mode">
              <WeightInput
                label="Remote preference match"
                value={weightRemoteMatch}
                onChange={setWeightRemoteMatch}
              />
              <WeightInput
                label="Work mode match"
                value={weightWorkModeMatch}
                onChange={setWeightWorkModeMatch}
              />
              <WeightInput
                label="Onsite match"
                value={weightOnsiteMatch}
                onChange={setWeightOnsiteMatch}
              />
            </WeightGroup>

            <WeightGroup title="Seniority">
              <WeightInput
                label="Seniority match"
                value={weightSeniorityMatch}
                onChange={setWeightSeniorityMatch}
              />
              <WeightInput
                label="Seniority mismatch"
                value={weightSeniorityMismatch}
                onChange={setWeightSeniorityMismatch}
              />
            </WeightGroup>

            <WeightGroup title="Salary">
              <WeightInput
                label="Salary overlap"
                value={weightSalaryOverlap}
                onChange={setWeightSalaryOverlap}
              />
              <WeightInput
                label="Below minimum salary"
                value={weightSalaryBelow}
                onChange={setWeightSalaryBelow}
              />
            </WeightGroup>

            <WeightGroup title="Industry">
              <WeightInput
                label="Industry match"
                value={weightIndustryMatch}
                onChange={setWeightIndustryMatch}
              />
            </WeightGroup>

            <WeightGroup title="Education">
              <WeightInput
                label="Education meets requirement"
                value={weightEducationMeet}
                onChange={setWeightEducationMeet}
              />
              <WeightInput
                label="Under-qualified"
                value={weightEducationUnder}
                onChange={setWeightEducationUnder}
              />
            </WeightGroup>

            <WeightGroup title="Company Size">
              <WeightInput
                label="Company size match"
                value={weightCompanySize}
                onChange={setWeightCompanySize}
              />
            </WeightGroup>

            <WeightGroup title="Experience">
              <WeightInput
                label="Experience meets"
                value={weightExpMeet}
                onChange={setWeightExpMeet}
              />
              <WeightInput
                label="Experience close"
                value={weightExpClose}
                onChange={setWeightExpClose}
              />
              <WeightInput
                label="Under-experienced"
                value={weightExpUnder}
                onChange={setWeightExpUnder}
              />
            </WeightGroup>

            <WeightGroup title="Visa / Citizenship">
              <WeightInput
                label="Citizenship required penalty"
                value={weightCitizenship}
                onChange={setWeightCitizenship}
              />
              <WeightInput
                label="OPT/CPT/F1 boost"
                value={weightOptCptBoost}
                onChange={setWeightOptCptBoost}
              />
            </WeightGroup>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleResetWeights}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Reset to Defaults
            </button>
          </div>
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
