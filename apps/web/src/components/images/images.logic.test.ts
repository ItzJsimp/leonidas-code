import type { ImageItem, ImageModel } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  canRetry,
  clampVariations,
  commercialBadge,
  describeQueue,
  estimateRunSeconds,
  formatElapsed,
  formatSeconds,
  parseSeedInput,
  promptHistory,
  resolveSelectedModels,
  sourcePhase,
  toggleModel,
} from "./images.logic";

const item = (patch: Partial<ImageItem>): ImageItem => ({
  id: "a",
  jobId: "j",
  prompt: "p",
  modelId: "m",
  modelLabel: "M",
  seed: 1,
  status: "done",
  createdAt: 1,
  startedAt: null,
  seconds: null,
  file: null,
  kept: false,
  error: null,
  ...patch,
});

const model = (id: string, typicalSeconds: number): ImageModel => ({
  id,
  sourceId: "comfyui",
  label: id,
  sizeLabel: "1 GB",
  typicalSeconds,
  licence: "",
  commercialUse: "check",
});

describe("parseSeedInput", () => {
  it("treats empty text as a random seed", () => {
    expect(parseSeedInput("")).toBeNull();
    expect(parseSeedInput("   ")).toBeNull();
  });

  it("reads whole numbers and rejects other text", () => {
    expect(parseSeedInput(" 42 ")).toBe(42);
    expect(parseSeedInput("-1")).toBe("invalid");
    expect(parseSeedInput("1.5")).toBe("invalid");
    expect(parseSeedInput("abc")).toBe("invalid");
    expect(parseSeedInput("99999999999")).toBe("invalid");
  });
});

describe("clampVariations", () => {
  it("keeps the count from 1 to 12", () => {
    expect(clampVariations(0)).toBe(1);
    expect(clampVariations(5.9)).toBe(5);
    expect(clampVariations(40)).toBe(12);
    expect(clampVariations(Number.NaN)).toBe(1);
  });
});

describe("formatElapsed", () => {
  it("counts seconds, then minutes", () => {
    expect(formatElapsed(0, 12_400)).toBe("12 s");
    expect(formatElapsed(0, 125_000)).toBe("2 min 5 s");
    expect(formatElapsed(0, 120_000)).toBe("2 min");
    expect(formatElapsed(5_000, 1_000)).toBe("0 s");
  });
});

describe("commercialBadge", () => {
  it("never claims yes for an unchecked licence", () => {
    expect(commercialBadge("check", "x").label).toBe("Check licence");
    expect(commercialBadge("no", "x")).toMatchObject({
      label: "Commercial use: no",
      variant: "error",
    });
    expect(commercialBadge("yes", "x").variant).toBe("success");
  });
});

describe("describeQueue", () => {
  it("counts waiting images and finds the running one", () => {
    const view = describeQueue([
      item({ id: "1", status: "running" }),
      item({ id: "2", status: "waiting" }),
      item({ id: "3", status: "waiting" }),
      item({ id: "4", status: "done" }),
    ]);
    expect(view.waiting).toBe(2);
    expect(view.running?.id).toBe("1");
    expect(view.active).toBe(true);
    expect(describeQueue([item({})]).active).toBe(false);
  });
});

describe("promptHistory", () => {
  it("lists each prompt once, newest first, up to the limit", () => {
    const items = [
      item({ prompt: "old", createdAt: 1 }),
      item({ prompt: "new", createdAt: 3 }),
      item({ prompt: "new", createdAt: 3 }),
      item({ prompt: "mid", createdAt: 2 }),
      item({ prompt: "  ", createdAt: 4 }),
    ];
    expect(promptHistory(items)).toEqual(["new", "mid", "old"]);
    expect(promptHistory(items, 2)).toEqual(["new", "mid"]);
  });
});

describe("model choice", () => {
  const models = [model("a", 10), model("b", 100)];

  it("adds the time of every chosen model for every variation", () => {
    expect(estimateRunSeconds(models, ["a", "b"], 3)).toBe(330);
    expect(estimateRunSeconds(models, [], 3)).toBe(0);
  });

  it("drops unknown ids and falls back to the first model", () => {
    expect(resolveSelectedModels(models, ["b", "gone"])).toEqual(["b"]);
    expect(resolveSelectedModels(models, ["gone"])).toEqual(["a"]);
    expect(resolveSelectedModels([], ["a"])).toEqual([]);
  });

  it("toggles a model on and off", () => {
    expect(toggleModel(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleModel(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("canRetry", () => {
  it("offers a retry for failed and stopped images only", () => {
    expect(canRetry(item({ status: "error" }))).toBe(true);
    expect(canRetry(item({ status: "cancelled" }))).toBe(true);
    expect(canRetry(item({ status: "done" }))).toBe(false);
    expect(canRetry(item({ status: "running" }))).toBe(false);
    expect(canRetry(item({ status: "waiting" }))).toBe(false);
  });
});

describe("formatSeconds", () => {
  it("rounds server times with decimals", () => {
    expect(formatSeconds(152.30000000000001)).toBe("2 min 32 s");
    expect(formatSeconds(25.7)).toBe("26 s");
    expect(formatSeconds(120)).toBe("2 min");
  });
});

describe("sourcePhase", () => {
  it("says checking until the first probe answers, then online or offline", () => {
    expect(sourcePhase({ online: false, message: "Checking..." })).toBe("checking");
    expect(sourcePhase({ online: true, message: null })).toBe("online");
    expect(sourcePhase({ online: false, message: "Cannot reach ComfyUI at x." })).toBe("offline");
  });
});
