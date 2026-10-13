import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import type * as Rpc from "effect/rpc/Rpc";
import type * as RpcGroup from "effect/rpc/RpcGroup";

export type HandlerMap<Rpcs extends Rpc.Any, Services> = {
  readonly [Current in Rpcs as Current["_tag"]]: Rpc.ToHandlerFn<Current, Services>;
};

type HandlerEntries<Rpcs extends Rpc.Any> = {
  readonly [Tag in Rpcs["_tag"]]: Rpc.Handler<Tag>;
}[Rpcs["_tag"]];

// RpcGroup.toHandlers repeatedly distributes the full RPC union to infer requirements.
// The large WebSocket group exceeds the compiler's depth limit. Check requirements at
// the handler map instead, then use the same registration and context capture algorithm.
export const makeHandlerContext = <Rpcs extends Rpc.Any, Services>(
  group: RpcGroup.RpcGroup<Rpcs>,
  handlers: HandlerMap<Rpcs, Services>,
): Effect.Effect<Context.Context<HandlerEntries<Rpcs>>, never, Services> =>
  Effect.gen(function* () {
    const context = yield* Effect.context<Services>();
    const entries = new Map<string, unknown>();
    for (const rpc of group.requests.values()) {
      const tag: Rpcs["_tag"] = rpc._tag;
      entries.set(rpc.key, { tag, handler: handlers[tag], context });
    }
    return Context.makeUnsafe<HandlerEntries<Rpcs>>(entries);
  });
