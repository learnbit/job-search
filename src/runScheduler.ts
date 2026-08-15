import "dotenv/config";

import { jobFilters } from "./config/jobFilters.js";
import { prisma } from "./db/prisma.js";
import { deliverTelegramAlerts } from "./notifications/telegram/deliverTelegramAlerts.js";
import { TelegramNotifier } from "./notifications/telegram/TelegramNotifier.js";
import { parseTelegramConfig } from "./notifications/telegram/telegramConfig.js";
import { createCollectionCycleRunner } from "./pipeline/runCollectionCycle.js";
import { JobRepository } from "./repositories/JobRepository.js";
import {
  parseCollectionIntervalMinutes,
  Scheduler,
} from "./scheduler/Scheduler.js";

const intervalMinutes = parseCollectionIntervalMinutes(
  process.env.COLLECT_INTERVAL_MINUTES,
);
const telegramConfig = parseTelegramConfig(process.env);
const runCollectionCycle = createCollectionCycleRunner(prisma, jobFilters);
const jobRepository = new JobRepository(prisma);
const telegramNotifier = new TelegramNotifier(telegramConfig);

const runScheduledCycle = async () => {
  const result = await runCollectionCycle();
  const delivery = await deliverTelegramAlerts({
    jobRepository,
    notifier: telegramNotifier,
    filters: jobFilters,
  });

  console.log(
    `Telegram alerts: ${delivery.sentCount} sent, ${delivery.failedCount} failed`,
  );

  return result;
};

const scheduler = new Scheduler({
  intervalMinutes,
  runCollectionCycle: runScheduledCycle,
});

function requestShutdown(signal: NodeJS.Signals): void {
  console.log(`\n${signal} received; finishing the active cycle before shutdown.`);
  scheduler.requestShutdown();
}

process.once("SIGINT", requestShutdown);
process.once("SIGTERM", requestShutdown);

try {
  await scheduler.run();
} finally {
  process.removeListener("SIGINT", requestShutdown);
  process.removeListener("SIGTERM", requestShutdown);
  await prisma.$disconnect();
  console.log("Scheduler stopped");
}
