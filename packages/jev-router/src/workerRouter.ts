import { decide, Decision } from "./decider.js";
import { JevClientProtocol } from "./typesafeClient.js";

export type WorkerTier = "fast" | "opus";

export const ROUTES: Record<string, WorkerTier> = {
  rename_or_move: "fast",
  small_edit_following_existing_pattern: "fast",
  new_logic: "opus",
  debugging: "opus",
  design_decision: "opus",
};

export interface RouteResult {
  tier: WorkerTier;
  category: string;
  decision: Decision;
  escalatedToOpus: boolean;
  explanation: string;
}

export async function routeStep(
  step: string,
  recentDiff = "",
  client: JevClientProtocol,
  threshold = 0.8,
): Promise<RouteResult> {
  const diffSnippet = recentDiff ? recentDiff.slice(0, 6000) : "(No recent changes)";
  const context = `STEP:\n${step}\n\nRECENT CHANGES:\n${diffSnippet}`;
  const options = Object.keys(ROUTES);

  const decision = await decide(
    client,
    context,
    "What kind of work is this step?",
    options,
    threshold,
  );

  if (!decision.confident) {
    return {
      tier: "opus",
      category: decision.answer,
      decision,
      escalatedToOpus: true,
      explanation: `Confidence ${decision.prob} below threshold ${threshold}; escalated to Opus for safety.`,
    };
  }

  const assigned = ROUTES[decision.answer] ?? "opus";
  return {
    tier: assigned,
    category: decision.answer,
    decision,
    escalatedToOpus: false,
    explanation: `Classified as ${decision.answer} with confidence ${decision.prob}; routed to ${assigned.toUpperCase()}.`,
  };
}
