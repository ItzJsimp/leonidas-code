import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { VOICE_MAX_AUDIO_BYTES } from "@t3tools/contracts";
import * as Voice from "./VoiceDictation.ts";
import * as Keys from "./VoiceKeyStore.ts";

const key = `gsk_${"a".repeat(40)}`;
const input = {
  audioBase64: Buffer.alloc(1024, 1).toString("base64"),
  mimeType: "audio/webm",
  polish: true,
};
function service(
  fetch: (url: string, init: RequestInit) => Promise<Response>,
  initial: string | null = key,
) {
  let stored = Option.fromNullishOr(initial);
  return Voice.VoiceDictation.pipe(
    Effect.provide(
      Voice.layerWithHttp.pipe(
        Layer.provide(
          Layer.mergeAll(
            Layer.succeed(Voice.GroqHttp, { fetch }),
            Layer.succeed(Keys.VoiceKeyStore, {
              get: Effect.sync(() => stored),
              set: (value) =>
                Effect.sync(() => {
                  stored = Option.some(value);
                }),
              remove: Effect.sync(() => {
                stored = Option.none();
              }),
            }),
          ),
        ),
      ),
    ),
  );
}

describe("composer voice service", () => {
  it.effect("validates before storing and removes a saved key", () =>
    Effect.gen(function* () {
      const voice = yield* service(async () => new Response(null, { status: 401 }), null);
      expect(yield* Effect.flip(voice.setGroqKey(key))).toMatchObject({
        reason: "invalid_key",
      });
      expect(yield* voice.status).toEqual({ keyConfigured: false, keyHint: null });
      const valid = yield* service(async () => Response.json({ data: [] }), null);
      expect((yield* valid.setGroqKey(key)).keyConfigured).toBe(true);
      expect(yield* valid.clearGroqKey).toEqual({
        keyConfigured: false,
        keyHint: null,
      });
    }),
  );
  it.effect("keeps ten complete transcripts and uses the user's key", () =>
    Effect.gen(function* () {
      let takes = 0;
      const voice = yield* service(async (url, init) => {
        expect(new Headers(init.headers).get("Authorization")).toBe(`Bearer ${key}`);
        if (url.endsWith("/audio/transcriptions"))
          return Response.json({ text: `please fix the build number ${++takes}` });
        return Response.json({
          choices: [{ message: { content: `Please fix the build number ${takes}.` } }],
        });
      });
      for (let take = 1; take <= 10; take++) {
        const result = yield* voice.transcribe(input);
        expect(result.text).toBe(`Please fix the build number ${take}.`);
        expect(result.rawText).toBe(`please fix the build number ${take}`);
        expect(result.polished).toBe(true);
      }
    }),
  );
  it.effect("keeps raw words when cleanup fails", () =>
    Effect.gen(function* () {
      const voice = yield* service(async (url) =>
        url.endsWith("/audio/transcriptions")
          ? Response.json({ text: "can you please explain this error" })
          : new Response(null, { status: 429 }),
      );
      const result = yield* voice.transcribe(input);
      expect(result.text).toBe("can you please explain this error");
      expect(result.polished).toBe(false);
    }),
  );
  it.effect("rejects invalid audio before making a provider request", () =>
    Effect.gen(function* () {
      const voice = yield* service(async () => {
        throw new Error("must not call");
      });
      for (const audioBase64 of [
        "%%%",
        Buffer.alloc(VOICE_MAX_AUDIO_BYTES + 1).toString("base64"),
      ]) {
        expect(yield* Effect.flip(voice.transcribe({ ...input, audioBase64 }))).toHaveProperty(
          "reason",
        );
      }
    }),
  );
  it.effect("reports rate limits without leaking provider text", () =>
    Effect.gen(function* () {
      const voice = yield* service(
        async () => new Response("secret provider body", { status: 429 }),
      );
      expect(yield* Effect.flip(voice.transcribe(input))).toMatchObject({
        reason: "rate_limited",
      });
    }),
  );
});
