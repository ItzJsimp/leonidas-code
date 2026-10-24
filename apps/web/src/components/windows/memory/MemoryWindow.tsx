import type { AiosFolderItem, AiosNoteFolder } from "@t3tools/contracts";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenIcon,
  BrainIcon,
  ScaleIcon,
  ScrollTextIcon,
  SparklesIcon,
} from "lucide-react";
import * as Schema from "effect/Schema";
import {
  type ComponentType,
  lazy,
  type ReactNode,
  type SVGProps,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AiosFileView } from "~/components/aiosFile/AiosFileView";
import { useOpenAiosFile } from "~/components/aiosFile/useOpenAiosFile";
import { usePlacePrompt } from "~/components/taskBoard/DirectionSection";
import {
  RailWindow,
  WindowEmpty,
  WindowError,
  WindowLoading,
  type WindowTab,
} from "~/components/twoState/RailWindow";
import { Tip } from "~/components/twoState/Tip";
import { useAiosHome } from "~/components/twoState/useTwoStateData";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { useActiveAiosWorkspace } from "~/components/workspace/useActiveAiosWorkspace";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { useNowMinute } from "~/hooks/useNowMinute";
import { cn } from "~/lib/utils";
import { useEnvironmentQuery } from "~/state/query";
import { aiosFolderListQuery } from "~/state/taskBoard";

import { localDay, shortDay } from "../today/today.logic";
import { type AreaCard, areaCards } from "./areaCards";
import {
  type AreaHistory,
  areaTrend,
  folderOf,
  recordAreas,
  searchNotes,
} from "./memoryOverview.logic";

const BrainVisualizer = lazy(() =>
  import("~/components/brain/BrainVisualizer").then((module) => ({
    default: module.BrainVisualizer,
  })),
);

const TABS: readonly WindowTab[] = [
  { id: "overview", label: "Overview" },
  { id: "brain-map", label: "Brain map" },
  { id: "decisions", label: "Decisions" },
  { id: "logs", label: "Logs" },
  { id: "wiki", label: "Wiki" },
];

const FOLDERS: readonly AiosNoteFolder[] = ["decisions", "logs", "wiki"];

const RECORD_DECISION_PROMPT = `Help me record a decision. Take about 5 minutes.

1. Ask me what I decided, which options I weighed and why I chose this one. Ask one short question at a time.
2. Draft a short note in decisions/ named NNNN-short-title.md, with the next free number. Use the sections Context, Decision and Consequences.
3. Show me the draft. Write the file only after I say yes.`;

const START_WIKI_PROMPT = `Help me start a wiki page. Ask me which topic I want to keep notes on and what I already know. Then draft a short reference page in wiki/ named after the topic. Show me the draft and write the file only after I say yes.`;

const FOLDER_COPY: Record<
  AiosNoteFolder,
  {
    readonly icon: ComponentType<SVGProps<SVGSVGElement>>;
    readonly one: string;
    readonly many: string;
    readonly empty: string;
    readonly pick: string;
    readonly start: { readonly label: string; readonly prompt: string } | null;
  }
> = {
  decisions: {
    icon: ScaleIcon,
    one: "decision",
    many: "decisions",
    empty:
      "A decision is a short note on what you chose and why, kept in decisions/. Record one in a chat and it shows here.",
    pick: "Pick a decision to read it.",
    start: { label: "Record a decision", prompt: RECORD_DECISION_PROMPT },
  },
  logs: {
    icon: ScrollTextIcon,
    one: "log",
    many: "logs",
    empty:
      "Logs are dated notes of what happened, kept in logs/. Your daily briefs land here when you plan a day on Today.",
    pick: "Pick a log to read it.",
    start: null,
  },
  wiki: {
    icon: BookOpenIcon,
    one: "page",
    many: "pages",
    empty:
      "The wiki holds reference notes Leonidas keeps for you, in wiki/. Start a page in a chat and it shows here.",
    pick: "Pick a page to read it.",
    start: { label: "Start a wiki page", prompt: START_WIKI_PROMPT },
  },
};

const HistorySchema = Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Number));
const NO_HISTORY: AreaHistory = {};

/** Area links: a folder this page lists opens its tab, other areas open their own page. */
const AREA_PAGE: Record<string, "/tasks" | "/projects" | "/library"> = {
  tasks: "/tasks",
  projects: "/projects",
  skills: "/library",
};

function useFolder(folder: AiosNoteFolder) {
  const { environmentId, scope, scopeReady } = useActiveAiosWorkspace();
  return useEnvironmentQuery(
    environmentId && scopeReady
      ? aiosFolderListQuery({ environmentId, input: { ...scope, folder } })
      : null,
  );
}

/** The tab and note in the address, so a link can open one note: `?tab=decisions&file=...`. */
function useMemoryNav() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { readonly file?: unknown };
  const file = typeof search.file === "string" ? search.file : null;
  const go = (tab: string, path: string | null) =>
    void navigate({
      to: ".",
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        tab: tab === "overview" ? undefined : tab,
        file: path ?? undefined,
      })) as never,
      replace: path === null,
    });
  return { file, go };
}

function noteDate(item: AiosFolderItem): string {
  return item.date ? shortDay(item.date) : "";
}

/** One note row: title and date on top, the summary under it. */
function NoteRow({
  item,
  selected,
  onSelect,
  folderLabel,
}: {
  readonly item: AiosFolderItem;
  readonly selected?: boolean;
  readonly onSelect: () => void;
  readonly folderLabel?: string;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "grid w-full min-w-0 gap-0.5 rounded-lg px-3 py-2 text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
          selected && "bg-muted",
        )}
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span
            title={item.title}
            className="line-clamp-2 min-w-0 flex-1 text-sm font-medium wrap-anywhere"
          >
            {item.title}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {folderLabel ? `${folderLabel} ` : ""}
            {noteDate(item)}
          </span>
        </span>
        {item.summary ? (
          <span title={item.summary} className="line-clamp-2 text-xs text-muted-foreground">
            {item.summary}
          </span>
        ) : (
          <span className="truncate font-mono text-xs text-muted-foreground">{item.path}</span>
        )}
      </button>
    </li>
  );
}

function StartInChat({ label, prompt }: { readonly label: string; readonly prompt: string }) {
  const { place, notice } = usePlacePrompt();
  return (
    <div className="grid justify-items-center gap-1.5">
      <Button size="sm" variant="outline" onClick={() => void place(prompt)}>
        <SparklesIcon aria-hidden />
        {label}
      </Button>
      {notice ? (
        <p role="status" className="text-xs text-muted-foreground">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

function FolderEmpty({ folder }: { readonly folder: AiosNoteFolder }) {
  const copy = FOLDER_COPY[folder];
  const Icon = copy.icon;
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <Icon aria-hidden className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">No {copy.many} yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">{copy.empty}</p>
      {copy.start ? (
        <StartInChat label={copy.start.label} prompt={copy.start.prompt} />
      ) : (
        <Link
          to="/today"
          className="rounded-sm text-sm font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          Open Today
        </Link>
      )}
    </div>
  );
}

/** A list on the left and the open note on the right; one column at a time when narrow. */
function ListAndDetail({
  list,
  selected,
  onBack,
  placeholder,
}: {
  readonly list: ReactNode;
  readonly selected: string | null;
  readonly onBack: () => void;
  readonly placeholder: string;
}) {
  return (
    <div className="grid min-w-0 gap-4 @3xl:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
      <div className={cn("min-w-0", selected !== null && "hidden @3xl:block")}>{list}</div>
      {selected !== null ? (
        <div className="min-w-0 rounded-xl border border-border bg-card p-4">
          <Button size="xs" variant="ghost-muted" className="mb-2 @3xl:hidden" onClick={onBack}>
            <ArrowLeftIcon aria-hidden />
            Back to the list
          </Button>
          <div className="max-w-prose">
            <AiosFileView key={selected} path={selected} />
          </div>
        </div>
      ) : (
        <div className="sticky top-0 hidden min-h-48 self-start place-items-center rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground @3xl:grid">
          {placeholder}
        </div>
      )}
    </div>
  );
}

function FolderTab({ folder, query }: { readonly folder: AiosNoteFolder; readonly query: string }) {
  const read = useFolder(folder);
  const { file, go } = useMemoryNav();
  const copy = FOLDER_COPY[folder];
  const selected = file !== null && folderOf(file) === folder ? file : null;
  const items = useMemo(
    () =>
      read.data
        ? query.trim()
          ? searchNotes([{ folder, items: read.data.items }], query)
          : read.data.items
        : null,
    [read.data, query, folder],
  );
  if (read.data === null && read.error !== null) {
    return <WindowError message={`Your ${copy.many} did not load.`} onRetry={read.refresh} />;
  }
  if (read.data === null || items === null)
    return <WindowLoading label={`Reading your ${copy.many}`} />;
  if (read.data.total === 0) return <FolderEmpty folder={folder} />;
  const shown = read.data.items.length;
  const list = (
    <div className="grid gap-2">
      <p className="px-1 text-xs text-muted-foreground tabular-nums">
        {query.trim()
          ? `${items.length} of ${shown} ${copy.many} match`
          : `${read.data.total.toLocaleString("en-US")} ${read.data.total === 1 ? copy.one : copy.many}${
              read.data.total > shown ? `, newest ${shown} shown` : ""
            }`}
      </p>
      {items.length === 0 ? (
        <p role="status" className="px-1 py-6 text-center text-sm text-muted-foreground">
          No {copy.one} matches &ldquo;{query.trim()}&rdquo;. Try other words.
        </p>
      ) : (
        <ul className="grid gap-0.5">
          {items.map((item) => (
            <NoteRow
              key={item.path}
              item={item}
              selected={item.path === selected}
              onSelect={() => go(folder, item.path)}
            />
          ))}
        </ul>
      )}
    </div>
  );
  return (
    <ListAndDetail
      list={list}
      selected={selected}
      onBack={() => go(folder, null)}
      placeholder={copy.pick}
    />
  );
}

/** A still line of the counts the app saw on recent days. */
function Spark({ series }: { readonly series: readonly number[] }) {
  if (series.length < 2) return null;
  const min = Math.min(...series);
  const span = Math.max(...series) - min || 1;
  const points = series
    .map(
      (value, index) => `${(index / (series.length - 1)) * 48},${14 - ((value - min) / span) * 12}`,
    )
    .join(" ");
  return (
    <svg viewBox="0 0 48 16" className="h-4 w-12 shrink-0 text-muted-foreground" aria-hidden>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function AreaTile({
  card,
  history,
  today,
  onOpenTab,
}: {
  readonly card: AreaCard;
  readonly history: AreaHistory;
  readonly today: string;
  readonly onOpenTab: (tab: AiosNoteFolder) => void;
}) {
  const trend = areaTrend(history, card.id, today);
  const change =
    trend.delta === null || trend.since === null
      ? "Trend starts tomorrow"
      : trend.delta === 0
        ? `No change since ${shortDay(trend.since)}`
        : `${trend.delta > 0 ? "+" : ""}${trend.delta.toLocaleString("en-US")} since ${shortDay(trend.since)}`;
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">{card.label}</span>
        <Spark series={trend.series} />
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="font-display text-2xl leading-none font-semibold tabular-nums">
          {card.number}
        </span>
        <span className="truncate text-sm text-muted-foreground">{card.unit}</span>
      </span>
      <span className="text-xs text-muted-foreground">{change}</span>
      <span className="text-xs text-muted-foreground">Changed {card.changed}</span>
    </>
  );
  const tile =
    "grid h-full w-full min-w-0 gap-1 rounded-xl border border-border bg-card p-3 text-left focus-visible:outline-2 focus-visible:outline-ring";
  const folder = folderOf(`${card.id}/`);
  const page = AREA_PAGE[card.id];
  return (
    <li className="min-w-0">
      {folder ? (
        <button
          type="button"
          className={cn(tile, "hover:bg-muted/50")}
          onClick={() => onOpenTab(folder)}
        >
          {body}
        </button>
      ) : page ? (
        <Link to={page} className={cn(tile, "hover:bg-muted/50")}>
          {body}
        </Link>
      ) : (
        <Tip text={`${card.line}. Kept in the ${card.id}/ folder of your AIOS.`}>
          <div tabIndex={0} className={tile}>
            {body}
          </div>
        </Tip>
      )}
    </li>
  );
}

function RecentCard({
  folder,
  onPick,
  onAll,
}: {
  readonly folder: AiosNoteFolder;
  readonly onPick: (path: string) => void;
  readonly onAll: () => void;
}) {
  const read = useFolder(folder);
  const copy = FOLDER_COPY[folder];
  const label =
    folder === "wiki" ? "Wiki pages" : folder === "logs" ? "Recent logs" : "Recent decisions";
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card p-3">
      <div className="mb-1 flex items-baseline gap-2 px-1">
        <h2 className="text-sm font-semibold">{label}</h2>
        {read.data ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {read.data.total.toLocaleString("en-US")}
          </span>
        ) : null}
        <Button size="xs" variant="ghost-muted" className="ml-auto" onClick={onAll}>
          All {copy.many}
          <ArrowRightIcon aria-hidden />
        </Button>
      </div>
      {read.data === null ? (
        read.error !== null ? (
          <div className="grid justify-items-start gap-2 p-1 text-sm">
            <p className="text-muted-foreground">Your {copy.many} did not load.</p>
            <Button size="xs" variant="outline" onClick={read.refresh}>
              Try again
            </Button>
          </div>
        ) : (
          <div role="status" aria-label={`Loading ${copy.many}`} className="grid gap-2 p-1">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        )
      ) : read.data.items.length === 0 ? (
        <p className="p-1 text-sm text-muted-foreground">No {copy.many} yet.</p>
      ) : (
        <ul className="grid gap-0.5">
          {read.data.items.slice(0, 5).map((item) => (
            <NoteRow key={item.path} item={item} onSelect={() => onPick(item.path)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SearchResults({ query }: { readonly query: string }) {
  const decisions = useFolder("decisions");
  const logs = useFolder("logs");
  const wiki = useFolder("wiki");
  const { file, go } = useMemoryNav();
  const reads = [decisions, logs, wiki];
  const results = useMemo(
    () =>
      searchNotes(
        [decisions.data, logs.data, wiki.data].flatMap((list) => (list ? [list] : [])),
        query,
      ),
    [decisions.data, logs.data, wiki.data, query],
  );
  const loading = reads.some((read) => read.data === null && read.error === null);
  const list = (
    <div className="grid gap-2">
      <p className="px-1 text-xs text-muted-foreground tabular-nums">
        {results.length} {results.length === 1 ? "note matches" : "notes match"} in decisions, logs
        and wiki{loading ? ". Still reading some folders." : "."}
      </p>
      {results.length === 0 ? (
        <p role="status" className="px-1 py-6 text-center text-sm text-muted-foreground">
          Nothing matches &ldquo;{query.trim()}&rdquo;. Try other words.
        </p>
      ) : (
        <ul className="grid gap-0.5">
          {results.slice(0, 100).map((item) => (
            <NoteRow
              key={item.path}
              item={item}
              selected={item.path === file}
              folderLabel={FOLDER_COPY[item.folder].one}
              onSelect={() => go("overview", item.path)}
            />
          ))}
        </ul>
      )}
    </div>
  );
  return (
    <ListAndDetail
      list={list}
      // A note left in the address from another tab shows only when it is one of the results.
      selected={file !== null && results.some((item) => item.path === file) ? file : null}
      onBack={() => go("overview", null)}
      placeholder="Pick a note to read it."
    />
  );
}

function Overview({ query }: { readonly query: string }) {
  const home = useAiosHome();
  const { active } = useActiveAiosWorkspace();
  const { go } = useMemoryNav();
  const now = Date.parse(`${useNowMinute()}Z`);
  const today = localDay(now);
  const areas = home.data?.areas;
  const [history, setHistory] = useLocalStorage(
    `leonidas:memory-area-history:${active?.id ?? "default"}`,
    NO_HISTORY,
    HistorySchema,
  );
  useEffect(() => {
    if (areas) setHistory((current) => recordAreas(current, today, areas));
  }, [areas, today, setHistory]);
  const cards = useMemo(() => areaCards(areas ?? [], now), [areas, now]);

  if (query.trim()) return <SearchResults query={query} />;
  if (home.error !== null && home.data === null) {
    return <WindowError message="Memory did not load." onRetry={home.refresh} />;
  }
  if (home.data === null) return <WindowLoading label="Reading your AIOS folder" />;
  if (home.data.root === null || cards.length === 0) {
    return (
      <WindowEmpty
        icon={BrainIcon}
        title="No AIOS folder connected yet"
        line="Connect your AIOS folder and the areas Leonidas keeps notes on show here."
        action={{ label: "Connect your AIOS folder", to: "/tasks" }}
      />
    );
  }
  return (
    <div className="grid gap-4">
      <ul className="grid grid-cols-2 gap-3 @xl:grid-cols-3 @4xl:grid-cols-4">
        {cards.map((card) => (
          <AreaTile
            key={card.id}
            card={card}
            history={history}
            today={today}
            onOpenTab={(tab) => go(tab, null)}
          />
        ))}
      </ul>
      <div className="grid gap-4 @3xl:grid-cols-3">
        {FOLDERS.map((folder) => (
          <RecentCard
            key={folder}
            folder={folder}
            onPick={(path) => go(folder, path)}
            onAll={() => go(folder, null)}
          />
        ))}
      </div>
    </div>
  );
}

function BrainMap() {
  const { open } = useOpenAiosFile();
  return (
    <Suspense fallback={<WindowLoading label="Opening the map" />}>
      {/* The map sizes itself from its box, so the box needs a height. */}
      <div className="h-[calc(100dvh-10rem)] min-h-80 overflow-hidden rounded-xl border border-border bg-card">
        <BrainVisualizer className="h-full w-full" onOpenFile={(path) => void open(path)} />
      </div>
    </Suspense>
  );
}

/** Memory: what Leonidas knows. Overview, the brain map, and every decision, log and wiki page. */
export function MemoryWindow() {
  const [query, setQuery] = useState("");
  return (
    <RailWindow
      title="Memory"
      tabs={TABS}
      actions={
        <div data-window-search className="w-44 sm:w-60">
          <Input
            type="search"
            size="sm"
            value={query}
            placeholder="Search memory"
            aria-label="Search decisions, logs and wiki"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      }
    >
      {(tab) => (
        <div className="@container">
          {tab === "brain-map" ? (
            <BrainMap />
          ) : tab === "decisions" || tab === "logs" || tab === "wiki" ? (
            <FolderTab folder={tab} query={query} />
          ) : (
            <Overview query={query} />
          )}
        </div>
      )}
    </RailWindow>
  );
}
