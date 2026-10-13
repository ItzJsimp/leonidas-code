import type { ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { routeLightDelegatedTask } from "./lightTaskRouting.ts";

function provider(
  instanceId: string,
  driver: string,
  models: ReadonlyArray<string>,
  overrides: Partial<ServerProvider> = {},
): ServerProvider {
  return {
    instanceId,
    driver,
    auth: { status: "authenticated" },
    supportedRuntimeModes: [],
    models: models.map((slug) => ({ slug, name: slug, isCustom: false, capabilities: null })),
    ...overrides,
  } as unknown as ServerProvider;
}

/** OpenRouter reports zero prices for its free models. */
function freeProvider(models: ReadonlyArray<string>): ServerProvider {
  const base = provider("openrouter", "openrouter", models);
  return {
    ...base,
    models: base.models.map((model) => ({
      ...model,
      inputCostPerMillionTokens: 0,
      outputCostPerMillionTokens: 0,
    })),
  };
}

const providers = [
  provider("claude", "claudeAgent", ["claude-opus-5-5", "claude-haiku-5-5"]),
  provider("codex", "codex", ["gpt-6.1-sol"]),
];

const base = {
  providers,
  isRunnable: () => true,
  runtimeMode: "full-access" as const,
  now: 0,
};

describe("routeLightDelegatedTask", () => {
  it("sends a small task to the cheapest model", () => {
    const selection = routeLightDelegatedTask({ ...base, task: "Fix a typo in README.md" });
    expect(selection?.selection.model).toBe("claude-haiku-5-5");
  });

  it("leaves a larger task on the parent's model", () => {
    expect(
      routeLightDelegatedTask({
        ...base,
        task: "Refactor the orchestrator to separate commands from effects and migrate every adapter.",
      }),
    ).toBeNull();
  });

  it("skips providers that are not runnable or lack the runtime mode", () => {
    const selection = routeLightDelegatedTask({
      ...base,
      task: "Fix a typo in README.md",
      isRunnable: (candidate) => candidate.instanceId !== "claude",
    });
    expect(selection?.selection.instanceId).toBe("codex");

    expect(
      routeLightDelegatedTask({
        ...base,
        task: "Fix a typo in README.md",
        providers: [
          provider("claude", "claudeAgent", ["claude-haiku-5-5"], {
            supportedRuntimeModes: ["approval-required"],
          }),
        ],
      }),
    ).toBeNull();
  });

  const openrouter = freeProvider([
    "meta-llama/llama-3.1-8b-instruct:free",
    "mistralai/mistral-7b-instruct:free",
    "openrouter/free",
    "cohere/north-mini-code:free",
  ]);

  it("prefers a tested free model over the subscription", () => {
    const selection = routeLightDelegatedTask({
      ...base,
      providers: [...providers, openrouter],
      task: "Fix a typo in README.md",
    });
    expect(selection?.selection).toEqual({
      instanceId: "openrouter",
      model: "cohere/north-mini-code:free",
    });
    expect(selection?.fallback?.model).toBe("claude-haiku-5-5");
  });

  it("runs a subscription pick directly, with no fallback", () => {
    const selection = routeLightDelegatedTask({ ...base, task: "Fix a typo in README.md" });
    expect(selection?.fallback).toBeUndefined();
  });

  it("never picks an untested free model, falling back to Haiku", () => {
    const untested = freeProvider([
      "meta-llama/llama-3.1-8b-instruct:free",
      "mistralai/mistral-7b-instruct:free",
      "openrouter/free",
    ]);
    const selection = routeLightDelegatedTask({
      ...base,
      providers: [...providers, untested],
      task: "Fix a typo in README.md",
    });
    expect(selection?.selection.model).toBe("claude-haiku-5-5");
  });

  it("falls back to Haiku when the free provider cannot run", () => {
    const selection = routeLightDelegatedTask({
      ...base,
      providers: [...providers, openrouter],
      isRunnable: (candidate) => candidate.instanceId !== "openrouter",
      task: "Fix a typo in README.md",
    });
    expect(selection?.selection.model).toBe("claude-haiku-5-5");
  });

  it("never falls back to a pay-per-token model, even when the subscription is scarce", () => {
    const meteredAndFree = {
      ...freeProvider(["cohere/north-mini-code:free"]),
      models: [
        ...freeProvider(["cohere/north-mini-code:free"]).models,
        {
          slug: "deepseek/deepseek-chat",
          name: "deepseek/deepseek-chat",
          isCustom: false,
          capabilities: null,
          inputCostPerMillionTokens: 0.2,
          outputCostPerMillionTokens: 0.8,
        },
      ],
    } as ServerProvider;
    const selection = routeLightDelegatedTask({
      ...base,
      providers: [provider("codex", "codex", ["gpt-6-luna"]), meteredAndFree],
      task: "Fix a typo in README.md",
    });
    expect(selection?.selection.model).toBe("cohere/north-mini-code:free");
    expect(selection?.fallback?.instanceId).toBe("codex");

    const onlyMetered = routeLightDelegatedTask({
      ...base,
      providers: [meteredAndFree],
      task: "Fix a typo in README.md",
    });
    expect(onlyMetered?.selection.model).toBe("cohere/north-mini-code:free");
    expect(onlyMetered?.fallback).toBeUndefined();
  });

  it("keeps a larger task on the parent even when free models exist", () => {
    expect(
      routeLightDelegatedTask({
        ...base,
        providers: [...providers, openrouter],
        task: "Refactor the orchestrator to separate commands from effects and migrate every adapter.",
      }),
    ).toBeNull();
  });
});
