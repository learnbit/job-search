import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "../src/generated/prisma/client.js";
import {
  JobRepository,
  type PersistedCollectedJobData,
} from "../src/repositories/JobRepository.js";

test("orders jobs with postedAt newest first", async () => {
  const context = repositoryWithRows([
    persistedJob({ externalId: "newer", postedAt: new Date("2026-08-16") }),
    persistedJob({ externalId: "older", postedAt: new Date("2026-08-15") }),
  ]);

  await context.repository.findJobsForList({});

  assert.deepEqual(
    (context.queries[0]?.orderBy as readonly unknown[])[0],
    { postedAt: { sort: "desc", nulls: "last" } },
  );
});

test("orders jobs with real postedAt before jobs with missing postedAt", async () => {
  const context = repositoryWithRows([
    persistedJob({ externalId: "posted", postedAt: new Date("2026-08-15") }),
    persistedJob({ externalId: "unknown", postedAt: null }),
  ]);

  await context.repository.findJobsForList({});

  assert.deepEqual(
    (context.queries[0]?.orderBy as readonly unknown[])[0],
    { postedAt: { sort: "desc", nulls: "last" } },
  );
});

test("orders jobs without postedAt by createdAt descending", async () => {
  const context = repositoryWithRows([
    persistedJob({ externalId: "newer", createdAt: new Date("2026-08-16") }),
    persistedJob({ externalId: "older", createdAt: new Date("2026-08-15") }),
  ]);

  await context.repository.findJobsForList({});

  assert.deepEqual(
    (context.queries[0]?.orderBy as readonly unknown[])[1],
    { createdAt: "desc" },
  );
});

test("uses source and externalId as deterministic ordering tie-breakers", async () => {
  const context = repositoryWithRows([persistedJob()]);

  await context.repository.findJobsForList({});

  assert.deepEqual((context.queries[0]?.orderBy as readonly unknown[]).slice(2), [
    { source: "asc" },
    { externalId: "asc" },
  ]);
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
