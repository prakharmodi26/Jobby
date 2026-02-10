import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const DEMO_USERNAME = "demo";
const DEMO_PASSWORD = "demo1234";

async function main() {
  // Check if demo user already exists
  const existing = await prisma.user.findUnique({
    where: { username: DEMO_USERNAME },
  });

  if (existing) {
    console.log("[Seed-Demo] Demo user already exists, skipping.");
    return;
  }

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await prisma.user.create({
    data: {
      username: DEMO_USERNAME,
      passwordHash: hash,
      isDemo: true,
    },
  });

  console.log(
    `[Seed-Demo] Created demo user (username: ${DEMO_USERNAME}, password: ${DEMO_PASSWORD})`
  );
  console.log(
    "[Seed-Demo] Demo user can browse jobs but cannot use AI, search, or modify settings."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
