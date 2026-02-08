import { Router } from "express";
import { prisma } from "../prisma.js";

const VT_ARC_BASE = "https://llm-api.arc.vt.edu/api/v1/chat/completions";
const VT_ARC_KEY = process.env.VT_ARC_KEY || "";
const MODEL = "gpt-oss-120b";

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

coverLetterRouter.post("/generate", async (req, res) => {
  const { jobId, messages } = req.body as {
    jobId: number;
    messages?: { role: string; content: string }[];
  };

  if (!jobId) {
    res.status(400).json({ error: "jobId is required" });
    return;
  }

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
    const response = await fetch(VT_ARC_BASE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VT_ARC_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: chatMessages,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[CoverLetter] VT ARC API error ${response.status}: ${text}`);
      res.status(502).json({ error: "LLM API error", details: text });
      return;
    }

    const data = await response.json();
    const coverLetter = data.choices?.[0]?.message?.content ?? "";

    res.json({ coverLetter });
  } catch (err) {
    console.error("[CoverLetter] Request failed:", err);
    res.status(500).json({ error: "Failed to generate cover letter" });
  }
});
