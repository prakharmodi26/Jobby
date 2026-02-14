import { Router } from "express";
import { prisma } from "../prisma.js";
import { restartScheduler } from "../scheduler/cron.js";

export const settingsRouter = Router();

settingsRouter.get("/", async (_req, res) => {
  let settings = await prisma.settings.findFirst();
  if (!settings) {
    settings = await prisma.settings.create({ data: {} });
  }
  res.json(settings);
});

settingsRouter.put("/", async (req, res) => {
  let settings = await prisma.settings.findFirst();
  if (!settings) {
    settings = await prisma.settings.create({ data: {} });
  }

  const oldCronSchedule = settings.cronSchedule;

  const data: Record<string, unknown> = {};
  const fields = [
    "cronSchedule",
    "cronEnabled",
    "searchNumPages",
    "recommendedNumPages",
    "recommendedExpiryDays",
    "coverLetterModel",
    "minRecommendedScore",
  ];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      data[field] = req.body[field];
    }
  }

  const updated = await prisma.settings.update({
    where: { id: settings.id },
    data,
  });

  // If cron toggles or cronSchedule changed, restart/stop scheduler
  if (
    (data.cronSchedule !== undefined && data.cronSchedule !== oldCronSchedule) ||
    data.cronEnabled !== undefined
  ) {
    await restartScheduler();
  }

  res.json(updated);
});
