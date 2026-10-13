import type { OrchestrationV2ConversationMessage, ThreadId } from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

import * as Orchestrator from "../orchestration-v2/Orchestrator.ts";
import * as ProjectionStore from "../orchestration-v2/ProjectionStore.ts";
import { isTerminalRunStatus } from "../orchestration-v2/ThreadManagementService.ts";
import * as ProjectService from "../project/ProjectService.ts";
import { forkParked } from "../serverActivation.ts";
import { aiosSlugFor, TaskBoardService } from "./TaskBoardService.ts";

const ACTOR = "Leonidas";
const MIN_REQUEST_LENGTH = 12;
const TITLE_LENGTH = 80;
const SEEN_LIMIT = 2_000;

/** A request is real work when a person typed it; relays, schedules and one-word replies are not. */
export function isLoggableRequest(message: OrchestrationV2ConversationMessage): boolean {
  return (
    message.role === "user" &&
    !message.streaming &&
    message.delegatedCompletion === undefined &&
    message.notification === undefined &&
    message.senderThreadId === undefined &&
    message.scheduledTaskId === undefined &&
    message.text.trim().length >= MIN_REQUEST_LENGTH
  );
}

/** The first line of the request, trimmed to a card title. */
export function titleFromRequest(text: string): string {
  const line = text.trim().split(/\r?\n/, 1)[0]!.replace(/\s+/g, " ");
  if (line.length <= TITLE_LENGTH) return line;
  const cut = line.slice(0, TITLE_LENGTH - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 40 ? cut.lastIndexOf(" ") : cut.length)}…`;
}

/**
 * Files every user request as a task card, one card per thread: later messages
 * and the run outcome are appended to the same card's activity log. The card
 * is the log; the agent and the nightly auditor add detail on top of it.
 */
export const make = Effect.gen(function* () {
  const orchestrator = yield* Orchestrator.OrchestratorV2;
  const projections = yield* ProjectionStore.ProjectionStoreV2;
  const projectService = yield* ProjectService.ProjectService;
  const taskBoard = yield* TaskBoardService;

  const cards = new Map<ThreadId, string>();
  const seen = new Set<string>();

  const allProjects = projectService.snapshot.pipe(Effect.map((snapshot) => snapshot.projects));

  const logRequest = (message: OrchestrationV2ConversationMessage) =>
    Effect.gen(function* () {
      if (seen.has(message.id)) return;
      seen.add(message.id);
      if (seen.size > SEEN_LIMIT) seen.delete(seen.values().next().value!);
      const projects = yield* allProjects;
      const existing = cards.get(message.threadId);
      if (existing !== undefined) {
        yield* taskBoard.cardUpdate(
          { taskId: existing, actor: ACTOR, note: `Follow-up: ${titleFromRequest(message.text)}` },
          projects,
        );
        return;
      }
      const shell = yield* projections.getThreadShell(message.threadId);
      const project = shell
        ? projects.find((candidate) => candidate.id === shell.projectId)
        : undefined;
      const task = yield* taskBoard.cardCreate(
        {
          title: titleFromRequest(message.text),
          description: `${message.text.trim()}\n\nThread: ${message.threadId}`,
          projectSlug: project ? aiosSlugFor(project) : null,
          actor: ACTOR,
        },
        projects,
      );
      cards.set(message.threadId, task.id);
      yield* taskBoard.cardUpdate(
        {
          taskId: task.id,
          actor: ACTOR,
          status: "in_progress",
          note: "Agent started on this request.",
        },
        projects,
      );
    });

  const logOutcome = (threadId: ThreadId, status: string) =>
    Effect.gen(function* () {
      const taskId = cards.get(threadId);
      if (taskId === undefined) return;
      yield* taskBoard.cardUpdate(
        { taskId, actor: ACTOR, note: `Run ${status}.` },
        yield* allProjects,
      );
    });

  const skip = (what: string) => (cause: Cause.Cause<unknown>) =>
    Effect.logWarning(`task auto-log skipped: ${what}`, { cause: Cause.pretty(cause) });

  const start = Effect.fn("TaskAutoLog.start")(function* () {
    yield* forkParked(
      Stream.runForEach(orchestrator.streamDomainEvents, (event) => {
        if (event.type === "message.updated" && isLoggableRequest(event.payload)) {
          return logRequest(event.payload).pipe(Effect.catchCause(skip("request")));
        }
        if (event.type === "run.updated" && isTerminalRunStatus(event.payload.status)) {
          return logOutcome(event.threadId, event.payload.status).pipe(
            Effect.catchCause(skip("outcome")),
          );
        }
        return Effect.void;
      }),
    );
  });

  return { start };
});
