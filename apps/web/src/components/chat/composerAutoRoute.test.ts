import { describe, expect, it } from "vite-plus/test";
import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import { DEFAULT_UNIFIED_SETTINGS } from "@t3tools/contracts/settings";
import { getAppModelOptionsForInstance } from "../../modelSelection";
import { deriveProviderInstanceEntries } from "../../providerInstances";
import { buildComposerAutoRouteCandidates } from "./composerAutoRoute";

function provider(id: string, driver: string, overrides: Partial<ServerProvider> = {}) {
  return {
    instanceId: ProviderInstanceId.make(id),
    driver: ProviderDriverKind.make(driver),
    enabled: true,
    installed: true,
    version: null,
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: "2026-10-10T00:00:00.000Z",
    slashCommands: [],
    skills: [],
    models: [
      { slug: `${id}-big`, name: "Big", isCustom: false, capabilities: null },
      { slug: `${id}-small`, name: "Small", isCustom: false, capabilities: null },
    ],
    ...overrides,
  } satisfies ServerProvider;
}

const candidates = (
  providers: ServerProvider[],
  overrides: Partial<Parameters<typeof buildComposerAutoRouteCandidates>[0]> = {},
) => {
  const entries = deriveProviderInstanceEntries(providers);
  return buildComposerAutoRouteCandidates({
    entries,
    modelOptionsByInstance: new Map(
      entries.map((entry) => [
        entry.instanceId,
        getAppModelOptionsForInstance(DEFAULT_UNIFIED_SETTINGS, entry),
      ]),
    ),
    lockedProvider: null,
    lockedContinuationGroupKey: null,
    getModelDisabledReason: () => null,
    ...overrides,
  });
};

const summary = (list: ReturnType<typeof candidates>) =>
  list.map((candidate) => `${candidate.instanceId}:${candidate.models.map((m) => m.slug)}`);

describe("buildComposerAutoRouteCandidates", () => {
  it("offers only ready providers and the models the picker would allow", () => {
    expect(
      summary(
        candidates(
          [
            provider("claude", "claudeAgent"),
            provider("codex", "codex"),
            provider("broken", "codex", { status: "error" }),
            provider("off", "codex", { enabled: false }),
          ],
          {
            getModelDisabledReason: (_instanceId, model) =>
              model === "codex-big" ? "Needs a newer Codex" : null,
          },
        ),
      ),
    ).toEqual(["claude:claude-big,claude-small", "codex:codex-small"]);
  });

  it("keeps a thread that cannot hand off on its locked provider", () => {
    expect(
      summary(
        candidates([provider("claude", "claudeAgent"), provider("codex", "codex")], {
          lockedProvider: ProviderDriverKind.make("codex"),
        }),
      ),
    ).toEqual(["codex:codex-big,codex-small"]);
  });

  it("passes OpenRouter token prices into the Autorouter candidates", () => {
    const openRouter = provider("openrouter", "openrouter", {
      models: [
        {
          slug: "deepseek/deepseek-v4.1-flash",
          name: "DeepSeek V4.1 Flash",
          isCustom: false,
          capabilities: null,
          inputCostPerMillionTokens: 0.25,
          outputCostPerMillionTokens: 1,
        },
      ],
    });

    expect(candidates([openRouter])[0]?.models[0]).toMatchObject({
      slug: "deepseek/deepseek-v4.1-flash",
      inputCostPerMillionTokens: 0.25,
      outputCostPerMillionTokens: 1,
    });
  });
});
