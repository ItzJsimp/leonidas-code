import type { ActivityNow } from "../../agentActivity";

/** A tool call that runs this long turns the bar amber: normal work before that. */
export const LONG_RUN_MS = 60_000;

export interface ActivityBarView {
  readonly verb: string;
  readonly target: string | null;
  readonly tone: "neutral" | "warning" | "error";
  readonly icon: "running" | "thinking" | "long" | "failed" | "kind";
  /** Commands and search patterns read best in the code font. */
  readonly mono: boolean;
}

/** What the composer's live bar says and how it colors it. */
export function activityBarView(now: ActivityNow, longRunning: boolean): ActivityBarView {
  const mono = now.kind === "command" || now.kind === "search";
  if (now.failed && !now.running) {
    return { verb: "Failed", target: now.target, tone: "error", icon: "failed", mono };
  }
  if (now.kind === "think") {
    return { verb: "Thinking", target: now.target, tone: "neutral", icon: "thinking", mono: false };
  }
  if (now.running && longRunning && now.kind !== "idle") {
    return { verb: "Still running", target: now.target, tone: "warning", icon: "long", mono };
  }
  return {
    verb: now.label,
    target: now.target,
    tone: "neutral",
    icon: now.running || now.kind === "idle" ? "running" : "kind",
    mono,
  };
}

/** The bar's plan button: the current step when the agent published a plan. */
export function activityStepLabel(input: {
  readonly currentStep: number | null;
  readonly completedSteps: number;
  readonly totalSteps: number;
}): string {
  if (input.totalSteps <= 0) return "Details";
  const step = Math.min(input.currentStep ?? input.completedSteps + 1, input.totalSteps);
  return `Step ${step} of ${input.totalSteps}`;
}
