import { normalizeWorkplace } from "../../normalizers/workplace.js";
import type { CollectedJob, JobCollector } from "../types.js";
import type { AshbyBoard, AshbyPosting } from "./types.js";

type Fetch = (input: string | URL, init?: RequestInit) => Promise<Response>;
type ErrorLogger = Pick<Console, "error">;

export class AshbyCollector implements JobCollector<readonly AshbyBoard[]> {
  readonly source = "ashby";

  constructor(
    private readonly fetchFn: Fetch = globalThis.fetch,
    private readonly logger: ErrorLogger = console,
  ) {}

  async collect(boards: readonly AshbyBoard[]): Promise<CollectedJob[]> {
    const results = await Promise.all(
      boards.map(async (board) => {
        try {
          return await this.collectBoard(board);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `[ashby] Failed to collect board "${board.jobBoardName}" (${board.companyName}): ${message}`,
          );
          return [];
        }
      }),
    );

    return results.flat();
  }

  private async collectBoard(board: AshbyBoard): Promise<CollectedJob[]> {
    const jobBoardName = encodeURIComponent(board.jobBoardName);
    const url = `https://api.ashbyhq.com/posting-api/job-board/${jobBoardName}`;
    const response = await this.fetchFn(url);

    if (!response.ok) {
      throw new Error(`Ashby API returned ${response.status} ${response.statusText}`);
    }

    const payload: unknown = await response.json();

    if (!hasJobsArray(payload)) {
      throw new Error("Ashby API response did not contain a jobs array");
    }

    const validPostings = payload.jobs.filter(isAshbyPosting);
    const skippedCount = payload.jobs.length - validPostings.length;

    if (skippedCount > 0) {
      this.logger.error(
        `[ashby] Skipped ${skippedCount} malformed posting(s) from board "${board.jobBoardName}" (${board.companyName})`,
      );
    }

    return validPostings
      .filter((posting) => posting.isListed !== false)
      .map((posting) => this.normalize(posting, board));
  }

  private normalize(posting: AshbyPosting, board: AshbyBoard): CollectedJob {
    const location = posting.location ?? null;
    const workplaceText = posting.workplaceType ?? location;

    return {
      source: this.source,
      externalId: posting.id,
      company: board.companyName,
      title: posting.title,
      location,
      workplace: normalizeWorkplace(workplaceText),
      url: posting.jobUrl ?? posting.applyUrl ?? "",
      description: posting.descriptionPlain ?? posting.descriptionHtml ?? null,
      postedAt: posting.publishedAt ?? null,
      updatedAt: null,
    };
  }
}

function hasJobsArray(value: unknown): value is { jobs: unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as Record<string, unknown>).jobs)
  );
}

function isAshbyPosting(value: unknown): value is AshbyPosting {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const posting = value as Record<string, unknown>;
  const hasUrl =
    typeof posting.jobUrl === "string" ||
    typeof posting.applyUrl === "string";

  return (
    typeof posting.id === "string" &&
    typeof posting.title === "string" &&
    hasUrl &&
    isOptionalBoolean(posting.isListed) &&
    isOptionalString(posting.location) &&
    isOptionalString(posting.workplaceType) &&
    isOptionalString(posting.jobUrl) &&
    isOptionalString(posting.applyUrl) &&
    isOptionalString(posting.descriptionPlain) &&
    isOptionalString(posting.descriptionHtml) &&
    isOptionalString(posting.publishedAt)
  );
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === "boolean";
}
