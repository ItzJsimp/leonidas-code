import { useNavigate } from "@tanstack/react-router";
import { BellIcon, RefreshCwIcon } from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { openFeedEvent } from "~/eventFeedOpen";
import { useEventFeedStore } from "~/eventFeedStore";
import { useNowMinute } from "~/hooks/useNowMinute";
import { RightPanelResizeHandle } from "~/components/preview/RightPanelResizeHandle";
import { RESIZABLE_WIDTH_PROPERTY, useResizableWidth } from "~/hooks/useResizableWidth";
import { observeResize } from "~/lib/observeResize";

import { changedLabel } from "../../twoState/areaRows";
import { RailWindow, WindowEmpty, WindowError } from "../../twoState/RailWindow";
import { Tip } from "../../twoState/Tip";
import { useInboxUnread } from "../../twoState/useInboxUnread";
import { InboxDetail } from "./InboxDetail";
import { InboxList } from "./InboxList";
import {
  filterInbox,
  groupInbox,
  inboxCounts,
  inboxEmptyText,
  neighborRowId,
  rowsOf,
  searchInbox,
  unreadIds,
  type InboxFilter,
} from "./inbox.logic";
import { useInboxFeed } from "./useInboxFeed";

/** Below this pane width the list and the message take turns. */
const NARROW_PANE = 640;

/** The Inbox window: what needs you and what finished, with the message beside the list. */
export function InboxWindow() {
  const feed = useInboxFeed();
  const marks = useEventFeedStore((store) => store.marks);
  const markRead = useEventFeedStore((store) => store.markRead);
  const dismiss = useEventFeedStore((store) => store.dismiss);
  const navigate = useNavigate();
  const railUnread = useInboxUnread();
  const minute = useNowMinute();
  const now = Date.parse(`${minute}Z`);

  const [filter, setFilter] = useState<InboxFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const heading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (!frame) return;
    return observeResize(frame, (entries) => {
      const width = entries.at(-1)?.contentRect.width;
      if (width !== undefined) setNarrow(width < NARROW_PANE);
    });
  }, [frame]);

  const counts = useMemo(() => inboxCounts(feed.events, marks), [feed.events, marks]);
  const groups = useMemo(
    () => filterInbox(groupInbox(searchInbox(feed.events, query), marks, now), filter),
    [feed.events, query, marks, now, filter],
  );
  const rows = rowsOf(groups);
  const selected = rows.find((row) => row.id === selectedId) ?? (narrow ? undefined : rows[0]);
  const showDetail = !narrow || (detailOpen && selected !== undefined);
  const showList = !narrow || !showDetail;

  const closeDetail = () => {
    setDetailOpen(false);
    requestAnimationFrame(() => {
      const index = rows.findIndex((row) => row.id === selected?.id);
      rowRefs.current[Math.max(index, 0)]?.focus();
    });
  };
  const openRow = (id: string) => {
    setSelectedId(id);
    setDetailOpen(true);
    if (narrow) requestAnimationFrame(() => heading.current?.focus());
  };
  const open = () => {
    if (!selected || !feed.environmentId) return;
    markRead([selected.id]);
    openFeedEvent(selected, feed.environmentId, navigate);
  };
  // The Mark as read button leaves the page, so focus goes to the next row (narrow: the heading).
  const markSelectedRead = () => {
    if (!selected) return;
    const target = neighborRowId(rows, selected.id);
    markRead([selected.id]);
    if (narrow || !target) {
      requestAnimationFrame(() => heading.current?.focus());
      return;
    }
    setSelectedId(target);
    requestAnimationFrame(() =>
      rowRefs.current.find((element) => element?.dataset.rowId === target)?.focus(),
    );
  };
  const dismissSelected = () => {
    if (!selected) return;
    dismiss(selected.id);
    if (narrow) closeDetail();
  };

  // Long titles are cut at the default width, so the list column can be dragged wider.
  const list = useResizableWidth({
    storageKey: "leonidas.notifications.listWidth",
    defaultWidth: 360,
    minWidth: 260,
    maxWidth: 720,
    edge: "right",
  });

  const actions = (
    <>
      {feed.updatedAt > 0 ? (
        <Tip text="Check for new messages">
          <Button size="xs" variant="ghost-muted" onClick={feed.refresh}>
            <RefreshCwIcon aria-hidden />
            Updated {changedLabel(feed.updatedAt, now)}
          </Button>
        </Tip>
      ) : null}
      <Button
        size="xs"
        variant="ghost-muted"
        disabled={railUnread === 0}
        onClick={() => markRead(unreadIds(feed.events, marks))}
      >
        Mark all as read
      </Button>
    </>
  );

  return (
    <RailWindow title="Notifications" actions={actions}>
      {feed.loading ? (
        <div role="status" aria-label="Loading your notifications" className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((key) => (
            <Skeleton key={key} className="h-12 w-full" shape="card" />
          ))}
        </div>
      ) : feed.failed ? (
        <WindowError
          message="Your notifications did not load. Check that Leonidas is running, then try again."
          onRetry={feed.refresh}
        />
      ) : feed.events.length === 0 ? (
        <WindowEmpty icon={BellIcon} {...inboxEmptyText(feed.bad)} />
      ) : (
        // The window body pads its content; the two panes sit flush against its edges.
        <div
          ref={setFrame}
          onKeyDown={(event) => {
            if (event.key === "Escape" && narrow && showDetail) closeDetail();
          }}
          className="-m-4 flex h-[calc(100%+2rem)] min-h-0 border-t border-border"
        >
          <div
            // The detail keeps at least 20rem however wide the list is dragged.
            style={
              showList && !narrow
                ? ({
                    [RESIZABLE_WIDTH_PROPERTY]: `${list.width}px`,
                    width: `min(var(${RESIZABLE_WIDTH_PROPERTY}), calc(100% - 20rem))`,
                  } as CSSProperties)
                : undefined
            }
            className={
              !showList
                ? "hidden"
                : narrow
                  ? "flex min-h-0 w-full flex-col"
                  : "relative flex min-h-0 shrink-0 flex-col border-r border-border"
            }
          >
            <InboxList
              groups={groups}
              counts={counts}
              unread={railUnread}
              filter={filter}
              onFilter={setFilter}
              query={query}
              onQuery={setQuery}
              selectedId={selected?.id}
              onSelect={(event) => setSelectedId(event.id)}
              onOpen={(event) => openRow(event.id)}
              marks={marks}
              now={now}
              rowRefs={rowRefs}
            />
            {showList && !narrow ? (
              <RightPanelResizeHandle handlers={list.handlers} className="-right-1 left-auto" />
            ) : null}
          </div>
          {showDetail ? (
            selected ? (
              <InboxDetail
                key={selected.id}
                event={selected}
                read={marks[selected.id]?.read === true}
                now={now}
                environmentId={feed.environmentId}
                onBack={narrow ? closeDetail : null}
                onOpen={open}
                onMarkRead={markSelectedRead}
                onDismiss={dismissSelected}
                headingRef={heading}
              />
            ) : (
              <p className="m-auto px-6 text-sm text-muted-foreground">
                Pick a message to read it here.
              </p>
            )
          ) : null}
        </div>
      )}
    </RailWindow>
  );
}
