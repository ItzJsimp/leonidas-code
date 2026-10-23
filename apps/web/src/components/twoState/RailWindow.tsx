import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  useId,
  useRef,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
  type SVGProps,
} from "react";

import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { isElectron } from "~/env";
import { cn } from "~/lib/utils";

// The design sets tab labels at 13 px, between the xs and sm tokens.
// oxlint-disable-next-line shadcn/no-arbitrary-values
const TAB_TEXT = "text-[13px]";
const TAB_CLASS = `-mb-px shrink-0 rounded-sm border-b-2 py-2 ${TAB_TEXT} whitespace-nowrap transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none`;
const NO_TABS: readonly WindowTab[] = [];

export interface WindowTab {
  readonly id: string;
  readonly label: string;
}

/** The tab to show: the `tab` search value when it names a tab, else the first tab. */
export function resolveWindowTab(tabs: readonly WindowTab[], value: unknown): string | undefined {
  return tabs.find((tab) => tab.id === value)?.id ?? tabs[0]?.id;
}

/** The index a tab key moves to, or null when the key does nothing. */
export function nextTabIndex(key: string, index: number, count: number): number | null {
  if (count === 0) return null;
  if (key === "ArrowRight") return (index + 1) % count;
  if (key === "ArrowLeft") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

/**
 * The frame every rail window shares: a title row (title left, actions right), underline tabs
 * kept in the `tab` search value, and a scrolling body. A function child gets the shown tab id.
 */
export function RailWindow({
  title,
  actions,
  tabs = NO_TABS,
  children,
}: {
  readonly title: string;
  readonly actions?: ReactNode;
  readonly tabs?: readonly WindowTab[];
  readonly children: ReactNode | ((tab: string | undefined) => ReactNode);
}) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { readonly tab?: unknown };
  const active = resolveWindowTab(tabs, search.tab);
  const base = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (id: string) =>
    void navigate({
      to: ".",
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        tab: id === tabs[0]?.id ? undefined : id,
      })) as never,
      replace: true,
    });
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const next = nextTabIndex(event.key, index, tabs.length);
    if (next === null) return;
    event.preventDefault();
    const tab = tabs[next];
    if (!tab) return;
    tabRefs.current[next]?.focus();
    select(tab.id);
  };

  return (
    <section
      aria-label={title}
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground"
    >
      <header
        className={cn(
          "flex h-12 shrink-0 items-center justify-between gap-3 px-4 max-[727px]:pl-14",
          isElectron && "drag-region",
        )}
      >
        <h1 className="min-w-0 truncate text-base font-semibold">{title}</h1>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      {tabs.length > 0 ? (
        <div
          role="tablist"
          aria-label={`${title} sections`}
          className="flex shrink-0 gap-4 overflow-x-auto border-b border-border px-4"
        >
          {tabs.map((tab, index) => {
            const selected = tab.id === active;
            return (
              <button
                key={tab.id}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={`${base}-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`${base}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(tab.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={cn(
                  TAB_CLASS,
                  selected
                    ? "border-foreground font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <div
        role={tabs.length > 0 ? "tabpanel" : undefined}
        id={`${base}-panel`}
        aria-labelledby={active ? `${base}-tab-${active}` : undefined}
        className="min-h-0 flex-1 overflow-y-auto p-4"
      >
        {typeof children === "function" ? children(active) : children}
      </div>
    </section>
  );
}

export function WindowLoading({ label = "Loading" }: { readonly label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Spinner size="sm" aria-label={label} />
      <span>{label}</span>
    </div>
  );
}

/** A dashed box that says what will show here and why it is empty now. */
export function WindowEmpty({
  icon: Icon,
  title,
  line,
  action,
}: {
  readonly icon?: ComponentType<SVGProps<SVGSVGElement>>;
  readonly title: string;
  readonly line: string;
  readonly action?: { readonly label: string; readonly to: string };
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      {Icon ? <Icon aria-hidden className="size-6 text-muted-foreground" /> : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{line}</p>
      {action ? (
        <Link
          to={action.to as "/"}
          className="mt-1 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function WindowError({
  message = "This did not load.",
  onRetry,
}: {
  readonly message?: string;
  readonly onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-border px-6 py-12 text-center"
    >
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
