import type { CollectedJob } from "./collectors/types.js";
import { jobFilters } from "./config/jobFilters.js";
import { prisma } from "./db/prisma.js";
import { createCollectionCycleRunner } from "./pipeline/runCollectionCycle.js";

const runCollectionCycle = createCollectionCycleRunner(prisma, jobFilters);

try {
  const result = await runCollectionCycle();

  printCollectionSummary(result.collectedJobs);

  console.log(`Persisted jobs: ${result.persistedCount}\n`);

  console.log(`Filtered jobs: ${result.filteredJobs.length}\n`);
  console.log(JSON.stringify(result.filteredJobs.map(toReadableJob), null, 2));
} finally {
  await prisma.$disconnect();
}

function printCollectionSummary(jobs: readonly CollectedJob[]): void {
  const jobsBySource = new Map<string, number>();

  for (const job of jobs) {
    jobsBySource.set(job.source, (jobsBySource.get(job.source) ?? 0) + 1);
  }

  console.log(`Collected jobs: ${jobs.length}`);

  for (const [source, count] of jobsBySource) {
    console.log(`- ${source}: ${count}`);
  }

  console.log();
}

function toReadableJob(job: CollectedJob) {
  return {
    source: job.source,
    externalId: job.externalId,
    company: job.company,
    title: job.title,
    location: job.location,
    workplace: job.workplace,
    url: job.url,
    postedAt: job.postedAt,
    updatedAt: job.updatedAt,
  };
}
