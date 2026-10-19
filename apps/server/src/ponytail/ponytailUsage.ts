// @effect-diagnostics nodeBuiltinImport:off globalDate:off - reads local files on request; a missing or torn file gives an empty result, never an error.
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import type { PonytailUsage } from "@t3tools/contracts";

const RECENT = 10;
const MAX_LEDGER_BYTES = 4_000_000;
/** Published Ponytail 5 benchmark: share of the no-skill baseline that remains. */
const BENCHMARK = { cost: 0.74, time: 0.59, output: 0.55 } as const;

/** Splits CSV text into rows, honoring quoted fields that hold commas, quotes or newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1) rows.push(row);
  }
  return rows;
}

const num = (value: string | undefined): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Turns ledger rows (header first) into the card numbers. Short or bad rows are skipped. */
export function summarizePonytail(
  rows: ReadonlyArray<ReadonlyArray<string>>,
  accounts: PonytailUsage["accounts"],
): PonytailUsage {
  const header = rows[0] ?? [];
  const col = (name: string) => header.indexOf(name);
  const idx = {
    started: col("started"),
    project: col("project"),
    name: col("name"),
    cost: col("cost_usd"),
    turns: col("turns"),
    minutes: col("agent_minutes"),
    out: col("tokens_output"),
    level: col("level"),
  };
  const tasks = (idx.cost < 0 ? [] : rows.slice(1)).map((r) => ({
    started: r[idx.started] ?? "",
    project: r[idx.project] ?? "",
    name: (r[idx.name] ?? "").slice(0, 80),
    costUsd: num(r[idx.cost]),
    turns: num(r[idx.turns]),
    agentMinutes: num(r[idx.minutes]),
    outputTokens: num(r[idx.out]),
    level: r[idx.level] ?? "",
  }));
  const sum = (pick: (t: (typeof tasks)[number]) => number) =>
    tasks.reduce((total, t) => total + pick(t), 0);
  const costUsd = sum((t) => t.costUsd);
  const agentMinutes = sum((t) => t.agentMinutes);
  const outputTokens = sum((t) => t.outputTokens);
  const saved = (used: number, kept: number) => (used * (1 - kept)) / kept;
  return {
    status: tasks.length > 0 || accounts.some((a) => a.enabled) ? "ready" : "missing",
    accounts: [...accounts],
    providers: [],
    tasks: tasks.length,
    costUsd,
    agentMinutes,
    outputTokens,
    estimatedSaved: {
      costUsd: saved(costUsd, BENCHMARK.cost),
      agentMinutes: saved(agentMinutes, BENCHMARK.time),
      outputTokens: Math.round(saved(outputTokens, BENCHMARK.output)),
    },
    recent: tasks.toSorted((a, b) => b.started.localeCompare(a.started)).slice(0, RECENT),
  };
}

async function readAccounts(home: string): Promise<PonytailUsage["accounts"]> {
  const names = (await NodeFSP.readdir(home).catch(() => [])).filter((n) =>
    n.startsWith(".claude"),
  );
  const accounts: PonytailUsage["accounts"][number][] = [];
  for (const name of names) {
    try {
      const settings = JSON.parse(
        await NodeFSP.readFile(NodePath.join(home, name, "settings.json"), "utf8"),
      );
      accounts.push({
        dir: name,
        enabled: settings?.enabledPlugins?.["ponytail@ponytail"] === true,
      });
    } catch {
      // Not a Claude config folder.
    }
  }
  return accounts;
}

export async function readPonytailUsage(): Promise<PonytailUsage> {
  const home = NodeOS.homedir();
  const dir = NodePath.join(home, ".config", "ponytail", "band");
  const rows: string[][] = [];
  for (const file of (await NodeFSP.readdir(dir).catch(() => [])).filter((f) =>
    f.endsWith(".csv"),
  )) {
    try {
      const text = await NodeFSP.readFile(NodePath.join(dir, file), "utf8");
      if (text.length > MAX_LEDGER_BYTES) continue;
      const parsed = parseCsv(text);
      rows.push(...(rows.length === 0 ? parsed : parsed.slice(1)));
    } catch {
      // A torn file is skipped.
    }
  }
  return summarizePonytail(rows, await readAccounts(home));
}
