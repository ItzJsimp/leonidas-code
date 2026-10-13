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
