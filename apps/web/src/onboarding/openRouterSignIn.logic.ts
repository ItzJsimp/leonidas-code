import type { ProviderAuthState } from "@t3tools/contracts";

import type { getOnboardingProviderState } from "./providerReadiness.logic";

export const AI_STEP_DESCRIPTION =
  "You need one AI to start. For the best results, use a Claude or ChatGPT plan (about $20 a month). To start free, sign in with OpenRouter.";
export const OPENROUTER_FREE_NOTE =
  "Free models, no card. About 50 requests a day, which is about 10 short chats.";
export const OPENROUTER_INSTALL_NOTE =
  "First the app installs the free Claude program. You do not need a Claude plan.";
export const OPENROUTER_WAITING_MESSAGE = "Finish signing in in your browser.";
export const OPENROUTER_FINISHING_MESSAGE = "Finishing sign-in...";
export const OPENROUTER_FAILED_FALLBACK = "OpenRouter sign-in did not finish. Try again.";

export type OpenRouterCardView =
  | { readonly kind: "ready" }
  | { readonly kind: "install" }
  | { readonly kind: "signIn" }
  | { readonly kind: "waiting"; readonly url: string | null }
  | { readonly kind: "finishing" }
  | { readonly kind: "failed"; readonly message: string };

/**
 * What the free OpenRouter card shows. `requested` is true after this client
 * started a sign-in, so an old finished attempt does not show on a new visit.
 */
export function getOpenRouterCardView(input: {
  readonly providerState: ReturnType<typeof getOnboardingProviderState>;
  readonly auth: ProviderAuthState | null | undefined;
  readonly requested: boolean;
}): OpenRouterCardView {
  const { providerState, auth, requested } = input;
  if (providerState === "ready") return { kind: "ready" };
  if (providerState === "install") return { kind: "install" };
  const phase = auth?.phase ?? "idle";
  if (phase === "starting" || phase === "waiting") {
    const url =
      auth?.interaction?.type === "browser"
        ? auth.interaction.url
        : (auth?.authorizationUrl ?? null);
    return { kind: "waiting", url };
  }
  if (phase === "verifying") return { kind: "finishing" };
  if (!requested) return { kind: "signIn" };
  // A saved key rebuilds the provider, which can end the flow before "succeeded" arrives.
  if (phase === "succeeded" || phase === "idle") return { kind: "finishing" };
  if (phase === "failed") {
    return { kind: "failed", message: auth?.message?.trim() || OPENROUTER_FAILED_FALLBACK };
  }
  return { kind: "signIn" };
}
