/**
 * OllamaDriver: `ProviderDriver` for models that run on this machine through Ollama.
 *
 * Runs the Claude Agent SDK runtime against Ollama's Anthropic-compatible endpoint
 * (ANTHROPIC_BASE_URL=http://127.0.0.1:11434), so local models get the same tools and
 * session flow as the cloud models. The picker lists whatever `/api/tags` reports.
 *
 * @module provider/Drivers/OllamaDriver
 */
import {
  OllamaSettings,
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
import { DEFAULT_OLLAMA_URL, fetchOllamaModels } from "../ollamaModelCatalog.ts";
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

const decodeOllamaSettings = Schema.decodeSync(OllamaSettings);

const DRIVER_KIND = ProviderDriverKind.make("ollama");
const CLAUDE_DRIVER_KIND = ProviderDriverKind.make("claudeAgent");
const CAPABILITIES_PROBE_TTL = Duration.minutes(5);
const OLLAMA_MODEL_CAPABILITIES: ModelCapabilities = { optionDescriptors: [] };

function isOllamaNativeCommandPath(commandPath: string): boolean {
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
    isCommandPath: isOllamaNativeCommandPath,
  },
});

export type OllamaDriverEnv =
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

export const OllamaDriver: ProviderDriver<OllamaSettings, OllamaDriverEnv, Path.Path> = {
  driverKind: DRIVER_KIND,
  metadata: {
    displayName: "Ollama (local)",
    supportsMultipleInstances: true,
  },
  configSchema: OllamaSettings,
  defaultConfig: (): OllamaSettings => decodeOllamaSettings({}),
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

      const effectiveBaseUrl = config.baseUrl.trim() || DEFAULT_OLLAMA_URL;
      const ollamaEnvironment = [
        ...(environment ?? []),
        { name: "ANTHROPIC_BASE_URL", value: effectiveBaseUrl, sensitive: false },
        { name: "ANTHROPIC_AUTH_TOKEN", value: "ollama", sensitive: false },
        { name: "ANTHROPIC_API_KEY", value: "", sensitive: false },
      ];

      const processEnv = yield* mergeProviderInstanceEnvironment(ollamaEnvironment);
      const fallbackContinuationIdentity = defaultProviderContinuationIdentity({
        driverKind: DRIVER_KIND,
        instanceId,
      });

      const effectiveHomePath = config.homePath.trim() || "~/.claude_ollama";
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
        displayName: displayName || "Ollama (local)",
        accentColor,
        continuationGroupKey,
      });

      const scopedLimitNames = yield* makeClaudeScopedLimitNames;
      const orchestrationAdapter = yield* createClaudeAdapterV2(
        {
          instanceId,
          displayName: displayName || "Ollama (local)",
          accentColor,
          environment: ollamaEnvironment,
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
              detail: "Failed to build Ollama orchestration adapter.",
              cause,
            }),
        ),
      );

      // A short TTL so a model that was just pulled shows up in the picker soon.
      const modelDiscoveryCache = yield* Cache.make({
        capacity: 1,
        timeToLive: Duration.seconds(30),
        lookup: (baseUrl: string) =>
          fetchOllamaModels(baseUrl).pipe(
            Effect.map((models) => ({
              models,
              reachable: true as const,
              message:
                models.length === 0
                  ? "Ollama is running but has no chat models. Pull one with `ollama pull`."
                  : undefined,
            })),
            Effect.catchCause(() =>
              Effect.succeed({
                models: [],
                reachable: false as const,
                message: `Ollama is not running at ${baseUrl}. Start it, then refresh.`,
              }),
            ),
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
          claudeModelCatalog.pipe(
            Effect.flatMap((claude) =>
              Cache.get(modelDiscoveryCache, effectiveBaseUrl).pipe(
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
                    Effect.map((providerSnapshot) => ({
                      ...providerSnapshot,
                      status: discovery.reachable ? providerSnapshot.status : ("warning" as const),
                      models: providerModelsFromSettings(
                        discovery.models,
                        claudeCompatibleConfig.customModels,
                        OLLAMA_MODEL_CAPABILITIES,
                      ),
                      updateRequiredModels: [],
                      auth: {
                        status: discovery.reachable
                          ? ("authenticated" as const)
                          : ("unknown" as const),
                      },
                      ...(discovery.message
                        ? { message: discovery.message }
                        : providerSnapshot.message
                          ? { message: providerSnapshot.message }
                          : {}),
                    })),
                  ),
                ),
              ),
            ),
          ),
        ),
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
        Effect.provideService(FileSystem.FileSystem, fileSystem),
        Effect.provideService(Path.Path, path),
        Effect.provideService(HttpClient.HttpClient, httpClient),
      );

      const snapshotSettings = yield* makeProviderSnapshotSettingsSource(claudeCompatibleConfig);
      const snapshot = yield* makeManagedServerProvider<ProviderSnapshotSettings<ClaudeSettings>>({
        resolveMaintenance,
        getSettings: snapshotSettings.getSettings,
        streamSettings: snapshotSettings.streamSettings,
        haveSettingsChanged: haveProviderSnapshotSettingsChanged,
        initialSnapshot: (settings) =>
          claudeModelCatalog.pipe(
            Effect.flatMap((claude) =>
              makePendingClaudeProvider(settings.provider, claude).pipe(
                Effect.map((providerSnapshot) => ({
                  ...providerSnapshot,
                  models: providerModelsFromSettings(
                    [],
                    settings.provider.customModels,
                    OLLAMA_MODEL_CAPABILITIES,
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
            Effect.provideService(ProviderLatestVersions.ProviderLatestVersions, latestVersions),
            Effect.flatMap((enrichedSnapshot) => publishSnapshot(enrichedSnapshot)),
          ),
      }).pipe(
        Effect.mapError(
          (cause) =>
            new ProviderDriverError({
              driver: DRIVER_KIND,
              instanceId,
              detail: `Failed to build Ollama snapshot: ${cause.message ?? String(cause)}`,
              cause,
            }),
        ),
      );

      return {
        instanceId,
        driverKind: DRIVER_KIND,
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
