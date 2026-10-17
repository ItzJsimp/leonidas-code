import type {
  ImageCatalogModel,
  ImageCommercialUse,
  ImageHardwareFit,
  ImageItem,
  ImageModelInstallState,
} from "@t3tools/contracts";

import { computeFit } from "./catalog.logic";

/*
 * Mock data for the Images page. The real server replaces it through useImagesCatalog.
 * Model facts come from research/2026-10-16-images-feature-audit.md and the current
 * server workflows. No licence here is verified: licenceVerifiedOn is null for all.
 */

const GB = 1024 ** 3;

export type GpuProfileId = "6" | "12" | "24";

export const HARDWARE_PROFILES: Record<GpuProfileId, ImageHardwareFit> = {
  "6": {
    gpuName: "Graphics card, 6 GB",
    vramBytes: 6 * GB,
    ramBytes: 16 * GB,
    freeDiskBytes: 40 * GB,
  },
  "12": {
    gpuName: "Graphics card, 12 GB",
    vramBytes: 12 * GB,
    ramBytes: 32 * GB,
    freeDiskBytes: 180 * GB,
  },
  "24": {
    gpuName: "Graphics card, 24 GB",
    vramBytes: 24 * GB,
    ramBytes: 64 * GB,
    freeDiskBytes: 900 * GB,
  },
};

interface ModelSpec {
  readonly id: string;
  readonly label: string;
  readonly family: string;
  readonly sizeGb: number;
  readonly vramGb: number;
  /** Seconds per 1024 px image when the model fits fully on a 12 GB card. */
  readonly baseSeconds: number;
  readonly loadSeconds: number;
  /** Measured average on the 12 GB test PC, from Recipe files. */
  readonly measured12: number | null;
  readonly measuredRuns: number;
  readonly licenceName: string;
  readonly licenceUrl: string | null;
  readonly commercialUse: ImageCommercialUse;
  readonly sourceUrl: string | null;
  readonly candidate: boolean;
  readonly installed: boolean;
  readonly tags: ReadonlyArray<string>;
  readonly speedTier: "fast" | "medium" | "slow";
  readonly steps: number;
  readonly guidance: number;
  readonly stepsMax: number;
  readonly guidanceMax: number;
}

const SAMPLERS = ["euler", "euler_ancestral", "dpmpp_2m", "dpmpp_2m_sde", "uni_pc"];

const REAL_MODELS: ReadonlyArray<ModelSpec> = [
  {
    id: "flux2klein",
    label: "FLUX.2 klein 4B",
    family: "FLUX.2",
    sizeGb: 12,
    vramGb: 10,
    baseSeconds: 15,
    loadSeconds: 12,
    measured12: 15,
    measuredRuns: 14,
    licenceName: "Apache 2.0 (one source)",
    licenceUrl: "https://huggingface.co/black-forest-labs",
    commercialUse: "check",
    sourceUrl: "https://huggingface.co/black-forest-labs",
    candidate: false,
    installed: true,
    tags: ["Fast", "General use"],
    speedTier: "fast",
    steps: 4,
    guidance: 1,
    stepsMax: 12,
    guidanceMax: 4,
  },
  {
    id: "qwen",
    label: "Qwen-Image 2512",
    family: "Qwen-Image",
    sizeGb: 30,
    vramGb: 20,
    baseSeconds: 50,
    loadSeconds: 35,
    measured12: 150,
    measuredRuns: 6,
    licenceName: "Apache 2.0 (original Qwen-Image)",
    licenceUrl: "https://huggingface.co/Qwen",
    commercialUse: "check",
    sourceUrl: "https://huggingface.co/Qwen",
    candidate: false,
    installed: true,
    tags: ["Text in images", "Detailed"],
    speedTier: "slow",
    steps: 30,
    guidance: 4,
    stepsMax: 60,
    guidanceMax: 10,
  },
  {
    id: "qwen21",
    label: "Qwen-Image 2.1",
    family: "Qwen-Image",
    sizeGb: 32,
    vramGb: 22,
    baseSeconds: 55,
    loadSeconds: 40,
    measured12: 165,
    measuredRuns: 4,
    licenceName: "Non-commercial (sources agree)",
    licenceUrl: "https://huggingface.co/Qwen",
    commercialUse: "no",
    sourceUrl: "https://huggingface.co/Qwen",
    candidate: false,
    installed: true,
    tags: ["Text in images", "Photoreal"],
    speedTier: "slow",
    steps: 25,
    guidance: 1,
    stepsMax: 50,
    guidanceMax: 8,
  },
  {
    id: "zimage-turbo",
    label: "Z-Image Turbo",
    family: "Z-Image",
    sizeGb: 20,
    vramGb: 12,
    baseSeconds: 12,
    loadSeconds: 15,
    measured12: null,
    measuredRuns: 0,
    licenceName: "Apache 2.0 (sources, not checked)",
    licenceUrl: null,
    commercialUse: "check",
    sourceUrl: null,
    candidate: true,
    installed: false,
    tags: ["Fast", "Photoreal"],
    speedTier: "fast",
    steps: 8,
    guidance: 1,
    stepsMax: 16,
    guidanceMax: 4,
  },
  {
    id: "flux2dev",
    label: "FLUX.2 dev",
    family: "FLUX.2",
    sizeGb: 60,
    vramGb: 28,
    baseSeconds: 60,
    loadSeconds: 45,
    measured12: null,
    measuredRuns: 0,
    licenceName: "Separate licence for sale use (sources)",
    licenceUrl: null,
    commercialUse: "check",
    sourceUrl: null,
    candidate: true,
    installed: false,
    tags: ["Follows the prompt", "Photoreal"],
    speedTier: "slow",
    steps: 28,
    guidance: 4,
    stepsMax: 50,
    guidanceMax: 10,
  },
  {
    id: "sdxl",
    label: "SDXL 1.0",
    family: "Stable Diffusion",
    sizeGb: 7,
    vramGb: 7,
    baseSeconds: 8,
    loadSeconds: 8,
    measured12: null,
    measuredRuns: 0,
    licenceName: "Check each checkpoint",
    licenceUrl: null,
    commercialUse: "check",
    sourceUrl: null,
    candidate: true,
    installed: false,
    tags: ["Small cards", "Many styles"],
    speedTier: "fast",
    steps: 25,
    guidance: 7,
    stepsMax: 60,
    guidanceMax: 15,
  },
];

/** Extra rows for the 20-model test. Names say they are test data, so nobody trusts them. */
function testSpecs(count: number): ModelSpec[] {
  const tiers = ["fast", "medium", "slow"] as const;
  return Array.from({ length: count }, (_, index): ModelSpec => {
    const tier = tiers[index % 3]!;
    const vramGb = 6 + ((index * 5) % 26);
    return {
      id: `test-${String(index + 1)}`,
      label: `Test model ${String(index + 1)}`,
      family: "Test data",
      sizeGb: 4 + ((index * 7) % 40),
      vramGb,
      baseSeconds: tier === "fast" ? 10 : tier === "medium" ? 30 : 70,
      loadSeconds: 20,
      measured12: null,
      measuredRuns: 0,
      licenceName: "Not checked",
      licenceUrl: null,
      commercialUse: "check",
      sourceUrl: null,
      candidate: true,
      installed: index % 4 === 0,
      tags: tier === "fast" ? ["Fast"] : [],
      speedTier: tier,
      steps: 20,
      guidance: 5,
      stepsMax: 50,
      guidanceMax: 12,
    };
  });
}

export function catalogSpecs(big: boolean): ReadonlyArray<ModelSpec> {
  return big ? [...REAL_MODELS, ...testSpecs(20 - REAL_MODELS.length)] : REAL_MODELS;
}

export interface InstallOverride {
  readonly state: ImageModelInstallState;
  readonly progress: number | null;
}

/** Builds the catalog the page shows, for one PC and the current install states. */
export function buildCatalog(
  specs: ReadonlyArray<ModelSpec>,
  profile: GpuProfileId,
  overrides: ReadonlyMap<string, InstallOverride>,
): ImageCatalogModel[] {
  const hardware = HARDWARE_PROFILES[profile];
  return specs.map((spec): ImageCatalogModel => {
    const { fit, reason } = computeFit(spec.vramGb * GB, hardware);
    const cardGb = hardware.vramBytes / GB;
    const scale = Math.sqrt(12 / cardGb) * (fit === "runs-slow" ? 3 : fit === "too-big" ? 6 : 1);
    const override = overrides.get(spec.id);
    const state: ImageModelInstallState =
      override?.state ?? (spec.installed ? "ready" : "not-installed");
    const measured = profile === "12" ? spec.measured12 : null;
    return {
      id: spec.id,
      label: spec.label,
      family: spec.family,
      sizeBytes: Math.round(spec.sizeGb * GB),
      files: [
        { name: `${spec.id}_model.safetensors`, sizeBytes: Math.round(spec.sizeGb * 0.7 * GB) },
        {
          name: `${spec.id}_text_encoder.safetensors`,
          sizeBytes: Math.round(spec.sizeGb * 0.28 * GB),
        },
        { name: `${spec.id}_vae.safetensors`, sizeBytes: Math.round(spec.sizeGb * 0.02 * GB) },
      ],
      state,
      installProgress: override?.progress ?? null,
      vramBytes: spec.vramGb * GB,
      fit,
      fitReason: reason,
      measuredSeconds: measured,
      measuredRuns: measured === null ? 0 : spec.measuredRuns,
      estimatedSeconds: Math.round(spec.baseSeconds * scale),
      loadSeconds: spec.loadSeconds,
      licenceName: spec.licenceName,
      licenceUrl: spec.licenceUrl,
      commercialUse: spec.commercialUse,
      licenceVerifiedOn: null,
      sourceUrl: spec.sourceUrl,
      candidate: spec.candidate,
      tags: spec.tags,
      speedTier: spec.speedTier,
      defaults: {
        steps: spec.steps,
        guidance: spec.guidance,
        sampler: "euler",
        width: 1024,
        height: 1024,
      },
      ranges: {
        steps: { min: 1, max: spec.stepsMax, step: 1 },
        guidance: { min: 0, max: spec.guidanceMax, step: 0.5 },
      },
      samplers: SAMPLERS,
    };
  });
}

/** One picture in the mock gallery. Adds the settings a Recipe holds. */
export interface GalleryItem extends ImageItem {
  readonly width: number;
  readonly height: number;
  readonly steps: number;
  readonly guidance: number;
  readonly sampler: string;
  readonly negativePrompt: string;
  readonly benchmark: boolean;
}

const HUES: Record<string, number> = {
  flux2klein: 160,
  qwen: 220,
  qwen21: 280,
  "zimage-turbo": 30,
  flux2dev: 0,
  sdxl: 100,
};

/**
 * A small SVG stand-in for a picture, so the mock needs no files. Same model and seed
 * give the same picture, like the real engine.
 */
export function mockImageUrl(
  item: Pick<GalleryItem, "modelId" | "seed" | "width" | "height" | "modelLabel">,
): string {
  const hue = (HUES[item.modelId] ?? (item.modelId.length * 37) % 360) + (item.seed % 40);
  const x = 20 + (item.seed % 60);
  const y = 20 + ((item.seed >> 3) % 60);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(item.width)} ${String(item.height)}"><defs><radialGradient id="g" cx="${String(x)}%" cy="${String(y)}%" r="80%"><stop offset="0" stop-color="hsl(${String(hue + 40)} 70% 72%)"/><stop offset="1" stop-color="hsl(${String(hue)} 45% 22%)"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${String(x)}%" cy="${String(y)}%" r="${String(8 + (item.seed % 12))}%" fill="hsl(${String(hue + 160)} 60% 80% / .55)"/><text x="50%" y="92%" text-anchor="middle" font-family="sans-serif" font-size="${String(Math.round(item.width / 24))}" fill="white" fill-opacity=".85">${item.modelLabel} · ${String(item.seed)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const MINUTE = 60_000;

function sample(
  jobId: string,
  createdAt: number,
  prompt: string,
  modelId: string,
  modelLabel: string,
  seed: number,
  status: GalleryItem["status"],
  seconds: number | null,
  extra: Partial<GalleryItem> = {},
): GalleryItem {
  return {
    id: `${jobId}-${modelId}-${String(seed)}`,
    jobId,
    prompt,
    modelId,
    modelLabel,
    seed,
    status,
    createdAt,
    startedAt: status === "done" || status === "error" ? createdAt : null,
    seconds,
    file: status === "done" ? `images/${jobId}_${modelId}_${String(seed)}.png` : null,
    kept: false,
    error: null,
    width: 1024,
    height: 1024,
    steps: 20,
    guidance: 4,
    sampler: "euler",
    negativePrompt: "",
    benchmark: false,
    ...extra,
  };
}

/** Two earlier runs: one with 3 models and a failed image, one with a stopped image. */
export function sampleGallery(now: number): GalleryItem[] {
  const promptA = "cute mint-green ghost slime, sticker cartoon, white background, no text";
  const promptB = "a lighthouse on a cliff at sunset, oil painting";
  const a = now - 20 * MINUTE;
  const b = now - 3 * 60 * MINUTE;
  return [
    sample("run-a", a, promptA, "flux2klein", "FLUX.2 klein 4B", 785404285, "done", 14, {
      steps: 4,
      guidance: 1,
      kept: true,
    }),
    sample("run-a", a, promptA, "flux2klein", "FLUX.2 klein 4B", 785404286, "done", 15, {
      steps: 4,
      guidance: 1,
    }),
    sample("run-a", a, promptA, "qwen", "Qwen-Image 2512", 785404285, "done", 148, { steps: 30 }),
    sample("run-a", a, promptA, "qwen", "Qwen-Image 2512", 785404286, "done", 152, { steps: 30 }),
    sample("run-a", a, promptA, "qwen21", "Qwen-Image 2.1", 785404285, "done", 163, {
      steps: 25,
      guidance: 1,
    }),
    sample("run-a", a, promptA, "qwen21", "Qwen-Image 2.1", 785404286, "error", null, {
      steps: 25,
      guidance: 1,
      error:
        "ComfyUI ran out of graphics memory. Close other apps that use the card, then press Try again.",
    }),
    sample("run-b", b, promptB, "flux2klein", "FLUX.2 klein 4B", 1200, "done", 16, {
      steps: 4,
      guidance: 1,
      width: 1024,
      height: 768,
    }),
    sample("run-b", b, promptB, "flux2klein", "FLUX.2 klein 4B", 1201, "cancelled", null, {
      steps: 4,
      guidance: 1,
      width: 1024,
      height: 768,
    }),
  ];
}

/** Six fixed prompts for "Run benchmark prompts". They test text, faces, hands, scenes and style. */
export const BENCHMARK_PROMPTS: ReadonlyArray<string> = [
  'a shop sign that says "OPEN 24 HOURS" in red neon',
  "close-up portrait of an old fisherman, soft window light",
  "two hands holding a cup of tea, top view",
  "a busy city street in the rain at night, wide shot",
  "a red fox in a snowy forest, children's book style",
  "a glass bottle with a tiny ship inside, product photo on white",
];

export const BENCHMARK_SEED = 1234;

/** Public arena page for model rankings. We do not check its numbers. */
export const ARENA_URL = "https://artificialanalysis.ai/text-to-image/arena";
export const COMFY_INSTALL_URL = "https://www.comfy.org/download";
export const COMFY_START_COMMAND = "python main.py --listen 127.0.0.1 --port 8188";
