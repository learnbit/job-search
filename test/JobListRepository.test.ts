import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "../src/generated/prisma/client.js";
import {
  JobRepository,
  type PersistedCollectedJobData,
} from "../src/repositories/JobRepository.js";

test("requests jobs in deterministic newest-first order", async () => {
  const context = repositoryWithRows([
    persistedJob({ externalId: "posted", postedAt: new Date("2026-08-15") }),
    persistedJob({ externalId: "fallback", postedAt: null }),
  ]);

  const jobs = await context.repository.findJobsForList({});

  assert.deepEqual(context.queries[0]?.orderBy, [
    { postedAt: { sort: "desc", nulls: "last" } },
    { createdAt: "desc" },
    { source: "asc" },
    { externalId: "asc" },
  ]);
  assert.deepEqual(
    jobs.map((job) => job.externalId),
    ["posted", "fallback"],
  );
});

test("includes application tracking fields in list items", async () => {
  const appliedAt = new Date("2026-08-14T12:00:00.000Z");
  const context = repositoryWithRows([
    persistedJob({ applicationStatus: "interviewing", appliedAt }),
  ]);

  const jobs = await context.repository.findJobsForList({});

  assert.equal(jobs[0]?.applicationStatus, "interviewing");
  assert.equal(jobs[0]?.appliedAt, appliedAt);
});

test("rejects an invalid persisted application status", async () => {
  const context = repositoryWithRows([
    persistedJob({ applicationStatus: "invalid_status" }),
  ]);

  await assert.rejects(
    context.repository.findJobsForList({}),
    /Invalid persisted application status: invalid_status/,
  );
});

test("uses descriptions for existing filters but omits them from list items", async () => {
  const context = repositoryWithRows([
    persistedJob({
      title: "Frontend Engineer",
      description: "This role uses React.",
    }),
  ]);

  const jobs = await context.repository.findJobsForList({
    titleKeywords: ["frontend"],
    skills: ["react"],
  });

  assert.equal(context.queries[0]?.select.description, true);
  assert.equal(jobs.length, 1);
  assert.equal(Object.hasOwn(jobs[0] ?? {}, "description"), false);
});

test("reuses existing filter semantics and respects the result limit", async () => {
  const context = repositoryWithRows([
    persistedJob({ externalId: "relevant-one" }),
    persistedJob({ externalId: "irrelevant", title: "Backend Engineer" }),
    persistedJob({ externalId: "relevant-two" }),
  ]);

  const jobs = await context.repository.findJobsForList(
    { titleKeywords: ["frontend"], workplaces: ["remote"] },
    1,
  );

  assert.deepEqual(
    jobs.map((job) => job.externalId),
    ["relevant-one"],
  );
});

interface JobListQuery {
  readonly orderBy: unknown;
  readonly skip: number;
  readonly take: number;
  readonly select: Record<string, boolean>;
}

type PersistedJobListRow = PersistedCollectedJobData & {
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
  readonly applicationStatus: string;
  readonly appliedAt: Date | null;
};

function repositoryWithRows(rows: readonly PersistedJobListRow[]): {
  repository: JobRepository;
  queries: JobListQuery[];
} {
  const queries: JobListQuery[] = [];
  const prisma = {
    job: {
      async findMany(query: JobListQuery): Promise<readonly PersistedJobListRow[]> {
        queries.push(query);
        return query.skip === 0 ? rows : [];
      },
    },
  } as unknown as PrismaClient;

  return {
    repository: new JobRepository(prisma),
    queries,
  };
}

function persistedJob(
  overrides: Partial<PersistedJobListRow> = {},
): PersistedJobListRow {
  return {
    source: "greenhouse",
    externalId: "123",
    company: "Example Company",
    title: "Frontend Engineer",
    location: "Remote",
    workplace: "remote",
    url: "https://example.com/jobs/123",
    description: "React and TypeScript",
    postedAt: null,
    updatedAt: null,
    createdAt: new Date("2026-08-15T10:00:00.000Z"),
    lastSeenAt: new Date("2026-08-15T11:00:00.000Z"),
    applicationStatus: "not_applied",
    appliedAt: null,
    ...overrides,
  };
}
