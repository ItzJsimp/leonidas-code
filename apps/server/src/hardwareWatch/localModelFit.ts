/**
 * Pure rules for the Models tab: how well a model fits this PC, whether a download may start,
 * and how to read one line of Ollama's streamed pull response.
 */
import {
  RAM_OFFLOAD_SHARE,
  type CapacityVolume,
  type LocalModelCapacity,
} from "./localModelCapacity.ts";

const GB = 1024 ** 3;

/** A pull above this size needs a click on the confirm step first. */
const CONFIRM_ABOVE_BYTES = 10 * GB;
/** Extra free space a download needs on top of the model size. */
const SPACE_MARGIN = 1.1;

export type LocalModelFit = "fits" | "tight" | "too_big" | "unknown";

export function fitFor(sizeBytes: number | null, capacity: LocalModelCapacity): LocalModelFit {
  if (sizeBytes === null || !(sizeBytes > 0)) return "unknown";
  if (sizeBytes <= capacity.fullGpuBudgetBytes) return "fits";
  if (sizeBytes <= capacity.offloadBudgetBytes) return "tight";
  return "too_big";
}

export type DownloadGate =
  | { readonly allowed: true; readonly needsConfirm: boolean }
  | { readonly allowed: false; readonly reason: string };

export function downloadGate(input: {
  readonly sizeBytes: number;
  readonly volume: CapacityVolume | null;
  readonly ollamaRunning: boolean;
}): DownloadGate {
  if (!input.ollamaRunning) {
    return { allowed: false, reason: "Ollama is not running. Start Ollama, then try again." };
  }
  const { volume, sizeBytes } = input;
  if (volume === null) {
    return {
      allowed: false,
      reason: "The model drive is unknown, so free space cannot be checked.",
    };
  }
  if (volume.mediaType === "hdd") {
    return {
      allowed: false,
      reason: `Drive ${volume.mount} is a hard disk. Models load too slowly from it. Move the model folder to an SSD.`,
    };
  }
  if (volume.freeBytes < sizeBytes * SPACE_MARGIN) {
    const need = ((sizeBytes * SPACE_MARGIN) / GB).toFixed(1);
    const free = (volume.freeBytes / GB).toFixed(1);
    return {
      allowed: false,
      reason: `Not enough space on ${volume.mount}. The download needs ${need} GB and ${free} GB is free.`,
    };
  }
  return { allowed: true, needsConfirm: sizeBytes > CONFIRM_ABOVE_BYTES };
}

export interface PullProgress {
  readonly status: string;
  readonly completedBytes: number | null;
  readonly totalBytes: number | null;
  readonly error: string | null;
}

export function parsePullLine(line: string): PullProgress | null {
  const text = line.trim();
  if (text.length === 0) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const num = (key: string) => (typeof record[key] === "number" ? (record[key] as number) : null);
  return {
    status: typeof record["status"] === "string" ? record["status"] : "",
    completedBytes: num("completed"),
    totalBytes: num("total"),
    error: typeof record["error"] === "string" ? record["error"] : null,
  };
}

export interface LoadedModelMemory {
  readonly sizeBytes: number;
  readonly vramBytes: number;
}

/**
 * Memory that Ollama itself holds for loaded models is free again once they unload.
 * Without this, a model that is running would make every model look larger.
 */
export function releaseLoadedModels(
  capacity: LocalModelCapacity,
  loaded: ReadonlyArray<LoadedModelMemory>,
): LocalModelCapacity {
  if (loaded.length === 0) return capacity;
  let vram = 0;
  let ram = 0;
  for (const model of loaded) {
    const inVram = Math.min(model.vramBytes, model.sizeBytes);
    vram += inVram;
    ram += model.sizeBytes - inVram;
  }
  return {
    ...capacity,
    fullGpuBudgetBytes: capacity.fullGpuBudgetBytes + vram,
    offloadBudgetBytes: capacity.offloadBudgetBytes + vram + ram * RAM_OFFLOAD_SHARE,
  };
}
