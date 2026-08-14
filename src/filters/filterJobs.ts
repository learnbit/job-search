import type { CollectedJob } from "../collectors/types.js";

export interface JobFilters {
  keywords?: readonly string[];
  country?: string;
  remoteOnly?: boolean;
}

export function filterJobs(
  jobs: readonly CollectedJob[],
  filters: JobFilters,
): CollectedJob[] {
  const keywords = (filters.keywords ?? [])
    .map((keyword) => keyword.trim().toLowerCase())
    .filter((keyword) => keyword.length > 0);
  const country = filters.country?.trim().toLowerCase() || null;

  return jobs.filter((job) => {
    if (keywords.length > 0) {
      const searchableText = `${job.title}\n${job.description ?? ""}`.toLowerCase();

      if (!keywords.some((keyword) => searchableText.includes(keyword))) {
        return false;
      }
    }

    const location = job.location?.toLowerCase() ?? null;

    // This is intentionally a first-pass text match, not geographic normalization.
    if (country !== null && (location === null || !location.includes(country))) {
      return false;
    }

    if (filters.remoteOnly === true) {
      if (location === null || !/\bremote\b/i.test(location)) {
        return false;
      }
    }

    return true;
  });
}
