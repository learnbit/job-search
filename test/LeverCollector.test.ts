import assert from "node:assert/strict";
import test from "node:test";

import { LeverCollector } from "../src/collectors/lever/LeverCollector.js";

test("normalizes Lever postings and preserves timestamp semantics", async () => {
  const fetchCalls: string[] = [];
  const fakeFetch = async (input: string | URL): Promise<Response> => {
    fetchCalls.push(String(input));
    return Response.json([
      {
        id: "posting-123",
        text: "Software Engineer",
        categories: {
          location: "Remote",
          allLocations: ["Remote", "New York, NY"],
        },
        hostedUrl: "https://jobs.lever.co/example/posting-123",
        applyUrl: "https://jobs.lever.co/example/posting-123/apply",
        description: "<p>Build useful things.</p>",
        createdAt: 1_786_708_000_000,
        updatedAt: 1_786_711_600_000,
      },
      {
        id: "posting-456",
        text: "Product Engineer",
        hostedUrl: "https://jobs.lever.co/example/posting-456",
      },
    ]);
  };

  const collector = new LeverCollector(fakeFetch);
  const jobs = await collector.collect([
    { site: "example company/us", companyName: "Example Company" },
  ]);

  assert.deepEqual(fetchCalls, [
    "https://api.lever.co/v0/postings/example%20company%2Fus?mode=json",
  ]);
  assert.deepEqual(jobs, [
    {
      source: "lever",
      externalId: "posting-123",
      company: "Example Company",
      title: "Software Engineer",
      location: "Remote",
      workplace: "remote",
      url: "https://jobs.lever.co/example/posting-123",
      description: "<p>Build useful things.</p>",
      postedAt: null,
      updatedAt: null,
    },
    {
      source: "lever",
      externalId: "posting-456",
      company: "Example Company",
      title: "Product Engineer",
      location: null,
      workplace: "unknown",
      url: "https://jobs.lever.co/example/posting-456",
      description: null,
      postedAt: null,
      updatedAt: null,
    },
  ]);
});

test("returns successful sites and logs when another Lever site fails", async () => {
  const errors: string[] = [];
  const fakeFetch = async (input: string | URL): Promise<Response> => {
    if (String(input).includes("failing-site")) {
      return new Response(null, { status: 503, statusText: "Unavailable" });
    }

    return Response.json([
      {
        id: "posting-789",
        text: "Design Engineer",
        categories: { allLocations: ["Toronto, Canada"] },
        applyUrl: "https://jobs.lever.co/working-site/posting-789/apply",
      },
    ]);
  };
  const logger = { error: (message: string): void => void errors.push(message) };
  const collector = new LeverCollector(fakeFetch, logger);

  const jobs = await collector.collect([
    { site: "working-site", companyName: "Working Company" },
    { site: "failing-site", companyName: "Failing Company" },
  ]);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.externalId, "posting-789");
  assert.equal(jobs[0]?.location, "Toronto, Canada");
  assert.equal(jobs[0]?.workplace, "unknown");
  assert.equal(jobs[0]?.url, "https://jobs.lever.co/working-site/posting-789/apply");
  assert.equal(jobs[0]?.postedAt, null);
  assert.equal(jobs[0]?.updatedAt, null);
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? "", /failing-site/);
  assert.match(errors[0] ?? "", /503 Unavailable/);
});

test("skips malformed postings without discarding valid postings", async () => {
  const errors: string[] = [];
  const fakeFetch = async (): Promise<Response> =>
    Response.json([
      {
        id: "posting-valid-1",
        text: "Backend Engineer",
        hostedUrl: "https://jobs.lever.co/example/posting-valid-1",
      },
      {
        id: "posting-malformed",
        hostedUrl: "https://jobs.lever.co/example/posting-malformed",
      },
      {
        id: "posting-valid-2",
        text: "Frontend Engineer",
        applyUrl: "https://jobs.lever.co/example/posting-valid-2/apply",
      },
    ]);
  const logger = { error: (message: string): void => void errors.push(message) };
  const collector = new LeverCollector(fakeFetch, logger);

  const jobs = await collector.collect([
    { site: "example", companyName: "Example Company" },
  ]);

  assert.deepEqual(
    jobs.map((job) => job.externalId),
    ["posting-valid-1", "posting-valid-2"],
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? "", /Skipped 1 malformed posting/);
  assert.match(errors[0] ?? "", /site "example"/);
});
