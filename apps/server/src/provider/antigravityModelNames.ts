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
  readonly model: string;
}

/**
 * Normalizes an Antigravity model label or slug (`Gemini 3.8 Flash (High)`) to a
 * usage model name. Variant tags (`(High)`, `-thinking`, `-n`) are the same model
 * and fold away so one model is not split across rows.
 */
export function antigravityModelNameFromLabel(label: string): AntigravityModelName {
  const normalized = label
    .toLowerCase()
    .trim()
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replaceAll(" ", "-");
  if (normalized.startsWith("claude-")) {
    return {
      model: normalized
        .replace(/^claude-(4(?:\.\d+)?)-(sonnet|opus|haiku)/, "claude-$2-$1")
        .replaceAll(".", "-"),
    };
  }
  return {
    model: normalized.replace(
      /^(gemini-[\d.]+-(?:pro|flash(?:-lite)?))-(?:minimal|low|medium|high|thinking|[a-z])$/,
      "$1",
    ),
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
