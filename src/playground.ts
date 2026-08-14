import {
  CollectorOrchestrator,
  configureCollector,
  type ConfiguredCollector,
} from "./collectors/CollectorOrchestrator.js";
import { GreenhouseCollector } from "./collectors/greenhouse/GreenhouseCollector.js";
import type { GreenhouseBoard } from "./collectors/greenhouse/types.js";
import { LeverCollector } from "./collectors/lever/LeverCollector.js";
import type { LeverSite } from "./collectors/lever/types.js";
import type { CollectedJob } from "./collectors/types.js";
import { filterJobs, type JobFilters } from "./filters/filterJobs.js";

// Edit these arrays to enable Greenhouse, Lever, or both.
const greenhouseBoards: readonly GreenhouseBoard[] = [
  {
    boardToken: "replace-me",
    companyName: "Example Greenhouse Company",
  },
];

const leverSites: readonly LeverSite[] = [
  {
    site: "replace-me",
    companyName: "Example Lever Company",
  },
];

// Edit these filters for each manual run. Country is optional.
const filters: JobFilters = {
  keywords: ["react", "frontend"],
  remoteOnly: true,
};

const placeholder = "replace-me";
const registrations: ConfiguredCollector[] = [];
const activeGreenhouseBoards = greenhouseBoards.filter(
  (board) => board.boardToken.trim() !== "" && board.boardToken !== placeholder,
);
const activeLeverSites = leverSites.filter(
  (site) => site.site.trim() !== "" && site.site !== placeholder,
);

if (activeGreenhouseBoards.length > 0) {
  registrations.push(
    configureCollector(new GreenhouseCollector(), activeGreenhouseBoards),
  );
}

if (activeLeverSites.length > 0) {
  registrations.push(configureCollector(new LeverCollector(), activeLeverSites));
}

const orchestrator = new CollectorOrchestrator(registrations);
const collectedJobs = await orchestrator.collectAll();

printCollectionSummary(collectedJobs);

const filteredJobs = filterJobs(collectedJobs, filters);

console.log(`Filtered jobs: ${filteredJobs.length}\n`);
console.log(JSON.stringify(filteredJobs.map(toReadableJob), null, 2));

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
    url: job.url,
    postedAt: job.postedAt,
    updatedAt: job.updatedAt,
  };
}
