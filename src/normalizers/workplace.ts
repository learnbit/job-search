export type WorkplaceType = "remote" | "hybrid" | "onsite" | "unknown";

export function normalizeWorkplace(location: string | null): WorkplaceType {
  if (location === null) {
    return "unknown";
  }

  if (/\bremote\b/i.test(location) || /\bhome[\s-]+based\b/i.test(location)) {
    return "remote";
  }

  if (/\bhybrid\b/i.test(location)) {
    return "hybrid";
  }

  if (/\bon[\s-]?site\b/i.test(location)) {
    return "onsite";
  }

  return "unknown";
}
