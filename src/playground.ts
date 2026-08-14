import {
  CollectorOrchestrator,
  configureCollector,
  type ConfiguredCollector,
} from "./collectors/CollectorOrchestrator.js";
import { GreenhouseCollector } from "./collectors/greenhouse/GreenhouseCollector.js";
import { LeverCollector } from "./collectors/lever/LeverCollector.js";
import type { CollectedJob } from "./collectors/types.js";
import { prisma } from "./db/prisma.js";
import { filterJobs, type JobFilters } from "./filters/filterJobs.js";
import {
  companies,
  getGreenhouseBoards,
  getLeverSites,
} from "./registry/companies.js";
import { JobRepository } from "./repositories/JobRepository.js";

const greenhouseBoards = getGreenhouseBoards(companies);
const leverSites = getLeverSites(companies);

// Edit these filters for each manual run.
const filters: JobFilters = {
  titleKeywords: ["frontend", "front-end", "web developer", "web frontend"],
  skills: ["react", "typescript"],
  workplaces: ["remote", "unknown"],
};

const registrations: ConfiguredCollector[] = [];

if (greenhouseBoards.length > 0) {
  registrations.push(
    configureCollector(new GreenhouseCollector(), greenhouseBoards),
  );
}

if (leverSites.length > 0) {
  registrations.push(
    configureCollector(new LeverCollector(), leverSites),
  );
}

const orchestrator = new CollectorOrchestrator(registrations);
const jobRepository = new JobRepository(prisma);

try {
  const collectedJobs = await orchestrator.collectAll();

  printCollectionSummary(collectedJobs);

  await jobRepository.saveMany(collectedJobs);
  console.log(`Persisted jobs: ${collectedJobs.length}\n`);

  const filteredJobs = filterJobs(collectedJobs, filters);

  console.log(`Filtered jobs: ${filteredJobs.length}\n`);
  console.log(JSON.stringify(filteredJobs.map(toReadableJob), null, 2));
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
