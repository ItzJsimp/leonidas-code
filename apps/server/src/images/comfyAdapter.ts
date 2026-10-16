// @effect-diagnostics globalFetch:off globalTimers:off globalTimersInEffect:off globalRandom:off globalDate:off globalDateInEffect:off - Plain async adapter for a local HTTP server, outside the orchestration runtime.
/**
 * The ComfyUI adapter for the Image Source interface.
 *
 * Flow for one image: `POST /prompt`, poll `GET /history/<id>`, read the picture with `GET /view`.
 * The user runs ComfyUI. The app only connects to it.
 */
import type { ImageModel } from "@t3tools/contracts";

import {
  COMFY_WORKFLOWS,
  COMFY_WORKFLOW_SETTINGS,
  IMAGE_SIZE,
  isComfyModelId,
  type ComfyWorkflow,
} from "./comfyWorkflows.ts";
import { COMFY_MODELS } from "./imageModels.ts";
import {
  ImageCancelledError,
  type GenerateHooks,
  type GenerateRequest,
  type GeneratedImage,
  type ImageSource,
  type SourceStatus,
} from "./imageSource.ts";

export const DEFAULT_COMFY_URL = "http://127.0.0.1:8188";

/** Accepts a web address from the settings field. Returns null when it cannot work. */
export function normalizeBaseUrl(input: string): string | null {
  const text = input.trim();
  if (text.length === 0) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username !== "" || url.password !== "") return null;
    return `${url.origin}${url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

export interface ComfyAdapterOptions {
  /** Read on every call, so a change in settings applies at once. */
  readonly baseUrl: () => string;
  readonly fetch?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
  /** Wait between history polls. */
  readonly pollMs?: number;
  /** Stops waiting for an image after this long. */
  readonly maxWaitMs?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const shorten = (text: string, max = 300) =>
  text.length > max ? `${text.slice(0, max)}...` : text;

type HistoryImage = { filename: string; subfolder?: string; type?: string };
type HistoryEntry = {
  status?: { status_str?: string; messages?: ReadonlyArray<readonly [string, unknown]> };
  outputs?: Record<string, { images?: ReadonlyArray<HistoryImage> }>;
};

/** Reads a ComfyUI error body into one plain sentence. */
export function describeComfyError(status: number, body: string): string {
  try {
    const json = JSON.parse(body) as {
      error?: { message?: string; details?: string } | string;
      node_errors?: Record<
        string,
        { errors?: ReadonlyArray<{ message?: string; details?: string }> }
      >;
    };
    const parts: string[] = [];
    if (typeof json.error === "string") parts.push(json.error);
    else if (json.error?.message) parts.push(json.error.message);
    const firstNode = Object.values(json.node_errors ?? {})[0]?.errors?.[0];
    if (firstNode) parts.push([firstNode.message, firstNode.details].filter(Boolean).join(": "));
    if (parts.length > 0) return shorten(`ComfyUI said: ${parts.join(". ")}`);
  } catch {
    // Not JSON. Fall through to the raw text.
  }
  return shorten(`ComfyUI answered ${String(status)}${body ? `: ${body}` : ""}`);
}

/** Reads the failure reason out of a ComfyUI history entry. */
export function describeHistoryFailure(entry: HistoryEntry): { cancelled: boolean; text: string } {
  const messages = entry.status?.messages ?? [];
  for (const [kind, data] of messages) {
    if (kind === "execution_interrupted") return { cancelled: true, text: "Stopped." };
    if (kind === "execution_error") {
      const detail = data as { exception_message?: string; node_type?: string };
      const where = detail.node_type ? ` (${detail.node_type})` : "";
      return {
        cancelled: false,
        text: shorten(`ComfyUI failed${where}: ${detail.exception_message ?? "unknown error"}`),
      };
    }
  }
  return { cancelled: false, text: "ComfyUI could not make this image." };
}

export function createComfyAdapter(options: ComfyAdapterOptions): ImageSource {
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const pollMs = options.pollMs ?? 1_000;
  const maxWaitMs = options.maxWaitMs ?? 30 * 60_000;
  const clientId = `leonidas-code-${Math.random().toString(36).slice(2, 10)}`;
  let currentPromptId: string | null = null;

  const base = () => options.baseUrl().replace(/\/+$/, "");
  const offline = () =>
    new Error(`Cannot reach ComfyUI at ${base()}. Start ComfyUI, then try again.`);

  const post = async (path: string, body: unknown, timeoutMs = 30_000): Promise<Response> => {
    try {
      return await doFetch(`${base()}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw offline();
    }
  };

  const get = async (path: string, timeoutMs = 30_000): Promise<Response> => {
    try {
      return await doFetch(`${base()}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      throw offline();
    }
  };

  const status = async (): Promise<SourceStatus> => {
    try {
      const response = await doFetch(`${base()}/system_stats`, {
        signal: AbortSignal.timeout(2_500),
      });
      if (!response.ok) {
        return { online: false, message: `ComfyUI answered ${String(response.status)}.` };
      }
      return { online: true, message: null };
    } catch {
      return { online: false, message: `Cannot reach ComfyUI at ${base()}.` };
    }
  };

  const listModels = async (): Promise<ReadonlyArray<ImageModel>> => COMFY_MODELS;

  const generate = async (
    request: GenerateRequest,
    hooks: GenerateHooks = {},
  ): Promise<GeneratedImage> => {
    if (!isComfyModelId(request.modelId)) {
      throw new Error(`Unknown model: ${request.modelId}.`);
    }
    const workflow: ComfyWorkflow = COMFY_WORKFLOWS[request.modelId]({
      prompt: request.prompt,
      seed: request.seed,
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
    });
    const queued = await post("/prompt", { prompt: workflow, client_id: clientId });
    if (!queued.ok) throw new Error(describeComfyError(queued.status, await queued.text()));
    const { prompt_id: promptId } = (await queued.json()) as { prompt_id: string };
    currentPromptId = promptId;
    try {
      const deadline = Date.now() + maxWaitMs;
      for (;;) {
        if (hooks.signal?.aborted) throw new ImageCancelledError();
        const response = await get(`/history/${encodeURIComponent(promptId)}`);
        if (response.ok) {
          const history = (await response.json()) as Record<string, HistoryEntry>;
          const entry = history[promptId];
          if (entry) {
            if (entry.status?.status_str !== "success") {
              const failure = describeHistoryFailure(entry);
              if (failure.cancelled) throw new ImageCancelledError();
              throw new Error(failure.text);
            }
            const picture = Object.values(entry.outputs ?? {})
              .flatMap((output) => output.images ?? [])
              .at(0);
            if (!picture) throw new Error("ComfyUI finished but sent no image.");
            const view = await get(
              `/view?${new URLSearchParams({
                filename: picture.filename,
                subfolder: picture.subfolder ?? "",
                type: picture.type ?? "output",
              }).toString()}`,
            );
            if (!view.ok) throw new Error(describeComfyError(view.status, await view.text()));
            return {
              bytes: new Uint8Array(await view.arrayBuffer()),
              mimeType: "image/png",
              settings: COMFY_WORKFLOW_SETTINGS[request.modelId],
            };
          }
        }
        if (Date.now() > deadline) throw new Error("ComfyUI took too long to make this image.");
        await sleep(pollMs);
      }
    } finally {
      currentPromptId = null;
    }
  };

  const interrupt = async (): Promise<void> => {
    const promptId = currentPromptId;
    if (promptId === null) return;
    // ComfyUI may run another tool's image. Interrupt only when ours runs. Else remove ours from the queue.
    const running = await get("/queue", 5_000)
      .then((response) => response.json() as Promise<{ queue_running?: ReadonlyArray<unknown[]> }>)
      .then((queue) => (queue.queue_running ?? []).some((entry) => entry[1] === promptId))
      .catch(() => true);
    if (running) {
      await post("/interrupt", { prompt_id: promptId }, 5_000).catch(() => undefined);
    } else {
      await post("/queue", { delete: [promptId] }, 5_000).catch(() => undefined);
    }
  };

  /** The reply body of `/free` is empty, so it is never read as JSON. A 12 GB card stalls without this call. */
  const freeMemory = async (): Promise<void> => {
    await post("/free", { unload_models: true, free_memory: true }, 10_000).catch(() => undefined);
  };

  return {
    id: "comfyui",
    label: "ComfyUI",
    address: base,
    listModels,
    generate,
    status,
    interrupt,
    freeMemory,
  };
}
