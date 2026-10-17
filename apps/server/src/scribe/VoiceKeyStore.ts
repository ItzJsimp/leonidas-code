import { VoiceError } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
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
    const account = config.secretsDir;
    const entry = () =>
      import("@napi-rs/keyring").then(
        ({ AsyncEntry }) => new AsyncEntry("Leonidas Code voice", account),
      );
    const attempt = <A>(run: () => Promise<A>) =>
      Effect.tryPromise({
        try: run,
        catch: () => new VoiceError({ reason: "storage_error" }),
      });
    return VoiceKeyStore.of({
      get: attempt(async () => Option.fromNullishOr(await (await entry()).getPassword())),
      set: (key) =>
        attempt(async () => {
          await (await entry()).setPassword(key);
        }),
      remove: attempt(async () => {
        const vault = await entry();
        if ((await vault.getPassword()) != null) await vault.deleteCredential();
      }),
    });
  }),
);
