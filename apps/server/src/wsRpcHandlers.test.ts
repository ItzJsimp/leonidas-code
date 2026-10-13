import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { Rpc, RpcClient, RpcGroup, RpcServer } from "effect/rpc";

import { makeHandlerContext, type HandlerMap } from "./wsRpcHandlers.ts";

class Greeting extends Context.Service<Greeting, { readonly value: string }>()(
  "t3/wsRpcHandlers.test/Greeting",
) {}
const group = RpcGroup.make(
  Rpc.make("read", { success: Schema.String }),
  Rpc.make("subscribe", { success: Schema.String, stream: true }),
  Rpc.make("fail", { success: Schema.Void, error: Schema.String }),
);
type TestRpcs = RpcGroup.Rpcs<typeof group>;

describe("WebSocket RPC handler registration", () => {
  it.effect("captures services for unary and streaming requests and preserves typed failures", () =>
    Effect.gen(function* () {
      const handlers: HandlerMap<TestRpcs, Greeting> = {
        read: () => Effect.map(Greeting, ({ value }) => value),
        subscribe: () => Stream.fromEffect(Effect.map(Greeting, ({ value }) => value)),
        fail: () => Effect.flatMap(Greeting, () => Effect.fail("expected failure")),
      };
      // The service is available only at registration, not when the requests execute.
      const context = yield* makeHandlerContext<TestRpcs, Greeting>(group, handlers).pipe(
        Effect.provideService(Greeting, { value: "captured greeting" }),
      );
      let client!: Effect.Success<
        ReturnType<typeof RpcClient.makeNoSerialization<TestRpcs, never>>
      >;
      const server = yield* RpcServer.makeNoSerialization(group, {
        onFromServer: (response) => client.write(response),
      }).pipe(Effect.provideContext(context));
      client = yield* RpcClient.makeNoSerialization(group, {
        supportsAck: true,
        onFromClient: ({ message }) => server.write(0, message),
      });

      assert.equal(yield* client.client.read(), "captured greeting");
      assert.deepEqual(Array.from(yield* Stream.runCollect(client.client.subscribe())), [
        "captured greeting",
      ]);
      const failed = yield* Effect.exit(client.client.fail());
      assert.isTrue(Exit.isFailure(failed));
      if (Exit.isFailure(failed)) assert.equal(Cause.squash(failed.cause), "expected failure");
    }).pipe(Effect.scoped),
  );
});
