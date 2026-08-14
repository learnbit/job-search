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
