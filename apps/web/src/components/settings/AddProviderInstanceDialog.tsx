"use client";

import { useAtomValue } from "@effect/atom-react";
import { useMemo, useState } from "react";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import {
  type AcpRegistrySearchAgent,
  AuthProvidersManageScope,
  ProviderInstanceId,
  ProviderDriverKind,
  type EnvironmentId,
  type ProviderInstanceConfig,
  type ProviderInstanceEnvironmentVariable,
} from "@t3tools/contracts";

import {
  useEnvironmentSettings,
  usePersistEnvironmentProviderInstanceMutation,
} from "../../hooks/useSettings";

import { cn } from "../../lib/utils";
import { normalizeProviderAccentColor } from "../../providerInstances";
import { readEnvironmentScope, useEnvironmentScope } from "../../state/session";
import { EMPTY_SERVER_PROVIDERS, serverEnvironment } from "../../state/server";
import { Button } from "../ui/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../ui/collapsible";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import { toastManager } from "../ui/toast";
import { providerClients } from "./providerDriverMeta";
import { ProviderAccentColorPicker } from "./ProviderAccentColorPicker";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./settingsLayout";
import { ProviderSettingsForm, deriveProviderSettingsFields } from "./ProviderSettingsForm";
import { WizardPanel, WizardPopup, WizardHeader, WizardFooter } from "../ui/wizard";
import {
  ACP_REGISTRY_WIZARD_STEPS,
  LOCAL_ACP_WIZARD_STEPS,
  collectClaudeHomePaths,
  deriveAccountLabel,
  deriveAvailableInstanceId,
  deriveClaudeHomePath,
  isClaudeDefaultSlotInUse,
  resolveAcpRegistryWizardNavigation,
  resolveWizardNavigation,
  updateProviderIdentityDraft,
  type ProviderIdentityDraft,
  type WizardNavigation,
} from "./AddProviderInstanceDialog.logic";
import { AddProviderInstanceWizardSteps } from "./AddProviderInstanceWizardSteps";
import { AcpRegistrySearchStep } from "./AcpRegistrySearchStep";
import { HeadlineProviderCards, MoreProviderCards } from "./ProviderChoiceCards";
import { ProviderWizardAuthenticationStep } from "./ProviderWizardAuthenticationStep";
import { resolveOfficialAcpRegistryIconUrl } from "./AcpRegistryIcon";
import { AddManagedCodexAccountDialog } from "./CodexSetupSection";
import { ProviderEnvironmentSection } from "./ProviderInstanceCard";

/**
 * Normalize a user-provided label into a slug suffix for the instance id.
 * The full id is formed by prefixing the driver slug. For example, label "Work" on
 * driver "codex" becomes `codex_work`. Output is trimmed to 48 chars so the
 * final composed id stays under the 64-char slug cap enforced by
 * `ProviderInstanceId` in `@t3tools/contracts`.
 */
function slugifyLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function deriveInstanceId(driver: ProviderDriverKind, label: string): string {
  const slug = slugifyLabel(label);
  return slug ? `${driver}_${slug}` : "";
}

const INSTANCE_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const DEFAULT_DRIVER_KIND = ProviderDriverKind.make("claudeAgent");
const CODEX_DRIVER_KIND = ProviderDriverKind.make("codex");
const ACP_REGISTRY_DRIVER_KIND = ProviderDriverKind.make("acpRegistry");
const DEFAULT_DRIVER_OPTION = providerClients.definitions[0]!;
const EMPTY_CONFIG_DRAFT: Record<string, unknown> = {};
/**
 * Validate an instance id against the same slug rules the server applies in
 * `ProviderInstanceId` (see `packages/contracts/src/providerInstance.ts`).
 * Returns a user-facing error string, or `null` if valid.
 */
function validateInstanceId(id: string, existing: ReadonlySet<string>): string | null {
  if (id.length === 0) return "Instance ID is required.";
  if (id.length > 64) return "Instance ID must be 64 characters or fewer.";
  if (!INSTANCE_ID_PATTERN.test(id)) {
    return "Instance ID must start with a letter and use only letters, digits, '-', or '_'.";
  }
  if (existing.has(id)) return `An instance named '${id}' already exists.`;
  return null;
}

interface AddProviderInstanceDialogProps {
  readonly open: boolean;
  readonly environmentId: EnvironmentId;
  readonly environmentLabel: string;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreated?: (instanceId: ProviderInstanceId) => void;
}

/**
 * Connect an AI account. Normal path: pick a provider card, optionally name it,
 * press Connect, then sign in inside the same dialog. Technical fields live under
 * "Advanced options". The ACP registry keeps its own identity and sign-in steps.
 */
export function AddProviderInstanceDialog({
  open,
  environmentId,
  environmentLabel,
  onOpenChange,
  onCreated,
}: AddProviderInstanceDialogProps) {
  const settings = useEnvironmentSettings(environmentId);
  const persistProviderInstance = usePersistEnvironmentProviderInstanceMutation(environmentId);
  const canManageProviders = useEnvironmentScope(environmentId, AuthProvidersManageScope);
  const serverProviders =
    useAtomValue(serverEnvironment.providersValueAtom(environmentId)) ?? EMPTY_SERVER_PROVIDERS;

  const [wizardStep, setWizardStep] = useState(0);
  const [addingChatGptAccount, setAddingChatGptAccount] = useState(false);
  const [driver, setDriver] = useState<ProviderDriverKind>(DEFAULT_DRIVER_KIND);
  const [identityByDriver, setIdentityByDriver] = useState<Record<string, ProviderIdentityDraft>>(
    {},
  );
  const [selectedAcp, setSelectedAcp] = useState<AcpRegistrySearchAgent | null>(null);
  const [localEnvironment, setLocalEnvironment] = useState<
    ReadonlyArray<ProviderInstanceEnvironmentVariable>
  >([]);
  const [isManualAcpConfiguration, setIsManualAcpConfiguration] = useState(false);
  const [isRegistryLoading, setIsRegistryLoading] = useState(false);
  const [isPreparingRegistryAgent, setIsPreparingRegistryAgent] = useState(false);
  // Driver-specific config drafts keyed by driver so toggling between drivers
  // during the same dialog session does not lose in-progress input.
  const [configByDriver, setConfigByDriver] = useState<Record<string, Record<string, unknown>>>({});
  // Errors are suppressed until the user has tried to submit once. After that
  // they update live so fixing the problem clears the message in place.
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [createdInstanceId, setCreatedInstanceId] = useState<ProviderInstanceId | null>(null);
  const [createdLabel, setCreatedLabel] = useState<string | undefined>(undefined);
  const [createError, setCreateError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Codex and Claude run at their default slots before they are configured, so
  // those ids stay reserved; other unconfigured default slots are free to take.
  const existingIds = useMemo(
    () => new Set(["codex", "claudeAgent", ...Object.keys(settings.providerInstances ?? {})]),
    [settings.providerInstances],
  );

  const driverOption = providerClients.get(driver) ?? DEFAULT_DRIVER_OPTION;
  const isAcpRegistry = driver === ACP_REGISTRY_DRIVER_KIND;
  const defaultIdentity: ProviderIdentityDraft = {
    label: "",
    accentColor: "",
    instanceIdOverride: null,
  };
  const { label, accentColor, instanceIdOverride } = identityByDriver[driver] ?? defaultIdentity;
  const instanceId =
    instanceIdOverride ??
    deriveAvailableInstanceId(
      (candidateLabel) => {
        if (!candidateLabel.trim() || candidateLabel === driverOption.label) {
          return isAcpRegistry ? `${driver}_custom` : driver;
        }
        return deriveInstanceId(driver, candidateLabel);
      },
      label,
      existingIds,
    );
  const driverSettingsFields = useMemo(
    () => deriveProviderSettingsFields(driverOption),
    [driverOption],
  );
  const instanceIdError = validateInstanceId(instanceId, existingIds);
  const showInstanceIdError = hasAttemptedSubmit && instanceIdError !== null;
  const identityStep = 1;
  const previewLabel = label.trim() || `${driverOption.label} Workspace`;

  // Names already taken by this provider: configured instances plus signed-in default slots.
  const takenLabels = [
    ...Object.values(settings.providerInstances ?? {}).flatMap((instance) =>
      instance?.driver === driver && instance.displayName ? [instance.displayName] : [],
    ),
    ...serverProviders.flatMap((provider) =>
      provider.driver === driver && provider.auth.status === "authenticated"
        ? [provider.displayName ?? driverOption.label]
        : [],
    ),
  ];
  const defaultAccountLabel = deriveAccountLabel(driverOption.label, takenLabels);

  const configDraft = configByDriver[driver] ?? EMPTY_CONFIG_DRAFT;
  const isLocalAcp = isAcpRegistry && isManualAcpConfiguration && configDraft.source === "local";
  const localCommandPath =
    typeof configDraft.commandPath === "string" ? configDraft.commandPath.trim() : "";
  const manualAgentId = typeof configDraft.agentId === "string" ? configDraft.agentId.trim() : "";
  const acpSelectionError = isLocalAcp
    ? localCommandPath.length > 0
      ? null
      : "Executable is required."
    : selectedAcp !== null || (isManualAcpConfiguration && manualAgentId.length > 0)
      ? null
      : "Select an ACP or configure one manually.";
  const wizardStepSummaries = [
    isLocalAcp ? "Local ACP command" : (selectedAcp?.name ?? (manualAgentId || null)),
    previewLabel,
    null,
  ] as const;
  const setConfigDraft = (config: Record<string, unknown> | undefined) => {
    setConfigByDriver((existing) => {
      const next = { ...existing };
      if (config === undefined || Object.keys(config).length === 0) {
        delete next[driver];
      } else {
        next[driver] = config;
      }
      return next;
    });
  };
  const setIdentityDraft = (update: Partial<ProviderIdentityDraft>) => {
    setIdentityByDriver((existing) => ({
      ...existing,
      [driver]: { ...(existing[driver] ?? defaultIdentity), ...update },
    }));
  };

  const applyWizardNavigation = (navigation: WizardNavigation) => {
    if (isSaving || isPreparingRegistryAgent || createdInstanceId) return;
    if (navigation.kind === "blocked") {
      setHasAttemptedSubmit(true);
    }
    if (isAcpRegistry && !isLocalAcp && navigation.kind === "navigate" && navigation.step === 2) {
      void handleSave();
      return;
    }
    setWizardStep(navigation.step);
  };

  const navigateToStep = (requestedStep: number) => {
    applyWizardNavigation(
      isLocalAcp
        ? resolveWizardNavigation(wizardStep, requestedStep, LOCAL_ACP_WIZARD_STEPS.length, {
            instanceIdError,
            prerequisite: { step: 0, error: acpSelectionError },
          })
        : resolveAcpRegistryWizardNavigation(wizardStep, requestedStep, {
            instanceIdError,
            selectionError: acpSelectionError,
          }),
    );
  };

  const selectDriver = (next: ProviderDriverKind) => {
    setDriver(next);
    setIsManualAcpConfiguration(false);
    setHasAttemptedSubmit(false);
    setCreateError(null);
  };

  const handleAcpPrepared = (agent: AcpRegistrySearchAgent) => {
    setDriver(ACP_REGISTRY_DRIVER_KIND);
    const nextLabel = agent.name;
    const registryIconUrl = resolveOfficialAcpRegistryIconUrl(agent.icon);
    const nextInstanceId = deriveAvailableInstanceId(
      (candidateLabel) => deriveInstanceId(ACP_REGISTRY_DRIVER_KIND, candidateLabel),
      nextLabel,
      existingIds,
    );
    setSelectedAcp(agent);
    setIsManualAcpConfiguration(false);
    setIdentityByDriver((existing) =>
      updateProviderIdentityDraft(existing, ACP_REGISTRY_DRIVER_KIND, {
        label: nextLabel,
        instanceIdOverride: nextInstanceId,
      }),
    );
    setConfigByDriver((existing) => ({
      ...existing,
      [ACP_REGISTRY_DRIVER_KIND]: {
        agentId: agent.id,
        distribution: "auto",
        ...(registryIconUrl ? { registryIconUrl } : {}),
      },
    }));
    setHasAttemptedSubmit(false);
    setWizardStep(1);
  };

  const handleManualAcpConfiguration = () => {
    setDriver(ACP_REGISTRY_DRIVER_KIND);
    setSelectedAcp(null);
    setIsManualAcpConfiguration(true);
    setConfigByDriver((existing) => {
      const next = { ...existing };
      delete next[ACP_REGISTRY_DRIVER_KIND];
      return next;
    });
    setIdentityByDriver((existing) =>
      updateProviderIdentityDraft(existing, ACP_REGISTRY_DRIVER_KIND, {
        label: "",
        instanceIdOverride: null,
      }),
    );
    setHasAttemptedSubmit(false);
  };

  const handleLocalAcpConfiguration = () => {
    setDriver(ACP_REGISTRY_DRIVER_KIND);
    setSelectedAcp(null);
    setIsManualAcpConfiguration(true);
    setConfigByDriver((existing) => ({
      ...existing,
      [ACP_REGISTRY_DRIVER_KIND]: { source: "local", commandArgs: [] },
    }));
    setIdentityByDriver((existing) =>
      updateProviderIdentityDraft(existing, ACP_REGISTRY_DRIVER_KIND, {
        label: "Local ACP",
        instanceIdOverride: null,
      }),
    );
    setLocalEnvironment([]);
    setHasAttemptedSubmit(false);
  };

  /** Closing mid-sign-in keeps the half-set-up account listed; select it on the way out. */
  const handleOpenChange = (next: boolean) => {
    if (!next && createdInstanceId && !isAcpRegistry) onCreated?.(createdInstanceId);
    onOpenChange(next);
  };

  const handleSave = async () => {
    if (!readEnvironmentScope(environmentId, AuthProvidersManageScope)) return;
    if (isSaving || createdInstanceId) return;
    setHasAttemptedSubmit(true);
    if (instanceIdError !== null) {
      setAdvancedOpen(true);
      return;
    }
    if (isAcpRegistry && acpSelectionError !== null) return;

    // Simple path: an untouched name falls back to "<Provider>", "<Provider> 2", ...
    const accountLabel = isAcpRegistry ? label.trim() : label.trim() || defaultAccountLabel;
    let config: Record<string, unknown> =
      driver === "codex"
        ? { ...configByDriver[driver], setupMode: "existing" }
        : { ...configByDriver[driver] };
    const homePathChosen = typeof config.homePath === "string" && config.homePath.trim() !== "";
    if (driver === "claudeAgent" && !homePathChosen) {
      // A later Claude account needs its own CLAUDE_CONFIG_DIR or it reuses the first login.
      const homePath = deriveClaudeHomePath({
        label: accountLabel,
        defaultSlotInUse: isClaudeDefaultSlotInUse(
          settings.providerInstances ?? {},
          serverProviders,
        ),
        existingHomePaths: collectClaudeHomePaths(settings.providerInstances ?? {}),
      });
      if (homePath) config = { ...config, homePath };
    }
    const hasConfig = Object.keys(config).length > 0;
    const normalizedAccentColor = normalizeProviderAccentColor(accentColor);

    const nextInstance: ProviderInstanceConfig = {
      driver,
      enabled: true,
      ...(accountLabel.length > 0 ? { displayName: accountLabel } : {}),
      ...(normalizedAccentColor ? { accentColor: normalizedAccentColor } : {}),
      ...(hasConfig ? { config } : {}),
      ...(isLocalAcp && localEnvironment.length > 0 ? { environment: localEnvironment } : {}),
    };
    // `ProviderInstanceId.make` revalidates the slug; we've already checked
    // it via `validateInstanceId`, but going through the brand constructor
    // keeps the type boundary honest and guards against any future drift in
    // the slug rules.
    const brandedId = ProviderInstanceId.make(instanceId);
    setIsSaving(true);
    setCreateError(null);
    const result = await persistProviderInstance({
      operation: "create",
      instanceId: brandedId,
      instance: nextInstance,
    });
    if (result._tag === "Failure") {
      const error = squashAtomCommandFailure(result);
      setIsSaving(false);
      if (isAcpRegistry) {
        toastManager.add({
          type: "error",
          title: "Could not add provider instance",
          description: error instanceof Error ? error.message : "The settings update failed.",
        });
      } else {
        setCreateError("Couldn't add this account.");
      }
      return;
    }
    if (isAcpRegistry) {
      onCreated?.(brandedId);
      if (!isLocalAcp) {
        setCreatedInstanceId(brandedId);
        setIsSaving(false);
        setWizardStep(2);
        return;
      }
      toastManager.add({
        type: "success",
        title: "Provider instance added",
        description: `${driverOption.label} instance '${instanceId}' was added.`,
      });
      onOpenChange(false);
      return;
    }
    setCreatedLabel(accountLabel);
    setCreatedInstanceId(brandedId);
    setIsSaving(false);
    setWizardStep(2);
  };

  const handleConnect = () => {
    if (driver === CODEX_DRIVER_KIND) {
      setAddingChatGptAccount(true);
      return;
    }
    void handleSave();
  };

  const handleRemove = async () => {
    if (!createdInstanceId) return;
    const result = await persistProviderInstance({
      operation: "remove",
      instanceId: createdInstanceId,
    });
    if (result._tag === "Failure") {
      toastManager.add({ type: "error", title: "Couldn't remove this account." });
      return;
    }
    setCreatedInstanceId(null);
    onOpenChange(false);
  };

  if (addingChatGptAccount) {
    return (
      <AddManagedCodexAccountDialog
        environmentId={environmentId}
        onClose={() => onOpenChange(false)}
        onAccountCreated={(createdId) => onCreated?.(createdId)}
      />
    );
  }

  const identityFields = (
    <>
      <SettingsRow
        title={<label htmlFor="add-provider-instance-id">Instance ID</label>}
        description={
          <span id="add-provider-instance-id-description">Letters, digits, '-', or '_'.</span>
        }
        status={
          showInstanceIdError ? (
            <span id="add-provider-instance-id-error" role="alert" className="text-destructive">
              {instanceIdError}
            </span>
          ) : undefined
        }
        control={
          <Input
            id="add-provider-instance-id"
            aria-describedby={
              showInstanceIdError
                ? "add-provider-instance-id-description add-provider-instance-id-error"
                : "add-provider-instance-id-description"
            }
            size="sm"
            className="w-full @min-[32rem]/settings-row:w-56"
            placeholder={`${driver}_work`}
            value={instanceId}
            onChange={(event) => {
              setIdentityDraft({ instanceIdOverride: event.target.value });
            }}
            aria-invalid={showInstanceIdError}
          />
        }
      />
      <SettingsRow
        title="Accent color"
        description="Optional marker shown in the picker."
        control={
          <ProviderAccentColorPicker
            displayName={label || driverOption.label}
            value={accentColor || undefined}
            onCommit={(value) => setIdentityDraft({ accentColor: value })}
            layout="inline"
          />
        }
      />
    </>
  );

  const showAcpSteps = isAcpRegistry && (wizardStep >= identityStep || createdInstanceId !== null);
  const onPickScreen = wizardStep === 0 && !createdInstanceId;
  const stepText = createdInstanceId ? "Step 2 of 2" : "Step 1 of 2";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <WizardPopup size="wide">
        <WizardHeader
          title="Connect an AI account"
          description={
            createdInstanceId ? (
              <>{stepText}. Sign in to finish.</>
            ) : (
              <>
                {stepText}. Choose the AI you use. Adds it on {environmentLabel}.
              </>
            )
          }
        >
          {showAcpSteps ? (
            <AddProviderInstanceWizardSteps
              currentStep={wizardStep}
              summaries={wizardStepSummaries}
              instanceIdError={instanceIdError}
              steps={isLocalAcp ? LOCAL_ACP_WIZARD_STEPS : ACP_REGISTRY_WIZARD_STEPS}
              disabled={isSaving || isPreparingRegistryAgent || createdInstanceId !== null}
              identityStep={1}
              prerequisite={{ step: 0, error: acpSelectionError }}
              onNavigation={applyWizardNavigation}
            />
          ) : null}
        </WizardHeader>

        {createdInstanceId ? (
          <ProviderWizardAuthenticationStep
            environmentId={environmentId}
            environmentLabel={environmentLabel}
            instanceId={createdInstanceId}
            driver={driver}
            providerName={driverOption.label}
            {...(createdLabel === undefined ? {} : { displayName: createdLabel })}
            {...(isAcpRegistry ? {} : { onRemove: () => void handleRemove() })}
            onFinish={() => handleOpenChange(false)}
          />
        ) : (
          <>
            <WizardPanel
              className={cn(isAcpRegistry && wizardStep === identityStep && "min-h-72")}
              holdHeight={onPickScreen && !isManualAcpConfiguration && isRegistryLoading}
            >
              {onPickScreen ? (
                <div className="space-y-4">
                  {isAcpRegistry && isManualAcpConfiguration ? null : (
                    <>
                      <HeadlineProviderCards
                        value={driver}
                        disabled={isPreparingRegistryAgent || isSaving}
                        onSelect={selectDriver}
                      />
                      <div className="grid gap-1.5">
                        <label
                          htmlFor="add-provider-label"
                          className="text-sm font-medium text-foreground"
                        >
                          Name this account (optional)
                        </label>
                        <Input
                          id="add-provider-label"
                          aria-describedby="add-provider-label-description"
                          size="sm"
                          placeholder={defaultAccountLabel}
                          value={label}
                          onChange={(event) => setIdentityDraft({ label: event.target.value })}
                        />
                        <span
                          id="add-provider-label-description"
                          className="text-xs text-muted-foreground"
                        >
                          {`For example "Work" or "Justine". Leave blank to use "${defaultAccountLabel}".`}
                        </span>
                      </div>
                    </>
                  )}

                  {isAcpRegistry && isManualAcpConfiguration ? (
                    <div className="grid gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-medium text-foreground">
                            {isLocalAcp ? "Local ACP command" : "Enter manually"}
                          </h3>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {isLocalAcp
                              ? `Run an installed ACP executable on ${environmentLabel}.`
                              : "Enter an official registry ID and any local executable or auth override."}
                          </p>
                        </div>
                        <Button
                          onClick={() => selectDriver(DEFAULT_DRIVER_KIND)}
                          size="xs"
                          variant="ghost"
                        >
                          Search registry
                        </Button>
                      </div>
                      <SettingsGroup variant="plain">
                        <ProviderSettingsForm
                          definition={driverOption}
                          value={configDraft}
                          idPrefix="add-provider-acpRegistry-manual"
                          variant="settings"
                          onChange={setConfigDraft}
                        />
                        {isLocalAcp ? (
                          <ProviderEnvironmentSection
                            environment={localEnvironment}
                            onChange={setLocalEnvironment}
                          />
                        ) : null}
                      </SettingsGroup>
                      {hasAttemptedSubmit && acpSelectionError ? (
                        <p className="text-2xs text-destructive">{acpSelectionError}</p>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      {isAcpRegistry ? null : (
                        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                          <CollapsibleTrigger className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                            Advanced options
                          </CollapsibleTrigger>
                          <CollapsiblePanel animate={false}>
                            <SettingsGroup variant="plain" className="mt-2">
                              {identityFields}
                              {driverSettingsFields.length > 0 ? (
                                <ProviderSettingsForm
                                  definition={driverOption}
                                  value={configDraft}
                                  idPrefix={`add-provider-${driver}`}
                                  variant="settings"
                                  onChange={setConfigDraft}
                                />
                              ) : null}
                              {driver === CODEX_DRIVER_KIND ? (
                                <SettingsRow
                                  title="Codex already installed"
                                  description="Use the Codex command on this computer instead of signing in with ChatGPT."
                                  control={
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isSaving || !canManageProviders}
                                      onClick={() => void handleSave()}
                                    >
                                      Use installed Codex
                                    </Button>
                                  }
                                />
                              ) : null}
                            </SettingsGroup>
                          </CollapsiblePanel>
                        </Collapsible>
                      )}
                      <Collapsible>
                        <CollapsibleTrigger className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                          More providers
                        </CollapsibleTrigger>
                        <CollapsiblePanel animate={false}>
                          <div className="mt-2 space-y-4">
                            <MoreProviderCards
                              value={driver}
                              disabled={isPreparingRegistryAgent || isSaving}
                              onSelect={selectDriver}
                            />
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <div aria-hidden className="flex-1 border-t border-border/70" />
                              <span>Or choose from ACP Registry</span>
                              <div aria-hidden className="flex-1 border-t border-border/70" />
                            </div>
                            <AcpRegistrySearchStep
                              environmentId={environmentId}
                              providerInstances={settings.providerInstances}
                              onPrepared={handleAcpPrepared}
                              onManualConfiguration={handleManualAcpConfiguration}
                              onLocalConfiguration={handleLocalAcpConfiguration}
                              onLoadingChange={setIsRegistryLoading}
                              onPreparingChange={setIsPreparingRegistryAgent}
                            />
                            {isAcpRegistry && hasAttemptedSubmit && acpSelectionError ? (
                              <p className="mt-2 text-2xs text-destructive">{acpSelectionError}</p>
                            ) : null}
                          </div>
                        </CollapsiblePanel>
                      </Collapsible>
                    </>
                  )}
                  {createError ? (
                    <p role="alert" className="text-xs text-destructive">
                      {createError}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {isAcpRegistry && wizardStep === identityStep && selectedAcp ? (
                <div className="mb-4 flex items-start justify-between gap-3 border-b border-border/70 pb-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {selectedAcp.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      v{selectedAcp.version} · {selectedAcp.distribution}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2 text-2xs">
                    {selectedAcp.website ? (
                      <a
                        aria-label={`Open documentation for ${selectedAcp.name} (${selectedAcp.id})`}
                        className="text-muted-foreground hover:text-foreground"
                        href={selectedAcp.website}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Docs
                      </a>
                    ) : null}
                    {selectedAcp.repository ? (
                      <a
                        aria-label={`Open source for ${selectedAcp.name} (${selectedAcp.id})`}
                        className="text-muted-foreground hover:text-foreground"
                        href={selectedAcp.repository}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Source
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {isAcpRegistry && wizardStep === identityStep ? (
                <SettingsGroup variant="plain">
                  <SettingsRow
                    title={<label htmlFor="add-provider-label">Label</label>}
                    description={
                      <span id="add-provider-label-description">Shown in the provider list.</span>
                    }
                    control={
                      <Input
                        id="add-provider-label"
                        aria-describedby="add-provider-label-description"
                        size="sm"
                        className="w-full @min-[32rem]/settings-row:w-56"
                        placeholder="e.g. Work"
                        value={label}
                        onChange={(event) => setIdentityDraft({ label: event.target.value })}
                      />
                    }
                  />
                  {identityFields}
                </SettingsGroup>
              ) : null}
            </WizardPanel>

            <WizardFooter>
              <Button
                variant={onPickScreen ? "ghost-muted" : "outline"}
                size="sm"
                disabled={isSaving || isPreparingRegistryAgent}
                onClick={() => {
                  if (onPickScreen) {
                    handleOpenChange(false);
                    return;
                  }
                  if (isAcpRegistry && !isManualAcpConfiguration) selectDriver(DEFAULT_DRIVER_KIND);
                  setWizardStep((step) => Math.max(0, step - 1));
                }}
              >
                {onPickScreen ? "Cancel" : "Back"}
              </Button>
              {onPickScreen && !(isAcpRegistry && isManualAcpConfiguration) ? (
                <Button
                  size="sm"
                  disabled={isSaving || isPreparingRegistryAgent || !canManageProviders}
                  onClick={handleConnect}
                >
                  {isSaving ? "Connecting..." : createError ? "Try again" : "Connect"}
                </Button>
              ) : onPickScreen ? (
                <Button
                  size="sm"
                  disabled={isPreparingRegistryAgent}
                  onClick={() => navigateToStep(1)}
                >
                  Next
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={isSaving || !canManageProviders}
                  onClick={() => void handleSave()}
                >
                  {isSaving
                    ? "Adding..."
                    : isAcpRegistry && !isLocalAcp
                      ? "Continue to sign-in"
                      : "Add instance"}
                </Button>
              )}
            </WizardFooter>
          </>
        )}
      </WizardPopup>
    </Dialog>
  );
}
