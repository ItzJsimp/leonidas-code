/**
 * Plain engine behind the Models tab. It talks to Ollama over HTTP and keeps the download state.
 * `LocalModelsService` wraps it for RPC. The engine has no Effect code so tests can drive it directly.
 */
import {
  LocalModelsError,
  type LocalModelPull,
  type LocalModelRow,
  type LocalModelsState,
} from "@t3tools/contracts";

import type { CapacityVolume, LocalModelCapacity } from "../hardwareWatch/localModelCapacity.ts";
import { downloadGate, fitFor, parsePullLine } from "../hardwareWatch/localModelFit.ts";
import { isEmbeddingModel } from "../provider/ollamaModelCatalog.ts";
import { STARTER_MODELS } from "./starterModels.ts";

/** How long Run keeps the model in memory. Matches the keep-alive of the Ollama setup. */
const RUN_KEEP_ALIVE = "30m";
const REQUEST_TIMEOUT_MS = 4_000;
/** Do not publish a pull progress change more often than this. */
const PROGRESS_PUBLISH_MS = 500;

export interface LocalModelsHardware {
  readonly capacity: LocalModelCapacity;
  readonly volumes: ReadonlyArray<CapacityVolume>;
}

export interface LocalModelsEngineDeps {
  readonly baseUrl: () => string;
  readonly fetch: typeof fetch;
  readonly hardware: () => LocalModelsHardware | null;
  /** Real path of the Ollama model folder, or null when unknown. */
  readonly modelDir: () => string | null;
  readonly onChange: () => void;
  readonly now: () => number;
}

interface InstalledModel {
  readonly id: string;
  readonly sizeBytes: number | null;
}

interface PullEntry {
  readonly controller: AbortController;
  readonly layers: Map<string, { total: number; completed: number }>;
  status: string;
  error: string | null;
  running: boolean;
}

const normalizeMount = (value: string): string =>
  value.replace(/\\/g, "/").replace(/\/+$/, "").toUpperCase();

/** The volume with the longest mount that is a prefix of the path. */
export function volumeForPath(
  path: string | null,
  volumes: ReadonlyArray<CapacityVolume>,
): CapacityVolume | null {
  if (path === null) return null;
  const target = normalizeMount(path);
  let best: CapacityVolume | null = null;
  for (const volume of volumes) {
    const mount = normalizeMount(volume.mount);
    if (!(target === mount || target.startsWith(`${mount}/`))) continue;
    if (best === null || mount.length > normalizeMount(best.mount).length) best = volume;
  }
  return best;
}

type TagsBody = { models?: ReadonlyArray<Record<string, unknown>> };

const modelId = (entry: Record<string, unknown>): string | null => {
  const id = typeof entry["model"] === "string" ? entry["model"] : entry["name"];
  return typeof id === "string" && id.length > 0 ? id : null;
};

export class LocalModelsEngine {
  private installed: ReadonlyArray<InstalledModel> = [];
  private loaded: ReadonlySet<string> = new Set();
  private running = false;
  private readonly pulls = new Map<string, PullEntry>();
  private lastPublish = 0;

  private readonly deps: LocalModelsEngineDeps;

  constructor(deps: LocalModelsEngineDeps) {
    this.deps = deps;
  }

  private async call(path: string, init?: RequestInit): Promise<Response> {
    const base = this.deps.baseUrl().replace(/\/+$/, "").replace(/\/v1$/, "");
    return this.deps.fetch(`${base}${path}`, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }

  /** Read the installed and loaded models. Sets `running` false when Ollama does not answer. */
  async refresh(): Promise<void> {
    try {
      const tags = await this.call("/api/tags");
      if (!tags.ok) throw new Error(`tags ${tags.status}`);
      const body = (await tags.json()) as TagsBody;
      this.installed = (body.models ?? []).flatMap((entry) => {
        const id = modelId(entry);
        if (id === null) return [];
        const details = entry["details"] as Record<string, unknown> | undefined;
        if (isEmbeddingModel(id, details?.["family"])) return [];
        const size = entry["size"];
        return [{ id, sizeBytes: typeof size === "number" && size > 0 ? size : null }];
      });
      const ps = await this.call("/api/ps");
      const psBody: TagsBody = ps.ok ? ((await ps.json()) as TagsBody) : {};
      this.loaded = new Set((psBody.models ?? []).flatMap((entry) => modelId(entry) ?? []));
      this.running = true;
    } catch {
      this.running = false;
      this.installed = [];
      this.loaded = new Set();
    }
    this.deps.onChange();
  }

  private modelDrive(): CapacityVolume | null {
    const hardware = this.deps.hardware();
    return hardware ? volumeForPath(this.deps.modelDir(), hardware.volumes) : null;
  }

  private pullView(entry: PullEntry | undefined): LocalModelPull | null {
    if (entry === undefined) return null;
    let total = 0;
    let completed = 0;
    for (const layer of entry.layers.values()) {
      total += layer.total;
      completed += Math.min(layer.completed, layer.total);
    }
    return {
      status: entry.status,
      completedBytes: Math.round(completed),
      totalBytes: Math.round(total),
      error: entry.error,
    };
  }

  snapshot(): LocalModelsState {
    const hardware = this.deps.hardware();
    const drive = this.modelDrive();
    const installedIds = new Set(this.installed.map((model) => model.id));
    const starters = new Map(STARTER_MODELS.map((model) => [model.id, model]));
    const gateFor = (sizeBytes: number | null, installed: boolean) => {
      if (installed || sizeBytes === null) {
        return { allowed: true, reason: null, needsConfirm: false };
      }
      const result = downloadGate({ sizeBytes, volume: drive, ollamaRunning: this.running });
      return result.allowed
        ? { allowed: true, reason: null, needsConfirm: result.needsConfirm }
        : { allowed: false, reason: result.reason, needsConfirm: false };
    };
    const row = (
      id: string,
      sizeBytes: number | null,
      installed: boolean,
      name: string,
    ): LocalModelRow => ({
      id,
      name,
      installed,
      loaded: this.loaded.has(id),
      sizeBytes: sizeBytes === null ? null : Math.round(sizeBytes),
      fit: hardware ? fitFor(sizeBytes, hardware.capacity) : "unknown",
      tokensPerSecond: null,
      benchLm: starters.get(id)?.benchLm ?? null,
      gate: gateFor(sizeBytes, installed),
      pull: this.pullView(this.pulls.get(id)),
    });
    const rows: LocalModelRow[] = [
      ...this.installed.map((model) =>
        row(model.id, model.sizeBytes, true, starters.get(model.id)?.name ?? model.id),
      ),
      ...STARTER_MODELS.filter((model) => !installedIds.has(model.id)).map((model) =>
        row(model.id, model.sizeBytes, false, model.name),
      ),
    ];
    return {
      ollama: { running: this.running, baseUrl: this.deps.baseUrl() },
      hardware: {
        gpuName: hardware?.capacity.gpu?.name ?? null,
        vramBytes: hardware?.capacity.gpu?.vramTotalBytes ?? 0,
        ramBytes: hardware?.capacity.ramTotalBytes ?? 0,
      },
      modelDrive: drive
        ? { mount: drive.mount, mediaType: drive.mediaType, freeBytes: Math.round(drive.freeBytes) }
        : null,
      rows,
      now: this.deps.now(),
    };
  }

  /** True while any download runs. The service polls faster then. */
  get pulling(): boolean {
    return [...this.pulls.values()].some((entry) => entry.running);
  }

  /**
   * Start a download. Throws at once when the model is not allowed. The returned promise
   * settles when the download ends; the caller need not wait for it.
   */
  pull(model: string, confirmed: boolean): Promise<void> {
    const starter = STARTER_MODELS.find((candidate) => candidate.id === model);
    if (starter === undefined) {
      throw new LocalModelsError({
        reason: "invalid_input",
        detail: "This model is not on the approved list.",
      });
    }
    if (this.pulls.get(model)?.running) {
      throw new LocalModelsError({
        reason: "invalid_input",
        detail: "This model is already downloading.",
      });
    }
    const gate = downloadGate({
      sizeBytes: starter.sizeBytes,
      volume: this.modelDrive(),
      ollamaRunning: this.running,
    });
    if (!gate.allowed) throw new LocalModelsError({ reason: "not_allowed", detail: gate.reason });
    if (gate.needsConfirm && !confirmed) {
      throw new LocalModelsError({
        reason: "not_allowed",
        detail: "Confirm this large download first.",
      });
    }
    const entry: PullEntry = {
      controller: new AbortController(),
      layers: new Map(),
      status: "starting",
      error: null,
      running: true,
    };
    this.pulls.set(model, entry);
    this.deps.onChange();
    return this.runPull(model, entry);
  }

  private async runPull(model: string, entry: PullEntry): Promise<void> {
    try {
      const response = await this.call("/api/pull", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, stream: true }),
        signal: entry.controller.signal,
      });
      if (!response.ok || response.body === null) {
        throw new Error(`Ollama answered ${response.status}.`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const handle = (line: string) => {
        const parsed = parsePullLine(line);
        if (parsed === null) return;
        if (parsed.error !== null) {
          entry.error = parsed.error;
          return;
        }
        entry.status = parsed.status;
        if (parsed.totalBytes !== null) {
          entry.layers.set(parsed.status, {
            total: parsed.totalBytes,
            completed: parsed.completedBytes ?? 0,
          });
        }
        const now = this.deps.now();
        if (now - this.lastPublish >= PROGRESS_PUBLISH_MS) {
          this.lastPublish = now;
          this.deps.onChange();
        }
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(handle);
      }
      handle(buffer);
    } catch (cause) {
      if (!entry.controller.signal.aborted) {
        entry.error = cause instanceof Error ? cause.message : String(cause);
      }
    }
    entry.running = false;
    if (entry.controller.signal.aborted || entry.error === null) this.pulls.delete(model);
    await this.refresh();
  }

  cancelPull(model: string): void {
    const entry = this.pulls.get(model);
    if (entry === undefined) return;
    if (entry.running) entry.controller.abort();
    else this.pulls.delete(model);
    this.deps.onChange();
  }

  private requireInstalled(model: string): void {
    if (!this.installed.some((candidate) => candidate.id === model)) {
      throw new LocalModelsError({ reason: "not_found", detail: "This model is not installed." });
    }
  }

  private async post(path: string, init: RequestInit): Promise<void> {
    try {
      const response = await this.call(path, init);
      if (!response.ok) throw new Error(`Ollama answered ${response.status}.`);
    } catch (cause) {
      throw new LocalModelsError({
        reason: "ollama_down",
        detail: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  /** Load the model into memory and keep it there, so the first chat turn is fast. */
  async run(model: string): Promise<void> {
    this.requireInstalled(model);
    await this.post("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, keep_alive: RUN_KEEP_ALIVE }),
      // Loading a big model from disk can take minutes.
      signal: AbortSignal.timeout(10 * 60_000),
    });
    await this.refresh();
  }

  async stop(model: string): Promise<void> {
    this.requireInstalled(model);
    await this.post("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, keep_alive: 0 }),
    });
    await this.refresh();
  }

  async remove(model: string): Promise<void> {
    this.requireInstalled(model);
    await this.post("/api/delete", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model }),
    });
    await this.refresh();
  }
}
