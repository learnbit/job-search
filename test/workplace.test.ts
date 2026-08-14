import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeWorkplace,
  type WorkplaceType,
} from "../src/normalizers/workplace.js";

const cases: ReadonlyArray<readonly [string | null, WorkplaceType]> = [
  ["Remote", "remote"],
  ["remote - US", "remote"],
  ["Home based - Worldwide", "remote"],
  ["Home Based - Americas", "remote"],
  ["home-based - EMEA", "remote"],
  ["Hybrid", "hybrid"],
  ["Hybrid - New York", "hybrid"],
  ["On-site", "onsite"],
  ["Onsite - London", "onsite"],
  ["San Diego, CA", "unknown"],
  [null, "unknown"],
];

for (const [location, expected] of cases) {
  test(`${JSON.stringify(location)} normalizes to ${expected}`, () => {
    assert.equal(normalizeWorkplace(location), expected);
  });
}
