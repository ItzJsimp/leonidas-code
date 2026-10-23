import type { TaskBoardHomeArea } from "@t3tools/contracts";

const AREA_WORDS: Record<string, readonly [label: string, one: string, many: string]> = {
  tasks: ["Tasks", "task card (all time)", "task cards (all time)"],
  projects: ["Projects", "project", "projects"],
  decisions: ["Decisions", "decision", "decisions"],
  memory: ["Memory", "note", "notes"],
  logs: ["Logs", "log", "logs"],
  skills: ["Skills", "skill", "skills"],
  wiki: ["Wiki", "page", "pages"],
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const startOfDay = (ms: number) => new Date(ms).setHours(0, 0, 0, 0);

/** "12 min ago", "2 h ago", "3:00 AM", "Yesterday", "3 days ago" or "Sep 2". */
export function changedLabel(at: number, now: number): string {
  const diff = now - at;
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < 3 * HOUR) return `${Math.floor(diff / HOUR)} h ago`;
  const days = Math.round((startOfDay(now) - startOfDay(at)) / (24 * HOUR));
  if (days === 0) {
    return new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export interface AreaRow {
  readonly id: string;
  readonly label: string;
  /** "118 cards · 12 min ago". */
  readonly detail: string;
}

export const areaLabel = (id: string) =>
  AREA_WORDS[id]?.[0] ?? id.charAt(0).toUpperCase() + id.slice(1);

/** "card" or "cards" for a count; "file" or "files" for an area the list does not know. */
export function areaUnitWord(id: string, units: number): string {
  const [, one, many] = AREA_WORDS[id] ?? [areaLabel(id), "file", "files"];
  return units === 1 ? one : many;
}

export function areaRow(area: TaskBoardHomeArea, now: number): AreaRow {
  const when = changedLabel(area.changedAt, now);
  const [label, one, many] = AREA_WORDS[area.id] ?? [areaLabel(area.id), "file", "files"];
  return {
    id: area.id,
    label,
    detail: `${area.units.toLocaleString("en-US")} ${area.units === 1 ? one : many} · ${when === "just now" ? "updated just now" : when}`,
  };
}
