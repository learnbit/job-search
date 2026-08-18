export type JobGeographyHint =
  | { readonly kind: "worldwide" }
  | {
      readonly kind: "possibly_restricted";
      readonly context: string;
    }
  | { readonly kind: "remote_unspecified" }
  | { readonly kind: "unknown" };

const WORLDWIDE_PATTERN = /\b(?:worldwide|global|anywhere)\b/i;
const REMOTE_WORDING_PATTERN =
  /\b(?:remote(?:ly)?|home[\s-]*based|work\s+from\s+home|wfh)\b/gi;
const OTHER_WORKPLACE_PATTERN = /\b(?:hybrid|on[\s-]*site|onsite)\b/gi;
const LOCATION_SEPARATOR_PATTERN = /\s*(?:;|,|·|\/|\||\s[-–—]\s)\s*/;
const UNRELIABLE_CONTEXT_PATTERN =
  /^(?:friendly|flexible|option|optional|available|role|job|position|multiple locations|various locations)$/i;

export function getJobGeographyHint(
  location: string | null,
  workplace: string,
): JobGeographyHint {
  if (workplace !== "remote") {
    return { kind: "unknown" };
  }

  const trimmedLocation = location?.trim();

  if (!trimmedLocation) {
    return { kind: "unknown" };
  }

  if (WORLDWIDE_PATTERN.test(trimmedLocation)) {
    return { kind: "worldwide" };
  }

  const contextParts = trimmedLocation
    .split(LOCATION_SEPARATOR_PATTERN)
    .map(cleanContextPart)
    .filter((part) => part.length > 0 && !UNRELIABLE_CONTEXT_PATTERN.test(part));

  if (contextParts.length === 0) {
    return { kind: "remote_unspecified" };
  }

  return {
    kind: "possibly_restricted",
    context: contextParts.join("; "),
  };
}

function cleanContextPart(part: string): string {
  return part
    .replace(REMOTE_WORDING_PATTERN, "")
    .replace(OTHER_WORKPLACE_PATTERN, "")
    .replace(/^[\s()[\]{}:.-]+|[\s()[\]{}:.-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
