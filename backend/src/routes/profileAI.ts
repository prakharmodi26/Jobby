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
