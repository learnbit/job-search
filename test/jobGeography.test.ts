import assert from "node:assert/strict";
import test from "node:test";

import { getJobGeographyHint } from "../src/domain/jobGeography.js";

test("classifies Home based - Worldwide as worldwide", () => {
  assert.deepEqual(getJobGeographyHint("Home based - Worldwide", "remote"), {
    kind: "worldwide",
  });
});

test("classifies Global Remote as worldwide", () => {
  assert.deepEqual(getJobGeographyHint("Global Remote", "remote"), {
    kind: "worldwide",
  });
});

test("keeps plain Remote geographically unspecified", () => {
  assert.deepEqual(getJobGeographyHint("Remote", "remote"), {
    kind: "remote_unspecified",
  });
});

test("extracts UK from Remote - UK", () => {
  assert.deepEqual(getJobGeographyHint("Remote - UK", "remote"), {
    kind: "possibly_restricted",
    context: "UK",
  });
});

test("extracts Pakistan from Remote, Pakistan", () => {
  assert.deepEqual(getJobGeographyHint("Remote, Pakistan", "remote"), {
    kind: "possibly_restricted",
    context: "Pakistan",
  });
});

test("extracts Serbia from Serbia · Remote", () => {
  assert.deepEqual(getJobGeographyHint("Serbia · Remote", "remote"), {
    kind: "possibly_restricted",
    context: "Serbia",
  });
});

test("preserves multiple contexts around a remote segment", () => {
  assert.deepEqual(
    getJobGeographyHint("Japan; Remote; Singapore", "remote"),
    {
      kind: "possibly_restricted",
      context: "Japan; Singapore",
    },
  );
});

test("extracts EMEA from Remote - EMEA", () => {
  assert.deepEqual(getJobGeographyHint("Remote - EMEA", "remote"), {
    kind: "possibly_restricted",
    context: "EMEA",
  });
});

test("returns unknown for a missing location", () => {
  assert.deepEqual(getJobGeographyHint(null, "remote"), { kind: "unknown" });
});

test("does not generate a remote hint for an onsite job", () => {
  assert.deepEqual(getJobGeographyHint("London", "onsite"), {
    kind: "unknown",
  });
});

test("does not treat ambiguous workplace wording as geography", () => {
  assert.deepEqual(getJobGeographyHint("Remote / Hybrid", "remote"), {
    kind: "remote_unspecified",
  });
});
