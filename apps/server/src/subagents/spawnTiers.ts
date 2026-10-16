// @effect-diagnostics nodeBuiltinImport:off - one synchronous read per spawn, same as subagentPersona.
/**
 * Spawn tiers (ADR-0082). A subagent on a free-tier model starts at once; any
 * other model, including one the map has never seen, waits for the user's
 * confirm card. The nearest `.agents/subagents/model-tiers.json` overrides
 * the app's map, which the user edits in Settings.
 */
import * as NodeFs from "node:fs";
import * as NodePath from "node:path";

import { DEFAULT_SUBAGENT_TIER_GOOD_FOR, type SubagentSpawnTier } from "@t3tools/contracts";

export interface AiosModelTiers {
  readonly path: string;
  readonly free: ReadonlyArray<string>;
  readonly confirm: ReadonlyArray<string>;
  readonly goodFor: Partial<Record<SubagentSpawnTier, string>>;
}

export interface ResolvedSpawnTier {
  readonly tier: SubagentSpawnTier;
  readonly source: "app" | "aios";
  readonly goodFor: string;
}

export class ModelTiersFileError extends Error {
  override readonly name = "ModelTiersFileError";
}

function modelList(value: unknown, field: string): ReadonlyArray<string> {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ModelTiersFileError(`model-tiers.json "${field}" must be a list of model ids.`);
  }
  return value.map((item: string) => item.trim()).filter((item) => item.length > 0);
}

export function parseModelTiers(source: string, path: string): AiosModelTiers {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new ModelTiersFileError(`${path} is not valid JSON.`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ModelTiersFileError(`${path} must hold an object.`);
  }
  const fields = parsed as Record<string, unknown>;
  const goodFor: Partial<Record<SubagentSpawnTier, string>> = {};
  if (typeof fields.goodFor === "object" && fields.goodFor !== null) {
    for (const tier of ["free", "confirm"] as const) {
      const line = (fields.goodFor as Record<string, unknown>)[tier];
      if (typeof line === "string" && line.trim().length > 0) goodFor[tier] = line.trim();
    }
  }
  return {
    path,
    free: modelList(fields.free, "free"),
    confirm: modelList(fields.confirm, "confirm"),
    goodFor,
  };
}

/** Nearest `.agents/subagents/model-tiers.json` at or above `path`'s folder, parsed, or null. */
export function readAiosModelTiersNear(path: string): AiosModelTiers | null {
  let directory = NodePath.dirname(NodePath.resolve(path));
  for (;;) {
    const candidate = NodePath.join(directory, ".agents", "subagents", "model-tiers.json");
    if (NodeFs.existsSync(candidate)) {
      return parseModelTiers(NodeFs.readFileSync(candidate, "utf8"), candidate);
    }
    const parent = NodePath.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

/** The AIOS file wins for any model it names; the app's free list decides the rest. */
export function resolveSpawnTier(input: {
  readonly model: string;
  readonly appFreeModels: ReadonlyArray<string>;
  readonly aios: AiosModelTiers | null;
}): ResolvedSpawnTier {
  const { model, aios } = input;
  const goodFor = (tier: SubagentSpawnTier) =>
    aios?.goodFor[tier] ?? DEFAULT_SUBAGENT_TIER_GOOD_FOR[tier];
  if (aios !== null) {
    if (aios.confirm.includes(model)) {
      return { tier: "confirm", source: "aios", goodFor: goodFor("confirm") };
    }
    if (aios.free.includes(model))
      return { tier: "free", source: "aios", goodFor: goodFor("free") };
  }
  const tier: SubagentSpawnTier = input.appFreeModels.includes(model) ? "free" : "confirm";
  return { tier, source: "app", goodFor: goodFor(tier) };
}

/**
 * A rough start cost for the card: the persona prompt at about 4 characters
 * per token, a fixed harness floor, and a per-tool schema cost. A persona that
 * names app tools gets only those tools; the rest are hidden (see
 * claudePersonaToolShape), so each costs about one schema.
 * Calibrated live: 6 built-in tools and a 6.6 KB prompt measured 10,789 start
 * tokens; 2 built-in and 3 app tools with a tiny prompt measured 5,500. Before
 * the unlisted app tools were hidden, the same 3-tool persona measured 48,600.
 */
export function estimatePersonaStartTokens(input: {
  readonly systemPromptChars: number;
  readonly tools: ReadonlyArray<string>;
}): number {
  const appTools = input.tools.filter((tool) => tool.startsWith("mcp__")).length;
  const builtInTools = input.tools.length - appTools;
  return Math.round(
    input.systemPromptChars / 4 +
      PERSONA_HARNESS_FLOOR_TOKENS +
      builtInTools * PERSONA_TOKENS_PER_TOOL +
      appTools * PERSONA_TOKENS_PER_APP_TOOL,
  );
}

const PERSONA_HARNESS_FLOOR_TOKENS = 6_500;
const PERSONA_TOKENS_PER_TOOL = 450;
const PERSONA_TOKENS_PER_APP_TOOL = 250;
