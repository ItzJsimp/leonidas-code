import type { ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  buildModelPickerGroups,
  modelPickerSummary,
  toggleModelId,
} from "./subagentModelPicker.logic";

const provider = (instanceId: string, label: string, slugs: string[], enabled = true) =>
  ({
    instanceId,
    driver: "claudeAgent",
    displayName: label,
    enabled,
    auth: { label },
    models: slugs.map((slug) => ({ slug, name: slug })),
  }) as unknown as ServerProvider;

describe("buildModelPickerGroups", () => {
  it("makes one group per enabled account that lists models", () => {
    const groups = buildModelPickerGroups(
      [
        provider("a", "Claude (Jake)", ["claude-haiku-5-5", "claude-haiku-5-5"]),
        provider("b", "Claude (Off)", ["claude-opus-5-5"], false),
        provider("c", "Empty", []),
      ],
      [],
    );
    expect(groups.map((group) => group.label)).toEqual(["Claude (Jake)"]);
    expect(groups[0]!.models).toHaveLength(1);
  });

  it("keeps a saved id that no account offers", () => {
    const groups = buildModelPickerGroups(
      [provider("a", "Claude (Jake)", ["claude-haiku-5-5"])],
      ["claude-haiku-5-5", "old-model"],
    );
    expect(groups.at(-1)).toMatchObject({ key: "saved", models: [{ slug: "old-model" }] });
  });
});

describe("toggleModelId", () => {
  it("adds and removes an id once", () => {
    expect(toggleModelId(["a"], "b", true)).toEqual(["a", "b"]);
    expect(toggleModelId(["a", "b"], "b", true)).toEqual(["a", "b"]);
    expect(toggleModelId(["a", "b"], "a", false)).toEqual(["b"]);
  });
});

describe("modelPickerSummary", () => {
  it("names none, one, or a count", () => {
    expect(modelPickerSummary([])).toBe("None");
    expect(modelPickerSummary(["x"])).toBe("x");
    expect(modelPickerSummary(["x", "y"])).toBe("2 models");
  });
});
