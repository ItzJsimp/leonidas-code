/**
 * OpenRouterDriver — `ProviderDriver` for the OpenRouter AI provider and router.
 *
 * Runs OpenRouter through the Claude Agent SDK runtime with OpenRouter API
 * endpoints pre-configured (ANTHROPIC_BASE_URL=https://openrouter.ai/api).
 * The picker catalog comes from OpenRouter's tool-capable text model list.
 *
 * @module provider/Drivers/OpenRouterDriver
 */
import {
  OpenRouterSettings,
  ProviderDriverKind,
  type ClaudeSettings,
  type ModelCapabilities,
} from "@t3tools/contracts";
import * as Cache from "effect/Cache";
import * as Duration from "effect/Duration";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import { HttpClient } from "effect/http";
import { ChildProcessSpawner } from "effect/process";

import { makeClaudeTextGeneration } from "../../textGeneration/ClaudeTextGeneration.ts";
import * as ProviderLatestVersions from "@t3tools/provider-core/server/ProviderLatestVersions";
import * as ProviderHost from "@t3tools/provider-core/server/ProviderHost";
import * as ServerConfig from "../../config.ts";
import { expandHomePath } from "@t3tools/provider-core/server/pathExpansion";
import * as ProviderEventLoggers from "@t3tools/provider-core/server/ProviderEventLoggers";
import {
  createClaudeAdapterV2,
  type ClaudeAdapterV2DriverEnv,
} from "../../orchestration-v2/Adapters/ClaudeAdapterV2.ts";
import { ProviderDriverError } from "../Errors.ts";
import { claudeUsageFormat } from "./claudeUsage.ts";
import {
  type ProviderUsageReader,
  type TranscriptUsageFormat,
  type UsageRecord,
} from "@t3tools/provider-core/server/usage";
import { makeClaudeScopedLimitNames } from "../claudeUsageLimits.ts";
import * as ResetCreditCoordinator from "../resetCreditCoordinator.ts";
import {
  checkClaudeProviderStatus,
  makePendingClaudeProvider,
  probeClaudeCapabilities,
  probeClaudeWorkspaceSnapshot,
} from "../ClaudeProvider.ts";
import { makeManagedServerProvider } from "@t3tools/provider-core/server/managedProvider";
import * as ModelCatalog from "@t3tools/provider-core/server/ModelCatalog";
import { providerModelsFromSettings } from "@t3tools/provider-core/server/snapshotProbe";
import { resolveClaudeModelCatalog } from "../ClaudeModelCatalog.ts";
import { readOpenRouterUsageLimits } from "../openRouterUsageLimits.ts";
import {
  exchangeOpenRouterCode,
  makeOpenRouterAuth,
  makeOpenRouterKeyWriter,
} from "../OpenRouterAuth.ts";
import { bundledOpenRouterModels, fetchOpenRouterModels } from "../openRouterModelCatalog.ts";
import {
  defaultProviderContinuationIdentity,
  type ProviderDriver,
  type ProviderInstance,
} from "@t3tools/provider-core/server/driver";
import { withInstanceIdentity } from "@t3tools/provider-core/server/instanceIdentity";
import { mergeProviderInstanceEnvironment } from "@t3tools/provider-core/server/instanceEnvironment";
import {
  enrichProviderSnapshotWithVersionAdvisory,
  makeCachedProviderMaintenanceResolution,
  makePackageManagedProviderMaintenanceResolver,
  normalizeCommandPath,
  resolveProviderMaintenanceCapabilitiesEffect,
} from "@t3tools/provider-core/server/maintenanceResolver";
import {
  haveProviderSnapshotSettingsChanged,
  makeProviderSnapshotSettingsSource,
  type ProviderSnapshotSettings,
} from "@t3tools/provider-core/server/snapshotSettings";
import { makeClaudeCapabilitiesCacheKey, makeClaudeContinuationGroupKey } from "./ClaudeHome.ts";
import * as HostProcess from "@t3tools/shared/HostProcess";

const decodeOpenRouterSettings = Schema.decodeSync(OpenRouterSettings);

const DRIVER_KIND = ProviderDriverKind.make("openrouter");
const CLAUDE_DRIVER_KIND = ProviderDriverKind.make("claudeAgent");
const CAPABILITIES_PROBE_TTL = Duration.minutes(5);
const OPENROUTER_MODEL_CAPABILITIES: ModelCapabilities = { optionDescriptors: [] };

function isOpenRouterNativeCommandPath(commandPath: string): boolean {
  const normalized = normalizeCommandPath(commandPath);
  return (
    normalized.endsWith("/.local/bin/claude") ||
    normalized.endsWith("/.local/bin/claude.exe") ||
    normalized.includes("/.local/share/claude/")
  );
}

const UPDATE = makePackageManagedProviderMaintenanceResolver({
  provider: DRIVER_KIND,
  npmPackageName: "@anthropic-ai/claude-code",
  nativeUpdate: {
    args: ["update"],
    isCommandPath: isOpenRouterNativeCommandPath,
  },
});

const asOpenRouter = (records: readonly UsageRecord[]): readonly UsageRecord[] =>
  records.map((record) => ({ ...record, provider: "openrouter" }));

/** Claude-shaped transcripts, attributed to OpenRouter so they stay out of Claude totals. */
const openRouterUsageFormat: TranscriptUsageFormat<void> = {
  ...claudeUsageFormat,
  parseLine: (line, state) => asOpenRouter(claudeUsageFormat.parseLine(line, state)),
  parseProjected: (projected, state) =>
    asOpenRouter(claudeUsageFormat.parseProjected(projected, state)),
};

const openRouterUsageReader: ProviderUsageReader<OpenRouterSettings, Path.Path> = {
  kind: "transcripts",
  provider: "openrouter",
  format: openRouterUsageFormat,
  directories: Effect.fn("openRouterUsageReader.directories")(function* ({ config, environment }) {
    if (config === undefined) return [];
    const path = yield* Path.Path;
    const homeDirectory = yield* HostProcess.HomeDirectory;
    const configured = config.homePath.trim();
    const home = configured
      ? expandHomePath(configured, homeDirectory)
      : environment.CLAUDE_CONFIG_DIR?.trim() || path.join(homeDirectory, ".claude_openrouter");
    return [{ dir: path.resolve(home, "projects") }];
  }),
};

export type OpenRouterDriverEnv =
  | ClaudeAdapterV2DriverEnv
  | ProviderHost.ProviderHost
  | ChildProcessSpawner.ChildProcessSpawner
  | ResetCreditCoordinator.ResetCreditCoordinator
  | Crypto.Crypto
  | FileSystem.FileSystem
  | HttpClient.HttpClient
  | ProviderLatestVersions.ProviderLatestVersions
  | ModelCatalog.ModelCatalog
  | Path.Path
  | ProviderEventLoggers.ProviderEventLoggers
  | ServerConfig.ServerConfig;

export const OpenRouterDriver: ProviderDriver<OpenRouterSettings, OpenRouterDriverEnv, Path.Path> =
  {
    driverKind: DRIVER_KIND,
    metadata: {
      displayName: "OpenRouter",
      supportsMultipleInstances: true,
    },
    configSchema: OpenRouterSettings,
    defaultConfig: (): OpenRouterSettings => decodeOpenRouterSettings({}),
    usage: openRouterUsageReader,
    create: ({ instanceId, displayName, accentColor, environment, enabled, config }) =>
      Effect.gen(function* () {
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { cwd } = yield* ServerConfig.ServerConfig;
        const httpClient = yield* HttpClient.HttpClient;
        const latestVersions = yield* ProviderLatestVersions.ProviderLatestVersions;
        const resetCreditCoordinator = yield* ResetCreditCoordinator.ResetCreditCoordinator;
        const catalogService = yield* ModelCatalog.ModelCatalog;
        const claudeModelCatalog = catalogService
          .current(CLAUDE_DRIVER_KIND)
          .pipe(Effect.map(resolveClaudeModelCatalog));
        const openRouterModelCatalog = catalogService.current(DRIVER_KIND);

        const effectiveBaseUrl = config.baseUrl.trim() || "https://openrouter.ai/api";
        const effectiveApiKey = config.apiKey.trim();
        const openRouterEnvironment = [
          ...(environment ?? []),
          { name: "ANTHROPIC_BASE_URL", value: effectiveBaseUrl, sensitive: false },
          { name: "ANTHROPIC_AUTH_TOKEN", value: effectiveApiKey, sensitive: true },
          { name: "ANTHROPIC_API_KEY", value: "", sensitive: false },
          { name: "OPENROUTER_API_KEY", value: effectiveApiKey, sensitive: true },
        ];

        const processEnv = yield* mergeProviderInstanceEnvironment(openRouterEnvironment);
        const fallbackContinuationIdentity = defaultProviderContinuationIdentity({
          driverKind: DRIVER_KIND,
          instanceId,
        });

        const effectiveHomePath = config.homePath.trim() || "~/.claude_openrouter";
        const effectiveConfig = {
          ...config,
          enabled,
          homePath: effectiveHomePath,
          binaryPath: expandHomePath(config.binaryPath, yield* HostProcess.HomeDirectory),
        };

        // Convert to Claude-compatible shape for underlying adapter and text-generation
        const claudeCompatibleConfig: ClaudeSettings = {
          ...effectiveConfig,
          autoCompactWindow: "",
        };

        const resolveMaintenance = yield* makeCachedProviderMaintenanceResolution(
          resolveProviderMaintenanceCapabilitiesEffect(UPDATE, {
            binaryPath: effectiveConfig.binaryPath,
            env: processEnv,
          }).pipe(
            Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
            Effect.provideService(FileSystem.FileSystem, fileSystem),
            Effect.provideService(Path.Path, path),
          ),
        );

        const continuationGroupKey = yield* makeClaudeContinuationGroupKey(
          claudeCompatibleConfig,
          processEnv,
        );

        const stampIdentity = withInstanceIdentity({
          instanceId,
          driverKind: DRIVER_KIND,
          displayName: displayName || "OpenRouter",
          accentColor,
          continuationGroupKey,
        });

        const scopedLimitNames = yield* makeClaudeScopedLimitNames;
        const orchestrationAdapter = yield* createClaudeAdapterV2(
          {
            instanceId,
            displayName: displayName || "OpenRouter",
            accentColor,
            environment: openRouterEnvironment,
            enabled,
            config: claudeCompatibleConfig,
          },
          { scopedLimitNames, onUsageLimits: (update) => snapshot.applyUsageLimits(update) },
        ).pipe(
          Effect.mapError(
            (cause) =>
              new ProviderDriverError({
                driver: DRIVER_KIND,
                instanceId,
                detail: "Failed to build OpenRouter orchestration adapter.",
                cause,
              }),
          ),
        );

        const modelDiscoveryCache = yield* Cache.make({
          capacity: 1,
          timeToLive: Duration.minutes(15),
          lookup: (apiKey: string) =>
            openRouterModelCatalog.pipe(
              Effect.flatMap((catalog) => {
                const bundled = bundledOpenRouterModels(catalog);
                return fetchOpenRouterModels(apiKey, effectiveBaseUrl, catalog).pipe(
                  Effect.map((models) => ({
                    models,
                    authStatus: "authenticated" as const,
                    message: undefined,
                  })),
                  Effect.catchTags({
                    OpenRouterModelCatalogError: (error) =>
                      Effect.succeed({
                        models: bundled,
                        authStatus:
                          error.status === 401 || error.status === 403
                            ? ("unauthenticated" as const)
                            : ("unknown" as const),
                        message:
                          error.status === 401 || error.status === 403
                            ? "OpenRouter rejected this API key. Check it in Settings > Providers."
                            : "OpenRouter's model list is unavailable; showing the bundled models.",
                      }),
                  }),
                  Effect.catchCause(() =>
                    Effect.logWarning(
                      "OpenRouter model discovery failed; using its bundled model list.",
                    ).pipe(
                      Effect.as({
                        models: bundled,
                        authStatus: "unknown" as const,
                        message:
                          "Could not refresh OpenRouter's model list; showing the bundled models.",
                      }),
                    ),
                  ),
                );
              }),
            ),
        });

        const textGeneration = yield* makeClaudeTextGeneration(
          claudeCompatibleConfig,
          processEnv,
          claudeModelCatalog,
        );

        const capabilitiesProbeCache = yield* Cache.make({
          capacity: 1,
          timeToLive: CAPABILITIES_PROBE_TTL,
          lookup: () =>
            probeClaudeCapabilities(claudeCompatibleConfig, processEnv, cwd).pipe(
              Effect.provideService(Path.Path, path),
            ),
        });
        const capabilitiesCacheKey = yield* makeClaudeCapabilitiesCacheKey(
          claudeCompatibleConfig,
          cwd,
          processEnv,
        );

        const checkProvider = catalogService.refreshInBackground.pipe(
          Effect.andThen(
            Effect.all({ claude: claudeModelCatalog, openRouter: openRouterModelCatalog }).pipe(
              Effect.flatMap(({ claude, openRouter }) => {
                const discoveredModels = effectiveApiKey
                  ? Cache.get(modelDiscoveryCache, effectiveApiKey)
                  : Effect.succeed({
                      models: bundledOpenRouterModels(openRouter),
                      authStatus: "unauthenticated" as const,
                      message:
                        "OpenRouter API key not set. Add one in Settings > Providers to enable routing.",
                    });
                return discoveredModels.pipe(
                  Effect.flatMap((discovery) =>
                    checkClaudeProviderStatus(
                      claudeCompatibleConfig,
                      () => Cache.get(capabilitiesProbeCache, capabilitiesCacheKey),
                      processEnv,
                      cwd,
                      claude,
                      scopedLimitNames,
                      () => Effect.succeed(undefined),
                    ).pipe(
                      Effect.map(stampIdentity),
                      Effect.flatMap((providerSnapshot) =>
                        effectiveApiKey && discovery.authStatus !== "unauthenticated"
                          ? readOpenRouterUsageLimits({
                              apiKey: effectiveApiKey,
                              baseUrl: effectiveBaseUrl,
                            }).pipe(
                              Effect.map((usageLimits) => ({ ...providerSnapshot, usageLimits })),
                            )
                          : Effect.succeed(providerSnapshot),
                      ),
                      Effect.map((providerSnapshot) => ({
                        ...providerSnapshot,
                        status:
                          discovery.authStatus === "unauthenticated"
                            ? effectiveApiKey
                              ? ("error" as const)
                              : ("warning" as const)
                            : providerSnapshot.status,
                        models: providerModelsFromSettings(
                          discovery.models,
                          claudeCompatibleConfig.customModels,
                          OPENROUTER_MODEL_CAPABILITIES,
                        ),
                        updateRequiredModels: [],
                        auth: { status: discovery.authStatus },
                        ...(discovery.message
                          ? { message: discovery.message }
                          : providerSnapshot.message
                            ? { message: providerSnapshot.message }
                            : {}),
                      })),
                    ),
                  ),
                );
              }),
            ),
          ),
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
          Effect.provideService(FileSystem.FileSystem, fileSystem),
          Effect.provideService(Path.Path, path),
          Effect.provideService(HttpClient.HttpClient, httpClient),
        );

        const snapshotSettings = yield* makeProviderSnapshotSettingsSource(claudeCompatibleConfig);
        const snapshot = yield* makeManagedServerProvider<ProviderSnapshotSettings<ClaudeSettings>>(
          {
            resolveMaintenance,
            getSettings: snapshotSettings.getSettings,
            streamSettings: snapshotSettings.streamSettings,
            haveSettingsChanged: haveProviderSnapshotSettingsChanged,
            initialSnapshot: (settings) =>
              Effect.all({ claude: claudeModelCatalog, openRouter: openRouterModelCatalog }).pipe(
                Effect.flatMap(({ claude, openRouter }) =>
                  makePendingClaudeProvider(settings.provider, claude).pipe(
                    Effect.map((providerSnapshot) => ({
                      ...providerSnapshot,
                      models: providerModelsFromSettings(
                        bundledOpenRouterModels(openRouter),
                        settings.provider.customModels,
                        OPENROUTER_MODEL_CAPABILITIES,
                      ),
                      updateRequiredModels: [],
                    })),
                  ),
                ),
                Effect.map(stampIdentity),
              ),
            checkProvider,
            enrichSnapshot: ({ settings, snapshot, publishSnapshot }) =>
              resolveMaintenance().pipe(
                Effect.flatMap((maintenanceCapabilities) =>
                  enrichProviderSnapshotWithVersionAdvisory(snapshot, maintenanceCapabilities, {
                    enableProviderUpdateChecks: settings.enableProviderUpdateChecks,
                  }),
                ),
                Effect.provideService(HttpClient.HttpClient, httpClient),
                Effect.provideService(
                  ProviderLatestVersions.ProviderLatestVersions,
                  latestVersions,
                ),
                Effect.flatMap((enrichedSnapshot) => publishSnapshot(enrichedSnapshot)),
              ),
          },
        ).pipe(
          Effect.mapError(
            (cause) =>
              new ProviderDriverError({
                driver: DRIVER_KIND,
                instanceId,
                detail: `Failed to build OpenRouter snapshot: ${cause.message ?? String(cause)}`,
                cause,
              }),
          ),
        );

        // One-click sign-in: the key lands in settings, which rebuilds this instance.
        const writeApiKey = yield* makeOpenRouterKeyWriter(instanceId);
        const auth = yield* makeOpenRouterAuth({
          instanceId,
          exchangeCode: (code, verifier) =>
            exchangeOpenRouterCode(instanceId, code, verifier).pipe(
              Effect.provideService(HttpClient.HttpClient, httpClient),
            ),
          saveKey: writeApiKey,
          removeKey: writeApiKey(""),
        });

        return {
          instanceId,
          driverKind: DRIVER_KIND,
          auth,
          continuationIdentity: {
            ...fallbackContinuationIdentity,
            continuationKey: continuationGroupKey,
          },
          displayName,
          accentColor,
          enabled,
          snapshot,
          invalidateCaches: Effect.all(
            [Cache.invalidateAll(capabilitiesProbeCache), Cache.invalidateAll(modelDiscoveryCache)],
            { concurrency: "unbounded", discard: true },
          ),
          snapshotForCwd: (workspaceCwd: string) =>
            snapshot.getSnapshot.pipe(
              Effect.flatMap((machineSnapshot) =>
                probeClaudeWorkspaceSnapshot(
                  claudeCompatibleConfig,
                  machineSnapshot,
                  workspaceCwd,
                  processEnv,
                ),
              ),
              Effect.provideService(FileSystem.FileSystem, fileSystem),
              Effect.provideService(Path.Path, path),
            ),
          orchestrationAdapter,
          textGeneration,
        } satisfies ProviderInstance;
      }),
  };
