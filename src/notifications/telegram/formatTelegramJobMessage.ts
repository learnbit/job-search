import type { CollectedJob } from "../../collectors/types.js";

export function formatTelegramJobMessage(job: CollectedJob): string {
  return [
    "🆕 New Job Found",
    "",
    job.title,
    job.company,
    "",
    `📍 ${job.location ?? "Location not specified"}`,
    `🏠 Workplace: ${job.workplace}`,
    `🔎 Source: ${job.source}`,
    "",
    job.url,
  ].join("\n");
}
