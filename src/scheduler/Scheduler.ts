import { setTimeout as setTimeoutPromise } from "node:timers/promises";

import type {
  CollectionCycleResult,
  CollectionCycleRunner,
} from "../pipeline/runCollectionCycle.js";

export const DEFAULT_COLLECTION_INTERVAL_MINUTES = 30;

type Logger = Pick<Console, "log" | "error">;
type Clock = () => Date;
type Sleep = (milliseconds: number, signal: AbortSignal) => Promise<void>;

export interface SchedulerOptions {
  readonly intervalMinutes: number;
  readonly runCollectionCycle: CollectionCycleRunner;
  readonly logger?: Logger;
  readonly now?: Clock;
  readonly sleep?: Sleep;
}

export function parseCollectionIntervalMinutes(
  value: string | undefined,
): number {
  if (value === undefined) {
    return DEFAULT_COLLECTION_INTERVAL_MINUTES;
  }

  const minutes = Number(value);
  const milliseconds = minutes * 60_000;

  if (!Number.isFinite(minutes) || minutes <= 0 || milliseconds < 1) {
    throw new Error(
      `COLLECT_INTERVAL_MINUTES must be a positive number representing at least 1ms; received "${value}".`,
    );
  }

  return minutes;
}

export class Scheduler {
  private readonly intervalMilliseconds: number;
  private readonly runCollectionCycle: CollectionCycleRunner;
  private readonly logger: Logger;
  private readonly now: Clock;
  private readonly sleep: Sleep;
  private shutdownRequested = false;
  private sleepController: AbortController | null = null;
  private running = false;

  constructor(options: SchedulerOptions) {
    if (
      !Number.isFinite(options.intervalMinutes) ||
      options.intervalMinutes <= 0 ||
      options.intervalMinutes * 60_000 < 1
    ) {
      throw new Error("Scheduler interval must be a positive number of minutes.");
    }

    this.intervalMilliseconds = options.intervalMinutes * 60_000;
    this.runCollectionCycle = options.runCollectionCycle;
    this.logger = options.logger ?? console;
    this.now = options.now ?? (() => new Date());
    this.sleep = options.sleep ?? sleep;
  }

  requestShutdown(): void {
    this.shutdownRequested = true;
    this.sleepController?.abort();
  }

  async run(): Promise<void> {
    if (this.running) {
      throw new Error("Scheduler is already running.");
    }

    this.running = true;
    this.logger.log("Scheduler started");
    this.logger.log(
      `Collection interval: ${formatNumber(this.intervalMilliseconds / 60_000)} minutes\n`,
    );

    let cycleNumber = 0;

    try {
      while (!this.shutdownRequested) {
        cycleNumber += 1;
        await this.runCycle(cycleNumber);

        if (this.shutdownRequested) {
          break;
        }

        this.logger.log(
          `Next run in ${formatNumber(this.intervalMilliseconds / 60_000)} minutes`,
        );
        await this.waitForNextCycle();
      }
    } finally {
      this.running = false;
      this.sleepController = null;
    }
  }

  private async runCycle(cycleNumber: number): Promise<void> {
    const startedAt = this.now();
    this.logger.log(`Collection cycle started: ${startedAt.toISOString()}`);

    try {
      const result = await this.runCollectionCycle();
      this.logResult(result);

      const durationSeconds = (this.now().getTime() - startedAt.getTime()) / 1_000;
      this.logger.log(
        `Collection cycle completed in ${formatNumber(durationSeconds)}s`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Collection cycle #${cycleNumber} failed (${startedAt.toISOString()}): ${message}`,
      );
    }
  }

  private logResult(result: CollectionCycleResult): void {
    this.logger.log(`Collected jobs: ${result.collectedCount}`);
    this.logger.log(`Persisted jobs: ${result.persistedCount}`);
    this.logger.log(`Filtered jobs: ${result.filteredJobs.length}`);
  }

  private async waitForNextCycle(): Promise<void> {
    const controller = new AbortController();
    this.sleepController = controller;

    try {
      await this.sleep(this.intervalMilliseconds, controller.signal);
    } catch (error: unknown) {
      if (!this.shutdownRequested || !controller.signal.aborted) {
        throw error;
      }
    } finally {
      if (this.sleepController === controller) {
        this.sleepController = null;
      }
    }
  }
}

async function sleep(
  milliseconds: number,
  signal: AbortSignal,
): Promise<void> {
  await setTimeoutPromise(milliseconds, undefined, { signal });
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(value);
}
