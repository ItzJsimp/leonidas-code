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
 * Routes unnamed delegated tasks above their quality floor. Tested free
 * models are eligible only for light tasks, with a subscription fallback.
 * A child starts a fresh session, so leaving the parent loses no cache.
 */
export function routeLightDelegatedTask(input: {
  readonly task: string;
  readonly providers: ReadonlyArray<ServerProvider>;
  readonly isRunnable: (provider: ServerProvider) => boolean;
  /** The mode the child would inherit; providers that cannot offer it are skipped. */
  readonly runtimeMode: RuntimeMode;
  readonly now: number;
  readonly quotaBlockPercent?: number | undefined;
}): {
  readonly selection: ModelSelection;
  readonly reason: string;
  readonly fallback?: ModelSelection;
} | null {
  const light = classifyTask({ prompt: input.task }) === "light";
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
    quotaBlockPercent: input.quotaBlockPercent,
  });
  const paid = decision?.modelSelection;

  for (const slug of light ? TESTED_FREE_LIGHT_MODELS : []) {
    const provider = runnable.find(
      (candidate) =>
        candidate.models.some((model) => model.slug === slug) &&
        !candidate.usageLimits?.windows.some(
          (window) => window.usedPercent >= (input.quotaBlockPercent ?? 90),
        ),
    );
    if (provider) {
      const selection = { instanceId: provider.instanceId, model: slug };
      const reason = "Light task, tested free model";
      return paid === undefined ? { selection, reason } : { selection, reason, fallback: paid };
    }
  }
  return paid === undefined ? null : { selection: paid, reason: decision!.reason };
}
