import { describe, expect, it } from "vite-plus/test";
import { ProviderDriverKind, ProviderInstanceId } from "@t3tools/contracts";
import { resolveThreadPresets } from "./threadPresets";

const candidates = [
  {
    instanceId: ProviderInstanceId.make("codex"),
    driverKind: ProviderDriverKind.make("codex"),
    label: "Codex",
    models: ["gpt-6-luna", "gpt-6.1-sol", "gpt-6-astra"].map((slug) => ({
      slug,
      name: slug,
      capabilities: {
        optionDescriptors: [
          {
            id: "reasoningEffort",
            label: "Reasoning",
            type: "select" as const,
            options: ["low", "medium", "high"].map((id) => ({ id, label: id })),
          },
        ],
      },
    })),
  },
];

describe("thread presets", () => {
  it("selects subscription models with the requested effort", () => {
    expect(resolveThreadPresets(candidates).map((preset) => preset.selection)).toEqual([
      {
        instanceId: "codex",
        model: "gpt-6-luna",
        options: [{ id: "reasoningEffort", value: "low" }],
      },
      {
        instanceId: "codex",
        model: "gpt-6.1-sol",
        options: [{ id: "reasoningEffort", value: "medium" }],
      },
      {
        instanceId: "codex",
        model: "gpt-6-astra",
        options: [{ id: "reasoningEffort", value: "high" }],
      },
    ]);
  });
  it("does not substitute an unavailable model or unsupported effort", () => {
    expect(resolveThreadPresets([]).every((preset) => preset.selection === null)).toBe(true);
    expect(
      resolveThreadPresets([
        { ...candidates[0]!, models: [{ slug: "gpt-6-luna", name: "Luna" }] },
      ])[0]?.selection,
    ).toBeNull();
  });
});
