import type { WorkplaceType } from "../normalizers/workplace.js";

export interface CollectedJob {
  source: string;
  externalId: string;
  company: string;
  title: string;
  location: string | null;
  workplace: WorkplaceType;
  url: string;
  description: string | null;
  postedAt: string | null;
  updatedAt: string | null;
}

export interface JobCollector<TConfig> {
  readonly source: string;

  collect(config: TConfig): Promise<CollectedJob[]>;
}
