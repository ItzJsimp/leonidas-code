// @effect-diagnostics nodeBuiltinImport:off - hashes opaque account identities without persisting email addresses.
import * as NodeCrypto from "node:crypto";
import type { ServerProvider } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { writeFileStringAtomically } from "@t3tools/shared/atomicWrite";
import { UsageService } from "./UsageService.ts";
import { SubscriptionLedger, advanceSubscriptionWindow } from "./subscriptionTracking.ts";

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const encodeLedger = Schema.encodeSync(Schema.fromJsonString(SubscriptionLedger));

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

  return (provider: ServerProvider) =>
    mutex.withPermit(
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
            return {
              ...window,
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
              windows: enriched.map(({ id, usedPercent, resetsAt, tokenEstimate }) => ({
                id,
                usedPercent,
                resetsAt,
                tokenEstimate,
              })),
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
});
