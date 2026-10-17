import { describe, expect, it } from "vite-plus/test";

import { decodeOllamaModel } from "./ollamaModelCatalog.ts";

describe("decodeOllamaModel", () => {
  it("names a chat model with its size and keeps the tag as the slug", () => {
    const model = decodeOllamaModel({
      name: "qwen3.8:27b-q4_K_M",
      model: "qwen3.8:27b-q4_K_M",
      size: 18 * 1024 ** 3,
      details: { family: "qwen3", parameter_size: "27B" },
    });
    expect(model).toMatchObject({
      slug: "qwen3.8:27b-q4_K_M",
      name: "qwen3.8:27b-q4_K_M (27B · 18.0 GB)",
      inputCostPerMillionTokens: 0,
      outputCostPerMillionTokens: 0,
    });
  });

  it("hides embedding models", () => {
    expect(decodeOllamaModel({ name: "nomic-embed-text:latest" })).toBeUndefined();
    expect(decodeOllamaModel({ name: "x:1", details: { family: "nomic-bert" } })).toBeUndefined();
  });

  it("ignores rows without a name", () => {
    expect(decodeOllamaModel({ size: 1 })).toBeUndefined();
    expect(decodeOllamaModel("text")).toBeUndefined();
  });
});
