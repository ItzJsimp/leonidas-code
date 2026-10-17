// @effect-diagnostics nodeBuiltinImport:off - synchronous node and global APIs are used on purpose in this file.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

/** Every AIOS template keeps its saved prompts here, relative to the AIOS root. */
const PROMPTS_DIR = "prompts";
/** Saved item ids for folder prompts carry the file name, so a rename is a new prompt. */
export const FOLDER_ID_PREFIX = "folder:";

export interface FolderPrompt {
  /** File name inside the prompts folder, e.g. `daily-briefing.md`. */
  readonly file: string;
  readonly title: string;
  readonly body: string;
  readonly tags: ReadonlyArray<string>;
  readonly mtimeMs: number;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function unquote(value: string): string {
  const trimmed = value.trim();
  return /^(["']).*\1$/.test(trimmed) ? trimmed.slice(1, -1) : trimmed;
}

function field(frontmatter: string, key: string): string | undefined {
  const match = new RegExp(`^${key}:\\s*(.*)$`, "m").exec(frontmatter);
  return match?.[1] === undefined ? undefined : unquote(match[1]);
}

/** Null when the file is not a saved prompt: no frontmatter, or a type other than `prompt`. */
export function parseFolderPrompt(
  file: string,
  text: string,
  mtimeMs: number,
): FolderPrompt | null {
  const match = FRONTMATTER.exec(text);
  if (!match?.[1] || field(match[1], "type") !== "prompt") return null;
  const body = text.slice(match[0].length).trim();
  const title =
    field(match[1], "title") || /^#\s+(.+)$/m.exec(body)?.[1]?.trim() || file.replace(/\.md$/, "");
  const category = field(match[1], "category");
  return { file, title, body, tags: category ? [category] : [], mtimeMs };
}

export function promptsDirFor(aiosRoot: string): string {
  return NodePath.join(aiosRoot, PROMPTS_DIR);
}

/** Null when the folder is missing, so callers can offer setup instead of showing an empty list. */
export function readFolderPrompts(dir: string): ReadonlyArray<FolderPrompt> | null {
  let names: string[];
  try {
    names = NodeFS.readdirSync(dir);
  } catch {
    return null;
  }
  const prompts: FolderPrompt[] = [];
  for (const name of names) {
    if (!name.endsWith(".md") || name.endsWith("-index.md")) continue;
    try {
      const path = NodePath.join(dir, name);
      const prompt = parseFolderPrompt(
        name,
        NodeFS.readFileSync(path, "utf8"),
        NodeFS.statSync(path).mtimeMs,
      );
      if (prompt) prompts.push(prompt);
    } catch {
      // A file that vanished or cannot be read is skipped; the next read retries it.
    }
  }
  return prompts;
}

function slugForTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "prompt"
  );
}

/** A free file name for a new prompt; never overwrites an existing file. */
export function freeFileName(dir: string, title: string): string {
  const slug = slugForTitle(title);
  for (let n = 1; ; n++) {
    const name = n === 1 ? `${slug}.md` : `${slug}-${n}.md`;
    if (!NodeFS.existsSync(NodePath.join(dir, name))) return name;
  }
}

function quoted(value: string): string {
  return JSON.stringify(value);
}

/** Keeps every other frontmatter line, so AIOS metadata survives an edit made in the app. */
function renderFolderPrompt(
  existing: string | null,
  input: { readonly file: string; readonly title: string; readonly body: string },
): string {
  const match = existing ? FRONTMATTER.exec(existing) : null;
  let frontmatter = match?.[1];
  if (frontmatter === undefined) {
    frontmatter = [
      "type: prompt",
      `id: prompt-${input.file.replace(/\.md$/, "")}`,
      `title: ${quoted(input.title)}`,
      'status: "Active"',
      "load: on-demand",
      "owner: shared",
    ].join("\n");
  } else if (/^title:/m.test(frontmatter)) {
    frontmatter = frontmatter.replace(/^title:.*$/m, `title: ${quoted(input.title)}`);
  } else {
    frontmatter = `${frontmatter}\ntitle: ${quoted(input.title)}`;
  }
  return `---\n${frontmatter}\n---\n\n${input.body.trim()}\n`;
}

export function writeFolderPrompt(
  dir: string,
  input: { readonly file: string; readonly title: string; readonly body: string },
): number {
  const path = NodePath.join(dir, input.file);
  let existing: string | null = null;
  try {
    existing = NodeFS.readFileSync(path, "utf8");
  } catch {
    existing = null;
  }
  NodeFS.writeFileSync(path, renderFolderPrompt(existing, input), "utf8");
  return NodeFS.statSync(path).mtimeMs;
}

export function deleteFolderPrompt(dir: string, file: string): void {
  NodeFS.rmSync(NodePath.join(dir, file), { force: true });
}
