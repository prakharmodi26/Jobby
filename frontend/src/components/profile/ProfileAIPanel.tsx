"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

interface ProfileAIPanelProps {
  onGenerated: (userMd: string) => void;
  onClose: () => void;
}

const TONE_OPTIONS = ["Professional", "Conversational", "Confident", "Neutral"];
const LENGTH_OPTIONS = ["Short", "Medium", "Flexible"];
const SIGN_OFF_OPTIONS = ["Regards", "Best", "Sincerely", "Best regards", "Thank you"];

export function ProfileAIPanel({ onGenerated, onClose }: ProfileAIPanelProps) {
  const [step, setStep] = useState(1);
  const [isVisible, setIsVisible] = useState(false);

  // Step 1: Resume
  const [resumeText, setResumeText] = useState("");

  // Step 2: Extra experience
  const [extraExperience, setExtraExperience] = useState("");

  // Step 3: Preferences
  const [tonePreference, setTonePreference] = useState("Professional");
  const [lengthPreference, setLengthPreference] = useState("Medium");
  const [highlightSkills, setHighlightSkills] = useState("");
  const [avoidTopics, setAvoidTopics] = useState("");
  const [signOff, setSignOff] = useState("Regards");
  const [customSignOff, setCustomSignOff] = useState("");
  const [extraInfo, setExtraInfo] = useState("");

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await apiFetch<{ userMd: string }>("/api/profile/generate-usermd", {
        method: "POST",
        body: JSON.stringify({
          resumeText,
          extraExperience,
          tonePreference,
          lengthPreference,
          highlightSkills,
          avoidTopics,
          signOff: signOff === "Custom" ? customSignOff : signOff,
          extraInfo,
        }),
      });
      onGenerated(res.userMd);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate profile";
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const canProceedStep1 = resumeText.trim().length > 0;
  // Step 2 and 3 are always valid (optional fields)

  return (
    <div
      className={`fixed left-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl border-r border-gray-200 flex flex-col z-[60] transition-transform duration-300 ease-out ${
        isVisible ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Generate Profile with AI</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>
        {/* Step indicator */}
        <div className="flex items-center gap-2 mt-3">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                  s === step
                    ? "bg-blue-600 text-white"
                    : s < step
                    ? "bg-blue-100 text-blue-600"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {s < step ? "\u2713" : s}
              </div>
              {s < 3 && (
                <div className={`w-8 h-0.5 ${s < step ? "bg-blue-200" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
          <span className="ml-2 text-xs text-gray-500">
            {step === 1 && "Resume"}
            {step === 2 && "Extra Experience"}
            {step === 3 && "Preferences"}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4">
        {/* Step 1: Resume */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Paste your resume</h3>
              <p className="text-xs text-gray-500 mb-3">
                Copy and paste the text content of your resume. We&apos;ll use this to build your cover letter profile.
              </p>
            </div>
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your resume text here..."
              className="w-full min-h-[300px] p-4 text-sm font-mono border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow resize-y"
            />
          </div>
        )}

        {/* Step 2: Extra experience */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Additional Experience &amp; Projects</h3>
              <p className="text-xs text-gray-500 mb-3">
                Mention any experience, projects, or achievements not in your resume that you&apos;d like considered for cover letters. This is optional.
              </p>
            </div>
            <textarea
              value={extraExperience}
              onChange={(e) => setExtraExperience(e.target.value)}
              placeholder="e.g., Led a side project that got 1k GitHub stars, volunteered as a mentor at a coding bootcamp..."
              className="w-full min-h-[200px] p-4 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow resize-y"
            />
          </div>
        )}

        {/* Step 3: Cover letter preferences */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Cover Letter Preferences</h3>
              <p className="text-xs text-gray-500 mb-3">
                These preferences will be embedded in your profile so the AI uses them for every cover letter.
              </p>
            </div>

            {/* Tone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tone</label>
              <div className="flex flex-wrap gap-2">
                {TONE_OPTIONS.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => setTonePreference(tone)}
                    className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                      tonePreference === tone
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>

            {/* Length */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Length Preference</label>
              <div className="flex flex-wrap gap-2">
                {LENGTH_OPTIONS.map((len) => (
                  <button
                    key={len}
                    type="button"
                    onClick={() => setLengthPreference(len)}
                    className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                      lengthPreference === len
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {len}
                  </button>
                ))}
              </div>
            </div>

            {/* Highlight skills */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Skills or traits to highlight
              </label>
              <input
                type="text"
                value={highlightSkills}
                onChange={(e) => setHighlightSkills(e.target.value)}
                placeholder="e.g., leadership, React expertise, system design..."
                className="w-full text-sm border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Avoid topics */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Topics to avoid
              </label>
              <input
                type="text"
                value={avoidTopics}
                onChange={(e) => setAvoidTopics(e.target.value)}
                placeholder="e.g., salary expectations, visa status, GPA..."
                className="w-full text-sm border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Sign-off */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Sign-off Preference</label>
              <div className="flex flex-wrap gap-2">
                {[...SIGN_OFF_OPTIONS, "Custom"].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSignOff(opt)}
                    className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                      signOff === opt
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {signOff === "Custom" && (
                <input
                  type="text"
                  value={customSignOff}
                  onChange={(e) => setCustomSignOff(e.target.value)}
                  placeholder="Enter custom sign-off..."
                  className="mt-2 w-full text-sm border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            {/* Extra info */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Anything else we should know?
              </label>
              <textarea
                value={extraInfo}
                onChange={(e) => setExtraInfo(e.target.value)}
                placeholder="e.g., career switch context, specific keywords to include..."
                className="w-full min-h-[80px] p-4 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
            </div>

            {/* Error display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Generating spinner */}
        {generating && (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            <span className="ml-3 text-sm text-gray-500">Generating your profile...</span>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex justify-between">
          <button
            onClick={() => {
              if (step === 1) onClose();
              else setStep(step - 1);
            }}
            className="text-sm text-gray-600 hover:text-gray-800 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
            disabled={generating}
          >
            {step === 1 ? "Cancel" : "Back"}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !canProceedStep1}
              className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-2.5 rounded-xl transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-2.5 rounded-xl transition-colors"
            >
              {generating ? "Generating..." : "Generate Profile"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
