import { describe, expect, it } from "@effect/vitest";

import { summarizeUsage } from "./layaUsage.ts";

const NOW = Date.UTC(2026, 9, 17, 12, 0, 0);
const row = (job: string, verdict: string, ageDays = 0) =>
  JSON.stringify({
    ts: (NOW - ageDays * 86_400_000) / 1000,
    job,
    verdict,
    tier: "rules",
    project: "p",
  });
const ready = { modelPresent: true, packPresent: true };

describe("summarizeUsage", () => {
  it("returns a valid empty result for no lines", () => {
    const s = summarizeUsage([], NOW, ready);
    expect(s.total).toBe(0);
    expect(s.jobs).toEqual([]);
    expect(s.days).toHaveLength(7);
    expect(s.status).toBe("ready");
  });

  it("counts blocks, asks and flags per job and sorts by volume", () => {
    const s = summarizeUsage(
      [
        row("bash_gate", "BLOCK"),
        row("bash_gate", "CONFIRM"),
        row("bash_gate", "ALLOW"),
        row("screen", "FLAGGED"),
      ],
      NOW,
      ready,
    );
    expect(s.jobs[0]).toEqual({ job: "bash_gate", count: 3, blocked: 1, asked: 1, flagged: 0 });
    expect(s.jobs[1]).toMatchObject({ job: "screen", flagged: 1 });
  });

  it("skips torn and malformed lines", () => {
    const s = summarizeUsage(
      ['{"ts":1', "not json", "null", '{"ts":"x"}', row("screen", "CLEAN")],
      NOW,
      ready,
    );
    expect(s.total).toBe(1);
  });

  it("buckets by day and keeps only 7 days in the day list", () => {
    const s = summarizeUsage(
      [row("screen", "CLEAN", 0), row("screen", "CLEAN", 2), row("screen", "CLEAN", 30)],
      NOW,
      ready,
    );
    expect(s.total).toBe(3);
    expect(s.days.reduce((n, d) => n + d.count, 0)).toBe(2);
  });

  it("reports missing when the pack or model is absent", () => {
    expect(summarizeUsage([], NOW, { modelPresent: false, packPresent: true }).status).toBe(
      "missing",
    );
    expect(summarizeUsage([], NOW, { modelPresent: true, packPresent: false }).status).toBe(
      "missing",
    );
  });
});
