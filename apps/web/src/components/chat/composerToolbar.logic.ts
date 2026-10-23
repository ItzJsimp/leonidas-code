import type { ComposerToolbarPrefs } from "@t3tools/contracts/settings";

/** Team default set and order; users change it through `composerToolbar` in client settings. */
const BUILTIN_TOOLBAR_ITEMS = [
  { id: "replyStyle", label: "Reply style" },
  { id: "saved", label: "Saved" },
  { id: "stash", label: "Saved drafts" },
  { id: "skills", label: "Skills" },
  { id: "subagents", label: "Agents" },
  { id: "nextAction", label: "Tasks" },
] as const;

export interface ToolbarEntry {
  id: string;
  label: string;
  hidden: boolean;
  custom: boolean;
}

/** Defaults first, the user's order on top, custom buttons last unless the user moved them. */
export function resolveToolbarEntries(prefs: ComposerToolbarPrefs): ToolbarEntry[] {
  const known = new Map<string, ToolbarEntry>();
  const hidden = new Set(prefs.hidden);
  for (const item of BUILTIN_TOOLBAR_ITEMS) {
    known.set(item.id, { ...item, hidden: hidden.has(item.id), custom: false });
  }
  for (const button of prefs.custom) {
    known.set(button.id, {
      id: button.id,
      label: button.label,
      hidden: hidden.has(button.id),
      custom: true,
    });
  }
  const ordered: ToolbarEntry[] = [];
  for (const id of prefs.order) {
    const entry = known.get(id);
    if (entry) {
      ordered.push(entry);
      known.delete(id);
    }
  }
  return [...ordered, ...known.values()];
}

export function moveToolbarEntry(
  entries: readonly ToolbarEntry[],
  id: string,
  delta: -1 | 1,
): string[] {
  const ids = entries.map((entry) => entry.id);
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  ids.splice(to, 0, ids.splice(from, 1)[0]!);
  return ids;
}
