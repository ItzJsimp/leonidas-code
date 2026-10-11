/**
 * Leonidas Autorouter: picks one concrete provider instance and model for a
 * turn from the providers the user has connected.
 *
 * Pure and synchronous so the composer can route on send with no round trip,
 * and the server (MCP, scheduled tasks) can reuse the same decision.
 * The caller passes only candidates that are ready to run; this module never
 * reads settings or snapshots itself.
 *
 * A model's score is its fit for the task and goal, minus what moving the
 * thread to it would cost: a cold prompt cache, a fresh provider baseline, and
 * chat a handoff cannot carry. A new chat pays none of that, so it routes
 * freely; a long warm chat stays put unless the task or quota demands a move.
 *
 * @module autoRouter
 */
import type {
  ModelCapabilities,
  ModelSelection,
  ProviderInstanceId,
  ProviderOptionSelection,
  ServerProviderUsageLimits,
  ServerProviderUsageWindow,
} from "@t3tools/contracts";
import { AutoRoutePreference } from "@t3tools/contracts/settings";

import { elapsedShare } from "./usageLimits.ts";

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

/** What the thread holds now. Absent for a new chat, where nothing is cached yet. */
export interface AutoRouteThreadState {
  /** Tokens the current provider reported for the whole context, baseline included. */
  readonly contextTokens: number;
  /** Driver holding that context, for its cache lifetime and baseline size. */
  readonly driverKind: string;
  /** When the provider last reported usage; its cache is warm until the lifetime passes. */
  readonly lastActivityAt: number | null;
}

export interface AutoRouteInput {
  readonly preference: AutoRoutePreference;
  readonly prompt: string;
  readonly candidates: ReadonlyArray<AutoRouteCandidate>;
  /** The thread's last concrete selection. */
  readonly current?: ModelSelection | null | undefined;
  readonly thread?: AutoRouteThreadState | undefined;
  readonly attachmentCount?: number | undefined;
  readonly planMode?: boolean | undefined;
  readonly now: number;
}

export interface AutoRouteDecision {
  readonly modelSelection: ModelSelection;
  readonly providerLabel: string;
  readonly modelName: string;
  readonly task: AutoRouteTaskSize;
  /** True when the turn leaves the thread's current model. */
  readonly switched: boolean;
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

// ---------------------------------------------------------------------------
// Subscription quota
// ---------------------------------------------------------------------------

const HOUR = 60 * 60 * 1000;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export interface QuotaOutlook {
  /** 0 while every window should last until it resets, up to 1 when one will run dry. */
  readonly scarcity: number;
  /** 0 to 1: how much of the tightest window is projected to expire unused. */
  readonly spare: number;
}

/**
 * Where the window will stand at reset if this account keeps the pace it has
 * used so far in the window. Null when the window's length or reset is
 * unknown, or it is too early in the window to tell a pace from a burst.
 */
export function projectUsedPercentAtReset(
  window: ServerProviderUsageWindow,
  now: number,
): number | null {
  const elapsed = elapsedShare(window, now);
  if (elapsed === null || elapsed < 0.1 || window.windowDurationMins === undefined) return null;
  const resetsAt = window.resetsAt === undefined ? Number.NaN : Date.parse(window.resetsAt);
  if (!Number.isFinite(resetsAt)) return null;
  const elapsedHours = (elapsed * window.windowDurationMins * 60_000) / HOUR;
  const hoursLeft = Math.max(0, (resetsAt - now) / HOUR);
  return window.usedPercent + (window.usedPercent / elapsedHours) * hoursLeft;
}

/**
 * Quota left at reset is lost, so an account projected to finish well under
 * its limit is the cheapest place to send work even when its percentage looks
 * high, and one projected to run dry before reset is the dearest. Null when a
 * window is already exhausted.
 */
export function quotaOutlook(
  limits: ServerProviderUsageLimits | undefined,
  now: number,
): QuotaOutlook | null {
  if (!limits || limits.windows.length === 0) return { scarcity: 0, spare: 0 };
  let scarcity = 0;
  let spare = 1;
  for (const window of limits.windows) {
    if (window.usedPercent >= 100) return null;
    const projected = projectUsedPercentAtReset(window, now) ?? window.usedPercent;
    scarcity = Math.max(scarcity, clamp01((projected - 90) / 10));
    // Keep a ten-point margin for this thread's own work before calling quota spare.
    spare = Math.min(spare, clamp01((90 - projected) / 30));
  }
  return { scarcity, spare };
}

// ---------------------------------------------------------------------------
// Prompt cache and handoff
// ---------------------------------------------------------------------------

/**
 * Measured from local Claude Code and Codex transcripts: both keep a context
 * warm for about an hour between turns, and a fresh session reads a large
 * fixed baseline (system prompt, tools, project instructions) before any chat.
 * Read and write are multiples of the uncached input price; the prompt cache
 * is per model, so another model on the same provider starts cold.
 */
const CACHE_PROFILES: Record<
  string,
  { ttlMs: number; baselineTokens: number; read: number; write: number }
> = {
  claudeAgent: { ttlMs: HOUR, baselineTokens: 65_000, read: 0.1, write: 1.25 },
  codex: { ttlMs: HOUR, baselineTokens: 25_000, read: 0.1, write: 1 },
};
const DEFAULT_CACHE_PROFILE = { ttlMs: 5 * 60_000, baselineTokens: 20_000, read: 0.25, write: 1 };
const cacheProfile = (driverKind: string) => CACHE_PROFILES[driverKind] ?? DEFAULT_CACHE_PROFILE;

/** Matches the server's `DEFAULT_HANDOFF_TOKEN_CAP`: a provider switch carries at most this much chat. */
const HANDOFF_TOKEN_CAP = 16_000;

// Relative input price by economy tier, Sonnet-class = 1.
const PRICE_INDEX: Record<number, number> = { 1: 2.5, 2: 1.7, 3: 1, 4: 0.6, 5: 0.33 };

const chatTokens = (thread: AutoRouteThreadState) =>
  Math.max(0, thread.contextTokens - cacheProfile(thread.driverKind).baselineTokens);

/**
 * Input the next turn pays, in Sonnet-priced token equivalents. The same warm
 * model reads its cache; a cold cache or another model on the same provider
 * re-reads the whole context; another provider reads its own baseline plus at
 * most the handoff cap of chat.
 */
export function nextTurnInputCost(input: {
  readonly thread: AutoRouteThreadState;
  readonly driverKind: string;
  readonly profile: ModelRouteProfile;
  readonly sameProviderSession: boolean;
  readonly sameModel: boolean;
  readonly now: number;
}): number {
  const { thread } = input;
  const target = cacheProfile(input.driverKind);
  const price = PRICE_INDEX[input.profile.economy] ?? 1;
  if (input.sameProviderSession) {
    const warm =
      thread.lastActivityAt !== null &&
      input.now - thread.lastActivityAt < cacheProfile(thread.driverKind).ttlMs;
    return thread.contextTokens * (input.sameModel && warm ? target.read : target.write) * price;
  }
  return (
    (target.baselineTokens + Math.min(chatTokens(thread), HANDOFF_TOKEN_CAP)) * target.write * price
  );
}

/** Share of the chat a provider switch would leave behind, 0 to 1. */
export function handoffContextLoss(thread: AutoRouteThreadState): number {
  const chat = chatTokens(thread);
  return chat <= HANDOFF_TOKEN_CAP ? 0 : 1 - HANDOFF_TOKEN_CAP / chat;
}

// Score points per 1,000 Sonnet-priced input tokens a move costs beyond staying.
const SWITCH_TOKEN_WEIGHT: Record<AutoRoutePreference, number> = {
  balanced: 0.04,
  cost: 0.06,
  quality: 0.003,
  speed: 0.03,
};
// Any move on a running thread must beat staying by this much, so near ties
// do not bounce a thread between models turn after turn.
const SWITCH_MARGIN = 1;

// Score points for leaving the whole chat behind in a handoff.
const CONTEXT_LOSS_WEIGHT: Record<AutoRoutePreference, number> = {
  balanced: 2.5,
  cost: 1.5,
  quality: 4,
  speed: 2,
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

// How much each axis counts, per preference. Quality always counts a little
// and is floored by task size below, so "cost" never routes a heavy task to a
// model that cannot do it.
const WEIGHTS: Record<AutoRoutePreference, { quality: number; speed: number; economy: number }> = {
  balanced: { quality: 1, speed: 0.6, economy: 0.8 },
  cost: { quality: 0.4, speed: 0.3, economy: 1.6 },
  quality: { quality: 2.5, speed: 0.1, economy: 0.1 },
  speed: { quality: 0.5, speed: 1.6, economy: 0.4 },
};

const QUALITY_FLOOR: Record<AutoRouteTaskSize, number> = { light: 1, standard: 3, heavy: 4 };
// Quality above what the task needs is worth less, except when quality is the goal.
const QUALITY_CEILING: Record<AutoRouteTaskSize, number> = { light: 3, standard: 4, heavy: 5 };

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

/** Fit for the task and goal, ignoring where the thread is now. */
function fitScore(input: {
  readonly profile: ModelRouteProfile;
  readonly preference: AutoRoutePreference;
  readonly task: AutoRouteTaskSize;
  readonly metered: boolean;
  readonly outlook: QuotaOutlook;
  readonly isLegacy: boolean;
}): number {
  const weights = WEIGHTS[input.preference];
  const effectiveQuality =
    input.preference === "quality"
      ? input.profile.quality
      : Math.min(input.profile.quality, QUALITY_CEILING[input.task]);
  // Metered keys bill every token; subscription quota that would expire unused is free.
  const economy = Math.max(
    1,
    Math.min(
      5,
      input.profile.economy +
        (input.metered ? -2 : input.outlook.spare) -
        input.outlook.scarcity * 3,
    ),
  );
  let score =
    weights.quality * effectiveQuality +
    weights.speed * input.profile.speed +
    weights.economy * economy;
  // A cost focus accepts one notch less quality than the task would otherwise get.
  const floor = QUALITY_FLOOR[input.task] - (input.preference === "cost" ? 1 : 0);
  const shortfall = floor - input.profile.quality;
  if (shortfall > 0) score -= shortfall * 4;
  if (!input.profile.known) score -= 0.5;
  if (input.isLegacy) score -= 1;
  return score;
}

interface ScoredOption {
  readonly candidate: AutoRouteCandidate;
  readonly model: AutoRouteModel;
  readonly fit: number;
  /** Next-turn input in thousands of Sonnet-priced tokens, 0 for a new chat. */
  readonly inputCost: number;
  readonly contextLoss: number;
  readonly isCurrent: boolean;
  readonly quality: number;
  readonly scarcity: number;
}

/** Null when no candidate can run the turn (every account is out of quota). */
export function routeTurn(input: AutoRouteInput): AutoRouteDecision | null {
  const task = classifyTask(input);
  const current = input.current ?? null;
  const currentGroup = input.candidates.find(
    (candidate) => candidate.instanceId === current?.instanceId,
  )?.continuationGroupKey;
  // A started thread whose usage has not been reported yet is treated as a
  // warm one of moderate length, so the router does not move blind.
  const currentDriver = input.candidates.find(
    (candidate) => candidate.instanceId === current?.instanceId,
  )?.driverKind;
  const thread: AutoRouteThreadState | undefined = !current
    ? undefined
    : (input.thread ?? {
        contextTokens: cacheProfile(currentDriver ?? "").baselineTokens + 2 * HANDOFF_TOKEN_CAP,
        driverKind: currentDriver ?? "",
        lastActivityAt: input.now,
      });

  const options: ScoredOption[] = [];
  for (const candidate of input.candidates) {
    const outlook = quotaOutlook(candidate.usageLimits, input.now);
    if (outlook === null) continue;
    // Instances sharing a continuation group resume the same native session.
    const sameProviderSession =
      candidate.instanceId === current?.instanceId ||
      (currentGroup !== undefined && candidate.continuationGroupKey === currentGroup);
    for (const model of candidate.models) {
      if (PROVIDER_DEFAULT_SLUGS.has(model.slug) && candidate.models.length > 1) continue;
      const profile = profileModel(model.slug);
      const isCurrent = sameProviderSession && model.slug === current?.model;
      options.push({
        candidate,
        model,
        isCurrent,
        quality: profile.quality,
        scarcity: outlook.scarcity,
        fit: fitScore({
          profile,
          preference: input.preference,
          task,
          metered: METERED_DRIVERS.has(candidate.driverKind),
          outlook,
          isLegacy: model.isLegacy === true,
        }),
        inputCost: thread
          ? nextTurnInputCost({
              thread,
              driverKind: candidate.driverKind,
              profile,
              sameProviderSession,
              sameModel: isCurrent,
              now: input.now,
            }) / 1000
          : 0,
        contextLoss: thread && !sameProviderSession ? handoffContextLoss(thread) : 0,
      });
    }
  }
  if (options.length === 0) return null;

  // A warm thread never steps down to a weaker model for a lighter prompt: the
  // move re-reads the whole context, and the next normal prompt would move it
  // back. It steps down only once the cache is cold or its account runs low.
  const stay = options.find((option) => option.isCurrent);
  const warm =
    thread !== undefined &&
    thread.lastActivityAt !== null &&
    input.now - thread.lastActivityAt < cacheProfile(thread.driverKind).ttlMs;
  const allowed =
    stay && warm && stay.scarcity < 0.5
      ? options.filter((option) => option.isCurrent || option.quality >= stay.quality)
      : options;

  // A move pays only what it costs beyond staying. When the current model
  // cannot run, every option pays its own next-turn input.
  const stayCost = stay?.inputCost ?? 0;
  const total = (option: ScoredOption) =>
    option.fit -
    Math.max(0, option.inputCost - stayCost) * SWITCH_TOKEN_WEIGHT[input.preference] -
    option.contextLoss * CONTEXT_LOSS_WEIGHT[input.preference] -
    (thread && !option.isCurrent ? SWITCH_MARGIN : 0);
  const best = allowed.reduce((a, b) => (total(b) > total(a) ? b : a));
  const bestFit = options.reduce((a, b) => (b.fit > a.fit ? b : a));

  const switched = current !== null && !best.isCurrent;
  const keptForCache = best.isCurrent && bestFit !== best;
  // Changing thinking effort mid-thread invalidates the cached messages, so
  // the current model keeps its options and effort is only chosen on a move.
  const modelOptions = best.isCurrent
    ? current?.options
    : effortOptions(best.model, task, input.preference);
  return {
    modelSelection: {
      instanceId: best.candidate.instanceId,
      model: best.model.slug,
      ...(modelOptions ? { options: modelOptions } : {}),
    },
    providerLabel: best.candidate.label,
    modelName: best.model.name,
    task,
    switched,
    reason: `${TASK_LABELS[task]} task, ${AUTO_ROUTE_PREFERENCE_LABELS[input.preference].toLowerCase()}${keptForCache ? ", stayed to keep the cache warm" : ""}`,
  };
}

const TASK_LABELS: Record<AutoRouteTaskSize, string> = {
  light: "Light",
  standard: "Standard",
  heavy: "Heavy",
};
