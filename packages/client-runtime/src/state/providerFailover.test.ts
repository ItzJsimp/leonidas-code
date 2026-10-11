import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { selectProviderFailoverTargets } from "./providerFailover.ts";

const current = { instanceId: ProviderInstanceId.make("claudeAgent"), model: "claude-sonnet" };
const source = (overrides: Partial<ServerProvider> = {}) =>
  provider("claudeAgent", { driver: ProviderDriverKind.make("claudeAgent"), ...overrides });

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
  selectProviderFailoverTargets({ providers: [source(), ...providers], current, supportsHandoff });

describe("selectProviderFailoverTargets", () => {
  it("offers a ready alternate subscription with its default model", () => {
    expect(targets([provider()])).toEqual([
      { label: "Codex", modelSelection: { instanceId: "codex", model: "gpt-test" } },
    ]);
  });

  it("falls back to the first model when none is marked default", () => {
    const [target] = targets([
      provider("codex", {
        models: [
          { slug: "first", name: "First", isCustom: false, isDefault: false, capabilities: {} },
        ],
      }),
    ]);
    expect(target?.modelSelection.model).toBe("first");
  });

  it("skips the current, disabled, unavailable, uninstalled, unready and paid providers", () => {
    expect(
      targets([
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

  it("skips an instance sharing the limited account and a known exhausted quota", () => {
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
      selectProviderFailoverTargets({
        providers: [
          source({ continuation: { groupKey: "shared" } }),
          provider("same-account", { continuation: { groupKey: "shared" } }),
          provider("exhausted", { usageLimits: quota }),
        ],
        current,
        supportsHandoff: true,
      }),
    ).toEqual([]);
  });

  it("lists the other driver before another instance of the same driver", () => {
    const labels = targets([
      provider("claude_second", { driver: ProviderDriverKind.make("claudeAgent") }),
      provider("codex"),
    ]).map((target) => target.modelSelection.instanceId);
    expect(labels).toEqual(["codex", "claude_second"]);
  });
});
