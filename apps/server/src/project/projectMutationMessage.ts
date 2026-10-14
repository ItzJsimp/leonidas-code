const FALLBACK_MESSAGE = "Failed to mutate project.";
const MAX_DEPTH = 4;

function messageOf(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "object" && value !== null && "message" in value) {
    const message = (value as { readonly message: unknown }).message;
    return typeof message === "string" ? message.trim() || undefined : undefined;
  }
  return undefined;
}

function causeOf(value: unknown): unknown {
  return typeof value === "object" && value !== null && "cause" in value
    ? (value as { readonly cause: unknown }).cause
    : undefined;
}

/**
 * The text a person should read when a project mutation fails. It walks the cause
 * chain so the real reason (a folder that cannot be created, a path that already
 * belongs to another project) reaches the screen, not a generic message.
 */
export function describeProjectMutationFailure(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < MAX_DEPTH && current !== undefined; depth += 1) {
    const message = messageOf(current);
    if (message !== undefined && !parts.some((part) => part.includes(message))) {
      parts.push(message);
    }
    current = causeOf(current);
  }
  if (parts.length === 0) return FALLBACK_MESSAGE;
  return parts
    .map((part) => (/[.!?]$/.test(part) ? part : `${part}.`))
    .join(" ")
    .trim();
}
