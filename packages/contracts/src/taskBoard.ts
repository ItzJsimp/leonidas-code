import * as Schema from "effect/Schema";
import { PositiveInt, ProjectId, TrimmedNonEmptyString } from "./baseSchemas.ts";
import { ProviderOptionSelections } from "./model.ts";

export const TaskBoardTaskStatus = Schema.Literals(["todo", "in_progress", "blocked", "done"]);
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

/** Shared rows contain only repository-stable identity, never local ProjectIds or filesystem paths. */
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
  sourceId: Schema.NullOr(TrimmedNonEmptyString),
  /** A filename only; never a local absolute path. */
  sourceFile: Schema.NullOr(TrimmedNonEmptyString),
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
  blocked: Schema.Number,
  done: Schema.Number,
});

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
  agent: Schema.optional(TaskBoardAgent),
});
export type TaskBoardReleaseInput = typeof TaskBoardReleaseInput.Type;

export const TaskBoardCompleteInput = Schema.Struct({
  projectId: ProjectId,
  taskId: TrimmedNonEmptyString,
  actor: TrimmedNonEmptyString.check(Schema.isMaxLength(100)),
  summary: Schema.optional(Schema.String.check(Schema.isMaxLength(20_000))),
  agent: Schema.optional(TaskBoardAgent),
});
export type TaskBoardCompleteInput = typeof TaskBoardCompleteInput.Type;

export const TaskBoardUpdateInput = Schema.Struct({
  projectId: ProjectId,
  taskId: TrimmedNonEmptyString,
  actor: TrimmedNonEmptyString.check(Schema.isMaxLength(100)),
  title: Schema.optional(TrimmedNonEmptyString.check(Schema.isMaxLength(256))),
  description: Schema.optional(Schema.String.check(Schema.isMaxLength(20_000))),
  status: Schema.optional(TaskBoardTaskStatus),
  priority: Schema.optional(TaskBoardTaskPriority),
  labels: Schema.optional(Schema.Array(TrimmedNonEmptyString)),
  note: Schema.optional(Schema.String.check(Schema.isMaxLength(4_000))),
  agent: Schema.optional(TaskBoardAgent),
});
export type TaskBoardUpdateInput = typeof TaskBoardUpdateInput.Type;

export const TaskBoardSyncInput = Schema.Struct({
  projectId: ProjectId,
  actor: TrimmedNonEmptyString.check(Schema.isMaxLength(100)),
  agent: Schema.optional(TaskBoardAgent),
});
export type TaskBoardSyncInput = typeof TaskBoardSyncInput.Type;

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
    ]),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    switch (this.reason) {
      case "issues_disabled":
        return "GitHub Issues are disabled for this repository. The shared task list is still available.";
      case "unavailable":
        return "GitHub CLI is unavailable on this server. Install gh and authenticate it with repository access.";
      case "project_not_found":
        return "The selected project is not available in this environment.";
      case "repository_not_supported":
        return "Connect this project to a GitHub repository to enable its shared task board.";
      case "write_access_required":
        return "This GitHub account needs repository Contents write access to create shared task records.";
      case "invalid_response":
        return "GitHub returned an unreadable task board. Retry the request.";
      case "request_failed":
        return "Could not load or save this project's shared task board. Check GitHub authentication, repository access and rate limits.";
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
    ]),
    message: Schema.String,
  },
) {}
