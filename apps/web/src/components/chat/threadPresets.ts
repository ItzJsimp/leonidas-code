import type { ModelSelection } from "@t3tools/contracts";
import type { AutoRouteCandidate } from "@t3tools/shared/autoRouter";

const THREAD_PRESETS = [
  { label: "Lookup", model: "gpt-6-luna", effort: "low" },
  { label: "Build", model: "gpt-6.1-sol", effort: "medium" },
  { label: "Architect", model: "gpt-6-astra", effort: "high" },
] as const;

/** Resolve only models and effort values offered by connected picker candidates. */
export function resolveThreadPresets(candidates: ReadonlyArray<AutoRouteCandidate>) {
  return THREAD_PRESETS.map((preset) => {
    for (const candidate of candidates) {
      if (candidate.driverKind !== "codex") continue;
      const model = candidate.models.find((model) => model.slug === preset.model);
      const effort = model?.capabilities?.optionDescriptors?.find(
        (option) =>
          option.id === "reasoningEffort" &&
          option.type === "select" &&
          option.options.some((value) => value.id === preset.effort),
      );
      if (!effort) continue;
      const selection: ModelSelection = {
        instanceId: candidate.instanceId,
        model: preset.model,
        options: [{ id: effort.id, value: preset.effort }],
      };
      return { ...preset, selection };
    }
    return { ...preset, selection: null };
  });
}
