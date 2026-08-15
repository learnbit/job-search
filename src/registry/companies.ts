import type { AshbyBoard } from "../collectors/ashby/types.js";
import type { GreenhouseBoard } from "../collectors/greenhouse/types.js";
import type { LeverSite } from "../collectors/lever/types.js";

export type CompanySource =
  | {
      readonly companyName: string;
      readonly ats: "greenhouse";
      readonly boardToken: string;
    }
  | {
      readonly companyName: string;
      readonly ats: "lever";
      readonly site: string;
    }
  | {
      readonly companyName: string;
      readonly ats: "ashby";
      readonly jobBoardName: string;
    };

export const companies: readonly CompanySource[] = [
  {
    companyName: "Canonical",
    ats: "greenhouse",
    boardToken: "canonical",
  },
  {
    companyName: "Glean",
    ats: "greenhouse",
    boardToken: "gleanwork",
  },
  {
    companyName: "Trivelta",
    ats: "greenhouse",
    boardToken: "trivelta",
  },
  {
    companyName: "Moniepoint",
    ats: "greenhouse",
    boardToken: "moniepoint",
  },
  {
    companyName: "Nomina",
    ats: "greenhouse",
    boardToken: "nomina",
  },
  {
    companyName: "Startale Group",
    ats: "greenhouse",
    boardToken: "startale",
  },
  {
    companyName: "Tech Holding",
    ats: "greenhouse",
    boardToken: "techholding",
  },
  {
    companyName: "Relay",
    ats: "lever",
    site: "relay",
  },
  {
    companyName: "Bluelight Consulting",
    ats: "lever",
    site: "bluelightconsulting",
  },
  {
    companyName: "Xsolla",
    ats: "lever",
    site: "xsolla",
  },
  {
    companyName: "Firstup",
    ats: "lever",
    site: "firstup",
  },
  {
    companyName: "Ashby",
    ats: "ashby",
    jobBoardName: "ashby",
  },
  {
    companyName: "bem",
    ats: "ashby",
    jobBoardName: "bem",
  },
  {
    companyName: "Substrate Bio",
    ats: "ashby",
    jobBoardName: "substrate-bio",
  },
  {
    companyName: "Angi",
    ats: "ashby",
    jobBoardName: "angi",
  },
];

export function getGreenhouseBoards(
  sources: readonly CompanySource[],
): GreenhouseBoard[] {
  return sources.flatMap((source) =>
    source.ats === "greenhouse"
      ? [{ boardToken: source.boardToken, companyName: source.companyName }]
      : [],
  );
}

export function getLeverSites(
  sources: readonly CompanySource[],
): LeverSite[] {
  return sources.flatMap((source) =>
    source.ats === "lever"
      ? [{ site: source.site, companyName: source.companyName }]
      : [],
  );
}

export function getAshbyBoards(
  sources: readonly CompanySource[],
): AshbyBoard[] {
  return sources.flatMap((source) =>
    source.ats === "ashby"
      ? [
          {
            jobBoardName: source.jobBoardName,
            companyName: source.companyName,
          },
        ]
      : [],
  );
}
