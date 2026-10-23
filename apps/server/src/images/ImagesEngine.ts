// @effect-diagnostics nodeBuiltinImport:off globalDate:off globalDateInEffect:off preferSchemaOverJson:off - Plain async worker; image files and wall-clock times are the product.
/**
 * The Images engine. It owns the queue, runs images one at a time through an Image Source,
 * and saves each result with its Recipe. It has no Effect dependency, so tests drive it directly.
 */
import * as NodeCrypto from "node:crypto";
import * as NodePath from "node:path";

import {
  IMAGE_SOURCE_CHECKING,
  type ImageItem,
  type ImageSourceStatus,
  type ImagesState,
} from "@t3tools/contracts";

import { comfyModelLabel } from "./imageModels.ts";
import { ImageQueue, expandVariations, pickRandomSeed, shouldFreeMemory } from "./imageQueue.ts";
import { ImageCancelledError, type ImageSource } from "./imageSource.ts";
import {
  IMAGES_FOLDER,
  imageBaseName,
  readStoredImages,
  saveImageWithRecipe,
  setKept,
} from "./recipe.ts";

/** Entries kept in memory. Older finished images stay on disk and return when the project opens. */
const MAX_ENTRIES = 300;
/** Recipes read from disk when a project opens. */
const HYDRATE_LIMIT = 60;

interface Entry {
  readonly id: string;
  readonly jobId: string;
  readonly workspaceRoot: string;
  readonly prompt: string;
  readonly modelId: string;
  readonly modelLabel: string;
  readonly seed: number;
  readonly createdAt: number;
  status: ImageItem["status"];
  startedAt: number | null;
  seconds: number | null;
  /** File name inside the images folder. */
  name: string | null;
  kept: boolean;
  error: string | null;
  stopRequested: boolean;
}

export interface ImagesEngineOptions {
  readonly source: ImageSource;
  readonly now?: () => number;
  readonly random?: () => number;
  /** Called after any change the panel should show. */
  readonly onChange?: () => void;
}

export class ImagesEngine {
  private readonly queue = new ImageQueue<Entry>();
  private readonly hydrated = new Set<string>();
  private models: ImagesState["models"] = [];
  private lastModelId: string | null = null;
  private pumping = false;
  private abort: AbortController | null = null;
  private sourceStatus: ImageSourceStatus;
  private readonly now: () => number;
  private readonly random: () => number;

  private readonly options: ImagesEngineOptions;

  constructor(options: ImagesEngineOptions) {
    this.options = options;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.sourceStatus = {
      sourceId: options.source.id,
      label: options.source.label,
      baseUrl: options.source.address(),
      online: false,
      busy: false,
      message: IMAGE_SOURCE_CHECKING,
    };
  }

  private changed(): void {
    this.options.onChange?.();
  }

  private imagesDir(workspaceRoot: string): string {
    return NodePath.join(workspaceRoot, IMAGES_FOLDER);
  }

  /** Loads finished images of a project from its Recipe sidecars. Runs once per project folder. */
  async hydrate(workspaceRoot: string): Promise<void> {
    if (this.hydrated.has(workspaceRoot)) return;
    this.hydrated.add(workspaceRoot);
    const stored = await readStoredImages(this.imagesDir(workspaceRoot), HYDRATE_LIMIT);
    const known = new Set(this.queue.items.map((entry) => `${entry.workspaceRoot}|${entry.name}`));
    const older = stored
      .filter((image) => !known.has(`${workspaceRoot}|${image.name}`))
      .map((image): Entry => ({
        id: `disk-${image.name}`,
        jobId: "disk",
        workspaceRoot,
        prompt: image.recipe.prompt,
        modelId: image.recipe.modelId,
        modelLabel: image.recipe.modelLabel,
        seed: image.recipe.seed,
        createdAt: Date.parse(image.recipe.createdAt) || 0,
        status: "done",
        startedAt: null,
        seconds: image.recipe.seconds,
        name: image.name,
        kept: image.kept,
        error: null,
        stopRequested: false,
      }));
    // Disk images are older than anything made in this session, so they go first.
    this.queue.enqueue(older);
    this.changed();
  }

  /** Reads the source status. Tells the panel when it changed. */
  async refreshStatus(): Promise<void> {
    const status = await this.options.source.status();
    // A cold ComfyUI is silent while it loads a model. While our own image runs, that is busy, not gone.
    const busy = !status.online && status.timedOut === true && this.queue.running() !== undefined;
    const next: ImageSourceStatus = {
      sourceId: this.options.source.id,
      label: this.options.source.label,
      baseUrl: this.options.source.address(),
      online: status.online,
      busy,
      message: busy ? "ComfyUI is busy. It may be loading a model." : status.message,
    };
    const same =
      next.online === this.sourceStatus.online &&
      next.busy === this.sourceStatus.busy &&
      next.message === this.sourceStatus.message &&
      next.baseUrl === this.sourceStatus.baseUrl;
    this.sourceStatus = next;
    if (!same) this.changed();
  }

  /** Queues one Generate press. Returns at once; the worker runs in the background. */
  enqueue(input: {
    readonly workspaceRoot: string;
    readonly prompt: string;
    readonly modelIds: ReadonlyArray<string>;
    readonly seed: number | null | undefined;
    readonly count: number;
  }): { readonly jobId: string; readonly queued: number } {
    const jobId = NodeCrypto.randomUUID();
    const seed = input.seed ?? pickRandomSeed(this.random);
    const createdAt = this.now();
    const entries = expandVariations({ modelIds: input.modelIds, seed, count: input.count }).map(
      (planned, index): Entry => ({
        id: `${jobId}-${String(index)}`,
        jobId,
        workspaceRoot: input.workspaceRoot,
        prompt: input.prompt,
        modelId: planned.modelId,
        modelLabel: comfyModelLabel(planned.modelId),
        seed: planned.seed,
        createdAt,
        status: "waiting",
        startedAt: null,
        seconds: null,
        name: null,
        kept: false,
        error: null,
        stopRequested: false,
      }),
    );
    this.queue.enqueue(entries);
    this.queue.trim(MAX_ENTRIES);
    this.changed();
    void this.pump();
    return { jobId, queued: entries.length };
  }

  /** Queues a failed or stopped image again with the same prompt, model and seed. */
  retry(input: { readonly workspaceRoot: string; readonly itemId: string }): number | null {
    const failed = this.queue.items.find(
      (candidate) =>
        candidate.id === input.itemId &&
        candidate.workspaceRoot === input.workspaceRoot &&
        (candidate.status === "error" || candidate.status === "cancelled"),
    );
    if (!failed) return null;
    const fresh: Entry = {
      ...failed,
      id: `${failed.jobId}-retry-${NodeCrypto.randomUUID().slice(0, 8)}`,
      status: "waiting",
      startedAt: null,
      seconds: null,
      name: null,
      kept: false,
      error: null,
      stopRequested: false,
    };
    // The new card takes the place of the failed one. Its time stays, so it keeps its spot in the grid.
    this.queue.remove(failed);
    this.queue.enqueue([fresh]);
    this.changed();
    void this.pump();
    return 1;
  }

  /** Cancels every waiting image. With `stopRunning` it also stops the image that runs now. */
  async cancel(input: { readonly stopRunning: boolean }): Promise<number> {
    const cancelled = this.queue.cancelWaiting();
    for (const entry of cancelled) entry.error = "Cancelled.";
    let count = cancelled.length;
    const running = this.queue.running();
    if (input.stopRunning && running) {
      running.stopRequested = true;
      count += 1;
      this.abort?.abort();
      await this.options.source.interrupt().catch(() => undefined);
    }
    this.changed();
    return count;
  }

  /** Keeps or un-keeps a finished image. Returns the new state. */
  async keep(input: {
    readonly workspaceRoot: string;
    readonly itemId: string;
    readonly kept: boolean;
  }): Promise<boolean | null> {
    const entry = this.queue.items.find(
      (candidate) =>
        candidate.id === input.itemId &&
        candidate.workspaceRoot === input.workspaceRoot &&
        candidate.status === "done" &&
        candidate.name !== null,
    );
    if (!entry || entry.name === null) return null;
    await setKept(this.imagesDir(entry.workspaceRoot), entry.name, input.kept);
    entry.kept = input.kept;
    this.changed();
    return entry.kept;
  }

  /** The state of one project. Newest first. */
  snapshot(workspaceRoot: string): ImagesState {
    const items = this.queue.items
      // A waiting image that was cancelled never ran. Leave it out.
      .filter(
        (entry) =>
          entry.workspaceRoot === workspaceRoot &&
          !(entry.status === "cancelled" && entry.startedAt === null),
      )
      .map((entry): ImageItem => ({
        id: entry.id,
        jobId: entry.jobId,
        prompt: entry.prompt,
        modelId: entry.modelId,
        modelLabel: entry.modelLabel,
        seed: entry.seed,
        status: entry.status,
        createdAt: entry.createdAt,
        startedAt: entry.startedAt,
        seconds: entry.seconds,
        file: entry.name === null ? null : `${IMAGES_FOLDER}/${entry.name}.png`,
        kept: entry.kept,
        error: entry.error,
      }))
      // Newest press first. The sort is stable, so one press keeps its run order.
      .toSorted((a, b) => b.createdAt - a.createdAt);
    return {
      source: this.sourceStatus,
      models: this.models,
      items,
      now: this.now(),
      workspaceRoot,
      imagesFolder: IMAGES_FOLDER,
    };
  }

  async loadModels(): Promise<void> {
    this.models = await this.options.source.listModels();
    this.changed();
  }

  /** Runs waiting images one by one until the queue is empty. */
  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      for (;;) {
        const entry = this.queue.claimNext();
        if (!entry) break;
        await this.runEntry(entry);
        this.queue.trim(MAX_ENTRIES);
        this.changed();
      }
    } finally {
      this.pumping = false;
    }
  }

  private async runEntry(entry: Entry): Promise<void> {
    const { source } = this.options;
    entry.startedAt = this.now();
    this.changed();
    this.abort = new AbortController();
    try {
      if (shouldFreeMemory(this.lastModelId, entry.modelId)) {
        await source.freeMemory?.();
      }
      this.lastModelId = entry.modelId;
      const result = await source.generate(
        { modelId: entry.modelId, prompt: entry.prompt, seed: entry.seed },
        { signal: this.abort.signal },
      );
      const finishedAt = this.now();
      const seconds = Math.round((finishedAt - (entry.startedAt ?? finishedAt)) / 100) / 10;
      const saved = await saveImageWithRecipe({
        dir: this.imagesDir(entry.workspaceRoot),
        bytes: result.bytes,
        base: imageBaseName(new Date(finishedAt), entry.modelId, entry.seed),
        recipe: {
          source: source.id,
          prompt: entry.prompt,
          seed: entry.seed,
          modelId: entry.modelId,
          modelLabel: entry.modelLabel,
          settings: result.settings,
          createdAt: new Date(finishedAt).toISOString(),
          seconds,
        },
      });
      entry.name = saved.name;
      entry.seconds = seconds;
      entry.status = "done";
    } catch (cause) {
      if (cause instanceof ImageCancelledError || entry.stopRequested) {
        entry.status = "cancelled";
        entry.error = "Stopped.";
      } else {
        entry.status = "error";
        entry.error = cause instanceof Error ? cause.message : "The image failed.";
      }
      entry.seconds = Math.round((this.now() - (entry.startedAt ?? this.now())) / 100) / 10;
    } finally {
      this.abort = null;
    }
  }
}
