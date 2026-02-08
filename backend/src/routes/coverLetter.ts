import { Router } from "express";
import { prisma } from "../prisma.js";

// VT ARC API (requires VT network/VPN and API key)
const VT_ARC_BASE = "https://llm-api.arc.vt.edu/api/v1/chat/completions";
const VT_ARC_KEY = process.env.VT_ARC_KEY || "";
const VT_ARC_MODEL = "gpt-oss-120b";

// Google Gemini API
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
const GEMINI_MODEL = "gemma-3-12b-it"; // Gemma 3 12B Instruct

export const coverLetterRouter = Router();

function buildSystemPrompt(
  userMd: string,
  job: { title: string; company: string; location: string; description: string }
): string {
  return `You are a professional cover letter writer. Generate a tailored cover letter based on the candidate's profile and the job details below.

Output ONLY the cover letter text — no preamble, no markdown formatting, no commentary. Write it as plain text ready to copy-paste.

The candidate's profile may contain special instructions about tone, sign-off, or emphasis. Follow those instructions.

--- CANDIDATE PROFILE ---
${userMd}

--- JOB DETAILS ---
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description:
${job.description}`;
}

// Call VT ARC LLM API
async function callVtArcApi(
  chatMessages: { role: string; content: string }[]
): Promise<string> {
  if (!VT_ARC_KEY) {
    throw new Error("VT_ARC_KEY environment variable is not set. This API requires VT network access and API key.");
  }

  const response = await fetch(VT_ARC_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VT_ARC_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: VT_ARC_MODEL,
      messages: chatMessages,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[CoverLetter] VT ARC API error ${response.status}: ${text}`);
    throw new Error(`VT ARC API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// Call Google Gemini API (Gemma 3 12B)
async function callGeminiApi(
  systemPrompt: string,
  chatMessages: { role: string; content: string }[]
): Promise<string> {
  if (!GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY environment variable is not set.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GOOGLE_API_KEY}`;

  // Convert chat messages to Gemini format
  // Gemini uses "contents" array with "role" (user/model) and "parts"
  const contents: { role: string; parts: { text: string }[] }[] = [];

  for (const msg of chatMessages) {
    if (msg.role === "system") {
      // System instructions handled separately in Gemini
      continue;
    }
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[CoverLetter] Gemini API error ${response.status}: ${text}`);
    throw new Error(`Gemini API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

coverLetterRouter.post("/generate", async (req, res) => {
  const { jobId, messages } = req.body as {
    jobId: number;
    messages?: { role: string; content: string }[];
  };

  if (!jobId) {
    res.status(400).json({ error: "jobId is required" });
    return;
  }

  // Load settings to get selected model
  let settings = await prisma.settings.findFirst();
  if (!settings) {
    settings = await prisma.settings.create({ data: {} });
  }
  const selectedModel = settings.coverLetterModel || "vt-arc";

  // Load profile and check userMd
  const profile = await prisma.profile.findFirst();
  if (!profile || !profile.userMd || profile.userMd.trim() === "") {
    res.status(400).json({
      error: "userMd_empty",
      message: "Please fill in your Cover Letter Profile before generating a cover letter.",
    });
    return;
  }

  // Load job
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const systemPrompt = buildSystemPrompt(profile.userMd, {
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.description,
  });

  // Build conversation
  const chatMessages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  if (messages && messages.length > 0) {
    // Append prior conversation (assistant replies + user follow-ups)
    chatMessages.push(...messages);
  } else {
    // First generation
    chatMessages.push({
      role: "user",
      content: "Generate a cover letter for this job.",
    });
  }

  try {
    let coverLetter: string;

    if (selectedModel === "gemini") {
      coverLetter = await callGeminiApi(systemPrompt, chatMessages);
    } else {
      // Default to VT ARC
      coverLetter = await callVtArcApi(chatMessages);
    }

    res.json({ coverLetter, model: selectedModel });
  } catch (err) {
    console.error("[CoverLetter] Request failed:", err);
    const errorMsg = err instanceof Error ? err.message : "Failed to generate cover letter";
    res.status(502).json({ error: errorMsg });
  }
});
