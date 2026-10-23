import { RefreshCwIcon } from "lucide-react";
import { type ReactNode, useId } from "react";

import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

/** One Command Center widget: a card with a bold title, a muted count and a body. */
export function HomeWidget({
  title,
  count,
  aside,
  children,
}: {
  readonly title: string;
  /** What the title counts, in words: "3", "last 14 days", "by area". */
  readonly count?: ReactNode;
  readonly aside?: ReactNode;
  readonly children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="min-w-0 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-xs shadow-black/30 inset-shadow-2xs inset-shadow-white/4"
    >
      <div className="mb-3 flex min-w-0 items-baseline gap-2">
        <h2 id={titleId} className="shrink-0 text-sm font-semibold">
          {title}
        </h2>
        {count !== undefined ? (
          <span className="min-w-0 text-sm text-muted-foreground tabular-nums">{count}</span>
        ) : null}
        {aside !== undefined ? <span className="ml-auto shrink-0">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** A quiet placeholder while a read is under way. */
export function WidgetSkeleton({ rows = 3 }: { readonly rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="grid gap-3">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className={cn("h-4", index % 2 === 0 ? "w-4/5" : "w-3/5")} />
      ))}
    </div>
  );
}

/** The empty state in plain words. */
export function WidgetEmpty({ children }: { readonly children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** A failed read, with the way to try again. */
export function WidgetError({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry: () => void;
}) {
  return (
    <div role="alert" className="grid justify-items-start gap-2 text-sm">
      <p className="text-muted-foreground">{message}</p>
      <Button size="xs" variant="outline" onClick={onRetry}>
        <RefreshCwIcon aria-hidden /> Try again
      </Button>
    </div>
  );
}

/** A divided list. Rows split by one hairline, with no boxes. */
export function WidgetList({ children }: { readonly children: ReactNode }) {
  return <ul className="-my-2 divide-y divide-border/60">{children}</ul>;
}
