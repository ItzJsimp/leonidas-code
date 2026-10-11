import type { ServerProviderModel } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { HttpClient, HttpClientRequest } from "effect/http";

import * as ModelCatalog from "@t3tools/provider-core/server/ModelCatalog";

export const OPENROUTER_FREE_MODEL = "openrouter/free";

const modelListUrl = (baseUrl: string) =>
  `${baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1/models?` +
  "supported_parameters=tools&output_modalities=text&sort=pricing-low-to-high";

const OpenRouterModelListResponse = Schema.Struct({
  data: Schema.Array(Schema.Unknown),
});

export class OpenRouterModelCatalogError extends Schema.TaggedError<OpenRouterModelCatalogError>()(
  "OpenRouterModelCatalogError",
  { status: Schema.Int },
) {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pricePerMillionTokens(value: unknown): number | undefined {
  const dollarsPerToken =
    typeof value === "string" && value.trim().length > 0 ? Number(value) : value;
  if (
    typeof dollarsPerToken !== "number" ||
    !Number.isFinite(dollarsPerToken) ||
    dollarsPerToken < 0
  ) {
    return undefined;
  }
  const price = dollarsPerToken * 1_000_000;
  return Number.isFinite(price) ? price : undefined;
}

function staticModels(catalog: ModelCatalog.ProviderCatalog | undefined): ServerProviderModel[] {
  const fallback = catalog
    ? catalog.models.map((model) => ModelCatalog.catalogServerModel(catalog, model))
    : [];
  if (!fallback.some((model) => model.slug === OPENROUTER_FREE_MODEL)) {
    fallback.unshift({
      slug: OPENROUTER_FREE_MODEL,
      name: "OpenRouter Free Model Router",
      shortName: "Free Router",
      isCustom: false,
      isDefault: true,
      capabilities: null,
      inputCostPerMillionTokens: 0,
      outputCostPerMillionTokens: 0,
    });
  }
  return fallback.map((model) => ({
    ...model,
    ...(model.slug === OPENROUTER_FREE_MODEL
      ? {
          isDefault: true,
          inputCostPerMillionTokens: model.inputCostPerMillionTokens ?? 0,
          outputCostPerMillionTokens: model.outputCostPerMillionTokens ?? 0,
        }
      : { isDefault: undefined }),
  }));
}

function decodeOpenRouterModel(
  value: unknown,
  knownModels: ReadonlyMap<string, ServerProviderModel>,
): ServerProviderModel | undefined {
  if (!isRecord(value)) return undefined;
  const slug = value["id"];
  const name = value["name"];
  const supportedParameters = value["supported_parameters"];
  if (
    typeof slug !== "string" ||
    slug.trim().length === 0 ||
    typeof name !== "string" ||
    !Array.isArray(supportedParameters) ||
    !supportedParameters.includes("tools")
  ) {
    return undefined;
  }

  const known = knownModels.get(slug);
  const pricing = isRecord(value["pricing"]) ? value["pricing"] : undefined;
  const contextLength = value["context_length"];
  const inputCostPerMillionTokens = pricePerMillionTokens(pricing?.["prompt"]);
  const outputCostPerMillionTokens = pricePerMillionTokens(pricing?.["completion"]);
  return {
    ...(known ?? {}),
    slug,
    name: slug === OPENROUTER_FREE_MODEL ? "OpenRouter Free Model Router" : name,
    isCustom: false,
    capabilities: known?.capabilities ?? null,
    ...(Number.isSafeInteger(contextLength) && (contextLength as number) > 0
      ? { contextWindowTokens: contextLength as number }
      : {}),
    ...(inputCostPerMillionTokens !== undefined ? { inputCostPerMillionTokens } : {}),
    ...(outputCostPerMillionTokens !== undefined ? { outputCostPerMillionTokens } : {}),
  };
}

export const bundledOpenRouterModels = (
  catalog: ModelCatalog.ProviderCatalog | undefined,
): ReadonlyArray<ServerProviderModel> => staticModels(catalog);

export const fetchOpenRouterModels = Effect.fn("fetchOpenRouterModels")(function* (
  apiKey: string,
  baseUrl: string,
  catalog: ModelCatalog.ProviderCatalog | undefined,
) {
  const http = yield* HttpClient.HttpClient;
  const response = yield* http.execute(
    HttpClientRequest.get(modelListUrl(baseUrl)).pipe(HttpClientRequest.bearerToken(apiKey)),
  );
  if (response.status !== 200) {
    return yield* new OpenRouterModelCatalogError({ status: response.status });
  }

  const result = yield* response.json.pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(OpenRouterModelListResponse)),
  );
  const bundled = staticModels(catalog);
  const knownModels = new Map(bundled.map((model) => [model.slug, model]));
  const discovered = result.data.flatMap((model) => {
    const decoded = decodeOpenRouterModel(model, knownModels);
    return decoded ? [decoded] : [];
  });

  if (discovered.length === 0) return bundled;

  if (!discovered.some((model) => model.slug === OPENROUTER_FREE_MODEL)) {
    discovered.unshift(knownModels.get(OPENROUTER_FREE_MODEL)!);
  }
  return discovered.map((model) => ({
    ...model,
    ...(model.slug === OPENROUTER_FREE_MODEL ? { isDefault: true } : { isDefault: undefined }),
  }));
}, Effect.timeout("15 seconds"));
