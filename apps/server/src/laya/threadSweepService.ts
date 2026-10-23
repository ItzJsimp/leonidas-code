import type {
  OrchestrationV2ThreadShell,
  ThreadHandoffInput,
  ThreadId,
  ThreadSweepInput,
} from "@t3tools/contracts";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import * as ThreadManagementService from "../orchestration-v2/ThreadManagementService.ts";
import type * as ServerSettings from "../serverSettings.ts";
import type { TextGeneration } from "../textGeneration/TextGeneration.ts";
import {
  HANDOFF_ITEM_WINDOW,
  runThreadHandoff,
  runThreadSweep,
  type SweepThread,
} from "./threadSweepRun.ts";

const TAIL_ITEMS = 60;

/** The shell fields the sweep reads. `updatedAt` is a DateTime, so it needs formatIso to parse later. */
export const toSweepThread = (
  thread: Pick<
    OrchestrationV2ThreadShell,
    | "id"
    | "projectId"
    | "title"
    | "updatedAt"
    | "archivedAt"
    | "settledOverride"
    | "pinnedAt"
    | "status"
    | "pendingRuntimeRequest"
    | "visibleItemCount"
  >,
): SweepThread => ({
  id: thread.id,
  projectId: thread.projectId,
  title: thread.title,
  updatedAt: DateTime.formatIso(thread.updatedAt),
  archived: thread.archivedAt !== null,
  settled: thread.settledOverride === "settled",
  pinned: thread.pinnedAt != null,
  status: thread.status,
  hasPendingRequest: thread.pendingRuntimeRequest !== null,
  visibleItemCount: thread.visibleItemCount,
});

/** The sweep handler over the live thread store and the user's text-generation model. */
export function makeThreadSweep(deps: {
  readonly threadManagement: ThreadManagementService.ThreadManagementService["Service"];
  readonly textGeneration: TextGeneration["Service"];
  readonly serverSettings: ServerSettings.ServerSettingsService["Service"];
}) {
  return (input: ThreadSweepInput) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const settings = yield* deps.serverSettings.getSettings.pipe(Effect.orDie);
      return yield* runThreadSweep(
        {
          now,
          threads: deps.threadManagement.getShellSnapshot({ location: "active" }).pipe(
            Effect.map((snapshot) => snapshot.threads.map(toSweepThread)),
            Effect.orDie,
          ),
          readItems: (threadId, afterPosition) =>
            deps.threadManagement
              .getTimelinePage(threadId as ThreadId, {
                view: "messages",
                afterPosition,
                limit: TAIL_ITEMS,
              })
              .pipe(
                Effect.map((page) => page.items),
                Effect.orElseSucceed(() => []),
              ),
          assess: (transcript) =>
            deps.textGeneration.assessThread
              ? deps.textGeneration
                  .assessThread({
                    cwd: input.cwd,
                    transcript,
                    want: "class",
                    modelSelection: settings.textGenerationModelSelection,
                  })
                  .pipe(
                    Effect.map(({ verdict, reason }) => ({ verdict, reason })),
                    Effect.tapError((error) =>
                      Effect.logWarning("thread sweep model call failed", error),
                    ),
                    Effect.orElseSucceed(() => null),
                  )
              : Effect.succeed(null),
        },
        { idleMinutes: input.idleMinutes },
      );
    });
}

/** The handoff handler: reads the end of one chat and asks the user's text-generation model for a prompt. */
export function makeThreadHandoff(deps: {
  readonly threadManagement: ThreadManagementService.ThreadManagementService["Service"];
  readonly textGeneration: TextGeneration["Service"];
  readonly serverSettings: ServerSettings.ServerSettingsService["Service"];
}) {
  return (input: ThreadHandoffInput) =>
    Effect.gen(function* () {
      const settings = yield* deps.serverSettings.getSettings.pipe(Effect.orDie);
      return yield* runThreadHandoff(
        {
          readItems: (threadId) =>
            deps.threadManagement.getThreadShell(threadId as ThreadId).pipe(
              Effect.flatMap((shell) =>
                shell === null
                  ? Effect.succeed([])
                  : deps.threadManagement
                      .getTimelinePage(threadId as ThreadId, {
                        view: "messages",
                        afterPosition: Math.max(
                          -1,
                          shell.visibleItemCount - HANDOFF_ITEM_WINDOW - 1,
                        ),
                        limit: HANDOFF_ITEM_WINDOW,
                      })
                      .pipe(Effect.map((page) => page.items)),
              ),
              Effect.orElseSucceed(() => []),
            ),
          write: (transcript) =>
            deps.textGeneration.assessThread
              ? deps.textGeneration
                  .assessThread({
                    cwd: input.cwd,
                    transcript,
                    want: "handoff",
                    modelSelection: settings.textGenerationModelSelection,
                  })
                  .pipe(
                    Effect.map((answer) => answer.handoff ?? null),
                    Effect.tapError((error) =>
                      Effect.logWarning("thread sweep model call failed", error),
                    ),
                    Effect.orElseSucceed(() => null),
                  )
              : Effect.succeed(null),
        },
        input.threadId,
      );
    });
}
