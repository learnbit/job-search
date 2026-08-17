export interface GreenhouseBoard {
  boardToken: string;
  companyName: string;
}

export interface GreenhouseJob {
  id: number;
  title: string;
  location?: {
    name?: string | null;
  } | null;
  absolute_url: string;
  content?: string | null;
  updated_at?: string | null;
}

export interface GreenhouseJobsResponse {
  jobs: GreenhouseJob[];
}

export interface GreenhouseJobDetail {
  id: number;
  first_published?: string | null;
}
