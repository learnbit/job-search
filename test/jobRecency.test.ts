import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDiscoveredDate,
  formatPostedDate,
} from "../src/domain/jobRecency.js";

const now = new Date("2026-08-17T18:00:00.000Z");

test("formats a posting from the current UTC day as Posted today", () => {
  assert.equal(
    formatPostedDate(new Date("2026-08-17T01:00:00.000Z"), now),
    "Posted today",
  );
});

test("formats a posting from the previous UTC day as Posted 1 day ago", () => {
  assert.equal(
    formatPostedDate(new Date("2026-08-16T23:00:00.000Z"), now),
    "Posted 1 day ago",
  );
});

test("formats a recent posting as Posted N days ago", () => {
  assert.equal(
    formatPostedDate(new Date("2026-08-12T12:00:00.000Z"), now),
    "Posted 5 days ago",
  );
});

test("formats an old posting as an absolute UTC date", () => {
  assert.equal(
    formatPostedDate(new Date("2026-08-02T12:00:00.000Z"), now),
    "Posted Aug 2, 2026",
  );
});

test("reports when the posted date is unavailable", () => {
  assert.equal(formatPostedDate(null, now), "Posted date unavailable");
});

test("formats discovery within the last hour as just now", () => {
  assert.equal(
    formatDiscoveredDate(new Date("2026-08-17T17:30:00.000Z"), now),
    "Discovered just now",
  );
});

test("formats discovery within the last day in hours", () => {
  assert.equal(
    formatDiscoveredDate(new Date("2026-08-17T16:00:00.000Z"), now),
    "Discovered 2 hours ago",
  );
});

test("formats recent discovery in days", () => {
  assert.equal(
    formatDiscoveredDate(new Date("2026-08-13T17:00:00.000Z"), now),
    "Discovered 4 days ago",
  );
});

test("formats old discovery as an absolute UTC date", () => {
  assert.equal(
    formatDiscoveredDate(new Date("2026-08-02T12:00:00.000Z"), now),
    "Discovered Aug 2, 2026",
  );
});
