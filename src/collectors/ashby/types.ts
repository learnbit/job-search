export interface AshbyBoard {
  readonly jobBoardName: string;
  readonly companyName: string;
}

export interface AshbyPosting {
  readonly id: string;
  readonly title: string;
  readonly location?: string | null;
  readonly workplaceType?: string | null;
  readonly jobUrl?: string | null;
  readonly applyUrl?: string | null;
  readonly descriptionPlain?: string | null;
  readonly descriptionHtml?: string | null;
  readonly publishedAt?: string | null;
}

export interface AshbyJobBoardResponse {
  readonly jobs: AshbyPosting[];
}
