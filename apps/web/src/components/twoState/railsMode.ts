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
