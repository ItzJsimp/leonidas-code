import type { EnvironmentId, FoldedFeedEvent, ThreadId } from "@t3tools/contracts";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import type { Ref } from "react";

import { Button } from "~/components/ui/button";
import { buildThreadRouteParams } from "~/threadRoutes";

import { changedLabel } from "../../twoState/areaRows";
import { plainEventCause, plainEventTitle } from "../../twoState/eventText";
import { actionLabel } from "../../twoState/railFeed";
import { Tip } from "../../twoState/Tip";
import { linkedThreadId, sourceLabel } from "./inbox.logic";

/** One message: what happened, where it came from, and the one thing to do about it. */
export function InboxDetail({
  event,
  read,
  now,
  environmentId,
  onBack,
  onOpen,
  onMarkRead,
  onDismiss,
  headingRef,
}: {
  readonly event: FoldedFeedEvent;
  readonly read: boolean;
  readonly now: number;
  /** Where the linked chat lives. Without it the chat link is hidden. */
  readonly environmentId?: EnvironmentId | null;
  /** Set on narrow panes, where the detail replaces the list. */
  readonly onBack: (() => void) | null;
  readonly onOpen: () => void;
  readonly onMarkRead: () => void;
  readonly onDismiss: () => void;
  readonly headingRef: Ref<HTMLHeadingElement>;
}) {
  const label = actionLabel(event);
  const files = event.target?.files ?? [];
  const title = plainEventTitle(event.title);
  const cause = plainEventCause(event);
  const threadId = linkedThreadId(event);
  return (
    <article aria-label={title} className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
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
        {title}
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
      {cause ? <p className="mt-5 text-sm leading-relaxed">{cause}</p> : null}
      {/* The link only adds a way in when the main button does something other than open the chat. */}
      {threadId && environmentId && label !== "Open chat" ? (
        <Link
          to="/$environmentId/$threadId"
          params={buildThreadRouteParams(scopeThreadRef(environmentId, threadId as ThreadId))}
          className="mt-3 w-fit rounded-sm text-sm font-medium text-foreground underline underline-offset-4 hover:no-underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          Open the linked chat
        </Link>
      ) : null}
      {files.length > 0 ? (
        <p className="mt-3 text-xs break-words text-muted-foreground">{files.join(", ")}</p>
      ) : null}
    </article>
  );
}
