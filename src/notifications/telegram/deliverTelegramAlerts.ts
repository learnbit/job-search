import type { CollectedJob } from "../../collectors/types.js";
import { filterJobs, type JobFilters } from "../../filters/filterJobs.js";
import type { JobIdentity } from "../../repositories/JobRepository.js";

interface TelegramDeliveryRepository {
  findTelegramUnnotifiedJobs(): Promise<CollectedJob[]>;
  markTelegramNotified(identity: JobIdentity, notifiedAt: Date): Promise<void>;
}

interface JobNotifier {
  notifyJob(job: CollectedJob): Promise<void>;
}

type ErrorLogger = Pick<Console, "error">;
type Clock = () => Date;

export interface TelegramDeliveryDependencies {
  readonly jobRepository: TelegramDeliveryRepository;
  readonly notifier: JobNotifier;
  readonly filters: JobFilters;
  readonly logger?: ErrorLogger;
  readonly now?: Clock;
}

export interface TelegramDeliveryResult {
  readonly pendingCount: number;
  readonly relevantCount: number;
  readonly sentCount: number;
  readonly failedCount: number;
}

export async function deliverTelegramAlerts(
  dependencies: TelegramDeliveryDependencies,
): Promise<TelegramDeliveryResult> {
  const logger = dependencies.logger ?? console;
  const now = dependencies.now ?? (() => new Date());
  const pendingJobs = await dependencies.jobRepository.findTelegramUnnotifiedJobs();
  const relevantJobs = filterJobs(pendingJobs, dependencies.filters);
  let sentCount = 0;
  let failedCount = 0;

  for (const job of relevantJobs) {
    try {
      await dependencies.notifier.notifyJob(job);
      await dependencies.jobRepository.markTelegramNotified(job, now());
      sentCount += 1;
    } catch (error: unknown) {
      failedCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        `[telegram] Failed to deliver or record ${job.source}/${job.externalId}: ${message}`,
      );
    }
  }

  return {
    pendingCount: pendingJobs.length,
    relevantCount: relevantJobs.length,
    sentCount,
    failedCount,
  };
}
