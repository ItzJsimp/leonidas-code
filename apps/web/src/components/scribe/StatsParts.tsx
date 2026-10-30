import {
  CalendarIcon,
  ChartColumnIcon,
  CheckIcon,
  HistoryIcon,
  LightbulbIcon,
  LockIcon,
  MicIcon,
  RefreshCwIcon,
  StarIcon,
  UsersIcon,
  Volume2Icon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

/** The engine names a glyph for each achievement. Anything new falls back to a star. */
const GLYPHS: Readonly<Record<string, LucideIcon>> = {
  mic: MicIcon,
  flash: ZapIcon,
  bulb: LightbulbIcon,
  volume: Volume2Icon,
  check: CheckIcon,
  history: HistoryIcon,
  chart: ChartColumnIcon,
  star: StarIcon,
  sync: RefreshCwIcon,
  calendar: CalendarIcon,
  people: UsersIcon,
};

export function Glyph(props: { readonly name: string; readonly locked: boolean }) {
  const Icon = props.locked ? LockIcon : (GLYPHS[props.name] ?? StarIcon);
  return <Icon aria-hidden className="size-4" />;
}

/** Text that clips to one line and shows the full text in a tooltip. */
export function Clip(props: { readonly text: string; readonly className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className={cn("truncate", props.className)} />}>
        {props.text}
      </TooltipTrigger>
      <TooltipPopup>{props.text}</TooltipPopup>
    </Tooltip>
  );
}

/** A thin progress bar. The label is read aloud with the value. */
export function Meter(props: {
  readonly percent: number;
  readonly label: string;
  readonly size?: "sm" | "md";
}) {
  return (
    <div
      role="progressbar"
      aria-label={props.label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={props.percent}
      className={cn(
        "w-full overflow-hidden rounded-full bg-muted",
        props.size === "md" ? "h-2" : "h-1.5",
      )}
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${props.percent}%` }} />
    </div>
  );
}

export function StatsSection(props: {
  readonly title: string;
  readonly aside?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">{props.title}</h2>
        {props.aside ? <span className="text-sm text-muted-foreground">{props.aside}</span> : null}
      </div>
      {props.children}
    </section>
  );
}

/** Shown while the first numbers load, and when they fail. Retry is always offered on failure. */
export function StatsPlaceholder(props: {
  readonly failed: boolean;
  readonly onRetry: () => void;
}) {
  if (!props.failed) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  return (
    <div role="alert" className="flex flex-col items-start gap-2 text-sm">
      <p>Scribe could not load your numbers. Check that the engine is running, then try again.</p>
      <Button size="sm" variant="outline" onClick={props.onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function EmptyNote(props: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      <p className="font-medium text-foreground">{props.title}</p>
      <p className="max-w-prose">{props.children}</p>
    </div>
  );
}
