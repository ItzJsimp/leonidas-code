import type { ServerSettings, TestApiKeyResult } from "@t3tools/contracts";
import { describeKeyTestResult, getApiKeyProvider } from "@t3tools/shared/apiKeyProviders";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { HttpClient, HttpClientRequest } from "effect/http";

const TEST_TIMEOUT_MS = 10_000;

/**
 * Try one provider key with the lightest call that proves it. A blank `key` tests the saved key.
 * The message is plain words and never contains the key.
 */
export const testApiKey = (input: {
  readonly providerId: string;
  readonly key?: string | undefined;
  readonly settings: Pick<ServerSettings, "groqApiKey" | "artificialAnalysisApiKey"> | undefined;
}): Effect.Effect<TestApiKeyResult, never, HttpClient.HttpClient> => {
  const provider = getApiKeyProvider(input.providerId);
  if (!provider) {
    return Effect.succeed({ ok: false, message: "This service is not in the key list." });
  }
  const key = (input.key?.trim() || input.settings?.[provider.settingKey] || "").trim();
  if (key.length === 0) {
    return Effect.succeed({ ok: false, message: "No key to test. Paste a key first." });
  }
  return Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const request = HttpClientRequest.get(provider.test.url).pipe(
      HttpClientRequest.setHeaders(provider.test.headers(key)),
    );
    return yield* client.execute(request).pipe(
      Effect.timeout(Duration.millis(TEST_TIMEOUT_MS)),
      Effect.map((response) => describeKeyTestResult(provider, { status: response.status })),
      Effect.catchCause(() => Effect.succeed(describeKeyTestResult(provider, { status: null }))),
    );
  });
};
