import type { FoldedFeedEvent, TaskBoardHomeArea } from "@t3tools/contracts";

import type { AccessedAiosFile } from "~/agentActivity";
import { classifyAccessPath } from "~/agentActivityAccess";

/** Canon folders that have a row in Your AIOS. Other folders, such as standards, have no row. */
const RAIL_AREAS = new Set(["tasks", "decisions", "memory", "logs", "wiki"]);

export const areaForFolder = (folder: string): string | null =>
  RAIL_AREAS.has(folder) ? folder : null;

export interface LiveArea {
  /** The area row to raise, while a turn runs. */
  readonly area: string | null;
  /** The file the agent touched last in that area. */
  readonly path: string | null;
  /** Areas the turn wrote, in first-write order. They say "updated just now" after the turn. */
  readonly written: ReadonlyArray<string>;
}

/**
 * The live signal from a turn's AIOS files, in first-use order.
 * shortcut: "newest" is the newest first use, so going back to an earlier file does not move
 * the light; upgrade to per-access times if that looks wrong in use.
 */
export function liveArea(files: ReadonlyArray<AccessedAiosFile>, running: boolean): LiveArea {
  const written = [
    ...new Set(
      files.flatMap((file) => {
        const area = file.access === "write" ? areaForFolder(file.folder) : null;
        return area === null ? [] : [area];
      }),
    ),
  ];
  const newest = running
    ? files.findLast((file) => areaForFolder(file.folder) !== null)
    : undefined;
  return {
    area: newest ? areaForFolder(newest.folder) : null,
    path: newest?.relative ?? null,
    written,
  };
}

/** The rail area of an AIOS-relative path from an `aios.changed` event. */
function areaForPath(path: string): string | null {
  const [first, second] = path.split("/");
  if (first === "projects") return "projects";
  if (first === ".agents" && second === "skills") return "skills";
  return first === undefined ? null : areaForFolder(first);
}

/**
 * When each rail area last changed by an agent turn, from the `aios.changed` events. The server
 * writes them from the turn's checkpoint diff, so shell writes count too.
 */
export function touchedFromFeed(events: ReadonlyArray<FoldedFeedEvent>): Record<string, number> {
  const touched: Record<string, number> = {};
  for (const event of events) {
    if (event.type !== "aios.changed") continue;
    const at = Date.parse(event.ts);
    for (const path of event.target?.files ?? []) {
      const area = areaForPath(path);
      if (area !== null && at > (touched[area] ?? 0)) touched[area] = at;
    }
  }
  return touched;
}

/** Area times raised to the newest agent change, newest first. */
export function withTouched(
  areas: ReadonlyArray<TaskBoardHomeArea>,
  touchedAt: Readonly<Record<string, number>>,
): ReadonlyArray<TaskBoardHomeArea> {
  if (!areas.some((area) => (touchedAt[area.id] ?? 0) > area.changedAt)) return areas;
  return areas
    .map((area) => ({ ...area, changedAt: Math.max(area.changedAt, touchedAt[area.id] ?? 0) }))
    .toSorted((a, b) => b.changedAt - a.changedAt);
}

/** A shell command that writes a file: a redirect or a PowerShell or Unix write command. */
const WRITES =
  /(^|[^>])>{1,2}(?!=)|\b(?:Set-Content|Add-Content|Out-File|New-Item|tee|cp|mv|Copy-Item|Move-Item)\b/i;

/**
 * AIOS files named in shell commands. Agents such as Codex write with the shell, which the
 * file-tool parser does not see. A quoted path may hold spaces, as in `P1 test AIOS`.
 */
export function shellAiosFiles(commands: ReadonlyArray<string>): AccessedAiosFile[] {
  const files: AccessedAiosFile[] = [];
  for (const command of commands) {
    const access = WRITES.test(command) ? "write" : "read";
    // A launcher such as `pwsh -Command "..."` wraps the real command in quotes: read inside too.
    const parts = [
      command,
      ...Array.from(command.matchAll(/"([^"]*)"/g), (match) => match[1] ?? ""),
    ];
    const seen = new Set<string>();
    for (const token of parts.flatMap((part) => part.match(/"[^"]+"|'[^']+'|\S+/g) ?? [])) {
      const path = token.replace(/^["']|["']$/g, "");
      const kind = classifyAccessPath(path);
      if (kind.area !== "aios" || areaForFolder(kind.folder) === null || seen.has(kind.relative)) {
        continue;
      }
      seen.add(kind.relative);
      files.push({
        path,
        name: path.split(/[\/]/).at(-1) ?? path,
        access,
        count: 1,
        folder: kind.folder,
        relative: kind.relative,
      });
    }
  }
  return files;
}
