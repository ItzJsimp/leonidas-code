// @effect-diagnostics nodeBuiltinImport:off - the pack reads a workspace folder with plain node fs.
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

import { readFrontmatter } from "./frontmatter.ts";
import {
  buildWidgets,
  currentMonth,
  type GoalRow,
  type PackWidget,
  type PaymentRow,
} from "./simplygersi.ts";

const HEAD_BYTES = 4096;
const BATCH = 32;
const CACHE_TTL_MS = 30_000;
const cache = new Map<
  string,
  { readonly at: number; readonly widgets: ReadonlyArray<PackWidget> }
>();

/** The frontmatter fields of every `*.md` in `<root>/<folder>`. A missing folder gives no rows. */
async function readFolder(root: string, folder: string): Promise<Array<Record<string, string>>> {
  let names: string[];
  try {
    names = (await NodeFSP.readdir(NodePath.join(root, folder))).filter((name) =>
      name.endsWith(".md"),
    );
  } catch {
    return [];
  }
  const rows: Array<Record<string, string>> = [];
  for (let start = 0; start < names.length; start += BATCH) {
    const batch = await Promise.all(
      names.slice(start, start + BATCH).map(async (name) => {
        try {
          const handle = await NodeFSP.open(NodePath.join(root, folder, name), "r");
          try {
            const buffer = Buffer.alloc(HEAD_BYTES);
            const { bytesRead } = await handle.read(buffer, 0, HEAD_BYTES, 0);
            return readFrontmatter(buffer.toString("utf8", 0, bytesRead));
          } finally {
            await handle.close();
          }
        } catch {
          return null;
        }
      }),
    );
    for (const row of batch) if (row) rows.push(row);
  }
  return rows;
}

/** The business widgets for one workspace folder. Read only; cached for 30 s per folder. */
export async function readWidgets(root: string, now: number): Promise<ReadonlyArray<PackWidget>> {
  const cached = cache.get(root);
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.widgets;
  const [payments, deals, goals] = await Promise.all([
    readFolder(root, "payments"),
    readFolder(root, "deals"),
    readFolder(root, "goals"),
  ]);
  const widgets = buildWidgets(
    {
      payments: payments.map((row): PaymentRow => ({
        date: row.date ?? "",
        amountUsd: Number(row.amount_usd),
        verified: row.verified === "true",
      })),
      deals: deals.map((row) => row.stage ?? ""),
      goals: goals.map((row): GoalRow => ({
        name: row.name ?? "",
        targetUsd: Number(row.target_usd),
        status: row.status ?? "",
        metric: row.metric ?? "",
      })),
    },
    currentMonth(now),
  );
  if (cache.size > 16) cache.clear();
  cache.set(root, { at: now, widgets });
  return widgets;
}
