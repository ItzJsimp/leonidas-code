import type { ContentActor, ContentStage } from "@t3tools/contracts";

/** The allowed forward moves. `script_review` back to `scripting` is "changes requested". */
const FORWARD: Readonly<Record<ContentStage, ReadonlyArray<ContentStage>>> = {
  idea: ["scripting"],
  scripting: ["script_review"],
  script_review: ["ready_to_film", "scripting"],
  ready_to_film: ["filmed"],
  filmed: ["cut_review"],
  cut_review: ["revision_1", "delivered"],
  revision_1: ["revision_2", "delivered"],
  // A third revision needs Jake; it stays in the map until brand revisions get a design.
  revision_2: ["delivered"],
  delivered: ["paid"],
  paid: [],
};

/** Agents draft. They never approve, deliver or mark paid. */
const AGENT_MOVES: ReadonlyArray<string> = ["idea>scripting", "scripting>script_review"];

export type MoveCheck =
  | { readonly ok: true; readonly undo: boolean }
  | { readonly ok: false; readonly reason: string };

/** The stage rules: a pure function of the two stages and the kind of actor. */
export function canMove(
  from: ContentStage,
  to: ContentStage,
  actor: ContentActor["kind"],
): MoveCheck {
  if (from === to) return { ok: false, reason: `The video is already in ${to}.` };
  if (actor === "agent") {
    return AGENT_MOVES.includes(`${from}>${to}`)
      ? { ok: true, undo: false }
      : {
          ok: false,
          reason: "Agents move a video only from idea to script_review. A person does the rest.",
        };
  }
  if (FORWARD[from].includes(to)) return { ok: true, undo: false };
  // A person may undo one step: back along any allowed move.
  if (FORWARD[to].includes(from)) return { ok: true, undo: true };
  return { ok: false, reason: `A video cannot move from ${from} to ${to}.` };
}
