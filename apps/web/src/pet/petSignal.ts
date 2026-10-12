import { create } from "zustand";

import type { AgentActivity } from "../agentActivity";
import type { PetState } from "./petAtlas";

/** Where along the bottom edge the pet stands, chosen by what the agent is touching. */
export type PetAnchor = "left" | "center" | "right";

export interface PetSignal {
  readonly state: PetState;
  readonly text: string | null;
  readonly anchor: PetAnchor;
}

export const IDLE_PET_SIGNAL: PetSignal = { state: "idle", text: null, anchor: "center" };

const MAX_BUBBLE_LENGTH = 48;

function bubble(text: string): string {
  return text.length > MAX_BUBBLE_LENGTH ? `${text.slice(0, MAX_BUBBLE_LENGTH - 1)}…` : text;
}

/**
 * Maps the composer's agent activity onto the nine petdex states. Reading, searching and
 * thinking read as `review`, tool and shell work as `running`, and a blocked agent as
 * `waiting`. Files sit on the left, shell and web on the right, thinking in the middle.
 */
export function derivePetSignal(
  activity: Pick<AgentActivity, "now" | "waiting"> | null,
): PetSignal {
  if (!activity) return IDLE_PET_SIGNAL;
  const { now, waiting } = activity;
  const text = bubble(now.text);
  if (waiting.length > 0) return { state: "waiting", text, anchor: "center" };
  if (!now.running) return { state: "idle", text: null, anchor: "center" };
  switch (now.kind) {
    case "write":
      return { state: "running", text, anchor: "left" };
    case "read":
    case "search":
    case "memory":
    case "skill":
      return { state: "review", text, anchor: "left" };
    case "command":
    case "web":
    case "agent":
      return { state: "running", text, anchor: "right" };
    case "tool":
      return { state: "running", text, anchor: "center" };
    default:
      return { state: "review", text, anchor: "center" };
  }
}

/** Brief reaction when a run ends: celebrate a finished one, grimace at a failed one. */
export function finishedPetSignal(failed: boolean): PetSignal {
  return { state: failed ? "failed" : "jumping", text: null, anchor: "center" };
}

export const usePetSignalStore = create<{
  signal: PetSignal;
  publish: (signal: PetSignal) => void;
}>((set, get) => ({
  signal: IDLE_PET_SIGNAL,
  publish: (signal) => {
    const current = get().signal;
    if (
      current.state !== signal.state ||
      current.text !== signal.text ||
      current.anchor !== signal.anchor
    ) {
      set({ signal });
    }
  },
}));
