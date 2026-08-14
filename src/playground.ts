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
    boardToken: "canonical",
    companyName: "Canonical",
  },
  {
    boardToken: "gleanwork",
    companyName: "Glean",
  },
];

const leverSites: readonly LeverSite[] = [
  {
    site: "relay",
    companyName: "Relay",
  },
  {
    site: "bluelightconsulting",
    companyName: "Bluelight Consulting",
  },
  {
    site: "xsolla",
    companyName: "Xsolla",
  },
  {
    site: "firstup",
    companyName: "Firstup",
  },
];
// Edit these filters for each manual run.
const filters: JobFilters = {
  titleKeywords: ["frontend", "front-end", "web developer", "web frontend"],
  skills: ["react", "typescript"],
  workplaces: ["remote", "unknown"],
};

const placeholder = "replace-me";
const registrations: ConfiguredCollector[] = [];
const activeGreenhouseBoards = greenhouseBoards.filter(
  (board) => board.boardToken.trim() !== "" && board.boardToken !== placeholder
);
const activeLeverSites = leverSites.filter(
  (site) => site.site.trim() !== "" && site.site !== placeholder
);

if (activeGreenhouseBoards.length > 0) {
  registrations.push(
    configureCollector(new GreenhouseCollector(), activeGreenhouseBoards)
  );
}

if (activeLeverSites.length > 0) {
  registrations.push(
    configureCollector(new LeverCollector(), activeLeverSites)
  );
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
    workplace: job.workplace,
    url: job.url,
    postedAt: job.postedAt,
    updatedAt: job.updatedAt,
  };
}
