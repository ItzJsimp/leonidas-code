const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** The first visible character. Unlike `slice(0, 1)`, it keeps a whole emoji or flag. */
export function firstGrapheme(text: string): string {
  return segmenter.segment(text)[Symbol.iterator]().next().value?.segment ?? "";
}

/** The first `max` visible characters. Unlike `slice`, it never cuts an emoji in half. */
export function clipGraphemes(text: string, max: number): string {
  let out = "";
  let count = 0;
  for (const { segment } of segmenter.segment(text)) {
    if (count++ === max) break;
    out += segment;
  }
  return out;
}

/** A short title from free text: whole words only, and "..." when it had to cut. */
export function clipTitle(text: string, max: number): string {
  const clipped = clipGraphemes(text, max);
  if (clipped === text) return text;
  const words = clipped.replace(/\s+\S*$/, "");
  return `${(words || clipped).trimEnd()}...`;
}
