"use client";

import { useFormStatus } from "react-dom";

import type { ApplicationStatus } from "../../src/domain/applicationStatus";

const applicationStatusLabels: Record<ApplicationStatus, string> = {
  not_applied: "Not applied",
  applied: "Applied",
  interviewing: "Interviewing",
  rejected: "Rejected",
  offer: "Offer",
};

interface JobTrackingFormProps {
  readonly action: (formData: FormData) => Promise<void>;
  readonly source: string;
  readonly externalId: string;
  readonly applicationStatus: ApplicationStatus;
  readonly notes: string | null;
}

export function JobTrackingForm({
  action,
  source,
  externalId,
  applicationStatus,
  notes,
}: JobTrackingFormProps) {
  return (
    <form action={action} className="job-tracking-form">
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="externalId" value={externalId} />

      <label>
        <span>Status</span>
        <select name="applicationStatus" defaultValue={applicationStatus}>
          {Object.entries(applicationStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Notes</span>
        <textarea name="notes" rows={4} defaultValue={notes ?? ""} />
      </label>

      <TrackingSubmitButton />
      <SavingOverlay />
    </form>
  );
}

function TrackingSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save tracking"}
    </button>
  );
}

function SavingOverlay() {
  const { pending } = useFormStatus();

  if (!pending) {
    return null;
  }

  return (
    <div
      className="tracking-saving-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="tracking-saving-panel">
        <span className="tracking-saving-spinner" aria-hidden="true" />
        <strong>Saving...</strong>
        <span>Please wait</span>
      </div>
    </div>
  );
}
