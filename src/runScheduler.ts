import "dotenv/config";

import { jobFilters } from "./config/jobFilters.js";
import { prisma } from "./db/prisma.js";
import { createCollectionCycleRunner } from "./pipeline/runCollectionCycle.js";
import {
  parseCollectionIntervalMinutes,
  Scheduler,
} from "./scheduler/Scheduler.js";

const intervalMinutes = parseCollectionIntervalMinutes(
  process.env.COLLECT_INTERVAL_MINUTES,
);
const scheduler = new Scheduler({
  intervalMinutes,
  runCollectionCycle: createCollectionCycleRunner(prisma, jobFilters),
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
