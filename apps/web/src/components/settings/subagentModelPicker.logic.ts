import type { ServerProvider } from "@t3tools/contracts";

export interface ModelPickerGroup {
  readonly key: string;
  readonly label: string;
  readonly models: ReadonlyArray<{ readonly slug: string; readonly name: string }>;
}

/**
 * One group per connected account that lists models, then a last group for
 * saved ids that no account offers now, so an old entry stays visible and
 * can be removed.
 */
export function buildModelPickerGroups(
  providers: ReadonlyArray<ServerProvider>,
  selected: ReadonlyArray<string>,
): ReadonlyArray<ModelPickerGroup> {
  const groups: ModelPickerGroup[] = [];
  const offered = new Set<string>();
  for (const provider of providers) {
    if (!provider.enabled || provider.models.length === 0) continue;
    const seen = new Set<string>();
    const models = provider.models.filter((model) => {
      if (seen.has(model.slug)) return false;
      seen.add(model.slug);
      offered.add(model.slug);
      return true;
    });
    groups.push({
      key: provider.instanceId,
      label: provider.auth.label ?? provider.displayName ?? provider.driver,
      models: models.map((model) => ({ slug: model.slug, name: model.name })),
    });
  }
  const saved = selected.filter((slug) => !offered.has(slug));
  if (saved.length > 0) {
    groups.push({
      key: "saved",
      label: "Saved, not offered by an account now",
      models: saved.map((slug) => ({ slug, name: slug })),
    });
  }
  return groups;
}

/** The list after one box changes. Keeps the order, adds new ids last. */
export function toggleModelId(
  selected: ReadonlyArray<string>,
  slug: string,
  checked: boolean,
): string[] {
  const without = selected.filter((id) => id !== slug);
  return checked ? [...without, slug] : without;
}

/** The button text: "None", the model name, or "3 models". */
export function modelPickerSummary(selected: ReadonlyArray<string>): string {
  if (selected.length === 0) return "None";
  if (selected.length === 1) return selected[0]!;
  return `${selected.length} models`;
}
