import assert from "node:assert/strict";
import test from "node:test";

import type { CollectedJob } from "../src/collectors/types.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import {
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

  await repository.saveMany([]);

  assert.equal(transactionCalled, false);
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
