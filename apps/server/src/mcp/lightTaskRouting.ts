import type { ModelSelection, RuntimeMode, ServerProvider } from "@t3tools/contracts";
import { classifyTask, METERED_DRIVERS, routeTurn } from "@t3tools/shared/autoRouter";

/**
 * Free models that matched Haiku on a read-only lookup probe (2026-10-12),
 * tried in order. Other free slugs are never picked: in the same probe they
 * failed on dead endpoints or rate limits, and the router's family scores
 * rate old 7B to 8B models above Haiku.
 */
const TESTED_FREE_LIGHT_MODELS = [
  "cohere/north-mini-code:free",
  "apodex/apodex-1.1-mini:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
] as const;

const isFreeSlug = (slug: string) => slug.endsWith(":free") || slug === "openrouter/free";

/**
 * Picks a model for a delegated task that names no target, but only when the
 * brief reads as a light task (rename, format, lookup). A tested free model
 * goes first, with the cheapest runnable subscription model as its one-time
 * fallback; without a free model that subscription model runs directly. A
 * delegated child starts a fresh session, so nothing cached is lost by leaving
 * the parent's model. Anything bigger returns null and keeps inheriting.
 */
export function routeLightDelegatedTask(input: {
  readonly task: string;
  readonly providers: ReadonlyArray<ServerProvider>;
  readonly isRunnable: (provider: ServerProvider) => boolean;
  /** The mode the child would inherit; providers that cannot offer it are skipped. */
  readonly runtimeMode: RuntimeMode;
  readonly now: number;
}): { readonly selection: ModelSelection; readonly fallback?: ModelSelection } | null {
  if (classifyTask({ prompt: input.task }) !== "light") return null;
  const runnable = input.providers.filter((provider) => {
    const modes = provider.supportedRuntimeModes ?? [];
    return input.isRunnable(provider) && (modes.length === 0 || modes.includes(input.runtimeMode));
  });

  const decision = routeTurn({
    preference: "cost",
    prompt: input.task,
    // Subscription models only: a pay-per-token key must never be billed for
    // a task meant to save money, including as a free model's fallback.
    candidates: runnable
      .filter((provider) => !METERED_DRIVERS.has(provider.driver))
      .map((provider) => ({
        instanceId: provider.instanceId,
        driverKind: provider.driver,
        label: provider.auth.label ?? provider.displayName ?? provider.driver,
        usageLimits: provider.usageLimits,
        models: provider.models.filter((model) => !isFreeSlug(model.slug)),
      })),
    now: input.now,
  });
  const paid = decision?.task === "light" ? decision.modelSelection : undefined;

  for (const slug of TESTED_FREE_LIGHT_MODELS) {
    const provider = runnable.find((candidate) =>
      candidate.models.some((model) => model.slug === slug),
    );
    if (provider) {
      const selection = { instanceId: provider.instanceId, model: slug };
      return paid === undefined ? { selection } : { selection, fallback: paid };
    }
  }
  return paid === undefined ? null : { selection: paid };
}
