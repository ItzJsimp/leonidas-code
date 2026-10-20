export type AutoRouteTaskSize = "light" | "standard" | "heavy";

const HEAVY_SIGNALS =
  /\b(architect\w*|design|redesign|refactor\w*|migrat\w*|rewrite|implement\w*|build|from scratch|debug\w*|investigat\w*|root cause|race condition|deadlock|performance|optimi[sz]\w*|security|vulnerab\w*|audit|plan|end[- ]to[- ]end|across the (code ?base|repo)|whole (code ?base|repo|app))\b/i;
const LIGHT_SIGNALS =
  /\b(typo|rename|reword|format|lint|commit message|commit|push|bump|changelog|what is|what's|explain this|summari[sz]e|translate|list|show me|quick|small|tiny|one[- ]liner|spelling)\b/i;

/** Rough task size from the prompt alone. Cheap enough to run on every send. */
export function classifyTask(input: {
  readonly prompt: string;
  readonly attachmentCount?: number | undefined;
  readonly planMode?: boolean | undefined;
}): AutoRouteTaskSize {
  const prompt = input.prompt.trim();
  const words = prompt.length === 0 ? 0 : prompt.split(/\s+/).length;
  let weight = 0;
  if (words > 250) weight += 2;
  else if (words > 80) weight += 1;
  else if (words <= 4) weight -= 1;
  if (HEAVY_SIGNALS.test(prompt)) weight += 2;
  if (LIGHT_SIGNALS.test(prompt)) weight -= 1;
  if ((prompt.match(/```/g)?.length ?? 0) >= 2) weight += 1;
  if ((input.attachmentCount ?? 0) > 0) weight += 1;
  if (input.planMode) weight += 3;
  if (weight >= 2) return "heavy";
  if (weight <= -1) return "light";
  return "standard";
}
