# AI-Powered user.md Generator — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Make with AI" button to the profile page that opens a multi-step wizard pane, collects the user's resume and preferences, sends them to the AI (using the model selected in Settings), and generates a structured user.md file that the user can then edit.

**Architecture:** A new slide-in panel component (`ProfileAIPanel`) with a 3-step wizard. Step 1 collects resume text, Step 2 collects extra experience/projects, Step 3 collects cover letter preferences (tone, length, highlights, sign-off, etc.). On submit, it calls a new backend route `POST /api/profile/generate-usermd` which builds a system prompt containing the internal user.md schema (never shown to the user), sends the user's inputs to the selected AI model, and returns the generated markdown. The frontend then populates the userMd textarea so the user can edit before saving.

**Tech Stack:** Next.js 15 (React), Express.js, Prisma, existing AI model dispatch (VT ARC / Gemini / OpenRouter)

---

## Internal user.md Schema (used in system prompt, never shown to user)

```markdown
# USER PROFILE

## Basic Info
- **Name:**
- **Current role / background (1 line):**
- **Years of experience (approx):**
- **Location:**
- **Work authorization (if relevant):**

## Professional Summary
- **Short summary:**
(Who you are, what you do, and what you're good at)

## Core Skills
- **Primary skills:** (comma-separated)
- **Secondary skills (optional):**

## Experience Highlights
> Only the experiences worth mentioning in a cover letter

### Highlight 1
- **Role / Company:**
- **What you did (1–2 lines):**
- **Key outcome or impact (if any):**

### Highlight 2 (optional)
- **Role / Company:**
- **What you did:**
- **Key outcome:**

### More highlights if needed

## Education
- **Degree / Field / Institution:**

## Notable Projects
- **Project name + 1 line description:**

## Extra Context (optional)
- **Anything else important:**
(career switch, startup experience, gap explanation, etc.)

---

# COVER LETTER INSTRUCTIONS

## Tone & Style
- **Tone preference:** (professional / conversational / confident / neutral)
- **Energy level:** (safe / enthusiastic)
- **First-person style:** (direct "I" statements / slightly formal)

## Length Preference
- **Preferred length:** (short / medium / flexible)

## What to Emphasize
- **Skills or traits to highlight:**
- **Experience to highlight (if any):**

## What to Avoid
- **Topics to avoid:**
(e.g., layoffs, gaps, visa, GPA, salary)

## Keywords & Phrasing
- **Keywords to include (if any):**
- **Words or phrases to avoid (if any):**

## Personalization Level
- **Customization level:**
(light tailoring / strong company-specific)

## Closing Preference
- **Closing style:**
(direct ask / soft interest / open-ended)

## Sign-off Preference
- **Sign-off:** (e.g., Regards / Best / Sincerely / custom)

---
### Any extra information by user.
```

---

## Task 1: Create the backend route for user.md generation

**Files:**
- Create: `backend/src/routes/profileAI.ts`
- Modify: `backend/src/index.ts` (register new route)

**Context:**
- The route reuses the same AI model dispatch pattern from `coverLetter.ts` (callVtArcApi, callGeminiApi, callOpenRouterApi)
- It reads `settings.coverLetterModel` to determine which AI to call
- The internal user.md schema is embedded in the system prompt — the user never sees it
- The route receives the wizard form data and constructs a user prompt from it

**Step 1: Create `backend/src/routes/profileAI.ts`**

```typescript
import { Router } from "express";
import { prisma } from "../prisma.js";

export const profileAIRouter = Router();

// --- Internal user.md schema (embedded in system prompt) ---
const USER_MD_SCHEMA = `# USER PROFILE

## Basic Info
- **Name:**
- **Current role / background (1 line):**
- **Years of experience (approx):**
- **Location:**
- **Work authorization (if relevant):**

## Professional Summary
- **Short summary:**
(Who you are, what you do, and what you're good at)

## Core Skills
- **Primary skills:** (comma-separated)
- **Secondary skills (optional):**

## Experience Highlights
> Only the experiences worth mentioning in a cover letter

### Highlight 1
- **Role / Company:**
- **What you did (1–2 lines):**
- **Key outcome or impact (if any):**

### Highlight 2 (optional)
- **Role / Company:**
- **What you did:**
- **Key outcome:**

### More highlights if needed

## Education
- **Degree / Field / Institution:**

## Notable Projects
- **Project name + 1 line description:**

## Extra Context (optional)
- **Anything else important:**
(career switch, startup experience, gap explanation, etc.)

---

# COVER LETTER INSTRUCTIONS

## Tone & Style
- **Tone preference:** (professional / conversational / confident / neutral)
- **Energy level:** (safe / enthusiastic)
- **First-person style:** (direct "I" statements / slightly formal)

## Length Preference
- **Preferred length:** (short / medium / flexible)

## What to Emphasize
- **Skills or traits to highlight:**
- **Experience to highlight (if any):**

## What to Avoid
- **Topics to avoid:**
(e.g., layoffs, gaps, visa, GPA, salary)

## Keywords & Phrasing
- **Keywords to include (if any):**
- **Words or phrases to avoid (if any):**

## Personalization Level
- **Customization level:**
(light tailoring / strong company-specific)

## Closing Preference
- **Closing style:**
(direct ask / soft interest / open-ended)

## Sign-off Preference
- **Sign-off:** (e.g., Regards / Best / Sincerely / custom)

---
### Any extra information by user.`;

// --- AI API callers (same pattern as coverLetter.ts) ---

const VT_ARC_BASE = "https://llm-api.arc.vt.edu/api/v1/chat/completions";
const VT_ARC_KEY = process.env.VT_ARC_KEY || "";
const VT_ARC_MODEL = "gpt-oss-120b";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
const GEMINI_MODEL = "gemma-3-12b-it";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";

async function callVtArcApi(
  chatMessages: { role: string; content: string }[]
): Promise<string> {
  if (!VT_ARC_KEY) throw new Error("VT_ARC_KEY environment variable is not set.");
  const response = await fetch(VT_ARC_BASE, {
    method: "POST",
    headers: { Authorization: `Bearer ${VT_ARC_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: VT_ARC_MODEL, messages: chatMessages }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`VT ARC API error ${response.status}: ${text}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGeminiApi(
  systemPrompt: string,
  chatMessages: { role: string; content: string }[]
): Promise<string> {
  if (!GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY environment variable is not set.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GOOGLE_API_KEY}`;
  const contents: { role: string; parts: { text: string }[] }[] = [];
  contents.push({ role: "user", parts: [{ text: systemPrompt }] });
  contents.push({
    role: "model",
    parts: [{ text: "I understand. I will generate a structured user.md profile based on the provided information and schema." }],
  });
  for (const msg of chatMessages) {
    if (msg.role === "system") continue;
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 4096 } }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${text}`);
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callOpenRouterApi(
  modelId: string,
  chatMessages: { role: string; content: string }[]
): Promise<string> {
  if (!OPENROUTER_KEY) throw new Error("OPENROUTER_API_KEY environment variable is not set.");
  const response = await fetch(OPENROUTER_BASE, {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENROUTER_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelId, messages: chatMessages, temperature: 0.7, max_tokens: 4096 }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${text}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// --- Build system prompt ---
function buildSystemPrompt(): string {
  return `You are a professional profile writer. Given a user's resume and their preferences, generate a structured Markdown profile document following the EXACT schema below.

OUTPUT RULES:
- Output ONLY the filled-in schema — no preamble, no code fences, no commentary.
- Fill in every field you can infer from the resume. Leave fields blank (with just the label) if no information is available.
- For experience highlights, pick only the 2-4 most impactful/relevant experiences.
- For the COVER LETTER INSTRUCTIONS section, use the user's stated preferences exactly.
- Keep it concise — this document will be used as context for AI cover letter generation.

--- SCHEMA TO FILL ---
${USER_MD_SCHEMA}`;
}

// --- Build user message from wizard data ---
function buildUserMessage(data: {
  resumeText: string;
  extraExperience: string;
  tonePreference: string;
  lengthPreference: string;
  highlightSkills: string;
  avoidTopics: string;
  signOff: string;
  extraInfo: string;
}): string {
  let msg = `Here is my resume:\n\n${data.resumeText}\n\n`;

  if (data.extraExperience.trim()) {
    msg += `Additional experience/projects not in my resume:\n${data.extraExperience}\n\n`;
  }

  msg += `My cover letter preferences:\n`;
  if (data.tonePreference) msg += `- Tone: ${data.tonePreference}\n`;
  if (data.lengthPreference) msg += `- Length: ${data.lengthPreference}\n`;
  if (data.highlightSkills.trim()) msg += `- Highlight: ${data.highlightSkills}\n`;
  if (data.avoidTopics.trim()) msg += `- Avoid: ${data.avoidTopics}\n`;
  if (data.signOff.trim()) msg += `- Sign-off: ${data.signOff}\n`;
  if (data.extraInfo.trim()) msg += `- Additional info: ${data.extraInfo}\n`;

  msg += `\nPlease generate my user.md profile using the schema you were given.`;
  return msg;
}

// --- Route handler ---
profileAIRouter.post("/generate-usermd", async (req, res) => {
  const {
    resumeText,
    extraExperience,
    tonePreference,
    lengthPreference,
    highlightSkills,
    avoidTopics,
    signOff,
    extraInfo,
  } = req.body as {
    resumeText: string;
    extraExperience: string;
    tonePreference: string;
    lengthPreference: string;
    highlightSkills: string;
    avoidTopics: string;
    signOff: string;
    extraInfo: string;
  };

  if (!resumeText || !resumeText.trim()) {
    res.status(400).json({ error: "Resume text is required." });
    return;
  }

  // Load settings to get selected model
  let settings = await prisma.settings.findFirst();
  if (!settings) {
    settings = await prisma.settings.create({ data: {} });
  }
  const selectedModel = settings.coverLetterModel || "vt-arc";

  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage({
    resumeText,
    extraExperience: extraExperience || "",
    tonePreference: tonePreference || "",
    lengthPreference: lengthPreference || "",
    highlightSkills: highlightSkills || "",
    avoidTopics: avoidTopics || "",
    signOff: signOff || "",
    extraInfo: extraInfo || "",
  });

  const chatMessages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  try {
    let generatedMd: string;

    if (selectedModel === "gemini" || selectedModel === "gemma3-12b") {
      generatedMd = await callGeminiApi(systemPrompt, chatMessages);
    } else if (selectedModel.startsWith("openrouter:")) {
      const openRouterModelId = selectedModel.replace("openrouter:", "");
      generatedMd = await callOpenRouterApi(openRouterModelId, chatMessages);
    } else {
      generatedMd = await callVtArcApi(chatMessages);
    }

    res.json({ userMd: generatedMd, model: selectedModel });
  } catch (err) {
    console.error("[ProfileAI] Generation failed:", err);
    const errorMsg = err instanceof Error ? err.message : "Failed to generate profile";
    res.status(502).json({ error: errorMsg });
  }
});
```

**Step 2: Register route in `backend/src/index.ts`**

Add after the existing imports (around line 18):
```typescript
import { profileAIRouter } from "./routes/profileAI.js";
```

Add after the existing route registrations (around line 57):
```typescript
app.use("/api/profile", authMiddleware, profileAIRouter);
```

Note: This mounts profileAIRouter alongside profileRouter both at `/api/profile`. The profileRouter handles `GET /` and `PUT /`, while profileAIRouter handles `POST /generate-usermd`. There's no conflict because the HTTP methods and paths differ.

**Step 3: Commit**

```bash
git add backend/src/routes/profileAI.ts backend/src/index.ts
git commit -m "feat: add backend route for AI-powered user.md generation"
```

---

## Task 2: Create the ProfileAIPanel component (multi-step wizard)

**Files:**
- Create: `frontend/src/components/profile/ProfileAIPanel.tsx`

**Context:**
- This component follows the same slide-in panel pattern as `CoverLetterPanel.tsx`
- 3-step wizard: (1) Resume paste, (2) Extra experience/projects, (3) Cover letter preferences
- On final submit, calls `POST /api/profile/generate-usermd` with all collected data
- On success, calls `onGenerated(userMd)` callback so the parent page can populate the textarea
- Uses the same animation pattern (translate-x, fixed positioning)

**Step 1: Create `frontend/src/components/profile/ProfileAIPanel.tsx`**

```tsx
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
                {s < step ? "✓" : s}
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
                Copy and paste the text content of your resume. We'll use this to build your cover letter profile.
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
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Additional Experience & Projects</h3>
              <p className="text-xs text-gray-500 mb-3">
                Mention any experience, projects, or achievements not in your resume that you'd like considered for cover letters. This is optional.
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
```

**Step 2: Commit**

```bash
git add frontend/src/components/profile/ProfileAIPanel.tsx
git commit -m "feat: add ProfileAIPanel multi-step wizard component"
```

---

## Task 3: Add "Make with AI" button to the profile page and wire up the panel

**Files:**
- Modify: `frontend/src/app/(app)/profile/page.tsx`

**Context:**
- Add state for showing/hiding the ProfileAIPanel
- Add a "Make with AI" button next to the existing "Upload .md file" and "Preview" buttons in the Cover Letter Profile section (lines 523-548)
- When the panel generates a user.md, populate the `userMd` state so the user sees it in the textarea and can edit before saving
- Import the new `ProfileAIPanel` component

**Step 1: Add import at top of file**

After the existing imports (line 4-5), add:
```typescript
import { ProfileAIPanel } from "@/components/profile/ProfileAIPanel";
```

**Step 2: Add state variable**

After `const [showMdPreview, setShowMdPreview] = useState(false);` (line 198), add:
```typescript
const [showAIPanel, setShowAIPanel] = useState(false);
```

**Step 3: Add "Make with AI" button**

In the Cover Letter Profile section (around line 523), add a new button in the `<div className="flex items-center gap-3 mb-2">` row, after the "Preview" button (line 548):

```tsx
<button
  type="button"
  onClick={() => setShowAIPanel(true)}
  className="text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors"
>
  ✨ Make with AI
</button>
```

**Step 4: Render the ProfileAIPanel**

At the end of the component return, just before the final closing `</div>` (around line 620), add:

```tsx
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
```

**Step 5: Commit**

```bash
git add frontend/src/app/\(app\)/profile/page.tsx
git commit -m "feat: add Make with AI button to profile page, wire up ProfileAIPanel"
```

---

## Task 4: Manual end-to-end verification

**No code changes — verification only.**

**Steps to verify:**

1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Go to Profile page → scroll to "Cover Letter Profile (user.md)" section
4. Verify "Make with AI" button appears alongside "Upload .md file" and "Preview" buttons
5. Click "Make with AI" — panel should slide in from left
6. Step 1: Paste sample resume text → "Next" button should enable
7. Step 2: Optionally add extra experience → click "Next"
8. Step 3: Select tone, length, sign-off, etc. → click "Generate Profile"
9. Loading spinner should appear while AI generates
10. On success: panel should close, userMd textarea should be populated with generated markdown
11. User can now edit the markdown and click "Save Profile"
12. Verify the generated markdown follows the internal schema structure
