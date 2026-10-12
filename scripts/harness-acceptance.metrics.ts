export function summarize(samples: readonly number[]) {
  if (samples.length === 0 || samples.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Measurements must contain finite, nonnegative samples");
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = (fraction: number) => sorted[Math.ceil(sorted.length * fraction) - 1]!;
  return {
    count: sorted.length,
    medianMs: rank(0.5),
    p95Ms: rank(0.95),
    minMs: sorted[0]!,
    maxMs: sorted.at(-1)!,
  };
}

/** A noise band is a triage rule, not statistical confidence or a speed claim. */
export function timingVerdict(
  baseline: readonly number[],
  current: readonly number[],
  outputMatches: boolean,
) {
  if (!outputMatches) return "fail-output";
  const before = summarize(baseline);
  const after = summarize(current);
  const exceeds = (a: number, b: number) => a > b + Math.max(0.05, b * 0.2);
  if (exceeds(after.medianMs, before.medianMs) || exceeds(after.p95Ms, before.p95Ms)) {
    return "regression";
  }
  return exceeds(before.medianMs, after.medianMs) && exceeds(before.p95Ms, after.p95Ms)
    ? "improved"
    : "within-noise";
}
