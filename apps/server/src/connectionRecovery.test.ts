// @effect-diagnostics nodeBuiltinImport:off - Isolated transport fixtures need ephemeral loopback listeners.
import * as NodeHttp from "node:http";
import { NodeWS, layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { describe, expect, it } from "@effect/vitest";
import {
  DEFAULT_SERVER_SETTINGS,
  EnvironmentId,
  ServerConfig,
  WS_METHODS,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as References from "effect/References";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";

import * as Connectivity from "../../../packages/client-runtime/src/connection/connectivity.ts";
import * as ConnectionDriver from "../../../packages/client-runtime/src/connection/driver.ts";
import * as ConnectionResolver from "../../../packages/client-runtime/src/connection/resolver.ts";
import { PrimaryConnectionTarget } from "../../../packages/client-runtime/src/connection/model.ts";
import * as Supervisor from "../../../packages/client-runtime/src/connection/supervisor.ts";
import * as Wakeups from "../../../packages/client-runtime/src/connection/wakeups.ts";
import * as RpcSession from "../../../packages/client-runtime/src/rpc/session.ts";

const environmentId = EnvironmentId.make("socket-recovery-test");
const config: ServerConfig = {
  environment: {
    environmentId,
    label: "Socket recovery fixture",
    platform: { os: "windows", arch: "x64" },
    serverVersion: "0.0.0-test",
    capabilities: { repositoryIdentity: true, connectionProbe: true },
  },
  auth: {
    policy: "loopback-browser",
    bootstrapMethods: ["one-time-token"],
    sessionMethods: ["browser-session-cookie", "bearer-access-token"],
    sessionCookieName: "test_session",
  },
  cwd: "/fixture/workspace",
  keybindingsConfigPath: "/fixture/keybindings.json",
  keybindings: [],
  issues: [],
  providers: [],
  availableEditors: [],
  observability: {
    logsDirectoryPath: "/fixture/logs",
    localTracingEnabled: false,
    otlpTracesEnabled: false,
    otlpMetricsEnabled: false,
    otlpLogsEnabled: false,
  },
  settings: DEFAULT_SERVER_SETTINGS,
};
const encodeConfig = Schema.encodeSync(ServerConfig);
const decodeJson = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown));
const decodeRequest = Schema.decodeUnknownOption(
  Schema.TaggedStruct("Request", {
    id: Schema.Union([Schema.String, Schema.Number]),
    tag: Schema.String,
    payload: Schema.Unknown,
  }),
);
const isPing = Schema.is(Schema.TaggedStruct("Ping", {}));

const openServer = Effect.acquireRelease(
  Effect.callback<NodeWS.WebSocketServer>((resume) => {
    const server = new NodeWS.WebSocketServer({ host: "127.0.0.1", port: 0 });
    server.once("listening", () => resume(Effect.succeed(server)));
    server.once("error", (error) => resume(Effect.die(error)));
  }),
  (server) =>
    Effect.promise(
      () =>
        new Promise<void>((resolve) => {
          for (const client of server.clients) client.terminate();
          server.close(() => resolve());
        }),
    ),
);

describe("real socket connection recovery", () => {
  it.live("checks real HTTP descriptors without credentials and rejects another environment", () =>
    Effect.scoped(
      Effect.gen(function* () {
        let advertisedEnvironmentId = environmentId;
        const requests: Array<{ path: string | undefined; authorization: string | undefined }> = [];
        const server = yield* Effect.acquireRelease(
          Effect.callback<NodeHttp.Server>((resume) => {
            const listener = NodeHttp.createServer((request, response) => {
              requests.push({ path: request.url, authorization: request.headers.authorization });
              response.writeHead(200, { "content-type": "application/json" });
              response.end(
                JSON.stringify({ ...config.environment, environmentId: advertisedEnvironmentId }),
              );
            });
            listener.once("error", (error) => resume(Effect.die(error)));
            listener.listen(0, "127.0.0.1", () => resume(Effect.succeed(listener)));
          }),
          (listener) =>
            Effect.promise(
              () =>
                new Promise<void>((resolve) => {
                  listener.closeAllConnections();
                  listener.close(() => resolve());
                }),
            ),
        );
        const address = server.address();
        if (address === null || typeof address === "string") {
          return yield* Effect.die(new Error("Expected an ephemeral HTTP port"));
        }
        const target = new PrimaryConnectionTarget({
          environmentId,
          label: config.environment.label,
          httpBaseUrl: `http://127.0.0.1:${address.port}/`,
          wsBaseUrl: `ws://127.0.0.1:${address.port}/`,
        });
        const entry = { target, profile: Option.none(), enabled: true };
        const driver = yield* ConnectionDriver.make.pipe(
          Effect.provide(FetchHttpClient.layer),
          Effect.provideService(ConnectionResolver.ConnectionResolver, {
            prepare: () => Effect.die(new Error("Reachability must not prepare credentials")),
            prepareForUpdate: () => Effect.die(new Error("Reachability must not prepare updates")),
          }),
          Effect.provideService(RpcSession.RpcSessionFactory, {
            connect: () => Effect.die(new Error("Reachability must not open a socket")),
          }),
        );
        expect(yield* driver.checkRoute(entry, entry)).toBe("answered");
        advertisedEnvironmentId = EnvironmentId.make("another-environment");
        expect(yield* driver.checkRoute(entry, entry)).toBe("silent");
        expect(requests).toEqual([
          { path: "/.well-known/t3/environment", authorization: undefined },
          { path: "/.well-known/t3/environment", authorization: undefined },
        ]);
      }),
    ),
  );

  it.live("reconnects, resubscribes and probes after an abrupt peer disconnect", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const server = yield* openServer;
        const peers = yield* Queue.unbounded<NodeWS.WebSocket>();
        const subscriptions: string[] = [];
        server.on("connection", (peer) => {
          peer.on("message", (data) => {
            const message = decodeJson(data.toString());
            if (isPing(message)) {
              peer.send(JSON.stringify({ _tag: "Pong" }));
              return;
            }
            const request = decodeRequest(message);
            if (Option.isNone(request)) return;
            if (request.value.tag === WS_METHODS.subscribeServerConfig) {
              subscriptions.push(request.value.tag);
              peer.send(
                JSON.stringify({
                  _tag: "Chunk",
                  requestId: request.value.id,
                  values: [{ version: 1, type: "snapshot", config: encodeConfig(config) }],
                }),
              );
            } else if (request.value.tag === WS_METHODS.serverProbe) {
              peer.send(
                JSON.stringify({
                  _tag: "Exit",
                  requestId: request.value.id,
                  exit: { _tag: "Success", value: {} },
                }),
              );
            }
          });
          Queue.offerUnsafe(peers, peer);
        });
        const address = server.address();
        if (address === null || typeof address === "string") {
          return yield* Effect.die(new Error("Expected an ephemeral TCP port"));
        }
        const target = new PrimaryConnectionTarget({
          environmentId,
          label: config.environment.label,
          httpBaseUrl: `http://127.0.0.1:${address.port}/`,
          wsBaseUrl: `ws://127.0.0.1:${address.port}/`,
        });
        const entry = { target, profile: Option.none(), enabled: true };
        const prepared = {
          environmentId,
          label: target.label,
          httpBaseUrl: target.httpBaseUrl,
          socketUrl: target.wsBaseUrl,
          httpAuthorization: null,
          target,
        };
        const factory = yield* RpcSession.make().pipe(Effect.provide(layerWebSocketConstructorWS));
        const dependencies = Layer.mergeAll(
          Connectivity.layer({ status: Effect.succeed("online"), changes: Stream.never }),
          Wakeups.layer({ changes: Stream.never }),
          Layer.succeed(ConnectionDriver.ConnectionDriver, {
            connect: (savedEntry) =>
              ConnectionDriver.connectOverRoutes(
                savedEntry,
                () => Effect.succeed("unchecked"),
                () =>
                  Effect.gen(function* () {
                    const session = yield* factory.connect(prepared);
                    yield* session.ready;
                    return { prepared, session };
                  }),
              ),
            checkRoute: () => Effect.succeed("unchecked"),
            preflight: () => Effect.succeed(false),
          }),
        );
        const started = performance.now();
        const supervisor = yield* Supervisor.make(entry, { initiallyDesired: true }).pipe(
          Effect.provide(dependencies),
        );
        const connected = (generation: number) =>
          SubscriptionRef.changes(supervisor.state).pipe(
            Stream.filter((state) => state.phase === "connected" && state.generation >= generation),
            Stream.runHead,
            Effect.map(Option.getOrThrow),
          );
        yield* connected(1);
        const initialConnectMs = performance.now() - started;
        const firstSession = Option.getOrThrow(yield* SubscriptionRef.get(supervisor.session));
        yield* firstSession.probe;
        const firstPeer = yield* Queue.take(peers);
        const disconnected = performance.now();
        firstPeer.terminate();
        yield* connected(2);
        const reconnectMs = performance.now() - disconnected;
        const secondSession = Option.getOrThrow(yield* SubscriptionRef.get(supervisor.session));
        expect(secondSession).not.toBe(firstSession);
        yield* secondSession.probe;
        expect((yield* secondSession.initialConfig).environment.environmentId).toBe(environmentId);
        expect(subscriptions).toHaveLength(2);
        const secondPeer = yield* Queue.take(peers);
        const peerClosed = Effect.callback<void>((resume) => {
          secondPeer.once("close", () => resume(Effect.void));
        });
        const closed = yield* Effect.forkChild(peerClosed);
        yield* supervisor.disconnect;
        yield* SubscriptionRef.changes(supervisor.state).pipe(
          Stream.filter((state) => state.phase === "available"),
          Stream.runHead,
        );
        yield* Fiber.join(closed);
        expect(Option.isNone(yield* SubscriptionRef.get(supervisor.session))).toBe(true);
        expect(server.clients.size).toBe(0);
        yield* Effect.logInfo("connectionRecovery.loopback", {
          initialConnectMs,
          reconnectMs,
        }).pipe(
          Effect.provide(Logger.layer([Logger.consoleLogFmt])),
          Effect.provideService(References.MinimumLogLevel, "Info"),
        );
      }),
    ),
  );
});
