// @effect-diagnostics nodeBuiltinImport:off globalDate:off - reads local files on request; a missing or torn file gives an empty result, never an error.
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import type { PonytailUsage } from "@t3tools/contracts";

const RECENT = 10;
const MAX_LEDGER_BYTES = 4_000_000;
/** The ledger names a task by its first prompt line; a skill run opens with this preamble. */
const SKILL_PREAMBLE = "The request mentions skills";

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
    tests: col("tests"),
  };
  const tasks = (idx.cost < 0 ? [] : rows.slice(1)).map((r) => ({
    started: r[idx.started] ?? "",
    project: r[idx.project] ?? "",
    skillRun: (r[idx.name] ?? "").startsWith(SKILL_PREAMBLE),
    testsRan: idx.tests >= 0 && (r[idx.tests] ?? "") !== "" && r[idx.tests] !== "not run",
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
  const skillRuns = tasks.filter((t) => t.skillRun);
  return {
    status: tasks.length > 0 || accounts.some((a) => a.plugin === "on") ? "ready" : "missing",
    accounts: [...accounts],
    since:
      tasks
        .map((t) => t.started.slice(0, 10))
        .filter(Boolean)
        .toSorted()[0] ?? "",
    providersBefore: [],
    providers: [],
    tasks: tasks.length,
    costUsd,
    agentMinutes,
    outputTokens,
    testsRan: idx.tests < 0 ? null : tasks.filter((t) => t.testsRan).length,
    skillRuns: {
      tasks: skillRuns.length,
      costUsd: skillRuns.reduce((total, t) => total + t.costUsd, 0),
    },
    recent: tasks
      .toSorted((a, b) => b.started.localeCompare(a.started))
      .slice(0, RECENT)
      .map(({ skillRun, testsRan: _ran, ...t }) => ({
        ...t,
        name: skillRun ? "Skill run" : t.name,
      })),
  };
}

/** The plugin writes its ledger under XDG_CONFIG_HOME, else ~/.config, on every platform. */
export const ponytailLedgerDir = (env: NodeJS.ProcessEnv = process.env): string =>
  NodePath.join(
    env.XDG_CONFIG_HOME || NodePath.join(NodeOS.homedir(), ".config"),
    "ponytail",
    "band",
  );

export async function readPonytailUsage(
  accounts: PonytailUsage["accounts"],
): Promise<PonytailUsage> {
  const dir = ponytailLedgerDir();
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
  return summarizePonytail(rows, accounts);
}
