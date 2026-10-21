import { describe, expect, it } from "vite-plus/test";
import { parseCsv, summarizePonytail } from "./ponytailUsage.ts";

const HEADER =
  "key,started,project,name,cost_usd,turns,agent_minutes,tokens_total,tokens_output,reused,new,callers_open,tests,level";
const ACCOUNTS = [
  { id: "claudeAgent", name: "Claude", driver: "claudeAgent", plugin: "on" },
] as const;
const ledger = (...rows: string[]) => parseCsv([HEADER, ...rows].join("\n") + "\n");

describe("ponytail usage", () => {
  it("parses quoted fields with commas and doubled quotes", () => {
    expect(parseCsv('a,b\n1,"x, ""y"""\n')).toEqual([
      ["a", "b"],
      ["1", 'x, "y"'],
    ]);
  });

  it("sums rows, lists the newest first and dates the first log", () => {
    const usage = summarizePonytail(
      ledger(
        'k1,2026-10-18 09:00,p,"first",1.48,2,10,100,1000,0,0,0,not run,full',
        "k2,2026-10-19 09:00,p,second,2.00,1,5,100,500,0,0,0,passed,full",
      ),
      ACCOUNTS,
    );
    expect(usage.tasks).toBe(2);
    expect(usage.costUsd).toBeCloseTo(3.48);
    expect(usage.recent[0]?.name).toBe("second");
    expect(usage.since).toBe("2026-10-18");
  });

  it("measures code tasks apart from the rest and projects the benchmark on them only", () => {
    const usage = summarizePonytail(
      ledger(
        "k1,2026-10-19 09:00,p,fix bug,2.00,1,10,100,1000,3,1,0,passed,full",
        "k2,2026-10-19 10:00,p,audit notes,50.00,1,60,100,9000,0,0,0,not run,full",
        "k3,2026-10-19 11:00,p,add feature,3.00,1,5,100,500,1,3,2,not run,full",
      ),
      ACCOUNTS,
    );
    expect(usage.code).toEqual({
      tasks: 2,
      costUsd: 5,
      agentMinutes: 15,
      outputTokens: 1500,
      reused: 4,
      created: 4,
      callersOpen: 2,
      testsRan: 1,
    });
    expect(usage.projected.costUsd).toBeCloseTo((5 * 0.26) / 0.74);
    expect(usage.projected.agentMinutes).toBeCloseTo((15 * 0.41) / 0.59);
  });

  it("renames skill runs in the recent list", () => {
    const usage = summarizePonytail(
      ledger(
        "k1,2026-10-19 09:00,p,The request mentions skills. A marker,9.00,1,5,100,500,0,0,0,not run,full",
        "k2,2026-10-19 10:00,p,fix bug,1.00,1,5,100,500,1,1,0,passed,full",
      ),
      [],
    );
    expect(usage.recent.map((t) => t.name)).toEqual(["fix bug", "Skill run"]);
  });

  it("reports no tests figure when the ledger has no tests column", () => {
    const rows = parseCsv(
      "key,started,project,name,cost_usd,reused,new,level\nk,2026-10-19 09:00,p,x,1,1,1,full\n",
    );
    expect(summarizePonytail(rows, []).code.testsRan).toBeNull();
  });

  it("is missing with no ledger and no usable account, and survives a bad header", () => {
    expect(summarizePonytail([], []).status).toBe("missing");
    expect(summarizePonytail([["x", "y"]], []).tasks).toBe(0);
  });
});
