import type { SubagentCatalogEntry } from "@t3tools/contracts";

export type StudioGroupKey = "on" | "catalog" | "projects" | "fix";

export interface StudioGroup {
  readonly key: StudioGroupKey;
  readonly title: string;
  readonly entries: ReadonlyArray<SubagentCatalogEntry>;
}

/** Stable id: one name can exist in the AIOS and in a project. */
export const entryId = (entry: Pick<SubagentCatalogEntry, "specPath">) => entry.specPath;

const needsFix = (entry: SubagentCatalogEntry) => entry.legacy || entry.error !== null;

/**
 * The Studio list: AIOS subagents that are on, the AIOS catalog (off),
 * project subagents, then specs that do not resolve. The search matches
 * name, description and project.
 */
export function groupStudioEntries(
  entries: ReadonlyArray<SubagentCatalogEntry>,
  query: string,
): ReadonlyArray<StudioGroup> {
  const needle = query.trim().toLowerCase();
  const visible =
    needle.length === 0
      ? entries
      : entries.filter((entry) =>
          [entry.name, entry.description ?? "", entry.projectName ?? ""].some((text) =>
            text.toLowerCase().includes(needle),
          ),
        );
  const aios = visible.filter((entry) => entry.source === "aios" && !needsFix(entry));
  return [
    { key: "on", title: "On", entries: aios.filter((entry) => entry.enabled) },
    { key: "catalog", title: "Catalog", entries: aios.filter((entry) => !entry.enabled) },
    {
      key: "projects",
      title: "Projects",
      entries: visible.filter((entry) => entry.source === "project" && !needsFix(entry)),
    },
    { key: "fix", title: "Needs fixing", entries: visible.filter(needsFix) },
  ];
}

/** On and ready: turned on and resolves, so a spawn would start. */
export const countReady = (entries: ReadonlyArray<SubagentCatalogEntry>) =>
  entries.filter((entry) => entry.enabled && !needsFix(entry)).length;

/** "10.8k" for the KPI strip; whole numbers under 1,000. */
export function formatTokensShort(tokens: number): string {
  return tokens < 1_000 ? String(tokens) : `${(tokens / 1_000).toFixed(1)}k`;
}
