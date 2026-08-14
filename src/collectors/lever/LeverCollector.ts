import type { CollectedJob, JobCollector } from "../types.js";
import type {
  LeverPosting,
  LeverPostingsResponse,
  LeverSite,
} from "./types.js";

type Fetch = (input: string | URL, init?: RequestInit) => Promise<Response>;
type ErrorLogger = Pick<Console, "error">;

export class LeverCollector implements JobCollector<readonly LeverSite[]> {
  readonly source = "lever";

  constructor(
    private readonly fetchFn: Fetch = globalThis.fetch,
    private readonly logger: ErrorLogger = console,
  ) {}

  async collect(sites: readonly LeverSite[]): Promise<CollectedJob[]> {
    const results = await Promise.all(
      sites.map(async (site) => {
        try {
          return await this.collectSite(site);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `[lever] Failed to collect site "${site.site}" (${site.companyName}): ${message}`,
          );
          return [];
        }
      }),
    );

    return results.flat();
  }

  private async collectSite(site: LeverSite): Promise<CollectedJob[]> {
    const siteName = encodeURIComponent(site.site);
    const url = `https://api.lever.co/v0/postings/${siteName}?mode=json`;
    const response = await this.fetchFn(url);

    if (!response.ok) {
      throw new Error(`Lever API returned ${response.status} ${response.statusText}`);
    }

    const payload: unknown = await response.json();

    if (!Array.isArray(payload)) {
      throw new Error("Lever API response was not an array");
    }

    if (!payload.every(isLeverPosting)) {
      throw new Error("Lever API response contained a malformed posting");
    }

    return (payload as LeverPostingsResponse).map((posting) =>
      this.normalize(posting, site),
    );
  }

  private normalize(posting: LeverPosting, site: LeverSite): CollectedJob {
    return {
      source: this.source,
      externalId: posting.id,
      company: site.companyName,
      title: posting.text,
      location:
        posting.categories?.location ??
        posting.categories?.allLocations?.[0] ??
        null,
      url: posting.hostedUrl ?? posting.applyUrl ?? "",
      description: posting.description ?? null,
      postedAt: null,
      updatedAt: null,
    };
  }
}

function isLeverPosting(value: unknown): value is LeverPosting {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const posting = value as Record<string, unknown>;
  const hasUrl =
    typeof posting.hostedUrl === "string" || typeof posting.applyUrl === "string";

  return typeof posting.id === "string" && typeof posting.text === "string" && hasUrl;
}
