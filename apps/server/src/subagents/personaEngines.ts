/**
 * Which engines honor a subagent persona (ADR-0082). The Claude adapter starts
 * the persona as the whole system prompt with only the listed tools. The Codex
 * adapter puts the persona first in its developer instructions, but Codex still
 * loads AGENTS.md, so the child starts larger. Every other engine ignores the
 * persona, so a spawn on it is refused instead of running as a plain child.
 */
export type PersonaEngineSupport =
  | { readonly kind: "lean" }
  | { readonly kind: "larger"; readonly note: string }
  | { readonly kind: "unsupported"; readonly message: string };

export function personaEngineSupport(input: {
  readonly driver: string;
  readonly subagent: string;
  readonly engineName: string;
}): PersonaEngineSupport {
  switch (input.driver) {
    case "claudeAgent":
      return { kind: "lean" };
    case "codex":
      return {
        kind: "larger",
        note: "Codex also loads the project's AGENTS.md, so this start costs more than the estimate.",
      };
    default:
      return {
        kind: "unsupported",
        message: `Subagent "${input.subagent}" cannot run on ${input.engineName}: that engine ignores a subagent's persona. Give it a Claude or Codex model in the Subagents view.`,
      };
  }
}
