import type { CollectedJob } from "../collectors/types.js";
import type { WorkplaceType } from "../normalizers/workplace.js";

export interface JobFilters {
  titleKeywords?: readonly string[];
  skills?: readonly string[];
  country?: string;
  workplaces?: readonly WorkplaceType[];
}

export function filterJobs(
  jobs: readonly CollectedJob[],
  filters: JobFilters,
): CollectedJob[] {
  const titleKeywords = normalizeTerms(filters.titleKeywords);
  const skills = normalizeTerms(filters.skills);
  const country = filters.country?.trim().toLowerCase() || null;
  const workplaces = new Set(filters.workplaces ?? []);

  return jobs.filter((job) => {
    const title = job.title.toLowerCase();

    if (
      titleKeywords.length > 0 &&
      !titleKeywords.some((keyword) => title.includes(keyword))
    ) {
      return false;
    }

    if (skills.length > 0) {
      const searchableText = `${job.title}\n${job.description ?? ""}`.toLowerCase();

      if (!skills.some((skill) => searchableText.includes(skill))) {
        return false;
      }
    }

    const location = job.location?.toLowerCase() ?? null;

    // This is intentionally a first-pass text match, not geographic normalization.
    if (country !== null && (location === null || !location.includes(country))) {
      return false;
    }

    if (workplaces.size > 0 && !workplaces.has(job.workplace)) {
      return false;
    }

    return true;
  });
}

function normalizeTerms(terms: readonly string[] | undefined): string[] {
  return (terms ?? [])
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length > 0);
}
