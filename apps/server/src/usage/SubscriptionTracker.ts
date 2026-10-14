// @effect-diagnostics nodeBuiltinImport:off - hashes opaque account identities without persisting email addresses.
import * as NodeCrypto from "node:crypto";
import { UsageDay, type ServerProvider } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { writeFileStringAtomically } from "@t3tools/shared/atomicWrite";
import {
  forecastWindowUsedPercentAtReset,
  type UsageObservationPoint,
} from "@t3tools/shared/usageForecast";
import { UsageService } from "./UsageService.ts";
import { SubscriptionLedger, advanceSubscriptionWindow } from "./subscriptionTracking.ts";

const OPENROUTER_TOKEN_CACHE_MS = 60_000;

const formatTokens = (count: number): string =>
  count >= 1_000_000
    ? `${(count / 1_000_000).toFixed(1)}M`
    : count >= 1_000
      ? `${Math.round(count / 1_000)}K`
      : String(count);

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const encodeLedger = Schema.encodeSync(Schema.fromJsonString(SubscriptionLedger));
const ObservationLine = Schema.Struct({
  accountKey: Schema.String,
  checkedAt: Schema.String,
  windows: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      usedPercent: Schema.Number,
      resetsAt: Schema.optional(Schema.String),
    }),
  ),
});
const decodeObservationLine = Schema.decodeUnknownOption(Schema.fromJsonString(ObservationLine));

/** Persisted server-owned calibration, shared by all clients and agent snapshots. */
export const makeSubscriptionTracker = Effect.fn("makeSubscriptionTracker")(function* (
  cacheDir: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const usage = yield* Effect.serviceOption(UsageService);
  const reader = Option.isSome(usage) ? usage.value.readSubscriptionTokens : undefined;
  const mutex = yield* Semaphore.make(1);
  const ledgerPath = path.join(cacheDir, "subscription-calibration.json");
  const raw = yield* fs.readFileString(ledgerPath).pipe(Effect.orElseSucceed(() => "{}"));
  const decode = Schema.decodeUnknownOption(Schema.fromJsonString(SubscriptionLedger));
  let ledger: SubscriptionLedger = Option.getOrElse(decode(raw), () => ({}));

  const observationsPath = path.join(cacheDir, "subscription-observations.jsonl");
  const rawObservations = yield* fs
    .readFileString(observationsPath)
    .pipe(Effect.orElseSucceed(() => ""));
  const historyByAccountAndWindow = new Map<string, UsageObservationPoint[]>();
  for (const line of rawObservations.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const decoded = decodeObservationLine(trimmed);
    if (Option.isNone(decoded)) continue;
    const parsed = decoded.value;
    const checkedAtMs = Date.parse(parsed.checkedAt);
    if (!Number.isFinite(checkedAtMs)) continue;
    for (const win of parsed.windows) {
      const key = parsed.accountKey + ":" + win.id;
      let list = historyByAccountAndWindow.get(key);
      if (!list) {
        list = [];
        historyByAccountAndWindow.set(key, list);
      }
      list.push({
        checkedAt: checkedAtMs,
        usedPercent: win.usedPercent,
        resetsAt: win.resetsAt,
      });
    }
  }

  const readSummary = Option.isSome(usage) ? usage.value.readSummary : undefined;
  let tokenCache: { readonly at: number; readonly tokens: number } | undefined;
  /** OpenRouter has no windows to calibrate, so its card gets a plain recent token count. */
  const withOpenRouterTokens = (provider: ServerProvider): Effect.Effect<ServerProvider> => {
    const limits = provider.usageLimits;
    if (!readSummary || provider.driver !== "openrouter" || !limits || limits.unavailable)
      return Effect.succeed(provider);
    const tokens = Effect.flatMap(DateTime.now, (nowTime) => {
      const now = DateTime.toEpochMillis(nowTime);
      if (tokenCache && now - tokenCache.at < OPENROUTER_TOKEN_CACHE_MS)
        return Effect.succeed(tokenCache.tokens);
      const day = (epochMs: number) =>
        UsageDay.make(DateTime.formatIso(DateTime.makeUnsafe(epochMs)).slice(0, 10));
      return readSummary({
        sinceDay: day(now - 29 * 86_400_000),
        untilDay: day(now),
        timeZone: "UTC",
      }).pipe(
        Effect.map((summary) =>
          summary.buckets.reduce(
            (sum, { provider: source, totals }) =>
              source === "openrouter"
                ? sum +
                  totals.uncachedInputTokens +
                  totals.cachedInputTokens +
                  totals.cacheCreationTokens +
                  totals.outputTokens
                : sum,
            0,
          ),
        ),
        Effect.tap((total) =>
          Effect.sync(() => {
            tokenCache = { at: now, tokens: total };
          }),
        ),
      );
    });
    return tokens.pipe(
      Effect.map((total) => ({
        ...provider,
        usageLimits: {
          ...limits,
          windows: limits.windows.map((window) =>
            window.id === "openrouter_credits"
              ? { ...window, label: `${window.label} · ${formatTokens(total)} tokens (30d)` }
              : window,
          ),
        },
      })),
      Effect.orElseSucceed(() => provider),
    );
  };

  return (provider: ServerProvider) =>
    withOpenRouterTokens(provider).pipe(Effect.flatMap(trackWindows));

  function trackWindows(provider: ServerProvider) {
    return mutex.withPermit(
      Effect.gen(function* () {
        const limits = provider.usageLimits;
        if (!reader || !limits || limits.unavailable || limits.windows.length === 0)
          return provider;
        const identity = provider.auth.email?.trim().toLowerCase() || limits.credentialFingerprint;
        const accountKey = NodeCrypto.createHash("sha256")
          .update(encodeJson([provider.driver, identity, provider.auth.label]))
          .digest("hex");
        const saved =
          identity && ledger[provider.instanceId]?.accountKey === accountKey
            ? ledger[provider.instanceId]
            : undefined;
        const at = Date.parse(limits.checkedAt);
        let sourceKey = saved?.sourceKey ?? "";
        let windows = { ...saved?.windows };
        let sourceChanged = false;
        const enriched = yield* Effect.forEach(limits.windows, (window) =>
          Effect.gen(function* () {
            let previous = saved?.windows[window.id];
            const observation =
              identity && previous && at > previous.checkedAt
                ? yield* reader(provider.instanceId, previous.checkedAt, at).pipe(
                    Effect.orElseSucceed(() => null),
                  )
                : null;
            if (observation) {
              const nextSource = NodeCrypto.createHash("sha256")
                .update(observation.sourceKey)
                .digest("hex");
              if (saved?.sourceKey && saved.sourceKey !== nextSource) {
                previous = undefined;
                if (!sourceChanged) windows = {};
                sourceChanged = true;
              }
              sourceKey = nextSource;
            }
            const result = advanceSubscriptionWindow(
              previous,
              window,
              at,
              observation?.totals ?? null,
            );
            windows[window.id] = result.state;
            const historyKey = accountKey + ":" + window.id;
            const history = historyByAccountAndWindow.get(historyKey);
            const forecast = forecastWindowUsedPercentAtReset(window, at, history);
            const projectedUsedPercentAtReset =
              forecast !== null ? Math.round(forecast * 10) / 10 : undefined;
            let historyList = historyByAccountAndWindow.get(historyKey);
            if (!historyList) {
              historyList = [];
              historyByAccountAndWindow.set(historyKey, historyList);
            }
            historyList.push({
              checkedAt: at,
              usedPercent: window.usedPercent,
              resetsAt: window.resetsAt,
            });
            if (historyList.length > 500) {
              historyList.shift();
            }
            return {
              ...window,
              ...(projectedUsedPercentAtReset !== undefined ? { projectedUsedPercentAtReset } : {}),
              tokenEstimate: !identity
                ? {
                    ...result.estimate,
                    status: "unavailable" as const,
                    message: "An account identity is required to attribute tokens.",
                  }
                : result.estimate,
            };
          }),
        );
        const next = { ...ledger, [provider.instanceId]: { accountKey, sourceKey, windows } };
        if (encodeJson(next) !== encodeJson(ledger)) {
          yield* fs.makeDirectory(cacheDir, { recursive: true });
          yield* writeFileStringAtomically({
            filePath: ledgerPath,
            contents: encodeLedger(next),
          }).pipe(
            Effect.provideService(FileSystem.FileSystem, fs),
            Effect.provideService(Path.Path, path),
          );
          ledger = next;
          yield* fs.writeFileString(
            path.join(cacheDir, "subscription-observations.jsonl"),
            encodeJson({
              instanceId: provider.instanceId,
              accountKey,
              checkedAt: limits.checkedAt,
              windows: enriched.map(
                ({ id, usedPercent, resetsAt, tokenEstimate, projectedUsedPercentAtReset }) => ({
                  id,
                  usedPercent,
                  resetsAt,
                  tokenEstimate,
                  ...(projectedUsedPercentAtReset !== undefined
                    ? { projectedUsedPercentAtReset }
                    : {}),
                }),
              ),
            }) + "\n",
            { flag: "a" },
          );
        }
        return { ...provider, usageLimits: { ...limits, windows: enriched } };
      }).pipe(
        Effect.tapError(Effect.logWarning),
        Effect.orElseSucceed(() => provider),
      ),
    );
  }
});
