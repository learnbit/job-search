import assert from "node:assert/strict";
import test from "node:test";

import type { CollectedJob } from "../src/collectors/types.js";
import { runCollectionCycle } from "../src/pipeline/runCollectionCycle.js";

test("returns new jobs and independently filters all and new jobs", async () => {
  const events: string[] = [];
  const existingRelevantJob = job({
    externalId: "existing-relevant",
    title: "Frontend Engineer",
  });
  const newRelevantJob = job({
    externalId: "new-relevant",
    title: "Frontend Developer",
  });
  const newIrrelevantJob = job({
    externalId: "new-irrelevant",
    title: "Backend Engineer",
  });
  const jobs = [existingRelevantJob, newRelevantJob, newIrrelevantJob];
  let persistedJobs: readonly CollectedJob[] = [];

  const result = await runCollectionCycle({
    collector: {
      async collectAll() {
        events.push("collect");
        return jobs;
      },
    },
    jobRepository: {
      async saveMany(receivedJobs) {
        events.push("persist");
        persistedJobs = receivedJobs;
        return {
          processedCount: 3,
          insertedCount: 2,
          updatedCount: 1,
          newJobs: [newRelevantJob, newIrrelevantJob],
        };
      },
    },
    filters: { titleKeywords: ["frontend"] },
  });

  assert.deepEqual(events, ["collect", "persist"]);
  assert.strictEqual(persistedJobs, jobs);
  assert.equal(result.collectedCount, 3);
  assert.equal(result.persistedCount, 3);
  assert.equal(result.insertedCount, 2);
  assert.equal(result.updatedCount, 1);
  assert.strictEqual(result.collectedJobs, jobs);
  assert.deepEqual(result.newJobs, [newRelevantJob, newIrrelevantJob]);
  assert.deepEqual(
    result.filteredJobs.map((filteredJob) => filteredJob.externalId),
    ["existing-relevant", "new-relevant"],
  );
  assert.deepEqual(
    result.newFilteredJobs.map((filteredJob) => filteredJob.externalId),
    ["new-relevant"],
  );
});

test("returns no new filtered jobs when the repository reports no new jobs", async () => {
  const existingRelevantJob = job({ title: "Frontend Engineer" });

  const result = await runCollectionCycle({
    collector: {
      async collectAll() {
        return [existingRelevantJob];
      },
    },
    jobRepository: {
      async saveMany() {
        return {
          processedCount: 1,
          insertedCount: 0,
          updatedCount: 1,
          newJobs: [],
        };
      },
    },
    filters: { titleKeywords: ["frontend"] },
  });

  assert.deepEqual(result.filteredJobs, [existingRelevantJob]);
  assert.deepEqual(result.newJobs, []);
  assert.deepEqual(result.newFilteredJobs, []);
});

function job(overrides: Partial<CollectedJob> = {}): CollectedJob {
  return {
    source: "greenhouse",
    externalId: "123",
    company: "Example Company",
    title: "Example Job",
    location: null,
    workplace: "unknown",
    url: "https://example.com/jobs/123",
    description: null,
    postedAt: null,
    updatedAt: null,
    ...overrides,
  };
}
