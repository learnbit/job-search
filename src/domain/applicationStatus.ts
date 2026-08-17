export const APPLICATION_STATUSES = [
  "not_applied",
  "applied",
  "interviewing",
  "rejected",
  "offer",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return APPLICATION_STATUSES.some((status) => status === value);
}

export function parseApplicationStatus(value: unknown): ApplicationStatus {
  if (!isApplicationStatus(value)) {
    throw new Error(`Invalid application status: ${String(value)}`);
  }

  return value;
}
