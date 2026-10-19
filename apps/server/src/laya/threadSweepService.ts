import type { ThreadId, ThreadSweepInput } from "@t3tools/contracts";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";

import * as ThreadManagementService from "../orchestration-v2/ThreadManagementService.ts";
import type * as ServerSettings from "../serverSettings.ts";
import type { TextGeneration } from "../textGeneration/TextGeneration.ts";
import { runThreadSweep } from "./threadSweepRun.ts";

const TAIL_ITEMS = 60;

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
            Effect.map((snapshot) =>
              snapshot.threads.map((thread) => ({
                id: thread.id,
                projectId: thread.projectId,
                title: thread.title,
                updatedAt: String(thread.updatedAt),
                archived: thread.archivedAt !== null,
                settled: thread.settledOverride === "settled",
                pinned: thread.pinnedAt != null,
                status: thread.status,
                hasPendingRequest: thread.pendingRuntimeRequest !== null,
                visibleItemCount: thread.visibleItemCount,
              })),
            ),
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
                    Effect.orElseSucceed(() => null),
                  )
              : Effect.succeed(null),
        },
        { idleMinutes: input.idleMinutes },
      );
    });
}
