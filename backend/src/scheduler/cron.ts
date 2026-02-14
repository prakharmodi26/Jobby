import cron, { type ScheduledTask } from "node-cron";
import { prisma } from "../prisma.js";
import { startRecommendedPull } from "../services/recommendedRunner.js";

let currentTask: ScheduledTask | null = null;

function createCronTask(schedule: string): ScheduledTask {
  return cron.schedule(schedule, async () => {
    console.log("[CRON] Starting recommended pull...");
    try {
      const runId = await startRecommendedPull();
      console.log(`[CRON] Recommended pull started (run #${runId})`);
    } catch (error) {
      console.error("[CRON] Recommended pull failed:", error);
    }
  });
}

async function loadCronSchedule(): Promise<string> {
  let settings = await prisma.settings.findFirst();
  if (!settings) {
    settings = await prisma.settings.create({ data: {} });
  }
  return settings.cronSchedule;
}

export async function startScheduler() {
  const settings = await prisma.settings.findFirst();
  if (!settings) {
    console.log("[CRON] No settings found; scheduler not started");
    return;
  }
  if (!settings.cronEnabled) {
    console.log("[CRON] Scheduler disabled; not starting cron task");
    return;
  }
  const schedule = settings.cronSchedule;
  currentTask = createCronTask(schedule);
  console.log(`[CRON] Scheduler started — recommended pull on schedule: ${schedule}`);
}

export async function restartScheduler() {
  if (currentTask) {
    currentTask.stop();
    console.log("[CRON] Stopped current cron task");
  }

  const settings = await prisma.settings.findFirst();
  if (!settings) {
    console.log("[CRON] No settings found; scheduler not restarted");
    return;
  }
  if (!settings.cronEnabled) {
    console.log("[CRON] Scheduler disabled; cron task not started");
    currentTask = null;
    return;
  }
  const schedule = settings.cronSchedule;
  currentTask = createCronTask(schedule);
  console.log(`[CRON] Scheduler restarted — new schedule: ${schedule}`);
}
