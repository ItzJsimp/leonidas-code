import { describe, expect, it, vi } from "vite-plus/test";
import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import { DEFAULT_UNIFIED_SETTINGS } from "@t3tools/contracts/settings";
import { deriveProviderInstanceEntries } from "../../providerInstances";
import { continueWithProvider, getProviderFailoverTargets } from "./providerFailover";

const current = { instanceId: ProviderInstanceId.make("claudeAgent"), model: "claude-sonnet" };
function provider(id = "codex", overrides: Partial<ServerProvider> = {}): ServerProvider {
  return {
    instanceId: ProviderInstanceId.make(id),
    driver: ProviderDriverKind.make("codex"),
    enabled: true,
    installed: true,
    version: null,
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: "2026-10-10T00:00:00.000Z",
    slashCommands: [],
    skills: [],
    models: [
      { slug: "gpt-test", name: "Test model", isCustom: false, isDefault: true, capabilities: {} },
    ],
    ...overrides,
  };
}
const targets = (providers: ServerProvider[], supportsHandoff = true) =>
  getProviderFailoverTargets({
    entries: deriveProviderInstanceEntries(providers),
    settings: DEFAULT_UNIFIED_SETTINGS,
    current,
    supportsHandoff,
  });

describe("provider failover", () => {
  it("offers a ready alternate subscription with its catalog default", () => {
    expect(targets([provider()])).toEqual([
      {
        label: "Codex",
        modelSelection: { instanceId: "codex", model: "gpt-test" },
      },
    ]);
  });

  it("does not offer the current, disabled, unavailable, uninstalled or unready provider", () => {
    expect(
      targets([
        provider("claudeAgent", { driver: ProviderDriverKind.make("claudeAgent") }),
        provider("disabled", { enabled: false }),
        provider("unavailable", { availability: "unavailable" }),
        provider("missing", { installed: false }),
        provider("unready", { status: "error" }),
        provider("empty", { models: [] }),
        provider("paid", { driver: ProviderDriverKind.make("openrouter") }),
      ]),
    ).toEqual([]);
    expect(targets([provider()], false)).toEqual([]);
  });

  it("excludes another instance sharing the limited account and a known exhausted quota", () => {
    const quota = {
      checkedAt: "2026-10-10T00:00:00.000Z",
      windows: [
        {
          id: "five_hour",
          kind: "session" as const,
          label: "Five hour",
          usedPercent: 100,
          resetsAt: "2026-10-11T00:00:00.000Z",
        },
      ],
    };
    expect(
      targets([
        provider("claudeAgent", {
          driver: ProviderDriverKind.make("claudeAgent"),
          continuation: { groupKey: "shared" },
        }),
        provider("same-account", { continuation: { groupKey: "shared" } }),
        provider("exhausted", { usageLimits: quota }),
      ]),
    ).toEqual([]);
  });

  it("uses visible models and excludes targets when every model is hidden", () => {
    const entries = deriveProviderInstanceEntries([provider()]);
    expect(
      getProviderFailoverTargets({
        entries,
        current,
        supportsHandoff: true,
        settings: {
          ...DEFAULT_UNIFIED_SETTINGS,
          providerModelPreferences: {
            [ProviderInstanceId.make("codex")]: { hiddenModels: ["gpt-test"], modelOrder: [] },
          },
        },
      }),
    ).toEqual([]);
  });

  it("starts one continuation while repeated clicks are pending, then permits retry after failure", async () => {
    let reject!: (cause: Error) => void;
    const continueWith = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((_, fail) => {
            reject = fail;
          }),
      )
      .mockResolvedValue(undefined);
    const [target] = targets([provider()]);
    const input = {
      pending: { current: false },
      targets: [target!],
      target: target!,
      continueWith,
    };
    const first = continueWithProvider(input);
    await continueWithProvider(input);
    expect(continueWith).toHaveBeenCalledTimes(1);
    reject(new Error("Provider disconnected"));
    await expect(first).rejects.toThrow("Provider disconnected");
    await continueWithProvider(input);
    expect(continueWith).toHaveBeenCalledTimes(2);
  });

  it("rechecks availability at click time", async () => {
    const [target] = targets([provider()]);
    const continueWith = vi.fn();
    await expect(
      continueWithProvider({
        pending: { current: false },
        targets: [],
        target: target!,
        continueWith,
      }),
    ).rejects.toThrow("no longer available");
    expect(continueWith).not.toHaveBeenCalled();
  });
});
