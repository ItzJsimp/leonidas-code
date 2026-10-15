import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { vi } from "vite-plus/test";
import * as ServerConfig from "../config.ts";
import * as Keys from "./VoiceKeyStore.ts";

const state = vi.hoisted(() => ({ values: new Map<string, string>(), fail: false }));
vi.mock("@napi-rs/keyring", () => ({
  AsyncEntry: class {
    constructor(
      readonly service: string,
      readonly account: string,
    ) {}
    async getPassword() {
      if (state.fail) throw new Error("vault unavailable");
      return state.values.get(this.account);
    }
    async setPassword(value: string) {
      state.values.set(this.account, value);
    }
    async deleteCredential() {
      return state.values.delete(this.account);
    }
  },
}));
const make = () =>
  Keys.VoiceKeyStore.pipe(
    Effect.provide(
      Keys.layer.pipe(
        Layer.provide(ServerConfig.layerTest(process.cwd(), { prefix: "voice-vault-" })),
        Layer.provide(NodeServices.layer),
      ),
    ),
  );

it.effect("keeps hosts separate and clears a key without a file fallback", () =>
  Effect.gen(function* () {
    state.fail = false;
    state.values.clear();
    const first = yield* make();
    const second = yield* make();
    expect(Option.isNone(yield* first.get)).toBe(true);
    yield* first.set("synthetic-key");
    expect(Option.getOrNull(yield* first.get)).toBe("synthetic-key");
    expect(Option.isNone(yield* second.get)).toBe(true);
    yield* first.remove;
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
