import type { ThreadContextBreakdown } from "@t3tools/contracts";

export interface WasteFinding {
  readonly key: string;
  readonly kind: "repeated-read" | "big-result" | "retry-loop";
  readonly label: string;
  /** Estimated tokens this adds beyond what one clean attempt would. */
  readonly tokens: number;
}

const MIN_REREADS = 3;
const BIG_RESULT_TOKENS = 20_000;
const MIN_RETRIES = 3;
const MAX_FINDINGS = 3;

/**
 * Habits that cost tokens without moving the work: the same file read again and again, one tool
 * result of 20k tokens or more, and the same call failing repeatedly. Estimates only.
 */
export function deriveWasteFindings(
  breakdown: Pick<ThreadContextBreakdown, "files" | "toolCalls">,
): ReadonlyArray<WasteFinding> {
  const findings: WasteFinding[] = [];

  for (const file of breakdown.files) {
    if (file.origin === "memory" || file.readCount < MIN_REREADS) continue;
    findings.push({
      key: `reread:${file.path}`,
      kind: "repeated-read",
      label: `${file.path} read ${file.readCount} times`,
      tokens: file.tokens * (file.readCount - 1),
    });
  }

  const failures = new Map<
    string,
    { name: string; target: string | null; count: number; tokens: number }
  >();
  for (const call of breakdown.toolCalls) {
    const subject = call.target ? `${call.name} ${call.target}` : call.name;
    if (call.tokens >= BIG_RESULT_TOKENS) {
      findings.push({
        key: `big:${call.id}`,
        kind: "big-result",
        label: `${subject} returned a huge result`,
        tokens: call.tokens,
      });
    }
    if (call.status === "error") {
      const key = `${call.name}:${call.target ?? ""}`;
      const entry = failures.get(key) ?? {
        name: call.name,
        target: call.target,
        count: 0,
        tokens: 0,
      };
      failures.set(key, { ...entry, count: entry.count + 1, tokens: entry.tokens + call.tokens });
    }
  }
  for (const [key, entry] of failures) {
    if (entry.count < MIN_RETRIES) continue;
    findings.push({
      key: `retry:${key}`,
      kind: "retry-loop",
      label: `${entry.target ? `${entry.name} ${entry.target}` : entry.name} failed ${entry.count} times`,
      tokens: entry.tokens,
    });
  }

  return findings
    .toSorted((a, b) => b.tokens - a.tokens || a.key.localeCompare(b.key))
    .slice(0, MAX_FINDINGS);
}
