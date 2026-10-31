import type { ContentVideo } from "@t3tools/contracts";

import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

import { attention, formatDue, GROUPS, type Row, rowsIn, stageLabel } from "./content.logic";

/** A video's place on the board and in the URL-free selection: `deal/file`. */
export const refOf = (video: ContentVideo) => `${video.deal}/${video.file}`;

function VideoCard(props: {
  readonly row: Row;
  readonly selected: boolean;
  readonly onOpen: (video: ContentVideo) => void;
}) {
  const { video, brand } = props.row;
  const flag = attention(video);
  const due = formatDue(video.due);
  return (
    <button
      type="button"
      data-video={refOf(video)}
      aria-current={props.selected ? "true" : undefined}
      onClick={() => props.onOpen(video)}
      className={cn(
        "flex w-full flex-col gap-1.5 rounded-lg border bg-card p-2.5 text-left text-card-foreground shadow-xs/5 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        props.selected && "ring-2 ring-inset ring-ring",
      )}
    >
      <span className="text-muted-foreground text-xs">{brand}</span>
      <span className="line-clamp-2 font-medium text-sm leading-snug wrap-anywhere">
        {video.title}
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        <Badge size="sm" variant={video.stage === "ready_to_film" ? "default" : "secondary"}>
          {stageLabel(video.stage)}
        </Badge>
        {flag ? (
          <Badge size="sm" variant={flag === "Rule break" ? "error" : "warning"}>
            {flag}
          </Badge>
        ) : null}
        {due ? (
          <span className="ml-auto text-muted-foreground text-xs tabular-nums">{due}</span>
        ) : null}
      </span>
    </button>
  );
}

/** Five stage groups. Below 1100 px they swipe, and so do they while the panel is open. */
export function Board(props: {
  readonly rows: readonly Row[];
  readonly selected: string | null;
  readonly onOpen: (video: ContentVideo) => void;
}) {
  return (
    // Below 1100 px, or while the side panel is open, the groups scroll sideways and snap, so a phone swipes one group at a time.
    <div
      className={cn(
        "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6",
        !props.selected &&
          "min-[1100px]:mx-0 min-[1100px]:grid min-[1100px]:grid-cols-5 min-[1100px]:overflow-visible min-[1100px]:px-0",
      )}
    >
      {GROUPS.map((group) => {
        const rows = rowsIn(props.rows, group.id);
        return (
          <section
            key={group.id}
            aria-label={group.label}
            className={cn(
              "flex w-[min(85vw,18rem)] shrink-0 snap-start flex-col rounded-xl border bg-muted/40",
              !props.selected && "min-[1100px]:w-auto",
            )}
          >
            <header className="flex items-center gap-2 px-3 py-2">
              <h3 className="font-medium text-sm">{group.label}</h3>
              <Badge size="sm" variant="secondary">
                {rows.length}
              </Badge>
            </header>
            <div className="flex flex-col gap-2 p-2 pt-0">
              {rows.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-6 text-center text-muted-foreground text-xs">
                  Nothing here yet.
                </p>
              ) : (
                rows.map((row) => (
                  <VideoCard
                    key={refOf(row.video)}
                    row={row}
                    selected={props.selected === refOf(row.video)}
                    onOpen={props.onOpen}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
