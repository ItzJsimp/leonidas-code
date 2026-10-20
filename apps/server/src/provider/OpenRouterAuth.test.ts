// @effect-diagnostics globalFetchInEffect:off - the tests call the real loopback listener.
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import { ProviderInstanceId, type ProviderAuthState } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";

import {
  buildOpenRouterAuthorizationUrl,
  makeOpenRouterAuth,
  openRouterPkcePair,
} from "./OpenRouterAuth.ts";

const instanceId = ProviderInstanceId.make("openrouter");

const makeHarness = Effect.gen(function* () {
  const saved: Array<string> = [];
  const exchanged: Array<{ code: string; verifier: string }> = [];
  const controller = yield* makeOpenRouterAuth({
    instanceId,
    saveKey: (key) => Effect.sync(() => void saved.push(key)),
    removeKey: Effect.sync(() => void saved.push("<removed>")),
    exchangeCode: (code, verifier) =>
      Effect.sync(() => {
        exchanged.push({ code, verifier });
        return "sk-or-test-key";
      }),
  });
  const phase = (phase: ProviderAuthState["phase"]) =>
    controller.subscribe("owner").pipe(
      Stream.filter((state) => state.phase === phase),
      Stream.runHead,
      Effect.map(Option.getOrThrow),
    );
  const browserUrl = controller.subscribe("owner").pipe(
    Stream.filter((state) => state.interaction?.type === "browser"),
    Stream.runHead,
    Effect.map((state) => {
      const interaction = Option.getOrThrow(state).interaction;
      return new URL(interaction?.type === "browser" ? interaction.url : "");
    }),
  );
  return { controller, phase, browserUrl, saved, exchanged };
});

it("builds a PKCE pair whose challenge is the S256 hash of the verifier", () => {
  const pair = openRouterPkcePair();
  assert.match(pair.verifier, /^[A-Za-z0-9_-]{43,}$/);
  assert.notStrictEqual(pair.challenge, pair.verifier);
  const url = new URL(buildOpenRouterAuthorizationUrl("http://127.0.0.1:5000/cb", pair.challenge));
  assert.strictEqual(url.origin + url.pathname, "https://openrouter.ai/auth");
  assert.strictEqual(url.searchParams.get("callback_url"), "http://127.0.0.1:5000/cb");
  assert.strictEqual(url.searchParams.get("code_challenge"), pair.challenge);
  assert.strictEqual(url.searchParams.get("code_challenge_method"), "S256");
});

it.live("signs in through the local callback and saves the returned key", () =>
  Effect.gen(function* () {
    const { controller, phase, browserUrl, saved, exchanged } = yield* makeHarness;
    yield* controller.start("owner");
    const callback = new URL((yield* browserUrl).searchParams.get("callback_url")!);
    assert.strictEqual(callback.hostname, "127.0.0.1");

    const wrongPath = yield* Effect.promise(() =>
      fetch(new URL("/other?code=bad", callback.origin)),
    );
    assert.strictEqual(wrongPath.status, 404);

    callback.searchParams.set("code", "auth-code-1");
    const page = yield* Effect.promise(() => fetch(callback));
    assert.strictEqual(page.status, 200);

    yield* phase("succeeded");
    assert.deepStrictEqual(saved, ["sk-or-test-key"]);
    assert.strictEqual(exchanged[0]?.code, "auth-code-1");
    assert.match(exchanged[0]?.verifier ?? "", /^[A-Za-z0-9_-]{43,}$/);
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);

it.live("fails with a plain message and saves nothing when OpenRouter returns no code", () =>
  Effect.gen(function* () {
    const { controller, phase, browserUrl, saved } = yield* makeHarness;
    yield* controller.start("owner");
    const callback = new URL((yield* browserUrl).searchParams.get("callback_url")!);
    yield* Effect.promise(() => fetch(callback));
    const failed = yield* phase("failed");
    assert.match(failed.message ?? "", /OpenRouter/);
    assert.deepStrictEqual(saved, []);
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);
