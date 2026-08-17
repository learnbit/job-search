import type { CollectedJob, JobCollector } from "../types.js";
import type {
  GreenhouseBoard,
  GreenhouseJob,
  GreenhouseJobDetail,
  GreenhouseJobsResponse,
} from "./types.js";
import { normalizeWorkplace } from "../../normalizers/workplace.js";

type Fetch = (input: string | URL, init?: RequestInit) => Promise<Response>;
type ErrorLogger = Pick<Console, "error">;
type EnrichmentSelector = (
  jobs: readonly CollectedJob[],
) => readonly CollectedJob[];

const DETAIL_REQUEST_CONCURRENCY = 5;

export class GreenhouseCollector
  implements JobCollector<readonly GreenhouseBoard[]>
{
  readonly source = "greenhouse";

  constructor(
    private readonly fetchFn: Fetch = globalThis.fetch,
    private readonly logger: ErrorLogger = console,
    private readonly selectJobsForEnrichment: EnrichmentSelector = () => [],
  ) {}

  async collect(boards: readonly GreenhouseBoard[]): Promise<CollectedJob[]> {
    const results = await Promise.all(
      boards.map(async (board) => {
        try {
          return await this.collectBoard(board);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `[greenhouse] Failed to collect board "${board.boardToken}" (${board.companyName}): ${message}`,
          );
          return [];
        }
      }),
    );

    return results.flat();
  }

  private async collectBoard(board: GreenhouseBoard): Promise<CollectedJob[]> {
    const boardToken = encodeURIComponent(board.boardToken);
    const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
    const response = await this.fetchFn(url);

    if (!response.ok) {
      throw new Error(`Greenhouse API returned ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as GreenhouseJobsResponse;

    if (!Array.isArray(payload.jobs)) {
      throw new Error("Greenhouse API response did not contain a jobs array");
    }

    const jobs = payload.jobs.map((job) => this.normalize(job, board));
    const selectedExternalIds = new Set(
      this.selectJobsForEnrichment(jobs).map((job) => job.externalId),
    );
    const jobsToEnrich = jobs.filter((job) =>
      selectedExternalIds.has(job.externalId),
    );
    const postedAtByExternalId = new Map<string, string | null>();

    await forEachWithConcurrency(
      jobsToEnrich,
      DETAIL_REQUEST_CONCURRENCY,
      async (job) => {
        postedAtByExternalId.set(
          job.externalId,
          await this.fetchPostedAt(board, job.externalId),
        );
      },
    );

    return jobs.map((job) =>
      postedAtByExternalId.has(job.externalId)
        ? { ...job, postedAt: postedAtByExternalId.get(job.externalId) ?? null }
        : job,
    );
  }

  private async fetchPostedAt(
    board: GreenhouseBoard,
    externalId: string,
  ): Promise<string | null> {
    const boardToken = encodeURIComponent(board.boardToken);
    const jobId = encodeURIComponent(externalId);
    const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs/${jobId}`;

    try {
      const response = await this.fetchFn(url);

      if (!response.ok) {
        throw new Error(
          `Greenhouse API returned ${response.status} ${response.statusText}`,
        );
      }

      const detail = (await response.json()) as GreenhouseJobDetail;

      return typeof detail.first_published === "string"
        ? detail.first_published
        : null;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[greenhouse] Failed to enrich job "${externalId}" from board "${board.boardToken}" (${board.companyName}): ${message}`,
      );
      return null;
    }
  }

  private normalize(job: GreenhouseJob, board: GreenhouseBoard): CollectedJob {
    const location = job.location?.name ?? null;

    return {
      source: this.source,
      externalId: String(job.id),
      company: board.companyName,
      title: job.title,
      location,
      workplace: normalizeWorkplace(location),
      url: job.absolute_url,
      description: job.content ?? null,
      postedAt: null,
      updatedAt: job.updated_at ?? null,
    };
  }
}

async function forEachWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  callback: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;

      if (item !== undefined) {
        await callback(item);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
}
