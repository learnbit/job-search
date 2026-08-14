import assert from "node:assert/strict";
import test from "node:test";

import {
  CollectorOrchestrator,
  configureCollector,
} from "../src/collectors/CollectorOrchestrator.js";
import type { CollectedJob, JobCollector } from "../src/collectors/types.js";

interface GreenhouseLikeConfig {
  boardToken: string;
}

interface LeverLikeConfig {
  site: string;
}

test("combines results and passes each collector its own config", async () => {
  const receivedGreenhouseConfigs: GreenhouseLikeConfig[] = [];
  const receivedLeverConfigs: LeverLikeConfig[] = [];
  const greenhouseConfig = { boardToken: "example-board" };
  const leverConfig = { site: "example-site" };

  const greenhouseLike: JobCollector<GreenhouseLikeConfig> = {
    source: "greenhouse",
    async collect(config) {
      receivedGreenhouseConfigs.push(config);
      return [job("greenhouse", "greenhouse-1")];
    },
  };
  const leverLike: JobCollector<LeverLikeConfig> = {
    source: "lever",
    async collect(config) {
      receivedLeverConfigs.push(config);
      return [job("lever", "lever-1")];
    },
  };
  const orchestrator = new CollectorOrchestrator([
    configureCollector(greenhouseLike, greenhouseConfig),
    configureCollector(leverLike, leverConfig),
  ]);

  const jobs = await orchestrator.collectAll();

  assert.deepEqual(
    jobs.map((collectedJob) => collectedJob.externalId),
    ["greenhouse-1", "lever-1"],
  );
  assert.deepEqual(receivedGreenhouseConfigs, [greenhouseConfig]);
  assert.deepEqual(receivedLeverConfigs, [leverConfig]);
});

test("returns successful results and logs when another collector throws", async () => {
  const errors: string[] = [];
  const successful: JobCollector<{ enabled: boolean }> = {
    source: "successful-source",
    async collect() {
      return [job("successful-source", "successful-1")];
    },
  };
  const failing: JobCollector<{ enabled: boolean }> = {
    source: "failing-source",
    async collect() {
      throw new Error("collector unavailable");
    },
  };
  const logger = { error: (message: string): void => void errors.push(message) };
  const orchestrator = new CollectorOrchestrator(
    [
      configureCollector(failing, { enabled: true }),
      configureCollector(successful, { enabled: true }),
    ],
    logger,
  );

  const jobs = await orchestrator.collectAll();

  assert.deepEqual(jobs, [job("successful-source", "successful-1")]);
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? "", /failing-source/);
  assert.match(errors[0] ?? "", /collector unavailable/);
});

test("returns an empty array when no collectors are configured", async () => {
  const orchestrator = new CollectorOrchestrator([]);

  assert.deepEqual(await orchestrator.collectAll(), []);
});

function job(source: string, externalId: string): CollectedJob {
  return {
    source,
    externalId,
    company: "Example Company",
    title: "Example Job",
    location: null,
    workplace: "unknown",
    url: `https://example.com/jobs/${externalId}`,
    description: null,
    postedAt: null,
    updatedAt: null,
  };
}
