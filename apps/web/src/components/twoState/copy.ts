/** Morning from 5 AM, afternoon from 12 PM, evening from 5 PM through the night. */
export function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

export interface StatusCounts {
  /** Null until the feed is read, so no page shows a false zero. */
  readonly needsYou: number | null;
  /** Null until the chat list is read. */
  readonly running: number | null;
  /** Chats that are not archived. Null until the chat list is read. */
  readonly openChats: number | null;
  /** Today's brief priorities. Null when the AIOS has no brief for today. */
  readonly today: { readonly done: number; readonly total: number } | null;
}
