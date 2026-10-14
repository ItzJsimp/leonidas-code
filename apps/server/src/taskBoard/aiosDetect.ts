import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { findAiosRoot, parseFrontmatter } from "./aiosCards.ts";

/** How sure the scan is that a folder is an AIOS: `marker` has tasks/, projects/ and an agent brief; `schema` is cards only. */
export type AiosCandidateConfidence = "marker" | "schema";

export interface AiosCandidate {
  readonly root: string;
  readonly confidence: AiosCandidateConfidence;
  /** Markdown files in `tasks/` (top level, counted up to the sample limit). */
  readonly cardCount: number;
  /** Sampled cards that carry parseable frontmatter with a status or id. */
  readonly cardsWithFrontmatter: number;
  readonly markers: ReadonlyArray<string>;
}

const SAMPLE_LIMIT = 40;
const BRIEF_FILES = ["CLAUDE.md", "AGENTS.md"] as const;
const SCAN_PARENTS = ["", "Documents", "Desktop", "Projects", "dev", "code"] as const;

const isDir = (path: string) => {
  try {
    return NodeFS.statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const isFile = (path: string) => {
  try {
    return NodeFS.statSync(path).isFile();
  } catch {
    return false;
  }
};

/** Inspects one folder; returns null unless it has a `tasks/` folder of cards or an AIOS marker set. */
export function inspectAiosCandidate(root: string): AiosCandidate | null {
  const tasksDir = NodePath.join(root, "tasks");
  if (!isDir(tasksDir)) return null;

  const markers: string[] = ["tasks/"];
  if (isDir(NodePath.join(root, "projects"))) markers.push("projects/");
  for (const brief of BRIEF_FILES) if (isFile(NodePath.join(root, brief))) markers.push(brief);

  let names: string[];
  try {
    names = NodeFS.readdirSync(tasksDir).filter((name) => name.toLowerCase().endsWith(".md"));
  } catch {
    return null;
  }
  let cardsWithFrontmatter = 0;
  for (const name of names.slice(0, SAMPLE_LIMIT)) {
    try {
      const fields = parseFrontmatter(
        NodeFS.readFileSync(NodePath.join(tasksDir, name), "utf8"),
      )?.fields;
      if (fields && (fields.status !== undefined || fields.id !== undefined))
        cardsWithFrontmatter++;
    } catch {
      // An unreadable card simply does not count toward the schema match.
    }
  }

  const hasBrief = BRIEF_FILES.some((brief) => markers.includes(brief));
  const confidence: AiosCandidateConfidence | null =
    markers.includes("projects/") && hasBrief
      ? "marker"
      : cardsWithFrontmatter > 0
        ? "schema"
        : null;
  if (!confidence) return null;
  return { root, confidence, cardCount: names.length, cardsWithFrontmatter, markers };
}

/** Folders worth checking: explicit hints, their AIOS ancestors, then `*AIOS*` folders in common places. */
function candidateRoots(hints: ReadonlyArray<string | undefined>, home: string): string[] {
  const roots = new Set<string>();
  for (const hint of hints) {
    const found = findAiosRoot([hint]);
    if (found) roots.add(found);
    else if (hint?.trim()) roots.add(NodePath.resolve(hint.trim()));
  }
  for (const parent of SCAN_PARENTS) {
    const dir = NodePath.join(home, parent);
    let entries: NodeFS.Dirent[];
    try {
      entries = NodeFS.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && /aios/i.test(entry.name))
        roots.add(NodePath.join(dir, entry.name));
    }
  }
  return [...roots];
}

/**
 * Scans for AIOS folders: marker matches first, then schema-only matches, most cards first.
 * A user-picked folder is passed as a hint and is inspected like any other candidate.
 */
export function detectAiosCandidates(
  hints: ReadonlyArray<string | undefined>,
  home: string = NodeOS.homedir(),
): AiosCandidate[] {
  return candidateRoots(hints, home)
    .map(inspectAiosCandidate)
    .filter((candidate): candidate is AiosCandidate => candidate !== null)
    .toSorted(
      (a, b) =>
        Number(b.confidence === "marker") - Number(a.confidence === "marker") ||
        b.cardCount - a.cardCount,
    );
}
