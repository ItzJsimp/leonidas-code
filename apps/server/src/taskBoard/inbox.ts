// @effect-diagnostics nodeBuiltinImport:off - Drops are plain markdown files read by people and agents.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

export interface InboxDropRequest {
  readonly text: string;
  readonly source?: string | undefined;
  readonly projectSlug?: string | null | undefined;
  readonly actor: string;
}

export interface InboxDropReceipt {
  readonly id: string;
  readonly createdAt: string;
}

const DROP_ID = /^[0-9]{8}-[0-9]{6}(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?(?:-\d+)?$/;

const stamp = (date: Date) =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}${String(date.getSeconds()).padStart(2, "0")}`;

const slugOf = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");

const yaml = (value: string) => JSON.stringify(value.replace(/\s+/g, " ").trim());

/**
 * Saves one raw capture as `<root>/inbox/<yyyymmdd-hhmmss>-<words>.md` and returns its id. The
 * drop is deliberately unclassified: triage into a note, task or idea happens later.
 */
export function writeDrop(root: string, input: InboxDropRequest, now: number): InboxDropReceipt {
  const dir = NodePath.join(root, "inbox");
  NodeFS.mkdirSync(dir, { recursive: true });
  const date = new Date(now);
  const base = [stamp(date), slugOf(input.text)].filter(Boolean).join("-");
  const createdAt = date.toISOString();
  const project = input.projectSlug?.trim();
  const raw = [
    "---",
    "type: drop",
    "status: new",
    `created: ${yaml(createdAt)}`,
    `by: ${yaml(input.actor)}`,
    ...(input.source?.trim() ? [`source: ${yaml(input.source)}`] : []),
    ...(project ? [`project: ${yaml(project)}`] : []),
    "---",
    input.text.trim(),
    "",
  ].join("\n");
  for (let attempt = 1; ; attempt++) {
    const id = attempt === 1 ? base : `${base}-${attempt}`;
    try {
      NodeFS.writeFileSync(NodePath.join(dir, `${id}.md`), raw, { encoding: "utf8", flag: "wx" });
      return { id, createdAt };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
}

/** Removes a drop saved moments ago; only an id this module issued can name a file. */
export function removeDrop(root: string, id: string): boolean {
  if (!DROP_ID.test(id)) return false;
  const file = NodePath.join(root, "inbox", `${id}.md`);
  if (!NodeFS.existsSync(file)) return false;
  NodeFS.rmSync(file);
  return true;
}
