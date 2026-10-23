import type { MarketingListResult } from "@t3tools/contracts";
import { Link } from "@tanstack/react-router";
import { MegaphoneIcon } from "lucide-react";
import { AsyncResult } from "effect/reactivity";
import { type KeyboardEvent, useMemo, useState } from "react";

import { WorkspacePageHeader } from "~/components/WorkspacePageHeader";
import { SidebarInset } from "~/components/ui/sidebar";
import { isElectron } from "~/env";
import { cn } from "~/lib/utils";

import { useAtomCommand } from "../../state/use-atom-command";
import { BatchApproval, type DecideFn } from "./BatchApproval";
import { ContentList } from "./ContentList";
import { contentRows } from "./marketing.logic";
import { MetricsPanel } from "./MetricsPanel";
import { marketingDecide, useMarketing } from "./state";

const TABS = [
  { id: "approval", label: "Needs approval" },
  { id: "content", label: "Content" },
  { id: "metrics", label: "Metrics" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** The Marketing view. A Command Center lens can host this same component later. */
export function MarketingScreen(props: {
  readonly list: MarketingListResult | null;
  readonly error: string | null;
  readonly noWorkspace?: boolean;
  readonly canDecide: boolean;
  readonly decide: DecideFn;
  readonly onRefresh: () => void;
}) {
  const { list, error } = props;
  const [tab, setTab] = useState<TabId>("approval");
  const brandNames = useMemo(
    () => Object.fromEntries((list?.brands ?? []).map((brand) => [brand.slug, brand.name])),
    [list],
  );
  const rows = useMemo(() => (list ? contentRows(list) : []), [list]);

  const move = (event: KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = TABS[(index + step + TABS.length) % TABS.length]!;
    setTab(next.id);
    document.getElementById(`marketing-tab-${next.id}`)?.focus();
  };

  return (
    <SidebarInset className="isolate h-dvh min-h-0 overflow-hidden overscroll-y-none">
      <WorkspacePageHeader electron={isElectron} className="gap-2 border-b border-border">
        <MegaphoneIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <h1 className="truncate text-sm font-medium">Marketing</h1>
      </WorkspacePageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-gutter-both">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 sm:p-6">
          <p className="text-sm text-muted-foreground">
            Agents write drafts. You decide what goes out.
          </p>

          {list?.bad.length ? (
            <details className="rounded-md border border-border p-3 text-sm">
              <summary className="cursor-pointer">
                {list.bad.length} {list.bad.length === 1 ? "line was" : "lines were"} skipped
              </summary>
              <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                {list.bad.map((item) => (
                  <li key={`${item.file}:${item.line ?? 0}:${item.reason}`}>
                    {item.file}
                    {item.line ? ` line ${item.line}` : ""}: {item.reason}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <div role="tablist" aria-label="Marketing views" className="flex gap-1">
            {TABS.map((item, index) => {
              const selected = item.id === tab;
              const count = item.id === "approval" ? (list?.queueTotal ?? 0) : 0;
              return (
                <button
                  key={item.id}
                  id={`marketing-tab-${item.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`marketing-panel-${item.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setTab(item.id)}
                  onKeyDown={(event) => move(event, index)}
                  className={cn(
                    "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm outline-none transition-colors duration-150",
                    "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    selected
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {item.label}
                  {count > 0 ? <span className="tabular-nums">{count}</span> : null}
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id={`marketing-panel-${tab}`}
            aria-labelledby={`marketing-tab-${tab}`}
          >
            {props.noWorkspace ? (
              <p role="status" className="text-sm text-muted-foreground">
                Marketing reads the marketing folder of your AIOS. Connect your AIOS folder on the{" "}
                <Link to="/tasks" className="text-primary underline underline-offset-4">
                  Tasks page
                </Link>
                , then come back.
              </p>
            ) : list === null ? (
              <p role="status" className="text-sm text-muted-foreground">
                {error ? "Marketing numbers are not available now. Try again later." : "Loading..."}
              </p>
            ) : tab === "approval" ? (
              <BatchApproval
                queue={list.queue}
                brandNames={brandNames}
                queueTotal={list.queueTotal}
                canDecide={props.canDecide}
                decide={props.decide}
                onDecided={props.onRefresh}
              />
            ) : tab === "content" ? (
              <ContentList rows={rows} total={list.postsTotal} brandNames={brandNames} />
            ) : (
              <MetricsPanel metrics={list.metrics} />
            )}
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}

export function MarketingView() {
  const { environmentId, list, error, noWorkspace, refresh, canDecide } = useMarketing();
  const run = useAtomCommand(marketingDecide);
  const decide: DecideFn = async (decisions) => {
    if (!environmentId) return null;
    const result = await run({ environmentId, input: { decisions: [...decisions] } });
    return AsyncResult.isSuccess(result) ? result.value.results : null;
  };
  return (
    <MarketingScreen
      list={list}
      error={error}
      noWorkspace={noWorkspace}
      canDecide={canDecide}
      decide={decide}
      onRefresh={refresh}
    />
  );
}
