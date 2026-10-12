// Port of petdex `sprite.zig` (MIT, crafter-station/petdex): which atlas row each pet
// state lives on and how long each frame holds. Pure data so animation tables can change
// without touching the player.

export const PET_CELL_WIDTH = 192;
export const PET_CELL_HEIGHT = 208;

export const PET_STATES = [
  "idle",
  "running-right",
  "running-left",
  "waving",
  "jumping",
  "failed",
  "waiting",
  "running",
  "review",
] as const;

export type PetState = (typeof PET_STATES)[number];

export interface PetFrame {
  readonly col: number;
  readonly durationMs: number;
}

export interface PetStateDef {
  readonly row: number;
  readonly frames: readonly PetFrame[];
}

// Frames hold `hold` ms, except the last which holds `last` ms.
function uniform(count: number, hold: number, last: number): readonly PetFrame[] {
  return Array.from({ length: count }, (_, col) => ({
    col,
    durationMs: col === count - 1 ? last : hold,
  }));
}

const IDLE_HOLDS = [280, 110, 110, 140, 140, 320] as const;

export const PET_STATE_DEFS: Readonly<Record<PetState, PetStateDef>> = {
  idle: { row: 0, frames: IDLE_HOLDS.map((durationMs, col) => ({ col, durationMs })) },
  "running-right": { row: 1, frames: uniform(8, 120, 220) },
  "running-left": { row: 2, frames: uniform(8, 120, 220) },
  waving: { row: 3, frames: uniform(4, 140, 280) },
  jumping: { row: 4, frames: uniform(5, 140, 280) },
  failed: { row: 5, frames: uniform(8, 140, 240) },
  waiting: { row: 6, frames: uniform(6, 150, 260) },
  running: { row: 7, frames: uniform(6, 120, 220) },
  review: { row: 8, frames: uniform(6, 150, 280) },
};

/** Frame to draw `elapsedMs` after the state started, looping. */
export function frameAt(state: PetState, elapsedMs: number): PetFrame {
  const { frames } = PET_STATE_DEFS[state];
  const cycle = frames.reduce((total, frame) => total + frame.durationMs, 0);
  let remaining = ((elapsedMs % cycle) + cycle) % cycle;
  for (const frame of frames) {
    if (remaining < frame.durationMs) return frame;
    remaining -= frame.durationMs;
  }
  return frames[0]!;
}
