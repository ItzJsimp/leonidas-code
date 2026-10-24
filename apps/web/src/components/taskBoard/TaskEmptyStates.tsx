import { RouteIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";

import { usePlacePrompt } from "./DirectionSection";

/** The empty List or Board: a clear way out, whether filters or a new board caused it. */
export function TasksEmpty(props: { icon: ReactNode; onClearFilters: (() => void) | null }) {
  const filtered = props.onClearFilters !== null;
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">{props.icon}</EmptyMedia>
        <EmptyTitle>{filtered ? "No task matches your filters" : "No tasks here"}</EmptyTitle>
        <EmptyDescription>
          {filtered
            ? "Clear the filters to see all your tasks again."
            : "Type a task in the box above and press Enter to add one."}
        </EmptyDescription>
      </EmptyHeader>
      {props.onClearFilters ? (
        <EmptyContent>
          <Button variant="outline" onClick={props.onClearFilters}>
            Clear filters
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

const roadmapPrompt = (name: string, slug: string) =>
  `Create the file project-roadmap.json for the ${name} project (slug "${slug}"). ` +
  "Ask me for the current version, the goal version and 3 to 5 steps between. " +
  "Then write the file with these fields: projectSlug, name, currentVersion, targetVersion, " +
  "releaseDefinition, and milestones. Each milestone has version, title, goal and tasks. " +
  "Each task has key, title and priority.";

/** The empty Roadmap: one button starts a chat that writes the plan file with the user. */
export function RoadmapEmpty(props: { name: string; slug: string }) {
  const { place, notice, fallbackText } = usePlacePrompt();
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <RouteIcon />
        </EmptyMedia>
        <EmptyTitle>No update plan yet</EmptyTitle>
        <EmptyDescription>
          An update plan lists the versions you want to ship and the tasks for each one. Your AI can
          write it with you. Then assign tasks to versions in their details.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => void place(roadmapPrompt(props.name, props.slug))}>
          Create plan with AI
        </Button>
        {notice ? (
          <p role="status" className="text-muted-foreground text-xs">
            {notice}
          </p>
        ) : null}
        {fallbackText ? (
          <pre className="max-w-prose whitespace-pre-wrap text-left text-xs">{fallbackText}</pre>
        ) : null}
      </EmptyContent>
    </Empty>
  );
}
