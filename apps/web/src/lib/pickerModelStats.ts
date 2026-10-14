import type { ModelBenchmarkEntry } from "@t3tools/contracts";
import { matchBenchmarks } from "@t3tools/shared/modelBenchmarkMatch";

const AA_INDEX = "benchLm:benchmark:artificialAnalysis";
const OVERALL = "benchLm:overall";

/** The three numbers a picker row shows, plus the extra the hover card adds. */
export interface PickerModelStats {
  /** Which scale `intelligence` is on; the two scales are never compared. */
  readonly intelligenceSource: "aa" | "overall" | null;
  readonly intelligence: number | null;
  readonly tokensPerSecond: number | null;
  readonly inputPrice: number | null;
  readonly outputPrice: number | null;
  readonly ttftSeconds: number | null;
}

export const NO_PICKER_STATS: PickerModelStats = {
  intelligenceSource: null,
  intelligence: null,
  tokensPerSecond: null,
  inputPrice: null,
  outputPrice: null,
  ttftSeconds: null,
};

const numberOrNull = (value: number | undefined) => value ?? null;

/** Stats for one model from the matched benchmark entry; the AA index wins over BenchLM overall. */
export function pickerModelStats(
  entries:
    | ReadonlyArray<ModelBenchmarkEntry>
    | ReadonlyMap<string, ReadonlyArray<ModelBenchmarkEntry>>,
  query: { readonly modelId: string; readonly displayName?: string },
): PickerModelStats {
  const entry = matchBenchmarks(query, entries)[0]?.entry;
  if (!entry) return NO_PICKER_STATS;
  const aa = entry.values[AA_INDEX];
  const overall = entry.values[OVERALL];
  return {
    intelligenceSource: aa !== undefined ? "aa" : overall !== undefined ? "overall" : null,
    intelligence: aa ?? numberOrNull(overall),
    tokensPerSecond: numberOrNull(entry.values["benchLm:speed"]),
    inputPrice: numberOrNull(entry.values["benchLm:price:input"]),
    outputPrice: numberOrNull(entry.values["benchLm:price:output"]),
    ttftSeconds: numberOrNull(entry.values["benchLm:ttft"]),
  };
}

export const hasPickerStats = (stats: PickerModelStats) =>
  stats.intelligence !== null ||
  stats.tokensPerSecond !== null ||
  stats.inputPrice !== null ||
  stats.outputPrice !== null;

const dollars = (value: number) => `$${value >= 10 ? Math.round(value) : Number(value.toFixed(2))}`;

/** "$2 / $10" per million tokens; null when the source has no price. */
export function formatPickerCost(stats: PickerModelStats): string | null {
  if (stats.inputPrice === null || stats.outputPrice === null) return null;
  return `${dollars(stats.inputPrice)} / ${dollars(stats.outputPrice)}`;
}

export const formatPickerSpeed = (stats: PickerModelStats): string | null =>
  stats.tokensPerSecond === null ? null : `${Math.round(stats.tokensPerSecond)} t/s`;

export const formatPickerIntelligence = (stats: PickerModelStats): string | null =>
  stats.intelligence === null ? null : String(Math.round(stats.intelligence * 10) / 10);
