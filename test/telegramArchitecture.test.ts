import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("migration backfills the existing baseline without defaulting new jobs", async () => {
  const migration = await readFile(
    "prisma/migrations/20260815010000_add_telegram_notification_state/migration.sql",
    "utf8",
  );

  assert.match(
    migration,
    /ADD COLUMN "telegramNotifiedAt" TIMESTAMP\(3\)/,
  );
  assert.match(
    migration,
    /UPDATE "Job"\s+SET "telegramNotifiedAt" = CURRENT_TIMESTAMP/,
  );
  assert.doesNotMatch(migration, /telegramNotifiedAt[^;]*DEFAULT/i);
  assert.ok(migration.indexOf("ADD COLUMN") < migration.indexOf("UPDATE \"Job\""));
});

test("playground has no Telegram notification wiring", async () => {
  const playground = await readFile("src/playground.ts", "utf8");

  assert.doesNotMatch(playground, /TelegramNotifier|deliverTelegramAlerts/);
});
