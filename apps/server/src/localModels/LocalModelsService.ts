// @effect-diagnostics nodeBuiltinImport:off - The model folder path needs the real file system.
/**
 * Local models service: the Effect wrapper around the plain `LocalModelsEngine`.
 * It turns the engine into RPC methods and a live state stream for the Models tab.
 * The stream polls Ollama only while a client is subscribed.
 */
import {
  LocalModelsError,
  type LocalModelsActionResult,
  type LocalModelsModelInput,
  type LocalModelsPullInput,
  type LocalModelsState,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PubSub from "effect/PubSub";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import * as HardwareWatch from "../hardwareWatch/HardwareWatch.ts";
import { computeLocalModelCapacity } from "../hardwareWatch/localModelCapacity.ts";
import { DEFAULT_OLLAMA_URL } from "../provider/ollamaModelCatalog.ts";
import { LocalModelsEngine, type LocalModelsHardware } from "./LocalModelsEngine.ts";

/** Poll rate while a download runs, and while the tab is open and idle. */
const PULLING_POLL_MS = 2_000;
const IDLE_POLL_MS = 15_000;

export class LocalModelsService extends Context.Service<
  LocalModelsService,
  {
    readonly subscribe: Stream.Stream<LocalModelsState, LocalModelsError>;
    readonly pull: (
      input: LocalModelsPullInput,
    ) => Effect.Effect<LocalModelsActionResult, LocalModelsError>;
    readonly cancelPull: (
      input: LocalModelsModelInput,
    ) => Effect.Effect<LocalModelsActionResult, LocalModelsError>;
    readonly run: (
      input: LocalModelsModelInput,
    ) => Effect.Effect<LocalModelsActionResult, LocalModelsError>;
    readonly stop: (
      input: LocalModelsModelInput,
    ) => Effect.Effect<LocalModelsActionResult, LocalModelsError>;
    readonly remove: (
      input: LocalModelsModelInput,
    ) => Effect.Effect<LocalModelsActionResult, LocalModelsError>;
  }
>()("t3/localModels/LocalModelsService") {}

/** The folder Ollama keeps models in, with junctions resolved. Null when it does not exist. */
const resolveModelDir = (): string | null => {
  const configured = process.env["OLLAMA_MODELS"];
  const dir = configured ? configured : NodePath.join(NodeOS.homedir(), ".ollama", "models");
  try {
    return NodeFS.realpathSync(dir);
  } catch {
    return null;
  }
};

const isLocalModelsError = Schema.is(LocalModelsError);

const make = Effect.gen(function* () {
  const hardwareWatch = yield* HardwareWatch.HardwareWatch;
  const changes = yield* PubSub.sliding<void>(1);
  let hardware: LocalModelsHardware | null = null;

  const readHardware = Effect.gen(function* () {
    const sample = yield* hardwareWatch.latestSample;
    if (sample === null) return;
    const capacity = computeLocalModelCapacity({
      cpuThreads: NodeOS.cpus().length,
      memory: sample.memory,
      gpus: sample.gpus.map((gpu) => ({
        name: gpu.name,
        vendor: null,
        vramTotalBytes: gpu.vramTotalBytes,
        vramUsedBytes: gpu.vramUsedBytes,
      })),
      volumes: sample.volumes,
    });
    hardware = {
      capacity,
      volumes: sample.volumes.map((volume) => ({
        mount: volume.mount,
        mediaType: volume.mediaType,
        freeBytes: Math.max(0, volume.totalBytes - volume.usedBytes),
      })),
    };
  });

  const engine = new LocalModelsEngine({
    baseUrl: () => DEFAULT_OLLAMA_URL,
    fetch: globalThis.fetch,
    hardware: () => hardware,
    modelDir: resolveModelDir,
    onChange: () => {
      PubSub.publishUnsafe(changes, undefined);
    },
    now: () => Math.round(performance.timeOrigin + performance.now()),
  });

  const refresh = Effect.andThen(
    readHardware,
    Effect.promise(() => engine.refresh()),
  );
  const snapshot = Effect.andThen(
    readHardware,
    Effect.sync(() => engine.snapshot()),
  );

  const subscribe: Stream.Stream<LocalModelsState, LocalModelsError> = Stream.unwrap(
    Effect.gen(function* () {
      yield* refresh;
      // The poll adapts: fast while a download runs, slow otherwise.
      const polling = Stream.fromEffectRepeat(
        Effect.andThen(
          Effect.suspend(() => Effect.sleep(engine.pulling ? PULLING_POLL_MS : IDLE_POLL_MS)),
          refresh,
        ),
      ).pipe(Stream.drain);
      const updates = Stream.concat(
        Stream.fromEffect(snapshot),
        Stream.fromPubSub(changes).pipe(Stream.mapEffect(() => snapshot)),
      );
      return Stream.merge(updates, polling);
    }),
  );

  const asError = (cause: unknown): LocalModelsError =>
    isLocalModelsError(cause)
      ? cause
      : new LocalModelsError({
          reason: "ollama_down",
          detail: cause instanceof Error ? cause.message : String(cause),
        });

  const action = (run: () => unknown) =>
    Effect.tryPromise({
      try: async () => {
        await run();
        return { ok: true } as const;
      },
      catch: asError,
    });

  return LocalModelsService.of({
    subscribe,
    pull: (input) =>
      Effect.try({
        // The download runs in the background. Only the start is checked here.
        try: () => {
          void engine.pull(input.model, input.confirmed === true);
          return { ok: true } as const;
        },
        catch: asError,
      }),
    cancelPull: (input) => action(() => engine.cancelPull(input.model)),
    run: (input) => action(() => engine.run(input.model)),
    stop: (input) => action(() => engine.stop(input.model)),
    remove: (input) => action(() => engine.remove(input.model)),
  });
});

export const layer = Layer.effect(LocalModelsService, make);
