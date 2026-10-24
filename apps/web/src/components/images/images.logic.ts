import {
  IMAGE_SOURCE_CHECKING,
  type ImageCommercialUse,
  type ImageItem,
  type ImageModel,
  type ImageSourceStatus,
} from "@t3tools/contracts";

export const MAX_VARIATIONS = 12;

/** Reads the seed field. Empty text means a random seed. */
export function parseSeedInput(text: string): number | null | "invalid" {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (!/^\d{1,10}$/.test(trimmed)) return "invalid";
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : "invalid";
}

export function clampVariations(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(MAX_VARIATIONS, Math.trunc(value)));
}

/** Seconds since an image started, as short text such as "12 s" or "2 min 5 s". */
export function formatElapsed(startedAt: number, now: number): string {
  return formatSeconds(Math.max(0, Math.round((now - startedAt) / 1000)));
}

export function formatSeconds(rawSeconds: number): string {
  const totalSeconds = Math.round(rawSeconds);
  if (totalSeconds < 60) return `${String(totalSeconds)} s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${String(minutes)} min` : `${String(minutes)} min ${String(seconds)} s`;
}

export interface BadgeView {
  readonly label: string;
  readonly variant: "success" | "error" | "warning";
  readonly tip: string;
}

/** Licence badge. Only a verified licence may say yes. */
export function commercialBadge(use: ImageCommercialUse, licence: string): BadgeView {
  switch (use) {
    case "yes":
      return { label: "Commercial use: yes", variant: "success", tip: licence };
    case "no":
      return { label: "Commercial use: no", variant: "error", tip: licence };
    case "check":
      return { label: "Check licence", variant: "warning", tip: licence };
  }
}

/** A failed or stopped image can run again with the same recipe. */
export function canRetry(item: ImageItem): boolean {
  return item.status === "error" || item.status === "cancelled";
}

export interface QueueView {
  readonly waiting: number;
  readonly running: ImageItem | null;
  readonly active: boolean;
}

export function describeQueue(items: ReadonlyArray<ImageItem>): QueueView {
  const running = items.find((item) => item.status === "running") ?? null;
  const waiting = items.filter((item) => item.status === "waiting").length;
  return { waiting, running, active: running !== null || waiting > 0 };
}

/** Unique prompts of finished and queued images, newest first. */
export function promptHistory(items: ReadonlyArray<ImageItem>, limit = 12): string[] {
  const seen = new Set<string>();
  const prompts: string[] = [];
  for (const item of items.toSorted((a, b) => b.createdAt - a.createdAt)) {
    const prompt = item.prompt.trim();
    if (prompt === "" || seen.has(prompt)) continue;
    seen.add(prompt);
    prompts.push(prompt);
    if (prompts.length >= limit) break;
  }
  return prompts;
}

/** Rough time for one press, from the typical seconds of each chosen model. */
export function estimateRunSeconds(
  models: ReadonlyArray<ImageModel>,
  modelIds: ReadonlyArray<string>,
  count: number,
): number {
  return models
    .filter((model) => modelIds.includes(model.id))
    .reduce((total, model) => total + model.typicalSeconds * count, 0);
}

/** Drops chosen ids that the server no longer lists. Falls back to the first model. */
export function resolveSelectedModels(
  models: ReadonlyArray<ImageModel>,
  chosen: ReadonlyArray<string>,
): string[] {
  const known = new Set(models.map((model) => model.id));
  const kept = chosen.filter((id) => known.has(id));
  if (kept.length > 0) return kept;
  return models[0] ? [models[0].id] : [];
}

export function toggleModel(chosen: ReadonlyArray<string>, id: string): string[] {
  return chosen.includes(id) ? chosen.filter((value) => value !== id) : [...chosen, id];
}

/** Online, offline, or not checked yet. Before the first check, ComfyUI is not "not found". */
export function sourcePhase(
  source: Pick<ImageSourceStatus, "online" | "message">,
): "checking" | "online" | "offline" {
  if (source.online) return "online";
  return source.message === IMAGE_SOURCE_CHECKING ? "checking" : "offline";
}
