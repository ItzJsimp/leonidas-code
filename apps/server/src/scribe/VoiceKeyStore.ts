import { VoiceError } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import * as ServerConfig from "../config.ts";

/** The OS credential vault owns encryption. No plaintext file fallback. */
export class VoiceKeyStore extends Context.Service<
  VoiceKeyStore,
  {
    readonly get: Effect.Effect<Option.Option<string>, VoiceError>;
    readonly set: (key: string) => Effect.Effect<void, VoiceError>;
    readonly remove: Effect.Effect<void, VoiceError>;
  }
>()("t3/scribe/VoiceKeyStore") {}

export const layer = Layer.effect(
  VoiceKeyStore,
  Effect.gen(function* () {
    const config = yield* ServerConfig.ServerConfig;
    const secretStore = yield* ServerSecretStore.ServerSecretStore;
    // One Groq key for all of Leonidas: the Scribe engine reads this same entry
    // (`services/scribe-engine/src/credentials.rs`), so a key saved once serves voice, dictation and rewrite.
    const entry = () =>
      import("@napi-rs/keyring").then(
        ({ AsyncEntry }) => new AsyncEntry("leonidas-scribe", "groq"),
      );
    // Before 2026-10-28 each install kept its own voice key here.
    const legacy = () =>
      import("@napi-rs/keyring").then(
        ({ AsyncEntry }) => new AsyncEntry("Leonidas Code voice", config.secretsDir),
      );
    const attempt = <A>(run: () => Promise<A>) =>
      Effect.tryPromise({
        try: run,
        catch: () => new VoiceError({ reason: "storage_error" }),
      });
    return VoiceKeyStore.of({
      get: Effect.gen(function* () {
        const vault = yield* attempt(entry);
        const key = yield* attempt(() => vault.getPassword());
        if (key != null) return Option.some(key);
        // Move an old key once, so the user never pastes the same key twice:
        // the old voice entry first, then the key saved in Settings > API keys.
        const old = yield* attempt(async () => (await legacy()).getPassword());
        const saved = yield* secretStore.get("groq-api-key").pipe(
          Effect.map(Option.map((bytes) => new TextDecoder().decode(bytes).trim())),
          Effect.orElseSucceed(() => Option.none<string>()),
        );
        const found = old || Option.getOrUndefined(saved);
        if (!found) return Option.none();
        yield* attempt(() => vault.setPassword(found));
        return Option.some(found);
      }),
      set: (key) =>
        attempt(async () => {
          await (await entry()).setPassword(key);
        }),
      remove: attempt(async () => {
        for (const vault of [await entry(), await legacy()]) {
          if ((await vault.getPassword()) != null) await vault.deleteCredential();
        }
      }),
    });
  }),
);
