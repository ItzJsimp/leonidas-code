import type { ServerProviderModel } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { HttpClient, HttpClientRequest } from "effect/http";

export const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";

const tagsUrl = (baseUrl: string) => `${baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "")}/api/tags`;

const OllamaTagsResponse = Schema.Struct({
  models: Schema.Array(Schema.Unknown),
});

export class OllamaModelCatalogError extends Schema.TaggedError<OllamaModelCatalogError>()(
  "OllamaModelCatalogError",
  { status: Schema.Int },
) {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Embedding models cannot chat, so they stay out of the picker. */
export function isEmbeddingModel(name: string, family: unknown): boolean {
  if (/embed/i.test(name)) return true;
  return typeof family === "string" && /bert/i.test(family);
}

function formatSize(bytes: unknown): string | undefined {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return undefined;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function decodeOllamaModel(value: unknown): ServerProviderModel | undefined {
  if (!isRecord(value)) return undefined;
  const slug = typeof value["model"] === "string" ? value["model"] : value["name"];
  if (typeof slug !== "string" || slug.trim().length === 0) return undefined;
  const details = isRecord(value["details"]) ? value["details"] : undefined;
  if (isEmbeddingModel(slug, details?.["family"])) return undefined;
  const size = formatSize(value["size"]);
  const parameters =
    typeof details?.["parameter_size"] === "string" ? details["parameter_size"] : "";
  const hint = [parameters, size].filter(Boolean).join(" · ");
  return {
    slug,
    name: hint ? `${slug} (${hint})` : slug,
    shortName: slug,
    isCustom: false,
    capabilities: null,
    // Local models cost no money per token.
    inputCostPerMillionTokens: 0,
    outputCostPerMillionTokens: 0,
  };
}

export const fetchOllamaModels = Effect.fn("fetchOllamaModels")(function* (baseUrl: string) {
  const http = yield* HttpClient.HttpClient;
  const response = yield* http.execute(HttpClientRequest.get(tagsUrl(baseUrl)));
  if (response.status !== 200) {
    return yield* new OllamaModelCatalogError({ status: response.status });
  }
  const result = yield* response.json.pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(OllamaTagsResponse)),
  );
  const models = result.models.flatMap((model) => {
    const decoded = decodeOllamaModel(model);
    return decoded ? [decoded] : [];
  });
  return models.map((model, index) => (index === 0 ? { ...model, isDefault: true } : model));
}, Effect.timeout("5 seconds"));
