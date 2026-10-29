import type { ComponentProps } from "react";

import { cn } from "~/lib/utils";
import { ProjectFavicon } from "../ProjectFavicon";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

type RailProject = ComponentProps<typeof ProjectFavicon>["project"] & {
  readonly projectKey: string;
  readonly displayName: string;
};

function railLabel(name: string, needsYou: number): string {
  return needsYou > 0 ? `${name}: ${needsYou} need you` : name;
}

function RailButton(props: {
  label: string;
  selected: boolean;
  needsYou: number;
  onClick: () => void;
  onContextMenu?: ((event: React.MouseEvent) => void) | undefined;
  hint?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={railLabel(props.label, props.needsYou)}
            aria-pressed={props.selected}
            onClick={props.onClick}
            onContextMenu={props.onContextMenu}
            className={cn(
              "relative grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-sidebar-muted-foreground outline-none transition-colors hover:bg-sidebar-row-hover hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              props.selected &&
                "bg-sidebar-row-active text-sidebar-foreground ring-1 ring-sidebar-foreground/25",
            )}
          />
        }
      >
        {props.children}
        {props.needsYou > 0 ? (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full border-2 border-sidebar bg-warning-foreground px-0.5 text-4xs font-semibold leading-none text-sidebar tabular-nums"
          >
            {props.needsYou > 9 ? "9+" : props.needsYou}
          </span>
        ) : null}
      </TooltipTrigger>
      <TooltipPopup side="right">
        <span className="flex flex-col gap-0.5">
          <span>{railLabel(props.label, props.needsYou)}</span>
          {props.hint ? <span className="text-muted-foreground">{props.hint}</span> : null}
        </span>
      </TooltipPopup>
    </Tooltip>
  );
}

/**
 * Project icons down the left edge. One click scopes the chat list to that
 * project; the badge counts chats that wait for the user (answer, approval,
 * usage limit, error, or back from snooze).
 */
export function SidebarProjectRail<P extends RailProject>(props: {
  projects: readonly P[];
  /** Empty means all projects. A click picks one project; the filter menu adds more. */
  selectedKeys: readonly string[];
  needsYouByProject: ReadonlyMap<string, number>;
  onSelect: (projectKey: string | null) => void;
  /** Right-click on a project: change its icon and other quick actions. */
  onProjectContextMenu?: (project: P, position: { x: number; y: number }) => void;
}) {
  const totalNeedsYou = [...props.needsYouByProject.values()].reduce((sum, n) => sum + n, 0);
  return (
    <nav
      aria-label="Projects"
      data-tour="sidebar-projects"
      className="flex w-10 shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-sidebar-border/70 pt-2.5 pb-2 [scrollbar-width:none]"
    >
      <RailButton
        label="All projects"
        selected={props.selectedKeys.length === 0}
        needsYou={props.selectedKeys.length === 0 ? 0 : totalNeedsYou}
        onClick={() => props.onSelect(null)}
      >
        <span className="text-3xs font-semibold">All</span>
      </RailButton>
      <span aria-hidden className="my-1 h-px w-6 shrink-0 bg-sidebar-border/70" />
      {props.projects.map((project) => (
        <RailButton
          key={project.projectKey}
          label={project.displayName}
          selected={props.selectedKeys.includes(project.projectKey)}
          needsYou={props.needsYouByProject.get(project.projectKey) ?? 0}
          onClick={() =>
            props.onSelect(
              props.selectedKeys.length === 1 && props.selectedKeys[0] === project.projectKey
                ? null
                : project.projectKey,
            )
          }
          {...(props.onProjectContextMenu
            ? {
                hint: "Right-click to change the icon",
                onContextMenu: (event: React.MouseEvent) => {
                  event.preventDefault();
                  props.onProjectContextMenu?.(project, { x: event.clientX, y: event.clientY });
                },
              }
            : {})}
        >
          <span className="flex shrink-0">
            <ProjectFavicon project={project} className="size-4" />
          </span>
        </RailButton>
      ))}
    </nav>
  );
}
