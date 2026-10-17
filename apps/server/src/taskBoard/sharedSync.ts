import type { TaskBoardTask } from "@t3tools/contracts";

const OPEN = new Set<TaskBoardTask["status"]>(["todo", "in_progress", "review", "blocked"]);

/** Labels that only mean something on the owner's machine and never leave it. */
const LOCAL_LABELS = new Set(["private"]);

/** A card the team sees: not an agent-run record and not marked private. */
function isTeamCard(card: TaskBoardTask): boolean {
  return card.kind !== "agent_run" && !card.labels.includes("private");
}

/**
 * The copy of a card that may go on a shared board. Shared boards can live in a public repository
 * and local cards hold private notes, paths and chat history, so only planning fields travel: title,
 * status, priority, dates, owner, claim and checklist progress. The description and activity of an
 * existing copy (reviewed by a person) are kept; a new copy starts with neither. Agent and thread
 * data and source paths never travel.
 */
export function publicCopy(
  card: TaskBoardTask,
  copy: TaskBoardTask | undefined,
  defaults: { readonly projectName: string; readonly actor: string },
): TaskBoardTask {
  return {
    id: card.id,
    project: copy?.project ?? defaults.projectName,
    title: card.title,
    description: copy?.description ?? "",
    status: card.status,
    priority: card.priority,
    claimedBy: card.claimedBy ?? copy?.claimedBy ?? null,
    claimedAt: card.claimedBy ? card.claimedAt : (copy?.claimedAt ?? null),
    claimedAgent: null,
    completedBy: card.completedBy,
    completedAt: card.completedAt,
    completionSummary: copy?.completionSummary ?? null,
    createdAt: card.createdAt,
    updatedAt: Math.max(card.updatedAt, copy?.updatedAt ?? 0),
    labels: [...new Set([...(copy?.labels ?? []), ...card.labels])].filter(
      (label) => !LOCAL_LABELS.has(label),
    ),
    source: card.source,
    projectSlug: card.projectSlug ?? null,
    effort: card.effort ?? null,
    due: card.due ?? null,
    milestone: card.milestone ?? null,
    verify: copy?.verify ?? null,
    startFiles: [],
    blockedBy: card.blockedBy ?? [],
    ...(card.checklist ? { checklist: card.checklist } : {}),
    shared: true,
    sharedBy: copy?.sharedBy ?? card.sharedBy ?? defaults.actor,
    assignee: card.assignee ?? copy?.assignee ?? null,
    sourceId: card.sourceId,
    sourceFile: null,
    issueUrl: copy?.issueUrl ?? null,
    history: copy?.history ?? [],
  };
}

/** The planning fields a collaborator sees change; text and activity are left out. */
function fingerprint(task: TaskBoardTask): string {
  return JSON.stringify([
    task.status,
    task.priority,
    task.due ?? null,
    task.milestone ?? null,
    task.assignee ?? null,
    task.claimedBy,
    task.checklist ?? null,
    task.blockedBy ?? [],
  ]);
}

export type SharedSyncPlan = {
  readonly tasks: ReadonlyArray<TaskBoardTask>;
  readonly published: number;
  readonly refreshed: number;
  readonly withdrawn: number;
};

/**
 * Brings a project's shared board in line with this machine's cards for that project, so nobody
 * has to press Share. Open team cards that are missing are published as public copies; a copy older
 * than its card takes the card's planning fields; agent-run and private cards are withdrawn. Copies
 * of cards this machine does not have (a collaborator's cards) are never touched. A claim on the
 * copy survives a newer card that has no claim, so a collaborator's claim is not lost.
 * Returns null when the board already matches.
 */
export function planSharedSync(input: {
  readonly local: ReadonlyArray<TaskBoardTask>;
  readonly board: ReadonlyArray<TaskBoardTask>;
  readonly projectName: string;
  readonly actor: string;
}): SharedSyncPlan | null {
  const localById = new Map(input.local.map((card) => [card.id, card] as const));
  const onBoard = new Set(input.board.map((task) => task.id));
  const defaults = { projectName: input.projectName, actor: input.actor };
  let published = 0;
  let refreshed = 0;
  let withdrawn = 0;

  const tasks: TaskBoardTask[] = [];
  for (const copy of input.board) {
    const card = localById.get(copy.id);
    if (!card) {
      tasks.push(copy);
    } else if (!isTeamCard(card)) {
      withdrawn++;
    } else if (card.updatedAt > copy.updatedAt && fingerprint(card) !== fingerprint(copy)) {
      refreshed++;
      tasks.push(publicCopy(card, copy, defaults));
    } else {
      tasks.push(copy);
    }
  }
  for (const card of input.local) {
    if (onBoard.has(card.id) || !isTeamCard(card) || !OPEN.has(card.status)) continue;
    published++;
    tasks.push(publicCopy(card, undefined, defaults));
  }

  return published + refreshed + withdrawn === 0
    ? null
    : { tasks, published, refreshed, withdrawn };
}
