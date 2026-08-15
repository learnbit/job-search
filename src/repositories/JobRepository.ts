import type { CollectedJob } from "../collectors/types.js";
import type { PrismaClient } from "../generated/prisma/client.js";

const IDENTITY_QUERY_BATCH_SIZE = 500;

export interface JobIdentity {
  readonly source: string;
  readonly externalId: string;
}

export interface SaveJobsResult {
  readonly processedCount: number;
  readonly insertedCount: number;
  readonly updatedCount: number;
  readonly newJobs: readonly CollectedJob[];
}

export interface JobPersistencePlan extends SaveJobsResult {
  readonly jobsToPersist: readonly CollectedJob[];
}

export interface JobPersistenceData {
  source: string;
  externalId: string;
  company: string;
  title: string;
  location: string | null;
  workplace: string;
  url: string;
  description: string | null;
  postedAt: Date | null;
  updatedAt: Date | null;
}

export function toJobPersistenceData(job: CollectedJob): JobPersistenceData {
  return {
    source: job.source,
    externalId: job.externalId,
    company: job.company,
    title: job.title,
    location: job.location,
    workplace: job.workplace,
    url: job.url,
    description: job.description,
    postedAt: toOptionalDate(job.postedAt, "postedAt", job),
    updatedAt: toOptionalDate(job.updatedAt, "updatedAt", job),
  };
}

export function classifyJobsByExistingIdentities(
  jobs: readonly CollectedJob[],
  existingIdentities: readonly JobIdentity[],
): JobPersistencePlan {
  const jobsToPersist = uniqueJobsByIdentity(jobs);
  const existingIdentityKeys = new Set(existingIdentities.map(identityKey));
  const newJobs = jobsToPersist.filter(
    (job) => !existingIdentityKeys.has(identityKey(job)),
  );

  return {
    processedCount: jobsToPersist.length,
    insertedCount: newJobs.length,
    updatedCount: jobsToPersist.length - newJobs.length,
    newJobs,
    jobsToPersist,
  };
}

export class JobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async saveMany(jobs: readonly CollectedJob[]): Promise<SaveJobsResult> {
    if (jobs.length === 0) {
      return {
        processedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        newJobs: [],
      };
    }

    const uniqueJobs = uniqueJobsByIdentity(jobs);
    const persistenceData = uniqueJobs.map(toJobPersistenceData);
    const existingIdentities = await this.findExistingIdentities(uniqueJobs);
    const plan = classifyJobsByExistingIdentities(uniqueJobs, existingIdentities);
    const seenAt = new Date();

    await this.prisma.$transaction(
      persistenceData.map((job) =>
        this.prisma.job.upsert({
          where: {
            source_externalId: {
              source: job.source,
              externalId: job.externalId,
            },
          },
          create: {
            ...job,
            createdAt: seenAt,
            lastSeenAt: seenAt,
          },
          update: {
            company: job.company,
            title: job.title,
            location: job.location,
            workplace: job.workplace,
            url: job.url,
            description: job.description,
            postedAt: job.postedAt,
            updatedAt: job.updatedAt,
            lastSeenAt: seenAt,
          },
        }),
      ),
    );

    return {
      processedCount: plan.processedCount,
      insertedCount: plan.insertedCount,
      updatedCount: plan.updatedCount,
      newJobs: plan.newJobs,
    };
  }

  private async findExistingIdentities(
    jobs: readonly CollectedJob[],
  ): Promise<JobIdentity[]> {
    const queries: Promise<JobIdentity[]>[] = [];

    for (let index = 0; index < jobs.length; index += IDENTITY_QUERY_BATCH_SIZE) {
      const batch = jobs.slice(index, index + IDENTITY_QUERY_BATCH_SIZE);

      queries.push(
        this.prisma.job.findMany({
          where: {
            OR: batch.map((job) => ({
              source: job.source,
              externalId: job.externalId,
            })),
          },
          select: {
            source: true,
            externalId: true,
          },
        }),
      );
    }

    return (await Promise.all(queries)).flat();
  }
}

function identityKey(identity: JobIdentity): string {
  return JSON.stringify([identity.source, identity.externalId]);
}

function uniqueJobsByIdentity(
  jobs: readonly CollectedJob[],
): CollectedJob[] {
  const jobsByIdentity = new Map<string, CollectedJob>();

  for (const job of jobs) {
    jobsByIdentity.set(identityKey(job), job);
  }

  return [...jobsByIdentity.values()];
}

function toOptionalDate(
  value: string | null,
  field: "postedAt" | "updatedAt",
  job: Pick<CollectedJob, "source" | "externalId">,
): Date | null {
  if (value === null) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      `Invalid ${field} timestamp for ${job.source}/${job.externalId}: ${value}`,
    );
  }

  return date;
}
