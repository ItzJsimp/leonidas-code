import type {
  ContentHistoryResult,
  ContentListResult,
  ContentStage,
  ContentVideo,
} from "@t3tools/contracts";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { Link } from "@tanstack/react-router";
import { AsyncResult } from "effect/reactivity";
import { ClapperboardIcon } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";

import { WindowEmpty, WindowLoading } from "~/components/twoState/RailWindow";
import { WindowHeader } from "~/components/twoState/WindowHeader";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { SidebarInset } from "~/components/ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { useAtomCommand } from "../../state/use-atom-command";

import {
  ALL_DEALS,
  attention,
  boardRows,
  filmNext,
  formatDue,
  GROUPS,
  type Row,
  rowsIn,
  stageLabel,
} from "./content.logic";
import { contentHistory, contentMove, contentSaveScript, useContent } from "./state";

/** One thing a person does to a video. */
export type ContentAction =
  | {
      readonly kind: "move";
      readonly deal: string;
      readonly file: string;
      readonly to: ContentStage;
      readonly note?: string;
    }
  | {
      readonly kind: "script";
      readonly deal: string;
      readonly file: string;
      readonly script: string;
    };

/** Runs one action. Gives the saved video, or the message to show when it failed. */
export type ActFn = (action: ContentAction) => Promise<ContentVideo | string>;
export type LoadHistoryFn = (ref: {
  readonly deal: string;
  readonly file: string;
}) => Promise<ContentHistoryResult | null>;

const formatTime = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const refOf = (video: ContentVideo) => `${video.deal}/${video.file}`;

/** Every control explains itself: what it does and what happens next. */
function Tip(props: { readonly label: string; readonly children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={props.children} />
      <TooltipPopup side="top">{props.label}</TooltipPopup>
    </Tooltip>
  );
}

function DealFilter(props: {
  readonly list: ContentListResult;
  readonly value: string;
  readonly onChange: (deal: string) => void;
}) {
  const options = [
    { value: ALL_DEALS, label: "All deals" },
    ...props.list.deals.map((deal) => ({ value: deal.slug, label: deal.brand })),
  ];
  const current = options.find((option) => option.value === props.value) ?? options[0]!;
  return (
    <Select
      value={current.value}
      onValueChange={(value) => {
        if (typeof value === "string") props.onChange(value);
      }}
    >
      <SelectTrigger size="xs" className="w-44" aria-label="Deal">
        <SelectValue>{current.label}</SelectValue>
      </SelectTrigger>
      <SelectPopup>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}

function FilmNext(props: {
  readonly row: Row | null;
  readonly canAct: boolean;
  readonly onOpen: (video: ContentVideo) => void;
  readonly onFilmed: (video: ContentVideo) => void;
}) {
  if (!props.row) {
    return (
      <section
        aria-label="Film next"
        className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground"
      >
        Nothing is ready to film. A video shows here when a person approves its script.
      </section>
    );
  }
  const { video, brand } = props.row;
  const facts = [
    `Film next for ${brand}`,
    formatDue(video.due) ? `due ${formatDue(video.due)}` : null,
    video.lengthS ? `${video.lengthS} s` : null,
    video.approvedBy ? `approved by ${video.approvedBy}` : null,
  ].filter(Boolean);
  return (
    <section
      aria-label="Film next"
      className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-xs/5 sm:flex-row sm:items-center sm:p-5"
    >
      <ClapperboardIcon aria-hidden className="hidden size-8 shrink-0 text-primary sm:block" />
      <div className="min-w-0 flex-1">
        <h2 className="text-balance font-semibold text-lg leading-snug">{video.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{facts.join(" · ")}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Tip label="Open the script, the shot list and the notes">
          <Button size="sm" onClick={() => props.onOpen(video)}>
            Open script
          </Button>
        </Tip>
        <Tip
          label={
            props.canAct
              ? "Move this video to Filmed. You can undo it."
              : "Only a signed-in person can mark a video filmed"
          }
        >
          <Button
            size="sm"
            variant="outline"
            disabled={!props.canAct}
            onClick={() => props.onFilmed(video)}
          >
            Mark filmed
          </Button>
        </Tip>
      </div>
    </section>
  );
}

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

function Board(props: {
  readonly rows: readonly Row[];
  readonly selected: string | null;
  readonly onOpen: (video: ContentVideo) => void;
}) {
  return (
    // Below 1100 px the groups scroll sideways and snap, so a phone swipes one group at a time.
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 sm:-mx-6 sm:px-6 min-[1100px]:mx-0 min-[1100px]:grid min-[1100px]:grid-cols-5 min-[1100px]:overflow-visible min-[1100px]:px-0">
      {GROUPS.map((group) => {
        const rows = rowsIn(props.rows, group.id);
        return (
          <section
            key={group.id}
            aria-label={group.label}
            className="flex w-[min(85vw,18rem)] shrink-0 snap-start flex-col rounded-xl border bg-muted/40 min-[1100px]:w-auto"
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

/** The Content screen: every video of every deal by stage, with the next one to film on top. */
export function ContentScreen(props: {
  readonly list: ContentListResult | null;
  readonly error: string | null;
  readonly noWorkspace?: boolean;
  readonly updatedAt?: number;
  readonly canAct: boolean;
  readonly act: ActFn;
  readonly loadHistory: LoadHistoryFn;
  readonly onRefresh: () => void;
  /** The deal the filter starts on. */
  readonly initialDeal?: string;
}) {
  const { list, error } = props;
  const [deal, setDeal] = useState(props.initialDeal ?? ALL_DEALS);
  const [selected, setSelected] = useState<string | null>(null);
  const rows = useMemo(() => (list ? boardRows(list, deal) : []), [list, deal]);
  const next = filmNext(rows);
  const open = (video: ContentVideo) => setSelected(refOf(video));
  const markFilmed = (video: ContentVideo) =>
    void props
      .act({ kind: "move", deal: video.deal, file: video.file, to: "filmed" })
      .then(() => props.onRefresh());

  const body = props.noWorkspace ? (
    <p role="status" className="text-sm text-muted-foreground">
      Content reads the deals folder of your AIOS. Connect your AIOS folder on the{" "}
      <Link to="/tasks" className="text-primary underline underline-offset-4">
        Tasks page
      </Link>
      , then come back.
    </p>
  ) : list === null ? (
    error ? (
      <p role="status" className="text-sm text-muted-foreground">
        Content is not available now. Try again later.
      </p>
    ) : (
      <WindowLoading label="Loading deals" />
    )
  ) : list.deals.length === 0 ? (
    <WindowEmpty
      icon={ClapperboardIcon}
      title="No deals yet"
      line="A deal shows here when it has its own folder in deals/ with a deal.md card."
    />
  ) : (
    <>
      <FilmNext row={next} canAct={props.canAct} onOpen={open} onFilmed={markFilmed} />
      <Board rows={rows} selected={selected} onOpen={open} />
    </>
  );

  return (
    <SidebarInset className="isolate h-dvh min-h-0 overflow-hidden overscroll-y-none">
      <WindowHeader
        title="Content"
        {...(list ? { count: rows.length } : {})}
        actions={
          list && list.deals.length > 1 ? (
            <DealFilter list={list} value={deal} onChange={setDeal} />
          ) : undefined
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-gutter-both">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 p-4 sm:p-6">
          <p className="text-sm text-muted-foreground">
            Agents draft scripts. Only a person approves them.
            {props.updatedAt ? ` Updated ${formatTime(props.updatedAt)}.` : ""}
          </p>
          {list?.bad.length ? (
            <details className="rounded-md border border-border p-3 text-sm">
              <summary className="cursor-pointer">
                {list.bad.length} {list.bad.length === 1 ? "file was" : "files were"} skipped
              </summary>
              <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                {list.bad.map((item) => (
                  <li key={`${item.file}:${item.reason}`}>
                    {item.file}: {item.reason}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {body}
        </div>
      </div>
    </SidebarInset>
  );
}

/** The error's own words when it has them. A ContentRpcError always does. */
const messageOf = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "message" in error &&
  typeof error.message === "string"
    ? error.message
    : "That did not work. Try again.";

export function ContentView() {
  const { environmentId, list, error, noWorkspace, refresh, canAct, updatedAt } = useContent();
  const runMove = useAtomCommand(contentMove);
  const runScript = useAtomCommand(contentSaveScript);
  const runHistory = useAtomCommand(contentHistory);
  const act: ActFn = async (action) => {
    if (!environmentId) return "No workspace is open.";
    const ref = { deal: action.deal, file: action.file };
    const result =
      action.kind === "move"
        ? await runMove({
            environmentId,
            input: { ...ref, to: action.to, ...(action.note ? { note: action.note } : {}) },
          })
        : await runScript({ environmentId, input: { ...ref, script: action.script } });
    if (!AsyncResult.isSuccess(result)) return messageOf(squashAtomCommandFailure(result));
    refresh();
    return result.value.video;
  };
  const loadHistory: LoadHistoryFn = async (ref) => {
    if (!environmentId) return null;
    const result = await runHistory({ environmentId, input: ref });
    return AsyncResult.isSuccess(result) ? result.value : null;
  };
  return (
    <ContentScreen
      list={list}
      error={error}
      noWorkspace={noWorkspace}
      updatedAt={updatedAt}
      canAct={canAct}
      act={act}
      loadHistory={loadHistory}
      onRefresh={refresh}
    />
  );
}
