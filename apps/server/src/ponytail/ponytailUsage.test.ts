import { describe, expect, it } from "vite-plus/test";
import { parseCsv, summarizePonytail } from "./ponytailUsage.ts";

const HEADER =
  "key,started,project,name,cost_usd,turns,agent_minutes,tokens_total,tokens_output,tests,level";

describe("ponytail usage", () => {
  it("parses quoted fields with commas and doubled quotes", () => {
    expect(parseCsv('a,b\n1,"x, ""y"""\n')).toEqual([
      ["a", "b"],
      ["1", 'x, "y"'],
    ]);
  });

  it("sums rows, lists the newest first and reports facts, not estimated savings", () => {
    const rows = parseCsv(
      `${HEADER}\nk1,2026-10-18 09:00,p,"first",1.48,2,10,100,1000,not run,full\nk2,2026-10-19 09:00,p,second,2.00,1,5,100,500,passed,full\n`,
    );
    const usage = summarizePonytail(rows, [
      { id: "claudeAgent", name: "Claude", driver: "claudeAgent", plugin: "on" },
    ]);
    expect(usage.tasks).toBe(2);
    expect(usage.costUsd).toBeCloseTo(3.48);
    expect(usage.recent[0]?.name).toBe("second");
    expect(usage.since).toBe("2026-10-18");
    expect(usage.testsRan).toBe(1);
    expect(usage).not.toHaveProperty("estimatedSaved");
  });

  it("separates skill runs and renames them in the recent list", () => {
    const rows = parseCsv(
      `${HEADER}\nk1,2026-10-19 09:00,p,The request mentions skills. A marker,9.00,1,5,100,500,not run,full\nk2,2026-10-19 10:00,p,fix bug,1.00,1,5,100,500,passed,full\n`,
    );
    const usage = summarizePonytail(rows, []);
    expect(usage.skillRuns).toEqual({ tasks: 1, costUsd: 9 });
    expect(usage.recent.map((t) => t.name)).toEqual(["fix bug", "Skill run"]);
  });

  it("reports no tests figure when the ledger has no tests column", () => {
    const rows = parseCsv(
      "key,started,project,name,cost_usd,level\nk,2026-10-19 09:00,p,x,1,full\n",
    );
    expect(summarizePonytail(rows, []).testsRan).toBeNull();
  });

  it("is missing with no ledger and no enabled account, and survives a bad header", () => {
    expect(summarizePonytail([], []).status).toBe("missing");
    expect(summarizePonytail([["x", "y"]], []).tasks).toBe(0);
  });
});
