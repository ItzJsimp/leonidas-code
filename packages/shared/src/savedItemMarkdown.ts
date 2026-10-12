import type { SavedItemExport, SavedItemKind } from "@t3tools/contracts";

/** Bumped only when the exported layout changes in a way an older importer cannot read. */
export const SAVED_ITEM_MARKDOWN_VERSION = 1;

const KINDS: ReadonlyArray<SavedItemKind> = ["prompt", "note"];

export type ParsedSavedItemMarkdown =
  | { readonly ok: true; readonly item: SavedItemExport }
  | { readonly ok: false; readonly error: string };

/**
 * Renders a saved item as markdown that works pasted anywhere: a frontmatter header the importer
 * reads exactly, then the prompt as the plain body so an external agent can use it unchanged.
 * Titles and tags are JSON strings, which are valid YAML, so quotes and colons survive.
 */
export function renderSavedItemMarkdown(item: SavedItemExport): string {
  return [
    "---",
    `leonidas: ${SAVED_ITEM_MARKDOWN_VERSION}`,
    `kind: ${item.kind}`,
    `title: ${JSON.stringify(item.title)}`,
    `tags: ${JSON.stringify(item.tags)}`,
    "---",
    "",
    `${item.body}\n`,
  ].join("\n");
}

const fail = (error: string): ParsedSavedItemMarkdown => ({ ok: false, error });

/** Reads markdown made by {@link renderSavedItemMarkdown}; anything else is rejected with a reason. */
export function parseSavedItemMarkdown(text: string): ParsedSavedItemMarkdown {
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trimStart()
    .split("\n");
  if (lines[0] !== "---") return fail("This is not Leonidas saved-item markdown.");
  const end = lines.indexOf("---", 1);
  if (end === -1) return fail("The header is never closed with a --- line.");

  const fields = new Map<string, string>();
  for (const line of lines.slice(1, end)) {
    const colon = line.indexOf(":");
    if (colon > 0) fields.set(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
  }

  const version = fields.get("leonidas");
  if (version === undefined) return fail("This is not Leonidas saved-item markdown.");
  if (version !== String(SAVED_ITEM_MARKDOWN_VERSION)) {
    return fail(`This uses format version ${version}, which this app cannot read.`);
  }

  const kind = KINDS.find((candidate) => candidate === fields.get("kind"));
  if (!kind)
    return fail(`Unsupported kind "${fields.get("kind") ?? ""}". Expected prompt or note.`);

  const title = readJson(fields.get("title"));
  const tags = readJson(fields.get("tags"));
  if (typeof title !== "string") return fail("The title is missing or malformed.");
  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === "string" && tag.trim())) {
    return fail("The tags are missing or malformed.");
  }

  const rest = lines.slice(end + 1);
  if (rest[0] === "") rest.shift();
  const body = rest.join("\n");
  return {
    ok: true,
    item: { kind, title, tags, body: body.endsWith("\n") ? body.slice(0, -1) : body },
  };
}

function readJson(value: string | undefined): unknown {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
