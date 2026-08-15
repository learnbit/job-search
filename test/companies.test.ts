import assert from "node:assert/strict";
import test from "node:test";

import type { GreenhouseBoard } from "../src/collectors/greenhouse/types.js";
import type { LeverSite } from "../src/collectors/lever/types.js";
import {
  companies,
  getGreenhouseBoards,
  getLeverSites,
  type CompanySource,
} from "../src/registry/companies.js";

const greenhouseCompany: CompanySource = {
  companyName: "Greenhouse Company",
  ats: "greenhouse",
  boardToken: "greenhouse-token",
};
const leverCompany: CompanySource = {
  companyName: "Lever Company",
  ats: "lever",
  site: "lever-site",
};
const mixedCompanies: readonly CompanySource[] = [
  greenhouseCompany,
  leverCompany,
];

test("converts only Greenhouse entries to GreenhouseBoard objects", () => {
  const boards: GreenhouseBoard[] = getGreenhouseBoards(mixedCompanies);

  assert.deepEqual(boards, [
    {
      boardToken: "greenhouse-token",
      companyName: "Greenhouse Company",
    },
  ]);
});

test("converts only Lever entries to LeverSite objects", () => {
  const sites: LeverSite[] = getLeverSites(mixedCompanies);

  assert.deepEqual(sites, [
    {
      site: "lever-site",
      companyName: "Lever Company",
    },
  ]);
});

test("preserves configured company names and ATS identifiers exactly", () => {
  assert.equal(companies.length, 11);
  assert.deepEqual(getGreenhouseBoards(companies), [
    { boardToken: "canonical", companyName: "Canonical" },
    { boardToken: "gleanwork", companyName: "Glean" },
    { boardToken: "trivelta", companyName: "Trivelta" },
    { boardToken: "moniepoint", companyName: "Moniepoint" },
    { boardToken: "nomina", companyName: "Nomina" },
    { boardToken: "startale", companyName: "Startale Group" },
    { boardToken: "techholding", companyName: "Tech Holding" },
  ]);
  assert.deepEqual(getLeverSites(companies), [
    { site: "relay", companyName: "Relay" },
    { site: "bluelightconsulting", companyName: "Bluelight Consulting" },
    { site: "xsolla", companyName: "Xsolla" },
    { site: "firstup", companyName: "Firstup" },
  ]);
});

test("configured ATS identifiers are unique within each provider", () => {
  const greenhouseBoardTokens = getGreenhouseBoards(companies).map(
    (board) => board.boardToken,
  );
  const leverSites = getLeverSites(companies).map((site) => site.site);

  assert.equal(
    new Set(greenhouseBoardTokens).size,
    greenhouseBoardTokens.length,
  );
  assert.equal(new Set(leverSites).size, leverSites.length);
});

test("returns empty arrays for empty input", () => {
  assert.deepEqual(getGreenhouseBoards([]), []);
  assert.deepEqual(getLeverSites([]), []);
});
