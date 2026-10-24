import type { AiosFolderItem, AiosNoteFolder, TaskBoardHomeArea } from "@t3tools/contracts";

/** Area counts the app saw, per local day: `{ "2026-10-24": { decisions: 42 } }`. */
export type AreaHistory = Readonly<Record<string, Readonly<Record<string, number>>>>;

/** Days of counts kept on this device. Enough for a week-over-week change. */
const KEEP_DAYS = 14;
/** How far back the change looks: the oldest count within this many days. */
const TREND_DAYS = 7;

/** The history with today's counts saved, trimmed to the newest days. Same object when nothing changed. */
export function recordAreas(
  history: AreaHistory,
  day: string,
  areas: ReadonlyArray<Pick<TaskBoardHomeArea, "id" | "units">>,
): AreaHistory {
  if (areas.length === 0) return history;
  const counts = Object.fromEntries(areas.map((area) => [area.id, area.units]));
  const saved = history[day];
  if (saved && areas.every((area) => saved[area.id] === area.units)) return history;
  const days = Object.keys({ ...history, [day]: counts })
    .toSorted()
    .slice(-KEEP_DAYS);
  return Object.fromEntries(days.map((key) => [key, key === day ? counts : history[key]!]));
}

const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);

export interface AreaTrend {
  /** The counts on the days the app saw, oldest first, ending with today. */
  readonly series: readonly number[];
  /** Today's count minus the oldest count in the last week; null with no earlier day. */
  readonly delta: number | null;
  /** The day the change counts from. */
  readonly since: string | null;
}

/** How one area changed over the last week, from counts saved on this device. */
export function areaTrend(history: AreaHistory, id: string, today: string): AreaTrend {
  const days = Object.keys(history)
    .filter((day) => day <= today && dayMs(today) - dayMs(day) <= TREND_DAYS * 86_400_000)
    .toSorted()
    .filter((day) => typeof history[day]?.[id] === "number");
  const series = days.map((day) => history[day]![id]!);
  const first = days[0];
  const last = series.at(-1);
  if (first === undefined || first === today || last === undefined || days.at(-1) !== today) {
    return { series, delta: null, since: null };
  }
  return { series, delta: last - series[0]!, since: first };
}

/** Notes from the three folders whose title, summary or path holds every word of the query. */
export function searchNotes(
  lists: ReadonlyArray<{
    readonly folder: AiosNoteFolder;
    readonly items: readonly AiosFolderItem[];
  }>,
  query: string,
): Array<AiosFolderItem & { readonly folder: AiosNoteFolder }> {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return lists.flatMap((list) =>
    list.items
      .filter((item) => {
        const text = `${item.title} ${item.summary} ${item.path}`.toLowerCase();
        return words.every((word) => text.includes(word));
      })
      .map((item) => ({ ...item, folder: list.folder })),
  );
}

/** The folder a note path belongs to, or null for a path outside the three. */
export function folderOf(path: string): AiosNoteFolder | null {
  const top = path.split("/")[0];
  return top === "decisions" || top === "logs" || top === "wiki" ? top : null;
}
