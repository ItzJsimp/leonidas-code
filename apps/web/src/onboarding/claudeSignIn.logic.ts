import type { ProviderAuthState } from "@t3tools/contracts";

export const CLAUDE_WAITING_MESSAGE = "Finish signing in in your browser.";
export const CLAUDE_FINISHING_MESSAGE = "Finishing sign-in...";
export const CLAUDE_FAILED_FALLBACK_MESSAGE = "Claude sign-in did not finish. Try again.";

export type ClaudeSignInView =
  | { readonly kind: "idle" }
  | {
      readonly kind: "waiting";
      /** The sign-in page Claude printed. Null until it appears. */
      readonly url: string | null;
      /** Only the client that started the sign-in can cancel it. */
      readonly canCancel: boolean;
    }
  | { readonly kind: "finishing" }
  | { readonly kind: "failed"; readonly message: string };

/**
 * Choose what the Claude card shows while the provider needs a sign-in.
 * `requested` is true after this client asked to sign in, so an old finished
 * attempt does not show on a new visit.
 */
export function getClaudeSignInView(input: {
  readonly auth: ProviderAuthState | null | undefined;
  readonly requested: boolean;
}): ClaudeSignInView {
  const { auth, requested } = input;
  const phase = auth?.phase ?? "idle";
  if (phase === "starting" || phase === "waiting") {
    const url =
      auth?.interaction?.type === "browser"
        ? auth.interaction.url
        : (auth?.authorizationUrl ?? null);
    return { kind: "waiting", url, canCancel: auth?.flowId != null };
  }
  if (phase === "verifying") return { kind: "finishing" };
  if (!requested) return { kind: "idle" };
  if (phase === "succeeded") return { kind: "finishing" };
  if (phase === "failed") {
    return { kind: "failed", message: auth?.message?.trim() || CLAUDE_FAILED_FALLBACK_MESSAGE };
  }
  if (phase === "cancelled") return { kind: "idle" };
  // The start call returned, but the first state has not arrived yet.
  return { kind: "waiting", url: null, canCancel: false };
}
