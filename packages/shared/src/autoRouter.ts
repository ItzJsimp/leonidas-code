/**
 * Leonidas Autorouter: picks one concrete provider instance and model for a
 * turn from the providers the user has connected.
 *
 * Pure and synchronous so the composer can route on send with no round trip,
 * and the server (MCP, scheduled tasks) can reuse the same decision.
 * The caller passes only candidates that are ready to run; this module never
 * reads settings or snapshots itself.
 *
 * @module autoRouter
 */
import type {
  ModelCapabilities,
  ModelSelection,
  ProviderInstanceId,
  ProviderOptionSelection,
  ServerProviderUsageLimits,
} from "@t3tools/contracts";
import { AutoRoutePreference } from "@t3tools/contracts/settings";

import { paceOf } from "./usageLimits.ts";

export const AUTO_ROUTE_PREFERENCES = AutoRoutePreference.literals;
export type { AutoRoutePreference };

export const AUTO_ROUTE_PREFERENCE_LABELS: Record<AutoRoutePreference, string> = {
  balanced: "Balanced",
  cost: "Lowest cost",
  quality: "Best quality",
  speed: "Fastest",
};

export type AutoRouteTaskSize = "light" | "standard" | "heavy";

/** 1 (worst) to 5 (best) on each axis. `economy` 5 means cheapest. */
export interface ModelRouteProfile {
  readonly quality: number;
  readonly speed: number;
  readonly economy: number;
  /** False when the slug matched no known family and the profile is a guess. */
  readonly known: boolean;
}

export interface AutoRouteModel {
  readonly slug: string;
  readonly name: string;
  readonly capabilities?: ModelCapabilities | null | undefined;
  readonly isLegacy?: boolean | undefined;
}

export interface AutoRouteCandidate {
  readonly instanceId: ProviderInstanceId;
  readonly driverKind: string;
  readonly label: string;
  readonly continuationGroupKey?: string | undefined;
  readonly usageLimits?: ServerProviderUsageLimits | undefined;
  readonly models: ReadonlyArray<AutoRouteModel>;
}

export interface AutoRouteInput {
  readonly preference: AutoRoutePreference;
  readonly prompt: string;
  readonly candidates: ReadonlyArray<AutoRouteCandidate>;
  /** The thread's last concrete selection; staying on it avoids a context handoff. */
  readonly current?: ModelSelection | null | undefined;
  readonly attachmentCount?: number | undefined;
  readonly planMode?: boolean | undefined;
  readonly now: number;
}

export interface AutoRouteDecision {
  readonly modelSelection: ModelSelection;
  readonly providerLabel: string;
  readonly modelName: string;
  readonly task: AutoRouteTaskSize;
  /** One short sentence for the composer, e.g. "Light task, lowest cost". */
  readonly reason: string;
}

// Ordered: the first matching family wins. Tiers are relative, judged per
// family generation, and only need to rank models against each other.
const MODEL_FAMILIES: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly profile: Omit<ModelRouteProfile, "known">;
}> = [
  // Anthropic
  { pattern: /fable/, profile: { quality: 5, speed: 2, economy: 1 } },
  { pattern: /opus/, profile: { quality: 5, speed: 2, economy: 1 } },
  { pattern: /sonnet/, profile: { quality: 4, speed: 3, economy: 3 } },
  { pattern: /haiku/, profile: { quality: 2, speed: 5, economy: 5 } },
  // OpenAI: Sol is the flagship, Luna the light model used for text generation.
  { pattern: /\b(nano)\b|-nano/, profile: { quality: 1, speed: 5, economy: 5 } },
  { pattern: /\bmini\b|-mini/, profile: { quality: 2, speed: 5, economy: 5 } },
  { pattern: /luna/, profile: { quality: 2, speed: 5, economy: 5 } },
  { pattern: /astra|terra/, profile: { quality: 4, speed: 3, economy: 3 } },
  { pattern: /sol\b|-sol|codex-max/, profile: { quality: 5, speed: 2, economy: 2 } },
  // Google: Flash variants carry their effort in the slug.
  { pattern: /flash.*-low|flash-lite/, profile: { quality: 2, speed: 5, economy: 5 } },
  { pattern: /flash.*-medium/, profile: { quality: 3, speed: 4, economy: 4 } },
  { pattern: /flash/, profile: { quality: 3, speed: 4, economy: 4 } },
  { pattern: /gemini.*pro/, profile: { quality: 5, speed: 2, economy: 2 } },
  // Open models commonly reached through OpenRouter or OpenCode.
  { pattern: /deepseek.*(r1|reasoner)/, profile: { quality: 4, speed: 2, economy: 4 } },
  { pattern: /deepseek|qwen|llama|mistral/, profile: { quality: 3, speed: 4, economy: 5 } },
  { pattern: /gpt-4o|gpt-4\.1/, profile: { quality: 3, speed: 4, economy: 3 } },
];

const UNKNOWN_PROFILE: ModelRouteProfile = { quality: 3, speed: 3, economy: 3, known: false };

// Slugs that defer the choice to the provider's own default; nothing to rank.
const PROVIDER_DEFAULT_SLUGS = new Set(["auto", "default", "antigravity-default"]);

// Billed per token from the user's own key rather than a prepaid subscription.
const METERED_DRIVERS = new Set(["openrouter", "opencode", "pi"]);

export function profileModel(slug: string): ModelRouteProfile {
  const normalized = slug.toLowerCase();
  const family = MODEL_FAMILIES.find((entry) => entry.pattern.test(normalized));
  return family ? { ...family.profile, known: true } : UNKNOWN_PROFILE;
}

const HEAVY_SIGNALS =
  /\b(architect\w*|design|redesign|refactor\w*|migrat\w*|rewrite|implement\w*|build|from scratch|debug\w*|investigat\w*|root cause|race condition|deadlock|performance|optimi[sz]\w*|security|vulnerab\w*|audit|plan|end[- ]to[- ]end|across the (code ?base|repo)|whole (code ?base|repo|app))\b/i;
const LIGHT_SIGNALS =
  /\b(typo|rename|reword|format|lint|commit message|commit|push|bump|changelog|what is|what's|explain this|summari[sz]e|translate|list|show me|quick|small|tiny|one[- ]liner|spelling)\b/i;

/** Rough task size from the prompt alone. Cheap enough to run on every send. */
export function classifyTask(input: {
  readonly prompt: string;
  readonly attachmentCount?: number | undefined;
  readonly planMode?: boolean | undefined;
}): AutoRouteTaskSize {
  const prompt = input.prompt.trim();
  const words = prompt.length === 0 ? 0 : prompt.split(/\s+/).length;
  let weight = 0;
  if (words > 250) weight += 2;
  else if (words > 80) weight += 1;
  else if (words <= 4) weight -= 1;
  if (HEAVY_SIGNALS.test(prompt)) weight += 2;
  if (LIGHT_SIGNALS.test(prompt)) weight -= 1;
  if ((prompt.match(/```/g)?.length ?? 0) >= 2) weight += 1;
  if ((input.attachmentCount ?? 0) > 0) weight += 1;
  if (input.planMode) weight += 3;
  if (weight >= 2) return "heavy";
  if (weight <= -1) return "light";
  return "standard";
}

// How much each axis counts, per preference. Quality always counts a little
// and is floored by task size below, so "cost" never routes a heavy task to a
// model that cannot do it.
const WEIGHTS: Record<AutoRoutePreference, { quality: number; speed: number; economy: number }> = {
  balanced: { quality: 1, speed: 0.6, economy: 0.8 },
  cost: { quality: 0.4, speed: 0.3, economy: 1.6 },
  quality: { quality: 2, speed: 0.2, economy: 0.2 },
  speed: { quality: 0.5, speed: 1.6, economy: 0.4 },
};

const QUALITY_FLOOR: Record<AutoRouteTaskSize, number> = { light: 1, standard: 3, heavy: 4 };
// Quality above what the task needs is worth less, except when quality is the goal.
const QUALITY_CEILING: Record<AutoRouteTaskSize, number> = { light: 3, standard: 4, heavy: 5 };

/** 0 when the account has plenty left, up to 1 when it is nearly dry. Null when exhausted. */
export function quotaPressure(
  limits: ServerProviderUsageLimits | undefined,
  now: number,
): number | null {
  if (!limits) return 0;
  let pressure = 0;
  for (const window of limits.windows) {
    if (window.usedPercent >= 100) return null;
    if (window.usedPercent >= 90) pressure = Math.max(pressure, 1);
    else if (window.usedPercent >= 75) pressure = Math.max(pressure, 0.5);
    if (paceOf(window, now) === "ahead") pressure = Math.max(pressure, 0.3);
  }
  return pressure;
}

const EFFORT_BY_TASK: Record<AutoRouteTaskSize, ReadonlyArray<string>> = {
  light: ["low"],
  standard: [],
  heavy: ["high"],
};

/** Effort suited to the task, only when the model offers that exact choice. */
function effortOptions(
  model: AutoRouteModel,
  task: AutoRouteTaskSize,
  preference: AutoRoutePreference,
): ReadonlyArray<ProviderOptionSelection> | undefined {
  const wanted = preference === "quality" && task !== "light" ? ["high"] : EFFORT_BY_TASK[task];
  if (wanted.length === 0) return undefined;
  const descriptor = model.capabilities?.optionDescriptors?.find(
    (option) => option.id === "effort" && option.type === "select",
  );
  if (descriptor?.type !== "select") return undefined;
  const choice = wanted.find((id) => descriptor.options.some((option) => option.id === id));
  return choice ? [{ id: "effort", value: choice }] : undefined;
}

function scoreModel(input: {
  readonly profile: ModelRouteProfile;
  readonly preference: AutoRoutePreference;
  readonly task: AutoRouteTaskSize;
  readonly metered: boolean;
  readonly pressure: number;
  readonly sameInstance: boolean;
  readonly sameModel: boolean;
  readonly isLegacy: boolean;
}): number {
  const weights = WEIGHTS[input.preference];
  const effectiveQuality =
    input.preference === "quality"
      ? input.profile.quality
      : Math.min(input.profile.quality, QUALITY_CEILING[input.task]);
  // Prepaid subscription quota costs nothing extra until it runs low.
  const economy = Math.max(
    1,
    Math.min(5, input.profile.economy + (input.metered ? -2 : 1) - input.pressure * 3),
  );
  let score =
    weights.quality * effectiveQuality +
    weights.speed * input.profile.speed +
    weights.economy * economy;
  // A cost focus accepts one notch less quality than the task would otherwise get.
  const floor = QUALITY_FLOOR[input.task] - (input.preference === "cost" ? 1 : 0);
  const shortfall = floor - input.profile.quality;
  if (shortfall > 0) score -= shortfall * 4;
  // Switching instance costs a context handoff; switching model in place is cheap.
  if (input.sameInstance) score += 0.8;
  if (input.sameModel) score += 0.4;
  if (!input.profile.known) score -= 0.5;
  if (input.isLegacy) score -= 1;
  return score;
}

/** Null when no candidate can run the turn (every account is out of quota). */
export function routeTurn(input: AutoRouteInput): AutoRouteDecision | null {
  const task = classifyTask(input);
  const currentInstance = input.current?.instanceId;
  const currentGroup = input.candidates.find(
    (candidate) => candidate.instanceId === currentInstance,
  )?.continuationGroupKey;

  let best: { score: number; decision: AutoRouteDecision } | null = null;
  for (const candidate of input.candidates) {
    const pressure = quotaPressure(candidate.usageLimits, input.now);
    if (pressure === null) continue;
    const sameInstance =
      candidate.instanceId === currentInstance ||
      (currentGroup !== undefined && candidate.continuationGroupKey === currentGroup);
    for (const model of candidate.models) {
      if (PROVIDER_DEFAULT_SLUGS.has(model.slug) && candidate.models.length > 1) continue;
      const score = scoreModel({
        profile: profileModel(model.slug),
        preference: input.preference,
        task,
        metered: METERED_DRIVERS.has(candidate.driverKind),
        pressure,
        sameInstance,
        sameModel: sameInstance && model.slug === input.current?.model,
        isLegacy: model.isLegacy === true,
      });
      if (best !== null && score <= best.score) continue;
      const options = effortOptions(model, task, input.preference);
      best = {
        score,
        decision: {
          modelSelection: {
            instanceId: candidate.instanceId,
            model: model.slug,
            ...(options ? { options } : {}),
          },
          providerLabel: candidate.label,
          modelName: model.name,
          task,
          reason: `${TASK_LABELS[task]} task, ${AUTO_ROUTE_PREFERENCE_LABELS[input.preference].toLowerCase()}`,
        },
      };
    }
  }
  return best?.decision ?? null;
}

const TASK_LABELS: Record<AutoRouteTaskSize, string> = {
  light: "Light",
  standard: "Standard",
  heavy: "Heavy",
};
