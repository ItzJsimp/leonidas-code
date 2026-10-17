import { describe, expect, it } from "vite-plus/test";

import { parseApprovedModels, STARTER_MODELS } from "./starterModels.ts";

describe("approved model list", () => {
  it("loads the JSON file with a size and a date for each model", () => {
    expect(STARTER_MODELS.length).toBeGreaterThan(0);
    for (const model of STARTER_MODELS) {
      expect(model.sizeBytes).toBeGreaterThan(0);
      expect(model.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("drops malformed entries and keeps good ones", () => {
    const list = parseApprovedModels({
      models: [
        { id: "a:1", name: "A", sizeBytes: 10, tokensPerSecond: 42.5 },
        { id: "", name: "B", sizeBytes: 10 },
        { id: "c:1", name: "C", sizeBytes: -1 },
        { id: "d:1", name: "D" },
      ],
    });
    expect(list.map((model) => model.id)).toEqual(["a:1"]);
    expect(list[0]?.tokensPerSecond).toBe(42.5);
  });

  it("returns an empty list for a broken file", () => {
    expect(parseApprovedModels(null)).toEqual([]);
    expect(parseApprovedModels({ models: "x" })).toEqual([]);
  });
});
