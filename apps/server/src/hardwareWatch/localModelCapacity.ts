/**
 * What this machine can offer a local model: GPU memory, RAM and the best drive for model files.
 * Pure function over the live sample so the Models tab and the download gate share one answer.
 */

const GB = 1024 ** 3;

/** VRAM kept free for the desktop, the KV cache and driver overhead. */
const VRAM_HEADROOM_BYTES = 1.5 * GB;
/** Share of free RAM a model may use when layers spill out of VRAM. */
export const RAM_OFFLOAD_SHARE = 0.7;

export type LocalAccelerator = "cuda" | "vulkan" | "metal" | "cpu";
export type LocalRuntime = "ollama" | "llama.cpp";

export interface CapacityInput {
  readonly cpuThreads: number;
  readonly memory: { readonly totalBytes: number; readonly usedBytes: number };
  readonly gpus: ReadonlyArray<{
    readonly name: string;
    readonly vendor: string | null;
    readonly vramTotalBytes: number | null;
    readonly vramUsedBytes: number | null;
  }>;
  readonly volumes: ReadonlyArray<{
    readonly mount: string;
    readonly mediaType?: "ssd" | "hdd" | "unknown" | undefined;
    readonly usedBytes: number;
    readonly totalBytes: number;
  }>;
}

export interface CapacityVolume {
  readonly mount: string;
  readonly mediaType: "ssd" | "hdd" | "unknown";
  readonly freeBytes: number;
}

export interface LocalModelCapacity {
  readonly gpu: {
    readonly name: string;
    readonly vramTotalBytes: number;
    readonly vramFreeBytes: number;
    /** VRAM used by other apps right now. */
    readonly vramHeldBytes: number;
  } | null;
  readonly accelerator: LocalAccelerator;
  readonly cpuThreads: number;
  readonly ramTotalBytes: number;
  readonly ramFreeBytes: number;
  /** Largest model file that runs fully on the GPU. */
  readonly fullGpuBudgetBytes: number;
  /** Largest model file that runs with layers spilled to RAM. */
  readonly offloadBudgetBytes: number;
  /** Fastest drive with the most free space, for models in daily use. */
  readonly hotVolume: CapacityVolume | null;
  /** Largest slower drive, for models kept in storage. */
  readonly coldVolume: CapacityVolume | null;
  readonly runtimes: ReadonlyArray<LocalRuntime>;
}

function acceleratorFor(vendor: string | null, name: string): LocalAccelerator {
  const text = `${vendor ?? ""} ${name}`.toLowerCase();
  if (text.includes("nvidia")) return "cuda";
  if (text.includes("apple")) return "metal";
  if (text.includes("amd") || text.includes("radeon") || text.includes("intel")) return "vulkan";
  return "cpu";
}

function toVolume(volume: CapacityInput["volumes"][number]): CapacityVolume {
  return {
    mount: volume.mount,
    mediaType: volume.mediaType ?? "unknown",
    freeBytes: Math.max(0, volume.totalBytes - volume.usedBytes),
  };
}

function mostFree(volumes: ReadonlyArray<CapacityVolume>): CapacityVolume | null {
  return volumes.reduce<CapacityVolume | null>(
    (best, volume) => (best === null || volume.freeBytes > best.freeBytes ? volume : best),
    null,
  );
}

export function computeLocalModelCapacity(input: CapacityInput): LocalModelCapacity {
  const best = input.gpus.reduce<CapacityInput["gpus"][number] | null>(
    (top, gpu) => ((gpu.vramTotalBytes ?? 0) > (top?.vramTotalBytes ?? 0) ? gpu : top),
    null,
  );
  const vramTotal = best?.vramTotalBytes ?? 0;
  const gpu =
    best && vramTotal > 0
      ? {
          name: best.name,
          vramTotalBytes: vramTotal,
          vramFreeBytes: Math.max(0, vramTotal - (best.vramUsedBytes ?? 0)),
          vramHeldBytes: best.vramUsedBytes ?? 0,
        }
      : null;
  const accelerator = gpu && best ? acceleratorFor(best.vendor, best.name) : "cpu";
  const ramFree = Math.max(0, input.memory.totalBytes - input.memory.usedBytes);
  const fullGpuBudget = gpu ? Math.max(0, gpu.vramFreeBytes - VRAM_HEADROOM_BYTES) : 0;
  const volumes = input.volumes.map(toVolume);
  return {
    gpu,
    accelerator,
    cpuThreads: input.cpuThreads,
    ramTotalBytes: input.memory.totalBytes,
    ramFreeBytes: ramFree,
    fullGpuBudgetBytes: fullGpuBudget,
    offloadBudgetBytes: fullGpuBudget + ramFree * RAM_OFFLOAD_SHARE,
    hotVolume: mostFree(volumes.filter((volume) => volume.mediaType === "ssd")),
    coldVolume: mostFree(volumes.filter((volume) => volume.mediaType !== "ssd")),
    runtimes: accelerator === "cpu" ? ["ollama"] : ["ollama", "llama.cpp"],
  };
}
