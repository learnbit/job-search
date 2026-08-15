import assert from "node:assert/strict";
import test from "node:test";

import type { CollectedJob } from "../src/collectors/types.js";
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
