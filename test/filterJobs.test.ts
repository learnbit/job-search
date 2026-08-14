import assert from "node:assert/strict";
import test from "node:test";

import type { CollectedJob } from "../src/collectors/types.js";
import { filterJobs } from "../src/filters/filterJobs.js";

test("no filters returns every job in a new array without mutation", () => {
  const jobs = [job({ externalId: "1" }), job({ externalId: "2" })];
  const snapshot = structuredClone(jobs);

  const result = filterJobs(jobs, {});

  assert.deepEqual(result, jobs);
  assert.notStrictEqual(result, jobs);
  assert.deepEqual(jobs, snapshot);
  assert.strictEqual(result[0], jobs[0]);
});

test("matches a keyword in the title case-insensitively", () => {
  const jobs = [
    job({ externalId: "match", title: "Senior React Engineer" }),
    job({ externalId: "miss", title: "Product Designer" }),
  ];

  assert.deepEqual(ids(filterJobs(jobs, { keywords: ["rEaCt"] })), ["match"]);
});

test("matches a keyword in the description case-insensitively", () => {
  const jobs = [
    job({ externalId: "match", description: "Experience with TypeScript" }),
    job({ externalId: "miss", description: null }),
  ];

  assert.deepEqual(ids(filterJobs(jobs, { keywords: ["typescript"] })), [
    "match",
  ]);
});

test("uses OR semantics for multiple keywords", () => {
  const jobs = [
    job({ externalId: "react", title: "React Engineer" }),
    job({ externalId: "frontend", title: "Frontend Engineer" }),
    job({ externalId: "backend", title: "Backend Engineer" }),
  ];

  assert.deepEqual(
    ids(filterJobs(jobs, { keywords: ["react", "frontend"] })),
    ["react", "frontend"],
  );
});

test("ignores blank keywords", () => {
  const jobs = [job({ externalId: "1" }), job({ externalId: "2" })];

  assert.deepEqual(ids(filterJobs(jobs, { keywords: ["", "   "] })), ["1", "2"]);
});

test("country matching is case-insensitive and requires a location", () => {
  const jobs = [
    job({ externalId: "match", location: "Remote - us" }),
    job({ externalId: "other", location: "Remote - Canada" }),
    job({ externalId: "missing", location: null }),
  ];

  assert.deepEqual(ids(filterJobs(jobs, { country: "US" })), ["match"]);
});

test("an empty or blank country does not filter jobs", () => {
  const jobs = [
    job({ externalId: "located", location: "Canada" }),
    job({ externalId: "missing", location: null }),
  ];

  assert.deepEqual(ids(filterJobs(jobs, { country: "  " })), [
    "located",
    "missing",
  ]);
});

test("remoteOnly matches clear remote locations but not missing locations", () => {
  const jobs = [
    job({ externalId: "remote", location: "New York, NY", workplace: "remote" }),
    job({ externalId: "raw-remote-only", location: "Remote - US" }),
    job({ externalId: "missing", location: null, workplace: "unknown" }),
  ];

  assert.deepEqual(ids(filterJobs(jobs, { remoteOnly: true })), ["remote"]);
});

test("active filter categories combine with AND semantics", () => {
  const jobs = [
    job({
      externalId: "match",
      title: "React Engineer",
      location: "Remote - US",
      workplace: "remote",
    }),
    job({
      externalId: "wrong-keyword",
      title: "Go Engineer",
      location: "Remote - US",
      workplace: "remote",
    }),
    job({
      externalId: "wrong-country",
      title: "React Engineer",
      location: "Remote - CA",
      workplace: "remote",
    }),
    job({
      externalId: "not-remote",
      title: "React Engineer",
      location: "Remote - US",
      workplace: "unknown",
    }),
  ];

  assert.deepEqual(
    ids(
      filterJobs(jobs, {
        keywords: ["react"],
        country: "us",
        remoteOnly: true,
      }),
    ),
    ["match"],
  );
});

function ids(jobs: readonly CollectedJob[]): string[] {
  return jobs.map((collectedJob) => collectedJob.externalId);
}

function job(overrides: Partial<CollectedJob> = {}): CollectedJob {
  return {
    source: "test",
    externalId: "job",
    company: "Example Company",
    title: "Software Engineer",
    location: "New York, US",
    workplace: "unknown",
    url: "https://example.com/jobs/job",
    description: null,
    postedAt: null,
    updatedAt: null,
    ...overrides,
  };
}
