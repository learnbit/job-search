import assert from "node:assert/strict";
import test from "node:test";

import { GreenhouseCollector } from "../src/collectors/greenhouse/GreenhouseCollector.js";

test("normalizes jobs from a Greenhouse board", async () => {
  const fetchCalls: string[] = [];
  const fakeFetch = async (input: string | URL): Promise<Response> => {
    fetchCalls.push(String(input));
    return Response.json({
      jobs: [
        {
          id: 123,
          title: "Software Engineer",
          location: { name: "Remote" },
          absolute_url: "https://example.com/jobs/123",
          content: "<p>Build useful things.</p>",
          updated_at: "2026-08-14T12:00:00Z",
        },
      ],
    });
  };

  const collector = new GreenhouseCollector(fakeFetch);
  const jobs = await collector.collect([
    { boardToken: "example company", companyName: "Example Company" },
  ]);

  assert.deepEqual(fetchCalls, [
    "https://boards-api.greenhouse.io/v1/boards/example%20company/jobs?content=true",
  ]);
  assert.deepEqual(jobs, [
    {
      source: "greenhouse",
      externalId: "123",
      company: "Example Company",
      title: "Software Engineer",
      location: "Remote",
      workplace: "remote",
      url: "https://example.com/jobs/123",
      description: "<p>Build useful things.</p>",
      postedAt: null,
      updatedAt: "2026-08-14T12:00:00Z",
    },
  ]);
});

test("returns successful boards when another board fails", async () => {
  const errors: string[] = [];
  const fakeFetch = async (input: string | URL): Promise<Response> => {
    if (String(input).includes("failing-board")) {
      return new Response(null, { status: 503, statusText: "Unavailable" });
    }

    return Response.json({
      jobs: [
        {
          id: 456,
          title: "Product Engineer",
          location: null,
          absolute_url: "https://example.com/jobs/456",
        },
      ],
    });
  };
  const logger = { error: (message: string): void => void errors.push(message) };
  const collector = new GreenhouseCollector(fakeFetch, logger);

  const jobs = await collector.collect([
    { boardToken: "working-board", companyName: "Working Company" },
    { boardToken: "failing-board", companyName: "Failing Company" },
  ]);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.externalId, "456");
  assert.equal(jobs[0]?.location, null);
  assert.equal(jobs[0]?.workplace, "unknown");
  assert.equal(jobs[0]?.description, null);
  assert.equal(jobs[0]?.postedAt, null);
  assert.equal(jobs[0]?.updatedAt, null);
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? "", /failing-board/);
  assert.match(errors[0] ?? "", /503 Unavailable/);
});

test("maps detail first_published to postedAt and keeps updated_at as updatedAt", async () => {
  const fakeFetch = async (input: string | URL): Promise<Response> => {
    if (String(input).endsWith("/jobs/123")) {
      return Response.json({
        id: 123,
        first_published: "2026-08-10T09:30:00Z",
      });
    }

    return Response.json({
      jobs: [
        {
          id: 123,
          title: "Frontend Engineer",
          absolute_url: "https://example.com/jobs/123",
          updated_at: "2026-08-14T12:00:00Z",
        },
      ],
    });
  };
  const collector = new GreenhouseCollector(
    fakeFetch,
    console,
    (jobs) => jobs,
  );

  const jobs = await collector.collect([
    { boardToken: "example", companyName: "Example Company" },
  ]);

  assert.equal(jobs[0]?.postedAt, "2026-08-10T09:30:00Z");
  assert.equal(jobs[0]?.updatedAt, "2026-08-14T12:00:00Z");
  assert.notEqual(jobs[0]?.postedAt, jobs[0]?.updatedAt);
});

test("missing or null first_published leaves postedAt null", async () => {
  const fakeFetch = async (input: string | URL): Promise<Response> => {
    const url = String(input);

    if (url.endsWith("/jobs/123")) {
      return Response.json({ id: 123, first_published: null });
    }

    if (url.endsWith("/jobs/456")) {
      return Response.json({ id: 456 });
    }

    return Response.json({
      jobs: [
        jobPayload(123, "Frontend Engineer"),
        jobPayload(456, "Frontend Developer"),
      ],
    });
  };
  const collector = new GreenhouseCollector(
    fakeFetch,
    console,
    (jobs) => jobs,
  );

  const jobs = await collector.collect([
    { boardToken: "example", companyName: "Example Company" },
  ]);

  assert.deepEqual(
    jobs.map((job) => job.postedAt),
    [null, null],
  );
});

test("isolates a failed detail request and continues enriching other jobs", async () => {
  const errors: string[] = [];
  const fakeFetch = async (input: string | URL): Promise<Response> => {
    const url = String(input);

    if (url.endsWith("/jobs/123")) {
      return Response.json({ id: 123, first_published: "2026-08-10T09:00:00Z" });
    }

    if (url.endsWith("/jobs/456")) {
      return new Response(null, { status: 503, statusText: "Unavailable" });
    }

    if (url.endsWith("/jobs/789")) {
      return Response.json({ id: 789, first_published: "2026-08-12T11:00:00Z" });
    }

    return Response.json({
      jobs: [
        jobPayload(123, "Frontend Engineer"),
        jobPayload(456, "Frontend Developer"),
        jobPayload(789, "Web Developer"),
      ],
    });
  };
  const collector = new GreenhouseCollector(
    fakeFetch,
    { error: (message: string): void => void errors.push(message) },
    (jobs) => jobs,
  );

  const jobs = await collector.collect([
    { boardToken: "example-board", companyName: "Example Company" },
  ]);

  assert.deepEqual(
    jobs.map((job) => job.postedAt),
    ["2026-08-10T09:00:00Z", null, "2026-08-12T11:00:00Z"],
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? "", /example-board/);
  assert.match(errors[0] ?? "", /Example Company/);
  assert.match(errors[0] ?? "", /456/);
});

test("requests details only for jobs selected for enrichment", async () => {
  const detailRequests: string[] = [];
  const fakeFetch = async (input: string | URL): Promise<Response> => {
    const url = String(input);

    if (!url.includes("?content=true")) {
      detailRequests.push(url);
      return Response.json({ id: 123, first_published: "2026-08-10T09:00:00Z" });
    }

    return Response.json({
      jobs: [
        jobPayload(123, "Frontend Engineer"),
        jobPayload(456, "Backend Engineer"),
      ],
    });
  };
  const collector = new GreenhouseCollector(
    fakeFetch,
    console,
    (jobs) => jobs.filter((job) => job.title.includes("Frontend")),
  );

  const jobs = await collector.collect([
    { boardToken: "example", companyName: "Example Company" },
  ]);

  assert.deepEqual(detailRequests, [
    "https://boards-api.greenhouse.io/v1/boards/example/jobs/123",
  ]);
  assert.equal(jobs[0]?.postedAt, "2026-08-10T09:00:00Z");
  assert.equal(jobs[1]?.postedAt, null);
});

function jobPayload(id: number, title: string) {
  return {
    id,
    title,
    location: { name: "Remote" },
    absolute_url: `https://example.com/jobs/${id}`,
    content: "<p>React and TypeScript</p>",
    updated_at: "2026-08-14T12:00:00Z",
  };
}
