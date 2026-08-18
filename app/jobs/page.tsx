import { jobFilters } from "../../src/config/jobFilters";
import { prisma } from "../../src/db/prisma";
import {
  getJobGeographyHint,
  type JobGeographyHint,
} from "../../src/domain/jobGeography";
import {
  formatDiscoveredDate,
  formatPostedDate,
} from "../../src/domain/jobRecency";
import {
  JobRepository,
  type JobListItem,
} from "../../src/repositories/JobRepository";
import { saveJobTracking } from "./actions";
import { JobTrackingForm } from "./JobTrackingForm";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const repository = new JobRepository(prisma);
  const jobs = await repository.findJobsForList(jobFilters);
  const now = new Date();

  return (
    <section className="jobs-page">
      <h1>Jobs</h1>
      <p className="jobs-summary">
        Showing {jobs.length} matching {jobs.length === 1 ? "job" : "jobs"}.
      </p>

      {jobs.length === 0 ? (
        <p>No matching jobs found.</p>
      ) : (
        <ul className="jobs-list">
          {jobs.map((job) => (
            <li key={`${job.source}:${job.externalId}`}>
              <JobCard job={job} now={now} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function JobCard({ job, now }: { job: JobListItem; now: Date }) {
  const discoveredLabel = formatDiscoveredDate(job.createdAt, now);
  const geographyHint = getJobGeographyHint(job.location, job.workplace);

  return (
    <article className="job-card">
      <header className="job-card-header">
        <h2>{job.title}</h2>
        <p>{job.company}</p>
      </header>

      <div className="job-recency">
        {job.postedAt === null ? (
          <p className="job-recency-primary">{discoveredLabel}</p>
        ) : (
          <>
            <p className="job-recency-primary">
              {formatPostedDate(job.postedAt, now)}
            </p>
            <p className="job-recency-secondary">{discoveredLabel}</p>
          </>
        )}
      </div>

      <dl className="job-details">
        <div>
          <dt>Location</dt>
          <dd>{job.location ?? "Location not specified"}</dd>
        </div>
        <div>
          <dt>Workplace</dt>
          <dd>{formatLabel(job.workplace)}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{formatLabel(job.source)}</dd>
        </div>
      </dl>

      <GeographyHint hint={geographyHint} />

      {job.postedAt === null ? (
        <p className="job-posted-unavailable">
          {formatPostedDate(job.postedAt, now)}
        </p>
      ) : null}

      <JobTrackingForm
        key={JSON.stringify([job.applicationStatus, job.notes])}
        action={saveJobTracking}
        source={job.source}
        externalId={job.externalId}
        applicationStatus={job.applicationStatus}
        notes={job.notes}
      />

      <a
        className="job-link"
        href={job.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open Job
      </a>
    </article>
  );
}

function GeographyHint({ hint }: { hint: JobGeographyHint }) {
  if (hint.kind === "worldwide") {
    return (
      <p className="job-geo-hint job-geo-worldwide">
        <span aria-hidden="true">🌍</span> Worldwide remote
      </p>
    );
  }

  if (hint.kind === "possibly_restricted") {
    return (
      <p className="job-geo-hint job-geo-warning">
        <span aria-hidden="true">⚠</span> May be geographically restricted:{" "}
        {hint.context}
      </p>
    );
  }

  return null;
}

function formatLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}
