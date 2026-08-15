import assert from "node:assert/strict";
import test from "node:test";

import type { CollectedJob } from "../src/collectors/types.js";
import { formatTelegramJobMessage } from "../src/notifications/telegram/formatTelegramJobMessage.js";
import { TelegramNotifier } from "../src/notifications/telegram/TelegramNotifier.js";
import { parseTelegramConfig } from "../src/notifications/telegram/telegramConfig.js";

const config = {
  botToken: "secret-bot-token",
  chatId: "123456",
};

test("zero jobs sends no Telegram requests", async () => {
  let requestCount = 0;
  const notifier = new TelegramNotifier(config, async () => {
    requestCount += 1;
    return telegramResponse({ ok: true });
  });

  await notifier.notifyJobs([]);

  assert.equal(requestCount, 0);
});

test("one job sends one POST request with chat ID and formatted fields", async () => {
  const requests: Array<{ input: string | URL; init?: RequestInit }> = [];
  const notifier = new TelegramNotifier(config, async (input, init) => {
    requests.push({ input, ...(init === undefined ? {} : { init }) });
    return telegramResponse({ ok: true });
  });
  const collectedJob = job();

  await notifier.notifyJobs([collectedJob]);

  assert.equal(requests.length, 1);
  const request = requests[0];
  assert.equal(request?.init?.method, "POST");
  assert.equal(
    new Headers(request?.init?.headers).get("Content-Type"),
    "application/json",
  );

  const body = JSON.parse(String(request?.init?.body)) as {
    chat_id: string;
    text: string;
  };
  assert.equal(body.chat_id, config.chatId);
  assert.match(body.text, /Senior Frontend Developer/);
  assert.match(body.text, /Relay/);
  assert.match(body.text, /San Diego, CA/);
  assert.match(body.text, /https:\/\/jobs\.lever\.co\/relay\/123/);
});

test("multiple jobs send one request per job", async () => {
  let requestCount = 0;
  const notifier = new TelegramNotifier(config, async () => {
    requestCount += 1;
    return telegramResponse({ ok: true });
  });

  await notifier.notifyJobs([
    job({ externalId: "one" }),
    job({ externalId: "two" }),
    job({ externalId: "three" }),
  ]);

  assert.equal(requestCount, 3);
});

test("formatter uses a readable fallback for a null location", () => {
  const message = formatTelegramJobMessage(job({ location: null }));

  assert.match(message, /Location not specified/);
  assert.match(message, /Workplace: unknown/);
  assert.match(message, /Source: lever/);
});

test("Telegram ok true is accepted", async () => {
  const notifier = new TelegramNotifier(
    config,
    async () => telegramResponse({ ok: true }),
  );

  await assert.doesNotReject(() => notifier.notifyJob(job()));
});

test("non-2xx Telegram responses fail without exposing the token", async () => {
  const notifier = new TelegramNotifier(
    config,
    async () => telegramResponse({ ok: false }, 401),
  );

  await assert.rejects(
    () => notifier.notifyJob(job()),
    (error: unknown) => {
      assert.match(String(error), /HTTP 401/);
      assert.doesNotMatch(String(error), new RegExp(config.botToken));
      return true;
    },
  );
});

test("Telegram ok false fails and sanitizes the bot token", async () => {
  const notifier = new TelegramNotifier(
    config,
    async () =>
      telegramResponse({
        ok: false,
        description: `invalid token ${config.botToken}`,
      }),
  );

  await assert.rejects(
    () => notifier.notifyJob(job()),
    (error: unknown) => {
      assert.match(String(error), /Telegram API reported failure/);
      assert.match(String(error), /\[REDACTED\]/);
      assert.doesNotMatch(String(error), new RegExp(config.botToken));
      return true;
    },
  );
});

test("network failures use a sanitized error", async () => {
  const notifier = new TelegramNotifier(config, async () => {
    throw new Error(`request included ${config.botToken}`);
  });

  await assert.rejects(
    () => notifier.notifyJob(job()),
    (error: unknown) => {
      assert.match(String(error), /failed before receiving a response/);
      assert.doesNotMatch(String(error), new RegExp(config.botToken));
      return true;
    },
  );
});

test("Telegram configuration requires both credentials", () => {
  assert.throws(
    () => parseTelegramConfig({}),
    /TELEGRAM_BOT_TOKEN is required/,
  );
  assert.throws(
    () => parseTelegramConfig({ TELEGRAM_BOT_TOKEN: "token" }),
    /TELEGRAM_CHAT_ID is required/,
  );
  assert.deepEqual(
    parseTelegramConfig({
      TELEGRAM_BOT_TOKEN: " token ",
      TELEGRAM_CHAT_ID: " chat ",
    }),
    { botToken: "token", chatId: "chat" },
  );
});

function telegramResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function job(overrides: Partial<CollectedJob> = {}): CollectedJob {
  return {
    source: "lever",
    externalId: "123",
    company: "Relay",
    title: "Senior Frontend Developer",
    location: "San Diego, CA",
    workplace: "unknown",
    url: "https://jobs.lever.co/relay/123",
    description: null,
    postedAt: null,
    updatedAt: null,
    ...overrides,
  };
}
