// @effect-diagnostics nodeBuiltinImport:off - The focus list is a plain markdown file read by people and agents.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

/** Relative to the AIOS root. People and agents edit this file directly. */
const FOCUS_FILE = NodePath.join("memory", "focus.md");
const GLOBAL_HEADING = "Global";

type FocusLine =
  | { readonly kind: "item"; readonly text: string; readonly done: boolean }
  | { readonly kind: "raw"; readonly line: string };

export interface FocusDocSection {
  /** `null` is the Global section. */
  readonly slug: string | null;
  readonly lines: ReadonlyArray<FocusLine>;
}

export interface FocusDoc {
  /** Lines before the first `## ` heading, kept as written. */
  readonly preamble: ReadonlyArray<string>;
  readonly sections: ReadonlyArray<FocusDocSection>;
}

export interface FocusDocItem {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
}

const HEADING = /^##\s+(.+?)\s*$/;
const ITEM = /^\s*[-*]\s+\[([ xX])\]\s+(.*?)\s*$/;

const slugOfHeading = (heading: string) =>
  heading.toLowerCase() === GLOBAL_HEADING.toLowerCase() ? null : heading.toLowerCase();

/** Parses the focus file. Lines it does not know stay in place, so a hand edit is never lost. */
export function parseFocus(text: string): FocusDoc {
  const preamble: string[] = [];
  const sections: { slug: string | null; lines: FocusLine[] }[] = [];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const heading = HEADING.exec(line);
    if (heading?.[1]) {
      sections.push({ slug: slugOfHeading(heading[1]), lines: [] });
      continue;
    }
    const current = sections.at(-1);
    const item = current ? ITEM.exec(line) : null;
    if (current && item && item[2]) {
      current.lines.push({ kind: "item", text: item[2], done: item[1] !== " " });
    } else if (current) {
      current.lines.push({ kind: "raw", line });
    } else {
      preamble.push(line);
    }
  }
  return {
    preamble: trimEnd(preamble),
    sections: sections.map((s) => ({ ...s, lines: trimRaw(s.lines) })),
  };
}

function trimEnd(lines: ReadonlyArray<string>): string[] {
  const out = [...lines];
  while (out.length > 0 && out.at(-1)!.trim() === "") out.pop();
  return out;
}

function trimRaw(lines: ReadonlyArray<FocusLine>): FocusLine[] {
  const out = [...lines];
  while (out.length > 0) {
    const last = out.at(-1)!;
    if (last.kind !== "raw" || last.line.trim() !== "") break;
    out.pop();
  }
  return out;
}

/** Writes the doc back with one blank line between sections and a trailing newline. */
export function serializeFocus(doc: FocusDoc): string {
  const blocks: string[] = [];
  const preamble = doc.preamble.length > 0 ? doc.preamble : ["# Focus"];
  blocks.push(preamble.join("\n"));
  for (const section of doc.sections) {
    const lines = [`## ${section.slug ?? GLOBAL_HEADING}`];
    for (const line of section.lines) {
      lines.push(
        line.kind === "item" ? `- [${line.done ? "x" : " "}] ${oneLine(line.text)}` : line.line,
      );
    }
    blocks.push(lines.join("\n"));
  }
  return `${blocks.join("\n\n")}\n`;
}

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

/** FNV-1a, enough to tell lines apart inside one section. */
function shortHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Items of one section with ids made from section, text and repeat count, so ids survive reorders. */
export function sectionItems(section: FocusDocSection): FocusDocItem[] {
  const seen = new Map<string, number>();
  const items: FocusDocItem[] = [];
  for (const line of section.lines) {
    if (line.kind !== "item") continue;
    const key = oneLine(line.text);
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    items.push({
      id: `${section.slug ?? "global"}:${shortHash(key)}${n === 0 ? "" : `:${n}`}`,
      text: line.text,
      done: line.done,
    });
  }
  return items;
}

/** Adds an open item at the end of the section, and creates the section when it is missing. */
export function addFocusItem(doc: FocusDoc, slug: string | null, text: string): FocusDoc {
  const key = slug?.toLowerCase() ?? null;
  const item: FocusLine = { kind: "item", text: oneLine(text), done: false };
  const index = doc.sections.findIndex((section) => section.slug === key);
  if (index === -1) {
    // Global first, so the file reads top down from general to project.
    const section = { slug: key, lines: [item] };
    return {
      ...doc,
      sections: key === null ? [section, ...doc.sections] : [...doc.sections, section],
    };
  }
  return {
    ...doc,
    sections: doc.sections.map((section, i) =>
      i === index ? { ...section, lines: [...trimRaw(section.lines), item] } : section,
    ),
  };
}

/** Changes the item with this id; `null` removes it. Returns `null` when no item has the id. */
export function changeFocusItem(
  doc: FocusDoc,
  id: string,
  change: { readonly done: boolean } | null,
): FocusDoc | null {
  for (const [sectionIndex, section] of doc.sections.entries()) {
    const ids = sectionItems(section).map((item) => item.id);
    const position = ids.indexOf(id);
    if (position === -1) continue;
    let seen = -1;
    const lines = section.lines.flatMap((line) => {
      if (line.kind !== "item" || ++seen !== position) return [line];
      return change === null ? [] : [{ ...line, done: change.done }];
    });
    return {
      ...doc,
      sections: doc.sections.map((other, i) => (i === sectionIndex ? { ...other, lines } : other)),
    };
  }
  return null;
}

export function focusPathFor(root: string): string {
  return NodePath.join(root, FOCUS_FILE);
}

/** A missing file is an empty list, not an error: the first add creates it. */
export function readFocusFile(path: string): FocusDoc {
  try {
    return parseFocus(NodeFS.readFileSync(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { preamble: [], sections: [] };
    throw error;
  }
}

/** Writes next to the file, then renames over it, so a reader never sees half a list. */
export function writeFocusFile(path: string, doc: FocusDoc): void {
  NodeFS.mkdirSync(NodePath.dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  NodeFS.writeFileSync(temp, serializeFocus(doc), "utf8");
  NodeFS.renameSync(temp, path);
}
