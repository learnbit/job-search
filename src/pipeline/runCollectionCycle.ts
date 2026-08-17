import {
  CollectorOrchestrator,
  configureCollector,
  type ConfiguredCollector,
} from "../collectors/CollectorOrchestrator.js";
import { AshbyCollector } from "../collectors/ashby/AshbyCollector.js";
import { GreenhouseCollector } from "../collectors/greenhouse/GreenhouseCollector.js";
import { LeverCollector } from "../collectors/lever/LeverCollector.js";
import type { CollectedJob } from "../collectors/types.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { filterJobs, type JobFilters } from "../filters/filterJobs.js";
import {
  companies,
  getAshbyBoards,
  getGreenhouseBoards,
  getLeverSites,
} from "../registry/companies.js";
import {
  JobRepository,
  type SaveJobsResult,
} from "../repositories/JobRepository.js";

interface CollectionSource {
  collectAll(): Promise<CollectedJob[]>;
}

interface JobPersistence {
  saveMany(jobs: readonly CollectedJob[]): Promise<SaveJobsResult>;
}

export interface CollectionCycleDependencies {
  readonly collector: CollectionSource;
  readonly jobRepository: JobPersistence;
  readonly filters: JobFilters;
}

export interface CollectionCycleResult {
  readonly collectedCount: number;
  readonly persistedCount: number;
  readonly insertedCount: number;
  readonly updatedCount: number;
  readonly collectedJobs: readonly CollectedJob[];
  readonly newJobs: readonly CollectedJob[];
  readonly filteredJobs: readonly CollectedJob[];
  readonly newFilteredJobs: readonly CollectedJob[];
}

export type CollectionCycleRunner = () => Promise<CollectionCycleResult>;

export async function runCollectionCycle(
  dependencies: CollectionCycleDependencies,
): Promise<CollectionCycleResult> {
  const collectedJobs = await dependencies.collector.collectAll();

  const saveResult = await dependencies.jobRepository.saveMany(collectedJobs);

  const filteredJobs = filterJobs(collectedJobs, dependencies.filters);
  const newFilteredJobs = filterJobs(saveResult.newJobs, dependencies.filters);

  return {
    collectedCount: collectedJobs.length,
    persistedCount: saveResult.processedCount,
    insertedCount: saveResult.insertedCount,
    updatedCount: saveResult.updatedCount,
    collectedJobs,
    newJobs: saveResult.newJobs,
    filteredJobs,
    newFilteredJobs,
  };
}

export function createCollectionCycleRunner(
  prisma: PrismaClient,
  filters: JobFilters,
): CollectionCycleRunner {
  const greenhouseBoards = getGreenhouseBoards(companies);
  const leverSites = getLeverSites(companies);
  const ashbyBoards = getAshbyBoards(companies);
  const registrations: ConfiguredCollector[] = [];

  if (greenhouseBoards.length > 0) {
    registrations.push(
      configureCollector(
        new GreenhouseCollector(globalThis.fetch, console, (jobs) =>
          filterJobs(jobs, filters),
        ),
        greenhouseBoards,
      ),
    );
  }

  if (leverSites.length > 0) {
    registrations.push(configureCollector(new LeverCollector(), leverSites));
  }

  if (ashbyBoards.length > 0) {
    registrations.push(configureCollector(new AshbyCollector(), ashbyBoards));
  }

  const collector = new CollectorOrchestrator(registrations);
  const jobRepository = new JobRepository(prisma);

  return () => runCollectionCycle({ collector, jobRepository, filters });
}
