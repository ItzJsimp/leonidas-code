import type { ProviderInstallState, ServerProvider } from "@t3tools/contracts";

import { getOnboardingProviderState } from "./providerReadiness.logic";

export type ClaudeStepStatus = "pending" | "active" | "done";

export interface ClaudeConnectStep {
  readonly id: "find" | "install" | "check" | "signIn";
  readonly label: string;
  readonly status: ClaudeStepStatus;
}

export type ClaudeConnectView =
  | { readonly kind: "checking" }
  | { readonly kind: "ready" }
  | { readonly kind: "idle"; readonly headline: string }
  | {
      readonly kind: "running";
      readonly steps: ReadonlyArray<ClaudeConnectStep>;
      readonly message: string | null;
      /** Set once the CLI printed a sign-in link. */
      readonly signInUrl: string | null;
      readonly awaitingCode: boolean;
      readonly operationId: string | null;
    }
  | {
      readonly kind: "failed";
      readonly message: string;
      /** Label of the single recovery button. */
      readonly recoveryLabel: string;
      readonly details: string | null;
    };

const STEP_LABELS = {
  find: "Looking for Claude",
  install: "Installing Claude",
  check: "Checking it works",
  signIn: "Signing you in",
} as const;

const ACTIVE_STEP_BY_PHASE: Readonly<Record<string, ClaudeConnectStep["id"]>> = {
  checking: "find",
  downloading: "install",
  installing: "install",
  extracting: "install",
  verifying: "check",
  signingIn: "signIn",
};
const ORDER = ["find", "install", "check", "signIn"] as const;

export const isClaudeSetupRunning = (install: ProviderInstallState | undefined) =>
  install !== undefined && install.phase in ACTIVE_STEP_BY_PHASE;

export function claudeSteps(phase: string): ReadonlyArray<ClaudeConnectStep> {
  const active = ACTIVE_STEP_BY_PHASE[phase];
  const activeIndex = active ? ORDER.indexOf(active) : -1;
  return ORDER.map((id, index) => ({
    id,
    label: STEP_LABELS[id],
    status: index < activeIndex ? "done" : index === activeIndex ? "active" : "pending",
  }));
}

/**
 * What the Claude card shows. The provider snapshot decides "ready" so the
 * card flips on its own the moment the server reports Claude usable; the
 * install job only describes work in flight or why it stopped. The CLI
 * version never appears here.
 */
export function describeClaudeConnect(
  provider: ServerProvider | undefined,
  install: ProviderInstallState | undefined,
): ClaudeConnectView {
  if (isClaudeSetupRunning(install)) {
    return {
      kind: "running",
      steps: claudeSteps(install!.phase),
      message: install!.message,
      signInUrl: install!.signInUrl ?? null,
      awaitingCode: install!.awaitingCode === true,
      operationId: install!.operationId,
    };
  }
  const state = getOnboardingProviderState(provider);
  if (state === "ready") return { kind: "ready" };
  if (install?.phase === "failed") {
    return {
      kind: "failed",
      message: install.message ?? "Couldn't connect Claude.",
      recoveryLabel: install.recovery === "signIn" ? "Try signing in again" : "Try again",
      details: install.details ?? null,
    };
  }
  if (state === "checking") return { kind: "checking" };
  if (state === "disabled") return { kind: "idle", headline: "Turned off in settings." };
  return {
    kind: "idle",
    headline:
      state === "signIn" ? "Sign in to start coding." : "Connect your Claude account to start coding.",
  };
}
