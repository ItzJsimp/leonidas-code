import { ActivityIcon, BrainIcon, InboxIcon, type LucideIcon, SquareCheckIcon } from "lucide-react";
import { useMemo } from "react";

import { Skeleton } from "~/components/ui/skeleton";

import { Tip } from "../twoState/Tip";
import { useAiosHome, useFeedStatus, useTwoStateCounts } from "../twoState/useTwoStateData";
import { oldestAt, type TileModel, tileModels } from "./commandCenter.logic";
import { splitFeed } from "../twoState/railFeed";
import { useEventFeedStore } from "~/eventFeedStore";
import { WidgetError } from "./HomeWidget";
import { useNowMs } from "./useHomeReads";

const TILE_ICONS: Record<TileModel["id"], LucideIcon> = {
  "needs-you": InboxIcon,
  running: ActivityIcon,
  "open-tasks": SquareCheckIcon,
  memory: BrainIcon,
};

/** The four numbers under the greeting. Needs you is the same count the Inbox badge shows. */
export function NumberTiles() {
  const counts = useTwoStateCounts();
  const feed = useFeedStatus();
  const marks = useEventFeedStore((store) => store.marks);
  const homeRead = useAiosHome();
  const home = homeRead.data;
  const now = useNowMs();
  const tiles = useMemo(
    () =>
      tileModels(
        {
          needsYou: counts.needsYou,
          running: counts.running,
          oldestNeedsYouAt: oldestAt(splitFeed(feed.events, marks).needsYou),
          home,
        },
        now,
      ),
    [counts.needsYou, counts.running, feed.events, marks, home, now],
  );

  const failed =
    (homeRead.error !== null && home === null) || (feed.error !== null && !feed.loaded);
  const retry = () => {
    homeRead.refresh();
    feed.refresh();
  };

  return (
    <div className="@container">
      {/* 1, 2 or 4 columns by the width of this pane, never 3 plus 1. */}
      <ul className="grid grid-cols-1 gap-3 @sm:grid-cols-2 @xl:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = TILE_ICONS[tile.id];
          return (
            <li key={tile.id} className="min-w-0">
              <Tip text={tile.tip}>
                <div
                  tabIndex={0}
                  className="h-full rounded-xl border border-border bg-card p-3.5 shadow-xs shadow-black/30 inset-shadow-2xs inset-shadow-white/4 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon aria-hidden className="size-4 shrink-0" />
                    {tile.label}
                  </p>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    {tile.value === null ? (
                      <Skeleton className="h-7 w-12" />
                    ) : (
                      <span className="font-display text-3xl leading-none font-semibold tabular-nums">
                        {tile.value.toLocaleString("en-US")}
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground">{tile.unit}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{tile.note}</p>
                </div>
              </Tip>
            </li>
          );
        })}
      </ul>
      {failed ? (
        <div className="mt-3">
          <WidgetError message="Some numbers could not be read." onRetry={retry} />
        </div>
      ) : null}
    </div>
  );
}
