import { describe, expect, it } from "vite-plus/test";
import { parseCsv, summarizePonytail } from "./ponytailUsage.ts";

const HEADER =
  "key,started,project,name,cost_usd,turns,agent_minutes,tokens_total,tokens_output,level";

describe("ponytail usage", () => {
  it("parses quoted fields with commas and doubled quotes", () => {
    expect(parseCsv('a,b\n1,"x, ""y"""\n')).toEqual([
      ["a", "b"],
      ["1", 'x, "y"'],
    ]);
  });

  it("sums rows, lists the newest first and estimates savings at benchmark rates", () => {
    const rows = parseCsv(
      `${HEADER}\nk1,2026-10-18 09:00,p,"first",1.48,2,10,100,1000,full\nk2,2026-10-19 09:00,p,second,2.00,1,5,100,500,full\n`,
    );
    const usage = summarizePonytail(rows, [{ dir: ".claude", enabled: true }]);
    expect(usage.tasks).toBe(2);
    expect(usage.costUsd).toBeCloseTo(3.48);
    expect(usage.recent[0]?.name).toBe("second");
    expect(usage.estimatedSaved.costUsd).toBeCloseTo((3.48 * 0.26) / 0.74);
  });

  it("is missing with no ledger and no enabled account, and survives a bad header", () => {
    expect(summarizePonytail([], []).status).toBe("missing");
    expect(summarizePonytail([["x", "y"]], []).tasks).toBe(0);
  });
});
