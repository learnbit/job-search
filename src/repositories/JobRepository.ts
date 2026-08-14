import type { CollectedJob } from "../collectors/types.js";
import type { PrismaClient } from "../generated/prisma/client.js";

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

export class JobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async saveMany(jobs: readonly CollectedJob[]): Promise<void> {
    if (jobs.length === 0) {
      return;
    }

    const persistenceData = jobs.map(toJobPersistenceData);
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
  }
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
