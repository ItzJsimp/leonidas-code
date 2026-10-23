import {
  CLAUDE_FINISHING_MESSAGE,
  CLAUDE_WAITING_MESSAGE,
  type ClaudeSignInView,
} from "../../onboarding/claudeSignIn.logic";

export const CHAT_SIGN_IN_PROMPT = "Claude is signed out. Sign in to continue.";
export const CHAT_SIGN_IN_DONE_MESSAGE = "Signed in. Send your message again.";

export type ChatSignInState =
  | { readonly kind: "hidden" }
  | { readonly kind: "ready"; readonly detail: string; readonly label: string }
  | {
      readonly kind: "waiting";
      readonly detail: string;
      readonly url: string | null;
      readonly canCancel: boolean;
    }
  | { readonly kind: "finishing"; readonly detail: string }
  | { readonly kind: "done"; readonly detail: string };

/**
 * What the Sign in action under a failed chat message shows. An old failure in
 * a chat that is already signed in again stays hidden unless this client just
 * signed in, so the user sees the result of their click and nothing more.
 */
export function getChatSignInState(input: {
  readonly view: ClaudeSignInView;
  readonly requested: boolean;
  readonly authenticated: boolean;
  readonly error: string | null;
}): ChatSignInState {
  const { view, requested, authenticated, error } = input;
  if (authenticated) {
    return requested ? { kind: "done", detail: CHAT_SIGN_IN_DONE_MESSAGE } : { kind: "hidden" };
  }
  if (view.kind === "waiting") {
    return {
      kind: "waiting",
      detail: CLAUDE_WAITING_MESSAGE,
      url: view.url,
      canCancel: view.canCancel,
    };
  }
  if (view.kind === "finishing") return { kind: "finishing", detail: CLAUDE_FINISHING_MESSAGE };
  if (view.kind === "failed" || error !== null) {
    return {
      kind: "ready",
      detail: error ?? (view.kind === "failed" ? view.message : CHAT_SIGN_IN_PROMPT),
      label: "Try again",
    };
  }
  return { kind: "ready", detail: CHAT_SIGN_IN_PROMPT, label: "Sign in with Claude" };
}
