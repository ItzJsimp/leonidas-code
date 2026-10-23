import { useMemo } from "react";

import { Badge } from "~/components/ui/badge";
import { useEnvironmentQuery } from "~/state/query";
import { eventFeedLive } from "~/state/eventFeed";
import { formatRelativeTimeLabel } from "~/timestampFormat";
import { useActiveAiosWorkspace } from "~/components/workspace/useActiveAiosWorkspace";
import { ledgerFor } from "./taskLedger.logic";

/** The Task ledger (ADR-0090): one entry per finished run, with the chat, agent and model that did the work. */
export function TaskHistory({ taskId }: { readonly taskId: string }) {
  const workspace = useActiveAiosWorkspace();
  const feed = useEnvironmentQuery(
    workspace.environmentId && workspace.scopeReady
      ? eventFeedLive({ environmentId: workspace.environmentId, input: workspace.scope })
      : null,
  );
  const entries = useMemo(() => ledgerFor(feed.data?.events ?? [], taskId), [feed.data, taskId]);

  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        No runs recorded yet. Each finished chat run adds one entry here.
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-3">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-1 border-border border-l pl-3">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
            <span className="font-medium wrap-anywhere">{entry.chat ?? entry.title}</span>
            <span className="text-muted-foreground">{entry.actor.name}</span>
            {entry.model ? (
              <Badge variant="secondary" size="sm">
                {entry.model}
              </Badge>
            ) : null}
            {entry.level === "failed" ? (
              <Badge variant="outline" size="sm">
                Failed
              </Badge>
            ) : null}
            <time className="text-muted-foreground text-xs" dateTime={entry.ts}>
              {formatRelativeTimeLabel(entry.ts)}
            </time>
          </div>
          {entry.body ? (
            <p className="text-muted-foreground text-xs wrap-anywhere">{entry.body}</p>
          ) : null}
          {entry.actor.member ? (
            <p className="text-muted-foreground text-xs">For {entry.actor.member}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
