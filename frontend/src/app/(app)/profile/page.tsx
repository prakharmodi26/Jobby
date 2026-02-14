"use client";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { ProfileAIPanel } from "@/components/profile/ProfileAIPanel";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-200 pt-6 mt-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [userMd, setUserMd] = useState("");
  const [showMdPreview, setShowMdPreview] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const p = await apiFetch<Profile>("/api/profile");
      setProfile(p);
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
        body: JSON.stringify({ userMd }),
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
          Manage your cover letter profile
        </p>
      </div>

      <div className="space-y-6">
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
      <div className="sticky bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-gray-200 py-3 -mx-6 px-6 flex flex-wrap items-center gap-3">
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
