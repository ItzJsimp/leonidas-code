import type { ReactElement } from "react";
import {
  DEFAULT_UNIFIED_SETTINGS,
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerProvider,
  type UnifiedSettings,
} from "@t3tools/contracts";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { visitElements } from "../../test/reactElementTree";
import { reactHookHarness as hooks } from "../../test/reactHookHarness";

const atoms = vi.hoisted(() => ({
  providers: null as ReadonlyArray<ServerProvider> | null,
  providersAtom: Symbol("providers"),
  refreshProviders: Symbol("refreshProviders"),
  updateProvider: Symbol("updateProvider"),
  uninstallAcpRegistryManagedBinary: Symbol("uninstallAcpRegistryManagedBinary"),
  acceptAcpRegistryUrlAuth: Symbol("acceptAcpRegistryUrlAuth"),
}));

const commands = vi.hoisted(() => ({
  refresh: vi.fn(),
  updateProvider: vi.fn(),
  uninstall: vi.fn(),
  acceptUrlAuth: vi.fn(),
  canManageProviders: true,
  canWriteSettings: true,
}));

const settingsState = vi.hoisted(() => ({
  value: null as UnifiedSettings | null,
  readEnvironmentIds: [] as EnvironmentId[],
  updateEnvironmentIds: [] as EnvironmentId[],
  mutationEnvironmentIds: [] as EnvironmentId[],
  updateSettings: vi.fn(),
  mutateProviderInstance: vi.fn(),
  updateClientSettings: vi.fn(),
}));

const settingsSearchState = vi.hoisted(() => ({
  targetId: null as string | null,
  effects: [] as Array<() => void>,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const { reactHookHarness } = await import("../../test/reactHookHarness");
  return {
    ...actual,
    useCallback: reactHookHarness.useCallback,
    useEffect: (effect: () => void) => settingsSearchState.effects.push(effect),
    useMemo: reactHookHarness.useMemo,
    useRef: reactHookHarness.useRef,
    useState: reactHookHarness.useState,
  };
});

vi.mock("./settingsLayout", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./settingsLayout")>();
  return {
    ...actual,
    useSettingsSearchTargetId: () => settingsSearchState.targetId,
  };
});

vi.mock("./SettingsScopeSentence", () => ({ SettingsScopeSentence: () => null }));
vi.mock("react/compiler-runtime", async () => {
  const { reactHookHarness } = await import("../../test/reactHookHarness");
  return { c: reactHookHarness.useMemoCache };
});

vi.mock("@effect/atom-react", () => ({
  useAtomValue: () => atoms.providers,
}));

vi.mock("../../state/server", () => ({
  EMPTY_SERVER_PROVIDERS: [],
  serverEnvironment: {
    providersValueAtom: () => atoms.providersAtom,
    refreshProviders: atoms.refreshProviders,
    updateProvider: atoms.updateProvider,
    uninstallAcpRegistryManagedBinary: atoms.uninstallAcpRegistryManagedBinary,
    acceptAcpRegistryUrlAuth: atoms.acceptAcpRegistryUrlAuth,
  },
}));

vi.mock("../../state/use-atom-command", () => ({
  useAtomCommand: (atom: symbol) =>
    atom === atoms.refreshProviders
      ? commands.refresh
      : atom === atoms.uninstallAcpRegistryManagedBinary
        ? commands.uninstall
        : atom === atoms.acceptAcpRegistryUrlAuth
          ? commands.acceptUrlAuth
          : commands.updateProvider,
}));

vi.mock("../../hooks/useSettings", () => ({
  useUpdateClientSettings: () => settingsState.updateClientSettings,
  useEnvironmentSettings: (environmentId: EnvironmentId) => {
    settingsState.readEnvironmentIds.push(environmentId);
    return settingsState.value;
  },
  useUpdateEnvironmentSettings: (environmentId: EnvironmentId) => {
    settingsState.updateEnvironmentIds.push(environmentId);
    return settingsState.updateSettings;
  },
  useUpdateEnvironmentModelPreferences: () => settingsState.updateSettings,
  useToggleEnvironmentModelFavorite: () => () => undefined,
  usePersistEnvironmentProviderInstanceMutation: (environmentId: EnvironmentId) => {
    settingsState.mutationEnvironmentIds.push(environmentId);
    return settingsState.mutateProviderInstance;
  },
}));

vi.mock("../../environments/primary", () => ({
  usePrimarySessionState: () => ({ data: null, error: null, isPending: false, refresh: vi.fn() }),
}));

vi.mock("../../state/session", () => ({
  useEnvironmentSessionState: () => ({ data: null, hasError: false, isPending: true }),
  useEnvironmentScope: (environmentId: EnvironmentId, scope: string) =>
    environmentId === "remote-device" &&
    (scope === "providers:manage"
      ? commands.canManageProviders
      : scope === "settings:write"
        ? commands.canWriteSettings
        : scope === "orchestration:read"),
  readEnvironmentScope: (environmentId: EnvironmentId, scope: string) =>
    environmentId === "remote-device" &&
    (scope === "providers:manage"
      ? commands.canManageProviders
      : scope === "settings:write"
        ? commands.canWriteSettings
        : scope === "orchestration:read"),
}));

vi.mock("../../state/entities", () => ({
  useProjects: () => [],
}));

import { EnvironmentProviderSettings } from "./ProviderSettingsPanel";
import { AddProviderInstanceDialog } from "./AddProviderInstanceDialog";

const environmentId = EnvironmentId.make("remote-device");
const codexId = ProviderInstanceId.make("codex");
const customId = ProviderInstanceId.make("codex_work");

function provider(): ServerProvider {
  return {
    instanceId: codexId,
    driver: ProviderDriverKind.make("codex"),
    enabled: true,
    installed: true,
    version: "1.0.0",
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: "2026-07-24T12:00:00.000Z",
    models: [],
    slashCommands: [],
    skills: [],
    versionAdvisory: {
      status: "behind_latest",
      currentVersion: "1.0.0",
      latestVersion: "1.1.0",
      updateCommand: "pnpm add -g @openai/codex@latest",
      canUpdate: true,
      checkedAt: "2026-07-24T12:00:00.000Z",
      message: "Update available.",
    },
  };
}

function renderPanel(options?: {
  readonly readOnly?: boolean;
  readonly targetInstanceId?: ProviderInstanceId;
}): ReactElement<Record<string, unknown>> {
  hooks.beginRender();
  return EnvironmentProviderSettings({
    environmentId,
    environmentLabel: "Remote device",
    ...(options?.readOnly === undefined ? {} : { readOnly: options.readOnly }),
    ...(options?.targetInstanceId === undefined
      ? {}
      : { targetInstanceId: options.targetInstanceId }),
  }) as ReactElement<Record<string, unknown>>;
}

function isRefreshButton(element: ReactElement<Record<string, unknown>>): boolean {
  const children = element.props.children;
  return (
    Array.isArray(children) &&
    children.some(
      (child) =>
        typeof child === "object" &&
        child !== null &&
        (child as ReactElement<Record<string, unknown>>).props?.className === "sr-only" &&
        (child as ReactElement<Record<string, unknown>>).props?.children ===
          "Refresh AI service status",
    )
  );
}

function isAddProviderButton(element: ReactElement<Record<string, unknown>>): boolean {
  return element.props["aria-label"] === "Connect an account";
}

type Panel = ReactElement<Record<string, unknown>>;

/** The grouped account list that replaced the old list and detail panel. */
function accountGroups(panel: Panel) {
  return visitElements(panel, (element) => Array.isArray(element.props.groups));
}

function hasAccount(panel: Panel, instanceId: string): boolean {
  const groups = (accountGroups(panel)?.props.groups ?? []) as ReadonlyArray<{
    readonly rows: ReadonlyArray<{ readonly instanceId: string }>;
  }>;
  return groups.some((group) => group.rows.some((row) => row.instanceId === instanceId));
}

/** The full account editor, shown only inside the Settings sheet. */
function accountEditor(panel: Panel, instanceId?: string) {
  return visitElements(
    panel,
    (element) =>
      typeof element.props.onUpdate === "function" &&
      typeof element.props.instanceId === "string" &&
      (instanceId === undefined || element.props.instanceId === instanceId),
  );
}

/** Open one account's Settings sheet from its menu, then render again. */
function openAccountSettings(
  instanceId: string,
  options?: Parameters<typeof renderPanel>[0],
): Panel {
  const panel = renderPanel(options);
  const groups = accountGroups(panel);
  if (!groups) throw new Error("Account groups were not rendered");
  (groups.props.onSettings as (row: { instanceId: string }) => void)({ instanceId });
  return renderPanel(options);
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("EnvironmentProviderSettings routing", () => {
  beforeEach(() => {
    hooks.reset();
    atoms.providers = null;
    settingsState.value = DEFAULT_UNIFIED_SETTINGS;
    settingsState.readEnvironmentIds = [];
    settingsState.updateEnvironmentIds = [];
    settingsState.mutationEnvironmentIds = [];
    settingsState.updateSettings.mockReset();
    settingsState.updateClientSettings.mockReset();
    settingsSearchState.targetId = null;
    settingsSearchState.effects = [];
    settingsState.mutateProviderInstance
      .mockReset()
      .mockResolvedValue({ _tag: "Success", value: {} });
    commands.canManageProviders = true;
    commands.canWriteSettings = true;
    commands.refresh.mockReset().mockResolvedValue({ _tag: "Success" });
    commands.updateProvider.mockReset().mockResolvedValue({ _tag: "Success" });
    commands.uninstall.mockReset().mockResolvedValue({ _tag: "Success", value: {} });
    commands.acceptUrlAuth
      .mockReset()
      .mockResolvedValue({ _tag: "Success", value: { accepted: true } });
  });

  it("shows Codex and Claude while hiding untouched disabled provider slots", () => {
    const panel = renderPanel();
    for (const driver of ["codex", "claudeAgent"] as const) {
      expect(hasAccount(panel, driver)).toBe(true);
    }
    for (const driver of ["cursor", "grok", "pi", "opencode", "antigravity"] as const) {
      expect(hasAccount(panel, driver)).toBe(false);
    }
  });

  it("keeps explicitly configured providers visible when disabled", () => {
    const grokId = ProviderInstanceId.make("grok");
    settingsState.value = {
      ...DEFAULT_UNIFIED_SETTINGS,
      providerInstances: {
        [grokId]: { driver: ProviderDriverKind.make("grok"), enabled: false },
      },
    };
    const panel = renderPanel();
    expect(hasAccount(panel, grokId)).toBe(true);
  });

  it("keeps legacy provider configuration visible when disabled", () => {
    settingsState.value = {
      ...DEFAULT_UNIFIED_SETTINGS,
      providerInstances: {
        [ProviderInstanceId.make("grok")]: {
          driver: ProviderDriverKind.make("grok"),
          enabled: false,
          config: {
            binaryPath: "/custom/grok",
          },
        },
      },
    };
    const panel = renderPanel();
    expect(hasAccount(panel, "grok")).toBe(true);
  });

  it("coalesces a nullable provider snapshot before rendering array-backed UI", () => {
    expect(() => renderPanel()).not.toThrow();
    expect(settingsState.readEnvironmentIds).toEqual([environmentId]);
    expect(settingsState.updateEnvironmentIds).toEqual([environmentId]);
    expect(settingsState.mutationEnvironmentIds).toEqual([environmentId]);
  });

  it("routes refresh and provider update commands to the selected environment", async () => {
    atoms.providers = [provider()];
    const panel = openAccountSettings(codexId);
    const refreshButton = visitElements(panel, isRefreshButton);
    expect(refreshButton).not.toBeNull();
    (refreshButton?.props.onClick as (() => void) | undefined)?.();
    await flushPromises();

    expect(commands.refresh).toHaveBeenCalledWith({
      environmentId,
      input: { refreshModels: true },
    });

    const providerCard = visitElements(
      panel,
      (element) =>
        element.props.instanceId === codexId && typeof element.props.onRunUpdate === "function",
    );
    expect(providerCard).not.toBeNull();
    (providerCard?.props.onRunUpdate as (() => void) | undefined)?.();
    await flushPromises();

    expect(commands.updateProvider).toHaveBeenCalledWith({
      environmentId,
      input: { provider: ProviderDriverKind.make("codex"), instanceId: codexId },
    });
  });

  it("opens the requested provider instance instead of the first provider", () => {
    settingsState.value = {
      ...DEFAULT_UNIFIED_SETTINGS,
      providerInstances: {
        [customId]: { driver: ProviderDriverKind.make("codex"), enabled: true },
      },
    };
    atoms.providers = [provider()];
    const panel = renderPanel({ targetInstanceId: customId });
    expect(accountEditor(panel)?.props.instanceId).toBe(customId);
  });

  it.each([
    [
      "onFavoriteModelsChange",
      { setModelFavorites: [{ provider: codexId, model: "chosen", favorite: true }] },
    ],
    [
      "onHiddenModelsChange",
      { setModelsHidden: [{ provider: codexId, model: "chosen", hidden: true }] },
    ],
    [
      "onModelOrderChange",
      { setProviderModelOrder: { provider: codexId, modelOrder: ["chosen"] } },
    ],
  ])("saves %s on the selected environment for every connected client", (action, expected) => {
    atoms.providers = [provider()];
    const editor = accountEditor(openAccountSettings(codexId), codexId);
    expect(editor).not.toBeNull();
    if (!editor) throw new Error("Provider editor was not rendered");
    (editor.props[action] as (models: string[]) => void)(["chosen"]);
    expect(settingsState.updateSettings).toHaveBeenCalledExactlyOnceWith(expected);
    expect(settingsState.updateClientSettings).not.toHaveBeenCalled();
  });

  it("does not substitute another account when the requested instance was removed", () => {
    atoms.providers = [provider()];
    const panel = renderPanel({ targetInstanceId: customId });
    expect(accountEditor(panel)).toBeNull();
    expect(settingsState.updateSettings).not.toHaveBeenCalled();
  });

  it("keeps provider selection available while write controls are read only", () => {
    commands.canWriteSettings = false;
    settingsState.value = {
      ...DEFAULT_UNIFIED_SETTINGS,
      providerInstances: {
        [customId]: {
          driver: ProviderDriverKind.make("codex"),
          enabled: true,
        },
      },
    };
    atoms.providers = [provider()];
    let panel = renderPanel({ readOnly: true });

    const inertWrapper = visitElements(panel, (element) => element.props.inert === true);
    expect(inertWrapper).not.toBeNull();

    expect(hasAccount(panel, customId)).toBe(true);
    expect(accountGroups(panel)?.props.readOnly).toBe(true);

    panel = openAccountSettings(customId, { readOnly: true });
    expect(accountEditor(panel, customId)?.props.readOnly).toBe(true);

    const notice = visitElements(panel, (element) => element.props.title === "Limited permissions");
    expect(notice).not.toBeNull();

    expect(visitElements(panel, isRefreshButton)).not.toBeNull();
    expect(visitElements(panel, isAddProviderButton)).toBeNull();
  });

  it("keeps the editable layout interactive when not read only", () => {
    atoms.providers = [provider()];
    const panel = renderPanel();
    expect(visitElements(panel, (element) => element.props.inert === true)).toBeNull();
    expect(
      visitElements(panel, (element) => element.props.title === "Limited permissions"),
    ).toBeNull();
    expect(visitElements(panel, isRefreshButton)).not.toBeNull();
    expect(visitElements(panel, isAddProviderButton)).not.toBeNull();
  });

  it("removes an open add-instance dialog when the provider grant is revoked", () => {
    let panel = renderPanel();
    const tiles = visitElements(panel, (element) => typeof element.props.onMore === "function");
    if (!tiles) throw new Error("Missing More services action.");
    (tiles.props.onMore as () => void)();
    panel = renderPanel();
    expect(
      visitElements(panel, (element) => element.type === AddProviderInstanceDialog),
    ).not.toBeNull();

    commands.canManageProviders = false;
    panel = renderPanel({ readOnly: true });
    expect(
      visitElements(panel, (element) => element.type === AddProviderInstanceDialog),
    ).toBeNull();
    expect(settingsState.updateSettings).not.toHaveBeenCalled();
  });

  it("keeps Advanced visible when search targets the provider health interval", () => {
    let panel = renderPanel();
    expect(visitElements(panel, (element) => element.props.title === "Advanced")).not.toBeNull();
    expect(
      visitElements(panel, (element) => element.props.id === "provider-health-check-interval"),
    ).not.toBeNull();

    settingsSearchState.targetId = "provider-health-check-interval";
    panel = renderPanel();
    expect(visitElements(panel, (element) => element.props.title === "Advanced")).not.toBeNull();
    expect(
      visitElements(panel, (element) => element.props.id === "provider-health-check-interval"),
    ).not.toBeNull();
  });

  it("deletes and resets provider configuration without erasing shared preferences", async () => {
    settingsState.value = {
      ...DEFAULT_UNIFIED_SETTINGS,
      providerInstances: {
        [codexId]: {
          driver: ProviderDriverKind.make("codex"),
          enabled: false,
        },
        [customId]: {
          driver: ProviderDriverKind.make("codex"),
          enabled: true,
        },
      },
      providerModelPreferences: {
        [customId]: { hiddenModels: ["hidden"], modelOrder: ["model"] },
      },
      favorites: [{ provider: customId, model: "favorite" }],
    };
    let panel = openAccountSettings(customId);
    const customCard = accountEditor(panel, customId);
    expect(customCard).not.toBeNull();
    (customCard?.props.onDelete as (() => void) | undefined)?.();
    await flushPromises();

    expect(settingsState.mutateProviderInstance).toHaveBeenLastCalledWith({
      operation: "remove",
      instanceId: customId,
    });

    settingsState.mutateProviderInstance.mockClear();
    panel = openAccountSettings(codexId);
    const defaultCard = accountEditor(panel, codexId);
    const resetAction = defaultCard?.props.headerAction;
    const resetButton = visitElements(
      resetAction,
      (element) => typeof element.props.onClick === "function",
    );
    expect(resetButton).not.toBeNull();
    (resetButton?.props.onClick as (() => void) | undefined)?.();
    await flushPromises();

    const [resetMutation, resetPatch] = settingsState.mutateProviderInstance.mock.lastCall ?? [];
    expect(resetMutation).toEqual({ operation: "remove", instanceId: codexId });
    // Removing the instance is the whole reset; shared preferences stay untouched.
    expect(resetPatch ?? {}).toEqual({});
  });

  it("updates one provider instance without sending a stale whole map", async () => {
    settingsState.value = {
      ...DEFAULT_UNIFIED_SETTINGS,
      providerInstances: {
        [customId]: {
          driver: ProviderDriverKind.make("codex"),
          enabled: true,
          displayName: "Work",
        },
      },
    };
    const card = accountEditor(openAccountSettings(customId), customId);
    const next = {
      driver: ProviderDriverKind.make("codex"),
      enabled: false,
      displayName: "Work",
    };
    (card?.props.onUpdate as ((instance: typeof next) => void) | undefined)?.(next);
    await flushPromises();

    expect(settingsState.mutateProviderInstance).toHaveBeenCalledWith(
      { operation: "upsert", instanceId: customId, instance: next },
      {},
    );
  });

  it("lets the server decide managed ACP cleanup after an atomic delete", async () => {
    const firstId = ProviderInstanceId.make("acpRegistry_kilo_one");
    const secondId = ProviderInstanceId.make("acpRegistry_kilo_two");
    const registryInstance = {
      driver: ProviderDriverKind.make("acpRegistry"),
      enabled: true,
      config: { agentId: "kilo" },
    };
    settingsState.value = {
      ...DEFAULT_UNIFIED_SETTINGS,
      providerInstances: {
        [firstId]: registryInstance,
        [secondId]: registryInstance,
      },
    };
    const card = accountEditor(openAccountSettings(firstId), firstId);
    (card?.props.onDelete as (() => void) | undefined)?.();
    await flushPromises();

    expect(settingsState.mutateProviderInstance).toHaveBeenCalledWith({
      operation: "remove",
      instanceId: firstId,
    });
    expect(commands.uninstall).toHaveBeenCalledWith({
      environmentId,
      input: { agentId: "kilo" },
    });
  });

  it("keeps the signed-in ACP account visible when login methods are no longer advertised", () => {
    const instanceId = ProviderInstanceId.make("acpRegistry_devin");
    settingsState.value = {
      ...DEFAULT_UNIFIED_SETTINGS,
      providerInstances: {
        [instanceId]: {
          driver: ProviderDriverKind.make("acpRegistry"),
          enabled: true,
          config: { agentId: "devin" },
        },
      },
    };
    atoms.providers = [
      {
        ...provider(),
        instanceId,
        driver: ProviderDriverKind.make("acpRegistry"),
        auth: { status: "authenticated", canLogout: false },
        setup: { canAuthenticate: false, canInstall: false },
      },
    ];
    const panel = renderPanel({ targetInstanceId: instanceId });
    expect(
      visitElements(
        panel,
        (element) =>
          typeof element.type === "function" &&
          element.type.name === "ProviderAuthenticationSection",
      ),
    ).not.toBeNull();
  });

  it("routes explicit ACP browser authentication consent to the selected environment", async () => {
    const instanceId = ProviderInstanceId.make("acpRegistry_antigravity");
    const action = {
      elicitationId: "google-login-1",
      url: "https://accounts.google.com/login",
      message: "Continue with Google",
    };
    settingsState.value = {
      ...DEFAULT_UNIFIED_SETTINGS,
      providerInstances: {
        [instanceId]: {
          driver: ProviderDriverKind.make("acpRegistry"),
          enabled: true,
          config: { agentId: "antigravity" },
        },
      },
    };
    atoms.providers = [
      {
        ...provider(),
        instanceId,
        driver: ProviderDriverKind.make("acpRegistry"),
        auth: { status: "unauthenticated", action },
      },
    ];

    const card = accountEditor(openAccountSettings(instanceId), instanceId);
    (card?.props.onAcceptUrlAuth as ((candidate: typeof action) => void) | undefined)?.(action);
    await flushPromises();

    expect(commands.acceptUrlAuth).toHaveBeenCalledWith({
      environmentId,
      input: { instanceId, elicitationId: action.elicitationId },
    });
  });
});
