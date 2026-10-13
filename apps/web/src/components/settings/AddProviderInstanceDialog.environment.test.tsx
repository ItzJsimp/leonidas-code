import { EnvironmentId, ProviderDriverKind, type AcpRegistrySearchAgent } from "@t3tools/contracts";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { visitElements } from "../../test/reactElementTree";
import { reactHookHarness as hooks } from "../../test/reactHookHarness";

const actions = vi.hoisted(() => ({
  update: vi.fn(),
  toast: vi.fn(),
  onOpenChange: vi.fn(),
  onCreated: vi.fn(),
  canManageProviders: true,
}));

const settingsHooks = vi.hoisted(() => ({
  read: vi.fn(() => ({ providerInstances: {} })),
  mutate: vi.fn(),
  useMutation: vi.fn(),
}));

const serverState = vi.hoisted(() => ({ providers: [] as unknown[] }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const { reactHookHarness } = await import("../../test/reactHookHarness");
  return {
    ...actual,
    useMemo: reactHookHarness.useMemo,
    useState: reactHookHarness.useState,
  };
});

vi.mock("react/compiler-runtime", async () => {
  const { reactHookHarness } = await import("../../test/reactHookHarness");
  return { c: reactHookHarness.useMemoCache };
});

vi.mock("@effect/atom-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@effect/atom-react")>()),
  useAtomValue: () => serverState.providers,
}));

vi.mock("@t3tools/client-runtime/state/runtime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@t3tools/client-runtime/state/runtime")>()),
  squashAtomCommandFailure: () => new Error("The settings update failed."),
}));

vi.mock("../../hooks/useSettings", () => ({
  useEnvironmentSettings: settingsHooks.read,
  usePersistEnvironmentProviderInstanceMutation: settingsHooks.useMutation,
}));

vi.mock("../../state/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../state/session")>();
  const hasScope = (environmentId: EnvironmentId, scope: string) =>
    environmentId === "remote-device" && scope === "providers:manage" && actions.canManageProviders;
  return { ...actual, useEnvironmentScope: hasScope, readEnvironmentScope: hasScope };
});

vi.mock("../ui/toast", () => ({ toastManager: { add: actions.toast } }));

import { AddProviderInstanceDialog } from "./AddProviderInstanceDialog";

const remoteEnvironmentId = EnvironmentId.make("remote-device");
const preparedAgent: AcpRegistrySearchAgent = {
  id: "kilo",
  name: "Kilo Code",
  version: "4.2.0",
  description: "Kilo ACP agent",
  authors: ["Kilo"],
  license: "Apache-2.0",
  website: null,
  repository: null,
  icon: "https://cdn.agentclientprotocol.com/registry/v1/latest/kilo.svg",
  distribution: "binary",
  integrity: "sha256",
};

function render(onOpenChange = actions.onOpenChange) {
  hooks.beginRender();
  return AddProviderInstanceDialog({
    open: true,
    environmentId: remoteEnvironmentId,
    environmentLabel: "Remote device",
    onOpenChange,
    onCreated: actions.onCreated,
  });
}

function findByChildren(tree: ReturnType<typeof render>, children: string) {
  const result = visitElements(tree, (element) => element.props.children === children);
  expect(result).not.toBeNull();
  return result!;
}

function findByName(tree: unknown, name: string) {
  return visitElements(
    tree,
    (element) => typeof element.type === "function" && element.type.name === name,
  );
}

function button(dialog: unknown, label: string) {
  const element = visitElements(
    dialog,
    (entry) => entry.props.children === label && typeof entry.props.onClick === "function",
  );
  if (!element) throw new Error(`Missing button: ${label}`);
  return element;
}

function pickDriver(driver: string, component = "HeadlineProviderCards") {
  const tree = render();
  const cards = findByName(tree, component);
  (cards!.props.onSelect as (value: string) => void)(driver);
}

function typeName(value: string) {
  const tree = render();
  const input = visitElements(tree, (element) => element.props.id === "add-provider-label");
  (input!.props.onChange as (event: { target: { value: string } }) => void)({
    target: { value },
  });
}

async function selectPreparedAcp() {
  const search = findByName(render(), "AcpRegistrySearchStep");
  expect(search).not.toBeNull();
  (search?.props.onPrepared as ((agent: AcpRegistrySearchAgent) => void) | undefined)?.(
    preparedAgent,
  );
}

describe("AddProviderInstanceDialog environment routing", () => {
  beforeEach(() => {
    hooks.reset();
    actions.canManageProviders = true;
    actions.toast.mockReset();
    actions.onOpenChange.mockReset();
    actions.onCreated.mockReset();
    serverState.providers = [];
    settingsHooks.read.mockReset().mockReturnValue({ providerInstances: {} });
    settingsHooks.mutate.mockReset().mockResolvedValue({ _tag: "Success", value: {} });
    settingsHooks.useMutation.mockReset().mockReturnValue(settingsHooks.mutate);
  });

  it("shows the plain title, step text and Connect button with Claude preselected", () => {
    const tree = render();
    expect(visitElements(tree, (e) => e.props.title === "Connect an AI account")).not.toBeNull();
    expect(findByName(tree, "HeadlineProviderCards")?.props.value).toBe("claudeAgent");
    expect(button(tree, "Connect").props.disabled).toBe(false);
    expect(findByChildren(tree, "Advanced options")).not.toBeNull();
    expect(findByChildren(tree, "More providers")).not.toBeNull();
  });

  it("connects the first Claude account on the default folder and moves to sign-in", async () => {
    (button(render(), "Connect").props.onClick as () => void)();
    await Promise.resolve();
    await Promise.resolve();
    expect(settingsHooks.mutate).toHaveBeenCalledWith({
      operation: "create",
      instanceId: "claudeAgent_2",
      instance: { driver: "claudeAgent", enabled: true, displayName: "Claude" },
    });
    const auth = findByName(render(), "ProviderWizardAuthenticationStep");
    expect(auth?.props.instanceId).toBe("claudeAgent_2");
    expect(auth?.props.driver).toBe("claudeAgent");
    expect(auth?.props.displayName).toBe("Claude");
    expect(typeof auth?.props.onRemove).toBe("function");
    // Selection is deferred until the dialog closes.
    expect(actions.onCreated).not.toHaveBeenCalled();
  });

  it("isolates a second Claude account in its own config folder", async () => {
    settingsHooks.read.mockReturnValue({
      providerInstances: {
        claudeAgent_2: { driver: "claudeAgent", displayName: "Claude" },
      },
    });
    typeName("Justine");
    (button(render(), "Connect").props.onClick as () => void)();
    await Promise.resolve();
    await Promise.resolve();
    expect(settingsHooks.mutate).toHaveBeenCalledWith({
      operation: "create",
      instanceId: "claudeAgent_justine",
      instance: {
        driver: "claudeAgent",
        enabled: true,
        displayName: "Justine",
        config: { homePath: "~/.claude-justine" },
      },
    });
  });

  it("numbers the default name for a second account when the name is left blank", async () => {
    settingsHooks.read.mockReturnValue({
      providerInstances: {
        claudeAgent_2: {
          driver: "claudeAgent",
          displayName: "Claude",
          config: { homePath: "~/.claude-claude-2" },
        },
      },
    });
    (button(render(), "Connect").props.onClick as () => void)();
    await Promise.resolve();
    await Promise.resolve();
    expect(settingsHooks.mutate).toHaveBeenCalledWith({
      operation: "create",
      instanceId: "claudeAgent_3",
      instance: {
        driver: "claudeAgent",
        enabled: true,
        displayName: "Claude 2",
        config: { homePath: "~/.claude-claude-2-2" },
      },
    });
  });

  it("hands ChatGPT sign-in to the managed Codex account dialog", () => {
    pickDriver("codex");
    (button(render(), "Connect").props.onClick as () => void)();
    const tree = render();
    expect(findByName(tree, "AddManagedCodexAccountDialog")).not.toBeNull();
    expect(settingsHooks.mutate).not.toHaveBeenCalled();
  });

  it("creates another provider with its default identity without typing", async () => {
    pickDriver("grok", "MoreProviderCards");
    (button(render(), "Connect").props.onClick as () => void)();
    await Promise.resolve();
    expect(settingsHooks.mutate).toHaveBeenCalledWith({
      operation: "create",
      instanceId: "grok",
      instance: { driver: "grok", enabled: true, displayName: "Grok" },
    });
  });

  it("uses an installed Codex from Advanced options with an unused identity", async () => {
    settingsHooks.read.mockReturnValue({
      providerInstances: { codex_2: { driver: "codex", enabled: false } },
    });
    pickDriver("codex");
    (button(render(), "Use installed Codex").props.onClick as () => void)();
    await Promise.resolve();
    expect(settingsHooks.mutate).toHaveBeenCalledWith({
      operation: "create",
      instanceId: "codex_3",
      instance: {
        driver: "codex",
        enabled: true,
        displayName: "Codex",
        config: { setupMode: "existing" },
      },
    });
  });

  it("reads and writes settings through the supplied environment", () => {
    render();

    expect(settingsHooks.read).toHaveBeenCalledWith(remoteEnvironmentId);
    expect(settingsHooks.useMutation).toHaveBeenCalledWith(remoteEnvironmentId);
  });

  it("says what failed and offers Try again when creating the account fails", async () => {
    settingsHooks.mutate.mockResolvedValueOnce({ _tag: "Failure", cause: new Error("Conflict") });
    (button(render(), "Connect").props.onClick as () => void)();
    await Promise.resolve();
    await Promise.resolve();
    const tree = render();
    expect(findByChildren(tree, "Couldn't add this account.")).not.toBeNull();
    expect(button(tree, "Try again")).not.toBeNull();
    expect(actions.onOpenChange).not.toHaveBeenCalled();
  });

  it("keeps a half-set-up account and selects it when the dialog closes mid-sign-in", async () => {
    (button(render(), "Connect").props.onClick as () => void)();
    await Promise.resolve();
    await Promise.resolve();
    const auth = findByName(render(), "ProviderWizardAuthenticationStep");
    (auth!.props.onFinish as () => void)();
    expect(actions.onCreated).toHaveBeenCalledWith("claudeAgent_2");
    expect(actions.onOpenChange).toHaveBeenCalledWith(false);
    expect(settingsHooks.mutate).toHaveBeenCalledTimes(1);
  });

  it("removes the new account on request and closes without selecting it", async () => {
    (button(render(), "Connect").props.onClick as () => void)();
    await Promise.resolve();
    await Promise.resolve();
    const auth = findByName(render(), "ProviderWizardAuthenticationStep");
    (auth!.props.onRemove as () => void)();
    await Promise.resolve();
    await Promise.resolve();
    expect(settingsHooks.mutate).toHaveBeenLastCalledWith({
      operation: "remove",
      instanceId: "claudeAgent_2",
    });
    expect(actions.onOpenChange).toHaveBeenCalledWith(false);
    expect(actions.onCreated).not.toHaveBeenCalled();
  });

  it("awaits an atomic create before closing and retains prepared ACP metadata", async () => {
    const onOpenChange = vi.fn();
    let resolveMutation!: (value: { readonly _tag: "Success"; readonly value: unknown }) => void;
    settingsHooks.mutate.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMutation = resolve;
      }),
    );
    await selectPreparedAcp();

    const identityStep = render(onOpenChange);
    expect(
      visitElements(identityStep, (element) => {
        const content = JSON.stringify(element.props.children);
        return content?.includes("4.2.0") === true && content.includes("binary");
      }),
    ).not.toBeNull();
    (
      findByChildren(identityStep, "Continue to sign-in").props.onClick as (() => void) | undefined
    )?.();
    expect(settingsHooks.mutate).toHaveBeenCalledWith({
      operation: "create",
      instanceId: "acpRegistry_kilo_code",
      instance: {
        driver: ProviderDriverKind.make("acpRegistry"),
        enabled: true,
        displayName: "Kilo Code",
        config: {
          agentId: "kilo",
          distribution: "auto",
          registryIconUrl: "https://cdn.agentclientprotocol.com/registry/v1/latest/kilo.svg",
        },
      },
    });
    expect(onOpenChange).not.toHaveBeenCalled();

    resolveMutation({ _tag: "Success", value: {} });
    await Promise.resolve();
    await Promise.resolve();
    expect(onOpenChange).not.toHaveBeenCalled();
    const signInStep = render(onOpenChange);
    const authentication = findByName(signInStep, "ProviderWizardAuthenticationStep");
    expect(authentication?.props.instanceId).toBe("acpRegistry_kilo_code");
    expect(authentication?.props.environmentId).toBe(remoteEnvironmentId);
    expect(authentication?.props.onRemove).toBeUndefined();
    expect(settingsHooks.mutate).toHaveBeenCalledTimes(1);
    (authentication!.props.onFinish as () => void)();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("configures a manually entered registry agent from the first provider screen", async () => {
    let tree = render();
    const search = findByName(tree, "AcpRegistrySearchStep");
    (search!.props.onManualConfiguration as () => void)();
    tree = render();
    const configuration = visitElements(
      tree,
      (element) => element.props.idPrefix === "add-provider-acpRegistry-manual",
    );
    (configuration!.props.onChange as (value: Record<string, unknown>) => void)({
      agentId: "devin",
    });
    tree = render();
    (findByChildren(tree, "Next").props.onClick as () => void)();
    tree = render();
    (findByChildren(tree, "Continue to sign-in").props.onClick as () => void)();
    await Promise.resolve();
    await Promise.resolve();
    expect(settingsHooks.mutate).toHaveBeenCalledWith({
      operation: "create",
      instanceId: "acpRegistry_custom",
      instance: {
        driver: "acpRegistry",
        enabled: true,
        config: { agentId: "devin" },
      },
    });
    expect(findByName(render(), "ProviderWizardAuthenticationStep")).not.toBeNull();
  });

  it("creates a local command in the selected environment without a sign-in step", async () => {
    const onOpenChange = vi.fn();
    let tree = render(onOpenChange);
    const search = findByName(tree, "AcpRegistrySearchStep");
    (search!.props.onLocalConfiguration as () => void)();
    tree = render(onOpenChange);
    (findByChildren(tree, "Next").props.onClick as () => void)();
    tree = render(onOpenChange);
    expect(findByChildren(tree, "Executable is required.")).not.toBeNull();
    expect(settingsHooks.mutate).not.toHaveBeenCalled();

    const configuration = visitElements(
      tree,
      (element) => element.props.idPrefix === "add-provider-acpRegistry-manual",
    );
    const commandArgs = ["--profile", "acp", " literal $(value) ; ", ""];
    (configuration!.props.onChange as (value: Record<string, unknown>) => void)({
      source: "local",
      commandPath: "dsh",
      commandArgs,
    });
    const environmentEditor = findByName(tree, "ProviderEnvironmentSection");
    const environment = [{ name: "DSH_PROFILE", value: "work", sensitive: false }];
    (environmentEditor!.props.onChange as (value: typeof environment) => void)(environment);
    tree = render(onOpenChange);
    (findByChildren(tree, "Next").props.onClick as () => void)();
    tree = render(onOpenChange);
    const label = visitElements(tree, (element) => element.props.id === "add-provider-label");
    (label!.props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: "Deepseek Harness" },
    });
    tree = render(onOpenChange);
    (findByChildren(tree, "Add instance").props.onClick as () => void)();
    await Promise.resolve();
    await Promise.resolve();

    expect(settingsHooks.useMutation).toHaveBeenCalledWith(remoteEnvironmentId);
    expect(settingsHooks.mutate).toHaveBeenCalledWith({
      operation: "create",
      instanceId: "acpRegistry_deepseek_harness",
      instance: {
        driver: "acpRegistry",
        enabled: true,
        displayName: "Deepseek Harness",
        config: { source: "local", commandPath: "dsh", commandArgs },
        environment,
      },
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(findByName(render(onOpenChange), "ProviderWizardAuthenticationStep")).toBeNull();
  });

  it("keeps the dialog open when the atomic upsert fails", async () => {
    settingsHooks.mutate.mockResolvedValueOnce({ _tag: "Failure", cause: new Error("Conflict") });
    const onOpenChange = vi.fn();
    await selectPreparedAcp();

    const identityStep = render(onOpenChange);
    (
      findByChildren(identityStep, "Continue to sign-in").props.onClick as (() => void) | undefined
    )?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("adds a named instance with the selected environment's provider grant alone", async () => {
    pickDriver("codex");
    typeName("Work");
    (button(render(), "Use installed Codex").props.onClick as () => void)();

    await Promise.resolve();
    expect(settingsHooks.mutate).toHaveBeenCalledWith({
      operation: "create",
      instanceId: "codex_work",
      instance: {
        driver: "codex",
        enabled: true,
        displayName: "Work",
        config: { setupMode: "existing" },
      },
    });
    expect(findByName(render(), "ProviderWizardAuthenticationStep")).not.toBeNull();
  });

  it("rejects a queued connect after the provider grant is revoked", () => {
    const connect = button(render(), "Connect").props.onClick as () => void;
    actions.canManageProviders = false;
    connect();

    expect(settingsHooks.mutate).not.toHaveBeenCalled();
    expect(actions.toast).not.toHaveBeenCalled();
    expect(actions.onOpenChange).not.toHaveBeenCalled();
    expect(button(render(), "Connect").props.disabled).toBe(true);
  });

  it("keeps a denied draft available when the provider grant arrives", async () => {
    actions.canManageProviders = false;
    let dialog = render();
    (button(dialog, "Connect").props.onClick as () => void)();
    expect(settingsHooks.mutate).not.toHaveBeenCalled();

    actions.canManageProviders = true;
    dialog = render();
    expect(button(dialog, "Connect").props.disabled).toBe(false);
    (button(dialog, "Connect").props.onClick as () => void)();
    await Promise.resolve();
    expect(settingsHooks.mutate).toHaveBeenCalledOnce();
  });
});
