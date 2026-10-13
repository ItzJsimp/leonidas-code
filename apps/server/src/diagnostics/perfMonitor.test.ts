// @effect-diagnostics nodeBuiltinImport:off - the test writes and reads real perf logs with node fs.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";

import { PerfMonitor } from "./perfMonitor.ts";

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "perf-"));
  mkdirSync(join(root, "standards"));
  writeFileSync(
    join(root, "standards", "perf-thresholds.json"),
    JSON.stringify({
      defaults: {
        baseline_window_days: 7,
        baseline_min_samples: 20,
        baseline_multiplier: 3,
        baseline_floor_ms: 2000,
        escalate_n: 3,
        escalate_m: 10,
        cooldown_minutes: 30,
      },
      metrics: { "t.metric": { critical_ms: 15000 } },
    }),
  );
  return root;
}

describe("PerfMonitor", () => {
  it("logs every event, flags a single critical as a spike and escalates a recurrence", () => {
    const root = makeRoot();
    const alerts: string[] = [];
    const perf = new PerfMonitor("test", { root, onAlert: (kind) => alerts.push(kind) });

    expect([800, 900].map((v) => perf.record("t.metric", v))).toEqual(["ok", "ok"]);
    expect(perf.record("t.metric", 16000)).toBe("critical");
    expect(alerts).toEqual(["spike"]);

    perf.record("t.metric", 17000);
    perf.record("t.metric", 17000);
    expect(alerts).toEqual(["spike", "escalated"]);

    const lines = readFileSync(join(root, "logs", "perf-events.jsonl"), "utf8")
      .trim()
      .split("\n");
    expect(lines).toHaveLength(5);
    expect(JSON.parse(lines[2] as string)).toMatchObject({
      metric: "t.metric",
      state: "critical",
      value_ms: 16000,
    });
  });

  it("flags values far above the rolling baseline without an absolute threshold", () => {
    const root = makeRoot();
    const perf = new PerfMonitor("test", { root });
    for (let i = 0; i < 25; i++) perf.record("t.other", 1000);
    // Cached baseline predates the samples above, so a fresh monitor sees the 25-sample history.
    const fresh = new PerfMonitor("test", { root });
    expect(fresh.record("t.other", 9000)).toBe("slow");
    expect(fresh.record("t.other", 1500)).toBe("ok");
  });
});
