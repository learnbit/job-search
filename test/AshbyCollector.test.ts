import assert from "node:assert/strict";
import test from "node:test";

import { AshbyCollector } from "../src/collectors/ashby/AshbyCollector.js";

test("requests the encoded board URL and normalizes Ashby postings", async () => {
  const fetchCalls: string[] = [];
  const fakeFetch = async (input: string | URL): Promise<Response> => {
    fetchCalls.push(String(input));
    return Response.json({
      jobs: [
        {
          id: "job-123",
          title: "Senior Software Engineer",
          location: "Remote - Americas",
          workplaceType: "Remote",
          jobUrl: "https://jobs.ashbyhq.com/example/job-123",
          applyUrl: "https://jobs.ashbyhq.com/example/job-123/application",
          descriptionPlain: "Build useful software.",
          publishedAt: "2026-08-14T16:21:55.393+00:00",
        },
        {
          id: "job-456",
          title: "Product Engineer",
          workplaceType: "Hybrid",
          applyUrl: "https://jobs.ashbyhq.com/example/job-456/application",
        },
      ],
    });
  };
  const collector = new AshbyCollector(fakeFetch);

  const jobs = await collector.collect([
    { jobBoardName: "example company/us", companyName: "Example Company" },
  ]);

  assert.deepEqual(fetchCalls, [
    "https://api.ashbyhq.com/posting-api/job-board/example%20company%2Fus",
  ]);
  assert.deepEqual(jobs, [
    {
      source: "ashby",
      externalId: "job-123",
      company: "Example Company",
      title: "Senior Software Engineer",
      location: "Remote - Americas",
      workplace: "remote",
      url: "https://jobs.ashbyhq.com/example/job-123",
      description: "Build useful software.",
      postedAt: "2026-08-14T16:21:55.393+00:00",
      updatedAt: null,
    },
    {
      source: "ashby",
      externalId: "job-456",
      company: "Example Company",
      title: "Product Engineer",
      location: null,
      workplace: "hybrid",
      url: "https://jobs.ashbyhq.com/example/job-456/application",
      description: null,
      postedAt: null,
      updatedAt: null,
    },
  ]);
});

test("uses Ashby workplace types with the shared normalizer", async () => {
  const collector = new AshbyCollector(async () =>
    Response.json({
      jobs: [
        {
          id: "onsite-job",
          title: "Onsite Engineer",
          location: "New York, NY",
          workplaceType: "OnSite",
          jobUrl: "https://jobs.ashbyhq.com/example/onsite-job",
        },
        {
          id: "unknown-job",
          title: "Unknown Workplace Engineer",
          jobUrl: "https://jobs.ashbyhq.com/example/unknown-job",
        },
      ],
    }),
  );

  const jobs = await collector.collect([
    { jobBoardName: "example", companyName: "Example Company" },
  ]);

  assert.deepEqual(
    jobs.map(({ externalId, location, workplace }) => ({
      externalId,
      location,
      workplace,
    })),
    [
      {
        externalId: "onsite-job",
        location: "New York, NY",
        workplace: "onsite",
      },
      {
        externalId: "unknown-job",
        location: null,
        workplace: "unknown",
      },
    ],
  );
});

test("collects listed and legacy postings while excluding unlisted postings", async () => {
  const errors: string[] = [];
  const collector = new AshbyCollector(
    async () =>
      Response.json({
        jobs: [
          {
            id: "listed-job",
            title: "Listed Engineer",
            isListed: true,
            jobUrl: "https://jobs.ashbyhq.com/example/listed-job",
          },
          {
            id: "unlisted-job",
            title: "Unlisted Engineer",
            isListed: false,
            jobUrl: "https://jobs.ashbyhq.com/example/unlisted-job",
          },
          {
            id: "legacy-job",
            title: "Legacy Engineer",
            jobUrl: "https://jobs.ashbyhq.com/example/legacy-job",
          },
          {
            id: "invalid-listed-value",
            title: "Invalid Engineer",
            isListed: "false",
            jobUrl: "https://jobs.ashbyhq.com/example/invalid-listed-value",
          },
        ],
      }),
    { error: (message: string): void => void errors.push(message) },
  );

  const jobs = await collector.collect([
    { jobBoardName: "example", companyName: "Example Company" },
  ]);

  assert.deepEqual(
    jobs.map((job) => job.externalId),
    ["listed-job", "legacy-job"],
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? "", /Skipped 1 malformed posting/);
});

test("skips malformed postings without discarding valid postings", async () => {
  const errors: string[] = [];
  const collector = new AshbyCollector(
    async () =>
      Response.json({
        jobs: [
          {
            id: "valid-job",
            title: "Frontend Engineer",
            jobUrl: "https://jobs.ashbyhq.com/example/valid-job",
          },
          {
            id: "missing-title",
            jobUrl: "https://jobs.ashbyhq.com/example/missing-title",
          },
          {
            id: "missing-url",
            title: "Backend Engineer",
          },
        ],
      }),
    { error: (message: string): void => void errors.push(message) },
  );

  const jobs = await collector.collect([
    { jobBoardName: "example", companyName: "Example Company" },
  ]);

  assert.deepEqual(
    jobs.map((job) => job.externalId),
    ["valid-job"],
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? "", /Skipped 2 malformed posting/);
  assert.match(errors[0] ?? "", /board "example"/);
});

test("logs and isolates a non-2xx board failure", async () => {
  const errors: string[] = [];
  const collector = new AshbyCollector(
    async (input) => {
      if (String(input).endsWith("failing-board")) {
        return new Response(null, { status: 503, statusText: "Unavailable" });
      }

      return Response.json({
        jobs: [
          {
            id: "working-job",
            title: "Software Engineer",
            location: "Remote",
            jobUrl: "https://jobs.ashbyhq.com/working-board/working-job",
          },
        ],
      });
    },
    { error: (message: string): void => void errors.push(message) },
  );

  const jobs = await collector.collect([
    { jobBoardName: "working-board", companyName: "Working Company" },
    { jobBoardName: "failing-board", companyName: "Failing Company" },
  ]);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.externalId, "working-job");
  assert.equal(jobs[0]?.company, "Working Company");
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? "", /failing-board/);
  assert.match(errors[0] ?? "", /503 Unavailable/);
});

test("invalid top-level payload fails that board cleanly", async () => {
  const errors: string[] = [];
  const collector = new AshbyCollector(
    async () => Response.json({ jobs: "not-an-array" }),
    { error: (message: string): void => void errors.push(message) },
  );

  const jobs = await collector.collect([
    { jobBoardName: "invalid-board", companyName: "Invalid Company" },
  ]);

  assert.deepEqual(jobs, []);
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? "", /invalid-board/);
  assert.match(errors[0] ?? "", /did not contain a jobs array/);
});
