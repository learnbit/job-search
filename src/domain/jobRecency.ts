const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;
const RELATIVE_DAY_LIMIT = 7;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatPostedDate(
  postedAt: Date | null,
  now: Date = new Date(),
): string {
  if (postedAt === null) {
    return "Posted date unavailable";
  }

  const daysAgo = Math.max(0, utcDayNumber(now) - utcDayNumber(postedAt));

  if (daysAgo === 0) {
    return "Posted today";
  }

  if (daysAgo === 1) {
    return "Posted 1 day ago";
  }

  if (daysAgo < RELATIVE_DAY_LIMIT) {
    return `Posted ${daysAgo} days ago`;
  }

  return `Posted ${dateFormatter.format(postedAt)}`;
}

export function formatDiscoveredDate(
  createdAt: Date,
  now: Date = new Date(),
): string {
  const elapsedMs = Math.max(0, now.getTime() - createdAt.getTime());
  const hoursAgo = Math.floor(elapsedMs / HOUR_IN_MS);

  if (hoursAgo === 0) {
    return "Discovered just now";
  }

  if (hoursAgo < 24) {
    return `Discovered ${hoursAgo} ${hoursAgo === 1 ? "hour" : "hours"} ago`;
  }

  const daysAgo = Math.floor(elapsedMs / DAY_IN_MS);

  if (daysAgo < RELATIVE_DAY_LIMIT) {
    return `Discovered ${daysAgo} ${daysAgo === 1 ? "day" : "days"} ago`;
  }

  return `Discovered ${dateFormatter.format(createdAt)}`;
}

function utcDayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) /
      DAY_IN_MS,
  );
}
