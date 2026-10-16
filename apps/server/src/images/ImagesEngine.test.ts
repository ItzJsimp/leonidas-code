// @effect-diagnostics nodeBuiltinImport:off globalTimers:off globalDate:off - Test drives plain async code against a temp folder.
import * as NodeFS from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { COMFY_MODELS } from "./imageModels.ts";
import { ImagesEngine } from "./ImagesEngine.ts";
import {
  ImageCancelledError,
  type GenerateHooks,
  type GenerateRequest,
  type ImageSource,
} from "./imageSource.ts";

let root: string;
beforeEach(async () => {
  root = await NodeFS.mkdtemp(NodePath.join(NodeOS.tmpdir(), "images-engine-"));
});
afterEach(async () => {
  await NodeFS.rm(root, { recursive: true, force: true });
});

/** A source that records its calls. `gates` hold an image until the test opens the gate. */
function fakeSource(options: { failModel?: string; hold?: boolean } = {}) {
  const log: string[] = [];
  const gates: Array<() => void> = [];
  let tick = 0;
  const source: ImageSource = {
    id: "comfyui",
    label: "Fake",
    address: () => "http://fake.test",
    listModels: async () => COMFY_MODELS,
    status: async () => ({ online: true, message: null }),
    freeMemory: async () => {
      log.push("free");
    },
    interrupt: async () => {
      log.push("interrupt");
      gates.shift()?.();
    },
    generate: async (request: GenerateRequest, hooks?: GenerateHooks) => {
      log.push(`generate ${request.modelId} ${String(request.seed)}`);
      if (options.failModel === request.modelId) throw new Error("model is missing");
      if (options.hold) {
        await new Promise<void>((resolve) => gates.push(resolve));
        if (hooks?.signal?.aborted) throw new ImageCancelledError();
      }
      tick += 1;
      return {
        bytes: new Uint8Array([tick]),
        mimeType: "image/png",
        settings: { steps: 4 },
      };
    },
  };
  return { source, log, gates };
}

/** Waits until the engine has no waiting or running image. */
async function settle(engine: ImagesEngine) {
  for (let i = 0; i < 200; i += 1) {
    const items = engine.snapshot(root).items;
    if (items.length > 0 && items.every((i) => i.status !== "waiting" && i.status !== "running"))
      return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("queue did not settle");
}

describe("ImagesEngine", () => {
  it("runs 2 variations, frees memory once, and saves 2 PNGs with 2 Recipes", async () => {
    const fake = fakeSource();
    const engine = new ImagesEngine({ source: fake.source });
    const queued = engine.enqueue({
      workspaceRoot: root,
      prompt: "ghost slime",
      modelIds: ["flux2klein"],
      seed: 100,
      count: 2,
    });
    expect(queued.queued).toBe(2);
    await settle(engine);

    expect(fake.log).toEqual(["free", "generate flux2klein 100", "generate flux2klein 101"]);
    const files = (await NodeFS.readdir(NodePath.join(root, "images"))).toSorted();
    expect(files.filter((f) => f.endsWith(".png"))).toHaveLength(2);
    expect(files.filter((f) => f.endsWith(".json"))).toHaveLength(2);

    const items = engine.snapshot(root).items;
    expect(items.map((i) => i.status)).toEqual(["done", "done"]);
    const first = items.find((i) => i.seed === 100)!;
    const recipe = JSON.parse(
      await NodeFS.readFile(NodePath.join(root, first.file!.replace(/\.png$/, ".json")), "utf8"),
    );
    expect(recipe).toMatchObject({
      version: 1,
      prompt: "ghost slime",
      seed: 100,
      modelId: "flux2klein",
      settings: { steps: 4 },
    });
    expect(typeof recipe.seconds).toBe("number");
    expect(typeof recipe.createdAt).toBe("string");
  });

  it("groups a mixed press by model and frees memory on each model change", async () => {
    const fake = fakeSource();
    const engine = new ImagesEngine({ source: fake.source });
    engine.enqueue({
      workspaceRoot: root,
      prompt: "p",
      modelIds: ["flux2klein", "qwen"],
      seed: 1,
      count: 2,
    });
    await settle(engine);
    expect(fake.log).toEqual([
      "free",
      "generate flux2klein 1",
      "generate flux2klein 2",
      "free",
      "generate qwen 1",
      "generate qwen 2",
    ]);
  });

  it("frees again when a later press uses another model, not when it repeats the last one", async () => {
    const fake = fakeSource();
    const engine = new ImagesEngine({ source: fake.source });
    const press = (modelId: string) =>
      engine.enqueue({ workspaceRoot: root, prompt: "p", modelIds: [modelId], seed: 1, count: 1 });
    press("flux2klein");
    await settle(engine);
    press("flux2klein");
    await new Promise((resolve) => setTimeout(resolve, 30));
    press("qwen");
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(fake.log.filter((line) => line === "free")).toHaveLength(2);
  });

  it("picks a random seed when none is given and counts up from it", async () => {
    const fake = fakeSource();
    const engine = new ImagesEngine({ source: fake.source, random: () => 0.5 });
    engine.enqueue({
      workspaceRoot: root,
      prompt: "p",
      modelIds: ["flux2klein"],
      seed: null,
      count: 2,
    });
    await settle(engine);
    const seeds = engine
      .snapshot(root)
      .items.map((i) => i.seed)
      .toSorted((a, b) => a - b);
    expect(seeds[1]! - seeds[0]!).toBe(1);
    expect(seeds[0]).toBe(Math.floor(0.5 * (2 ** 32 - 1)));
  });

  it("shows an error for a failed image and still runs the next one", async () => {
    const fake = fakeSource({ failModel: "qwen" });
    const engine = new ImagesEngine({ source: fake.source });
    engine.enqueue({
      workspaceRoot: root,
      prompt: "p",
      modelIds: ["qwen", "flux2klein"],
      seed: 1,
      count: 1,
    });
    await settle(engine);
    const byModel = Object.fromEntries(engine.snapshot(root).items.map((i) => [i.modelId, i]));
    expect(byModel.qwen).toMatchObject({ status: "error", error: "model is missing", file: null });
    expect(byModel.flux2klein?.status).toBe("done");
  });

  it("cancels waiting images but lets the running one finish", async () => {
    const fake = fakeSource({ hold: true });
    const engine = new ImagesEngine({ source: fake.source });
    engine.enqueue({
      workspaceRoot: root,
      prompt: "p",
      modelIds: ["flux2klein"],
      seed: 1,
      count: 3,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await engine.cancel({ stopRunning: false })).toBe(2);
    // Waiting images that never ran leave the list.
    expect(engine.snapshot(root).items.map((i) => i.status)).toEqual(["running"]);
    fake.gates.shift()?.();
    await settle(engine);
    expect(engine.snapshot(root).items.map((i) => i.status)).toEqual(["done"]);
  });

  it("stops the running image when asked and marks it stopped", async () => {
    const fake = fakeSource({ hold: true });
    const engine = new ImagesEngine({ source: fake.source });
    engine.enqueue({
      workspaceRoot: root,
      prompt: "p",
      modelIds: ["flux2klein"],
      seed: 1,
      count: 2,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await engine.cancel({ stopRunning: true });
    await settle(engine);
    expect(fake.log).toContain("interrupt");
    expect(engine.snapshot(root).items).toMatchObject([{ status: "cancelled", error: "Stopped." }]);
  });

  it("keeps and un-keeps a finished image", async () => {
    const fake = fakeSource();
    const engine = new ImagesEngine({ source: fake.source });
    engine.enqueue({
      workspaceRoot: root,
      prompt: "p",
      modelIds: ["flux2klein"],
      seed: 1,
      count: 1,
    });
    await settle(engine);
    const item = engine.snapshot(root).items[0]!;
    expect(await engine.keep({ workspaceRoot: root, itemId: item.id, kept: true })).toBe(true);
    const keptFiles = await NodeFS.readdir(NodePath.join(root, "images", "kept"));
    expect(keptFiles.toSorted()).toHaveLength(2);
    expect(engine.snapshot(root).items[0]?.kept).toBe(true);
    expect(await engine.keep({ workspaceRoot: root, itemId: item.id, kept: false })).toBe(false);
    expect(await NodeFS.readdir(NodePath.join(root, "images", "kept"))).toEqual([]);
    expect(await engine.keep({ workspaceRoot: root, itemId: "nope", kept: true })).toBeNull();
  });

  it("loads earlier images from their sidecars when a project opens", async () => {
    const fake = fakeSource();
    const first = new ImagesEngine({ source: fake.source });
    first.enqueue({
      workspaceRoot: root,
      prompt: "old prompt",
      modelIds: ["flux2klein"],
      seed: 9,
      count: 1,
    });
    await settle(first);
    await first.keep({
      workspaceRoot: root,
      itemId: first.snapshot(root).items[0]!.id,
      kept: true,
    });

    const second = new ImagesEngine({ source: fake.source });
    await second.hydrate(root);
    expect(second.snapshot(root).items).toMatchObject([
      { prompt: "old prompt", seed: 9, status: "done", kept: true },
    ]);
  });

  it("keeps projects apart", async () => {
    const fake = fakeSource();
    const engine = new ImagesEngine({ source: fake.source });
    const other = await NodeFS.mkdtemp(NodePath.join(NodeOS.tmpdir(), "images-other-"));
    try {
      engine.enqueue({
        workspaceRoot: root,
        prompt: "p",
        modelIds: ["flux2klein"],
        seed: 1,
        count: 1,
      });
      await settle(engine);
      expect(engine.snapshot(other).items).toEqual([]);
    } finally {
      await NodeFS.rm(other, { recursive: true, force: true });
    }
  });

  it("reports the source status and tells the panel when it changes", async () => {
    let online = false;
    const fake = fakeSource();
    let changes = 0;
    const engine = new ImagesEngine({
      source: { ...fake.source, status: async () => ({ online, message: online ? null : "down" }) },
      onChange: () => {
        changes += 1;
      },
    });
    await engine.refreshStatus();
    expect(engine.snapshot(root).source).toMatchObject({ online: false, message: "down" });
    const afterFirst = changes;
    await engine.refreshStatus();
    expect(changes).toBe(afterFirst);
    online = true;
    await engine.refreshStatus();
    expect(engine.snapshot(root).source.online).toBe(true);
    expect(changes).toBe(afterFirst + 1);
  });

  it("shows busy, not gone, when a status check times out while our own image runs", async () => {
    const fake = fakeSource({ hold: true });
    let timedOut = true;
    const engine = new ImagesEngine({
      source: {
        ...fake.source,
        status: async () => ({
          online: false,
          timedOut,
          message: "ComfyUI did not answer in time.",
        }),
      },
    });
    // Nothing runs yet, so a timeout is a real problem.
    await engine.refreshStatus();
    expect(engine.snapshot(root).source).toMatchObject({ online: false, busy: false });
    engine.enqueue({
      workspaceRoot: root,
      prompt: "p",
      modelIds: ["flux2klein"],
      seed: 1,
      count: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await engine.refreshStatus();
    expect(engine.snapshot(root).source).toMatchObject({ online: false, busy: true });
    // A refused connection is never busy.
    timedOut = false;
    await engine.refreshStatus();
    expect(engine.snapshot(root).source.busy).toBe(false);
    fake.gates.shift()?.();
    await settle(engine);
  });

  it("runs the next image after a failure, and runs a failed one again with the same recipe", async () => {
    let failFirst = true;
    const fake = fakeSource();
    const generate = fake.source.generate;
    const engine = new ImagesEngine({
      source: {
        ...fake.source,
        generate: async (request, hooks) => {
          if (failFirst) {
            failFirst = false;
            throw new Error(
              "Cannot reach ComfyUI at http://fake.test. Start ComfyUI, then try again.",
            );
          }
          return generate(request, hooks);
        },
      },
    });
    engine.enqueue({
      workspaceRoot: root,
      prompt: "ghost",
      modelIds: ["flux2klein"],
      seed: 77,
      count: 2,
    });
    await settle(engine);
    const failed = engine.snapshot(root).items.find((item) => item.status === "error")!;
    expect(failed.seed).toBe(77);
    // The next image still ran after the failure.
    expect(engine.snapshot(root).items.filter((item) => item.status === "done")).toHaveLength(1);

    expect(engine.retry({ workspaceRoot: root, itemId: "nope" })).toBeNull();
    expect(engine.retry({ workspaceRoot: root, itemId: failed.id })).toBe(1);
    await settle(engine);
    const items = engine.snapshot(root).items;
    expect(items.map((item) => item.status)).toEqual(["done", "done"]);
    expect(items.map((item) => item.seed).toSorted()).toEqual([77, 78]);
    expect(items.every((item) => item.prompt === "ghost" && item.modelId === "flux2klein")).toBe(
      true,
    );
    // A finished image cannot be retried.
    expect(engine.retry({ workspaceRoot: root, itemId: items[0]!.id })).toBeNull();
  });
});
