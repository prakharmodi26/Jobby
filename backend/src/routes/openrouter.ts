import { Router } from "express";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";

export const openrouterRouter = Router();

interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
    request: string;
    image: string;
  };
  context_length: number | null;
  architecture: {
    modality: string;
    input_modalities: string[];
    output_modalities: string[];
  };
}

// GET /api/openrouter/models — returns only free models
openrouterRouter.get("/models", async (_req, res) => {
  try {
    const response = await fetch(`${OPENROUTER_BASE}/models`, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[OpenRouter] Models API error ${response.status}: ${text}`);
      res.status(response.status).json({ error: `OpenRouter API error: ${response.status}` });
      return;
    }

    const data = await response.json();
    const models: OpenRouterModel[] = data.data || [];

    // Filter for free models: prompt and completion pricing are both "0"
    // Also filter for text-output models only (no image generators)
    const freeModels = models
      .filter((m: OpenRouterModel) => {
        const isFree =
          parseFloat(m.pricing?.prompt || "1") === 0 &&
          parseFloat(m.pricing?.completion || "1") === 0;
        const isTextOutput =
          m.architecture?.output_modalities?.includes("text") ?? true;
        return isFree && isTextOutput;
      })
      .map((m: OpenRouterModel) => ({
        id: m.id,
        name: m.name,
        context_length: m.context_length,
      }))
      .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));

    res.json({ models: freeModels });
  } catch (err) {
    console.error("[OpenRouter] Failed to fetch models:", err);
    res.status(502).json({ error: "Failed to fetch OpenRouter models" });
  }
});
