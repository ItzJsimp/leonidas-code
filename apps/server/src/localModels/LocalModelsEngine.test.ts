import { describe, expect, it } from "vite-plus/test";

import { LocalModelsError } from "@t3tools/contracts";

import { computeLocalModelCapacity } from "../hardwareWatch/localModelCapacity.ts";
import { LocalModelsEngine } from "./LocalModelsEngine.ts";

const GB = 1024 ** 3;

// The 8 GB of video memory in use belongs to the loaded Gemma model in the fake /api/ps.
const capacity = computeLocalModelCapacity({
  cpuThreads: 24,
  memory: { totalBytes: 64 * GB, usedBytes: 29 * GB },
  gpus: [
    { name: "NVIDIA RTX 4070", vendor: "NVIDIA", vramTotalBytes: 12 * GB, vramUsedBytes: 8 * GB },
  ],
  volumes: [
    { mount: "C:", mediaType: "ssd", usedBytes: 860 * GB, totalBytes: 930 * GB },
    { mount: "D:", mediaType: "hdd", usedBytes: 400 * GB, totalBytes: 930 * GB },
  ],
});
const volumes = [
  { mount: "C:", mediaType: "ssd" as const, freeBytes: 70 * GB },
  { mount: "D:", mediaType: "hdd" as const, freeBytes: 530 * GB },
];

interface Call {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
}

function makeEngine(
  options: {
    modelDir?: string;
    down?: boolean;
    pullLines?: string[];
    capacity?: typeof capacity;
    psSizes?: { size: number; size_vram: number };
  } = {},
) {
  const calls: Call[] = [];
  const installed = [
    { name: "gemma4:12b-it-q4_K_M", size: 8 * GB },
    { name: "nomic-embed-text:latest", size: 0.3 * GB },
  ];
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init?.method ?? "GET", body });
    if (options.down) throw new Error("connect ECONNREFUSED");
    if (url.endsWith("/api/tags")) return Response.json({ models: installed });
    if (url.endsWith("/api/ps"))
      return Response.json({
        models: [
          {
            name: "gemma4:12b-it-q4_K_M",
            ...(options.psSizes ?? { size: 9 * GB, size_vram: 8 * GB }),
          },
        ],
      });
    if (url.endsWith("/api/pull")) {
      const lines = options.pullLines ?? [];
      return new Response(lines.join("\n") + "\n", { status: 200 });
    }
    return Response.json({});
  }) as typeof fetch;
  const engine = new LocalModelsEngine({
    baseUrl: () => "http://127.0.0.1:11434",
    fetch: fakeFetch,
    hardware: () => ({ capacity: options.capacity ?? capacity, volumes }),
    modelDir: () => options.modelDir ?? "C:\\ollama\\models",
    onChange: () => {},
    now: () => 1000,
  });
  return { engine, calls };
}

describe("LocalModelsEngine.snapshot", () => {
  it("lists installed models first, hides embedding models, adds starter models", async () => {
    const { engine } = makeEngine();
    await engine.refresh();
    const state = engine.snapshot();
    const ids = state.rows.map((row) => row.id);
    expect(ids[0]).toBe("gemma4:12b-it-q4_K_M");
    expect(ids).not.toContain("nomic-embed-text:latest");
    expect(ids).toContain("qwen3.8:27b-q4_K_M");
    expect(state.ollama.running).toBe(true);
    const gemma = state.rows[0]!;
    expect(gemma).toMatchObject({ installed: true, loaded: true, fit: "fits" });
  });

  it("labels an 18 GB starter model tight and asks to confirm the pull", async () => {
    const { engine } = makeEngine();
    await engine.refresh();
    const row = engine.snapshot().rows.find((r) => r.id === "gemma4:26b-a4b-it-q4_K_M")!;
    expect(row.installed).toBe(false);
    expect(row.fit).toBe("tight");
    expect(row.gate).toEqual({ allowed: true, reason: null, needsConfirm: true });
  });

  it("reads the model drive from the model folder", async () => {
    const { engine } = makeEngine();
    await engine.refresh();
    expect(engine.snapshot().modelDrive).toMatchObject({ mount: "C:", mediaType: "ssd" });
  });

  it("blocks every download when the model folder is on an HDD", async () => {
    const { engine } = makeEngine({ modelDir: "D:\\models" });
    await engine.refresh();
    const row = engine.snapshot().rows.find((r) => r.id === "granite4.2:8b-q4_K_M")!;
    expect(row.gate.allowed).toBe(false);
    expect(row.gate.reason).toContain("hard disk");
  });

  it("reports Ollama down and blocks downloads", async () => {
    const { engine } = makeEngine({ down: true });
    await engine.refresh();
    const state = engine.snapshot();
    expect(state.ollama.running).toBe(false);
    expect(state.rows.every((row) => row.installed === false)).toBe(true);
    expect(state.rows[0]!.gate.allowed).toBe(false);
  });
});

describe("LocalModelsEngine fit with a loaded model", () => {
  it("does not count memory held by a loaded Ollama model against the models", async () => {
    // The 8 GB of video memory used on this PC belongs to the loaded Gemma model.
    const busy = computeLocalModelCapacity({
      cpuThreads: 24,
      memory: { totalBytes: 64 * GB, usedBytes: 29 * GB },
      gpus: [
        {
          name: "NVIDIA RTX 4070",
          vendor: "NVIDIA",
          vramTotalBytes: 12 * GB,
          vramUsedBytes: 8 * GB,
        },
      ],
      volumes: [{ mount: "C:", mediaType: "ssd", usedBytes: 860 * GB, totalBytes: 930 * GB }],
    });
    const { engine } = makeEngine({ capacity: busy });
    await engine.refresh();
    const gemma = engine.snapshot().rows.find((r) => r.id === "gemma4:12b-it-q4_K_M")!;
    expect(gemma.loaded).toBe(true);
    expect(gemma.fit).toBe("fits");
  });
});

describe("LocalModelsEngine fit when /api/ps reports a wrong size", () => {
  it("uses the installed file size for a loaded model", async () => {
    const busy = computeLocalModelCapacity({
      cpuThreads: 24,
      memory: { totalBytes: 64 * GB, usedBytes: 29 * GB },
      gpus: [
        {
          name: "NVIDIA RTX 4070",
          vendor: "NVIDIA",
          vramTotalBytes: 12 * GB,
          vramUsedBytes: 10.5 * GB,
        },
      ],
      volumes: [{ mount: "C:", mediaType: "ssd", usedBytes: 860 * GB, totalBytes: 930 * GB }],
    });
    // Ollama 0.40.5 reports 0.9 GB for a model that holds more than 7 GB.
    const { engine } = makeEngine({
      capacity: busy,
      psSizes: { size: 0.9 * GB, size_vram: 0.9 * GB },
    });
    await engine.refresh();
    const gemma = engine.snapshot().rows.find((r) => r.id === "gemma4:12b-it-q4_K_M")!;
    expect(gemma.fit).toBe("fits");
  });
});

describe("LocalModelsEngine actions", () => {
  it("refuses a pull over 10 GB without a confirm", async () => {
    const { engine } = makeEngine();
    await engine.refresh();
    expect(() => engine.pull("gemma4:26b-a4b-it-q4_K_M", false)).toThrow(LocalModelsError);
  });

  it("refuses a pull of a model that is not on the list", async () => {
    const { engine } = makeEngine();
    await engine.refresh();
    expect(() => engine.pull("evil/unknown:latest", true)).toThrow(LocalModelsError);
  });

  it("streams a pull, sums layer progress, then refreshes the list", async () => {
    const { engine, calls } = makeEngine({
      pullLines: [
        '{"status":"pulling manifest"}',
        '{"status":"pulling aaa","total":100,"completed":40}',
        '{"status":"pulling bbb","total":100,"completed":10}',
        '{"status":"success"}',
      ],
    });
    await engine.refresh();
    await engine.pull("granite4.2:8b-q4_K_M", false);
    const pull = calls.find((call) => call.url.endsWith("/api/pull"))!;
    expect(pull.body).toMatchObject({ model: "granite4.2:8b-q4_K_M", stream: true });
    expect(engine.snapshot().rows.find((r) => r.id === "granite4.2:8b-q4_K_M")!.pull).toBeNull();
    expect(calls.filter((call) => call.url.endsWith("/api/tags")).length).toBeGreaterThan(1);
  });

  it("keeps the error on the row when Ollama reports a pull error", async () => {
    const { engine } = makeEngine({ pullLines: ['{"error":"file does not exist"}'] });
    await engine.refresh();
    await engine.pull("granite4.2:8b-q4_K_M", false);
    const row = engine.snapshot().rows.find((r) => r.id === "granite4.2:8b-q4_K_M")!;
    expect(row.pull?.error).toBe("file does not exist");
  });

  it("run preloads with keep-alive, stop unloads, delete calls the delete endpoint", async () => {
    const { engine, calls } = makeEngine();
    await engine.refresh();
    await engine.run("gemma4:12b-it-q4_K_M");
    await engine.stop("gemma4:12b-it-q4_K_M");
    await engine.remove("gemma4:12b-it-q4_K_M");
    const generate = calls.filter((c) => c.url.endsWith("/api/generate"));
    expect(generate[0]!.body).toMatchObject({ model: "gemma4:12b-it-q4_K_M", keep_alive: "30m" });
    expect(generate[1]!.body).toMatchObject({ keep_alive: 0 });
    const del = calls.find((c) => c.url.endsWith("/api/delete"))!;
    expect(del.method).toBe("DELETE");
    expect(del.body).toEqual({ model: "gemma4:12b-it-q4_K_M" });
  });

  it("will not run or delete a model that is not installed", async () => {
    const { engine } = makeEngine();
    await engine.refresh();
    await expect(engine.run("qwen3.8:27b-q4_K_M")).rejects.toThrow(LocalModelsError);
    await expect(engine.remove("qwen3.8:27b-q4_K_M")).rejects.toThrow(LocalModelsError);
  });
});
