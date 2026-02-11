"use client";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProfileAIPanel } from "@/components/profile/ProfileAIPanel";

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
    if (!val || tags.includes(val)) {
      setInput("");
      return;
    }
    onChange([...tags, val]);
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
          onBlur={addTag}
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

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
          checked ? "bg-blue-600" : "bg-gray-200"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-200 pt-6 mt-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

const SENIORITY_OPTIONS = [
  { value: "", label: "Any / Not set" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid-level" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
  { value: "staff", label: "Staff / Principal" },
];

const WORK_MODE_OPTIONS = [
  { value: "", label: "Any" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "Onsite" },
];

const EDUCATION_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "none", label: "No degree" },
  { value: "associate", label: "Associate" },
  { value: "bachelors", label: "Bachelor's" },
  { value: "masters", label: "Master's" },
  { value: "phd", label: "PhD" },
];

const COMPANY_SIZE_OPTIONS = [
  { value: "", label: "Any" },
  { value: "startup", label: "Startup" },
  { value: "mid", label: "Mid-size" },
  { value: "enterprise", label: "Enterprise" },
];

const ROLE_TYPES = [
  { value: "FULLTIME", label: "Full-time" },
  { value: "PARTTIME", label: "Part-time" },
  { value: "CONTRACTOR", label: "Contract" },
  { value: "INTERN", label: "Intern" },
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Core targeting
  const [targetTitles, setTargetTitles] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [preferredLocations, setPreferredLocations] = useState<string[]>([]);
  const [remotePreferred, setRemotePreferred] = useState(false);
  const [citizenshipNotRequired, setCitizenshipNotRequired] = useState(true);
  const [avoidKeywords, setAvoidKeywords] = useState<string[]>([]);
  const EXPERIENCE_OPTIONS = [
    { value: "no_experience", label: "No experience" },
    { value: "under_3_years_experience", label: "Under 3 years" },
    { value: "more_than_3_years_experience", label: "More than 3 years" },
  ];

  // Role preferences
  const [seniority, setSeniority] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState<string[]>([]);
  const [roleTypes, setRoleTypes] = useState<string[]>([]);
  const [workModePreference, setWorkModePreference] = useState("");

  // Compensation
  const [minSalary, setMinSalary] = useState<string>("");
  const [maxSalary, setMaxSalary] = useState<string>("");

  // Education
  const [education, setEducation] = useState("");
  const [degrees, setDegrees] = useState<string[]>([]);

  // Industry & company
  const [industries, setIndustries] = useState<string[]>([]);
  const [companySizePreference, setCompanySizePreference] = useState("");
  const [companyTypes, setCompanyTypes] = useState<string[]>([]);

  // Cover letter profile
  const [userMd, setUserMd] = useState("");
  const [showMdPreview, setShowMdPreview] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const p = await apiFetch<Profile>("/api/profile");
      setProfile(p);
      setTargetTitles(p.targetTitles);
      setSkills(p.skills);
      setPreferredLocations(p.preferredLocations);
      setRemotePreferred(p.remotePreferred);
      setCitizenshipNotRequired(p.citizenshipNotRequired);
      setAvoidKeywords(p.avoidKeywords || []);
      setSeniority(p.seniority);
      if (Array.isArray(p.yearsOfExperience)) {
        setYearsOfExperience(p.yearsOfExperience);
      } else if (typeof p.yearsOfExperience === "number") {
        // Legacy numeric values: map to closest category
        if (p.yearsOfExperience === 0) {
          setYearsOfExperience(["no_experience"]);
        } else if (p.yearsOfExperience < 3) {
          setYearsOfExperience(["under_3_years_experience"]);
        } else {
          setYearsOfExperience(["more_than_3_years_experience"]);
        }
      } else {
        setYearsOfExperience([]);
      }
      setRoleTypes(p.roleTypes);
      setWorkModePreference(p.workModePreference);
      setMinSalary(p.minSalary != null ? String(p.minSalary) : "");
      setMaxSalary(p.maxSalary != null ? String(p.maxSalary) : "");
      setEducation(p.education);
      setDegrees(p.degrees);
      setIndustries(p.industries);
      setCompanySizePreference(p.companySizePreference);
      setCompanyTypes(p.companyTypes);
      setUserMd(p.userMd || "");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await apiFetch<Profile>("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          targetTitles,
          skills,
          preferredLocations,
          remotePreferred,
          citizenshipNotRequired,
          avoidKeywords,
          seniority,
          yearsOfExperience,
          roleTypes,
          workModePreference,
          minSalary: minSalary ? parseInt(minSalary) : null,
          maxSalary: maxSalary ? parseInt(maxSalary) : null,
          education,
          degrees,
          industries,
          companySizePreference,
          companyTypes,
          userMd,
        }),
      });
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleRoleType = (type: string) => {
    setRoleTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure your preferences to get better job recommendations
        </p>
      </div>

      <div className="space-y-6">
        {/* Core targeting */}
        <TagInput
          label="Target Job Titles"
          placeholder="e.g. Software Engineer, Full Stack Developer..."
          tags={targetTitles}
          onChange={setTargetTitles}
          max={5}
        />

        <TagInput
          label="Skills & Keywords"
          placeholder="e.g. React, TypeScript, Node.js..."
          tags={skills}
          onChange={setSkills}
          max={5}
        />

        <TagInput
          label="Preferred Locations"
          placeholder="e.g. San Francisco, New York, Remote..."
          tags={preferredLocations}
          onChange={setPreferredLocations}
          max={5}
        />

        <TagInput
          label="Keywords to Avoid"
          placeholder="e.g. clearance, on-call, shift work..."
          tags={avoidKeywords}
          onChange={setAvoidKeywords}
        />

        {/* Toggles */}
        <div className="space-y-4 pt-2">
          <Toggle
            label="Remote Preferred"
            description="Boost remote positions in recommendations"
            checked={remotePreferred}
            onChange={setRemotePreferred}
          />
          <Toggle
            label="Citizenship Not Required"
            description="Penalize jobs requiring US citizenship / security clearance"
            checked={citizenshipNotRequired}
            onChange={setCitizenshipNotRequired}
          />
        </div>

        {/* Role Preferences */}
        <Section title="Role Preferences">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Seniority Level
              </label>
              <select
                value={seniority}
                onChange={(e) => setSeniority(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SENIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Work Mode
              </label>
              <select
                value={workModePreference}
                onChange={(e) => setWorkModePreference(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
              >
                {WORK_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Years of Experience
            </label>
            <div className="flex flex-wrap gap-2">
              {EXPERIENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setYearsOfExperience((prev) =>
                      prev.includes(opt.value)
                        ? prev.filter((v) => v !== opt.value)
                        : [...prev, opt.value]
                    )
                  }
                  className={cn(
                    "text-sm px-3 py-2 rounded-lg border transition-colors",
                    yearsOfExperience.includes(opt.value)
                      ? "bg-blue-50 text-blue-700 border-blue-300"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role Types
            </label>
            <div className="flex flex-wrap gap-2">
              {ROLE_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => toggleRoleType(type.value)}
                  className={cn(
                    "text-sm px-3 py-2 rounded-lg border transition-colors",
                    roleTypes.includes(type.value)
                      ? "bg-blue-50 text-blue-700 border-blue-300"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Compensation */}
        <Section title="Compensation">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Minimum Salary
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input
                  type="number"
                  min={0}
                  value={minSalary}
                  onChange={(e) => setMinSalary(e.target.value)}
                  placeholder="e.g. 100000"
                  className="w-full pl-7 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Maximum Salary
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input
                  type="number"
                  min={0}
                  value={maxSalary}
                  onChange={(e) => setMaxSalary(e.target.value)}
                  placeholder="e.g. 200000"
                  className="w-full pl-7 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                />
              </div>
            </div>
          </div>
        </Section>

        {/* Education */}
        <Section title="Education">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Highest Education
            </label>
            <select
              value={education}
              onChange={(e) => setEducation(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
            >
              {EDUCATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <TagInput
            label="Degrees / Fields of Study"
            placeholder="e.g. Computer Science, Mathematics..."
            tags={degrees}
            onChange={setDegrees}
          />
        </Section>

        {/* Industry & Company */}
        <Section title="Industry & Company">
          <TagInput
            label="Industry Preferences"
            placeholder="e.g. fintech, healthcare, SaaS..."
            tags={industries}
            onChange={setIndustries}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Company Size Preference
            </label>
            <select
              value={companySizePreference}
              onChange={(e) => setCompanySizePreference(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
            >
              {COMPANY_SIZE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <TagInput
            label="Company Types"
            placeholder="e.g. product, consulting, agency..."
            tags={companyTypes}
            onChange={setCompanyTypes}
          />
        </Section>

        {/* Cover Letter Profile */}
        <Section title="Cover Letter Profile (user.md)">
          <p className="text-sm text-gray-500 -mt-2 mb-2">
            Write or upload your full profile in Markdown. This is sent to the AI
            when generating cover letters. Include experiences, projects,
            achievements, degrees, and any cover letter instructions (e.g.
            &quot;sign off with Regards&quot;).
          </p>
          <div className="flex items-center gap-3 mb-2">
            <label className="text-sm font-medium text-blue-600 hover:text-blue-700 cursor-pointer bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
              Upload .md file
              <input
                type="file"
                accept=".md,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    setUserMd(ev.target?.result as string || "");
                  };
                  reader.readAsText(file);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => setShowMdPreview((v) => !v)}
              className="text-sm text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              {showMdPreview ? "Edit" : "Preview"}
            </button>
            <button
              type="button"
              onClick={() => setShowAIPanel(true)}
              className="text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              Make with AI
            </button>
          </div>
          {showMdPreview ? (
            <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-4 min-h-[200px] max-h-[400px] overflow-auto font-mono">
              {userMd || "(empty)"}
            </pre>
          ) : (
            <textarea
              value={userMd}
              onChange={(e) => setUserMd(e.target.value)}
              placeholder={"# Your Name\n\n## Experience\n- Software Engineer at ...\n\n## Projects\n- ...\n\n## Instructions\n- Sign off with Regards"}
              className="w-full min-h-[200px] max-h-[400px] p-4 text-sm font-mono border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow resize-y"
            />
          )}
        </Section>

        {/* Last updated */}
        {profile?.updatedAt && (
          <p className="text-xs text-gray-400 pt-2">
            Last updated:{" "}
            {new Date(profile.updatedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}

        {/* Spacer for sticky footer */}
        <div className="h-16" />
      </div>

      {/* Sticky save button */}
      <div className="sticky bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-gray-200 py-3 -mx-6 px-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium">
            Saved successfully
          </span>
        )}
      </div>

      {showAIPanel && (
        <ProfileAIPanel
          onGenerated={(md) => {
            setUserMd(md);
            setShowAIPanel(false);
            setShowMdPreview(false);
          }}
          onClose={() => setShowAIPanel(false)}
        />
      )}
    </div>
  );
}
