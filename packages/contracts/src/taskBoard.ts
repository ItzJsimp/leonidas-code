import * as Schema from "effect/Schema";
import { PositiveInt } from "./baseSchemas.ts";

export const TASK_BOARD_REPOSITORY = "ItzJsimp/leonidas-code";

export const TaskBoardIssue = Schema.Struct({
  number: PositiveInt,
  title: Schema.String,
  url: Schema.String,
  updatedAt: Schema.String,
  labels: Schema.Array(Schema.Struct({ name: Schema.String })),
  assignees: Schema.Array(Schema.Struct({ login: Schema.String })),
});
export type TaskBoardIssue = typeof TaskBoardIssue.Type;

export const TaskBoardSnapshot = Schema.Struct({
  repository: Schema.Literal(TASK_BOARD_REPOSITORY),
  issues: Schema.Array(TaskBoardIssue),
  checkedAt: Schema.Number,
  limit: PositiveInt,
});

export class TaskBoardReadError extends Schema.TaggedError<TaskBoardReadError>()(
  "TaskBoardReadError",
  {
    reason: Schema.Literals([
      "unavailable",
      "request_failed",
      "invalid_response",
      "issues_disabled",
    ]),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    switch (this.reason) {
      case "issues_disabled":
        return "GitHub Issues are disabled for ItzJsimp/leonidas-code. Ask a repository administrator to enable Issues in repository Settings.";
      case "unavailable":
        return "GitHub CLI is unavailable on this server. Install gh and run gh auth login.";
      case "request_failed":
        return "Could not load GitHub issues. Check this server's gh authentication, repository access and GitHub rate limit, then retry.";
      case "invalid_response":
        return "GitHub returned an unreadable issue list. Retry the task board.";
    }
  }
}
