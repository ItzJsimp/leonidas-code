import * as Schema from "effect/Schema";
import { PositiveInt, ProjectId, TrimmedNonEmptyString } from "./baseSchemas.ts";
import { ProviderOptionSelections } from "./model.ts";

export const TASK_BOARD_REPOSITORY = "ItzJsimp/leonidas-code";

/** A calendar day, without a timezone or time of day. */
export const TaskBoardDueDate = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/),
  Schema.makeFilter(
    (value) => {
      const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
      const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
      const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      return year > 0 && day >= 1 && day <= (days[month - 1] ?? 0);
    },
    { expected: "a valid calendar date (YYYY-MM-DD)" },
  ),
);

/** Numeric semantic version without a prerelease or build suffix. */
export const TaskBoardMilestoneVersion = Schema.String.check(
  Schema.isPattern(/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/),
);

// "review" is a card's Awaiting Review, "parked" its Dormant, "retired" its Retired. Parked and
// retired work stays readable but is hidden from the open queue.
export const TaskBoardTaskStatus = Schema.Literals([
  "todo",
  "in_progress",
  "review",
  "blocked",
  "done",
  "parked",
  "retired",
]);
export type TaskBoardTaskStatus = typeof TaskBoardTaskStatus.Type;

export const TaskBoardTaskPriority = Schema.Literals(["low", "medium", "high", "critical"]);
export type TaskBoardTaskPriority = typeof TaskBoardTaskPriority.Type;

export const TaskBoardAgent = Schema.Struct({
  providerInstanceId: Schema.optional(TrimmedNonEmptyString),
  model: Schema.optional(TrimmedNonEmptyString),
  options: Schema.optional(ProviderOptionSelections),
  threadId: Schema.optional(TrimmedNonEmptyString),
});
export type TaskBoardAgent = typeof TaskBoardAgent.Type;

export const TaskBoardHistoryEntry = Schema.Struct({
  id: TrimmedNonEmptyString,
  taskId: TrimmedNonEmptyString,
  action: Schema.Literals([
    "created",
    "claimed",
    "released",
    "updated",
    "blocked",
    "completed",
    "reopened",
    "imported",
    "progress",
  ]),
  actor: TrimmedNonEmptyString,
  timestamp: Schema.Number,
  note: Schema.optional(Schema.NullOr(Schema.String)),
  agent: Schema.optional(TaskBoardAgent),
});
export type TaskBoardHistoryEntry = typeof TaskBoardHistoryEntry.Type;

export const TaskBoardTask = Schema.Struct({
  id: TrimmedNonEmptyString,
  project: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  description: Schema.String,
  status: TaskBoardTaskStatus,
  priority: TaskBoardTaskPriority,
  claimedBy: Schema.NullOr(TrimmedNonEmptyString),
  claimedAt: Schema.NullOr(Schema.Number),
  claimedAgent: Schema.NullOr(TaskBoardAgent),
  completedBy: Schema.NullOr(TrimmedNonEmptyString),
  completedAt: Schema.NullOr(Schema.Number),
  completionSummary: Schema.NullOr(Schema.String),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  labels: Schema.Array(TrimmedNonEmptyString),
  source: Schema.Literals(["board", "github_issue", "aios_card"]),
  // The fields below come from an AIOS task card. All are optional so shared records written
  // before they existed still decode.
  projectSlug: Schema.optional(Schema.NullOr(Schema.String)),
  effort: Schema.optional(Schema.NullOr(Schema.String)),
  energy: Schema.optional(Schema.NullOr(Schema.String)),
  due: Schema.optional(Schema.NullOr(Schema.String)),
  milestone: Schema.optional(Schema.NullOr(TaskBoardMilestoneVersion)),
  verify: Schema.optional(Schema.NullOr(Schema.String)),
  startFiles: Schema.optional(Schema.Array(Schema.String)),
  blockedBy: Schema.optional(Schema.Array(Schema.String)),
  checklist: Schema.optional(Schema.Struct({ done: Schema.Number, total: Schema.Number })),
  // True when the card is published to the project's shared board so collaborators see it.
  shared: Schema.optional(Schema.Boolean),
  sharedBy: Schema.optional(Schema.NullOr(Schema.String)),
  sourceId: Schema.NullOr(TrimmedNonEmptyString),
  sourceFile: Schema.NullOr(TrimmedNonEmptyString),
  sourceRoot: Schema.optional(TrimmedNonEmptyString),
  issueUrl: Schema.NullOr(TrimmedNonEmptyString),
  history: Schema.Array(TaskBoardHistoryEntry),
});
export type TaskBoardTask = typeof TaskBoardTask.Type;

export const TaskBoardIssue = Schema.Struct({
  number: PositiveInt,
  title: TrimmedNonEmptyString,
  url: TrimmedNonEmptyString,
  updatedAt: Schema.String,
  createdAt: Schema.optional(Schema.String),
  body: Schema.optional(Schema.NullOr(Schema.String)),
  state: Schema.optional(Schema.Literals(["OPEN", "CLOSED"])),
  labels: Schema.Array(Schema.Struct({ name: Schema.String })),
  assignees: Schema.Array(Schema.Struct({ login: Schema.String })),
});
export type TaskBoardIssue = typeof TaskBoardIssue.Type;

export const TaskBoardSummary = Schema.Struct({
  total: Schema.Number,
  todo: Schema.Number,
  inProgress: Schema.Number,
  review: Schema.optional(Schema.Number),
  blocked: Schema.Number,
  done: Schema.Number,
});
export type TaskBoardSummary = typeof TaskBoardSummary.Type;

export const TaskBoardSnapshot = Schema.Struct({
  projectId: ProjectId,
  project: TrimmedNonEmptyString,
  repository: TrimmedNonEmptyString,
  tasks: Schema.Array(TaskBoardTask),
  issues: Schema.Array(TaskBoardIssue),
  checkedAt: Schema.Number,
  limit: PositiveInt,
  aiosConnected: Schema.Boolean,
  summary: TaskBoardSummary,
});
export type TaskBoardSnapshot = typeof TaskBoardSnapshot.Type;

export const TaskBoardListInput = Schema.Struct({ projectId: ProjectId });
export type TaskBoardListInput = typeof TaskBoardListInput.Type;

export const TaskBoardCreateInput = Schema.Struct({
  projectId: ProjectId,
  title: TrimmedNonEmptyString.check(Schema.isMaxLength(256)),
  description: Schema.optional(Schema.String.check(Schema.isMaxLength(20_000))),
  priority: Schema.optional(TaskBoardTaskPriority),
  actor: TrimmedNonEmptyString.check(Schema.isMaxLength(100)),
  agent: Schema.optional(TaskBoardAgent),
  labels: Schema.optional(Schema.Array(TrimmedNonEmptyString)),
});
export type TaskBoardCreateInput = typeof TaskBoardCreateInput.Type;

export const TaskBoardClaimInput = Schema.Struct({
  projectId: ProjectId,
  taskId: TrimmedNonEmptyString,
  actor: TrimmedNonEmptyString.check(Schema.isMaxLength(100)),
  agent: Schema.optional(TaskBoardAgent),
});
export type TaskBoardClaimInput = typeof TaskBoardClaimInput.Type;

export const TaskBoardReleaseInput = Schema.Struct({
  projectId: ProjectId,
  taskId: TrimmedNonEmptyString,
  actor: TrimmedNonEmptyString.check(Schema.isMaxLength(100)),
});
export type TaskBoardReleaseInput = typeof TaskBoardReleaseInput.Type;

export const TaskBoardCompleteInput = Schema.Struct({
  projectId: ProjectId,
  taskId: TrimmedNonEmptyString,
  actor: TrimmedNonEmptyString.check(Schema.isMaxLength(100)),
  summary: Schema.optional(Schema.String.check(Schema.isMaxLength(20_000))),
});
export type TaskBoardCompleteInput = typeof TaskBoardCompleteInput.Type;

export const TaskBoardUpdateInput = Schema.Struct({
  projectId: ProjectId,
  taskId: TrimmedNonEmptyString,
  actor: TrimmedNonEmptyString.check(Schema.isMaxLength(100)),
  agent: Schema.optional(TaskBoardAgent),
  title: Schema.optional(TrimmedNonEmptyString.check(Schema.isMaxLength(256))),
  description: Schema.optional(Schema.String.check(Schema.isMaxLength(20_000))),
  status: Schema.optional(TaskBoardTaskStatus),
  priority: Schema.optional(TaskBoardTaskPriority),
  labels: Schema.optional(Schema.Array(TrimmedNonEmptyString)),
  note: Schema.optional(Schema.String.check(Schema.isMaxLength(4_000))),
});
export type TaskBoardUpdateInput = typeof TaskBoardUpdateInput.Type;

export const TaskBoardRoadmap = Schema.Struct({
  projectSlug: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  currentVersion: TaskBoardMilestoneVersion,
  targetVersion: TaskBoardMilestoneVersion,
  releaseDefinition: Schema.String,
  milestones: Schema.Array(
    Schema.Struct({
      version: TaskBoardMilestoneVersion,
      title: TrimmedNonEmptyString,
      goal: Schema.String,
      tasks: Schema.Array(
        Schema.Struct({
          key: TrimmedNonEmptyString,
          title: TrimmedNonEmptyString,
          description: Schema.String,
          priority: Schema.optional(TaskBoardTaskPriority),
        }),
      ),
    }),
  ),
});
export type TaskBoardRoadmap = typeof TaskBoardRoadmap.Type;

// One section of the workspace view: an AIOS project, optionally backed by a Leonidas project.
export const TaskBoardWorkspaceProject = Schema.Struct({
  slug: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  projectId: Schema.NullOr(ProjectId),
  // GitHub "owner/name" when sharing with collaborators is possible for this project.
  repository: Schema.NullOr(TrimmedNonEmptyString),
  total: Schema.Number,
  open: Schema.Number,
});
export type TaskBoardWorkspaceProject = typeof TaskBoardWorkspaceProject.Type;

// Everything in the user's AIOS task folders, read from disk with no GitHub round trip.
export const TaskBoardWorkspaceSnapshot = Schema.Struct({
  member: TrimmedNonEmptyString,
  aiosRoot: Schema.NullOr(Schema.String),
  aiosConnected: Schema.Boolean,
  checkedAt: Schema.Number,
  projects: Schema.Array(TaskBoardWorkspaceProject),
  tasks: Schema.Array(TaskBoardTask),
  roadmaps: Schema.optional(Schema.Array(TaskBoardRoadmap)),
});
export type TaskBoardWorkspaceSnapshot = typeof TaskBoardWorkspaceSnapshot.Type;

export const TaskBoardWorkspaceInput = Schema.Struct({});
export type TaskBoardWorkspaceInput = typeof TaskBoardWorkspaceInput.Type;

// Patches one AIOS card in place. `projectSlug: null` unlinks it from its project.
export const TaskBoardCardUpdateInput = Schema.Struct({
  taskId: TrimmedNonEmptyString,
  // Needed only to update a task that exists on a project's shared board but not in this AIOS.
  projectId: Schema.optional(ProjectId),
  actor: TrimmedNonEmptyString.check(Schema.isMaxLength(100)),
  agent: Schema.optional(TaskBoardAgent),
  title: Schema.optional(TrimmedNonEmptyString.check(Schema.isMaxLength(256))),
  due: Schema.optional(Schema.NullOr(TaskBoardDueDate)),
  milestone: Schema.optional(Schema.NullOr(TaskBoardMilestoneVersion)),
  status: Schema.optional(TaskBoardTaskStatus),
  priority: Schema.optional(TaskBoardTaskPriority),
  projectSlug: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
  claimedBy: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
  effort: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
  // Replaces the card's tags.
  labels: Schema.optional(Schema.Array(TrimmedNonEmptyString)),
  // Appended to the card's activity log.
  note: Schema.optional(Schema.String.check(Schema.isMaxLength(4_000))),
});
export type TaskBoardCardUpdateInput = typeof TaskBoardCardUpdateInput.Type;

export const TaskBoardCardCreateInput = Schema.Struct({
  idempotencyKey: Schema.optional(TrimmedNonEmptyString.check(Schema.isMaxLength(256))),
  projectId: Schema.optional(ProjectId),
  title: TrimmedNonEmptyString.check(Schema.isMaxLength(256)),
  due: Schema.optional(Schema.NullOr(TaskBoardDueDate)),
  milestone: Schema.optional(Schema.NullOr(TaskBoardMilestoneVersion)),
  description: Schema.optional(Schema.String.check(Schema.isMaxLength(20_000))),
  priority: Schema.optional(TaskBoardTaskPriority),
  projectSlug: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
  actor: TrimmedNonEmptyString.check(Schema.isMaxLength(100)),
});
export type TaskBoardCardCreateInput = typeof TaskBoardCardCreateInput.Type;

/** A raw capture: saved first, classified later. `source` says where it came from. */
export const InboxDropInput = Schema.Struct({
  text: TrimmedNonEmptyString.check(Schema.isMaxLength(20_000)),
  source: Schema.optional(TrimmedNonEmptyString.check(Schema.isMaxLength(500))),
  projectSlug: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
  actor: TrimmedNonEmptyString.check(Schema.isMaxLength(100)),
});
export type InboxDropInput = typeof InboxDropInput.Type;

export const InboxDrop = Schema.Struct({
  id: Schema.String,
  createdAt: Schema.String,
  /** Triage's guess. A confident task also becomes a task card, titled `filedTask`. */
  kind: Schema.Literals(["note", "idea", "task"]),
  filedTask: Schema.optional(Schema.String),
});
export type InboxDrop = typeof InboxDrop.Type;

export const InboxUndoInput = Schema.Struct({ id: TrimmedNonEmptyString });
export type InboxUndoInput = typeof InboxUndoInput.Type;

// Publishes (or withdraws) cards on the project's shared board. Omitting `taskIds` targets every
// open card linked to the project.
export const TaskBoardShareInput = Schema.Struct({
  projectId: ProjectId,
  taskIds: Schema.optional(Schema.Array(TrimmedNonEmptyString)),
  shared: Schema.Boolean,
  actor: TrimmedNonEmptyString.check(Schema.isMaxLength(100)),
});
export type TaskBoardShareInput = typeof TaskBoardShareInput.Type;

// Folders that look like the user's AIOS. `pickedPath` is a folder the user chose by hand.
export const TaskBoardAiosCandidate = Schema.Struct({
  root: Schema.String,
  confidence: Schema.Literals(["marker", "schema"]),
  cardCount: Schema.Number,
  cardsWithFrontmatter: Schema.Number,
  markers: Schema.Array(Schema.String),
});
export type TaskBoardAiosCandidate = typeof TaskBoardAiosCandidate.Type;

export const TaskBoardAiosDetectInput = Schema.Struct({
  pickedPath: Schema.optional(TrimmedNonEmptyString),
});
export type TaskBoardAiosDetectInput = typeof TaskBoardAiosDetectInput.Type;

export const TaskBoardAiosDetectResult = Schema.Struct({
  /** The root already confirmed for this environment, if any. */
  confirmedRoot: Schema.NullOr(Schema.String),
  candidates: Schema.Array(TaskBoardAiosCandidate),
});
export type TaskBoardAiosDetectResult = typeof TaskBoardAiosDetectResult.Type;

// Confirms a folder as the AIOS. `null` clears it and returns to auto-detection.
export const TaskBoardAiosConfirmInput = Schema.Struct({
  root: Schema.NullOr(TrimmedNonEmptyString),
});
export type TaskBoardAiosConfirmInput = typeof TaskBoardAiosConfirmInput.Type;

export const TaskBoardProjectDatabase = Schema.Struct({
  version: Schema.Literal(1),
  tasks: Schema.Array(TaskBoardTask),
});

export class TaskBoardReadError extends Schema.TaggedError<TaskBoardReadError>()(
  "TaskBoardReadError",
  {
    reason: Schema.Literals([
      "unavailable",
      "request_failed",
      "invalid_response",
      "issues_disabled",
      "project_not_found",
      "repository_not_supported",
      "write_access_required",
      "aios_not_found",
    ]),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    switch (this.reason) {
      case "issues_disabled":
        return "GitHub Issues are disabled for this repository. Enable them in repository settings.";
      case "unavailable":
        return "GitHub CLI is unavailable on this server. Install gh and authenticate with repository access.";
      case "project_not_found":
        return "The selected project is not available in this environment.";
      case "repository_not_supported":
        return "Connect this project to a GitHub repository to enable its shared task board.";
      case "write_access_required":
        return "This GitHub account needs repository Contents write access to create shared task records.";
      case "aios_not_found":
        return "Could not find this environment's AIOS tasks folder. Set LEONIDAS_AIOS_ROOT to your AIOS root.";
      case "invalid_response":
        return "GitHub returned an unreadable task board. Retry the request.";
      case "request_failed":
        return "Could not load or save the shared task board. Check GitHub authentication, repository access and rate limits.";
    }
  }
}

export class TaskBoardOperationError extends Schema.TaggedError<TaskBoardOperationError>()(
  "TaskBoardOperationError",
  {
    reason: Schema.Literals([
      "task_not_found",
      "already_claimed",
      "not_claimed",
      "claim_conflict",
      "task_completed",
      "storage_error",
      "invalid_data",
      "invalid_card",
    ]),
    message: Schema.String,
  },
) {}
