import assert from "node:assert/strict";
import test from "node:test";

import type { AshbyBoard } from "../src/collectors/ashby/types.js";
import type { GreenhouseBoard } from "../src/collectors/greenhouse/types.js";
import type { LeverSite } from "../src/collectors/lever/types.js";
import {
  companies,
  getAshbyBoards,
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
const ashbyCompany: CompanySource = {
  companyName: "Ashby Company",
  ats: "ashby",
  jobBoardName: "ashby-board",
};
const mixedCompanies: readonly CompanySource[] = [
  greenhouseCompany,
  leverCompany,
  ashbyCompany,
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

test("converts only Ashby entries to AshbyBoard objects", () => {
  const boards: AshbyBoard[] = getAshbyBoards(mixedCompanies);

  assert.deepEqual(boards, [
    {
      jobBoardName: "ashby-board",
      companyName: "Ashby Company",
    },
  ]);
});

test("preserves configured company names and ATS identifiers exactly", () => {
  assert.equal(companies.length, 15);
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
  assert.deepEqual(getAshbyBoards(companies), [
    { jobBoardName: "ashby", companyName: "Ashby" },
    { jobBoardName: "bem", companyName: "bem" },
    { jobBoardName: "substrate-bio", companyName: "Substrate Bio" },
    { jobBoardName: "angi", companyName: "Angi" },
  ]);
});

test("configured ATS identifiers are unique within each provider", () => {
  const greenhouseBoardTokens = getGreenhouseBoards(companies).map(
    (board) => board.boardToken,
  );
  const leverSites = getLeverSites(companies).map((site) => site.site);
  const ashbyBoardNames = getAshbyBoards(companies).map(
    (board) => board.jobBoardName,
  );

  assert.equal(
    new Set(greenhouseBoardTokens).size,
    greenhouseBoardTokens.length,
  );
  assert.equal(new Set(leverSites).size, leverSites.length);
  assert.equal(new Set(ashbyBoardNames).size, ashbyBoardNames.length);
});

test("returns empty arrays for empty input", () => {
  assert.deepEqual(getGreenhouseBoards([]), []);
  assert.deepEqual(getLeverSites([]), []);
  assert.deepEqual(getAshbyBoards([]), []);
});
