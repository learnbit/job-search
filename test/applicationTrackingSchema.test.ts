import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Job application tracking fields have safe defaults", async () => {
  const schema = await readFile("prisma/schema.prisma", "utf8");
  const migration = await readFile(
    "prisma/migrations/20260815161327_add_application_tracking/migration.sql",
    "utf8",
  );

  assert.match(
    schema,
    /applicationStatus\s+String\s+@default\("not_applied"\)/,
  );
  assert.match(schema, /appliedAt\s+DateTime\?/);
  assert.match(
    migration,
    /"applicationStatus" TEXT NOT NULL DEFAULT 'not_applied'/,
  );
  assert.match(migration, /"appliedAt" TIMESTAMP\(3\)/);
});

test("Job notes are nullable and added by a focused migration", async () => {
  const schema = await readFile("prisma/schema.prisma", "utf8");
  const migration = await readFile(
    "prisma/migrations/20260817163921_add_job_notes/migration.sql",
    "utf8",
  );

  assert.match(schema, /notes\s+String\?/);
  assert.match(migration, /ADD COLUMN\s+"notes" TEXT/);
});
