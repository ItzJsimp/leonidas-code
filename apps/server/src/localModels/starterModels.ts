/**
 * The approved model list. The data lives in `approvedModels.json`: each entry has the Ollama tag,
 * the file size in bytes, the list it came from, the date it was read and the last measured speed.
 * The server pulls only tags in this list. An installed model shows its real size from Ollama.
 */
import approved from "./approvedModels.json" with { type: "json" };

export interface StarterModel {
  readonly id: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly benchLm: number | null;
  readonly source: string;
  readonly date: string;
  /** Tokens per second from the last speed test. Null until one ran. */
  readonly tokensPerSecond: number | null;
}

const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const orNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** Keep only well-formed entries, so a bad edit of the JSON cannot widen the pull allow list. */
export function parseApprovedModels(raw: unknown): ReadonlyArray<StarterModel> {
  const list = (raw as { models?: unknown } | null)?.models;
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry: Record<string, unknown>) => {
    const size = orNull(entry["sizeBytes"]);
    if (!isText(entry["id"]) || !isText(entry["name"]) || size === null || size <= 0) return [];
    return [
      {
        id: entry["id"],
        name: entry["name"],
        sizeBytes: size,
        benchLm: orNull(entry["benchLm"]),
        source: isText(entry["source"]) ? entry["source"] : "",
        date: isText(entry["date"]) ? entry["date"] : "",
        tokensPerSecond: orNull(entry["tokensPerSecond"]),
      },
    ];
  });
}

export const STARTER_MODELS: ReadonlyArray<StarterModel> = parseApprovedModels(approved);
