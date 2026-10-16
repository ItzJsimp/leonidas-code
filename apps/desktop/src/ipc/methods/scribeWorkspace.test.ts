import { NodeFileSystem, NodePath } from "@effect/platform-node";
import * as HostProcess from "@t3tools/shared/HostProcess";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

import { setScribeWorkspace } from "./scribeWorkspace.ts";

it.effect("publishes a complete local workspace snapshot and clears it for fallback", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const folder = yield* fs.makeTempDirectoryScoped();
    const invoke = (root: unknown) =>
      setScribeWorkspace
        .handler(root)
        .pipe(
          Effect.provideService(HostProcess.Platform, "win32"),
          Effect.provideService(HostProcess.Environment, { LOCALAPPDATA: folder }),
        );
    const workspace = path.join(folder, "project with spaces");
    yield* invoke(workspace);
    const target = path.join(folder, "LeonidasScribe", "code-workspace.json");
    const snapshot = JSON.parse(yield* fs.readFileString(target));
    assert.equal(snapshot.workspaceRoot, workspace);
    assert.isNumber(snapshot.sampledAt);
    assert.isFalse(yield* fs.exists(target + ".tmp"));
    yield* invoke(null);
    assert.isNull(JSON.parse(yield* fs.readFileString(target)).workspaceRoot);
    assert.isTrue(yield* invoke("relative/path").pipe(Effect.isFailure));
    assert.isTrue(yield* invoke({ workspaceRoot: workspace }).pipe(Effect.isFailure));
  }).pipe(Effect.scoped, Effect.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer))),
);
