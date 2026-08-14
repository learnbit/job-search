export interface LeverSite {
  site: string;
  companyName: string;
}

export interface LeverPosting {
  id: string;
  text: string;
  categories?: {
    location?: string | null;
    allLocations?: string[] | null;
  } | null;
  hostedUrl?: string | null;
  applyUrl?: string | null;
  description?: string | null;
}

export type LeverPostingsResponse = LeverPosting[];
