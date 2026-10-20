import * as NodeFs from "node:fs";
import * as NodePath from "node:path";
import { DatabaseSync } from "node:sqlite";
import { OrchestratorMcpFailure, type SavedItemError } from "@t3tools/contracts";
import { OrchestratorToolkit } from "./tools.ts";
import * as Effect from "effect/Effect";

import * as ModelBenchmarks from "../../../benchmarks/ModelBenchmarks.ts";
import { readCaller } from "../../threadAccess.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as McpToolAccess from "../../McpToolAccess.ts";
import * as OrchestratorMcpService from "../../OrchestratorMcpService.ts";
import * as ThreadMetadataMcpService from "../../ThreadMetadataMcpService.ts";
import * as SavedItems from "../../../savedItems/SavedItemService.ts";
import * as SavedItemExecution from "../../../savedItems/SavedItemExecution.ts";

const savedItemCall = <A, R>(effect: Effect.Effect<A, SavedItemError, R>) =>
  Effect.gen(function* () {
    const { scope } = yield* readCaller();
    return yield* effect.pipe(
      Effect.provideService(SavedItems.SavedItemCaller, {
        actor: "agent",
        threadId: scope.thread?.threadId ?? null,
      }),
      Effect.mapError(
        (error) =>
          new OrchestratorMcpFailure({
            code:
              error.reason === "agent_limit"
                ? "capability_denied"
                : error.reason === "storage" || error.reason === "execution"
                  ? "orchestration_error"
                  : "invalid_request",
            message: error.message,
          }),
      ),
    );
  });

const handlers = {
  saved_item_list: McpToolAccess.reads((input) =>
    savedItemCall(Effect.flatMap(SavedItems.SavedItemService, (service) => service.list(input))),
  ),
  saved_item_get: McpToolAccess.reads((input) =>
    savedItemCall(
      Effect.flatMap(SavedItems.SavedItemService, (service) =>
        service.get(input.id, input.workspaceId),
      ),
    ),
  ),
  saved_item_create: McpToolAccess.writes((input) =>
    savedItemCall(Effect.flatMap(SavedItems.SavedItemService, (service) => service.create(input))),
  ),
  saved_item_update: McpToolAccess.writes((input) =>
    savedItemCall(Effect.flatMap(SavedItems.SavedItemService, (service) => service.update(input))),
  ),
  saved_item_transition: McpToolAccess.writes((input) =>
    savedItemCall(
      Effect.flatMap(SavedItems.SavedItemService, (service) => service.transition(input)),
    ),
  ),
  saved_item_import: McpToolAccess.writes((input) =>
    savedItemCall(
      Effect.flatMap(SavedItems.SavedItemService, (service) => service.importMarkdown(input)),
    ),
  ),
  saved_item_launch: McpToolAccess.startsThreads(
    (input) => input,
    (input) =>
      savedItemCall(
        Effect.flatMap(SavedItemExecution.SavedItemExecution, (service) => service.launch(input)),
      ),
  ),
  saved_item_schedule: McpToolAccess.startsThreads(
    (input) => input,
    (input) =>
      savedItemCall(
        Effect.flatMap(SavedItemExecution.SavedItemExecution, (service) => service.schedule(input)),
      ),
  ),
  saved_item_save_task: McpToolAccess.writes((input) =>
    savedItemCall(
      Effect.flatMap(SavedItemExecution.SavedItemExecution, (service) => service.saveTask(input)),
    ),
  ),
  orchestrator_capabilities: McpToolAccess.reads((input) =>
    Effect.gen(function* () {
      const scope = yield* McpInvocationContext.McpInvocationContext;
      const service = yield* OrchestratorMcpService.OrchestratorMcpService;
      return yield* service.capabilities(scope, input);
    }),
  ),
  delegate_task: McpToolAccess.actsAsCaller((input) =>
    Effect.gen(function* () {
      const scope = yield* McpInvocationContext.McpInvocationContext;
      const service = yield* OrchestratorMcpService.OrchestratorMcpService;
      return yield* service.delegateTask(scope, input);
    }),
  ),
  task_status: McpToolAccess.actsAsCaller(({ taskId }) =>
    Effect.gen(function* () {
      const scope = yield* McpInvocationContext.McpInvocationContext;
      const service = yield* OrchestratorMcpService.OrchestratorMcpService;
      return yield* service.taskStatus(scope, taskId);
    }),
  ),
  task_cancel: McpToolAccess.actsAsCaller((input) =>
    Effect.gen(function* () {
      const scope = yield* McpInvocationContext.McpInvocationContext;
      const service = yield* OrchestratorMcpService.OrchestratorMcpService;
      return yield* service.cancelTask(scope, input);
    }),
  ),
  t3_workflow_stop: McpToolAccess.writesThreads(
    (input) => [input.threadId],
    (input) =>
      Effect.gen(function* () {
        const { threads } = yield* readCaller();
        return yield* threads.stopWorkflow(input).pipe(
          Effect.as({}),
          Effect.mapError(
            (cause) =>
              new OrchestratorMcpFailure({
                code:
                  cause.reason === "unavailable" || cause.reason === "stop-failed"
                    ? "orchestration_error"
                    : "invalid_request",
                message: cause.message,
              }),
          ),
        );
      }),
  ),
  schedule_task: McpToolAccess.startsThreads(
    // A scheduled task runs with the caller's own modes.
    () => ({}),
    (input) =>
      Effect.gen(function* () {
        const scope = yield* McpInvocationContext.McpInvocationContext;
        const service = yield* OrchestratorMcpService.OrchestratorMcpService;
        return yield* service.scheduleTask(scope, input);
      }),
  ),
  list_scheduled_tasks: McpToolAccess.reads((input) =>
    Effect.gen(function* () {
      const scope = yield* McpInvocationContext.McpInvocationContext;
      const service = yield* OrchestratorMcpService.OrchestratorMcpService;
      return yield* service.listScheduledTasks(scope, input);
    }),
  ),
  update_scheduled_task: McpToolAccess.writes((input) =>
    Effect.gen(function* () {
      const scope = yield* McpInvocationContext.McpInvocationContext;
      const service = yield* OrchestratorMcpService.OrchestratorMcpService;
      return yield* service.updateScheduledTask(scope, input);
    }),
  ),
  delete_scheduled_task: McpToolAccess.writes((input) =>
    Effect.gen(function* () {
      const scope = yield* McpInvocationContext.McpInvocationContext;
      const service = yield* OrchestratorMcpService.OrchestratorMcpService;
      return yield* service.deleteScheduledTask(scope, input);
    }),
  ),
  board_task_list: McpToolAccess.reads((input) =>
    Effect.gen(function* () {
      const scope = yield* McpInvocationContext.McpInvocationContext;
      const service = yield* OrchestratorMcpService.OrchestratorMcpService;
      return yield* service.boardTaskList(scope, input);
    }),
  ),
  board_task_get: McpToolAccess.reads((input) =>
    Effect.gen(function* () {
      const scope = yield* McpInvocationContext.McpInvocationContext;
      const service = yield* OrchestratorMcpService.OrchestratorMcpService;
      return yield* service.boardTaskGet(scope, input);
    }),
  ),
  board_task_update: McpToolAccess.writes((input) =>
    Effect.gen(function* () {
      const scope = yield* McpInvocationContext.McpInvocationContext;
      const service = yield* OrchestratorMcpService.OrchestratorMcpService;
      return yield* service.boardTaskUpdate(scope, input);
    }),
  ),
  board_task_create: McpToolAccess.writes((input) =>
    Effect.gen(function* () {
      const scope = yield* McpInvocationContext.McpInvocationContext;
      const service = yield* OrchestratorMcpService.OrchestratorMcpService;
      return yield* service.boardTaskCreate(scope, input);
    }),
  ),
  focus_list: McpToolAccess.reads((input) =>
    Effect.gen(function* () {
      const scope = yield* McpInvocationContext.McpInvocationContext;
      const service = yield* OrchestratorMcpService.OrchestratorMcpService;
      return yield* service.focusList(scope, input);
    }),
  ),
  focus_check: McpToolAccess.writes((input) =>
    Effect.gen(function* () {
      const scope = yield* McpInvocationContext.McpInvocationContext;
      const service = yield* OrchestratorMcpService.OrchestratorMcpService;
      return yield* service.focusCheck(scope, input);
    }),
  ),
  request_secret: McpToolAccess.actsAsCaller((input) =>
    Effect.gen(function* () {
      const scope = yield* McpInvocationContext.McpInvocationContext;
      const service = yield* OrchestratorMcpService.OrchestratorMcpService;
      return yield* service.requestSecret(scope, input);
    }),
  ),
  create_threads: McpToolAccess.actsAsCaller((input) =>
    Effect.gen(function* () {
      const scope = yield* McpInvocationContext.McpInvocationContext;
      const service = yield* OrchestratorMcpService.OrchestratorMcpService;
      return yield* service.createThreads(scope, input);
    }),
  ),
  t3_thread_list: McpToolAccess.reads((input) =>
    Effect.gen(function* () {
      const scope = yield* McpInvocationContext.McpInvocationContext;
      const service = yield* OrchestratorMcpService.OrchestratorMcpService;
      return yield* service.listThreads(scope, input);
    }),
  ),
  // Reading a child's finished result also acknowledges its delivery to the
  // reader's own thread. That is bookkeeping on the caller's own subagent, not
  // a change to anything it reads, so this stays a read.
  t3_thread_read: McpToolAccess.reads((input) =>
    Effect.gen(function* () {
      const scope = yield* McpInvocationContext.McpInvocationContext;
      const service = yield* OrchestratorMcpService.OrchestratorMcpService;
      return yield* service.readThread(scope, input);
    }),
  ),
  t3_thread_update: McpToolAccess.writesThreads(
    (input) => [input.threadId],
    (input) =>
      Effect.gen(function* () {
        const scope = yield* McpInvocationContext.McpInvocationContext;
        const service = yield* ThreadMetadataMcpService.ThreadMetadataMcpService;
        return yield* service.update(scope, input);
      }),
  ),
  t3_thread_send: McpToolAccess.writesThreads(
    (input) => [input.threadId],
    (input) =>
      Effect.gen(function* () {
        const scope = yield* McpInvocationContext.McpInvocationContext;
        const service = yield* OrchestratorMcpService.OrchestratorMcpService;
        return yield* service.sendToThread(scope, input);
      }),
  ),
  t3_thread_wait: McpToolAccess.reads((input) =>
    Effect.gen(function* () {
      const scope = yield* McpInvocationContext.McpInvocationContext;
      const service = yield* OrchestratorMcpService.OrchestratorMcpService;
      return yield* service.waitForThread(scope, input);
    }),
  ),
  t3_thread_interrupt: McpToolAccess.writesThreads(
    (input) => [input.threadId],
    (input) =>
      Effect.gen(function* () {
        const scope = yield* McpInvocationContext.McpInvocationContext;
        const service = yield* OrchestratorMcpService.OrchestratorMcpService;
        return yield* service.interruptThread(scope, input);
      }),
  ),
  model_benchmarks: McpToolAccess.reads(({ models }) =>
    Effect.flatMap(ModelBenchmarks.ModelBenchmarks, (benchmarks) => benchmarks.report(models)),
  ),
  memory_search: McpToolAccess.reads(({ query, limit = 5 }) =>
    Effect.gen(function* () {
      const aiosRoot = "D:/Leonidas AIOS";
      const dbPath = NodePath.join(aiosRoot, ".leonidas", "memory.sqlite");
      if (!NodeFs.existsSync(dbPath)) {
        return { results: [] };
      }
      try {
        const db = new DatabaseSync(dbPath, { readOnly: true });
        const terms = query
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim()
          .split(/\s+/)
          .filter((t: string) => t.length > 1);

        if (terms.length === 0) {
          return { results: [] };
        }

        const matchExpr = terms.map((t: string) => `"${t}"`).join(" OR ");
        const sql = `
          SELECT path, name, desc, snippet(memory_fts, 3, '[', ']', ' ... ', 20),
                 bm25(memory_fts, 0.0, 4.0, 3.0, 1.0) as score
          FROM memory_fts
          WHERE memory_fts MATCH ?
          ORDER BY score
          LIMIT ?
        `;
        const rows = db.prepare(sql).all(matchExpr, limit) as ReadonlyArray<any>;
        db.close();

        return {
          results: rows.map((r: any) => ({
            path: r.path ?? "",
            name: r.name ?? "",
            description: r.desc ?? "",
            snippet: r["snippet(memory_fts, 3, '[', ']', ' ... ', 20)"] ?? "",
            score: Number(r.score ?? 0),
          })),
        };
      } catch (err: any) {
        return yield* new OrchestratorMcpFailure({
          code: "orchestration_error",
          message: `Memory search failed: ${err.message}`,
        });
      }
    }),
  ),
  memory_get: McpToolAccess.reads(({ path }) =>
    Effect.gen(function* () {
      const aiosRoot = "D:/Leonidas AIOS";
      const fullPath = NodePath.resolve(aiosRoot, path);
      if (!fullPath.startsWith(NodePath.resolve(aiosRoot))) {
        return yield* new OrchestratorMcpFailure({
          code: "capability_denied",
          message: "Path outside AIOS directory is forbidden.",
        });
      }
      if (!NodeFs.existsSync(fullPath)) {
        return yield* new OrchestratorMcpFailure({
          code: "task_not_found",
          message: `Memory file not found: ${path}`,
        });
      }
      try {
        const content = NodeFs.readFileSync(fullPath, "utf-8");
        return { path, content };
      } catch (err: any) {
        return yield* new OrchestratorMcpFailure({
          code: "orchestration_error",
          message: `Failed to read memory file: ${err.message}`,
        });
      }
    }),
  ),
  memory_status: McpToolAccess.reads(() =>
    Effect.gen(function* () {
      const aiosRoot = "D:/Leonidas AIOS";
      const dbPath = NodePath.join(aiosRoot, ".leonidas", "memory.sqlite");
      if (!NodeFs.existsSync(dbPath)) {
        return {
          status: "not_built",
          docCount: 0,
          lastRebuild: 0,
          dbSizeKb: 0,
          dbPath,
        };
      }
      try {
        const db = new DatabaseSync(dbPath, { readOnly: true });
        const rows = Object.fromEntries(
          (db.prepare("SELECT key, value FROM meta").all() as ReadonlyArray<any>).map((r: any) => [
            r.key,
            r.value,
          ]),
        );
        const stat = NodeFs.statSync(dbPath);
        db.close();
        return {
          status: "ready",
          docCount: Number(rows.doc_count ?? 0),
          lastRebuild: Number(rows.last_rebuild ?? 0),
          dbSizeKb: Math.round(stat.size / 1024),
          dbPath,
        };
      } catch (err: any) {
        return yield* new OrchestratorMcpFailure({
          code: "orchestration_error",
          message: `Failed to read memory index status: ${err.message}`,
        });
      }
    }),
  ),
} satisfies McpToolAccess.Handlers<typeof OrchestratorToolkit.tools>;

export const layer = McpToolAccess.toLayer(OrchestratorToolkit, handlers);
