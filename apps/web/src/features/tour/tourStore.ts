import { create } from "zustand";

import { TOUR_TARGETS, type TourStep, type TourTargetId } from "./tourTargets";

interface TourState {
  readonly steps: ReadonlyArray<TourStep>;
  readonly index: number;
  readonly active: boolean;
  start: (targetIds: ReadonlyArray<TourTargetId>) => void;
  next: () => void;
  stop: () => void;
}

export const useTourStore = create<TourState>((set, get) => ({
  steps: [],
  index: 0,
  active: false,
  start: (targetIds) => {
    const steps = targetIds.flatMap((id): ReadonlyArray<TourStep> => TOUR_TARGETS[id].steps);
    if (steps.length > 0) set({ steps, index: 0, active: true });
  },
  next: () => {
    const { index, steps } = get();
    if (index + 1 >= steps.length) set({ active: false, steps: [], index: 0 });
    else set({ index: index + 1 });
  },
  stop: () => set({ active: false, steps: [], index: 0 }),
}));
