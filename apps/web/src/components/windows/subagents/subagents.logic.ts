import type { SubagentRun, SubagentRunKind, SubagentRunStatus } from "@t3tools/contracts";

import type { WindowTab } from "../../twoState/WindowHeader";

export type SubagentsTab = "running" | "history";

export function subagentsTab(value: string | undefined): SubagentsTab {
  return value === "history" ? "history" : "running";
}

export function subagentsTabs(runningCount: number | null): WindowTab[] {
  return [
    { id: "running", label: runningCount === null ? "Running" : `Running ${runningCount}` },
    { id: "history", label: "History" },
  ];
}

export const STATUS_LABEL: Readonly<Record<SubagentRunStatus, string>> = {
  running: "Running",
  waiting: "Waiting for you",
  done: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** Badge colors. The word always shows too, so color never carries the status alone. */
export const STATUS_VARIANT: Readonly<
  Record<SubagentRunStatus, "info" | "warning" | "success" | "error" | "outline">
> = {
  running: "info",
  waiting: "warning",
  done: "success",
  failed: "error",
  cancelled: "outline",
};

export const KIND_LABEL: Readonly<Record<SubagentRunKind, string>> = {
  delegated: "Delegated task",
  persona: "Persona",
  native: "Built-in helper",
  workflow: "Workflow",
};

export const KIND_HELP: Readonly<Record<SubagentRunKind, string>> = {
  delegated: "A chat handed this task to a new chat of its own.",
  persona: "A named helper that a chat started, such as a reviewer.",
  native: "A helper that the AI provider started inside the chat turn.",
  workflow: "A coordinator that runs several helpers in steps.",
};

export const STATUS_FILTERS: ReadonlyArray<{
  readonly id: "all" | Exclude<SubagentRunStatus, "running" | "waiting">;
  readonly label: string;
}> = [
  { id: "all", label: "All results" },
  { id: "done", label: "Done" },
  { id: "failed", label: "Failed" },
  { id: "cancelled", label: "Cancelled" },
];

/** "45 s", "2 min 5 s", "1 h 3 min". */
export function formatSpan(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    const rest = seconds % 60;
    return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes === 0 ? `${hours} h` : `${hours} h ${restMinutes} min`;
}

/** How long a run has gone: a live count while it runs, the stored span after it ended. */
export function elapsedLabel(run: SubagentRun, now: number): string {
  if (run.durationMs !== null) return formatSpan(run.durationMs);
  if (run.startedAt === null) return run.status === "running" ? "Starting" : "";
  const start = Date.parse(run.startedAt);
  return Number.isFinite(start) ? formatSpan(now - start) : "";
}

export function isLive(run: Pick<SubagentRun, "status">): boolean {
  return run.status === "running" || run.status === "waiting";
}

/** The model and provider as one short line, for example "claude-haiku-5-5 on claude". */
export function modelLine(run: Pick<SubagentRun, "model" | "provider">): string {
  return run.model ? `${run.model} on ${run.provider}` : run.provider;
}

/** The chats that runs came from, one entry each, sorted by title. */
export function parentChats(
  runs: ReadonlyArray<Pick<SubagentRun, "parent">>,
): Array<SubagentRun["parent"]> {
  const byId = new Map<string, SubagentRun["parent"]>();
  for (const run of runs) byId.set(run.parent.id, run.parent);
  return [...byId.values()].toSorted((a, b) => a.title.localeCompare(b.title));
}

/** Keeps the runs a typed word matches, for the Running tab where all runs are in memory. */
export function matchRuns(runs: ReadonlyArray<SubagentRun>, query: string): SubagentRun[] {
  const word = query.trim().toLowerCase();
  if (word === "") return [...runs];
  return runs.filter((run) =>
    `${run.summary} ${run.parent.title} ${modelLine(run)} ${KIND_LABEL[run.kind]}`
      .toLowerCase()
      .includes(word),
  );
}

/** What the Running tab shows when the list is empty. */
export const EMPTY_RUNNING = {
  title: "No subagents are running",
  line: "A subagent is a helper that a chat starts to do one task on its own. Running ones show here.",
};

export const EMPTY_HISTORY = {
  title: "No subagent history yet",
  line: "A subagent is a helper that a chat starts to do one task on its own. Finished ones show here, with what they did.",
};

/** The text under the result when no answer exists, by the status of the run. */
export function resultPlaceholder(run: Pick<SubagentRun, "status" | "rawStatus">): string {
  switch (run.status) {
    case "running":
    case "waiting":
      return "Still working. The answer shows here when it is done.";
    case "failed":
      return "The run failed before it gave an answer.";
    case "cancelled":
      return run.rawStatus === "interrupted"
        ? "A stop or a restart ended this run before it gave an answer."
        : "This run was cancelled before it gave an answer.";
    case "done":
      return "This subagent gave no final answer.";
  }
}
