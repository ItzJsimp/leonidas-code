import * as Effect from "effect/Effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { describe, expect, it } from "@effect/vitest";

import { testApiKey } from "./testApiKey.ts";

const settings = { groqApiKey: "gsk_saved", artificialAnalysisApiKey: "" };

const run = (
  input: Parameters<typeof testApiKey>[0],
  respond: (headers: Record<string, string>) => Response | "offline",
) => {
  const calls: Array<Record<string, string>> = [];
  const client = HttpClient.make((request) => {
    calls.push({ ...request.headers });
    const result = respond(request.headers);
    return result === "offline"
      ? Effect.die("offline")
      : Effect.succeed(HttpClientResponse.fromWeb(request, result));
  });
  return testApiKey(input).pipe(
    Effect.provideService(HttpClient.HttpClient, client),
    Effect.map((result) => ({ result, calls })),
  );
};

describe("testApiKey", () => {
  it.effect("shows a plain error for a wrong key and never echoes it", () =>
    Effect.gen(function* () {
      const { result } = yield* run(
        { providerId: "groq", key: "gsk_wrong_secret", settings },
        () => new Response(null, { status: 401 }),
      );
      expect(result.ok).toBe(false);
      expect(result.message).toContain("did not accept");
      expect(result.message).not.toContain("gsk_wrong_secret");
    }),
  );

  it.effect("tests the saved key when no key is typed", () =>
    Effect.gen(function* () {
      const { result, calls } = yield* run(
        { providerId: "groq", settings },
        () => new Response(null, { status: 200 }),
      );
      expect(result.ok).toBe(true);
      expect(calls[0]?.authorization).toBe("Bearer gsk_saved");
    }),
  );

  it.effect("asks for a key when none is saved or typed", () =>
    Effect.gen(function* () {
      const { result, calls } = yield* run(
        { providerId: "artificialAnalysis", settings },
        () => new Response(null, { status: 200 }),
      );
      expect(result.ok).toBe(false);
      expect(calls).toHaveLength(0);
    }),
  );

  it.effect("reports a network failure in plain words", () =>
    Effect.gen(function* () {
      const { result } = yield* run({ providerId: "groq", key: "k", settings }, () => "offline");
      expect(result.message).toContain("Check your internet");
    }),
  );

  it.effect("rejects an unknown service", () =>
    Effect.gen(function* () {
      const { result } = yield* run(
        { providerId: "nope", key: "k", settings },
        () => new Response(null, { status: 200 }),
      );
      expect(result.ok).toBe(false);
    }),
  );
});
