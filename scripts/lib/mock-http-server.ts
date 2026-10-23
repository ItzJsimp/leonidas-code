import * as NodeClusterHttp from "@effect/platform-node/NodeClusterHttp";
import * as NodeHttpServerRequest from "@effect/platform-node/NodeHttpServerRequest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Scope from "effect/Scope";
import { RunnerAddress } from "effect/cluster/RunnerAddress";
import * as ShardingConfig from "effect/cluster/ShardingConfig";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";

export type MockRequest = ReturnType<typeof NodeHttpServerRequest.toIncomingMessage>;
export type MockResponse = ReturnType<typeof NodeHttpServerRequest.toServerResponse>;

export async function startMockHttpServer(
  port: number,
  handle: (request: MockRequest, response: MockResponse) => void | Promise<void>,
) {
  const scope = Scope.makeUnsafe();
  try {
    // This platform layer owns the Node server factory and supports fixed or ephemeral ports.
    const layer = NodeClusterHttp.layerHttpServer.pipe(
      Layer.provide(
        ShardingConfig.layer({
          runnerListenAddress: Option.some(new RunnerAddress({ host: "127.0.0.1", port })),
        }),
      ),
    );
    const context = await Effect.runPromise(Layer.buildWithScope(layer, scope));
    const server = Context.get(context, HttpServer.HttpServer);
    const app = Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const response = NodeHttpServerRequest.toServerResponse(request);
      yield* Effect.callback<void>((resume) => {
        const finished = () => resume(Effect.void);
        response.once("finish", finished);
        response.once("close", finished);
        Promise.resolve()
          .then(() => handle(NodeHttpServerRequest.toIncomingMessage(request), response))
          .catch(() => {
            if (!response.headersSent) response.writeHead(500);
            response.end();
          });
        return Effect.sync(() => {
          response.off("finish", finished);
          response.off("close", finished);
        });
      });
      return HttpServerResponse.empty();
    });
    await Effect.runPromise(server.serve(app).pipe(Effect.provideService(Scope.Scope, scope)));
    if (server.address._tag === "UnixPathAddress") throw new Error("Expected a TCP server");
    return {
      port: server.address.port,
      close: () => Effect.runPromise(Scope.close(scope, Exit.void)),
    };
  } catch (error) {
    await Effect.runPromise(Scope.close(scope, Exit.void));
    throw error;
  }
}
