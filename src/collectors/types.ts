export interface CollectedJob {
  source: string;
  externalId: string;
  company: string;
  title: string;
  location: string | null;
  url: string;
  description: string | null;
  postedAt: string | null;
}

export interface JobCollector<TConfig> {
  readonly source: string;

  collect(config: TConfig): Promise<CollectedJob[]>;
}
