import assert from "node:assert/strict";
import test from "node:test";

import type { CollectedJob } from "../src/collectors/types.js";
import { runCollectionCycle } from "../src/pipeline/runCollectionCycle.js";

test("collects, persists all jobs, then filters the collected jobs", async () => {
  const events: string[] = [];
  const jobs = [
    job({ externalId: "match", title: "Frontend Engineer" }),
    job({ externalId: "miss", title: "Backend Engineer" }),
  ];
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
      },
    },
    filters: { titleKeywords: ["frontend"] },
  });

  assert.deepEqual(events, ["collect", "persist"]);
  assert.strictEqual(persistedJobs, jobs);
  assert.equal(result.collectedCount, 2);
  assert.equal(result.persistedCount, 2);
  assert.strictEqual(result.collectedJobs, jobs);
  assert.deepEqual(
    result.filteredJobs.map((filteredJob) => filteredJob.externalId),
    ["match"],
  );
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
