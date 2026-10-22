/** Morning from 5 AM, afternoon from 12 PM, evening from 5 PM through the night. */
export function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

export interface StatusCounts {
  readonly needsYou: number;
  readonly running: number;
  /** Today's brief priorities. Null when the AIOS has no brief for today. */
  readonly today: { readonly done: number; readonly total: number } | null;
}

export interface StatusPart {
  readonly text: string;
  readonly strong: boolean;
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** The one status line under the greeting. The same counts feed the header stats and the rails. */
export function statusLine({ needsYou, running, today }: StatusCounts): StatusPart[] {
  const parts: StatusPart[] = [
    needsYou === 0
      ? { text: "Nothing needs you.", strong: false }
      : {
          text: `${needsYou} ${plural(needsYou, "thing needs", "things need")} you.`,
          strong: true,
        },
    {
      text:
        running === 0
          ? "No agents are working."
          : `${running} ${plural(running, "agent is", "agents are")} working.`,
      strong: false,
    },
  ];
  if (today === null) return parts;
  const left = today.total - today.done;
  parts.push({
    text:
      today.total === 0
        ? "No priorities for today."
        : left === 0
          ? `All ${today.total} of today's tasks are done.`
          : `${left} of ${today.total} ${plural(left, "tasks is", "tasks are")} left today.`,
    strong: false,
  });
  return parts;
}
