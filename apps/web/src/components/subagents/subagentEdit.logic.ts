import {
  DEFAULT_SUBAGENT_FREE_TIER_MODELS,
  type SubagentCatalogEntry,
  type SubagentSpecPatch,
} from "@t3tools/contracts";

/** Built-in tools a subagent can be given. App tools (`mcp__...`) are kept as typed. */
export const BUILT_IN_TOOLS: ReadonlyArray<string> = [
  "Read",
  "Grep",
  "Glob",
  "Edit",
  "Write",
  "Bash",
  "WebSearch",
  "WebFetch",
];

/** Models offered as suggestions in the model field. */
export const MODEL_SUGGESTIONS: ReadonlyArray<string> = [
  ...DEFAULT_SUBAGENT_FREE_TIER_MODELS,
  "claude-sonnet-5-5",
  "claude-opus-5-5",
  "claude-fable-5-1",
];

export interface SubagentDraft {
  readonly description: string;
  readonly model: string;
  readonly tools: ReadonlyArray<string>;
  readonly context: ReadonlyArray<string>;
}

export function draftFromEntry(entry: SubagentCatalogEntry): SubagentDraft {
  return {
    description: entry.description ?? "",
    model: entry.model ?? "",
    tools: entry.tools,
    context: entry.context.map((item) => item.path),
  };
}

const sameList = (left: ReadonlyArray<string>, right: ReadonlyArray<string>) =>
  left.length === right.length && left.every((item, index) => item === right[index]);

/** Only the fields the user changed, so an inherited value stays inherited. */
export function patchFromDraft(
  entry: SubagentCatalogEntry,
  draft: SubagentDraft,
): SubagentSpecPatch {
  const before = draftFromEntry(entry);
  const model = draft.model.trim();
  return {
    ...(draft.description.trim() === before.description.trim()
      ? {}
      : { description: draft.description.trim() === "" ? null : draft.description.trim() }),
    ...(model === before.model ? {} : { model: model === "" ? null : model }),
    ...(sameList(draft.tools, before.tools) ? {} : { tools: draft.tools }),
    ...(sameList(draft.context, before.context) ? {} : { context: draft.context }),
  };
}

export const isEmptyPatch = (patch: SubagentSpecPatch) => Object.keys(patch).length === 0;

/** "a, b , ,c" to unique tool names. */
export function parseToolList(text: string): ReadonlyArray<string> {
  return [
    ...new Set(
      text
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  ];
}

/**
 * True when saving moves the subagent to a model that is not known to be free.
 * That model asks before every start, so the user confirms the change first.
 */
export function raisesSpend(
  patch: SubagentSpecPatch,
  knownFreeModels: ReadonlySet<string>,
): boolean {
  return typeof patch.model === "string" && !knownFreeModels.has(patch.model);
}

/** Models the catalog already shows as free, plus the app default free list. */
export function knownFreeModels(entries: ReadonlyArray<SubagentCatalogEntry>): ReadonlySet<string> {
  return new Set([
    ...DEFAULT_SUBAGENT_FREE_TIER_MODELS,
    ...entries.flatMap((entry) =>
      entry.tier === "free" && entry.model !== null ? [entry.model] : [],
    ),
  ]);
}

/** A name for a new subagent: lowercase words joined by dashes, or null when none remain. */
export function slugifySubagentName(text: string): string | null {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
  return slug.length === 0 ? null : slug;
}

/** Where a new subagent can go: the AIOS folder, or a project the Studio already lists. */
export function newSubagentDestinations(
  entries: ReadonlyArray<SubagentCatalogEntry>,
  hasAios: boolean,
): ReadonlyArray<{ readonly id: string; readonly label: string }> {
  const projects = [
    ...new Set(entries.flatMap((entry) => (entry.projectName === null ? [] : [entry.projectName]))),
  ].toSorted();
  return [
    ...(hasAios ? [{ id: "aios", label: "My AIOS (every project)" }] : []),
    ...projects.map((name) => ({ id: `project:${name}`, label: name })),
  ];
}
