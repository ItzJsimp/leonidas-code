/**
 * Display names for Antigravity models.
 *
 * Usage records carry either a text name or only a numeric model id. Names are
 * normalized here so the usage reader and the language-server limits probe agree,
 * and ids the reader cannot name are looked up in a registry the probe fills from
 * the account's own model list.
 *
 * @module provider/antigravityModelNames
 */

export interface AntigravityModelName {
  /** Name shown on the usage page. Keeps the effort tier, such as `gemini-3.8-flash-high`. */
  readonly model: string;
  /** Rate-table key when `model` carries an effort tier the table does not know. */
  readonly rateModel?: string;
}

const EFFORT_TIERS = new Set(["minimal", "low", "medium", "high"]);

/**
 * Normalizes an Antigravity model label or slug (`Gemini 3.8 Flash (High)`) to a
 * usage model name. A Gemini effort tier stays in the name so rows split by
 * effort, and the untiered model becomes `rateModel` so pricing still resolves.
 * Other variant tags (`-thinking`, `-n`) are the same model and fold away.
 */
export function antigravityModelNameFromLabel(label: string): AntigravityModelName {
  const lower = label.toLowerCase().trim();
  const tag = lower.match(/\s*\(([^)]*)\)\s*$/)?.[1]?.trim();
  const stem = lower.replace(/\s*\([^)]*\)\s*$/, "").replaceAll(" ", "-");
  if (stem.startsWith("claude-")) {
    return {
      model: stem
        .replace(/^claude-(4(?:\.\d+)?)-(sonnet|opus|haiku)/, "claude-$2-$1")
        .replaceAll(".", "-"),
    };
  }
  const slug = tag !== undefined && EFFORT_TIERS.has(tag) ? `${stem}-${tag}` : stem;
  const tiered = slug.match(
    /^(gemini-[\d.]+-(?:pro|flash(?:-lite)?))-(?:minimal|low|medium|high)$/,
  );
  if (tiered?.[1] !== undefined) return { model: slug, rateModel: tiered[1] };
  return {
    model: slug.replace(/^(gemini-[\d.]+-(?:pro|flash(?:-lite)?))-(?:thinking|[a-z])$/, "$1"),
  };
}

/** Numeric id of an enum name such as `MODEL_PLACEHOLDER_M319` (1000 + N), else `null`. */
export function antigravityModelIdFromEnum(modelEnum: string): number | null {
  const match = modelEnum.trim().match(/^MODEL_PLACEHOLDER_M(\d+)$/);
  return match?.[1] === undefined ? null : 1000 + Number(match[1]);
}

const registry = new Map<number, AntigravityModelName>();

/** Records ids the language server has named; called by the limits probe. */
export function registerAntigravityModelNames(
  names: ReadonlyMap<number, AntigravityModelName>,
): void {
  for (const [id, name] of names) registry.set(id, name);
}

export function antigravityRegisteredModelName(id: number): AntigravityModelName | undefined {
  return registry.get(id);
}
