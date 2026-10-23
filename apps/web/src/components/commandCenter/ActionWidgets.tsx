import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { FoldedFeedEvent } from "@t3tools/contracts";
import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarIcon } from "lucide-react";
import { useMemo } from "react";

import { groupCommandCenterThreads } from "~/commandCenter";
import { Button } from "~/components/ui/button";
import { useActiveAiosWorkspace } from "~/components/workspace/useActiveAiosWorkspace";
import { openFeedEvent } from "~/eventFeedOpen";
import { useEventFeedStore } from "~/eventFeedStore";
import { cn } from "~/lib/utils";
import {
  useAllEnvironmentShellsBootstrapped,
  useProjects,
  useThreadShells,
} from "~/state/entities";
import { buildThreadRouteParams } from "~/threadRoutes";

import { changedLabel } from "../twoState/areaRows";
import { FailedTag } from "../twoState/FailedTag";
import { plainEventCause, plainEventTitle } from "../twoState/eventText";
import { actionLabel, splitFeed } from "../twoState/railFeed";
import { useLiveArea } from "../twoState/useLiveArea";
import { useFeedStatus } from "../twoState/useTwoStateData";
import { HomeWidget, WidgetEmpty, WidgetError, WidgetList, WidgetSkeleton } from "./HomeWidget";
import { capRows } from "./commandCenter.logic";
import { useNowMs } from "./useHomeReads";

const NEEDS_YOU_ROWS = 5;
const LEVEL_TEXT = { needs_you: "Needs you", failed: "Failed", info: "Info" } as const;

/** Unread questions, permission requests and failures, each with one button that opens it. */
export function NeedsYouWidget() {
  const feed = useFeedStatus();
  const marks = useEventFeedStore((store) => store.marks);
  const markRead = useEventFeedStore((store) => store.markRead);
  const { environmentId } = useActiveAiosWorkspace();
  const navigate = useNavigate();
  const now = useNowMs();
  const { needsYou } = useMemo(() => splitFeed(feed.events, marks), [feed.events, marks]);
  const { shown, hidden } = capRows(needsYou, NEEDS_YOU_ROWS);

  const open = (event: FoldedFeedEvent) => {
    if (!environmentId) return;
    markRead([event.id]);
    openFeedEvent(event, environmentId, navigate);
  };

  return (
    <HomeWidget title="Needs you" count={feed.loaded ? needsYou.length : undefined}>
      {feed.error !== null && !feed.loaded ? (
        <WidgetError message="The list could not be read." onRetry={feed.refresh} />
      ) : !feed.loaded ? (
        <WidgetSkeleton />
      ) : needsYou.length === 0 ? (
        <WidgetEmpty>Nothing needs you right now.</WidgetEmpty>
      ) : (
        <WidgetList>
          {shown.map((event) => {
            const label = actionLabel(event);
            const cause = plainEventCause(event);
            return (
              <li key={event.id} className="flex min-w-0 items-start gap-3 py-2">
                <span
                  aria-hidden
                  className={cn(
                    "mt-[7px] size-1.5 shrink-0 rounded-full",
                    event.level === "failed" ? "bg-destructive" : "bg-warning",
                  )}
                />
                <span className="min-w-0 flex-1">
                  {event.level === "failed" ? null : (
                    <span className="sr-only">{LEVEL_TEXT[event.level]}: </span>
                  )}
                  <span className="block text-sm font-semibold wrap-anywhere">
                    {event.level === "failed" ? <FailedTag /> : null}
                    {plainEventTitle(event.title)}
                  </span>
                  <span className="block text-xs wrap-anywhere text-muted-foreground">
                    {changedLabel(Date.parse(event.ts), now)}
                    {cause ? ` · ${cause}` : null}
                  </span>
                </span>
                {label !== null ? (
                  <Button size="xs" variant="outline" onClick={() => open(event)}>
                    {label}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </WidgetList>
      )}
      {hidden > 0 ? (
        <Link
          to="/inbox"
          className="mt-1 inline-block rounded-sm text-sm font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          See all {needsYou.length} in the Inbox
        </Link>
      ) : null}
    </HomeWidget>
  );
}

/** The file an agent is working on, from the chat's own record. Reads nothing extra from disk. */
function WorkingIn({ thread }: { readonly thread: EnvironmentThreadShell }) {
  const { path } = useLiveArea(scopeThreadRef(thread.environmentId, thread.id));
  return path === null ? (
    <>Working now</>
  ) : (
    <>
      Working in <span className="block truncate font-mono text-foreground">{path}</span>
    </>
  );
}

/** Chats where an agent is working now. The one working live row is a red-tinted surface. */
export function RunningWidget() {
  const threads = useThreadShells();
  const projects = useProjects();
  const ready = useAllEnvironmentShellsBootstrapped();
  const now = useNowMs();
  const running = useMemo(() => groupCommandCenterThreads(threads).running, [threads]);
  const projectNames = useMemo(
    () =>
      new Map(
        projects.map((project) => [
          JSON.stringify([project.environmentId, project.id]),
          project.title,
        ]),
      ),
    [projects],
  );

  return (
    <HomeWidget
      title="Running"
      count={ready ? `${running.length} ${running.length === 1 ? "agent" : "agents"}` : undefined}
    >
      {!ready ? (
        <WidgetSkeleton rows={2} />
      ) : running.length === 0 ? (
        <WidgetEmpty>No agent is working right now.</WidgetEmpty>
      ) : (
        <ul className="grid gap-1.5">
          {running.map(({ thread, status }) => {
            const ref = scopeThreadRef(thread.environmentId, thread.id);
            const live = status === "working";
            const project = projectNames.get(
              JSON.stringify([thread.environmentId, thread.projectId]),
            );
            return (
              <li key={scopedThreadKey(ref)}>
                <Link
                  to="/$environmentId/$threadId"
                  params={buildThreadRouteParams(ref)}
                  title={`Open ${thread.title}`}
                  className={cn(
                    "flex min-w-0 items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                    live
                      ? "border-primary/30 bg-primary/10 hover:bg-primary/15"
                      : "border-transparent hover:bg-surface-raised",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold wrap-anywhere">
                      {thread.title || "Untitled chat"}
                    </span>
                    <span className="block min-w-0 text-xs text-muted-foreground">
                      {live ? (
                        <WorkingIn thread={thread} />
                      ) : (
                        `Waiting for background work${project ? ` · ${project}` : ""}`
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">
                    {live ? "Now" : changedLabel(Date.parse(thread.updatedAt), now)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </HomeWidget>
  );
}

/** No calendar read exists yet, so this says so instead of showing made-up meetings. */
export function UpNextWidget() {
  return (
    <HomeWidget title="Up next" count="no calendar">
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-border p-4">
        <CalendarIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 text-sm">
          <p className="font-semibold">No calendar connected</p>
          <p className="mt-0.5 text-muted-foreground">
            Connect a calendar and your next meetings show here.
          </p>
          <Link
            to="/settings/integrations"
            className="mt-2 inline-block rounded-sm font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          >
            Connect a calendar
          </Link>
        </div>
      </div>
    </HomeWidget>
  );
}
