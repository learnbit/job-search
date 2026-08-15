import assert from "node:assert/strict";
import test from "node:test";

import type { CollectedJob } from "../src/collectors/types.js";
import { deliverTelegramAlerts } from "../src/notifications/telegram/deliverTelegramAlerts.js";
import type { JobIdentity } from "../src/repositories/JobRepository.js";

test("successful delivery marks the job as Telegram-notified", async () => {
  const repository = new InMemoryDeliveryRepository([job()]);
  const notifiedJobs: CollectedJob[] = [];
  const notifiedAt = new Date("2026-08-15T12:00:00.000Z");

  const result = await deliverTelegramAlerts({
    jobRepository: repository,
    notifier: {
      async notifyJob(collectedJob) {
        notifiedJobs.push(collectedJob);
      },
    },
    filters: { titleKeywords: ["frontend"] },
    now: () => notifiedAt,
  });

  assert.deepEqual(notifiedJobs, [job()]);
  assert.deepEqual(repository.marked, [
    { source: "lever", externalId: "123", notifiedAt },
  ]);
  assert.deepEqual(result, {
    pendingCount: 1,
    relevantCount: 1,
    sentCount: 1,
    failedCount: 0,
  });
});

test("failed delivery leaves the job unnotified", async () => {
  const repository = new InMemoryDeliveryRepository([job()]);
  const errors: string[] = [];

  const result = await deliverTelegramAlerts({
    jobRepository: repository,
    notifier: {
      async notifyJob() {
        throw new Error("Telegram unavailable");
      },
    },
    filters: { titleKeywords: ["frontend"] },
    logger: { error: (message) => void errors.push(String(message)) },
  });

  assert.deepEqual(repository.marked, []);
  assert.equal(result.sentCount, 0);
  assert.equal(result.failedCount, 1);
  assert.match(errors[0] ?? "", /lever\/123/);
  assert.match(errors[0] ?? "", /Telegram unavailable/);
});

test("an unnotified failed job is retried on the next cycle", async () => {
  const repository = new InMemoryDeliveryRepository([job()]);
  let attempts = 0;
  const notifier = {
    async notifyJob() {
      attempts += 1;

      if (attempts === 1) {
        throw new Error("temporary failure");
      }
    },
  };
  const dependencies = {
    jobRepository: repository,
    notifier,
    filters: { titleKeywords: ["frontend"] },
    logger: { error() {} },
  };

  const firstResult = await deliverTelegramAlerts(dependencies);
  const secondResult = await deliverTelegramAlerts(dependencies);
  const thirdResult = await deliverTelegramAlerts(dependencies);

  assert.equal(firstResult.failedCount, 1);
  assert.equal(secondResult.sentCount, 1);
  assert.equal(thirdResult.pendingCount, 0);
  assert.equal(attempts, 2);
  assert.equal(repository.marked.length, 1);
});

test("a failed job does not prevent delivery of later jobs", async () => {
  const firstJob = job({ externalId: "first" });
  const secondJob = job({ externalId: "second" });
  const repository = new InMemoryDeliveryRepository([firstJob, secondJob]);

  const result = await deliverTelegramAlerts({
    jobRepository: repository,
    notifier: {
      async notifyJob(collectedJob) {
        if (collectedJob.externalId === "first") {
          throw new Error("temporary failure");
        }
      },
    },
    filters: { titleKeywords: ["frontend"] },
    logger: { error() {} },
  });

  assert.equal(result.failedCount, 1);
  assert.equal(result.sentCount, 1);
  assert.equal(repository.isNotified(firstJob), false);
  assert.equal(repository.isNotified(secondJob), true);
});

test("delivery sends only unnotified jobs passing existing filters", async () => {
  const relevantJob = job({ externalId: "relevant" });
  const irrelevantJob = job({
    externalId: "irrelevant",
    title: "Backend Engineer",
  });
  const repository = new InMemoryDeliveryRepository([
    relevantJob,
    irrelevantJob,
  ]);
  const notifiedJobs: CollectedJob[] = [];

  const result = await deliverTelegramAlerts({
    jobRepository: repository,
    notifier: {
      async notifyJob(collectedJob) {
        notifiedJobs.push(collectedJob);
      },
    },
    filters: { titleKeywords: ["frontend"] },
  });

  assert.deepEqual(notifiedJobs, [relevantJob]);
  assert.equal(result.pendingCount, 2);
  assert.equal(result.relevantCount, 1);
  assert.equal(result.sentCount, 1);
  assert.equal(repository.isNotified(irrelevantJob), false);
});

class InMemoryDeliveryRepository {
  readonly marked: Array<JobIdentity & { notifiedAt: Date }> = [];
  private readonly notifiedIdentities = new Set<string>();

  constructor(private readonly jobs: readonly CollectedJob[]) {}

  async findTelegramUnnotifiedJobs(): Promise<CollectedJob[]> {
    return this.jobs.filter((collectedJob) => !this.isNotified(collectedJob));
  }

  async markTelegramNotified(
    identity: JobIdentity,
    notifiedAt: Date,
  ): Promise<void> {
    this.notifiedIdentities.add(identityKey(identity));
    this.marked.push({
      source: identity.source,
      externalId: identity.externalId,
      notifiedAt,
    });
  }

  isNotified(identity: JobIdentity): boolean {
    return this.notifiedIdentities.has(identityKey(identity));
  }
}

function identityKey(identity: JobIdentity): string {
  return JSON.stringify([identity.source, identity.externalId]);
}

function job(overrides: Partial<CollectedJob> = {}): CollectedJob {
  return {
    source: "lever",
    externalId: "123",
    company: "Relay",
    title: "Senior Frontend Developer",
    location: "San Diego, CA",
    workplace: "unknown",
    url: "https://jobs.lever.co/relay/123",
    description: null,
    postedAt: null,
    updatedAt: null,
    ...overrides,
  };
}
