// @effect-diagnostics nodeBuiltinImport:off - The lock test needs a real temp directory.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Scope from "effect/Scope";

import { makeStoreOwnerLock } from "./StoreOwner.ts";

const withTempDir = <A, E, R>(use: (dir: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.sync(() => NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "store-owner-"))),
    use,
    (dir) => Effect.sync(() => NodeFS.rmSync(dir, { recursive: true, force: true })),
  );

it.live("lets only one scheduler own a task store at a time", () =>
  withTempDir((dir) =>
    Effect.gen(function* () {
      const lockPath = NodePath.join(dir, "scheduled-tasks.owner");
      const scopeA = yield* Scope.make();
      const scopeB = yield* Scope.make();
      const first = yield* makeStoreOwnerLock(lockPath).pipe(Scope.provide(scopeA));
      const second = yield* makeStoreOwnerLock(lockPath).pipe(Scope.provide(scopeB));

      assert.isTrue(yield* first);
      assert.isFalse(yield* second);
      // Ownership is sticky: the owner keeps it on later ticks.
      assert.isTrue(yield* first);

      yield* Scope.close(scopeA, { _tag: "Success", value: undefined } as never);
      assert.isTrue(yield* second);
      yield* Scope.close(scopeB, { _tag: "Success", value: undefined } as never);
    }),
  ),
);

it.live("always owns the store when there is no lock path", () =>
  Effect.gen(function* () {
    const scope = yield* Scope.make();
    const owner = yield* makeStoreOwnerLock(undefined).pipe(Scope.provide(scope));
    assert.isTrue(yield* owner);
    yield* Scope.close(scope, { _tag: "Success", value: undefined } as never);
  }),
);
