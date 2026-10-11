import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { HttpClient, HttpClientResponse } from "effect/http";

import { fetchOpenRouterModels, OPENROUTER_FREE_MODEL } from "./openRouterModelCatalog.ts";

describe("fetchOpenRouterModels", () => {
  it("loads tool-capable models and current token prices from the keyed catalog", async () => {
    const requests: Array<{ url: URL; authorization: string | undefined }> = [];
    const http = HttpClient.make((request) =>
      Effect.sync(() => {
        requests.push({
          url: new URL(request.url),
          authorization: request.headers.authorization,
        });
        return HttpClientResponse.fromWeb(
          request,
          Response.json({
            data: [
              {
                id: "deepseek/deepseek-v4.1-flash-20260910",
                name: "DeepSeek V4.1 Flash",
                supported_parameters: ["tools"],
                context_length: 128_000,
                pricing: { prompt: "0.00000025", completion: "0.000001" },
              },
              {
                id: "provider/no-tools",
                name: "No Tools",
                supported_parameters: [],
                pricing: { prompt: "0", completion: "0" },
              },
            ],
          }),
        );
      }),
    );

    const models = await Effect.runPromise(
      fetchOpenRouterModels("openrouter-secret", "https://openrouter.ai/api/v1/", undefined).pipe(
        Effect.provideService(HttpClient.HttpClient, http),
      ),
    );

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url.pathname).toBe("/api/v1/models");
    expect(requests[0]?.url.searchParams.get("supported_parameters")).toBe("tools");
    expect(requests[0]?.url.searchParams.get("output_modalities")).toBe("text");
    expect(requests[0]?.authorization).toBe("Bearer openrouter-secret");
    expect(models.map((model) => model.slug)).toEqual([
      OPENROUTER_FREE_MODEL,
      "deepseek/deepseek-v4.1-flash-20260910",
    ]);
    expect(models[0]).toMatchObject({
      name: "OpenRouter Free Model Router",
      isDefault: true,
      inputCostPerMillionTokens: 0,
      outputCostPerMillionTokens: 0,
    });
    expect(models[1]).toMatchObject({
      name: "DeepSeek V4.1 Flash",
      contextWindowTokens: 128_000,
      inputCostPerMillionTokens: 0.25,
      outputCostPerMillionTokens: 1,
    });
  });
});
