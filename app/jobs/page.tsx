import { jobFilters } from "../../src/config/jobFilters";
import { prisma } from "../../src/db/prisma";
import type { ApplicationStatus } from "../../src/domain/applicationStatus";
import {
  JobRepository,
  type JobListItem,
} from "../../src/repositories/JobRepository";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

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
              <JobCard job={job} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function JobCard({ job }: { job: JobListItem }) {
  return (
    <article className="job-card">
      <header className="job-card-header">
        <h2>{job.title}</h2>
        <p>{job.company}</p>
      </header>

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
        <div>
          <dt>Status</dt>
          <dd>{applicationStatusLabels[job.applicationStatus]}</dd>
        </div>
        {job.postedAt === null ? null : (
          <div>
            <dt>Posted</dt>
            <dd>{dateFormatter.format(job.postedAt)}</dd>
          </div>
        )}
      </dl>

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
