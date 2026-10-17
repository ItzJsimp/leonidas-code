import { describe, expect, it } from "vitest";

import { computeLocalModelCapacity, type CapacityInput } from "./localModelCapacity.ts";

const GB = 1024 ** 3;

const base: CapacityInput = {
  cpuThreads: 24,
  memory: { totalBytes: 64 * GB, usedBytes: 20 * GB },
  gpus: [
    {
      name: "NVIDIA GeForce RTX 4070",
      vendor: "NVIDIA",
      vramTotalBytes: 12 * GB,
      vramUsedBytes: 1 * GB,
    },
  ],
  volumes: [
    { mount: "C:", mediaType: "ssd", usedBytes: 900 * GB, totalBytes: 930 * GB },
    { mount: "D:", mediaType: "hdd", usedBytes: 400 * GB, totalBytes: 930 * GB },
  ],
};

describe("computeLocalModelCapacity", () => {
  it("picks the GPU with the most VRAM and reports free VRAM", () => {
    const capacity = computeLocalModelCapacity(base);
    expect(capacity.gpu?.name).toBe("NVIDIA GeForce RTX 4070");
    expect(capacity.gpu?.vramFreeBytes).toBe(11 * GB);
    expect(capacity.accelerator).toBe("cuda");
  });

  it("keeps 1.5 GB of headroom in the full-GPU budget", () => {
    const capacity = computeLocalModelCapacity(base);
    expect(capacity.fullGpuBudgetBytes).toBe(11 * GB - 1.5 * GB);
  });

  it("gives an offload budget of free VRAM plus 70 percent of free RAM", () => {
    const capacity = computeLocalModelCapacity(base);
    const free = 11 * GB - 1.5 * GB;
    expect(capacity.offloadBudgetBytes).toBe(free + 0.7 * 44 * GB);
  });

  it("reports VRAM held by other apps so the advisor can name it", () => {
    const busy = { ...base, gpus: [{ ...base.gpus[0]!, vramUsedBytes: 10.9 * GB }] };
    const capacity = computeLocalModelCapacity(busy);
    expect(capacity.gpu?.vramHeldBytes).toBe(10.9 * GB);
    expect(capacity.fullGpuBudgetBytes).toBe(0);
  });

  it("chooses the SSD with enough free space for the hot model volume", () => {
    const capacity = computeLocalModelCapacity(base);
    expect(capacity.hotVolume?.mount).toBe("C:");
    expect(capacity.hotVolume?.freeBytes).toBe(30 * GB);
    expect(capacity.coldVolume?.mount).toBe("D:");
  });

  it("has no hot volume when no SSD exists", () => {
    const capacity = computeLocalModelCapacity({
      ...base,
      volumes: [base.volumes[1]!],
    });
    expect(capacity.hotVolume).toBeNull();
    expect(capacity.coldVolume?.mount).toBe("D:");
  });

  it("falls back to cpu with no GPU", () => {
    const capacity = computeLocalModelCapacity({ ...base, gpus: [] });
    expect(capacity.gpu).toBeNull();
    expect(capacity.accelerator).toBe("cpu");
    expect(capacity.fullGpuBudgetBytes).toBe(0);
  });

  it("maps vendors to accelerators", () => {
    const amd = computeLocalModelCapacity({
      ...base,
      gpus: [{ ...base.gpus[0]!, name: "Radeon RX 7900", vendor: "AMD" }],
    });
    expect(amd.accelerator).toBe("vulkan");
  });

  it("recommends llama.cpp tuning only when the GPU can run it", () => {
    expect(computeLocalModelCapacity(base).runtimes).toEqual(["ollama", "llama.cpp"]);
    expect(computeLocalModelCapacity({ ...base, gpus: [] }).runtimes).toEqual(["ollama"]);
  });
});
