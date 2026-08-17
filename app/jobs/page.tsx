import { jobFilters } from "../../src/config/jobFilters";
import { prisma } from "../../src/db/prisma";
import type { ApplicationStatus } from "../../src/domain/applicationStatus";
import {
  formatDiscoveredDate,
  formatPostedDate,
} from "../../src/domain/jobRecency";
import {
  JobRepository,
  type JobListItem,
} from "../../src/repositories/JobRepository";
import { saveJobTracking } from "./actions";

export const dynamic = "force-dynamic";

const applicationStatusLabels: Record<ApplicationStatus, string> = {
  not_applied: "Not applied",
  applied: "Applied",
  interviewing: "Interviewing",
  rejected: "Rejected",
  offer: "Offer",
};

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

      {job.postedAt === null ? (
        <p className="job-posted-unavailable">
          {formatPostedDate(job.postedAt, now)}
        </p>
      ) : null}

      <form action={saveJobTracking} className="job-tracking-form">
        <input type="hidden" name="source" value={job.source} />
        <input type="hidden" name="externalId" value={job.externalId} />

        <label>
          <span>Status</span>
          <select
            name="applicationStatus"
            defaultValue={job.applicationStatus}
          >
            {Object.entries(applicationStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Notes</span>
          <textarea name="notes" rows={4} defaultValue={job.notes ?? ""} />
        </label>

        <button type="submit">Save tracking</button>
      </form>

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

function formatLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}
