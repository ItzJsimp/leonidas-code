import { describe, expect, it } from "vite-plus/test";

import {
  collectClaudeHomePaths,
  deriveAccountLabel,
  deriveAvailableInstanceId,
  deriveClaudeHomePath,
  findDuplicateAccount,
  getProviderIdentityDraft,
  isClaudeDefaultSlotInUse,
  isConfiguredAcpRegistryAgent,
  resolveAcpRegistryWizardNavigation,
  resolveWizardNavigation,
  updateProviderIdentityDraft,
} from "./AddProviderInstanceDialog.logic";

describe("resolveWizardNavigation", () => {
  const invalidId = { instanceIdError: "Instance ID is required." };
  const validId = { instanceIdError: null };

  it("allows moving from Driver to Identity before the instance id is valid", () => {
    expect(resolveWizardNavigation(0, 1, 3, invalidId)).toEqual({ kind: "navigate", step: 1 });
  });

  it("blocks Next from Identity to Config while the instance id is invalid", () => {
    expect(resolveWizardNavigation(1, 2, 3, invalidId)).toEqual({
      kind: "blocked",
      step: 1,
      error: "Instance ID is required.",
    });
  });

  it("stops a direct Driver-to-Config skip at Identity and surfaces its error", () => {
    expect(resolveWizardNavigation(0, 2, 3, invalidId)).toEqual({
      kind: "blocked",
      step: 1,
      error: "Instance ID is required.",
    });
  });

  it("allows advancing and skipping forward once the instance id is valid", () => {
    expect(resolveWizardNavigation(1, 2, 3, validId)).toEqual({ kind: "navigate", step: 2 });
    expect(resolveWizardNavigation(0, 2, 3, validId)).toEqual({ kind: "navigate", step: 2 });
  });

  it("always preserves backward Driver and Identity navigation", () => {
    expect(resolveWizardNavigation(2, 1, 3, invalidId)).toEqual({ kind: "navigate", step: 1 });
    expect(resolveWizardNavigation(2, 0, 3, invalidId)).toEqual({ kind: "navigate", step: 0 });
    expect(resolveWizardNavigation(1, 0, 3, invalidId)).toEqual({ kind: "navigate", step: 0 });
  });

  it("clamps requested steps to the wizard bounds", () => {
    expect(resolveWizardNavigation(2, 8, 3, validId)).toEqual({ kind: "navigate", step: 2 });
    expect(resolveWizardNavigation(0, -1, 3, invalidId)).toEqual({ kind: "navigate", step: 0 });
  });
});

describe("ACP Registry wizard", () => {
  it("requires a prepared result or valid manual configuration before Identity", () => {
    expect(
      resolveAcpRegistryWizardNavigation(0, 1, {
        instanceIdError: null,
        selectionError: "Select an ACP or configure one manually.",
      }),
    ).toEqual({
      kind: "blocked",
      step: 0,
      error: "Select an ACP or configure one manually.",
    });

    expect(
      resolveAcpRegistryWizardNavigation(0, 1, {
        instanceIdError: null,
        selectionError: null,
      }),
    ).toEqual({ kind: "navigate", step: 1 });
  });

  it("derives a collision-free instance id without exceeding the slug limit", () => {
    const derive = (label: string) => `acpRegistry_${label}`;
    const existing = new Set(["acpRegistry_gemini", "acpRegistry_gemini_2"]);

    expect(deriveAvailableInstanceId(derive, "gemini", existing)).toBe("acpRegistry_gemini_3");

    const longBase = `acpRegistry_${"a".repeat(48)}`;
    expect(deriveAvailableInstanceId(() => longBase, "ignored", new Set([longBase]))).toHaveLength(
      62,
    );
  });

  it("only marks matching ACP Registry instances as already added", () => {
    const instances = {
      codex: { driver: "codex", config: { agentId: "gemini" } },
      registry: { driver: "acpRegistry", config: { agentId: "gemini" } },
    };

    expect(isConfiguredAcpRegistryAgent(instances, "gemini")).toBe(true);
    expect(isConfiguredAcpRegistryAgent(instances, "codex")).toBe(false);
  });

  it("keeps registry-prefilled identity separate from other drivers", () => {
    const registryDrafts = updateProviderIdentityDraft({}, "acpRegistry", {
      label: "Gemini CLI",
      instanceIdOverride: "acpRegistry_gemini_cli",
    });

    expect(getProviderIdentityDraft(registryDrafts, "codex")).toEqual({
      label: "",
      accentColor: "",
      instanceIdOverride: null,
    });

    const drafts = updateProviderIdentityDraft(registryDrafts, "codex", {
      label: "Work",
      instanceIdOverride: "codex_work",
    });
    expect(getProviderIdentityDraft(drafts, "acpRegistry")).toMatchObject({
      label: "Gemini CLI",
      instanceIdOverride: "acpRegistry_gemini_cli",
    });
  });
});

describe("deriveAccountLabel", () => {
  it("uses the provider name first, then numbers later accounts", () => {
    expect(deriveAccountLabel("Claude", [])).toBe("Claude");
    expect(deriveAccountLabel("Claude", ["Claude"])).toBe("Claude 2");
    expect(deriveAccountLabel("Claude", ["claude", "Claude 2"])).toBe("Claude 3");
    expect(deriveAccountLabel("Claude", ["Work"])).toBe("Claude");
  });
});

describe("deriveClaudeHomePath", () => {
  const base = { label: "Justine", defaultSlotInUse: true, existingHomePaths: [] as string[] };

  it("leaves the first Claude account on the default folder", () => {
    expect(deriveClaudeHomePath({ ...base, defaultSlotInUse: false })).toBeUndefined();
  });

  it("isolates a later account in a folder named after its label", () => {
    expect(deriveClaudeHomePath(base)).toBe("~/.claude-justine");
    expect(deriveClaudeHomePath({ ...base, label: "  Work & Co! " })).toBe("~/.claude-work-co");
    expect(deriveClaudeHomePath({ ...base, label: "???" })).toBe("~/.claude-account");
  });

  it("never reuses a folder another instance already claims", () => {
    expect(deriveClaudeHomePath({ ...base, existingHomePaths: ["~/.claude-justine"] })).toBe(
      "~/.claude-justine-2",
    );
    expect(
      deriveClaudeHomePath({
        ...base,
        existingHomePaths: ["~/.Claude-Justine/", "~\\.claude-justine-2"],
      }),
    ).toBe("~/.claude-justine-3");
  });
});

describe("isClaudeDefaultSlotInUse and collectClaudeHomePaths", () => {
  it("is free on a clean install and in use once a Claude instance exists or the default is signed in", () => {
    expect(isClaudeDefaultSlotInUse({}, [])).toBe(false);
    expect(
      isClaudeDefaultSlotInUse({}, [
        { instanceId: "claudeAgent", driver: "claudeAgent", auth: { status: "unauthenticated" } },
      ]),
    ).toBe(false);
    expect(isClaudeDefaultSlotInUse({ claudeAgent_2: { driver: "claudeAgent" } }, [])).toBe(true);
    expect(
      isClaudeDefaultSlotInUse({}, [
        { instanceId: "claudeAgent", driver: "claudeAgent", auth: { status: "authenticated" } },
      ]),
    ).toBe(true);
    expect(isClaudeDefaultSlotInUse({ codex_2: { driver: "codex" } }, [])).toBe(false);
  });

  it("collects home paths from Claude instances only", () => {
    expect(
      collectClaudeHomePaths({
        a: { driver: "claudeAgent", config: { homePath: "~/.claude-a" } },
        b: { driver: "claudeAgent", config: {} },
        c: { driver: "codex", config: { homePath: "~/.codex-c" } },
      }),
    ).toEqual(["~/.claude-a"]);
  });
});

describe("findDuplicateAccount", () => {
  const provider = (
    instanceId: string,
    email: string | undefined,
    extra: { workspaceId?: string; status?: string; displayName?: string } = {},
  ) => ({
    instanceId,
    driver: "claudeAgent",
    ...(extra.displayName ? { displayName: extra.displayName } : {}),
    auth: {
      status: extra.status ?? "authenticated",
      ...(email ? { email } : {}),
      ...(extra.workspaceId ? { workspaceId: extra.workspaceId } : {}),
    },
  });

  it("names the other instance when the same email is already connected", () => {
    expect(
      findDuplicateAccount(
        [
          provider("claudeAgent", "Jake@x.com", { displayName: "Claude" }),
          provider("c2", "jake@x.com"),
        ],
        "c2",
      ),
    ).toBe("Claude");
    expect(
      findDuplicateAccount([provider("claudeAgent", "a@x.com"), provider("c2", "a@x.com")], "c2"),
    ).toBe("claudeAgent");
  });

  it("passes different emails, signed-out accounts, unknown emails and other workspaces", () => {
    expect(
      findDuplicateAccount([provider("a", "a@x.com"), provider("b", "b@x.com")], "b"),
    ).toBeNull();
    expect(
      findDuplicateAccount(
        [provider("a", "a@x.com", { status: "unauthenticated" }), provider("b", "a@x.com")],
        "b",
      ),
    ).toBeNull();
    expect(
      findDuplicateAccount([provider("a", "a@x.com"), provider("b", undefined)], "b"),
    ).toBeNull();
    expect(
      findDuplicateAccount(
        [
          provider("a", "a@x.com", { workspaceId: "w1" }),
          provider("b", "a@x.com", { workspaceId: "w2" }),
        ],
        "b",
      ),
    ).toBeNull();
    expect(findDuplicateAccount([provider("a", "a@x.com")], "missing")).toBeNull();
  });

  it("ignores a different driver sharing the email", () => {
    expect(
      findDuplicateAccount(
        [{ ...provider("a", "a@x.com"), driver: "codex" }, provider("b", "a@x.com")],
        "b",
      ),
    ).toBeNull();
  });
});
