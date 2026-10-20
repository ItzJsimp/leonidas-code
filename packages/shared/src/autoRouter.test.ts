import { ProviderInstanceId, type ServerProviderUsageLimits } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import {
  classifyTask,
  handoffContextLoss,
  profileModel,
  projectUsedPercentAtReset,
  rankModelsForPreference,
  routeTurn,
  type AutoRouteCandidate,
  type AutoRouteInput,
  type AutoRoutePreference,
} from "./autoRouter.ts";

const NOW = Date.parse("2026-10-10T12:00:00Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const claude = ProviderInstanceId.make("claudeAgent");
const claudeWork = ProviderInstanceId.make("claude_work");
const codex = ProviderInstanceId.make("codex");
const openrouter = ProviderInstanceId.make("openrouter");
const iso = (ms: number) => DateTime.formatIso(DateTime.makeUnsafe(ms));

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

const claudeCandidate = (
  usageLimits?: ServerProviderUsageLimits,
  instanceId = claude,
): AutoRouteCandidate => ({
  instanceId,
  driverKind: "claudeAgent",
  label: instanceId === claude ? "Claude" : "Claude Work",
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

/** A five-hour session window `hoursIn` hours after it started. */
const session = (usedPercent: number, hoursIn = 2.5): ServerProviderUsageLimits => ({
  checkedAt: iso(NOW),
  windows: [
    {
      id: "session",
      kind: "session",
      label: "Session",
      usedPercent,
      windowDurationMins: 300,
      resetsAt: iso(NOW + (5 - hoursIn) * HOUR),
    },
  ],
});

const HEAVY =
  "Refactor the provider registry so instances hydrate lazily, then debug the race condition in session startup and redesign the retry policy.";
const STANDARD = "Add a loading state to the settings save button.";
const LIGHT = "fix the typo in the readme";

const sonnet = { instanceId: claude, model: "claude-sonnet-5-5" };
/** Claude Code's ~65k baseline plus a 50k chat. */
const sonnetThread = (idleMinutes: number) => ({
  contextTokens: 115_000,
  driverKind: "claudeAgent",
  lastActivityAt: NOW - idleMinutes * MINUTE,
});

const route = (
  preference: AutoRoutePreference,
  prompt: string,
  extra: Partial<AutoRouteInput> = {},
) =>
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
    expect(classifyTask({ prompt: STANDARD })).toBe("standard");
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

describe("rankModelsForPreference", () => {
  const candidates = [claudeCandidate(), codexCandidate()];
  const rank = (preference: AutoRoutePreference, list = candidates) =>
    rankModelsForPreference({ preference, candidates: list, now: NOW, limit: 10 });

  it("orders each goal by its own axis", () => {
    const speed = rank("speed");
    expect(speed[0]?.profile.speed).toBe(5);
    expect(speed.at(-1)?.profile.speed).toBeLessThan(5);
    const quality = rank("quality");
    expect(quality[0]?.profile.quality).toBe(5);
    expect(quality.at(-1)?.profile.quality).toBeLessThan(5);
  });

  it("puts the latest Opus first and reserves the remaining Quality slots for other families", () => {
    const withOpus: AutoRouteCandidate = {
      ...claudeCandidate(),
      models: [
        { slug: "claude-opus-4-6", name: "Opus 4.6" },
        { slug: "claude-opus-5-5", name: "Opus 5.5" },
        ...claudeCandidate().models,
      ],
    };
    const ranked = rank("quality", [codexCandidate(), withOpus]);
    expect(ranked.slice(0, 4).map((entry) => entry.slug)).toEqual([
      "claude-opus-5-5",
      "claude-fable-5-1",
      "gpt-6.1-sol",
      "claude-sonnet-5-5",
    ]);
  });

  it("keeps dated lower-quality models below Opus in the five Quality recommendations", () => {
    const withOpus: AutoRouteCandidate = {
      ...claudeCandidate(),
      models: [{ slug: "claude-opus-5-5", name: "Opus 5.5" }],
    };
    const datedModels: AutoRouteCandidate = {
      instanceId: openrouter,
      driverKind: "openrouter",
      label: "OpenRouter",
      models: [
        "mistralai/mistral-small-2603",
        "mistralai/mistral-small-2603:batch",
        "mistralai/devstral-2512",
        "mistralai/mistral-large-2512",
        "mistralai/mistral-large-2512:batch",
        "qwen/qwen3.8-max-0902",
      ].map((slug) => ({ slug, name: slug })),
    };
    const ranked = rankModelsForPreference({
      preference: "quality",
      candidates: [datedModels, codexCandidate(), withOpus],
      now: NOW,
      limit: 5,
    });
    expect(ranked[0]?.slug).toBe("claude-opus-5-5");
    expect(ranked[1]?.slug).toBe("gpt-6.1-sol");
  });

  it("shows each Quality family once across accounts, API variants, and older versions", () => {
    const personal: AutoRouteCandidate = {
      ...claudeCandidate(),
      models: [
        { slug: "claude-opus-5-5", name: "Opus 5.5" },
        { slug: "claude-opus-5", name: "Opus 5" },
        ...claudeCandidate().models,
      ],
    };
    const api: AutoRouteCandidate = {
      instanceId: openrouter,
      driverKind: "openrouter",
      label: "OpenRouter",
      models: [
        "anthropic/claude-opus-5.5",
        "anthropic/claude-opus-5.5:batch",
        "anthropic/claude-fable-5.1",
        "openai/gpt-6.1-sol",
        "google/gemini-3.1-pro",
        "google/gemini-2.5-pro",
      ].map((slug) => ({ slug, name: slug })),
    };
    const ranked = rankModelsForPreference({
      preference: "quality",
      candidates: [api, personal, { ...personal, instanceId: claudeWork }, codexCandidate()],
      now: NOW,
      limit: 5,
    });
    expect(ranked.map((entry) => entry.slug)).toEqual([
      "claude-opus-5-5",
      "claude-fable-5-1",
      "gpt-6.1-sol",
      "google/gemini-3.1-pro",
      "claude-sonnet-5-5",
    ]);
    expect(ranked[0]?.instanceId).toBe(claude);
  });

  it("lists free models first for cost", () => {
    const free = {
      instanceId: openrouter,
      driverKind: "openrouter",
      label: "OpenRouter",
      models: [
        {
          slug: "meta-llama/free-one",
          name: "Free One",
          inputCostPerMillionTokens: 0,
          outputCostPerMillionTokens: 0,
        },
      ],
    } satisfies AutoRouteCandidate;
    const ranked = rank("cost", [...candidates, free]);
    expect(ranked[0]).toMatchObject({ slug: "meta-llama/free-one", free: true });
  });

  it("leaves out exhausted accounts and honours the limit", () => {
    const ranked = rankModelsForPreference({
      preference: "balanced",
      candidates: [claudeCandidate(session(100)), codexCandidate()],
      now: NOW,
      limit: 2,
    });
    expect(ranked).toHaveLength(2);
    expect(ranked.every((entry) => entry.instanceId === codex)).toBe(true);
  });
});

describe("routeTurn on a new chat", () => {
  it("lets the preference decide the model", () => {
    expect(route("cost", STANDARD)?.modelSelection.model).toMatch(/sonnet|astra/);
    expect(route("quality", STANDARD)?.modelSelection.model).toMatch(/fable|sol/);
  });

  it("never routes a heavy task to a light model, even for cost", () => {
    const decision = route("cost", HEAVY);
    expect(decision?.task).toBe("heavy");
    expect(profileModel(decision!.modelSelection.model).quality).toBeGreaterThanOrEqual(4);
  });

  it("puts cost before speed once a model clears the quality floor", () => {
    const cheap = "cheap-capable";
    const fast = "fast-capable";
    const decision = route("cost", STANDARD, {
      candidates: [
        {
          ...claudeCandidate(),
          models: [
            { slug: fast, name: fast },
            { slug: cheap, name: cheap },
          ],
        },
      ],
      profiles: new Map([
        [cheap, { quality: 3, speed: 1, economy: 5, known: true }],
        [fast, { quality: 5, speed: 5, economy: 4.5, known: true }],
      ]),
    });
    expect(decision?.modelSelection.model).toBe(cheap);
  });

  it("uses a light model and low effort for light tasks", () => {
    expect(route("balanced", LIGHT, { candidates: [claudeCandidate()] })).toEqual({
      modelSelection: {
        instanceId: claude,
        model: "claude-haiku-5-5",
        options: [{ id: "effort", value: "low" }],
      },
      providerLabel: "Claude",
      modelName: "Haiku 5.5",
      task: "light",
      switched: false,
      reason: "Light task, balanced",
    });
  });

  it("prefers prepaid subscriptions over metered API keys at equal quality", () => {
    const decision = routeTurn({
      preference: "cost",
      prompt: STANDARD,
      candidates: [
        {
          instanceId: openrouter,
          driverKind: "openrouter",
          label: "OpenRouter",
          models: [{ slug: "anthropic/claude-sonnet-5-5", name: "Sonnet via OpenRouter" }],
        },
        { ...claudeCandidate(), models: [{ slug: "claude-sonnet-5-5", name: "Sonnet 5.5" }] },
      ],
      now: NOW,
    });
    expect(decision?.modelSelection.instanceId).toBe(claude);
  });

  it("uses live OpenRouter prices to choose the cheaper model within a family", () => {
    const decision = routeTurn({
      preference: "cost",
      prompt: STANDARD,
      candidates: [
        {
          instanceId: openrouter,
          driverKind: "openrouter",
          label: "OpenRouter",
          models: [
            {
              slug: "deepseek/deepseek-v4.1-flash",
              name: "DeepSeek V4.1 Flash",
              inputCostPerMillionTokens: 1,
              outputCostPerMillionTokens: 4,
            },
            {
              slug: "qwen/qwen3-flash",
              name: "Qwen 3 Flash",
              inputCostPerMillionTokens: 0.1,
              outputCostPerMillionTokens: 0.4,
            },
          ],
        },
      ],
      now: NOW,
    });

    expect(decision?.modelSelection.model).toBe("qwen/qwen3-flash");
  });
});

describe("routeTurn on a running chat", () => {
  it("keeps a warm 50k-token chat on its model instead of re-reading it elsewhere", () => {
    for (const preference of ["balanced", "cost", "speed"] as const) {
      const decision = route(preference, LIGHT, { current: sonnet, thread: sonnetThread(10) });
      expect(decision?.modelSelection.model).toBe("claude-sonnet-5-5");
      expect(decision?.switched).toBe(false);
      expect(decision?.reason).toMatch(/stayed to keep the cache warm/);
    }
  });

  it("keeps the current effort on a warm model, since changing it invalidates the cache", () => {
    const current = { ...sonnet, options: [{ id: "effort", value: "medium" }] };
    expect(
      route("balanced", LIGHT, { current, thread: sonnetThread(10) })?.modelSelection.options,
    ).toEqual([{ id: "effort", value: "medium" }]);
  });

  it("moves to a cheaper model once the cache has gone cold anyway", () => {
    const decision = route("cost", LIGHT, { current: sonnet, thread: sonnetThread(90) });
    expect(decision?.modelSelection.model).toMatch(/haiku|luna/);
    expect(decision?.switched).toBe(true);
  });

  it("still escalates a heavy task when quality is the goal", () => {
    const decision = route("quality", HEAVY, { current: sonnet, thread: sonnetThread(10) });
    expect(profileModel(decision!.modelSelection.model).quality).toBe(5);
  });

  it("stays put when the thread's usage has not been reported yet", () => {
    expect(route("cost", LIGHT, { current: sonnet })?.modelSelection.model).toBe(
      "claude-sonnet-5-5",
    );
  });

  it("leaves an exhausted account even with a warm cache", () => {
    const decision = routeTurn({
      preference: "balanced",
      prompt: STANDARD,
      candidates: [claudeCandidate(session(100)), codexCandidate()],
      current: sonnet,
      thread: sonnetThread(10),
      now: NOW,
    });
    expect(decision?.modelSelection.instanceId).toBe(codex);
    expect(decision?.switched).toBe(true);
  });

  it("counts chat beyond the handoff cap as lost context", () => {
    expect(handoffContextLoss(sonnetThread(0))).toBeCloseTo(1 - 16_000 / 50_000);
    expect(handoffContextLoss({ ...sonnetThread(0), contextTokens: 70_000 })).toBe(0);
  });
});

describe("subscription quota", () => {
  it("keeps a hard quality floor even when a weaker model has spare quota", () => {
    const decision = route("cost", STANDARD, {
      candidates: [
        {
          ...claudeCandidate(session(95)),
          models: [{ slug: "claude-sonnet-5-5", name: "Sonnet" }],
        },
        { ...codexCandidate(session(10)), models: [{ slug: "gpt-6-luna", name: "Luna" }] },
      ],
    });
    expect(decision?.modelSelection.model).toBe("claude-sonnet-5-5");
  });

  it("moves at the threshold on any window, even with a warm cache", () => {
    const limits = session(10);
    const hot = {
      ...limits,
      windows: [...limits.windows, { ...limits.windows[0]!, id: "weekly", usedPercent: 90 }],
    };
    const decision = route("cost", STANDARD, {
      candidates: [claudeCandidate(hot), claudeCandidate(session(20), claudeWork)],
      current: sonnet,
      thread: sonnetThread(1),
    });
    expect(decision?.modelSelection.instanceId).toBe(claudeWork);
    expect(decision?.reason).toContain("90%");
  });

  it("uses the configured threshold and falls back when all accounts are hot", () => {
    expect(
      route("cost", STANDARD, {
        candidates: [claudeCandidate(session(81)), claudeCandidate(session(70), claudeWork)],
        quotaBlockPercent: 80,
      })?.modelSelection.instanceId,
    ).toBe(claudeWork);
    expect(route("cost", STANDARD, { candidates: [claudeCandidate(session(95))] })).not.toBeNull();
  });

  it("projects a window to its reset at the account's own pace", () => {
    // 40% in the first hour of five: on track to need 200%.
    expect(projectUsedPercentAtReset(session(40, 1).windows[0]!, NOW)).toBeCloseTo(200);
    // 70% after 4.5 hours: about 78% at reset.
    expect(projectUsedPercentAtReset(session(70, 4.5).windows[0]!, NOW)).toBeCloseTo(77.8, 1);
    // Too early in the window to tell.
    expect(projectUsedPercentAtReset(session(5, 0.2).windows[0]!, NOW)).toBeNull();
  });

  it("prefers the account that will not run dry over the one with the lower percentage", () => {
    const decision = routeTurn({
      preference: "balanced",
      prompt: STANDARD,
      candidates: [claudeCandidate(session(40, 1)), claudeCandidate(session(70, 4.5), claudeWork)],
      now: NOW,
    });
    expect(decision?.modelSelection.instanceId).toBe(claudeWork);
  });

  it("prioritizes explicit projectedUsedPercentAtReset when present", () => {
    const win = { ...session(40, 1).windows[0]!, projectedUsedPercentAtReset: 82.5 };
    expect(projectUsedPercentAtReset(win, NOW)).toBe(82.5);
  });

  it("prefers an account at 80% whose history shows safe remaining burn over an account projected to run dry", () => {
    // Claude is at 80% after 3 hours, but projected at reset to only reach 83% (spare quota).
    // Codex is at 40% in 1st hour, on track to run dry (200%).
    const claudeSafeAt80: ServerProviderUsageLimits = {
      checkedAt: iso(NOW),
      windows: [
        {
          id: "session",
          kind: "session",
          label: "Session",
          usedPercent: 80,
          windowDurationMins: 300,
          resetsAt: iso(NOW + 2 * HOUR),
          projectedUsedPercentAtReset: 83,
        },
      ],
    };
    const decision = routeTurn({
      preference: "balanced",
      prompt: STANDARD,
      candidates: [claudeCandidate(claudeSafeAt80), codexCandidate(session(40, 1))],
      now: NOW,
    });
    expect(decision?.modelSelection.instanceId).toBe(claude);
  });

  it("skips exhausted accounts and returns null when none can run", () => {
    expect(
      routeTurn({
        preference: "quality",
        prompt: STANDARD,
        candidates: [claudeCandidate(session(100)), codexCandidate()],
        now: NOW,
      })?.modelSelection.instanceId,
    ).toBe(codex);
    expect(
      routeTurn({
        preference: "balanced",
        prompt: STANDARD,
        candidates: [claudeCandidate(session(100))],
        now: NOW,
      }),
    ).toBeNull();
  });
});
