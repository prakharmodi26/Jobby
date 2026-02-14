import { Router } from "express";
import { prisma } from "../prisma.js";

export const scoringPatternsRouter = Router();

const VALID_EFFECTS = ["+", "-"];

function validatePattern(body: Record<string, unknown>): string | null {
  if (!body.pattern || typeof body.pattern !== "string" || !body.pattern.trim()) {
    return "pattern is required and must be a non-empty string";
  }
  try {
    new RegExp(body.pattern as string);
  } catch {
    return "pattern must be a valid regular expression";
  }
  if (body.weight !== undefined) {
    const weight = Number(body.weight);
    if (!Number.isFinite(weight) || weight <= 0) {
      return "weight must be a number greater than 0";
    }
  }
  if (body.effect !== undefined && !VALID_EFFECTS.includes(body.effect as string)) {
    return `effect must be one of: ${VALID_EFFECTS.join(", ")}`;
  }
  return null;
}

function pickData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {
    pattern: (body.pattern as string).trim(),
  };
  if (body.weight !== undefined) data.weight = Number(body.weight);
  if (body.effect !== undefined) data.effect = body.effect;
  if (body.countOnce !== undefined) data.countOnce = Boolean(body.countOnce);
  if (body.disqualify !== undefined) data.disqualify = Boolean(body.disqualify);
  return data;
}

// List all patterns
scoringPatternsRouter.get("/", async (_req, res) => {
  try {
    const patterns = await prisma.scoringPattern.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(patterns);
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Create pattern
scoringPatternsRouter.post("/", async (req, res) => {
  try {
    const error = validatePattern(req.body);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const data = pickData(req.body);
    const created = await prisma.scoringPattern.create({ data });
    res.status(201).json(created);
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Update pattern
scoringPatternsRouter.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.scoringPattern.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Pattern not found" });
      return;
    }
    const error = validatePattern(req.body);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const data = pickData(req.body);
    const updated = await prisma.scoringPattern.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Toggle enabled
scoringPatternsRouter.patch("/:id/toggle", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.scoringPattern.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Pattern not found" });
      return;
    }
    const updated = await prisma.scoringPattern.update({
      where: { id },
      data: { enabled: !existing.enabled },
    });
    res.json(updated);
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Delete pattern
scoringPatternsRouter.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.scoringPattern.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Pattern not found" });
      return;
    }
    await prisma.scoringPattern.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
});
