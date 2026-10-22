import type { TaskBoardHomeArea } from "@t3tools/contracts";

import type { AccessedAiosFile } from "~/agentActivity";

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

/** Area times raised to the moment this app saw a turn write them, newest first. */
export function withTouched(
  areas: ReadonlyArray<TaskBoardHomeArea>,
  touchedAt: Readonly<Record<string, number>>,
): ReadonlyArray<TaskBoardHomeArea> {
  if (!areas.some((area) => (touchedAt[area.id] ?? 0) > area.changedAt)) return areas;
  return areas
    .map((area) => ({ ...area, changedAt: Math.max(area.changedAt, touchedAt[area.id] ?? 0) }))
    .toSorted((a, b) => b.changedAt - a.changedAt);
}
