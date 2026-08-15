import assert from "node:assert/strict";
import test from "node:test";

import type { CollectedJob } from "../src/collectors/types.js";
import type { CollectionCycleResult } from "../src/pipeline/runCollectionCycle.js";
import {
  DEFAULT_COLLECTION_INTERVAL_MINUTES,
  parseCollectionIntervalMinutes,
  Scheduler,
} from "../src/scheduler/Scheduler.js";

test("uses a 30-minute default interval", () => {
  assert.equal(
    parseCollectionIntervalMinutes(undefined),
    DEFAULT_COLLECTION_INTERVAL_MINUTES,
  );
  assert.equal(DEFAULT_COLLECTION_INTERVAL_MINUTES, 30);
});

test("parses a configured fractional interval without changing its input", () => {
  const input = "0.05";

  assert.equal(parseCollectionIntervalMinutes(input), 0.05);
  assert.equal(parseCollectionIntervalMinutes(input), 0.05);
  assert.equal(input, "0.05");
});

test("rejects a zero interval", () => {
  assert.throws(() => parseCollectionIntervalMinutes("0"), /positive number/);
});

test("rejects a negative interval", () => {
  assert.throws(() => parseCollectionIntervalMinutes("-5"), /positive number/);
});

test("rejects a non-numeric interval", () => {
  assert.throws(() => parseCollectionIntervalMinutes("abc"), /positive number/);
  assert.throws(() => parseCollectionIntervalMinutes("NaN"), /positive number/);
});

test("runs the first collection cycle immediately", async () => {
  let cycleCalls = 0;
  let sleepCalls = 0;
  let scheduler: Scheduler;

  scheduler = createScheduler({
    async runCollectionCycle() {
      cycleCalls += 1;
      scheduler.requestShutdown();
      return result();
    },
    async sleep() {
      sleepCalls += 1;
    },
  });

  await scheduler.run();

  assert.equal(cycleCalls, 1);
  assert.equal(sleepCalls, 0);
});

test("starts the next cycle only after the previous cycle and wait complete", async () => {
  const firstCycle = deferred<void>();
  const intervalWait = deferred<void>();
  let cycleCalls = 0;
  let sleepCalls = 0;
  let scheduler: Scheduler;

  scheduler = createScheduler({
    async runCollectionCycle() {
      cycleCalls += 1;

      if (cycleCalls === 1) {
        await firstCycle.promise;
      } else {
        scheduler.requestShutdown();
      }

      return result();
    },
    async sleep() {
      sleepCalls += 1;
      await intervalWait.promise;
    },
  });

  const schedulerRun = scheduler.run();
  await flushPromises();
  assert.equal(cycleCalls, 1);
  assert.equal(sleepCalls, 0);

  firstCycle.resolve();
  await flushPromises();
  assert.equal(cycleCalls, 1);
  assert.equal(sleepCalls, 1);

  intervalWait.resolve();
  await schedulerRun;
  assert.equal(cycleCalls, 2);
});

test("collection cycles never overlap", async () => {
  let activeCycles = 0;
  let maximumActiveCycles = 0;
  let cycleCalls = 0;
  let scheduler: Scheduler;

  scheduler = createScheduler({
    async runCollectionCycle() {
      cycleCalls += 1;
      activeCycles += 1;
      maximumActiveCycles = Math.max(maximumActiveCycles, activeCycles);
      await flushPromises();
      activeCycles -= 1;

      if (cycleCalls === 3) {
        scheduler.requestShutdown();
      }

      return result();
    },
    async sleep() {},
  });

  await scheduler.run();

  assert.equal(cycleCalls, 3);
  assert.equal(maximumActiveCycles, 1);
});

test("logs a failed cycle and retries after the interval", async () => {
  const errors: string[] = [];
  let cycleCalls = 0;
  let scheduler: Scheduler;

  scheduler = createScheduler({
    async runCollectionCycle() {
      cycleCalls += 1;

      if (cycleCalls === 1) {
        throw new Error("database unavailable");
      }

      scheduler.requestShutdown();
      return result();
    },
    async sleep() {},
    errors,
  });

  await scheduler.run();

  assert.equal(cycleCalls, 2);
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? "", /cycle #1/);
  assert.match(errors[0] ?? "", /database unavailable/);
});

test("shutdown during a cycle prevents another cycle from starting", async () => {
  const activeCycle = deferred<void>();
  let cycleCalls = 0;
  let sleepCalls = 0;

  const scheduler = createScheduler({
    async runCollectionCycle() {
      cycleCalls += 1;
      await activeCycle.promise;
      return result();
    },
    async sleep() {
      sleepCalls += 1;
    },
  });

  const schedulerRun = scheduler.run();
  await flushPromises();
  scheduler.requestShutdown();
  activeCycle.resolve();
  await schedulerRun;

  assert.equal(cycleCalls, 1);
  assert.equal(sleepCalls, 0);
});

test("logs new and new-filtered job counts", async () => {
  const logs: string[] = [];
  let scheduler: Scheduler;

  scheduler = createScheduler({
    async runCollectionCycle() {
      scheduler.requestShutdown();
      return result({
        collectedCount: 4,
        persistedCount: 4,
        insertedCount: 2,
        updatedCount: 2,
        newJobs: [job("new-relevant"), job("new-irrelevant")],
        newFilteredJobs: [job("new-relevant")],
      });
    },
    async sleep() {},
    logs,
  });

  await scheduler.run();

  assert.ok(logs.includes("New jobs: 2"));
  assert.ok(logs.includes("New filtered jobs: 1"));
});

interface SchedulerTestOptions {
  runCollectionCycle: () => Promise<CollectionCycleResult>;
  sleep: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  errors?: string[];
  logs?: string[];
}

function createScheduler(options: SchedulerTestOptions): Scheduler {
  return new Scheduler({
    intervalMinutes: 0.05,
    runCollectionCycle: options.runCollectionCycle,
    sleep: options.sleep,
    logger: {
      log(message) {
        options.logs?.push(String(message));
      },
      error(message) {
        options.errors?.push(String(message));
      },
    },
  });
}

function result(
  overrides: Partial<CollectionCycleResult> = {},
): CollectionCycleResult {
  return {
    collectedCount: 0,
    persistedCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    collectedJobs: [],
    newJobs: [],
    filteredJobs: [],
    newFilteredJobs: [],
    ...overrides,
  };
}

function job(externalId: string): CollectedJob {
  return {
    source: "greenhouse",
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

function deferred<T>(): {
  promise: Promise<T>;
  resolve(value: T | PromiseLike<T>): void;
} {
  let resolvePromise: (value: T | PromiseLike<T>) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return { promise, resolve: resolvePromise };
}

async function flushPromises(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}
