import {
  OrchestratorMcpFailure,
  TaskBoardClaimInput,
  TaskBoardCompleteInput,
  TaskBoardCreateInput,
  TaskBoardSnapshot,
  TaskBoardSyncInput,
  TaskBoardTask,
  TaskBoardTaskPriority,
  TaskBoardUpdateInput,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { Tool, Toolkit } from "effect/ai";

import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as ProjectService from "../../../project/ProjectService.ts";
import * as TaskBoardService from "../../../taskBoard/TaskBoardService.ts";
import * as ThreadManagementService from "../../../orchestration-v2/ThreadManagementService.ts";

const dependencies = [
  McpInvocationContext.McpInvocationContext,
  ProjectService.ProjectService,
  TaskBoardService.TaskBoardService,
  ThreadManagementService.ThreadManagementService,
];

const shared = {
  failure: OrchestratorMcpFailure,
  failureMode: "return" as const,
  dependencies,
};

const actor = Schema.Literals(["Jake", "Mob"]);

const ListTool = Tool.make("t3_task_board_list", {
  ...shared,
  description:
    "Read this thread project's shared task board. The current project is detected from the calling thread; do not pass a project ID. Before starting task work, check this board and claim one task. Claims and history show the current provider, model, options, and thread automatically.",
  success: TaskBoardSnapshot,
})
  .annotate(Tool.Title, "List project tasks")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true);

const CreateTool = Tool.make("t3_task_board_create", {
  ...shared,
  description:
    "Create a task on this thread project's shared board. The current project and agent identity are detected automatically. Use actor Jake or Mob for the human who owns this environment.",
  parameters: Schema.Struct({
    actor,
    title: TaskBoardCreateInput.fields.title,
    description: TaskBoardCreateInput.fields.description,
    priority: Schema.optional(TaskBoardTaskPriority),
    labels: TaskBoardCreateInput.fields.labels,
  }),
  success: TaskBoardTask,
})
  .annotate(Tool.Title, "Create a project task")
  .annotate(Tool.Destructive, true);

const ClaimTool = Tool.make("t3_task_board_claim", {
  ...shared,
  description:
    "Claim one unclaimed task before working on it. A conflicting claim means another person or agent owns it; choose another task. The current thread's provider, model, options, and thread ID are recorded automatically.",
  parameters: Schema.Struct({ taskId: TaskBoardClaimInput.fields.taskId, actor }),
  success: TaskBoardTask,
})
  .annotate(Tool.Title, "Claim a project task")
  .annotate(Tool.Destructive, true)
  .annotate(Tool.Idempotent, true);

const ProgressTool = Tool.make("t3_task_board_progress", {
  ...shared,
  description:
    "Record a concise progress note for a task you currently claim. Use status blocked when work cannot continue, otherwise omit status. The current thread's agent identity is recorded automatically.",
  parameters: Schema.Struct({
    taskId: TaskBoardUpdateInput.fields.taskId,
    actor,
    note: Schema.String.check(Schema.isMaxLength(4_000)),
    status: Schema.optional(Schema.Literals(["in_progress", "blocked"])),
  }),
  success: TaskBoardTask,
})
  .annotate(Tool.Title, "Record task progress")
  .annotate(Tool.Destructive, true)
  .annotate(Tool.Idempotent, false);

const ReleaseTool = Tool.make("t3_task_board_release", {
  ...shared,
  description:
    "Release a task you claimed when handing it off or stopping without completion, so another agent can claim it. The current thread is checked against the task claim.",
  parameters: Schema.Struct({ taskId: TaskBoardClaimInput.fields.taskId, actor }),
  success: TaskBoardTask,
})
  .annotate(Tool.Title, "Release a project task")
  .annotate(Tool.Destructive, true);

const CompleteTool = Tool.make("t3_task_board_complete", {
  ...shared,
  description:
    "Complete a task you currently claim and include a short completion summary. The current thread is checked against the task claim; provider, model, options, and thread ID are added to history.",
  parameters: Schema.Struct({
    taskId: TaskBoardCompleteInput.fields.taskId,
    actor,
    summary: TaskBoardCompleteInput.fields.summary,
  }),
  success: TaskBoardTask,
})
  .annotate(Tool.Title, "Complete a project task")
  .annotate(Tool.Destructive, true);

const SyncTool = Tool.make("t3_task_board_sync", {
  ...shared,
  description:
    "Sync task cards labeled for this project between the shared board and this environment's AIOS global tasks folder. Project selection comes from the current thread. Use after adding or changing task cards locally.",
  parameters: Schema.Struct({ actor }),
  success: TaskBoardSnapshot,
})
  .annotate(Tool.Title, "Sync AIOS project tasks")
  .annotate(Tool.Destructive, true);

export const TaskBoardToolkit = Toolkit.make(
  ListTool,
  CreateTool,
  ClaimTool,
  ProgressTool,
  ReleaseTool,
  CompleteTool,
  SyncTool,
);
