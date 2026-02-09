import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const DEFAULT_USERNAME = "defaultjobby";
const DEFAULT_PASSWORD = "jobby1234";

async function main() {
  const existing = await prisma.user.findFirst();
  if (existing) {
    console.log("[Seed] User already exists, skipping.");
    return;
  }

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  await prisma.user.create({
    data: {
      username: DEFAULT_USERNAME,
      passwordHash: hash,
    },
  });
  console.log(
    `[Seed] Created default user (username: ${DEFAULT_USERNAME}, password: ${DEFAULT_PASSWORD})`
  );
  console.log("[Seed] ⚠️  Please change your credentials from Settings after first login!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
