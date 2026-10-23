export type RailsMode = "rails" | "drawer" | "none";

/** Rails beside the chat, the same rails in a drawer when the chat is narrow, or neither in a split. */
export function railsMode(input: {
  readonly fits: boolean;
  readonly split: boolean;
  readonly splitActive: boolean;
}): RailsMode {
  if (input.split || input.splitActive) return "none";
  return input.fits ? "rails" : "drawer";
}

/** Below this width each half of the split is too small for the chat header and the cards. */
export const SPLIT_MIN_WIDTH = 900;
export const splitFits = (width: number) => width >= SPLIT_MIN_WIDTH;
