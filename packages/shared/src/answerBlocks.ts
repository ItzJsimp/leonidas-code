/**
 * Answer blocks: small native UI parts that an agent emits inside a reply as
 * a fenced code block, for example ```` ```leo:table ```` with compact JSON.
 * The app renders only its own components; a bad block falls back to the
 * raw fence text, so a reply never breaks.
 */

export type Cell = string | number;

export type AnswerBlock =
  | { type: "table"; kpis?: Array<[string, string]>; cols: string[]; rows: Cell[][] }
  | { type: "choices"; q?: string; options: Array<{ label: string; note?: string }> }
  | { type: "checklist"; title?: string; items: string[] }
  | {
      type: "chart";
      kind: "bar" | "line" | "donut";
      title?: string;
      labels: string[];
      values: number[];
    };

export type AnswerBlockType = AnswerBlock["type"];

export type AnswerBlockParse =
  | { status: "block"; block: AnswerBlock }
  | { status: "pending" }
  | { status: "fallback" };

const BLOCK_TYPES: ReadonlySet<string> = new Set(["table", "choices", "checklist", "chart"]);
const CHART_KINDS: ReadonlySet<string> = new Set(["bar", "line", "donut"]);
const FENCE_PREFIX = "leo:";

export function answerBlockType(language: string | null | undefined): AnswerBlockType | null {
  if (!language?.startsWith(FENCE_PREFIX)) return null;
  const type = language.slice(FENCE_PREFIX.length);
  return BLOCK_TYPES.has(type) ? (type as AnswerBlockType) : null;
}

const isString = (value: unknown): value is string => typeof value === "string";
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);
const isCell = (value: unknown): value is Cell =>
  isString(value) || (typeof value === "number" && Number.isFinite(value));
const optionalString = (value: unknown): value is string | undefined =>
  value === undefined || isString(value);

function toBlock(type: AnswerBlockType, data: Record<string, unknown>): AnswerBlock | null {
  switch (type) {
    case "table": {
      const { kpis, cols, rows } = data;
      if (!isStringArray(cols) || cols.length === 0 || !Array.isArray(rows)) return null;
      if (!rows.every((row) => Array.isArray(row) && row.every(isCell))) return null;
      if (kpis !== undefined) {
        const valid =
          Array.isArray(kpis) &&
          kpis.every((kpi) => Array.isArray(kpi) && kpi.length === 2 && kpi.every(isCell));
        if (!valid) return null;
        const pairs = kpis.map(
          ([label, value]) => [String(label), String(value)] as [string, string],
        );
        return { type, kpis: pairs, cols, rows: rows as Cell[][] };
      }
      return { type, cols, rows: rows as Cell[][] };
    }
    case "choices": {
      const { q, options } = data;
      if (!optionalString(q) || !Array.isArray(options) || options.length === 0) return null;
      const parsed: Array<{ label: string; note?: string }> = [];
      for (const option of options) {
        if (isString(option)) {
          parsed.push({ label: option });
        } else if (option && typeof option === "object" && isString(option.label)) {
          if (!optionalString(option.note)) return null;
          parsed.push(
            option.note ? { label: option.label, note: option.note } : { label: option.label },
          );
        } else {
          return null;
        }
      }
      return q ? { type, q, options: parsed } : { type, options: parsed };
    }
    case "checklist": {
      const { title, items } = data;
      if (!optionalString(title) || !isStringArray(items) || items.length === 0) return null;
      return title ? { type, title, items } : { type, items };
    }
    case "chart": {
      const { kind, title, labels, values } = data;
      if (!isString(kind) || !CHART_KINDS.has(kind) || !optionalString(title)) return null;
      if (!isStringArray(labels) || !Array.isArray(values)) return null;
      if (labels.length !== values.length) return null;
      if (!values.every((v) => typeof v === "number" && Number.isFinite(v))) return null;
      const base = {
        type,
        kind: kind as "bar" | "line" | "donut",
        labels,
        values: values as number[],
      };
      return title ? { ...base, title } : base;
    }
  }
}

/**
 * Parse the body of a `leo:<type>` fence. `closed` is false while the fence
 * still streams; an unclosed fence that does not parse yet is "pending".
 */
export function parseAnswerBlock(
  type: AnswerBlockType,
  text: string,
  closed: boolean,
): AnswerBlockParse {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return closed ? { status: "fallback" } : { status: "pending" };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return { status: "fallback" };
  const block = toBlock(type, data as Record<string, unknown>);
  return block ? { status: "block", block } : { status: "fallback" };
}
