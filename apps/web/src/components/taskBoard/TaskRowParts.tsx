import type { TaskBoardTeamMember } from "@t3tools/contracts";
import { BotIcon, CircleDashedIcon, FolderIcon } from "lucide-react";
import { useLayoutEffect, useRef, type RefObject } from "react";

import { Badge } from "~/components/ui/badge";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { hasActiveAgent, ownerOf } from "./owner.logic";
import type { TaskView } from "./taskBoard.logic";
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

/**
 * Who owns the task: the owner's initial and team name, "Anyone" when nobody does, and a bot mark
 * when an agent works on it now.
 */
export function OwnerCell({
  task,
  team,
}: {
  readonly task: TaskView;
  readonly team: ReadonlyArray<TaskBoardTeamMember>;
}) {
  const owner = ownerOf(task, team);
  const agent = hasActiveAgent(task) ? (agentLabel(task.claimedAgent) ?? "an agent") : null;
  const label = owner ?? "Anyone";
  const detail = [
    owner ? `Owner: ${owner}` : "Nobody owns this yet. Anyone can take it.",
    agent ? `An agent works on it (${agent}).` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "inline-flex min-w-0 items-center gap-1.5 text-xs",
              owner ? "text-foreground" : "text-muted-foreground",
            )}
          />
        }
      >
        {owner ? (
          <span
            aria-hidden
            className="flex size-4 shrink-0 items-center justify-center rounded-full bg-secondary font-medium text-3xs text-secondary-foreground"
          >
            {nameInitial(owner)}
          </span>
        ) : (
          <CircleDashedIcon aria-hidden className="size-4 shrink-0" />
        )}
        <span className="truncate">{label}</span>
        {agent ? <BotIcon aria-label="Agent working" className="size-3.5 shrink-0" /> : null}
      </TooltipTrigger>
      <TooltipPopup>{detail}</TooltipPopup>
    </Tooltip>
  );
}
