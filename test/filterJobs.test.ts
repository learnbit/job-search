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

test("titleKeywords match only titles case-insensitively", () => {
  const jobs = [
    job({ externalId: "match", title: "Senior FrOnTeNd Developer" }),
    job({ externalId: "miss", title: "Product Designer" }),
  ];

  assert.deepEqual(ids(filterJobs(jobs, { titleKeywords: ["frontend"] })), [
    "match",
  ]);
});

test("titleKeywords do not match description-only occurrences", () => {
  const jobs = [
    job({
      externalId: "golang",
      title: "Golang Engineer",
      description: "Works closely with frontend teams using React",
    }),
  ];

  assert.deepEqual(ids(filterJobs(jobs, { titleKeywords: ["frontend"] })), []);
});

test("multiple titleKeywords use OR semantics", () => {
  const jobs = [
    job({ externalId: "frontend", title: "Frontend Engineer" }),
    job({ externalId: "web", title: "Web Developer" }),
    job({ externalId: "backend", title: "Backend Engineer" }),
  ];

  assert.deepEqual(
    ids(filterJobs(jobs, { titleKeywords: ["frontend", "web developer"] })),
    ["frontend", "web"],
  );
});

test("blank titleKeywords are ignored", () => {
  const jobs = [job({ externalId: "1" }), job({ externalId: "2" })];

  assert.deepEqual(
    ids(filterJobs(jobs, { titleKeywords: ["", "   "] })),
    ["1", "2"],
  );
});

test("skills match titles case-insensitively", () => {
  const jobs = [
    job({ externalId: "match", title: "Senior TypeScript Engineer" }),
    job({ externalId: "miss", title: "Product Designer" }),
  ];

  assert.deepEqual(ids(filterJobs(jobs, { skills: ["tYpEsCrIpT"] })), [
    "match",
  ]);
});

test("skills match descriptions case-insensitively", () => {
  const jobs = [
    job({ externalId: "match", description: "Build applications using React" }),
    job({ externalId: "miss", description: null }),
  ];

  assert.deepEqual(ids(filterJobs(jobs, { skills: ["rEaCt"] })), ["match"]);
});

test("multiple skills use OR semantics", () => {
  const jobs = [
    job({ externalId: "react", description: "Uses React" }),
    job({ externalId: "typescript", description: "Uses TypeScript" }),
    job({ externalId: "go", description: "Uses Go" }),
  ];

  assert.deepEqual(
    ids(filterJobs(jobs, { skills: ["react", "typescript"] })),
    ["react", "typescript"],
  );
});

test("blank skills are ignored", () => {
  const jobs = [job({ externalId: "1" }), job({ externalId: "2" })];

  assert.deepEqual(ids(filterJobs(jobs, { skills: ["", "   "] })), ["1", "2"]);
});

test("titleKeywords and skills combine with AND semantics", () => {
  const jobs = [
    job({
      externalId: "match",
      title: "Senior Frontend Engineer",
      description: "Build applications using React and TypeScript",
    }),
    job({
      externalId: "description-only-title",
      title: "Golang Engineer",
      description: "Works closely with frontend teams using React",
    }),
    job({
      externalId: "missing-skill",
      title: "Frontend Engineer",
      description: "Build applications using Go",
    }),
  ];

  assert.deepEqual(
    ids(
      filterJobs(jobs, {
        titleKeywords: ["frontend"],
        skills: ["react"],
      }),
    ),
    ["match"],
  );
});

test("titleKeywords, skills, and remoteOnly combine with AND semantics", () => {
  const jobs = [
    job({
      externalId: "match",
      title: "Senior Frontend Engineer",
      description: "Build applications using React and TypeScript",
      workplace: "remote",
    }),
    job({
      externalId: "not-remote",
      title: "Senior Frontend Engineer",
      description: "Build applications using React and TypeScript",
      workplace: "hybrid",
    }),
  ];

  assert.deepEqual(
    ids(
      filterJobs(jobs, {
        titleKeywords: ["frontend"],
        skills: ["react"],
        remoteOnly: true,
      }),
    ),
    ["match"],
  );
});

test("country matching remains case-insensitive and requires a location", () => {
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

test("remoteOnly remains based on workplace rather than location text", () => {
  const jobs = [
    job({ externalId: "remote", location: "New York, NY", workplace: "remote" }),
    job({ externalId: "raw-remote-only", location: "Remote - US" }),
    job({ externalId: "missing", location: null, workplace: "unknown" }),
  ];

  assert.deepEqual(ids(filterJobs(jobs, { remoteOnly: true })), ["remote"]);
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
