/** The one breathing dot for live work. It holds still when the user asks for less motion. */
export function LiveDot() {
  return (
    <span
      aria-hidden
      className="size-1.5 shrink-0 rounded-full bg-primary motion-safe:animate-pulse"
    />
  );
}
