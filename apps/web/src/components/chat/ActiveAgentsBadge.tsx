import { memo } from "react";

/** Quiet count of agents running on an account; renders nothing at zero. */
export const ActiveAgentsBadge = memo(function ActiveAgentsBadge(props: { count: number }) {
  if (props.count <= 0) return null;
  return (
    <span
      className="inline-flex h-4 min-w-4 items-center justify-center gap-0.5 rounded-full bg-primary/15 px-1 text-3xs font-medium text-primary tabular-nums"
      title={`${props.count} active ${props.count === 1 ? "agent" : "agents"}`}
      aria-label={`${props.count} active ${props.count === 1 ? "agent" : "agents"}`}
    >
      <span aria-hidden className="size-1 rounded-full bg-primary" />
      {props.count}
    </span>
  );
});

const MAX_ACTIVE_DOTS = 3;

/**
 * Icon overlay for a provider rail: a solid count pill on the top-right corner and
 * one pulsing dot per running agent (capped, then "+N") under the icon. Renders
 * nothing at zero. Place inside a `relative` wrapper.
 */
export const ActiveAgentsOverlay = memo(function ActiveAgentsOverlay(props: { count: number }) {
  if (props.count <= 0) return null;
  const label = `${props.count} active ${props.count === 1 ? "agent" : "agents"}`;
  const dots = Math.min(props.count, MAX_ACTIVE_DOTS);
  const extra = props.count - dots;
  return (
    <>
      <span
        className="pointer-events-none absolute -top-1 -right-1 z-40 inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-background bg-success px-1 text-3xs font-bold text-white tabular-nums shadow-sm"
        title={label}
        aria-label={label}
      >
        {props.count}
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-1 left-1/2 z-40 flex -translate-x-1/2 items-center gap-0.5"
      >
        {Array.from({ length: dots }, (_, index) => (
          <span key={index} className="size-1 animate-pulse rounded-full bg-success" />
        ))}
        {extra > 0 ? (
          <span className="text-5xs leading-none font-semibold text-success">+{extra}</span>
        ) : null}
      </span>
    </>
  );
});
