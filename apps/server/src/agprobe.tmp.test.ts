import { it } from "vitest";
import * as Effect from "effect/Effect";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { readAntigravityUsage } from "./provider/Drivers/antigravityUsageReader.ts";

it("probe", { timeout: 900_000 }, async () => {
  const dirs = ["antigravity", "antigravity-cli", "antigravity-ide"].map(
    (n) => `C:/Users/Jacob/.gemini/${n}`,
  );
  const r = await Effect.runPromise(
    readAntigravityUsage(dirs, 0).pipe(Effect.provide(NodeServices.layer)),
  );
  const recs = r.files.flatMap((f) => f.records);
  const sess = new Map<string, { n: number; models: Set<string>; min: number }>();
  for (const x of recs) {
    const s = sess.get(x.sessionId) ?? { n: 0, models: new Set<string>(), min: 1e18 };
    s.n++;
    s.models.add(x.model);
    s.min = Math.min(s.min, x.timestampMs);
    sess.set(x.sessionId, s);
  }
  const top = [...sess.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 6);
  const out = [
    `files=${r.files.length} withRecords=${r.files.filter((f) => f.records.length).length} records=${recs.length} sessions=${sess.size} errors=${r.errors.length}`,
    ...top.map(
      ([k, v]) => `${k.slice(0, 8)} n=${v.n} ${[...v.models].join("|")} ${new Date(v.min).toISOString()}`,
    ),
    ...r.errors.slice(0, 3),
  ];
  console.log("PROBE\n" + out.join("\n"));
});
