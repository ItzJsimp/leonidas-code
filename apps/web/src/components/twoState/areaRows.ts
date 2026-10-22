import type { TaskBoardHomeArea } from "@t3tools/contracts";

const AREA_WORDS: Record<string, readonly [label: string, one: string, many: string]> = {
  tasks: ["Tasks", "card", "cards"],
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

export function areaRow(area: TaskBoardHomeArea, now: number): AreaRow {
  const [label, one, many] = AREA_WORDS[area.id] ?? [
    area.id.charAt(0).toUpperCase() + area.id.slice(1),
    "file",
    "files",
  ];
  return {
    id: area.id,
    label,
    detail: `${area.units} ${area.units === 1 ? one : many} · ${changedLabel(area.changedAt, now)}`,
  };
}
