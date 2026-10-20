import {
  BrainIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  FileTextIcon,
  FolderSearchIcon,
  InboxIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserIcon,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { aiosMemorySummaryQuery } from "~/state/taskBoard";
import { useActiveAiosWorkspace } from "~/components/workspace/useActiveAiosWorkspace";

/**
 * Plain-language Memory overview in Command Center.
 * Exposes active identity, verified facts, decisions, and review queue with zero database maintenance.
 */
export function AiosMemoryCard() {
  const environmentId = usePrimaryEnvironmentId();
  const { scope, scopeReady } = useActiveAiosWorkspace();
  const memory = useEnvironmentQuery(
    environmentId && scopeReady ? aiosMemorySummaryQuery({ environmentId, input: scope }) : null,
  );
  const { data, error, refresh } = memory;

  if (data === null && error !== null) {
    return (
      <section role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm">
        <p className="font-medium">Could not read memory status</p>
        <p className="mt-1 text-muted-foreground">{error}</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={refresh}>
          <RefreshCwIcon aria-hidden className="mr-1.5 size-3.5" /> Try again
        </Button>
      </section>
    );
  }

  if (data === null) {
    return (
      <div role="status" className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Spinner /> Reading memory store...
      </div>
    );
  }

  if (data.status === "not_detected" || data.status === "empty") {
    return (
      <section className="rounded-lg border border-dashed border-border p-5 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <FolderSearchIcon aria-hidden className="size-4 text-muted-foreground" />
          No memories captured yet
        </div>
        <p className="mt-1 text-muted-foreground">
          Your AI stores facts and decisions in plain Markdown files under <code>memory/</code> and
          indexes them in a local SQLite database for instant retrieval. As you chat, verified facts
          appear here automatically.
        </p>
      </section>
    );
  }

  const {
    docCount,
    identity,
    verifiedCount,
    decisionsCount,
    grillSessionsCount,
    reviewQueue,
    recentDecisions,
    checks,
  } = data;

  return (
    <section
      aria-labelledby="aios-memory-title"
      className="flex flex-col gap-4 rounded-lg border border-border p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <BrainIcon aria-hidden className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 id="aios-memory-title" className="text-base font-semibold">
                Leonidas Memory
              </h2>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Live SQLite FTS5
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Markdown is the single source of truth. Zero database maintenance.
            </p>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={refresh} aria-label="Refresh Memory Status">
          <RefreshCwIcon aria-hidden className="size-4" />
        </Button>
      </div>

      {/* KPI Stats */}
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-md bg-muted/40 px-3 py-2">
          <dt className="text-xs text-muted-foreground">Indexed Items</dt>
          <dd className="text-lg font-semibold tabular-nums">{docCount.toLocaleString()}</dd>
        </div>
        <div className="rounded-md bg-muted/40 px-3 py-2">
          <dt className="text-xs text-muted-foreground">Verified Facts</dt>
          <dd className="text-lg font-semibold tabular-nums">{verifiedCount}</dd>
        </div>
        <div className="rounded-md bg-muted/40 px-3 py-2">
          <dt className="text-xs text-muted-foreground">ADR Decisions</dt>
          <dd className="text-lg font-semibold tabular-nums">{decisionsCount}</dd>
        </div>
        <div className="rounded-md bg-muted/40 px-3 py-2">
          <dt className="text-xs text-muted-foreground">Grill Sessions</dt>
          <dd className="text-lg font-semibold tabular-nums">{grillSessionsCount}</dd>
        </div>
      </dl>

      {/* Active Identity Spotlight */}
      {identity ? (
        <div className="rounded-md border border-border/80 bg-accent/20 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-medium text-sm">
              <UserIcon aria-hidden className="size-4 text-primary" />
              <span>{identity.title}</span>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              Verified: {identity.verified}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {identity.snippet}
          </p>
        </div>
      ) : null}

      {/* Recent Decisions & Review Queue Side-by-Side */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Recent Decisions */}
        <div className="rounded-md border border-border/60 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            <FileTextIcon aria-hidden className="size-3.5" />
            Recent Decisions
          </div>
          {recentDecisions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No decisions recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border/60 text-xs">
              {recentDecisions.map((dec) => (
                <li key={dec.id} className="py-1.5 first:pt-0 last:pb-0">
                  <span className="font-mono font-medium text-primary mr-1.5">#{dec.id}</span>
                  <span className="text-foreground/90 font-medium">{dec.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Review Queue Status */}
        <div className="rounded-md border border-border/60 p-3">
          <div className="flex items-center justify-between gap-1.5 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <InboxIcon aria-hidden className="size-3.5" />
              Review Queue
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {reviewQueue.openCount} pending
            </span>
          </div>
          {reviewQueue.openCount === 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 py-2">
              <CheckCircle2Icon aria-hidden className="size-3.5 shrink-0" />
              <span>Queue is clear. 0 items awaiting review.</span>
            </div>
          ) : (
            <ul className="divide-y divide-border/60 text-xs">
              {reviewQueue.recentOpen.map((item) => (
                <li key={item.id} className="py-1.5 first:pt-0 last:pb-0">
                  <div className="font-mono font-medium text-foreground truncate">{item.slug}</div>
                  <div className="text-muted-foreground text-[11px] truncate">
                    {item.description}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Safety & Verification Guarantees Strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <ShieldCheckIcon
            aria-hidden
            className={`size-3.5 ${checks.provenance ? "text-emerald-500" : "text-muted-foreground"}`}
          />
          Provenance Tracking
        </span>
        <span className="flex items-center gap-1">
          <ShieldCheckIcon
            aria-hidden
            className={`size-3.5 ${checks.correctionPropagation ? "text-emerald-500" : "text-muted-foreground"}`}
          />
          Instant Propagation
        </span>
        <span className="flex items-center gap-1">
          <ShieldCheckIcon
            aria-hidden
            className={`size-3.5 ${checks.privacyGuard ? "text-emerald-500" : "text-muted-foreground"}`}
          />
          Privacy Guard
        </span>
        <span className="flex items-center gap-1">
          <ShieldCheckIcon
            aria-hidden
            className={`size-3.5 ${checks.boundaryIsolation ? "text-emerald-500" : "text-muted-foreground"}`}
          />
          Cross-Repo Isolation (ADR-0008)
        </span>
      </div>
    </section>
  );
}
