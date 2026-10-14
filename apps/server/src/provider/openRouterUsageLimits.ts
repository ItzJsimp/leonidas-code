import type { ServerProviderUsageLimits, ServerProviderUsageWindow } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";

import {
  clampPercent,
  makeUnavailableUsageLimits,
  makeUsageLimits,
} from "@t3tools/provider-core/server/usageLimits";

const CreditsResponse = Schema.Struct({
  data: Schema.Struct({ total_credits: Schema.Finite, total_usage: Schema.Finite }),
});
const KeyResponse = Schema.Struct({
  data: Schema.Struct({
    usage: Schema.Finite,
    limit: Schema.NullOr(Schema.Finite),
    limit_remaining: Schema.NullOr(Schema.Finite),
  }),
});

const formatUsd = (value: number): string => `$${Math.max(0, value).toFixed(2)}`;

/** OpenRouter has no 5-hour or weekly windows; its quota is prepaid credit and an optional per-key cap. */
export function openRouterLimitsFromBalances(input: {
  readonly checkedAt: string;
  readonly credits: { readonly totalCredits: number; readonly totalUsage: number } | undefined;
  readonly key:
    | { readonly usage: number; readonly limit: number | null; readonly remaining: number | null }
    | undefined;
}): ServerProviderUsageLimits {
  const windows: ServerProviderUsageWindow[] = [];
  if (input.credits) {
    const { totalCredits, totalUsage } = input.credits;
    windows.push({
      id: "openrouter_credits",
      kind: "other",
      label: `Credits · ${formatUsd(totalCredits - totalUsage)} left`,
      usedPercent: totalCredits > 0 ? clampPercent((totalUsage / totalCredits) * 100) : 100,
    });
  }
  if (input.key?.limit && input.key.limit > 0) {
    const remaining = input.key.remaining ?? input.key.limit - input.key.usage;
    windows.push({
      id: "openrouter_key_limit",
      kind: "other",
      label: `Key cap · ${formatUsd(remaining)} left`,
      usedPercent: clampPercent((input.key.usage / input.key.limit) * 100),
    });
  }
  if (windows.length === 0) {
    return makeUnavailableUsageLimits({
      checkedAt: input.checkedAt,
      reason: "probeFailed",
      message: "OpenRouter did not return a credit balance. Try Refresh.",
    });
  }
  return makeUsageLimits({ checkedAt: input.checkedAt, windows });
}

const readJson = <A, I>(
  client: HttpClient.HttpClient,
  url: string,
  apiKey: string,
  schema: Schema.Codec<A, I>,
) =>
  client
    .execute(HttpClientRequest.get(url).pipe(HttpClientRequest.bearerToken(apiKey)))
    .pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
      Effect.timeout("5 seconds"),
      Effect.option,
    );

export const readOpenRouterUsageLimits = Effect.fn("readOpenRouterUsageLimits")(function* (input: {
  readonly apiKey: string;
  readonly baseUrl: string;
}) {
  const checkedAt = DateTime.formatIso(yield* DateTime.now);
  if (!input.apiKey) {
    return makeUnavailableUsageLimits({
      checkedAt,
      reason: "unsupported",
      message: "Add an OpenRouter API key to see your credit balance.",
    });
  }
  const client = yield* HttpClient.HttpClient;
  const base = `${input.baseUrl.replace(/\/+$/, "")}/v1`;
  const [credits, key] = yield* Effect.all(
    [
      readJson(client, `${base}/credits`, input.apiKey, CreditsResponse),
      readJson(client, `${base}/key`, input.apiKey, KeyResponse),
    ],
    { concurrency: 2 },
  );
  return openRouterLimitsFromBalances({
    checkedAt,
    credits:
      credits._tag === "Some"
        ? {
            totalCredits: credits.value.data.total_credits,
            totalUsage: credits.value.data.total_usage,
          }
        : undefined,
    key:
      key._tag === "Some"
        ? {
            usage: key.value.data.usage,
            limit: key.value.data.limit,
            remaining: key.value.data.limit_remaining,
          }
        : undefined,
  });
});
