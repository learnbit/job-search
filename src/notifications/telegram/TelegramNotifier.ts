import type { CollectedJob } from "../../collectors/types.js";
import { formatTelegramJobMessage } from "./formatTelegramJobMessage.js";
import type { TelegramConfig } from "./telegramConfig.js";

type Fetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

interface TelegramResponse {
  readonly ok: boolean;
  readonly description?: string;
}

export class TelegramNotifier {
  constructor(
    private readonly config: TelegramConfig,
    private readonly fetchImpl: Fetch = globalThis.fetch,
  ) {}

  async notifyJobs(jobs: readonly CollectedJob[]): Promise<void> {
    for (const job of jobs) {
      await this.notifyJob(job);
    }
  }

  async notifyJob(job: CollectedJob): Promise<void> {
    let response: Response;

    try {
      response = await this.fetchImpl(
        `https://api.telegram.org/bot${this.config.botToken}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: this.config.chatId,
            text: formatTelegramJobMessage(job),
          }),
        },
      );
    } catch {
      throw new Error("Telegram request failed before receiving a response.");
    }

    if (!response.ok) {
      throw new Error(`Telegram API request failed with HTTP ${response.status}.`);
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new Error("Telegram API returned an invalid JSON response.");
    }

    if (!isTelegramResponse(payload) || payload.ok !== true) {
      const description =
        isTelegramResponse(payload) && payload.description
          ? `: ${sanitize(payload.description, this.config.botToken)}`
          : "";
      throw new Error(`Telegram API reported failure${description}.`);
    }
  }
}

function isTelegramResponse(value: unknown): value is TelegramResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).ok === "boolean" &&
    (typeof (value as Record<string, unknown>).description === "string" ||
      (value as Record<string, unknown>).description === undefined)
  );
}

function sanitize(value: string, secret: string): string {
  return value.split(secret).join("[REDACTED]");
}
