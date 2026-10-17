import { describe, expect, it } from "vite-plus/test";

import { computeLocalModelCapacity, type CapacityInput } from "./localModelCapacity.ts";
import { downloadGate, fitFor, parsePullLine } from "./localModelFit.ts";

const GB = 1024 ** 3;

const input: CapacityInput = {
  cpuThreads: 24,
  memory: { totalBytes: 64 * GB, usedBytes: 20 * GB },
  gpus: [{ name: "NVIDIA RTX 4070", vendor: "NVIDIA", vramTotalBytes: 12 * GB, vramUsedBytes: 0 }],
  volumes: [
    { mount: "C:", mediaType: "ssd", usedBytes: 860 * GB, totalBytes: 930 * GB },
    { mount: "D:", mediaType: "hdd", usedBytes: 400 * GB, totalBytes: 930 * GB },
  ],
};
const capacity = computeLocalModelCapacity(input);

describe("fitFor", () => {
  it("is fits when the file fits in free VRAM after headroom", () => {
    expect(fitFor(8 * GB, capacity)).toBe("fits");
  });
  it("is tight when layers must spill to RAM", () => {
    expect(fitFor(18 * GB, capacity)).toBe("tight");
  });
  it("is too_big beyond the GPU plus RAM budget", () => {
    expect(fitFor(70 * GB, capacity)).toBe("too_big");
  });
  it("is unknown when the size is unknown", () => {
    expect(fitFor(null, capacity)).toBe("unknown");
  });
});

describe("downloadGate", () => {
  const ssd = { mount: "C:", mediaType: "ssd" as const, freeBytes: 70 * GB };
  it("allows a model that fits the free space on an SSD", () => {
    expect(downloadGate({ sizeBytes: 8 * GB, volume: ssd, ollamaRunning: true })).toEqual({
      allowed: true,
      needsConfirm: false,
    });
  });
  it("asks for a confirm above 10 GB", () => {
    expect(downloadGate({ sizeBytes: 18 * GB, volume: ssd, ollamaRunning: true })).toEqual({
      allowed: true,
      needsConfirm: true,
    });
  });
  it("blocks an HDD with a reason", () => {
    const hdd = { mount: "D:", mediaType: "hdd" as const, freeBytes: 500 * GB };
    const gate = downloadGate({ sizeBytes: 5 * GB, volume: hdd, ollamaRunning: true });
    expect(gate.allowed).toBe(false);
    expect(gate).toMatchObject({ reason: expect.stringContaining("hard disk") });
  });
  it("blocks when free space is under size plus 10 percent", () => {
    const tiny = { mount: "C:", mediaType: "ssd" as const, freeBytes: 8.5 * GB };
    const gate = downloadGate({ sizeBytes: 8 * GB, volume: tiny, ollamaRunning: true });
    expect(gate.allowed).toBe(false);
    expect(gate).toMatchObject({ reason: expect.stringContaining("space") });
  });
  it("blocks when Ollama is not running", () => {
    const gate = downloadGate({ sizeBytes: 1 * GB, volume: ssd, ollamaRunning: false });
    expect(gate.allowed).toBe(false);
    expect(gate).toMatchObject({ reason: expect.stringContaining("Ollama") });
  });
});

describe("parsePullLine", () => {
  it("reads a progress line", () => {
    expect(
      parsePullLine('{"status":"pulling abc","digest":"sha256:abc","total":100,"completed":25}'),
    ).toEqual({ status: "pulling abc", completedBytes: 25, totalBytes: 100, error: null });
  });
  it("reads an error line", () => {
    expect(parsePullLine('{"error":"pull model manifest: file does not exist"}')).toMatchObject({
      error: "pull model manifest: file does not exist",
    });
  });
  it("returns null for a bad line", () => {
    expect(parsePullLine("not json")).toBeNull();
    expect(parsePullLine("")).toBeNull();
  });
});
