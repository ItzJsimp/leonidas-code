import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { vi } from "vite-plus/test";
import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import * as ServerConfig from "../config.ts";
import * as Keys from "./VoiceKeyStore.ts";

const state = vi.hoisted(() => ({
  values: new Map<string, string>(),
  fail: false,
  settingsKey: undefined as string | undefined,
}));
// Settings > API keys stores its Groq key here as "groq-api-key".
const settingsSecrets = ServerSecretStore.ServerSecretStore.of({
  get: (name) =>
    Effect.succeed(
      name === "groq-api-key" && state.settingsKey !== undefined
        ? Option.some(new TextEncoder().encode(state.settingsKey))
        : Option.none(),
    ),
  set: () => Effect.void,
  create: () => Effect.void,
  getOrCreateRandom: () => Effect.succeed(new Uint8Array()),
  remove: () => Effect.void,
});
vi.mock("@napi-rs/keyring", () => ({
  AsyncEntry: class {
    readonly service: string;
    readonly account: string;
    constructor(service: string, account: string) {
      this.service = service;
      this.account = account;
    }
    // The old per-install entry maps to one "legacy" slot, whatever its account.
    get key() {
      return this.service === "Leonidas Code voice" ? "legacy" : `${this.service}/${this.account}`;
    }
    async getPassword() {
      if (state.fail) throw new Error("vault unavailable");
      return state.values.get(this.key);
    }
    async setPassword(value: string) {
      state.values.set(this.key, value);
    }
    async deleteCredential() {
      return state.values.delete(this.key);
    }
  },
}));
const make = () =>
  Keys.VoiceKeyStore.pipe(
    Effect.provide(
      Keys.layer.pipe(
        Layer.provide(ServerConfig.layerTest(process.cwd(), { prefix: "voice-vault-" })),
        Layer.provide(NodeServices.layer),
        Layer.provide(Layer.succeed(ServerSecretStore.ServerSecretStore, settingsSecrets)),
      ),
    ),
  );

it.effect("shares one key with the Scribe engine across installs", () =>
  Effect.gen(function* () {
    state.fail = false;
    state.values.clear();
    const first = yield* make();
    const second = yield* make();
    expect(Option.isNone(yield* first.get)).toBe(true);
    yield* first.set("synthetic-key");
    expect(Option.getOrNull(yield* second.get)).toBe("synthetic-key");
    expect([...state.values.keys()]).toEqual(["leonidas-scribe/groq"]);
    yield* first.remove;
    expect(state.values.size).toBe(0);
  }),
);
it.effect("moves the Settings > API keys Groq key to the shared entry", () =>
  Effect.gen(function* () {
    state.fail = false;
    state.values.clear();
    state.settingsKey = " settings-key ";
    const store = yield* make();
    expect(Option.getOrNull(yield* store.get)).toBe("settings-key");
    expect(state.values.get("leonidas-scribe/groq")).toBe("settings-key");
    state.settingsKey = undefined;
  }),
);
it.effect("moves an old voice key to the shared entry, and remove clears both", () =>
  Effect.gen(function* () {
    state.fail = false;
    state.values.clear();
    state.values.set("legacy", "old-key");
    const store = yield* make();
    expect(Option.getOrNull(yield* store.get)).toBe("old-key");
    expect(state.values.get("leonidas-scribe/groq")).toBe("old-key");
    yield* store.remove;
    expect(state.values.size).toBe(0);
  }),
);
it.effect("reports a locked vault as a storage error", () =>
  Effect.gen(function* () {
    state.fail = true;
    try {
      const store = yield* make();
      expect(yield* Effect.flip(store.get)).toMatchObject({ reason: "storage_error" });
    } finally {
      state.fail = false;
    }
  }),
);
