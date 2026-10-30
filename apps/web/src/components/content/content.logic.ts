import type { ContentListResult, ContentStage, ContentVideo } from "@t3tools/contracts";

/** The board's five groups, left to right. Each stage belongs to one group. */
export const GROUPS = [
  { id: "write", label: "Writing", stages: ["idea", "scripting"] },
  { id: "review", label: "Needs review", stages: ["script_review"] },
  { id: "film", label: "Ready to film", stages: ["ready_to_film"] },
  {
    id: "cut",
    label: "Cut and revisions",
    stages: ["filmed", "cut_review", "revision_1", "revision_2"],
  },
  { id: "done", label: "Delivered", stages: ["delivered", "paid"] },
] as const satisfies ReadonlyArray<{
  readonly id: string;
  readonly label: string;
  readonly stages: ReadonlyArray<ContentStage>;
}>;
export type GroupId = (typeof GROUPS)[number]["id"];

const STAGE_LABELS: Readonly<Record<ContentStage, string>> = {
  idea: "Idea",
  scripting: "Scripting",
  script_review: "Script review",
  ready_to_film: "Ready to film",
  filmed: "Filmed",
  cut_review: "Cut review",
  revision_1: "Revision 1",
  revision_2: "Revision 2",
  delivered: "Delivered",
  paid: "Paid",
};
export const stageLabel = (stage: ContentStage) => STAGE_LABELS[stage];

/** One video on the board, with the brand of its deal. */
export interface Row {
  readonly video: ContentVideo;
  readonly brand: string;
}

export const ALL_DEALS = "all";

/** Every video of the chosen deal (or all deals), in deal and file order. */
export function boardRows(list: ContentListResult, deal: string): Row[] {
  return list.deals
    .filter((candidate) => deal === ALL_DEALS || candidate.slug === deal)
    .flatMap((candidate) => candidate.videos.map((video) => ({ video, brand: candidate.brand })));
}

export function rowsIn(rows: readonly Row[], group: GroupId): Row[] {
  const stages: ReadonlyArray<ContentStage> = GROUPS.find((g) => g.id === group)!.stages;
  return rows.filter((row) => stages.includes(row.video.stage));
}

/** The approved video with the nearest due date. A video with no date comes last. */
export function filmNext(rows: readonly Row[]): Row | null {
  const ready = rows.filter((row) => row.video.stage === "ready_to_film");
  return (
    ready.toSorted((a, b) => (a.video.due ?? "9999").localeCompare(b.video.due ?? "9999"))[0] ??
    null
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-11-02` reads as `Nov 2`. Any other text shows as it is. */
export function formatDue(due: string | undefined): string | null {
  if (!due) return null;
  const match = /^\d{4}-(\d{2})-(\d{2})/.exec(due);
  const month = match ? MONTHS[Number(match[1]) - 1] : undefined;
  return match && month ? `${month} ${Number(match[2])}` : due;
}

/** A short line that says why a video needs attention, or null. */
export function attention(video: ContentVideo): string | null {
  if (video.scorecard.blocks.length > 0) return "Rule break";
  if (video.approval === "unsigned" || video.approval === "content_changed")
    return "Needs new approval";
  return null;
}
