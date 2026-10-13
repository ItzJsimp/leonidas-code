import type { ProjectId, TaskBoardTaskStatus } from "@t3tools/contracts";

import type { TaskView } from "./taskBoard.logic";

function normalizePath(path: string): string {
  const slashed = path.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  return /^[a-z]:/i.test(slashed) ? slashed.toLowerCase() : slashed;
}

/**
 * The Leonidas project a task is sent to: the task's own project, else the project selected on the
 * page, else the project rooted at the AIOS folder, else the environment's first project. A
 * candidate this environment does not have is skipped.
 */
export function pickLaunchProject<P extends { id: ProjectId; workspaceRoot: string }>(input: {
  projects: ReadonlyArray<P>;
  taskProjectId: ProjectId | null;
  selectedProjectId: ProjectId | null;
  aiosRoot: string | null;
}): P | null {
  const byId = (id: ProjectId | null) =>
    id === null ? undefined : input.projects.find((project) => project.id === id);
  const aiosRoot = input.aiosRoot ? normalizePath(input.aiosRoot) : null;
  return (
    byId(input.taskProjectId) ??
    byId(input.selectedProjectId) ??
    (aiosRoot === null
      ? undefined
      : input.projects.find((project) => normalizePath(project.workspaceRoot) === aiosRoot)) ??
    input.projects[0] ??
    null
  );
}

/** The card change that claims a task: the member takes it, and work starts unless already under way. */
export function claimPatch(
  task: Pick<TaskView, "status">,
  member: string,
): { claimedBy: string; status?: TaskBoardTaskStatus } {
  return task.status === "in_progress" || task.status === "review"
    ? { claimedBy: member }
    : { claimedBy: member, status: "in_progress" };
}

/** A readable message from whatever a failed command carried. */
export function failureText(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) return message;
  }
  return fallback;
}

/**
 * What "Send to agent" does for a task. A task already linked to a thread the client knows opens
 * that thread; a link whose thread never materialized relaunches into the same thread id, so a
 * retry (or a second click) never leaves two threads behind one card.
 */
export function planSend(
  task: Pick<TaskView, "claimedAgent">,
  threadExists: (threadId: string) => boolean,
): { kind: "open"; threadId: string } | { kind: "launch"; threadId: string | null } {
  const linked = task.claimedAgent?.threadId ?? null;
  if (linked !== null && threadExists(linked)) return { kind: "open", threadId: linked };
  return { kind: "launch", threadId: linked };
}

/** Recorded before the turn starts: a failure here means no thread was ever launched. */
export function linkPatch(
  task: Pick<TaskView, "status">,
  input: { member: string; threadId: string; providerInstanceId: string; model: string },
) {
  return {
    ...claimPatch(task, input.member),
    agent: {
      providerInstanceId: input.providerInstanceId,
      model: input.model,
      threadId: input.threadId,
    },
    note: "Sending to agent",
  };
}

/** Undoes `linkPatch` when the turn did not start, keeping the card's earlier status and claim. */
export function unlinkPatch(
  task: Pick<TaskView, "status" | "claimedBy">,
  member: string,
  reason: string,
) {
  const freshClaim = task.claimedBy === null || task.claimedBy !== member;
  return {
    ...(freshClaim ? { claimedBy: null } : {}),
    status: task.status,
    note: `Agent did not start: ${reason}`,
  };
}
