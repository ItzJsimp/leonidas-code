import type { TaskBoardAgent } from "@t3tools/contracts";
import { FolderIcon } from "lucide-react";
import { useLayoutEffect, useRef, type RefObject } from "react";

import { Badge } from "~/components/ui/badge";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { agentLabel, nameInitial } from "./taskRows";

/** Keeps the newest value in a ref so memoized rows can take callbacks whose identity never changes. */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

export function ProjectChip({ name }: { readonly name: string | null }) {
  if (!name) return null;
  return (
    <Badge variant="outline" size="sm" className="max-w-36">
      <FolderIcon />
      <span className="truncate">{name}</span>
    </Badge>
  );
}

const LANE_PREFIX = "lane:";

/** Who builds the task, from its `lane:` label. Nothing is shown for tasks without one. */
export function LaneChip({ labels }: { readonly labels: ReadonlyArray<string> }) {
  const lane = labels.find((label) => label.startsWith(LANE_PREFIX));
  if (!lane) return null;
  const name = lane.slice(LANE_PREFIX.length).replace(/-/g, " ");
  return (
    <Badge variant="secondary" size="sm" className="capitalize">
      {name}
    </Badge>
  );
}

/** Initial of whoever holds the task, with the agent or model when an agent claimed it. */
export function ClaimedBy({
  name,
  agent,
}: {
  readonly name: string | null;
  readonly agent: TaskBoardAgent | null;
}) {
  if (!name) return null;
  const via = agentLabel(agent);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground" />
        }
      >
        <span
          aria-hidden
          className="flex size-4 shrink-0 items-center justify-center rounded-full bg-secondary font-medium text-3xs text-secondary-foreground"
        >
          {nameInitial(name)}
        </span>
        <span className="truncate">{via ?? name}</span>
      </TooltipTrigger>
      <TooltipPopup>{via ? `${name} via ${via}` : name}</TooltipPopup>
    </Tooltip>
  );
}
