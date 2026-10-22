import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

/** One rail section: a heading row and a list. The same frame for built-in and plug-in sections. */
export function RailPanel({
  title,
  count,
  aside,
  children,
}: {
  readonly title: string;
  readonly count?: ReactNode;
  readonly aside?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section aria-label={title} className="min-w-0 rounded-lg border border-border/60 bg-card">
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5">
        <h2 className="font-display text-sm font-semibold tracking-tight">{title}</h2>
        {count !== undefined ? (
          <span className="text-sm font-medium text-muted-foreground tabular-nums">{count}</span>
        ) : null}
        <span className="flex-1" />
        {aside}
      </div>
      <div className="px-1.5 pb-2">{children}</div>
    </section>
  );
}

/** The list inside a rail section. Rows share a hairline. */
export function RailList({ children }: { readonly children: ReactNode }) {
  return <ul className="divide-y divide-border/50">{children}</ul>;
}

/** A rail row. A raised row marks live work. */
export function RailRow({
  raised = false,
  className,
  children,
}: {
  readonly raised?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <li
      className={cn(
        "flex min-w-0 items-start gap-2.5 rounded-md px-2.5 py-2 text-sm",
        raised ? "bg-accent" : "hover:bg-accent/60",
        className,
      )}
    >
      {children}
    </li>
  );
}

/** The empty line inside a rail section. */
export function RailEmpty({ children }: { readonly children: ReactNode }) {
  return <p className="px-2.5 py-2 text-xs text-muted-foreground">{children}</p>;
}
