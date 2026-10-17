// @effect-diagnostics nodeBuiltinImport:off - The owner lock coordinates Node server processes.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import { lock } from "proper-lockfile";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import type * as Scope from "effect/Scope";

import * as ServerConfig from "../config.ts";

/**
 * Answers "may this process fire due scheduled tasks?". The default is yes, so
 * in-memory stores and tests need no lock. The production server provides a
 * file lock so a desktop server and a boot-service server that share one task
 * store never fire the same run twice.
 */
export class ScheduledTaskStoreOwner extends Context.Reference<Effect.Effect<boolean>>(
  "t3/scheduledTasks/ScheduledTaskStoreOwner",
  { defaultValue: () => Effect.succeed(true) },
) {}

/** Production wiring: one owner lock per server state directory, shared by every server on it. */
export const layer = Layer.effect(
  ScheduledTaskStoreOwner,
  Effect.gen(function* () {
    const { stateDir } = yield* ServerConfig.ServerConfig;
    return yield* makeStoreOwnerLock(NodePath.join(stateDir, "scheduled-tasks.owner"));
  }),
);

/** A dead owner stops refreshing its lock, so another server takes over after this long. */
const STALE_MS = 15_000;
const UPDATE_MS = 5_000;

/**
 * Builds the owner check for one store. The first call that wins the lock keeps
 * it until the scope closes; a server that loses retries on its next tick, so
 * it takes over when the owner exits or dies. `undefined` means no shared store.
 */
export const makeStoreOwnerLock = (
  lockPath: string | undefined,
): Effect.Effect<Effect.Effect<boolean>, never, Scope.Scope> =>
  Effect.gen(function* () {
    if (lockPath === undefined) return Effect.succeed(true);
    const release = yield* Ref.make<(() => Promise<void>) | null>(null);
    yield* Effect.addFinalizer(() =>
      Ref.getAndSet(release, null).pipe(
        Effect.flatMap((held) =>
          held === null ? Effect.void : Effect.promise(() => held()).pipe(Effect.ignore),
        ),
      ),
    );
    return Effect.gen(function* () {
      if ((yield* Ref.get(release)) !== null) return true;
      // `null` means another server holds the lock. Any other failure is a
      // defect, logged below; the server then stays a non-owner this tick.
      const acquired = yield* Effect.promise(async () => {
        NodeFS.mkdirSync(NodePath.dirname(lockPath), { recursive: true });
        try {
          return await lock(lockPath, {
            realpath: false,
            stale: STALE_MS,
            update: UPDATE_MS,
            retries: 0,
            // A stolen or lost lock means another server may now own the store.
            onCompromised: () => {
              Effect.runFork(Ref.set(release, null));
            },
          });
        } catch (error) {
          if ((error as { readonly code?: string }).code === "ELOCKED") return null;
          throw error;
        }
      });
      if (acquired === null) return false;
      yield* Ref.set(release, acquired);
      return true;
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.logWarning("Could not check scheduled task store ownership", { cause }).pipe(
          Effect.as(false),
        ),
      ),
    );
  });
