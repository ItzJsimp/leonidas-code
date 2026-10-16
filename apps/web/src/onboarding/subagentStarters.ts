/**
 * The starter subagents a new AIOS gets. The markdown files in
 * `packages/shared/src/subagentStarters` are the one source: they are bundled here
 * as text, so the onboarding writes exactly what the server tests parse.
 */
const RAW_STARTERS = import.meta.glob("../../../../packages/shared/src/subagentStarters/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Readonly<Record<string, string>>;

export interface SubagentStarter {
  readonly name: string;
  readonly contents: string;
  /** From the file's own `enabled:` line; a starter without one is on. */
  readonly enabled: boolean;
}

const baseName = (path: string) => (path.split("/").pop() ?? path).replace(/\.md$/u, "");

export const SUBAGENT_STARTERS: ReadonlyArray<SubagentStarter> = Object.entries(RAW_STARTERS)
  .map(([path, contents]) => ({
    name: baseName(path),
    contents,
    enabled: !/^enabled:\s*false\s*$/mu.test(contents.slice(0, 2_000)),
  }))
  .toSorted((left, right) => left.name.localeCompare(right.name));

/** Where the starters are written, relative to the new AIOS folder. */
export const SUBAGENT_ROOT = ".agents/subagents";

export function subagentStarterFiles(): ReadonlyArray<{
  readonly relativePath: string;
  readonly contents: string;
}> {
  return SUBAGENT_STARTERS.map((starter) => ({
    relativePath: `${SUBAGENT_ROOT}/${starter.name}.md`,
    contents: starter.contents,
  }));
}
