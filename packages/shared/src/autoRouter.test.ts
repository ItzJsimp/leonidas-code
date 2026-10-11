import { ProviderInstanceId, type ServerProviderUsageLimits } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  classifyTask,
  profileModel,
  routeTurn,
  type AutoRouteCandidate,
  type AutoRoutePreference,
} from "./autoRouter.ts";

const NOW = Date.parse("2026-10-10T12:00:00Z");
const claude = ProviderInstanceId.make("claudeAgent");
const codex = ProviderInstanceId.make("codex");
const openrouter = ProviderInstanceId.make("openrouter");

const effort = {
  optionDescriptors: [
    {
      id: "effort",
      label: "Reasoning",
      type: "select" as const,
      options: [
        { id: "low", label: "Low" },
        { id: "medium", label: "Medium", isDefault: true },
        { id: "high", label: "High" },
      ],
    },
  ],
};

const claudeCandidate = (usageLimits?: ServerProviderUsageLimits): AutoRouteCandidate => ({
  instanceId: claude,
  driverKind: "claudeAgent",
  label: "Claude",
  usageLimits,
  models: [
    { slug: "claude-fable-5-1", name: "Fable 5.1", capabilities: effort },
    { slug: "claude-sonnet-5-5", name: "Sonnet 5.5", capabilities: effort },
    { slug: "claude-haiku-5-5", name: "Haiku 5.5", capabilities: effort },
  ],
});

const codexCandidate = (usageLimits?: ServerProviderUsageLimits): AutoRouteCandidate => ({
  instanceId: codex,
  driverKind: "codex",
  label: "Codex",
  usageLimits,
  models: [
    { slug: "gpt-6.1-sol", name: "GPT-6.1 Sol" },
    { slug: "gpt-6-astra", name: "GPT-6 Astra" },
    { slug: "gpt-6-luna", name: "GPT-6 Luna" },
  ],
});

const limits = (usedPercent: number): ServerProviderUsageLimits => ({
  checkedAt: "2026-10-10T12:00:00Z",
  windows: [{ id: "session", kind: "session", label: "Session", usedPercent }],
});

const HEAVY =
  "Refactor the provider registry so instances hydrate lazily, then debug the race condition in session startup and redesign the retry policy.";
const LIGHT = "fix the typo in the readme";

const route = (preference: AutoRoutePreference, prompt: string, extra = {}) =>
  routeTurn({
    preference,
    prompt,
    candidates: [claudeCandidate(), codexCandidate()],
    now: NOW,
    ...extra,
  });

describe("classifyTask", () => {
  it("sizes prompts by length, intent and context", () => {
    expect(classifyTask({ prompt: LIGHT })).toBe("light");
    expect(classifyTask({ prompt: "Add a loading state to the settings save button." })).toBe(
      "standard",
    );
    expect(classifyTask({ prompt: HEAVY })).toBe("heavy");
    expect(classifyTask({ prompt: "Add a settings toggle", planMode: true })).toBe("heavy");
  });
});

describe("profileModel", () => {
  it("ranks families and marks unknown slugs as guesses", () => {
    expect(profileModel("claude-opus-5-5").quality).toBeGreaterThan(
      profileModel("claude-haiku-5-5").quality,
    );
    expect(profileModel("gemini-3.8-flash-low").speed).toBe(5);
    expect(profileModel("some-new-model").known).toBe(false);
  });
});

describe("routeTurn", () => {
  it("lets the preference decide the model for the same prompt", () => {
    const prompt = "Add a loading state to the settings save button.";
    expect(route("cost", prompt)?.modelSelection.model).toMatch(/haiku|luna/);
    expect(route("quality", prompt)?.modelSelection.model).toMatch(/fable|sol/);
  });

  it("never routes a heavy task to a light model, even for cost", () => {
    const decision = route("cost", HEAVY);
    expect(decision?.task).toBe("heavy");
    expect(profileModel(decision!.modelSelection.model).quality).toBeGreaterThanOrEqual(4);
  });

  it("uses a light model and low effort for light tasks", () => {
    const decision = route("balanced", LIGHT, { candidates: [claudeCandidate()] });
    expect(decision?.modelSelection).toEqual({
      instanceId: claude,
      model: "claude-haiku-5-5",
      options: [{ id: "effort", value: "low" }],
    });
    expect(decision?.reason).toBe("Light task, balanced");
  });

  it("skips exhausted accounts and avoids nearly dry ones", () => {
    const prompt = "Add a loading state to the settings save button.";
    const exhausted = routeTurn({
      preference: "quality",
      prompt,
      candidates: [claudeCandidate(limits(100)), codexCandidate()],
      now: NOW,
    });
    expect(exhausted?.modelSelection.instanceId).toBe(codex);

    const nearlyDry = routeTurn({
      preference: "balanced",
      prompt,
      candidates: [claudeCandidate(limits(95)), codexCandidate(limits(10))],
      now: NOW,
    });
    expect(nearlyDry?.modelSelection.instanceId).toBe(codex);

    expect(
      routeTurn({
        preference: "balanced",
        prompt,
        candidates: [claudeCandidate(limits(100))],
        now: NOW,
      }),
    ).toBeNull();
  });

  it("stays on the thread's provider when another is only marginally better", () => {
    const prompt = "Add a loading state to the settings save button.";
    const fresh = route("balanced", prompt);
    const other = fresh!.modelSelection.instanceId === claude ? codex : claude;
    const otherModel = other === claude ? "claude-sonnet-5-5" : "gpt-6-astra";
    const sticky = route("balanced", prompt, { current: { instanceId: other, model: otherModel } });
    expect(sticky?.modelSelection.instanceId).toBe(other);
  });

  it("prefers prepaid subscriptions over metered API keys at equal quality", () => {
    const decision = routeTurn({
      preference: "cost",
      prompt: "Add a loading state to the settings save button.",
      candidates: [
        {
          instanceId: openrouter,
          driverKind: "openrouter",
          label: "OpenRouter",
          models: [{ slug: "anthropic/claude-sonnet-5-5", name: "Sonnet via OpenRouter" }],
        },
        {
          ...claudeCandidate(),
          models: [{ slug: "claude-sonnet-5-5", name: "Sonnet 5.5" }],
        },
      ],
      now: NOW,
    });
    expect(decision?.modelSelection.instanceId).toBe(claude);
  });
});
