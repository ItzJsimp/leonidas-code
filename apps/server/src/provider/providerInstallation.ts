import {
  AntigravitySettings,
  ClaudeSettings,
  CodexSettings,
  ProviderDriverKind,
  type ProviderInstallCancelInput,
  type ProviderInstallSubmitCodeInput,
  type ProviderInstanceId,
  ProviderSetupError,
  type ProviderSetupInput,
} from "@t3tools/contracts";
import { resolveCommandPath } from "@t3tools/shared/shell";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import * as ClaudeInstallation from "./ClaudeInstallation.ts";
import * as CodexInstallation from "./CodexInstallation.ts";
import { makeClaudeEnvironment } from "./Drivers/ClaudeHome.ts";
import * as ServerSettings from "../serverSettings.ts";
import * as AntigravityInstallation from "./AntigravityInstallation.ts";
import { deriveProviderInstanceConfigMap } from "./ProviderInstanceRegistryHydration.ts";
import * as ProviderInstanceRegistry from "./ProviderInstanceRegistry.ts";
import * as ProviderRegistry from "./ProviderRegistry.ts";
import { mergeProviderInstanceEnvironment } from "@t3tools/provider-core/server/instanceEnvironment";

const ANTIGRAVITY = ProviderDriverKind.make("antigravity");
const hasBinaryPath = Schema.is(Schema.Struct({ binaryPath: Schema.String }));
const CLAUDE = ProviderDriverKind.make("claudeAgent");
const decodeClaudeSettings = Schema.decodeUnknownEffect(ClaudeSettings);
const decodeCodexSettings = Schema.decodeUnknownEffect(CodexSettings);
const decodeAntigravitySettings = Schema.decodeUnknownEffect(AntigravitySettings);

/** Route instance setup to the environment-owned installer without owning the download. */
export const makeProviderInstallation = Effect.fn("makeProviderInstallation")(function* () {
  const antigravityInstallation = yield* AntigravityInstallation.AntigravityInstallation;
  const codexInstallation = yield* CodexInstallation.CodexInstallation;
  const claudeInstallation = yield* ClaudeInstallation.ClaudeInstallation;
  const instances = yield* ProviderInstanceRegistry.ProviderInstanceRegistry;
  const providers = yield* ProviderRegistry.ProviderRegistry;
  const settings = yield* ServerSettings.ServerSettingsService;

  const readEntries = Effect.fn("ProviderInstallation.readEntries")(function* (
    instanceId: ProviderInstanceId,
    operation: string,
  ) {
    const current = yield* settings.getSettings.pipe(
      Effect.mapError(
        () =>
          new ProviderSetupError({
            instanceId,
            operation,
            detail: "Could not read provider installation settings.",
          }),
      ),
    );
    return deriveProviderInstanceConfigMap(current);
  });

  const requireInstance = Effect.fn("ProviderInstallation.requireInstance")(function* (
    instanceId: ProviderInstanceId,
    operation: string,
    managedOnly = false,
  ) {
    const instance = yield* instances.getInstance(instanceId);
    const isCodex = instance?.driverKind === ProviderDriverKind.make("codex");
    const isClaude = instance?.driverKind === CLAUDE;
    if (instance?.driverKind !== ANTIGRAVITY && !isCodex && !isClaude) {
      return yield* new ProviderSetupError({
        instanceId,
        operation,
        detail: "Managed installation is not available for this provider instance.",
      });
    }
    const entries = yield* readEntries(instanceId, operation);
    const invalidConfig = () =>
      new ProviderSetupError({
        instanceId,
        operation,
        detail: "The provider instance configuration is invalid.",
      });
    if (isClaude) {
      // Claude's setup keeps working with a custom binary: it only installs and
      // signs in when the configured executable is missing or signed out.
      const config = yield* decodeClaudeSettings(entries[instanceId]?.config ?? {}).pipe(
        Effect.mapError(invalidConfig),
      );
      const environment = yield* makeClaudeEnvironment(
        config,
        yield* mergeProviderInstanceEnvironment(entries[instanceId]?.environment),
      );
      return { kind: "claude" as const, installation: claudeInstallation, config, environment };
    }
    const installation = isCodex ? codexInstallation : antigravityInstallation;
    const config = isCodex
      ? yield* decodeCodexSettings(entries[instanceId]?.config ?? {}).pipe(
          Effect.mapError(invalidConfig),
        )
      : yield* decodeAntigravitySettings(entries[instanceId]?.config ?? {}).pipe(
          Effect.mapError(invalidConfig),
        );
    if (isCodex && (!("setupMode" in config) || config.setupMode !== "managed")) {
      return yield* new ProviderSetupError({
        instanceId,
        operation,
        detail: "Choose managed setup to install Codex in Leonidas Code.",
      });
    }
    if (managedOnly && config.binaryPath && (!isCodex || config.binaryPath !== "codex")) {
      return yield* new ProviderSetupError({
        instanceId,
        operation,
        detail:
          "This instance uses a custom executable. Clear its binary path to manage installation in Leonidas Code.",
      });
    }
    return { kind: "managed" as const, installation, driver: instance.driverKind };
  });

  /** Save the discovered absolute path so later launches do not depend on PATH. */
  const pinClaudeBinaryPath = (instanceId: ProviderInstanceId) => (binaryPath: string) =>
    Effect.gen(function* () {
      const current = yield* settings.getSettings;
      const existing = current.providerInstances[instanceId] ?? { driver: CLAUDE };
      const config =
        existing.config !== null && typeof existing.config === "object" ? existing.config : {};
      yield* settings.updateSettings({
        providerInstances: {
          ...current.providerInstances,
          [instanceId]: { ...existing, config: { ...config, binaryPath } },
        },
      });
    }).pipe(Effect.ignore);

  const failure =
    (instanceId: ProviderInstanceId) =>
    (
      error:
        | AntigravityInstallation.AntigravityInstallationError
        | ClaudeInstallation.ClaudeInstallationError
        | CodexInstallation.CodexInstallationError,
    ) =>
      new ProviderSetupError({ instanceId, operation: error.operation, detail: error.detail });

  const start = Effect.fn("ProviderInstallation.start")(function* (input: ProviderSetupInput) {
    const resolved = yield* requireInstance(input.instanceId, "install", true);
    if (resolved.kind === "claude") {
      return yield* resolved.installation
        .start({
          binaryPath: resolved.config.binaryPath,
          environment: resolved.environment,
          pinBinaryPath: pinClaudeBinaryPath(input.instanceId),
        })
        .pipe(Effect.mapError(failure(input.instanceId)));
    }
    return yield* resolved.installation.start.pipe(Effect.mapError(failure(input.instanceId)));
  });

  const submitCode = Effect.fn("ProviderInstallation.submitCode")(function* (
    input: ProviderInstallSubmitCodeInput,
  ) {
    const resolved = yield* requireInstance(input.instanceId, "submit-install-code");
    if (resolved.kind !== "claude") {
      return yield* new ProviderSetupError({
        instanceId: input.instanceId,
        operation: "submit-install-code",
        detail: "This provider does not use a sign-in code.",
      });
    }
    return yield* resolved.installation
      .submitCode(input.operationId, input.code)
      .pipe(Effect.mapError(failure(input.instanceId)));
  });

  const cancel = Effect.fn("ProviderInstallation.cancel")(function* (
    input: ProviderInstallCancelInput,
  ) {
    const { installation } = yield* requireInstance(input.instanceId, "cancel-install");
    return yield* installation
      .cancel(input.operationId)
      .pipe(Effect.mapError(failure(input.instanceId)));
  });

  const subscribe = (input: ProviderSetupInput) =>
    Stream.unwrap(
      requireInstance(input.instanceId, "observe-install").pipe(
        Effect.map(({ installation }) => installation.changes),
      ),
    );

  const remove = Effect.fn("ProviderInstallation.remove")(function* (input: ProviderSetupInput) {
    const resolved = yield* requireInstance(input.instanceId, "remove-install", true);
    if (resolved.kind === "claude") {
      return yield* new ProviderSetupError({
        instanceId: input.instanceId,
        operation: "remove-install",
        detail: "Claude is installed in your user folder and can't be removed from here.",
      });
    }
    const { installation, driver } = resolved;
    const entries = yield* readEntries(input.instanceId, "remove-install");
    const protectedPaths = yield* Effect.forEach(
      Object.values(entries),
      Effect.fnUntraced(function* (entry) {
        if (!hasBinaryPath(entry.config) || !entry.config.binaryPath.trim()) {
          return [];
        }
        const binaryPath = entry.config.binaryPath.trim();
        return yield* resolveCommandPath(binaryPath, {
          env: yield* mergeProviderInstanceEnvironment(entry.environment),
        }).pipe(
          Effect.map((resolved) => [binaryPath, resolved]),
          Effect.orElseSucceed(() => [binaryPath]),
        );
      }),
    );
    yield* installation
      .remove(protectedPaths.flat())
      .pipe(Effect.mapError(failure(input.instanceId)));
    const allInstances = yield* instances.listInstances;
    yield* Effect.forEach(
      allInstances.filter((instance) => instance.driverKind === driver),
      (instance) => providers.refreshInstance(instance.instanceId),
      { discard: true },
    );
    return yield* installation.state;
  });

  return { start, cancel, submitCode, subscribe, remove };
});
