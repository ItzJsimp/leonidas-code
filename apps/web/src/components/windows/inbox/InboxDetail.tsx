import type { FoldedFeedEvent } from "@t3tools/contracts";
import { ArrowLeftIcon } from "lucide-react";
import type { Ref } from "react";

import { Button } from "~/components/ui/button";

import { changedLabel } from "../../twoState/areaRows";
import { actionLabel } from "../../twoState/railFeed";
import { Tip } from "../../twoState/Tip";
import { sourceLabel } from "./inbox.logic";

/** One message: what happened, where it came from, and the one thing to do about it. */
export function InboxDetail({
  event,
  read,
  now,
  onBack,
  onOpen,
  onMarkRead,
  onDismiss,
  headingRef,
}: {
  readonly event: FoldedFeedEvent;
  readonly read: boolean;
  readonly now: number;
  /** Set on narrow panes, where the detail replaces the list. */
  readonly onBack: (() => void) | null;
  readonly onOpen: () => void;
  readonly onMarkRead: () => void;
  readonly onDismiss: () => void;
  readonly headingRef: Ref<HTMLHeadingElement>;
}) {
  const label = actionLabel(event);
  const files = event.target?.files ?? [];
  return (
    <article aria-label={event.title} className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      {onBack ? (
        <div className="mb-3">
          <Tip text="Back to the list">
            <Button size="icon-sm" variant="ghost" aria-label="Back to the list" onClick={onBack}>
              <ArrowLeftIcon />
            </Button>
          </Tip>
        </div>
      ) : null}
      <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-hidden">
        {event.title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {sourceLabel(event)} · {changedLabel(Date.parse(event.ts), now)}
        {event.count > 1 ? ` · happened ${event.count} times` : ""}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {label !== null ? (
          <Button size="sm" variant="outline" onClick={onOpen}>
            {label}
          </Button>
        ) : null}
        {read ? null : (
          <Button size="sm" variant="ghost-muted" onClick={onMarkRead}>
            Mark as read
          </Button>
        )}
        <Button size="sm" variant="ghost-muted" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
      {event.body ? <p className="mt-5 text-sm leading-relaxed">{event.body}</p> : null}
      {files.length > 0 ? (
        <p className="mt-3 text-xs break-words text-muted-foreground">{files.join(", ")}</p>
      ) : null}
    </article>
  );
}
