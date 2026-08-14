import type { CollectedJob, JobCollector } from "../types.js";
import type {
  GreenhouseBoard,
  GreenhouseJob,
  GreenhouseJobsResponse,
} from "./types.js";

type Fetch = (input: string | URL, init?: RequestInit) => Promise<Response>;
type ErrorLogger = Pick<Console, "error">;

export class GreenhouseCollector
  implements JobCollector<readonly GreenhouseBoard[]>
{
  readonly source = "greenhouse";

  constructor(
    private readonly fetchFn: Fetch = globalThis.fetch,
    private readonly logger: ErrorLogger = console,
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

    return payload.jobs.map((job) => this.normalize(job, board));
  }

  private normalize(job: GreenhouseJob, board: GreenhouseBoard): CollectedJob {
    return {
      source: this.source,
      externalId: String(job.id),
      company: board.companyName,
      title: job.title,
      location: job.location?.name ?? null,
      url: job.absolute_url,
      description: job.content ?? null,
      postedAt: null,
      updatedAt: job.updated_at ?? null,
    };
  }
}
