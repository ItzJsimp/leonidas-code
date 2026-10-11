import {
  OrchestratorMcpFailure,
  type TaskBoardAgent,
  TaskBoardOperationError,
  TaskBoardReadError,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as McpToolAccess from "../../McpToolAccess.ts";
import * as ProjectService from "../../../project/ProjectService.ts";
import * as TaskBoardService from "../../../taskBoard/TaskBoardService.ts";
import * as ThreadManagementService from "../../../orchestration-v2/ThreadManagementService.ts";
import { TaskBoardToolkit } from "./tools.ts";

const taskBoardFailure = (error: TaskBoardReadError | TaskBoardOperationError) =>
  new OrchestratorMcpFailure({
    code: error._tag === "TaskBoardOperationError" ? "invalid_request" : "orchestration_error",
    message: error.message,
  });

const unavailable = () =>
  new OrchestratorMcpFailure({
    code: "orchestration_error",
    message: "The calling thread's project could not be resolved.",
  });

const currentProject = Effect.fn("TaskBoardToolkit.currentProject")(function* () {
  const scope = yield* McpInvocationContext.McpInvocationContext;
  const caller = scope.thread;
  if (!caller) {
    return yield* new OrchestratorMcpFailure({
      code: "thread_credential_required",
      message: "Task board tools need an agent running inside a project thread.",
    });
  }

  const threads = yield* ThreadManagementService.ThreadManagementService;
  const shell = yield* threads
    .getThreadShell(caller.threadId)
    .pipe(Effect.mapError(() => unavailable()));
  if (!shell || shell.deletedAt !== null) {
    return yield* new OrchestratorMcpFailure({
      code: "thread_not_found",
      message: "The calling thread is no longer available.",
    });
  }
  if (shell.providerInstanceId !== caller.providerInstanceId) {
    return yield* new OrchestratorMcpFailure({
      code: "capability_denied",
      message: "The MCP session no longer matches this thread's active provider.",
    });
  }

  const projects = yield* ProjectService.ProjectService;
  const project = yield* projects
    .getById(shell.projectId)
    .pipe(Effect.mapError(() => unavailable()));
  if (Option.isNone(project)) {
    return yield* new OrchestratorMcpFailure({
      code: "invalid_request",
      message: "The calling thread's project is no longer available.",
    });
  }

  const agent: TaskBoardAgent = {
    providerInstanceId: caller.providerInstanceId,
    model: shell.modelSelection.model,
    threadId: caller.threadId,
    ...(shell.modelSelection.options === undefined
      ? {}
      : { options: shell.modelSelection.options }),
  };
  return { project: project.value, agent };
});

export const layer = McpToolAccess.toLayer(TaskBoardToolkit, {
  t3_task_board_list: McpToolAccess.readsAsCaller(() =>
    Effect.gen(function* () {
      const { project } = yield* currentProject();
      const service = yield* TaskBoardService.TaskBoardService;
      return yield* service.list(project).pipe(Effect.mapError(taskBoardFailure));
    }),
  ),
  t3_task_board_create: McpToolAccess.actsAsCaller((input) =>
    Effect.gen(function* () {
      const { project, agent } = yield* currentProject();
      const service = yield* TaskBoardService.TaskBoardService;
      return yield* service
        .create(project, { ...input, agent })
        .pipe(Effect.mapError(taskBoardFailure));
    }),
  ),
  t3_task_board_claim: McpToolAccess.actsAsCaller((input) =>
    Effect.gen(function* () {
      const { project, agent } = yield* currentProject();
      const service = yield* TaskBoardService.TaskBoardService;
      return yield* service
        .claim(project, { ...input, agent })
        .pipe(Effect.mapError(taskBoardFailure));
    }),
  ),
  t3_task_board_progress: McpToolAccess.actsAsCaller((input) =>
    Effect.gen(function* () {
      const { project, agent } = yield* currentProject();
      const service = yield* TaskBoardService.TaskBoardService;
      return yield* service
        .update(project, { ...input, agent })
        .pipe(Effect.mapError(taskBoardFailure));
    }),
  ),
  t3_task_board_release: McpToolAccess.actsAsCaller((input) =>
    Effect.gen(function* () {
      const { project, agent } = yield* currentProject();
      const service = yield* TaskBoardService.TaskBoardService;
      return yield* service
        .release(project, { ...input, agent })
        .pipe(Effect.mapError(taskBoardFailure));
    }),
  ),
  t3_task_board_complete: McpToolAccess.actsAsCaller((input) =>
    Effect.gen(function* () {
      const { project, agent } = yield* currentProject();
      const service = yield* TaskBoardService.TaskBoardService;
      return yield* service
        .complete(project, { ...input, agent })
        .pipe(Effect.mapError(taskBoardFailure));
    }),
  ),
  t3_task_board_sync: McpToolAccess.actsAsCaller((input) =>
    Effect.gen(function* () {
      const { project, agent } = yield* currentProject();
      const service = yield* TaskBoardService.TaskBoardService;
      return yield* service
        .sync(project, { ...input, agent })
        .pipe(Effect.mapError(taskBoardFailure));
    }),
  ),
});
