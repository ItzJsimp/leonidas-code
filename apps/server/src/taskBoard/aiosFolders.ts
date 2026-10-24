// @effect-diagnostics nodeBuiltinImport:off - lists AIOS notes from disk, like aiosHome.
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

import type { AiosFolderItem, AiosFolderList, AiosNoteFolder } from "@t3tools/contracts";

import { isRealPathInside, parseFrontmatter } from "./aiosCards.ts";

/** Files looked at per folder. A big logs folder keeps the read cheap. */
const WALK_CAP = 2_000;
/** Notes returned, newest first. */
const ITEM_CAP = 300;
/** Subfolder levels read below the folder, like the area counts. */
const MAX_DEPTH = 2;
/** The title and first paragraph sit near the top. */
const HEAD_BYTES = 4 * 1024;
const SUMMARY_MAX = 200;

const DATE_IN_NAME = /(\d{4}-\d{2}-\d{2})/;
const isNote = (name: string) => name.endsWith(".md") && !name.endsWith("-index.md");

function readHead(path: string): string {
  const fd = NodeFS.openSync(path, "r");
  try {
    const buffer = Buffer.alloc(HEAD_BYTES);
    return buffer.toString("utf8", 0, NodeFS.readSync(fd, buffer, 0, HEAD_BYTES, 0));
  } finally {
    NodeFS.closeSync(fd);
  }
}

const field = (fields: Record<string, string | ReadonlyArray<string>> | undefined, key: string) => {
  const value = fields?.[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
};

/** Markdown links, emphasis and code marks removed, so a summary reads as plain text. */
const plain = (text: string) =>
  text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(
      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_, target: string, label?: string) => label ?? target,
    )
    .replace(/[*_`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

const clip = (text: string) =>
  text.length > SUMMARY_MAX ? `${text.slice(0, SUMMARY_MAX - 1).trimEnd()}…` : text;

/** "0012-zero-emdash-punctuation" -> "0012 zero emdash punctuation". */
const nameTitle = (path: string) =>
  NodePath.basename(path, ".md").replace(/[-_]+/g, " ").trim() || path;

/** Title, date and a one-line summary from frontmatter, else the first heading and paragraph. */
export function describeNote(
  path: string,
  head: string,
): Pick<AiosFolderItem, "title" | "date" | "summary"> {
  const parsed = parseFrontmatter(head);
  const fields = parsed?.fields;
  const body = parsed ? parsed.body : head;
  const lines = body.split(/\r?\n/);
  const heading = lines.find((line) => /^#\s+\S/.test(line));
  const title =
    field(fields, "title") ?? field(fields, "name") ?? (heading ? plain(heading.slice(1)) : null);
  let summary = field(fields, "description") ?? field(fields, "summary");
  if (summary === null) {
    const paragraph: string[] = [];
    for (const raw of lines) {
      const line = raw.trim();
      const skip = line === "" || /^(#|---|\||>?\s*\[!|<!--|```)/.test(line);
      if (skip) {
        if (paragraph.length > 0) break;
        continue;
      }
      paragraph.push(line.replace(/^([-*+]|\d+\.)\s+(\[[ x]\]\s+)?/, ""));
    }
    summary = paragraph.join(" ");
  }
  const dated = field(fields, "date") ?? field(fields, "created");
  const date =
    DATE_IN_NAME.exec(dated ?? "")?.[1] ?? DATE_IN_NAME.exec(NodePath.basename(path))?.[1] ?? null;
  return {
    title: title ? clip(plain(title)) : nameTitle(path),
    date,
    summary: clip(plain(summary)),
  };
}

/** The notes in one AIOS folder, newest first: by the date they name, else by file time. */
export async function readFolder(root: string, folder: AiosNoteFolder): Promise<AiosFolderList> {
  const top = NodePath.join(root, folder);
  // A folder linked in from another place is not this AIOS's content.
  if (!isRealPathInside(root, top)) return { root, folder, items: [], total: 0 };
  const files: string[] = [];
  let total = 0;
  const visit = async (dir: string, depth: number): Promise<void> => {
    const entries = await NodeFSP.readdir(dir, { withFileTypes: true }).catch(() => []);
    const subfolders: string[] = [];
    for (const entry of entries) {
      if (entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
      const path = NodePath.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth < MAX_DEPTH && entry.name !== "node_modules") subfolders.push(path);
      } else if (isNote(entry.name)) {
        total++;
        // shortcut: past the cap a folder lists the first files read, upgrade if a huge logs folder hides new notes.
        if (files.length < WALK_CAP) files.push(path);
      }
    }
    await Promise.all(subfolders.map((path) => visit(path, depth + 1)));
  };
  await visit(top, 0);
  const timed = await Promise.all(
    files.map((path) =>
      NodeFSP.stat(path).then(
        (stat) => ({ path, changedAt: stat.mtimeMs }),
        () => ({ path, changedAt: 0 }),
      ),
    ),
  );
  const items = timed
    .map((file) => {
      const relative = NodePath.relative(root, file.path).split(NodePath.sep).join("/");
      const date = DATE_IN_NAME.exec(NodePath.basename(file.path))?.[1] ?? null;
      // A dated name sorts by its day (UTC midnight), so the newest day comes first.
      return { ...file, relative, sortAt: date ? Date.parse(date) : file.changedAt };
    })
    .toSorted((a, b) => b.sortAt - a.sortAt || b.changedAt - a.changedAt)
    .slice(0, ITEM_CAP)
    .map((file): AiosFolderItem => {
      let head = "";
      try {
        head = readHead(file.path);
      } catch {
        // A file removed during the read still lists by name.
      }
      return {
        path: file.relative,
        changedAt: file.changedAt,
        ...describeNote(file.relative, head),
      };
    });
  return { root, folder, items, total };
}

const TTL_MS = 30_000;
const cache = new Map<string, { readonly at: number; readonly list: Promise<AiosFolderList> }>();

/** `readFolder` with a 30 s cache per root and folder, so switching tabs costs one walk. */
export function cachedFolder(
  root: string,
  folder: AiosNoteFolder,
  now: number,
): Promise<AiosFolderList> {
  const key = `${root}\n${folder}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.list;
  const list = readFolder(root, folder);
  cache.set(key, { at: now, list });
  return list;
}
