import type { ProviderInstallState } from "@t3tools/contracts";

export type ClaudeInstallPillView =
  | { readonly kind: "hidden" }
  | { readonly kind: "installing" }
  | { readonly kind: "installed" }
  | { readonly kind: "failed"; readonly message: string };

/**
 * What the wizard-wide Claude install note shows. The install runs on the server, so it
 * keeps going while the user moves to other steps; this note keeps them informed.
 * `claudeReady` hides it once Claude is installed and signed in.
 */
export function getClaudeInstallPillView(input: {
  readonly installation: ProviderInstallState | null | undefined;
  readonly claudeReady: boolean;
}): ClaudeInstallPillView {
  if (input.claudeReady) return { kind: "hidden" };
  const phase = input.installation?.phase ?? "idle";
  if (phase === "downloading" || phase === "extracting" || phase === "verifying") {
    return { kind: "installing" };
  }
  if (phase === "succeeded") return { kind: "installed" };
  if (phase === "failed") {
    return {
      kind: "failed",
      message: input.installation?.message ?? "Claude did not install. Try again on the AI step.",
    };
  }
  return { kind: "hidden" };
}

/** `83` becomes `1:23`. */
export function formatElapsed(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
