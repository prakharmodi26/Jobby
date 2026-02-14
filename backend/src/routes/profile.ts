import { Router } from "express";
import { prisma } from "../prisma.js";

export const profileRouter = Router();

profileRouter.get("/", async (_req, res) => {
  let profile = await prisma.profile.findFirst();
  if (!profile) {
    profile = await prisma.profile.create({ data: {} });
  }
  res.json(profile);
});

profileRouter.put("/", async (req, res) => {
  let profile = await prisma.profile.findFirst();
  if (!profile) {
    profile = await prisma.profile.create({ data: {} });
  }

  const data: Record<string, unknown> = {};
  const fields = ["userMd"];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      data[field] = req.body[field];
    }
  }

  const updated = await prisma.profile.update({
    where: { id: profile.id },
    data,
  });

  res.json(updated);
});
