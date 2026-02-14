import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

export const recommendedQueriesRouter = Router();

const VALID_DATE_POSTED = ["all", "today", "3days", "week", "month"];

function validateQuery(body: Record<string, unknown>): string | null {
  if (!body.query || typeof body.query !== "string" || !body.query.trim()) {
    return "query is required and must be a non-empty string";
  }
  if (body.page !== undefined) {
    const page = Number(body.page);
    if (!Number.isInteger(page) || page < 1 || page > 50) {
      return "page must be an integer between 1 and 50";
    }
  }
  if (body.numPages !== undefined) {
    const numPages = Number(body.numPages);
    if (!Number.isInteger(numPages) || numPages < 1 || numPages > 50) {
      return "numPages must be an integer between 1 and 50";
    }
  }
  if (
    body.datePosted !== undefined &&
    !VALID_DATE_POSTED.includes(body.datePosted as string)
  ) {
    return `datePosted must be one of: ${VALID_DATE_POSTED.join(", ")}`;
  }
  return null;
}

function pickData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {
    query: (body.query as string).trim(),
  };
  if (body.page !== undefined) data.page = Number(body.page);
  if (body.numPages !== undefined) data.numPages = Number(body.numPages);
  if (body.country !== undefined) data.country = body.country;
  if (body.language !== undefined) data.language = body.language;
  if (body.datePosted !== undefined) data.datePosted = body.datePosted;
  if (body.workFromHome !== undefined) data.workFromHome = Boolean(body.workFromHome);
  if (body.employmentTypes !== undefined) data.employmentTypes = body.employmentTypes;
  if (body.jobRequirements !== undefined) data.jobRequirements = body.jobRequirements;
  if (body.radius !== undefined)
    data.radius = body.radius === null ? null : Number(body.radius);
  if (body.excludeJobPublishers !== undefined)
    data.excludeJobPublishers = body.excludeJobPublishers;
  return data;
}

// List all queries
recommendedQueriesRouter.get("/", async (_req, res) => {
  try {
    const queries = await prisma.recommendedQuery.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(queries);
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Create query
recommendedQueriesRouter.post("/", async (req, res) => {
  try {
    const error = validateQuery(req.body);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const data = pickData(req.body) as Prisma.RecommendedQueryCreateInput;
    const created = await prisma.recommendedQuery.create({ data });
    res.status(201).json(created);
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Update query
recommendedQueriesRouter.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.recommendedQuery.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Query not found" });
      return;
    }
    const error = validateQuery(req.body);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const data = pickData(req.body);
    const updated = await prisma.recommendedQuery.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Toggle enabled
recommendedQueriesRouter.patch("/:id/toggle", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.recommendedQuery.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Query not found" });
      return;
    }
    const updated = await prisma.recommendedQuery.update({
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

// Delete query
recommendedQueriesRouter.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.recommendedQuery.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Query not found" });
      return;
    }
    await prisma.recommendedQuery.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
});
