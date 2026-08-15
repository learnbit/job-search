import assert from "node:assert/strict";
import test from "node:test";

import type { CollectedJob } from "../src/collectors/types.js";
import type { ApplicationStatus } from "../src/domain/applicationStatus.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import {
  classifyJobsByExistingIdentities,
  JobRepository,
  toJobPersistenceData,
} from "../src/repositories/JobRepository.js";

test("maps a CollectedJob to Prisma persistence data", () => {
  const collectedJob = job({
    postedAt: "2026-08-01T10:30:00.000Z",
    updatedAt: "2026-08-02T12:45:00+02:00",
  });

  assert.deepEqual(toJobPersistenceData(collectedJob), {
    source: "greenhouse",
    externalId: "123",
    company: "Example Company",
    title: "Frontend Engineer",
    location: "Remote",
    workplace: "remote",
    url: "https://example.com/jobs/123",
    description: "Build web applications with TypeScript.",
    postedAt: new Date("2026-08-01T10:30:00.000Z"),
    updatedAt: new Date("2026-08-02T12:45:00+02:00"),
  });
});

test("preserves null timestamps", () => {
  const persistenceData = toJobPersistenceData(
    job({ postedAt: null, updatedAt: null }),
  );

  assert.equal(persistenceData.postedAt, null);
  assert.equal(persistenceData.updatedAt, null);
});

test("rejects invalid timestamps", () => {
  assert.throws(
    () => toJobPersistenceData(job({ postedAt: "not-a-date" })),
    /Invalid postedAt timestamp for greenhouse\/123: not-a-date/,
  );
});

test("saveMany does nothing for empty input", async () => {
  let transactionCalled = false;
  const prisma = {
    async $transaction(): Promise<never[]> {
      transactionCalled = true;
      return [];
    },
  } as unknown as PrismaClient;
  const repository = new JobRepository(prisma);

  const result = await repository.saveMany([]);

  assert.equal(transactionCalled, false);
  assert.deepEqual(result, {
    processedCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    newJobs: [],
  });
});

test("new persisted jobs rely on the database application defaults", async () => {
  let createData: Record<string, unknown> | undefined;
  const prisma = {
    job: {
      async findMany(): Promise<never[]> {
        return [];
      },
      async upsert(args: {
        create: Record<string, unknown>;
      }): Promise<void> {
        createData = args.create;
      },
    },
    async $transaction(operations: readonly Promise<unknown>[]): Promise<unknown[]> {
      return Promise.all(operations);
    },
  } as unknown as PrismaClient;

  await new JobRepository(prisma).saveMany([job()]);

  assert.ok(createData);
  assert.equal(Object.hasOwn(createData, "applicationStatus"), false);
  assert.equal(Object.hasOwn(createData, "appliedAt"), false);
});

test("marking a job applied sets appliedAt", async () => {
  const appliedAt = new Date("2026-08-15T12:00:00.000Z");
  const context = trackingRepository("not_applied", null, () => appliedAt);

  const result = await context.repository.updateApplicationStatus(
    identity,
    "applied",
  );

  assert.deepEqual(result, { applicationStatus: "applied", appliedAt });
});

test("moving from applied to interviewing preserves appliedAt", async () => {
  const appliedAt = new Date("2026-08-14T12:00:00.000Z");
  const context = trackingRepository("applied", appliedAt, () => {
    throw new Error("now should not be used");
  });

  const result = await context.repository.updateApplicationStatus(
    identity,
    "interviewing",
  );

  assert.deepEqual(result, { applicationStatus: "interviewing", appliedAt });
});

test("moving from interviewing to rejected preserves appliedAt", async () => {
  const appliedAt = new Date("2026-08-14T12:00:00.000Z");
  const context = trackingRepository("interviewing", appliedAt, () => {
    throw new Error("now should not be used");
  });

  const result = await context.repository.updateApplicationStatus(
    identity,
    "rejected",
  );

  assert.deepEqual(result, { applicationStatus: "rejected", appliedAt });
});

test("moving to not_applied clears appliedAt", async () => {
  const context = trackingRepository(
    "interviewing",
    new Date("2026-08-14T12:00:00.000Z"),
  );

  const result = await context.repository.updateApplicationStatus(
    identity,
    "not_applied",
  );

  assert.deepEqual(result, {
    applicationStatus: "not_applied",
    appliedAt: null,
  });
});

test("reapplying after not_applied creates a new appliedAt", async () => {
  const firstAppliedAt = new Date("2026-08-14T12:00:00.000Z");
  const secondAppliedAt = new Date("2026-08-15T12:00:00.000Z");
  const context = trackingRepository("applied", firstAppliedAt, () =>
    secondAppliedAt,
  );

  await context.repository.updateApplicationStatus(identity, "not_applied");
  const result = await context.repository.updateApplicationStatus(
    identity,
    "applied",
  );

  assert.deepEqual(result, {
    applicationStatus: "applied",
    appliedAt: secondAppliedAt,
  });
});

test("application tracking can be read by source identity", async () => {
  const appliedAt = new Date("2026-08-14T12:00:00.000Z");
  const context = trackingRepository("offer", appliedAt);

  const result = await context.repository.findApplicationTracking(identity);

  assert.deepEqual(result, { applicationStatus: "offer", appliedAt });
});

test("invalid application statuses cannot be persisted", async () => {
  let databaseCalled = false;
  const prisma = {
    job: {
      async findUnique(): Promise<null> {
        databaseCalled = true;
        return null;
      },
    },
  } as unknown as PrismaClient;
  const repository = new JobRepository(prisma);

  await assert.rejects(
    repository.updateApplicationStatus(
      identity,
      "withdrawn" as ApplicationStatus,
    ),
    /Invalid application status: withdrawn/,
  );
  assert.equal(databaseCalled, false);
});

test("collection upserts preserve application status and appliedAt", async () => {
  const appliedAt = new Date("2026-08-14T12:00:00.000Z");
  const persistedJob: Record<string, unknown> = {
    title: "Original collector title",
    applicationStatus: "interviewing",
    appliedAt,
  };
  const prisma = {
    job: {
      async findMany(): Promise<Array<typeof identity>> {
        return [identity];
      },
      async upsert(args: {
        update: Record<string, unknown>;
      }): Promise<void> {
        Object.assign(persistedJob, args.update);
      },
    },
    async $transaction(operations: readonly Promise<unknown>[]): Promise<unknown[]> {
      return Promise.all(operations);
    },
  } as unknown as PrismaClient;

  await new JobRepository(prisma).saveMany([
    job({ title: "Updated collector title" }),
  ]);

  assert.equal(persistedJob.title, "Updated collector title");
  assert.equal(persistedJob.applicationStatus, "interviewing");
  assert.equal(persistedJob.appliedAt, appliedAt);
});

test("classifies one previously unseen job as inserted and new", () => {
  const unseenJob = job();

  const result = classifyJobsByExistingIdentities([unseenJob], []);

  assert.equal(result.processedCount, 1);
  assert.equal(result.insertedCount, 1);
  assert.equal(result.updatedCount, 0);
  assert.deepEqual(result.newJobs, [unseenJob]);
});

test("classifies one existing job as updated and not new", () => {
  const existingJob = job();

  const result = classifyJobsByExistingIdentities([existingJob], [
    { source: "greenhouse", externalId: "123" },
  ]);

  assert.equal(result.processedCount, 1);
  assert.equal(result.insertedCount, 0);
  assert.equal(result.updatedCount, 1);
  assert.deepEqual(result.newJobs, []);
});

test("classifies a mixture of existing and new jobs", () => {
  const existingJob = job({ externalId: "existing" });
  const newJob = job({ externalId: "new" });

  const result = classifyJobsByExistingIdentities(
    [existingJob, newJob],
    [{ source: "greenhouse", externalId: "existing" }],
  );

  assert.equal(result.processedCount, 2);
  assert.equal(result.insertedCount, 1);
  assert.equal(result.updatedCount, 1);
  assert.deepEqual(result.newJobs, [newJob]);
});

test("existing job field changes do not make the job new", () => {
  const changedJob = job({
    title: "A newly changed title",
    location: "A newly changed location",
    description: "A newly changed description",
    updatedAt: "2026-08-15T00:00:00.000Z",
  });

  const result = classifyJobsByExistingIdentities([changedJob], [
    { source: "greenhouse", externalId: "123" },
  ]);

  assert.equal(result.insertedCount, 0);
  assert.equal(result.updatedCount, 1);
  assert.deepEqual(result.newJobs, []);
});

test("newJobs preserves the original CollectedJob object", () => {
  const originalJob = job({
    title: "Original title",
    description: "Original description",
  });

  const result = classifyJobsByExistingIdentities([originalJob], []);

  assert.strictEqual(result.newJobs[0], originalJob);
  assert.deepEqual(result.newJobs[0], originalJob);
});

test("classification does not mutate incoming arrays or jobs", () => {
  const jobs = [job({ externalId: "one" }), job({ externalId: "two" })];
  const existingIdentities = [
    { source: "greenhouse", externalId: "one" },
  ];
  const jobsSnapshot = structuredClone(jobs);
  const identitiesSnapshot = structuredClone(existingIdentities);

  classifyJobsByExistingIdentities(jobs, existingIdentities);

  assert.deepEqual(jobs, jobsSnapshot);
  assert.deepEqual(existingIdentities, identitiesSnapshot);
});

test("does not double-count duplicate identities in one incoming batch", () => {
  const firstVersion = job({ title: "First version" });
  const latestVersion = job({ title: "Latest version" });

  const result = classifyJobsByExistingIdentities(
    [firstVersion, latestVersion],
    [],
  );

  assert.equal(result.processedCount, 1);
  assert.equal(result.insertedCount, 1);
  assert.equal(result.updatedCount, 0);
  assert.deepEqual(result.newJobs, [latestVersion]);
  assert.deepEqual(result.jobsToPersist, [latestVersion]);
});

test("treats the same externalId on different sources as separate identities", () => {
  const greenhouseJob = job({ source: "greenhouse", externalId: "shared" });
  const leverJob = job({ source: "lever", externalId: "shared" });

  const result = classifyJobsByExistingIdentities(
    [greenhouseJob, leverJob],
    [],
  );

  assert.equal(result.processedCount, 2);
  assert.equal(result.insertedCount, 2);
  assert.deepEqual(result.newJobs, [greenhouseJob, leverJob]);
});

test("treats different externalIds from the same source as separate identities", () => {
  const firstJob = job({ externalId: "one" });
  const secondJob = job({ externalId: "two" });

  const result = classifyJobsByExistingIdentities([firstJob, secondJob], []);

  assert.equal(result.processedCount, 2);
  assert.equal(result.insertedCount, 2);
  assert.deepEqual(result.newJobs, [firstJob, secondJob]);
});

function job(overrides: Partial<CollectedJob> = {}): CollectedJob {
  return {
    source: "greenhouse",
    externalId: "123",
    company: "Example Company",
    title: "Frontend Engineer",
    location: "Remote",
    workplace: "remote",
    url: "https://example.com/jobs/123",
    description: "Build web applications with TypeScript.",
    postedAt: null,
    updatedAt: null,
    ...overrides,
  };
}

const identity = {
  source: "greenhouse",
  externalId: "123",
} as const;

function trackingRepository(
  initialStatus: ApplicationStatus,
  initialAppliedAt: Date | null,
  now: () => Date = () => new Date("2026-08-15T12:00:00.000Z"),
): { repository: JobRepository } {
  const state: {
    applicationStatus: ApplicationStatus;
    appliedAt: Date | null;
  } = {
    applicationStatus: initialStatus,
    appliedAt: initialAppliedAt,
  };
  const prisma = {
    job: {
      async findUnique(): Promise<typeof state> {
        return { ...state };
      },
      async update(args: {
        data: {
          applicationStatus: ApplicationStatus;
          appliedAt: Date | null;
        };
      }): Promise<typeof state> {
        state.applicationStatus = args.data.applicationStatus;
        state.appliedAt = args.data.appliedAt;
        return { ...state };
      },
    },
  } as unknown as PrismaClient;

  return { repository: new JobRepository(prisma, now) };
}
