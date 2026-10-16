import { describe, expect, it } from "vite-plus/test";

import { instanceForModel } from "./instanceForModel.ts";

const providers = [
  { instanceId: "codex", models: [{ slug: "gpt-6-astra" }] },
  { instanceId: "claude_a", models: [{ slug: "claude-haiku-5-5" }] },
  { instanceId: "claude_b", models: [{ slug: "claude-haiku-5-5" }] },
];

describe("instanceForModel", () => {
  it("prefers the parent's account when it offers the model", () => {
    expect(instanceForModel(providers, "claude-haiku-5-5", "claude_b", () => true)).toBe(
      "claude_b",
    );
  });
  it("falls through to the first account that offers it", () => {
    expect(instanceForModel(providers, "claude-haiku-5-5", "codex", () => true)).toBe("claude_a");
  });
  it("skips accounts that cannot run, and returns nothing for an unknown model", () => {
    expect(
      instanceForModel(providers, "claude-haiku-5-5", "codex", (p) => p.instanceId === "claude_b"),
    ).toBe("claude_b");
    expect(instanceForModel(providers, "nope", "codex", () => true)).toBeUndefined();
  });
});
