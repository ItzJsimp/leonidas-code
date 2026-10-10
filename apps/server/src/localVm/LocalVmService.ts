import {
  LocalVmError,
  LocalVmAction,
  type LocalVmSession,
  type LocalVmState,
  type LocalVmScreenshotResult,
  type ThreadId,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as LocalVmHost from "./LocalVmHost.ts";

export class LocalVmService extends Context.Service<
  LocalVmService,
  {
    readonly list: Effect.Effect<LocalVmState, LocalVmError>;
    readonly connect: (input: {
      threadId: ThreadId;
      vmId: string;
    }) => Effect.Effect<LocalVmSession, LocalVmError>;
    readonly pause: (input: {
      threadId: ThreadId;
      paused: boolean;
    }) => Effect.Effect<LocalVmSession, LocalVmError>;
    readonly release: (input: { threadId: ThreadId }) => Effect.Effect<void, LocalVmError>;
    readonly screenshot: (input: {
      threadId: ThreadId;
    }) => Effect.Effect<LocalVmScreenshotResult, LocalVmError>;
    readonly input: (input: {
      threadId: ThreadId;
      action: LocalVmAction;
    }) => Effect.Effect<void, LocalVmError>;
  }
>()("t3/localVm/LocalVmService") {}

const decodeAction = Schema.decodeUnknownEffect(LocalVmAction);
const make = Effect.gen(function* () {
  const host = yield* LocalVmHost.LocalVmHost;
  const lock = yield* Semaphore.make(1);
  const sessions = new Map<ThreadId, LocalVmSession>();
  const target = Effect.fnUntraced(function* (threadId: ThreadId) {
    const session = sessions.get(threadId);
    if (!session) return yield* new LocalVmError({ reason: "not-connected" });
    return session;
  });
  const connect = Effect.fn("LocalVmService.connect")(function* (input: {
    threadId: ThreadId;
    vmId: string;
  }) {
    if ([...sessions.values()].some((s) => s.vmId === input.vmId && s.threadId !== input.threadId))
      return yield* new LocalVmError({ reason: "owned" });
    const inventory = yield* host.list;
    if (!inventory.available) return yield* new LocalVmError({ reason: "unavailable" });
    if (!inventory.vms.some((vm) => vm.id === input.vmId && vm.running))
      return yield* new LocalVmError({ reason: "not-running" });
    // Verify the console before replacing an existing grant. Reconnecting cannot clear pause.
    yield* host.screenshot(input.vmId);
    const session = { ...input, paused: sessions.get(input.threadId)?.paused ?? false };
    sessions.set(input.threadId, session);
    return session;
  }, lock.withPermit);
  const pause = Effect.fn("LocalVmService.pause")(function* (input: {
    threadId: ThreadId;
    paused: boolean;
  }) {
    const session = { ...(yield* target(input.threadId)), paused: input.paused };
    sessions.set(input.threadId, session);
    return session;
  }, lock.withPermit);
  const release = (input: { threadId: ThreadId }) =>
    lock.withPermit(
      Effect.sync(() => {
        sessions.delete(input.threadId);
      }),
    );
  const screenshot = Effect.fn("LocalVmService.screenshot")(function* (input: {
    threadId: ThreadId;
  }) {
    const session = yield* target(input.threadId);
    return { session, screenshot: yield* host.screenshot(session.vmId) };
  }, lock.withPermit);
  const input = Effect.fn("LocalVmService.input")(function* (input: {
    threadId: ThreadId;
    action: LocalVmAction;
  }) {
    const session = yield* target(input.threadId);
    if (session.paused) return yield* new LocalVmError({ reason: "paused" });
    const action = yield* decodeAction(input.action).pipe(
      Effect.mapError((cause) => new LocalVmError({ reason: "invalid-input", cause })),
    );
    if ("x" in action) {
      const shot = yield* host.screenshot(session.vmId);
      if (action.x >= shot.width || action.y >= shot.height)
        return yield* new LocalVmError({ reason: "bounds" });
    }
    yield* host.input(session.vmId, action);
  }, lock.withPermit);
  return LocalVmService.of({
    list: host.list.pipe(
      Effect.map((inventory) => ({ ...inventory, sessions: [...sessions.values()] })),
    ),
    connect,
    pause,
    release,
    screenshot,
    input,
  });
});
export const layer = Layer.effect(LocalVmService, make);
